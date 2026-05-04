"""
Feature Engineering Utilities — Smart Parking.

Functions for creating ML features from raw parking data using pandas.
"""

import logging
import pandas as pd
import numpy as np
from typing import Any, Tuple

logger = logging.getLogger(__name__)


def add_temporal_features(data: pd.DataFrame) -> pd.DataFrame:
    """
    Add time-based features from timestamp column, including cyclic encoding.
    """
    logger.info("Adding temporal features")
    if data.empty:
        return data

    if "timestamp" not in data.columns:
        logger.warning("No 'timestamp' column found for temporal features")
        return data

    df = data.copy()
    df["timestamp"] = pd.to_datetime(df["timestamp"])
    df["hour_of_day"] = df["timestamp"].dt.hour
    df["day_of_week"] = df["timestamp"].dt.dayofweek
    df["month"] = df["timestamp"].dt.month
    df["is_weekend"] = (df["day_of_week"] >= 5).astype(int)

    # Peak hours: 7-9 AM, 5-7 PM
    df["is_peak_hour"] = df["hour_of_day"].apply(
        lambda h: 1 if (7 <= h <= 9) or (17 <= h <= 19) else 0
    )

    # Cyclic encoding for hour (prevents artificial distance between 23 and 0)
    df["hour_sin"] = np.sin(2 * np.pi * df["hour_of_day"] / 24)
    df["hour_cos"] = np.cos(2 * np.pi * df["hour_of_day"] / 24)

    return df


def add_lag_features(
    data: pd.DataFrame,
    column: str = "is_occupied",
    lags: list[int] | None = None,
) -> pd.DataFrame:
    """
    Add lag (autoregressive) features for time-series modeling.
    """
    if lags is None:
        lags = [1, 2, 3, 6, 12, 24]

    logger.info("Adding lag features %s for column '%s'", lags, column)
    if data.empty:
        return data

    if column not in data.columns:
        logger.warning("Column '%s' not found for lag features", column)
        return data

    df = data.copy()
    for lag in lags:
        df[f"{column}_lag_{lag}"] = df[column].shift(lag)

    return df


def add_rolling_features(
    data: pd.DataFrame,
    column: str = "is_occupied",
    windows: list[int] | None = None,
) -> pd.DataFrame:
    """
    Add rolling window statistics for capturing trends.
    """
    if windows is None:
        windows = [6, 12, 24]

    logger.info("Adding rolling features %s for column '%s'", windows, column)
    if data.empty:
        return data

    if column not in data.columns:
        logger.warning("Column '%s' not found for rolling features", column)
        return data

    df = data.copy()
    for w in windows:
        df[f"{column}_rolling_mean_{w}"] = df[column].rolling(window=w).mean()
        df[f"{column}_rolling_std_{w}"] = df[column].rolling(window=w).std()

    return df


def add_external_features(data: pd.DataFrame) -> pd.DataFrame:
    """
    Add external context features.
    Currently adds a static 'is_holiday' placeholder column (0 = not a holiday).
    NOTE: Do NOT use random values here — random features corrupt model training.
    Replace with a real holiday calendar integration when available.
    """
    logger.info("Adding external features")
    if data.empty:
        return data

    df = data.copy()

    # Static placeholder: add is_holiday flag if not already present
    if "is_holiday" not in df.columns:
        df["is_holiday"] = 0  # Default: not a holiday

    return df


def create_target(data: pd.DataFrame, target_column: str = "is_occupied", horizon: int = 1) -> Tuple[pd.DataFrame, pd.Series]:
    """
    Create the target variable for supervised learning.
    Returns empty X, y if DataFrame is empty or target column is missing.
    """
    logger.info("Creating target variable (horizon=%d)", horizon)
    if data.empty:
        return data, pd.Series(dtype=float)

    if target_column not in data.columns:
        raise ValueError(f"Target column '{target_column}' not found")

    df = data.copy()
    y = df[target_column].shift(-horizon)

    # Remove rows where target is NaN (at the end of the series)
    mask = y.notna()
    X = df[mask]
    y = y[mask]

    return X, y


def build_feature_set(data: pd.DataFrame) -> Tuple[pd.DataFrame, pd.Series]:
    """
    Run the full feature engineering pipeline.
    Returns empty X, y safely if input is empty.
    """
    logger.info("Building full feature set...")

    if data.empty:
        logger.warning("build_feature_set received empty DataFrame. Returning empty X, y.")
        return data, pd.Series(dtype=float)

    df = add_temporal_features(data)
    df = add_lag_features(df)
    df = add_rolling_features(df)
    df = add_external_features(df)

    # Drop rows with NaN from lag/rolling features
    df = df.dropna()

    if df.empty:
        logger.warning("All rows dropped after NaN removal in build_feature_set.")
        return df, pd.Series(dtype=float)

    X, y = create_target(df)

    logger.info("Feature set built. X shape: %s, y shape: %s", X.shape, y.shape)
    return X, y
