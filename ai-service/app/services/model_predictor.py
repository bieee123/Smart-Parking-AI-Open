"""Parking Demand Prediction engine (time-series).

Uses a persisted scikit-learn model when available.
Falls back to a heuristic mock predictor for development/testing.
"""
import os
import logging
import math
from typing import Optional

from app.config import PREDICT_MODEL_PATH

logger = logging.getLogger(__name__)


class ModelPredictor:
    """Time-series occupancy predictor wrapping a sklearn model (or mock)."""

    def __init__(self, model_path: str = PREDICT_MODEL_PATH):
        self.model_path = model_path
        self.model: Optional[object] = None
        self._load_model()

    def _load_model(self) -> None:
        if not os.path.isfile(self.model_path):
            logger.warning("Prediction model not found at %s — using mock inference", self.model_path)
            return

        try:
            import joblib
            self.model = joblib.load(self.model_path)
            logger.info("Prediction model loaded from %s", self.model_path)
        except Exception as exc:
            logger.error("Failed to load prediction model: %s — falling back to mock", exc)
            self.model = None

    def predict(self, hour: int, horizon: int = 3, history: list = None) -> list:
        """Predict occupancy rate for the next *horizon* hours.

        Parameters
        ----------
        hour : int
            Current hour of the day (0-23).
        horizon : int
            Number of hours ahead to predict (1-24).
        history : list, optional
            Historical occupancy records for lag features.

        Returns
        -------
        list[float]
            Occupancy rates between 0.0 and 1.0 for each future hour.
        """
        if self.model is not None:
            return self._predict_model(hour, horizon, history)
        return self._predict_mock(hour, horizon)

    # ── Real model inference ──────────────────────────────────
    def _predict_model(self, current_hour: int, horizon: int, history: list = None) -> list:
        """Predict menggunakan model yang sudah di-load, dengan feature engineering."""
        try:
            import pandas as pd
            import numpy as np
            from app.utils.feature_engineering import (
                add_temporal_features, add_lag_features,
                add_rolling_features, add_external_features
            )

            # Bangun DataFrame dari history atau buat dummy
            if history and len(history) > 0:
                df = pd.DataFrame(history)
                if 'timestamp' not in df.columns:
                    df['timestamp'] = pd.date_range(
                        end=pd.Timestamp.now(), periods=len(df), freq='h'
                    )
            else:
                df = pd.DataFrame([{
                    'timestamp': pd.Timestamp.now(),
                    'is_occupied': 0.5,
                    'slot_id': 'unknown',
                    'zone': 'unknown',
                }])

            df = add_temporal_features(df)
            df = add_lag_features(df)
            df = add_rolling_features(df)
            df = add_external_features(df)

            feature_cols = [
                c for c in df.columns
                if c not in ['timestamp', 'slot_id', 'zone', 'target', 'is_occupied']
            ]
            X_base = df[feature_cols].fillna(0).tail(1)

            predictions = []
            for i in range(horizon):
                X = X_base.copy()
                shifted_hour = (current_hour + i + 1) % 24
                if 'hour' in X.columns:
                    X['hour'] = shifted_hour
                if 'hour_sin' in X.columns:
                    X['hour_sin'] = np.sin(2 * np.pi * shifted_hour / 24)
                if 'hour_cos' in X.columns:
                    X['hour_cos'] = np.cos(2 * np.pi * shifted_hour / 24)

                pred = float(self.model.predict(X)[0])
                predictions.append(round(max(0.0, min(1.0, pred)), 3))

            return predictions

        except Exception as e:
            print(f"[ModelPredictor] _predict_model failed, using mock: {e}")
            return self._predict_mock(current_hour, horizon)  # fallback wajib ada

    # ── Mock heuristic predictor ──────────────────────────────
    @staticmethod
    def _predict_mock(hour: int, horizon: int) -> list[float]:
        """Realistic heuristic mock that mimics daily parking patterns.

        Pattern:
        - Low occupancy at night (0-5 AM): 0.15-0.25
        - Morning ramp-up (6-9 AM): 0.40-0.70
        - Peak business hours (10-16): 0.75-0.92
        - Evening decline (17-21): 0.60-0.35
        - Night (22-23): 0.20-0.15
        """
        # Base occupancy profile per hour (realistic curve)
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
            base = base_profile[future_hour]
            # Add slight random variation ±0.03 for realism
            import random
            variation = random.uniform(-0.03, 0.03)
            occupancy = max(0.0, min(1.0, base + variation))
            predictions.append(round(occupancy, 4))

        return predictions


# Singleton instance
model_predictor = ModelPredictor()
