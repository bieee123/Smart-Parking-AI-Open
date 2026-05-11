"""
train_from_db.py — Automated Model Training for Smart Parking.
Fetches data from PostgreSQL, preprocesses, trains XGBoost/RandomForest,
and saves the prediction_model.pkl for use in the AI service.

If the database has insufficient data, it generates a realistic bootstrap
dataset to ensure the system is functional from Day 1.
"""
import os
import sys
import logging
import json
from datetime import datetime, timedelta
import pandas as pd
import numpy as np
import psycopg2
from dotenv import load_dotenv

# Ensure we can import from app/
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from training.pipeline import TrainingPipeline

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[logging.StreamHandler()]
)
logger = logging.getLogger(__name__)

# Load environment
load_dotenv('../backend/.env')
DB_URL = os.environ.get('DATABASE_URL')

def fetch_data_from_db():
    """
    Fetch raw parking logs and convert to hourly occupancy timeseries.
    """
    if not DB_URL:
        logger.warning("DATABASE_URL not found in .env. Falling back to bootstrap data.")
        return None

    try:
        conn = psycopg2.connect(DB_URL)
        logger.info("Connected to PostgreSQL for data extraction.")
        
        # We need entry_time, exit_time to calculate occupancy over time
        query = "SELECT entry_time, exit_time, slot_id FROM parking_logs WHERE entry_time IS NOT NULL"
        df_logs = pd.read_sql(query, conn)
        conn.close()

        if df_logs.empty or len(df_logs) < 50:
            logger.info("Insufficient logs in DB (%d rows). Generating bootstrap data...", len(df_logs))
            return None

        # Reconstruct hourly occupancy
        logger.info("Reconstructing occupancy from %d logs...", len(df_logs))
        
        # Fill exit_time with now if NULL (still parked)
        df_logs['exit_time'] = df_logs['exit_time'].fillna(datetime.now())
        
        # Create a range of hours covering the data
        start = df_logs['entry_time'].min().replace(minute=0, second=0, microsecond=0)
        end = df_logs['exit_time'].max().replace(minute=0, second=0, microsecond=0)
        hours = pd.date_range(start, end, freq='H')
        
        records = []
        for hour in hours:
            # Count how many cars were in slots during this specific hour
            mask = (df_logs['entry_time'] <= hour) & (df_logs['exit_time'] > hour)
            occupied_count = mask.sum()
            total_slots = 30 # Assumption: default lot size
            
            records.append({
                "timestamp": hour,
                "is_occupied": float(occupied_count / total_slots)
            })
            
        return pd.DataFrame(records)

    except Exception as e:
        logger.error("Database extraction failed: %s", e)
        return None

def generate_bootstrap_data(days=60):
    """
    Generate realistic seasonal parking data for model training.
    Patterns:
    - Higher occupancy during work hours (9am-5pm)
    - Lower on weekends
    - Night-time troughs
    """
    logger.info("Generating bootstrap dataset for %d days...", days)
    start_date = datetime.now() - timedelta(days=days)
    hours = pd.date_range(start=start_date, periods=days*24, freq='H')
    
    data = []
    for h in hours:
        hour = h.hour
        is_weekend = h.dayofweek >= 5
        
        # Base occupancy pattern (0.0 to 1.0)
        if 8 <= hour <= 18: # Work hours
            base = 0.7 if not is_weekend else 0.3
        elif 19 <= hour <= 23: # Evening
            base = 0.4 if not is_weekend else 0.8 # Leisure/Nightlife
        else: # Late night
            base = 0.1
            
        # Add noise and seasonality
        noise = np.random.normal(0, 0.05)
        occupancy = np.clip(base + noise, 0, 1)
        
        data.append({
            "timestamp": h,
            "is_occupied": float(occupancy)
        })
        
    return pd.DataFrame(data)

def main():
    logger.info("=== Smart Parking AI — Training Routine ===")
    
    # 1. Get Data
    df = fetch_data_from_db()
    if df is None:
        df = generate_bootstrap_data()
        source_label = "Bootstrap (Synthetic)"
    else:
        source_label = f"Real DB ({len(df)} rows)"
        
    logger.info("Dataset ready from source: %s", source_label)
    
    # 2. Run Pipeline
    pipeline = TrainingPipeline(model_dir="models")
    metadata = pipeline.run(df)
    
    # 3. Summary
    if metadata.get("metrics", {}).get("r2") is not None:
        logger.info("Model training SUCCESS.")
        logger.info("Model: %s | MAE: %.4f | R2: %.4f", 
                    metadata['model_type'], 
                    metadata['metrics']['mae'], 
                    metadata['metrics']['r2'])
    else:
        logger.error("Model training FAILED or Skipped. Check logs.")

if __name__ == "__main__":
    main()
