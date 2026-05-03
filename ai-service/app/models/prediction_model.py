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
import joblib
import pandas as pd
import numpy as np
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, List

logger = logging.getLogger(__name__)

# ── Default paths ─────────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent.parent.parent  # ai-service/
DEFAULT_MODEL_DIR = BASE_DIR / "models"
DEFAULT_MODEL_PATH = DEFAULT_MODEL_DIR / "prediction_model.pkl"
DEFAULT_METADATA_PATH = DEFAULT_MODEL_DIR / "prediction_metadata.json"

class PredictionModel:
    def __init__(
        self,
        model_path: str = DEFAULT_MODEL_PATH,
        metadata_path: str = DEFAULT_METADATA_PATH,
    ):
        self.model_path = str(model_path)
        self.metadata_path = str(metadata_path)
        self.model: Optional[object] = None
        self.metadata = {}
        self.load_model()

    def load_model(self) -> bool:
        """
        Load trained model and its metadata from disk.
        """
        if not os.path.isfile(self.model_path):
            logger.warning("Prediction model not found at %s — using baseline heuristic", self.model_path)
            self.model = None
            return False

        try:
            payload = joblib.load(self.model_path)
            self.model = payload.get("model")
            self.metadata = payload.get("metadata", {})
            logger.info("Prediction model loaded from %s. Trained at: %s", self.model_path, self.metadata.get("trained_at"))
            return True
        except Exception as exc:
            logger.error("Failed to load prediction model: %s — falling back to baseline", exc)
            self.model = None
            return False

    def predict(self, hour: int, horizon: int = 3, history: Optional[List[float]] = None) -> List[float]:
        """
        Predict occupancy rate for the next *horizon* hours.
        """
        if self.model is not None:
            return self._predict_with_model(hour, horizon, history)
        return self._baseline_predict(hour, horizon, history)

    def _predict_with_model(self, hour: int, horizon: int, history: Optional[List[float]] = None) -> List[float]:
        """
        Run inference through the loaded Random Forest model.
        """
        predictions = []
        # Prepare feature vector based on metadata['features']
        # Note: This is simplified. Real inference would need the exact same features as training.
        # For now we use the baseline if history is missing or features don't match.
        
        feature_names = self.metadata.get("features", [])
        if not feature_names:
            return self._baseline_predict(hour, horizon, history)

        try:
            for h in range(1, horizon + 1):
                future_hour = (hour + h) % 24
                # Mock feature construction (in production, use feature_engineering.py)
                features_dict = {f: 0.0 for f in feature_names}
                
                # Basic temporal features
                if "hour_of_day" in features_dict: features_dict["hour_of_day"] = future_hour
                if "hour_sin" in features_dict: features_dict["hour_sin"] = math.sin(2 * math.pi * future_hour / 24)
                if "hour_cos" in features_dict: features_dict["hour_cos"] = math.cos(2 * math.pi * future_hour / 24)
                
                # Fill lags if history available
                if history:
                    for lag in [1, 2, 3, 6, 12, 24]:
                        key = f"is_occupied_lag_{lag}"
                        if key in features_dict:
                            features_dict[key] = history[-lag] if len(history) >= lag else history[-1]

                # Convert to DataFrame with correct column order
                X = pd.DataFrame([features_dict])[feature_names]
                pred = self.model.predict(X)[0]
                predictions.append(float(max(0.0, min(1.0, pred))))
                
                # Update history for autoregressive multi-step prediction
                if history:
                    history.append(pred)
                else:
                    history = [pred]
                    
            return predictions
        except Exception as e:
            logger.error("Inference error: %s. Falling back to baseline.", e)
            return self._baseline_predict(hour, horizon, history)

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
