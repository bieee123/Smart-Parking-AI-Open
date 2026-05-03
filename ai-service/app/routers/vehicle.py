"""Vehicle Type Classification router."""
import base64
import logging

from fastapi import APIRouter, UploadFile, File, Form, HTTPException

from app.services.vehicle_engine import vehicle_engine
from app.utils.response_builder import build_vehicle_response, error_response

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/vehicle", tags=["Vehicle Classification"])


@router.post("/classify")
async def classify_vehicle(
    image: UploadFile | None = File(None),
    image_b64: str | None = Form(None),
):
    """Classify vehicle type from an uploaded image.

    Accepts either:
    - A multipart file upload (`image` field), or
    - A base64-encoded image string (`image_b64` form field).

    Returns: {"type": "car"|"motorcycle"|"truck", "confidence": float}
    """
    try:
        # Priority 1: multipart file
        if image is not None:
            contents = await image.read()
            if not contents:
                return error_response("Empty image file provided", 400)

            result = vehicle_engine.classify(contents)
            return build_vehicle_response(result["type"], result["confidence"])

        # Priority 2: base64 form field
        if image_b64 is not None:
            if "," in image_b64:
                image_b64 = image_b64.split(",", 1)[1]

            try:
                raw_bytes = base64.b64decode(image_b64)
            except Exception:
                return error_response("Invalid base64 image data", 400)

            if not raw_bytes:
                return error_response("Empty image data after decoding", 400)

            result = vehicle_engine.classify(raw_bytes)
            return build_vehicle_response(result["type"], result["confidence"])

        return error_response("No image provided. Send 'image' file or 'image_b64' form field.", 400)

    except ValueError as exc:
        logger.warning("Vehicle classification validation error: %s", exc)
        return error_response(str(exc), 400)
    except Exception as exc:
        logger.exception("Vehicle classification inference error: %s", exc)
        return error_response(f"Vehicle classification failed: {exc}", 500)
