"""
Tests for Training Pipeline — Smart Parking demand prediction.

Validates:
  - Pipeline class initializes without crashing
  - load_data() handles missing file gracefully
  - preprocess() returns passthrough data
  - engineer_features() returns passthrough
  - split_data() creates train/val splits
  - train() with "baseline" type works
  - evaluate() returns metrics dict
  - save() writes metadata file
  - full pipeline run() completes without errors
  - CLI --train flag works
  - corrupted data file handling

Usage:
    cd ai-service
    pytest tests/test_pipeline.py -v
"""

import os
import sys
import json
import pytest
from unittest.mock import patch, MagicMock
from pathlib import Path

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from training.pipeline import TrainingPipeline


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture
def pipeline(tmp_path):
    """Create a pipeline with temporary data/output paths."""
    data_path = str(tmp_path / "test_data.csv")
    output_path = str(tmp_path / "test_model.pkl")
    return TrainingPipeline(data_path=data_path, model_output=output_path)


@pytest.fixture
def no_data_pipeline(tmp_path):
    """Pipeline pointing to non-existent data file."""
    output_path = str(tmp_path / "test_model.pkl")
    return TrainingPipeline(
        data_path=str(tmp_path / "nonexistent_data.csv"),
        model_output=output_path,
    )


# ── 1. Architecture Integrity ────────────────────────────────────────────────

class TestPipelineArchitecture:
    def test_training_module_importable(self):
        import training.pipeline
        assert training.pipeline.TrainingPipeline is not None

    def test_pipeline_class_has_required_methods(self):
        """All 7 pipeline steps + run must exist."""
        required = [
            "load_data",
            "preprocess",
            "engineer_features",
            "split_data",
            "train",
            "evaluate",
            "save",
            "run",
        ]
        for method in required:
            assert hasattr(TrainingPipeline, method), f"Missing method: {method}"

    def test_pipeline_init_no_crash(self, pipeline):
        assert pipeline is not None


# ── 2. Load Data ─────────────────────────────────────────────────────────────

class TestLoadData:
    def test_load_data_with_missing_file(self, no_data_pipeline):
        """Should NOT crash — create empty placeholder."""
        result = no_data_pipeline.load_data()
        assert result is no_data_pipeline  # returns self for chaining
        assert no_data_pipeline.raw_data is not None

    def test_load_data_returns_self(self, pipeline):
        result = pipeline.load_data()
        assert result is pipeline

    def test_load_data_raw_data_exists(self, pipeline):
        pipeline.load_data()
        assert pipeline.raw_data is not None


# ── 3. Preprocess ────────────────────────────────────────────────────────────

class TestPreprocess:
    def test_preprocess_no_crash(self, pipeline):
        pipeline.load_data()
        result = pipeline.preprocess()
        assert result is pipeline

    def test_preprocess_produces_cleaned_data(self, pipeline):
        pipeline.load_data()
        pipeline.preprocess()
        assert pipeline.cleaned_data is not None


# ── 4. Feature Engineering ───────────────────────────────────────────────────

class TestFeatureEngineering:
    def test_engineer_features_no_crash(self, pipeline):
        pipeline.load_data().preprocess()
        result = pipeline.engineer_features()
        assert result is pipeline

    def test_engineer_features_produces_output(self, pipeline):
        pipeline.load_data().preprocess().engineer_features()
        assert pipeline.features is not None


# ── 5. Split Data ────────────────────────────────────────────────────────────

class TestSplitData:
    def test_split_data_no_crash(self, pipeline):
        pipeline.load_data().preprocess().engineer_features()
        result = pipeline.split_data(test_size=0.2)
        assert result is pipeline

    def test_split_data_creates_attributes(self, pipeline):
        pipeline.load_data().preprocess().engineer_features().split_data()
        assert hasattr(pipeline, "X_train")
        assert hasattr(pipeline, "X_val")
        assert hasattr(pipeline, "y_train")
        assert hasattr(pipeline, "y_val")

    def test_split_data_default_test_size(self, pipeline):
        """Default test_size should be 0.2."""
        pipeline.load_data().preprocess().engineer_features().split_data()
        # Placeholder: both should be empty lists
        assert pipeline.X_train == []
        assert pipeline.X_val == []


# ── 6. Train ─────────────────────────────────────────────────────────────────

class TestTrain:
    def test_train_baseline_no_crash(self, pipeline):
        pipeline.load_data().preprocess().engineer_features().split_data()
        result = pipeline.train(model_type="baseline")
        assert result is pipeline
        assert pipeline.model_type == "baseline"

    def test_train_sets_model_attribute(self, pipeline):
        pipeline.load_data().preprocess().engineer_features().split_data()
        pipeline.train(model_type="baseline")
        assert pipeline.model == "baseline"

    def test_train_unknown_type_no_crash(self, pipeline):
        """Unknown model type should still work (no real training for placeholders)."""
        pipeline.load_data().preprocess().engineer_features().split_data()
        pipeline.train(model_type="unknown_placeholder")
        assert pipeline.model_type == "unknown_placeholder"


# ── 7. Evaluate ──────────────────────────────────────────────────────────────

class TestEvaluate:
    def test_evaluate_returns_dict(self, pipeline):
        pipeline.load_data().preprocess().engineer_features().split_data().train()
        metrics = pipeline.evaluate()
        assert isinstance(metrics, dict)

    def test_evaluate_has_required_metrics(self, pipeline):
        pipeline.load_data().preprocess().engineer_features().split_data().train()
        metrics = pipeline.evaluate()
        # Baseline should have placeholder values
        assert "mae" in metrics
        assert "rmse" in metrics
        assert "r2" in metrics


# ── 8. Save ──────────────────────────────────────────────────────────────────

class TestSave:
    def test_save_creates_metadata_file(self, pipeline, tmp_path):
        pipeline.load_data().preprocess().engineer_features().split_data().train()
        # Use tmp_path for metadata too
        meta_path = str(tmp_path / "test_meta.json")
        from app.models.prediction_model import DEFAULT_MODEL_PATH
        # Save will write metadata to default location — intercept it
        with patch("training.pipeline.PredictionModel") as MockModel:
            mock_instance = MagicMock()
            MockModel.return_value = mock_instance
            pipeline.save()
            mock_instance.save_metadata.assert_called_once()

    def test_save_returns_model_path(self, pipeline):
        pipeline.load_data().preprocess().engineer_features().split_data().train()
        with patch("training.pipeline.PredictionModel") as MockModel:
            mock_instance = MagicMock()
            MockModel.return_value = mock_instance
            result = pipeline.save()
            assert result == pipeline.model_output


# ── 9. Full Pipeline Run ─────────────────────────────────────────────────────

class TestFullPipeline:
    def test_run_no_crash(self, no_data_pipeline):
        """Full run with no data file should complete gracefully."""
        with patch("training.pipeline.PredictionModel") as MockModel:
            mock_instance = MagicMock()
            MockModel.return_value = mock_instance
            result = no_data_pipeline.run(model_type="baseline")
            assert isinstance(result, dict)
            assert "status" in result
            assert result["status"] == "complete"

    def test_run_returns_result_dict(self, no_data_pipeline):
        with patch("training.pipeline.PredictionModel") as MockModel:
            mock_instance = MagicMock()
            MockModel.return_value = mock_instance
            result = no_data_pipeline.run()
            assert "model_type" in result
            assert "model_path" in result
            assert "metrics" in result

    def test_run_model_type_in_result(self, no_data_pipeline):
        with patch("training.pipeline.PredictionModel") as MockModel:
            mock_instance = MagicMock()
            MockModel.return_value = mock_instance
            result = no_data_pipeline.run(model_type="baseline")
            assert result["model_type"] == "baseline"


# ── 10. CLI Entrypoint ───────────────────────────────────────────────────────

class TestCLI:
    def test_cli_train_flag(self, capsys, no_data_pipeline):
        """python training/pipeline.py --train should not crash."""
        with patch("training.pipeline.TrainingPipeline") as MockPipeline:
            mock_instance = MagicMock()
            mock_instance.run.return_value = {
                "model_type": "baseline",
                "model_path": "/tmp/test.pkl",
                "metrics": {"mae": 0.12},
                "status": "complete",
            }
            MockPipeline.return_value = mock_instance

            from training.pipeline import main
            # Simulate sys.argv
            with patch.object(sys, "argv", ["pipeline.py", "--train"]):
                main()

            mock_instance.run.assert_called_once_with(model_type="baseline")

    def test_cli_no_args_shows_help(self, capsys):
        from training.pipeline import main
        with patch.object(sys, "argv", ["pipeline.py"]):
            main()
        captured = capsys.readouterr()
        assert "usage" in captured.out.lower() or "train" in captured.out.lower()


# ── 11. Corrupted Data Handling ──────────────────────────────────────────────

class TestCorruptedData:
    def test_corrupted_csv_file(self, tmp_path):
        """Pipeline should handle corrupted/unreadable CSV file."""
        corrupt_file = tmp_path / "corrupt.csv"
        corrupt_file.write_text("THIS IS NOT A CSV FILE\n@#$%^&*")

        p = TrainingPipeline(data_path=str(corrupt_file))
        # Should not crash — fall back to empty dataframe
        p.load_data()
        assert p.raw_data is not None

    def test_empty_csv_file(self, tmp_path):
        """Pipeline should handle completely empty file."""
        empty_file = tmp_path / "empty.csv"
        empty_file.write_text("")

        p = TrainingPipeline(data_path=str(empty_file))
        p.load_data()
        assert p.raw_data is not None

    def test_binary_as_csv(self, tmp_path):
        """Pipeline should handle binary garbage as CSV."""
        bin_file = tmp_path / "binary.csv"
        bin_file.write_bytes(b"\x00\x01\x02\x03\x04\x05")

        p = TrainingPipeline(data_path=str(bin_file))
        p.load_data()
        assert p.raw_data is not None


# ── 12. No-Dataset Mode ──────────────────────────────────────────────────────

class TestNoDatasetMode:
    """Test that the pipeline works when no dataset is available."""

    def test_pipeline_without_data(self, tmp_path):
        """Full pipeline run with non-existent data file."""
        output_path = str(tmp_path / "no_data_model.pkl")
        p = TrainingPipeline(
            data_path=str(tmp_path / "does_not_exist.csv"),
            model_output=output_path,
        )
        with patch("training.pipeline.PredictionModel") as MockModel:
            mock_instance = MagicMock()
            MockModel.return_value = mock_instance

            result = p.run()
            assert result["status"] == "complete"
            assert result["model_type"] == "baseline"

    def test_model_loads_without_training(self):
        """PredictionModel should work without any trained model."""
        from app.models.prediction_model import PredictionModel
        m = PredictionModel()
        # Should use baseline heuristic
        preds = m.predict(hour=10, horizon=5)
        assert len(preds) == 5
        assert all(0.0 <= v <= 1.0 for v in preds)
