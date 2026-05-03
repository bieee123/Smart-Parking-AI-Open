"""License Plate Recognition router."""
import base64
import logging

from fastapi import APIRouter, UploadFile, File, Form, HTTPException

from app.services.lpr_engine import lpr_engine
from app.utils.response_builder import build_plate_response, error_response

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/lpr", tags=["License Plate Recognition"])


@router.post("/recognize")
async def recognize_plate(
    image: UploadFile | None = File(None),
    image_b64: str | None = Form(None),
):
    """Recognize a license plate from an uploaded image.

    Accepts either:
    - A multipart file upload (`image` field), or
    - A base64-encoded image string (`image_b64` form field).

    Returns the recognized plate text and confidence score.
    """
    try:
        # Priority 1: multipart file
        if image is not None:
            contents = await image.read()
            if not contents:
                return error_response("Empty image file provided", 400)

            result = lpr_engine.predict(contents)
            return build_plate_response(result["plate"], result["confidence"])

        # Priority 2: base64 form field
        if image_b64 is not None:
            # Strip data-URI prefix if present
            if "," in image_b64:
                image_b64 = image_b64.split(",", 1)[1]

            try:
                raw_bytes = base64.b64decode(image_b64)
            except Exception:
                return error_response("Invalid base64 image data", 400)

            if not raw_bytes:
                return error_response("Empty image data after decoding", 400)

            result = lpr_engine.predict(raw_bytes)
            return build_plate_response(result["plate"], result["confidence"])

        return error_response("No image provided. Send 'image' file or 'image_b64' form field.", 400)

    except ValueError as exc:
        logger.warning("LPR validation error: %s", exc)
        return error_response(str(exc), 400)
    except Exception as exc:
        logger.exception("LPR inference error: %s", exc)
        return error_response(f"Plate recognition failed: {exc}", 500)
