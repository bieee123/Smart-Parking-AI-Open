import os
import json
import logging
import random
import joblib
import pandas as pd
import numpy as np
from datetime import datetime
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
        self.model = None
        self.metadata = {
            "version": "0.1.0-baseline",
            "model_type": "heuristic-fallback",
            "trained_at": None,
            "metrics": {"mae": None, "r2": None}
        }
        self.load_model()

    def load_model(self) -> bool:
        """
        Load trained joblib model and its metadata from disk.
        """
        if not os.path.isfile(self.model_path):
            logger.warning("[Prediction] Model not found at %s — using baseline", self.model_path)
            self.model = None
            return False

        try:
            # Load joblib payload (contains 'model' and 'metadata')
            payload = joblib.load(self.model_path)
            self.model = payload.get("model")
            self.metadata = payload.get("metadata", self.metadata)
            
            logger.info("[Prediction] ✅ Model (.pkl) loaded from %s", self.model_path)
            return True
        except Exception as exc:
            logger.error("[Prediction] ❌ Failed to load .pkl model: %s", exc)
            self.model = None
            return False

    def predict(self, hour: int, horizon: int = 3, history: Optional[List[float]] = None) -> List[float]:
        """
        Predict occupancy rate for the next *horizon* hours.
        """
        if self.model is not None:
            return self._predict_with_model(hour, horizon, history)
        return self._baseline_predict(hour, horizon, history)

    def _predict_with_model(self, current_hour: int, horizon: int, history: Optional[List[float]]) -> list:
        """Run inference using loaded scikit-learn/XGBoost model."""
        try:
            from app.utils.feature_engineering import add_temporal_features, add_external_features
            
            # Start from 'now'
            start_ts = pd.Timestamp.now().replace(hour=current_hour, minute=0, second=0, microsecond=0)
            predictions = []
            
            # Simple autoregressive prediction loop
            last_occ = history[-1] if history else 0.5
            
            for i in range(1, horizon + 1):
                future_ts = start_ts + pd.Timedelta(hours=i)
                
                # Build minimal input frame
                df = pd.DataFrame([{
                    "timestamp": future_ts,
                    "is_occupied": last_occ, # Use last prediction as input for next (lag)
                    "hour": future_ts.hour
                }])
                
                # Reuse the same feature engineering as training
                df = add_temporal_features(df)
                df = add_external_features(df)
                
                # Add dummy lag/rolling features to match model input shape
                # In production, we'd use a more robust sliding window manager
                for lag in [1, 2, 3, 6, 12, 24]:
                    df[f"is_occupied_lag_{lag}"] = last_occ
                for w in [6, 12, 24]:
                    df[f"is_occupied_rolling_mean_{w}"] = last_occ
                    df[f"is_occupied_rolling_std_{w}"] = 0.05
                
                # Select only numeric columns used during training
                X = df.select_dtypes(include=[np.number])
                
                # Ensure feature order matches training
                trained_features = self.metadata.get("features", [])
                if trained_features:
                    # Fill missing features with 0
                    for col in trained_features:
                        if col not in X.columns:
                            X[col] = 0.0
                    X = X[trained_features]

                # Run prediction
                pred = self.model.predict(X)[0]
                val = float(np.clip(pred, 0, 1))
                predictions.append(round(val, 3))
                last_occ = val # Update for next step in horizon
                
            return predictions

        except Exception as e:
            logger.error(f"[Prediction] Inference failed: {e}")
            return self._baseline_predict(current_hour, horizon)

    def _baseline_predict(self, hour: int, horizon: int, history: Optional[List[float]] = None) -> List[float]:
        """Heuristic baseline patterns."""
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
            variation = random.uniform(-0.02, 0.02)
            predictions.append(round(max(0.0, min(1.0, base + variation)), 3))
        return predictions

    def predict_daily(self, history: Optional[List[float]] = None) -> List[float]:
        current_hour = datetime.now().hour
        return self.predict(hour=current_hour, horizon=24, history=history)

    def predict_weekly(self, history: Optional[List[float]] = None) -> List[float]:
        # Simple weekly rollout: 7 daily averages
        day = datetime.now().weekday()
        weekly_pred = []
        for i in range(7):
            d = (day + i) % 7
            base = 0.55 if d in (5, 6) else 0.75
            var = random.uniform(-0.1, 0.1)
            weekly_pred.append(round(max(0.2, min(0.95, base + var)), 3))
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
