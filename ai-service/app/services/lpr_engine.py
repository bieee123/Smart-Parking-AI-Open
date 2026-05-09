"""
LPREngine — License Plate Recognition Wrapper.

V3.0 Changes (M3 Fix):
  - Duplicate YOLO model loader REMOVED
  - Fully delegates to InferenceEngine (single model instance, no double-loading)
  - predict() returns same schema as before (backward compatible)
  - Mock fallback retained for dev/test mode
  - Supports multi-plate via predict_all()
"""
import os
import logging
import numpy as np

from app.config import LPR_CONFIDENCE_THRESHOLD

logger = logging.getLogger(__name__)

# Sample plates for mock mode
_SAMPLE_PLATES = [
    "B1234XYZ", "B5678ABC", "B9012DEF",
    "B3456GHI", "D1111AAA", "AB2222BB", "BK4567CD",
]


class LPREngine:
    """
    Thin wrapper that delegates all inference to the shared InferenceEngine.

    M3 FIX: The original implementation loaded lpr_model.onnx a SECOND time
    via Ultralytics YOLO independently from InferenceEngine, wasting ~200MB RAM.
    Now uses the lazy-loaded model inside InferenceEngine directly.
    """

    def __init__(self):
        self._ie = None
        self._mock_mode = False
        self._try_load()

    def _try_load(self):
        try:
            from app.services.inference_engine import inference_engine
            self._ie = inference_engine
            logger.info("[LPREngine] Delegating to shared InferenceEngine (no duplicate load).")
        except Exception as e:
            logger.warning("[LPREngine] InferenceEngine unavailable: %s — mock mode.", e)
            self._mock_mode = True

    # ── Primary API (backward compatible) ────────────────────────────────────

    def predict(self, image_bytes: bytes) -> dict:
        """
        Run plate detection + OCR on raw image bytes.

        Returns:
            {
              "plate_number":     str,
              "plate_confidence": float,
              "detected":         bool,
              "plate":            str,   # legacy alias
              "confidence":       float, # legacy alias (detection conf)
            }
        """
        if self._mock_mode or self._ie is None:
            return self._mock(image_bytes)
        return self._real(image_bytes)

    def predict_all(self, image_bytes: bytes) -> list:
        """
        Multi-plate: detect all plates in image and run OCR on each.

        Returns:
            list of {"plate_number": str, "plate_confidence": float, "box": [...]}
        """
        if self._mock_mode or self._ie is None:
            return [self._mock(image_bytes)]

        try:
            import cv2
            nparr = np.frombuffer(image_bytes, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            if img is None:
                return []

            plates = self._ie.detect_license_plate(img)
            if not plates:
                return []

            sorted_plates = sorted(plates, key=lambda x: float(x[4]), reverse=True)
            results = []
            for box in sorted_plates:
                ocr = self._ie.read_license_plate_text(img, box)
                results.append({
                    "plate_number":     ocr.get("plate_number", "UNREADABLE"),
                    "plate_confidence": ocr.get("plate_confidence", 0.0),
                    "box":              box[:4],
                    "detected":         True,
                })
            return results
        except Exception as e:
            logger.error("[LPREngine] predict_all error: %s", e)
            return []

    # ── Internal ──────────────────────────────────────────────────────────────

    def _real(self, image_bytes: bytes) -> dict:
        try:
            import cv2
            nparr = np.frombuffer(image_bytes, np.uint8)
            img   = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            if img is None:
                return self._not_detected()

            plates = self._ie.detect_license_plate(img)
            if not plates:
                return self._not_detected()

            # Best plate by detection confidence
            best = max(plates, key=lambda x: float(x[4]))
            det_conf = float(best[4])

            ocr = self._ie.read_license_plate_text(img, best)
            pn  = ocr.get("plate_number", "UNREADABLE")
            pc  = ocr.get("plate_confidence", 0.0)

            return {
                "plate_number":     pn,
                "plate_confidence": pc,
                "detected":         True,
                "plate":            pn,       # legacy
                "confidence":       det_conf, # legacy
            }
        except Exception as e:
            logger.error("[LPREngine] _real error: %s", e)
            return self._not_detected()

    @staticmethod
    def _not_detected() -> dict:
        return {
            "plate_number":     "UNREADABLE",
            "plate_confidence": 0.0,
            "detected":         False,
            "plate":            "UNREADABLE",
            "confidence":       0.0,
        }

    @staticmethod
    def _mock(image_bytes: bytes) -> dict:
        idx   = hash(image_bytes) % len(_SAMPLE_PLATES)
        plate = _SAMPLE_PLATES[idx]
        conf  = round(0.82 + (hash(image_bytes) % 15) / 100.0, 4)
        return {
            "plate_number":     plate,
            "plate_confidence": conf,
            "detected":         False,
            "plate":            plate,
            "confidence":       conf,
        }


# Singleton
lpr_engine = LPREngine()
