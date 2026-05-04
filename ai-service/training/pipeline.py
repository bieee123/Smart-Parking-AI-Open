"""
ML Training Pipeline — Smart Parking.

Handles data loading, preprocessing, feature engineering, model training, and evaluation.
"""

import logging
import os
import pandas as pd
import numpy as np
import joblib
from datetime import datetime
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

# Try to import XGBoost (preferred model); fall back to RandomForest
try:
    from xgboost import XGBRegressor
    _XGBOOST_AVAILABLE = True
except ImportError:
    _XGBOOST_AVAILABLE = False

from app.utils.preprocessing import full_preprocess
from app.utils.feature_engineering import build_feature_set

logger = logging.getLogger(__name__)

class TrainingPipeline:
    def __init__(self, model_dir: str = "models"):
        self.model_dir = model_dir
        os.makedirs(self.model_dir, exist_ok=True)
        self.model = None
        self.metadata = {}

    def load_data(self, source: str | pd.DataFrame) -> pd.DataFrame:
        """
        Load raw data from CSV or DataFrame.
        Falls back to an empty DataFrame with expected schema if source is invalid.
        """
        logger.info("Loading data from %s", source)
        if isinstance(source, str):
            if source.endswith(".csv"):
                if os.path.exists(source):
                    return pd.read_csv(source)
                else:
                    logger.warning("CSV file not found: %s. Returning empty DataFrame.", source)
                    return pd.DataFrame(columns=['timestamp', 'slot_id', 'is_occupied', 'zone', 'hour', 'day_of_week'])
            elif source.endswith(".json"):
                if os.path.exists(source):
                    return pd.read_json(source)
                else:
                    logger.warning("JSON file not found: %s. Returning empty DataFrame.", source)
                    return pd.DataFrame(columns=['timestamp', 'slot_id', 'is_occupied', 'zone', 'hour', 'day_of_week'])
            else:
                logger.warning("Unknown source format: %s. Returning empty DataFrame.", source)
                return pd.DataFrame(columns=['timestamp', 'slot_id', 'is_occupied', 'zone', 'hour', 'day_of_week'])
        return pd.DataFrame(source)

    def run(self, raw_data: pd.DataFrame | str):
        """
        Run the full pipeline. Handles empty datasets gracefully.
        """
        logger.info("Starting training pipeline...")
        
        # 1. Load
        df = self.load_data(raw_data)
        
        # Guard: if dataset is empty, skip training and return baseline metadata
        if df.empty or len(df) < 10:
            logger.warning("Dataset is empty or too small (%d rows). Skipping training.", len(df))
            self.metadata = {
                "trained_at": datetime.now().isoformat(),
                "metrics": {"mae": None, "rmse": None, "r2": None},
                "features": [],
                "model_type": "none",
                "note": "Skipped — insufficient data"
            }
            return self.metadata
        
        # 2. Preprocess
        df_clean = full_preprocess(df)
        
        # 3. Feature Engineering
        X, y = build_feature_set(df_clean)
        
        # Guard: feature engineering may reduce rows to 0
        if X.empty or len(X) < 5:
            logger.warning("Feature set is empty after engineering. Skipping training.")
            self.metadata = {
                "trained_at": datetime.now().isoformat(),
                "metrics": {"mae": None, "rmse": None, "r2": None},
                "features": [],
                "model_type": "none",
                "note": "Skipped — feature set empty after engineering"
            }
            return self.metadata
        
        # 4. Split (chronological — no shuffling for time-series)
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, shuffle=False)
        
        # Drop non-numeric columns like 'timestamp' before training
        X_train_numeric = X_train.select_dtypes(include=[np.number])
        X_test_numeric = X_test.select_dtypes(include=[np.number])
        
        # 5. Train — prefer XGBoost, fall back to RandomForest
        if _XGBOOST_AVAILABLE:
            logger.info("Training XGBoost model (primary)...")
            self.model = XGBRegressor(n_estimators=100, max_depth=5, random_state=42)
            model_type = "XGBRegressor"
        else:
            logger.info("XGBoost not available. Training RandomForest model (fallback)...")
            self.model = RandomForestRegressor(n_estimators=100, random_state=42)
            model_type = "RandomForestRegressor"
        
        self.model.fit(X_train_numeric, y_train)
        
        # 6. Evaluate
        y_pred = self.model.predict(X_test_numeric)
        mae = mean_absolute_error(y_test, y_pred)
        rmse = np.sqrt(mean_squared_error(y_test, y_pred))
        r2 = r2_score(y_test, y_pred)
        
        logger.info("Evaluation complete: MAE=%.4f, RMSE=%.4f, R2=%.4f", mae, rmse, r2)
        
        self.metadata = {
            "trained_at": datetime.now().isoformat(),
            "metrics": {
                "mae": float(mae),
                "rmse": float(rmse),
                "r2": float(r2)
            },
            "features": X_train_numeric.columns.tolist(),
            "model_type": model_type
        }
        
        # 7. Save
        self.save_model("prediction_model.pkl")
        
        return self.metadata

    def save_model(self, filename: str):
        """
        Save model and metadata to disk.
        """
        path = os.path.join(self.model_dir, filename)
        logger.info("Saving model to %s", path)
        
        payload = {
            "model": self.model,
            "metadata": self.metadata
        }
        joblib.dump(payload, path)
        
        # Also save metadata as JSON for easy access
        meta_path = path.replace(".pkl", ".json")
        with open(meta_path, "w") as f:
            import json
            json.dump(self.metadata, f, indent=2)

if __name__ == "__main__":
    # Example usage with dummy data
    logging.basicConfig(level=logging.INFO)
    
    # Create dummy time-series data
    dates = pd.date_range(start="2024-01-01", periods=1000, freq="H")
    dummy_data = pd.DataFrame({
        "timestamp": dates,
        "slot_id": np.random.randint(1, 10, size=1000),
        "is_occupied": np.random.randint(0, 2, size=1000).astype(float)
    })
    
    pipeline = TrainingPipeline()
    pipeline.run(dummy_data)
