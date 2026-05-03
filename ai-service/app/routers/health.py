"""Health check router."""
import logging

from fastapi import APIRouter

from app.utils.response_builder import success_response, error_response
from app.services.lpr_engine import lpr_engine
from app.services.vehicle_engine import vehicle_engine
from app.services.model_predictor import model_predictor

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Health"])


@router.get("/health")
@router.get("/healthz")
async def health_check():
    """Health check endpoint.

    Returns:
    {
        "success": true,
        "data": {
            "status": "ok",
            "models_loaded": true
        }
    }

    models_loaded is true when ALL three engines have their real models
    loaded (not in mock mode).
    """
    try:
        all_loaded = all([
            lpr_engine.session is not None,
            vehicle_engine.session is not None,
            model_predictor.model is not None,
        ])

        return success_response({
            "status": "ok",
            "models_loaded": all_loaded,
            "engines": {
                "lpr": "loaded" if lpr_engine.session else "mock",
                "vehicle": "loaded" if vehicle_engine.session else "mock",
                "predictor": "loaded" if model_predictor.model else "mock",
            },
        })

    except Exception as exc:
        logger.exception("Health check error: %s", exc)
        return error_response(f"Health check failed: {exc}", 500)
