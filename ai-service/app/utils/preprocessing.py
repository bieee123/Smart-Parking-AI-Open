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
    """
    logger.info("Handling missing values (strategy=%s)", strategy)
    if strategy == "ffill":
        return data.ffill()
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
    """
    logger.info("Removing duplicates")
    # Usually we care about duplicates in timestamp and slot_id
    subset = ["timestamp", "slot_id"] if "timestamp" in data.columns and "slot_id" in data.columns else None
    return data.drop_duplicates(subset=subset)


def normalize_numeric(data: pd.DataFrame, columns: list[str] | None = None) -> pd.DataFrame:
    """
    Normalize numeric columns to [0, 1] range using Min-Max scaling.
    """
    logger.info("Normalizing numeric columns")
    if columns is None:
        columns = data.select_dtypes(include=[np.number]).columns.tolist()
    
    if not columns:
        return data

    scaler = MinMaxScaler()
    data[columns] = scaler.fit_transform(data[columns])
    return data


def encode_categorical(data: pd.DataFrame, columns: list[str] | None = None) -> Tuple[pd.DataFrame, dict]:
    """
    Encode categorical variables using one-hot encoding.
    """
    logger.info("Encoding categorical columns")
    if columns is None:
        columns = data.select_dtypes(include=["object", "category"]).columns.tolist()
    
    if not columns:
        return data, {}

    # Simple one-hot encoding with pandas
    encoded_data = pd.get_dummies(data, columns=columns)
    return encoded_data, {"encoded_columns": columns}


def handle_outliers(data: pd.DataFrame, method: str = "iqr") -> pd.DataFrame:
    """
    Detect and handle outliers in numeric columns using IQR.
    """
    logger.info("Handling outliers (method=%s)", method)
    numeric_cols = data.select_dtypes(include=[np.number]).columns
    
    for col in numeric_cols:
        Q1 = data[col].quantile(0.25)
        Q3 = data[col].quantile(0.75)
        IQR = Q3 - Q1
        lower_bound = Q1 - 1.5 * IQR
        upper_bound = Q3 + 1.5 * IQR
        data[col] = np.where(data[col] < lower_bound, lower_bound, data[col])
        data[col] = np.where(data[col] > upper_bound, upper_bound, data[col])
        
    return data


def full_preprocess(data: pd.DataFrame) -> pd.DataFrame:
    """
    Run the full preprocessing pipeline.
    """
    logger.info("Running full preprocessing pipeline...")

    if not isinstance(data, pd.DataFrame):
        data = pd.DataFrame(data)

    data = remove_duplicates(data)
    data = handle_missing_values(data, strategy="ffill")
    data = handle_outliers(data, method="iqr")
    data = normalize_numeric(data)
    data, _ = encode_categorical(data)

    logger.info("Preprocessing pipeline complete. Shape: %s", data.shape)
    return data
