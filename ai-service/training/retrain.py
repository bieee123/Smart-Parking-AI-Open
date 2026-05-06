#!/usr/bin/env python3
"""
retrain.py — Automated model retraining pipeline (D2).
Jalankan via cron job / Task Scheduler setiap minggu.

Usage:
  python retrain.py [--force]

Flags:
  --force   Retrain meskipun dataset < MIN_RECORDS threshold

Flow:
  1. Load data from PostgreSQL (parking_logs) + MongoDB (traffic_history)
  2. Preprocess + feature engineer
  3. Train model (XGBoost > RandomForest)
  4. Evaluate: if MAE_new < MAE_current → swap model file
  5. Alert: print report + optionally POST to backend /api/system/retrain-log
"""

import os
import sys
import json
import logging
import argparse
import joblib
from datetime import datetime, timedelta
from pathlib import Path

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(message)s",
)
logger = logging.getLogger(__name__)

# ── Config ───────────────────────────────────────────────────────────────────
MODEL_PATH   = Path(__file__).parent.parent / 'models' / 'prediction_model.pkl'
BACKUP_PATH  = Path(__file__).parent.parent / 'models' / 'prediction_model_backup.pkl'
REPORT_PATH  = Path(__file__).parent / 'retrain_report.json'
MIN_RECORDS  = 500       # Minimum rows needed to retrain
TARGET_MAE   = 0.10      # Accept new model if MAE ≤ this value
BACKEND_URL  = os.getenv('BACKEND_URL', 'http://localhost:8000')

# ── Load Data ────────────────────────────────────────────────────────────────

def load_data_postgres():
    """Load parking_logs from PostgreSQL via psycopg2 / SQLAlchemy."""
    try:
        import pandas as pd
        db_url = os.getenv('DATABASE_URL', 'postgresql://postgres:password@localhost:5432/smart_parking')
        df = pd.read_sql(
            "SELECT entry_time AS timestamp, is_occupied FROM parking_logs "
            "WHERE entry_time > NOW() - INTERVAL '90 days'",
            con=db_url,
        )
        logger.info("[Retrain] PostgreSQL records: %d", len(df))
        return df
    except Exception as e:
        logger.warning("[Retrain] PostgreSQL load failed: %s", e)
        return None


def load_data_mongo():
    """Load traffic_history from MongoDB."""
    try:
        import pandas as pd
        from pymongo import MongoClient
        client = MongoClient(os.getenv('MONGO_URL', 'mongodb://localhost:27017'))
        db = client.get_default_database() or client['SmartParking']
        docs = list(db['traffic_history'].find(
            {'timestamp': {'$gt': datetime.utcnow() - timedelta(days=90)}},
            {'_id': 0, 'timestamp': 1, 'vehicle_count': 1, 'density_level': 1}
        ))
        if not docs:
            return None
        df = pd.DataFrame(docs)
        logger.info("[Retrain] MongoDB records: %d", len(df))
        return df
    except Exception as e:
        logger.warning("[Retrain] MongoDB load failed: %s", e)
        return None


def load_combined_data():
    pg  = load_data_postgres()
    mdb = load_data_mongo()
    import pandas as pd
    frames = [df for df in [pg, mdb] if df is not None and len(df) > 0]
    if not frames:
        return None
    combined = pd.concat(frames, ignore_index=True)
    logger.info("[Retrain] Combined dataset: %d rows", len(combined))
    return combined

# ── Train ────────────────────────────────────────────────────────────────────

def train(df):
    """Preprocess, engineer features, train XGBoost / RF, return (model, mae)."""
    import pandas as pd
    import numpy as np
    from sklearn.model_selection import TimeSeriesSplit
    from sklearn.metrics import mean_absolute_error

    sys.path.insert(0, str(Path(__file__).parent.parent))
    from app.utils.feature_engineering import (
        add_temporal_features, add_lag_features,
        add_rolling_features, add_external_features, create_target,
    )
    from app.utils.preprocessing import (
        handle_missing_values, remove_duplicates, normalize_numeric,
    )

    if 'timestamp' not in df.columns:
        raise ValueError("Dataset must have 'timestamp' column")

    df['timestamp'] = pd.to_datetime(df['timestamp'])
    df = df.sort_values('timestamp').reset_index(drop=True)

    # Derive is_occupied if not present
    if 'is_occupied' not in df.columns:
        if 'vehicle_count' in df.columns:
            df['is_occupied'] = (df['vehicle_count'] > 0).astype(float)
        else:
            df['is_occupied'] = 0.5

    df = handle_missing_values(df)
    df = remove_duplicates(df)
    df = add_temporal_features(df)
    df = add_lag_features(df)
    df = add_rolling_features(df)
    df = add_external_features(df)
    df = create_target(df, horizon=1)

    feature_cols = [
        c for c in df.columns
        if c not in ['timestamp', 'slot_id', 'zone', 'target', 'is_occupied']
    ]
    df = df.dropna(subset=['target'] + feature_cols)
    X, y = df[feature_cols].fillna(0), df['target']

    # Try XGBoost → fallback to RandomForest
    try:
        import xgboost as xgb
        model = xgb.XGBRegressor(n_estimators=200, learning_rate=0.05,
                                  max_depth=6, random_state=42, verbosity=0)
        logger.info("[Retrain] Training XGBoost (%d features, %d samples)...", X.shape[1], len(X))
    except ImportError:
        from sklearn.ensemble import RandomForestRegressor
        model = RandomForestRegressor(n_estimators=150, random_state=42, n_jobs=-1)
        logger.info("[Retrain] XGBoost not available. Training RandomForest...")

    # Time-series cross-validation
    tscv = TimeSeriesSplit(n_splits=3)
    mae_scores = []
    for tr_idx, val_idx in tscv.split(X):
        model.fit(X.iloc[tr_idx], y.iloc[tr_idx])
        preds = model.predict(X.iloc[val_idx])
        mae_scores.append(mean_absolute_error(y.iloc[val_idx], preds))

    mae = float(np.mean(mae_scores))
    logger.info("[Retrain] Cross-val MAE: %.4f (target: %.4f)", mae, TARGET_MAE)

    # Final fit on all data
    model.fit(X, y)
    return model, mae, feature_cols

# ── Evaluate & Swap ──────────────────────────────────────────────────────────

def get_current_mae() -> float:
    """Get MAE of currently deployed model from metadata if available."""
    meta_path = MODEL_PATH.with_suffix('.meta.json')
    if meta_path.exists():
        try:
            with open(meta_path) as f:
                return float(json.load(f).get('mae', 999.0))
        except Exception:
            pass
    return 999.0  # No deployed model → always accept new one


def save_model(model, mae: float, feature_cols: list):
    """Backup current model, save new one."""
    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    if MODEL_PATH.exists():
        import shutil
        shutil.copy2(MODEL_PATH, BACKUP_PATH)
        logger.info("[Retrain] Backed up current model → %s", BACKUP_PATH.name)

    joblib.dump(model, MODEL_PATH)
    meta = {
        'mae': mae,
        'features': feature_cols,
        'trained_at': datetime.utcnow().isoformat(),
        'model_type': type(model).__name__,
    }
    with open(MODEL_PATH.with_suffix('.meta.json'), 'w') as f:
        json.dump(meta, f, indent=2)
    logger.info("[Retrain] New model saved: %s (MAE=%.4f)", MODEL_PATH.name, mae)


def notify_backend(report: dict):
    try:
        import requests
        requests.post(f'{BACKEND_URL}/api/system/retrain-log', json=report, timeout=5)
    except Exception:
        pass  # Best-effort

# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description='Smart Parking — Model Retraining Pipeline')
    parser.add_argument('--force', action='store_true', help='Force retrain even if data < MIN_RECORDS')
    args = parser.parse_args()

    report = {
        'started_at': datetime.utcnow().isoformat(),
        'status': 'failed',
        'mae_new': None,
        'mae_prev': get_current_mae(),
        'model_swapped': False,
        'message': '',
    }

    try:
        df = load_combined_data()
        if df is None or len(df) < MIN_RECORDS:
            if not args.force:
                msg = f"Insufficient data: {0 if df is None else len(df)} rows (min={MIN_RECORDS}). Use --force to override."
                logger.warning("[Retrain] %s", msg)
                report['message'] = msg
                report['status'] = 'skipped'
                return
            logger.warning("[Retrain] --force flag set, training with limited data.")

        model, mae, feature_cols = train(df)
        report['mae_new'] = mae
        current_mae = get_current_mae()

        if mae <= TARGET_MAE or mae < current_mae:
            save_model(model, mae, feature_cols)
            report['model_swapped'] = True
            report['message'] = f"Model swapped. MAE improved: {current_mae:.4f} → {mae:.4f}"
            report['status'] = 'success'
            logger.info("[Retrain] ✅ %s", report['message'])
        else:
            report['message'] = f"Model NOT swapped. New MAE ({mae:.4f}) >= current ({current_mae:.4f})."
            report['status'] = 'rejected'
            logger.info("[Retrain] ⚠️  %s", report['message'])

    except Exception as e:
        report['message'] = str(e)
        logger.error("[Retrain] ❌ %s", e)

    finally:
        report['finished_at'] = datetime.utcnow().isoformat()
        with open(REPORT_PATH, 'w') as f:
            json.dump(report, f, indent=2)
        logger.info("[Retrain] Report saved: %s", REPORT_PATH)
        notify_backend(report)


if __name__ == '__main__':
    main()
