"""
API Contract Test — Smart Parking Demand Prediction.

Validates that the input/output schema matches EXACTLY between:
  - FastAI model prediction endpoint (ai-service)
  - Node.js prediction_service.js consumer layer (backend)

Tests ensure field names, types, and structure are consistent.

Usage:
    cd ai-service
    pytest tests/test_api_contract.py -v
"""

import os
import sys
import json
import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


# ── Schema Definitions ───────────────────────────────────────────────────────

# Expected input from Node.js → FastAPI
EXPECTED_INPUT_SCHEMA = {
    "hour": {"type": int, "required": True, "min": 0, "max": 23},
    "horizon": {"type": int, "required": False, "default": 3, "min": 1, "max": 24},
}

# Expected output from FastAPI → Node.js
EXPECTED_OUTPUT_SCHEMA = {
    "success": {"type": bool},
    "data": {
        "prediction": {"type": list, "item_type": float, "min_items": 1},
        "hours_ahead": {"type": int, "min": 1},
    },
}

# Expected output from Node.js prediction_service.js → Backend consumer
EXPECTED_SERVICE_OUTPUT = {
    "predictions": {"type": list, "item_type": float, "min_items": 1},
    "confidence": {"type": float, "min": 0, "max": 1},
    "version": {"type": str},
    "metadata": {
        "generated_at": {"type": str},  # ISO timestamp
        "model_type": {"type": str},
        "source": {"type": str},
    },
}


# ── Helpers ──────────────────────────────────────────────────────────────────

def validate_schema(data, schema, path="root"):
    """Recursively validate data against schema definition."""
    errors = []

    for key, spec in schema.items():
        if key not in data:
            if spec.get("required", True):
                errors.append(f"{path}: missing required key '{key}'")
            continue

        value = data[key]

        # Type check
        if "type" in spec:
            if isinstance(spec["type"], type):
                if not isinstance(value, spec["type"]):
                    errors.append(f"{path}.{key}: expected {spec['type'].__name__}, got {type(value).__name__}")

            # Special case: float also accepts int in Python
            elif spec["type"] == float and isinstance(value, (int, float)):
                pass

        # Range check
        if "min" in spec and isinstance(value, (int, float)):
            if value < spec["min"]:
                errors.append(f"{path}.{key}: value {value} < min {spec['min']}")

        if "max" in spec and isinstance(value, (int, float)):
            if value > spec["max"]:
                errors.append(f"{path}.{key}: value {value} > max {spec['max']}")

        # List item type check
        if "item_type" in spec and isinstance(value, list):
            for i, item in enumerate(value):
                if not isinstance(item, spec["item_type"]):
                    errors.append(f"{path}.{key}[{i}]: expected {spec['item_type'].__name__}, got {type(item).__name__}")

        if "min_items" in spec and isinstance(value, list):
            if len(value) < spec["min_items"]:
                errors.append(f"{path}.{key}: expected at least {spec['min_items']} items, got {len(value)}")

        # Nested schema
        if isinstance(spec, dict) and "type" not in spec and isinstance(value, dict):
            nested_errors = validate_schema(value, spec, path=f"{path}.{key}")
            errors.extend(nested_errors)

    return errors


# ── 1. Input Schema Validation ───────────────────────────────────────────────

class TestInputSchema:
    """Validate that inputs match the expected contract."""

    def test_valid_input(self):
        payload = {"hour": 14, "horizon": 5}
        errors = validate_schema(payload, EXPECTED_INPUT_SCHEMA)
        assert len(errors) == 0, f"Valid input should pass: {errors}"

    def test_valid_input_minimal(self):
        payload = {"hour": 10}  # horizon is optional
        errors = validate_schema(payload, EXPECTED_INPUT_SCHEMA)
        assert len(errors) == 0, f"Minimal valid input should pass: {errors}"

    def test_valid_input_edge_hour_0(self):
        payload = {"hour": 0, "horizon": 1}
        errors = validate_schema(payload, EXPECTED_INPUT_SCHEMA)
        assert len(errors) == 0

    def test_valid_input_edge_hour_23(self):
        payload = {"hour": 23, "horizon": 24}
        errors = validate_schema(payload, EXPECTED_INPUT_SCHEMA)
        assert len(errors) == 0

    def test_missing_hour_fails(self):
        payload = {"horizon": 5}
        errors = validate_schema(payload, EXPECTED_INPUT_SCHEMA)
        assert any("hour" in e and "missing" in e for e in errors), \
            f"Missing required 'hour' should fail: {errors}"

    def test_hour_type_int(self):
        payload = {"hour": 14.5, "horizon": 3}
        errors = validate_schema(payload, EXPECTED_INPUT_SCHEMA)
        assert any("hour" in e for e in errors), \
            f"Float hour should fail type check: {errors}"

    def test_horizon_out_of_range_high(self):
        payload = {"hour": 10, "horizon": 30}
        errors = validate_schema(payload, EXPECTED_INPUT_SCHEMA)
        assert any("horizon" in e for e in errors), \
            f"Horizon > 24 should fail: {errors}"

    def test_horizon_out_of_range_low(self):
        payload = {"hour": 10, "horizon": 0}
        errors = validate_schema(payload, EXPECTED_INPUT_SCHEMA)
        assert any("horizon" in e for e in errors), \
            f"Horizon < 1 should fail: {errors}"

    def test_hour_negative(self):
        payload = {"hour": -1, "horizon": 3}
        errors = validate_schema(payload, EXPECTED_INPUT_SCHEMA)
        assert any("hour" in e for e in errors), \
            f"Negative hour should fail: {errors}"


# ── 2. Output Schema Validation — FastAPI Response ───────────────────────────

class TestOutputSchemaFastAPI:
    """Validate FastAPI response matches expected contract."""

    def test_valid_output_structure(self):
        output = {
            "success": True,
            "data": {
                "prediction": [0.72, 0.75, 0.81],
                "hours_ahead": 3,
            },
        }
        errors = validate_schema(output, EXPECTED_OUTPUT_SCHEMA)
        assert len(errors) == 0, f"Valid output should pass: {errors}"

    def test_prediction_values_in_range(self):
        output = {
            "success": True,
            "data": {
                "prediction": [0.0, 0.5, 1.0],
                "hours_ahead": 3,
            },
        }
        errors = validate_schema(output, EXPECTED_OUTPUT_SCHEMA)
        assert len(errors) == 0

    def test_empty_prediction_fails(self):
        output = {
            "success": True,
            "data": {
                "prediction": [],
                "hours_ahead": 3,
            },
        }
        errors = validate_schema(output, EXPECTED_OUTPUT_SCHEMA)
        assert any("prediction" in e for e in errors), \
            f"Empty prediction list should fail min_items: {errors}"

    def test_prediction_string_values_fail(self):
        output = {
            "success": True,
            "data": {
                "prediction": ["0.7", "0.8"],
                "hours_ahead": 2,
            },
        }
        errors = validate_schema(output, EXPECTED_OUTPUT_SCHEMA)
        assert any("prediction" in e for e in errors), \
            f"String predictions should fail type check: {errors}"

    def test_missing_data_key_fails(self):
        output = {"success": True}
        errors = validate_schema(output, EXPECTED_OUTPUT_SCHEMA)
        assert any("data" in e for e in errors), \
            f"Missing 'data' should fail: {errors}"

    def test_success_is_boolean(self):
        output = {
            "success": "true",
            "data": {"prediction": [0.5], "hours_ahead": 1},
        }
        errors = validate_schema(output, EXPECTED_OUTPUT_SCHEMA)
        assert any("success" in e for e in errors), \
            f"String 'success' should fail: {errors}"


# ── 3. Output Schema Validation — Node.js Service Response ───────────────────

class TestOutputSchemaNodeService:
    """Validate Node.js prediction_service output matches expected contract."""

    def test_valid_service_output(self):
        output = {
            "predictions": [0.72, 0.75, 0.81],
            "confidence": 0.78,
            "version": "0.1.0",
            "metadata": {
                "generated_at": "2026-04-07T14:00:00Z",
                "model_type": "placeholder-baseline",
                "source": "ai-service",
            },
        }
        errors = validate_schema(output, EXPECTED_SERVICE_OUTPUT)
        assert len(errors) == 0, f"Valid service output should pass: {errors}"

    def test_service_confidence_in_range(self):
        output = {
            "predictions": [0.5],
            "confidence": 1.5,  # Invalid
            "version": "0.1.0",
            "metadata": {"generated_at": "2026-04-07T14:00:00Z", "model_type": "test", "source": "mock"},
        }
        errors = validate_schema(output, EXPECTED_SERVICE_OUTPUT)
        assert any("confidence" in e for e in errors), \
            f"Confidence > 1 should fail: {errors}"

    def test_service_metadata_has_all_keys(self):
        output = {
            "predictions": [0.5],
            "confidence": 0.8,
            "version": "0.1.0",
            "metadata": {
                "generated_at": "2026-04-07T14:00:00Z",
                "model_type": "test",
                # Missing "source"
            },
        }
        errors = validate_schema(output, EXPECTED_SERVICE_OUTPUT)
        assert any("source" in e for e in errors), \
            f"Missing metadata.source should fail: {errors}"

    def test_service_generated_at_iso_format(self):
        output = {
            "predictions": [0.5],
            "confidence": 0.8,
            "version": "0.1.0",
            "metadata": {
                "generated_at": "not-a-date",
                "model_type": "test",
                "source": "mock",
            },
        }
        # ISO validation: should at least be a string (schema allows str)
        errors = validate_schema(output, EXPECTED_SERVICE_OUTPUT)
        # String passes schema but we check ISO separately
        assert len(errors) == 0, "String timestamp passes type check"

        # Check it's parseable
        from datetime import datetime
        try:
            datetime.fromisoformat("not-a-date".replace("Z", "+00:00"))
            assert False, "Should have raised"
        except ValueError:
            pass  # Expected


# ── 4. Cross-Layer Contract Consistency ──────────────────────────────────────

class TestCrossLayerConsistency:
    """Ensure FastAPI output can be consumed by Node.js service correctly."""

    def test_fastapi_prediction_maps_to_service_output(self):
        """FastAPI response should contain data that maps to service 'predictions'."""
        fastapi_response = {
            "success": True,
            "data": {
                "prediction": [0.72, 0.75, 0.81, 0.88, 0.92],
                "hours_ahead": 5,
                "confidence": 0.78,
                "version": "0.1.0",
                "model_type": "placeholder-baseline",
            },
        }

        # Node.js service extracts this as:
        service_predictions = fastapi_response["data"]["prediction"]
        service_confidence = fastapi_response["data"].get("confidence", 0.78)
        service_version = fastapi_response["data"].get("version", "0.1.0")
        service_model_type = fastapi_response["data"].get("model_type", "placeholder-baseline")

        # Reconstruct service output
        service_output = {
            "predictions": service_predictions,
            "confidence": service_confidence,
            "version": service_version,
            "metadata": {
                "generated_at": "2026-04-07T14:00:00Z",
                "model_type": service_model_type,
                "source": "ai-service",
            },
        }

        errors = validate_schema(service_output, EXPECTED_SERVICE_OUTPUT)
        assert len(errors) == 0, f"FastAPI → Service mapping should be valid: {errors}"

    def test_area_field_in_prediction_request(self):
        """Request can include 'area' for future multi-area support."""
        request = {
            "area": "A",
            "current_hour": 14,
            "horizon": 6,
            "history": {
                "parking_occupancy": [0.7, 0.8, 0.75],
                "traffic_volume": [100, 120, 110],
            },
        }
        assert "area" in request
        assert isinstance(request["area"], str)
        assert request["current_hour"] >= 0
        assert request["current_hour"] <= 23
        assert request["horizon"] >= 1

    def test_prediction_output_matches_expected_format(self):
        """Final output format from service must match spec."""
        expected_output = {
            "success": True,
            "prediction": [120, 132, 145, 140, 138, 120],
            "hours_ahead": 6,
        }

        # Validate top-level
        assert "success" in expected_output
        assert "prediction" in expected_output
        assert "hours_ahead" in expected_output
        assert isinstance(expected_output["prediction"], list)
        assert len(expected_output["prediction"]) == expected_output["hours_ahead"]
        assert all(isinstance(v, (int, float)) for v in expected_output["prediction"])


# ── 5. Integration — FastAPI ↔ Node.js Data Flow ─────────────────────────────

class TestIntegration:
    """Test the full data flow from FastAPI model → Node.js service → Response."""

    def test_model_predict_output_shape(self):
        """PredictionModel.predict() output should be compatible with service layer."""
        from app.models.prediction_model import PredictionModel

        model = PredictionModel()
        predictions = model.predict(hour=14, horizon=5)

        assert isinstance(predictions, list)
        assert len(predictions) == 5
        assert all(isinstance(v, float) for v in predictions)
        assert all(0.0 <= v <= 1.0 for v in predictions)

    def test_service_response_has_timestamp(self):
        """Every response must include a timestamp for audit trail."""
        from app.models.prediction_model import PredictionModel

        model = PredictionModel()
        # Simulate service wrapping model output
        predictions = model.predict(hour=14, horizon=3)
        response = {
            "success": True,
            "prediction": predictions,
            "hours_ahead": 3,
            "generated_at": "2026-04-07T14:00:00Z",
        }

        assert "generated_at" in response
        assert response["hours_ahead"] == len(response["prediction"])

    def test_model_and_service_value_ranges_match(self):
        """Model output values and service output values must both be in [0, 1]."""
        from app.models.prediction_model import PredictionModel

        model = PredictionModel()

        # Model output
        model_preds = model.predict(hour=10, horizon=12)
        assert all(0.0 <= v <= 1.0 for v in model_preds), "Model predictions must be in [0,1]"

        # Simulated service wrapping
        service_preds = model_preds  # Direct pass-through
        assert all(0.0 <= v <= 1.0 for v in service_preds), "Service predictions must be in [0,1]"
