"""Parking Demand Prediction router."""
import logging

from fastapi import APIRouter

from app.models.prediction_model import prediction_model
from app.services.model_predictor import model_predictor
from app.utils.response_builder import build_demand_response, error_response
from app.utils.schemas import DemandRequest

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/predict", tags=["Demand Prediction"])


@router.post("/demand")
async def predict_demand(req: DemandRequest):
    """Predict parking occupancy for the next N hours.

    Request body:
    {
        "hour": 14,         // Current hour of day (0-23)
        "horizon": 5        // How many hours ahead to predict (1-24)
    }

    Response:
    {
        "success": true,
        "data": {
            "prediction": [0.72, 0.75, 0.81, 0.88, 0.92],
            "hours_ahead": 5,
            "confidence": 0.78,
            "version": "0.1.0",
            "model_type": "placeholder-baseline"
        }
    }
    """
    try:
        # Use the new PredictionModel if available, fallback to model_predictor
        predictions = prediction_model.predict(hour=req.hour, horizon=req.horizon)
        meta = prediction_model.get_metadata()

        return {
            "success": True,
            "data": {
                "prediction": predictions,
                "hours_ahead": req.horizon,
                "confidence": 0.78,  # TODO: compute from model uncertainty
                "version": meta.get("version", "0.1.0"),
                "model_type": meta.get("model_type", "placeholder-baseline"),
            },
        }

    except Exception as exc:
        logger.exception("Demand prediction error: %s", exc)
        return error_response(f"Demand prediction failed: {exc}", 500)


@router.post("/demand/daily")
async def predict_demand_daily():
    """
    Predict occupancy for the next 24 hours.

    Response:
    {
        "success": true,
        "data": {
            "prediction": [0.15, 0.12, ..., 0.18],  // 24 values
            "period": "24h",
            "version": "0.1.0"
        }
    }
    """
    try:
        predictions = prediction_model.predict_daily()
        meta = prediction_model.get_metadata()

        return {
            "success": True,
            "data": {
                "prediction": predictions,
                "period": "24h",
                "hours": list(range(24)),
                "version": meta.get("version", "0.1.0"),
                "model_type": meta.get("model_type", "placeholder-baseline"),
            },
        }

    except Exception as exc:
        logger.exception("Daily demand prediction error: %s", exc)
        return error_response(f"Daily demand prediction failed: {exc}", 500)


@router.post("/demand/weekly")
async def predict_demand_weekly():
    """
    Predict daily average occupancy for the next 7 days.

    Response:
    {
        "success": true,
        "data": {
            "prediction": [0.72, 0.75, 0.68, 0.80, 0.85, 0.60, 0.55],  // 7 values
            "period": "7d",
            "version": "0.1.0"
        }
    }
    """
    try:
        predictions = prediction_model.predict_weekly()
        meta = prediction_model.get_metadata()

        return {
            "success": True,
            "data": {
                "prediction": predictions,
                "period": "7d",
                "days": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
                "version": meta.get("version", "0.1.0"),
                "model_type": meta.get("model_type", "placeholder-baseline"),
            },
        }

    except Exception as exc:
        logger.exception("Weekly demand prediction error: %s", exc)
        return error_response(f"Weekly demand prediction failed: {exc}", 500)


@router.get("/demand/model-info")
async def get_model_info():
    """
    Get current prediction model metadata.

    Response:
    {
        "success": true,
        "data": {
            "version": "0.1.0",
            "model_type": "placeholder-baseline",
            "last_trained": null,
            "required_features": ["hour_of_day", "day_of_week", ...]
        }
    }
    """
    try:
        meta = prediction_model.get_metadata()
        health = prediction_model.health_check()

        return {
            "success": True,
            "data": {
                **meta,
                "health": health,
            },
        }

    except Exception as exc:
        logger.exception("Model info error: %s", exc)
        return error_response(f"Model info failed: {exc}", 500)
