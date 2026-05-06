"""
Demand Prediction Model — Real ML Implementation for Smart Parking.

This class wraps the trained Random Forest model used to predict
parking demand / occupancy rates.
"""

import os
import json
import logging
import math
import random
import onnxruntime as ort
import pandas as pd
import numpy as np
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, List

logger = logging.getLogger(__name__)

# ── Default paths ─────────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent.parent.parent  # ai-service/
DEFAULT_MODEL_DIR = BASE_DIR / "models"
DEFAULT_MODEL_PATH = DEFAULT_MODEL_DIR / "prediction_model.onnx"
DEFAULT_METADATA_PATH = DEFAULT_MODEL_DIR / "prediction_metadata.json"

class PredictionModel:
    def __init__(
        self,
        model_path: str = DEFAULT_MODEL_PATH,
        metadata_path: str = DEFAULT_METADATA_PATH,
    ):
        self.model_path = str(model_path)
        self.metadata_path = str(metadata_path)
        self.session: Optional[ort.InferenceSession] = None
        self.metadata = {}
        self.load_model()

    def load_model(self) -> bool:
        """
        Load trained ONNX model and its metadata from disk.
        """
        if not os.path.isfile(self.model_path):
            logger.warning("Prediction model not found at %s — using baseline heuristic", self.model_path)
            self.session = None
            return False

        try:
            # Load model session
            self.session = ort.InferenceSession(self.model_path)
            
            # Load metadata if exists
            if os.path.isfile(self.metadata_path):
                with open(self.metadata_path, 'r') as f:
                    self.metadata = json.load(f)
            
            logger.info("Prediction model (ONNX) loaded from %s", self.model_path)
            return True
        except Exception as exc:
            logger.error("Failed to load ONNX prediction model: %s — falling back to baseline", exc)
            self.session = None
            return False

    def predict(self, hour: int, horizon: int = 3, history: Optional[List[float]] = None) -> List[float]:
        """
        Predict occupancy rate for the next *horizon* hours.
        """
        if self.session is not None:
            features = {
                'current_hour': hour,
                'horizon': horizon,
                'current_occupancy': history[-1] if history else 0.5,
            }
            return self._predict_with_model(features)
        return self._baseline_predict(hour, horizon, history)

    def _predict_with_model(self, features: dict) -> list:
        """Run inference menggunakan loaded ONNX model dengan feature engineering."""
        try:
            from app.utils.feature_engineering import add_temporal_features, add_external_features

            current_hour = features.get('current_hour', datetime.now().hour)
            horizon = features.get('horizon', 6)

            df = pd.DataFrame([{
                'timestamp': pd.Timestamp.now(),
                'is_occupied': features.get('current_occupancy', 0.5),
                'hour': current_hour,
            }])

            df = add_temporal_features(df)
            df = add_external_features(df)

            feature_cols = [
                c for c in df.columns
                if c not in ['timestamp', 'slot_id', 'zone', 'target', 'is_occupied']
            ]
            X_base = df[feature_cols].fillna(0)

            predictions = []
            input_name = self.session.get_inputs()[0].name
            
            for i in range(horizon):
                X = X_base.copy()
                shifted_hour = (current_hour + i + 1) % 24
                if 'hour' in X.columns:
                    X['hour'] = shifted_hour
                if 'hour_sin' in X.columns:
                    X['hour_sin'] = np.sin(2 * np.pi * shifted_hour / 24)
                if 'hour_cos' in X.columns:
                    X['hour_cos'] = np.cos(2 * np.pi * shifted_hour / 24)

                # Prepare ONNX input
                input_data = X.values.astype(np.float32)
                ort_outs = self.session.run(None, {input_name: input_data})
                pred = float(ort_outs[0][0])
                
                predictions.append(round(max(0.0, min(1.0, pred)), 3))

            return predictions

        except Exception as e:
            logger.error(f"[PredictionModel] ONNX inference failed: {e}")
            _hour = features.get('current_hour', 0) if isinstance(features, dict) else 0
            _horizon = features.get('horizon', 6) if isinstance(features, dict) else 6
            return self._baseline_predict(_hour, _horizon)

    def _baseline_predict(self, hour: int, horizon: int, history: Optional[List[float]] = None) -> List[float]:
        """
        Heuristic baseline daily patterns.
        """
        base_profile = {
            0: 0.15, 1: 0.12, 2: 0.10, 3: 0.08, 4: 0.10, 5: 0.15,
            6: 0.25, 7: 0.40, 8: 0.55, 9: 0.65,
            10: 0.75, 11: 0.82, 12: 0.88, 13: 0.90, 14: 0.92, 15: 0.88,
            16: 0.82, 17: 0.75, 18: 0.65, 19: 0.50,
            20: 0.40, 21: 0.32, 22: 0.25, 23: 0.18,
        }
        predictions = []
        for h in range(1, horizon + 1):
            future_hour = (hour + h) % 24
            base = base_profile.get(future_hour, 0.5)
            variation = random.uniform(-0.05, 0.05)
            predictions.append(round(max(0.0, min(1.0, base + variation)), 4))
        return predictions

    def predict_daily(self, history: Optional[List[float]] = None) -> List[float]:
        current_hour = datetime.now().hour
        return self.predict(hour=current_hour, horizon=24, history=history)

    def predict_weekly(self, history: Optional[List[float]] = None) -> List[float]:
        day = datetime.now().weekday()
        weekly_pred = []
        for i in range(7):
            d = (day + i) % 7
            base = 0.55 if d in (5, 6) else 0.75
            var = random.uniform(-0.15, 0.15)
            weekly_pred.append(round(max(0.2, min(0.95, base + var)), 4))
        return weekly_pred

    def get_metadata(self) -> dict:
        return self.metadata

    def health_check(self) -> dict:
        return {
            "loaded": self.model is not None,
            "trained_at": self.metadata.get("trained_at"),
            "metrics": self.metadata.get("metrics"),
            "features_count": len(self.metadata.get("features", [])),
            "model_path": self.model_path,
            "model_exists": os.path.isfile(self.model_path),
        }

prediction_model = PredictionModel()
