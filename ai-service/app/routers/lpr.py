"""
License Plate Recognition Router.

V2.0 Changes:
  - /lpr/recognize: returns multi-plate results (plates[] array)
  - /lpr/recognize-all: dedicated multi-plate endpoint
  - Async OCR worker used for concurrent multi-plate processing
  - Backward compatible: primary plate still returned as top-level fields
"""
import base64
import logging

import numpy as np
import cv2

from fastapi import APIRouter, UploadFile, File, Form
from fastapi.responses import JSONResponse

from app.services.lpr_engine import lpr_engine
from app.utils.response_builder import build_plate_response, error_response

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/lpr", tags=["License Plate Recognition"])


def _decode_image(image_bytes: bytes):
    """Decode raw bytes to OpenCV frame."""
    nparr = np.frombuffer(image_bytes, np.uint8)
    return cv2.imdecode(nparr, cv2.IMREAD_COLOR)


@router.post("/recognize")
async def recognize_plate(
    image:     UploadFile | None = File(None),
    image_b64: str         | None = Form(None),
):
    """
    Recognize license plate(s) from an uploaded image.

    Accepts:
      - Multipart file upload (image field)
      - Base64-encoded string (image_b64 form field)

    Returns:
      - plate, confidence (primary — backward compatible)
      - plates[]  (all detected plates — new multi-plate field)
      - vehicle_count (how many vehicles detected in frame)
    """
    try:
        raw_bytes = None

        if image is not None:
            raw_bytes = await image.read()
            if not raw_bytes:
                return error_response("Empty image file.", 400)

        elif image_b64 is not None:
            b64 = image_b64.split(",", 1)[1] if "," in image_b64 else image_b64
            try:
                raw_bytes = base64.b64decode(b64)
            except Exception:
                return error_response("Invalid base64 image data.", 400)
            if not raw_bytes:
                return error_response("Empty image after decoding.", 400)

        else:
            return error_response("No image provided. Send 'image' or 'image_b64'.", 400)

        # Primary plate (backward compatible)
        primary = lpr_engine.predict(raw_bytes)

        # Multi-plate: detect all plates in frame
        all_plates = lpr_engine.predict_all(raw_bytes)

        # Vehicle count from ensemble
        vehicle_count = 0
        vehicle_types = {}
        try:
            frame = _decode_image(raw_bytes)
            if frame is not None:
                from app.services.inference_engine import inference_engine
                vehicles = inference_engine.detect_vehicles(frame)
                vehicle_count = len(vehicles) if vehicles else 0
                from app.services.inference_engine import VEHICLE_CLASS_NAMES
                for v in (vehicles or []):
                    cls = VEHICLE_CLASS_NAMES.get(int(v[5]), "unknown")
                    vehicle_types[cls] = vehicle_types.get(cls, 0) + 1
        except Exception:
            pass

        return {
            "success": True,
            "data": {
                # Primary plate (backward compatible)
                "plate":            primary.get("plate", "UNREADABLE"),
                "confidence":       primary.get("confidence", 0.0),
                "plate_number":     primary.get("plate_number", "UNREADABLE"),
                "plate_confidence": primary.get("plate_confidence", 0.0),
                "detected":         primary.get("detected", False),
                # Multi-plate (new)
                "plates":           all_plates,
                "plate_count":      len([p for p in all_plates if p["plate_number"] != "UNREADABLE"]),
                # Vehicle context
                "vehicle_count":    vehicle_count,
                "vehicle_types":    vehicle_types,
            }
        }

    except Exception as e:
        logger.exception("[LPR] recognize_plate error: %s", e)
        return error_response(f"Plate recognition failed: {e}", 500)


@router.post("/recognize-all")
async def recognize_all_plates(image: UploadFile = File(...)):
    """
    Dedicated multi-plate endpoint.
    Returns all detected plates in a single image.
    Best for parking lot entry images with multiple vehicles.
    """
    try:
        raw_bytes = await image.read()
        if not raw_bytes:
            return error_response("Empty image file.", 400)

        all_plates = lpr_engine.predict_all(raw_bytes)
        readable   = [p for p in all_plates if p["plate_number"] != "UNREADABLE"]

        return {
            "success": True,
            "data": {
                "plates":       all_plates,
                "readable":     readable,
                "total_found":  len(all_plates),
                "total_readable": len(readable),
            }
        }
    except Exception as e:
        logger.exception("[LPR] recognize_all_plates error: %s", e)
        return error_response(f"Multi-plate recognition failed: {e}", 500)
