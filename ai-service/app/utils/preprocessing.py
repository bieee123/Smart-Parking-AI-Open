"""
Data Preprocessing Utilities — Smart Parking.

Functions for cleaning and normalizing raw parking data using pandas and sklearn.
"""

import logging
import pandas as pd
import numpy as np
from typing import Any, Tuple
from sklearn.preprocessing import MinMaxScaler, OneHotEncoder
from sklearn.impute import SimpleImputer

logger = logging.getLogger(__name__)


def handle_missing_values(data: pd.DataFrame, strategy: str = "ffill") -> pd.DataFrame:
    """
    Handle missing values in the dataset.
    Default strategy: forward-fill first, then fill remaining NaNs with column mean
    for numeric columns (two-pass approach for time-series robustness).
    """
    logger.info("Handling missing values (strategy=%s)", strategy)
    if data.empty:
        return data

    if strategy == "ffill":
        # Two-pass: ffill then fill remaining with column mean
        data = data.ffill()
        numeric_cols = data.select_dtypes(include=[np.number]).columns
        data[numeric_cols] = data[numeric_cols].fillna(data[numeric_cols].mean())
        return data
    elif strategy == "bfill":
        return data.bfill()
    elif strategy == "mean":
        numeric_cols = data.select_dtypes(include=[np.number]).columns
        data[numeric_cols] = data[numeric_cols].fillna(data[numeric_cols].mean())
        return data
    elif strategy == "drop":
        return data.dropna()
    return data


def remove_duplicates(data: pd.DataFrame) -> pd.DataFrame:
    """
    Remove duplicate rows from dataset.
    Deduplicates on timestamp + slot_id if both columns exist.
    """
    logger.info("Removing duplicates")
    if data.empty:
        return data
    # Deduplicate on timestamp + slot_id if both columns exist
    subset = [c for c in ['timestamp', 'slot_id'] if c in data.columns]
    return data.drop_duplicates(subset=subset) if subset else data.drop_duplicates()


def normalize_numeric(data: pd.DataFrame, columns: list[str] | None = None) -> pd.DataFrame:
    """
    Normalize numeric columns to [0, 1] range using Min-Max scaling.
    Excludes the target column 'is_occupied' to prevent data leakage.
    """
    logger.info("Normalizing numeric columns")
    if data.empty:
        return data

    if columns is None:
        all_numeric = data.select_dtypes(include=[np.number]).columns.tolist()
        # Do not normalize the target column 'is_occupied' if present
        columns = [c for c in all_numeric if c != 'is_occupied']

    if not columns:
        return data

    scaler = MinMaxScaler()
    data[columns] = scaler.fit_transform(data[columns])
    return data


def encode_categorical(data: pd.DataFrame, columns: list[str] | None = None) -> Tuple[pd.DataFrame, dict]:
    """
    Encode categorical variables using one-hot encoding (drop_first=True to avoid multicollinearity).
    """
    logger.info("Encoding categorical columns")
    if data.empty:
        return data, {}

    if columns is None:
        columns = data.select_dtypes(include=["object", "category"]).columns.tolist()

    if not columns:
        return data, {}

    # One-hot encoding with drop_first=True to avoid multicollinearity
    encoded_data = pd.get_dummies(data, columns=columns, drop_first=True)
    return encoded_data, {"encoded_columns": columns}


def handle_outliers(data: pd.DataFrame, method: str = "iqr") -> pd.DataFrame:
    """
    Detect and handle outliers in numeric columns using IQR method (clip to bounds).
    """
    logger.info("Handling outliers (method=%s)", method)
    if data.empty:
        return data

    numeric_cols = data.select_dtypes(include=[np.number]).columns
    for col in numeric_cols:
        Q1 = data[col].quantile(0.25)
        Q3 = data[col].quantile(0.75)
        IQR = Q3 - Q1
        # Use pandas .clip() instead of np.where for cleaner vectorized clipping
        data[col] = data[col].clip(lower=Q1 - 1.5 * IQR, upper=Q3 + 1.5 * IQR)

    return data


def full_preprocess(data: pd.DataFrame) -> pd.DataFrame:
    """
    Run the full preprocessing pipeline.
    Returns an empty DataFrame safely if input is empty.
    """
    logger.info("Running full preprocessing pipeline...")

    if not isinstance(data, pd.DataFrame):
        data = pd.DataFrame(data)

    # Guard: return early if empty
    if data.empty:
        logger.warning("full_preprocess received empty DataFrame. Returning as-is.")
        return data

    data = remove_duplicates(data)
    data = handle_missing_values(data, strategy="ffill")
    data = handle_outliers(data, method="iqr")
    data = normalize_numeric(data)
    data, _ = encode_categorical(data)

    logger.info("Preprocessing pipeline complete. Shape: %s", data.shape)
    return data
