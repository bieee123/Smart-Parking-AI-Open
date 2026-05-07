"""
License Plate Recognition (LPR) engine.

V2.0 Improvements:
  - Calls InferenceEngine.read_license_plate_text() for multi-pass OCR
  - NEVER returns null plate — guaranteed "UNREADABLE" fallback
  - Response always includes plate_number and plate_confidence fields
"""
import os
import logging
import numpy as np

from app.config import LPR_MODEL_PATH, LPR_CONFIDENCE_THRESHOLD

logger = logging.getLogger(__name__)

# Sample plates the mock recognizer cycles through (Indonesian format)
_SAMPLE_PLATES = [
    "B1234XYZ",
    "B5678ABC",
    "B9012DEF",
    "B3456GHI",
    "D1111AAA",
    "AB2222BB",
    "BK4567CD",
]


class LPREngine:
    """Wrapper around the LPR YOLOv8 model (or mock fallback)."""

    def __init__(self, model_path: str = LPR_MODEL_PATH):
        self.model_path = model_path
        self.model = None
        self._load_model()

        # Use shared InferenceEngine for OCR to avoid re-initializing EasyOCR
        try:
            from app.services.inference_engine import inference_engine
            self._ie = inference_engine
        except Exception as e:
            logger.warning("[LPREngine] Could not load InferenceEngine for OCR: %s", e)
            self._ie = None

    def _load_model(self) -> None:
        """Attempt to load the YOLO LPR model."""
        if not os.path.isfile(self.model_path):
            logger.warning("LPR model not found at %s — using mock inference", self.model_path)
            return
        try:
            from ultralytics import YOLO
            self.model = YOLO(self.model_path)
            logger.info("LPR model loaded from %s", self.model_path)
        except Exception as exc:
            logger.error("Failed to load LPR model: %s — falling back to mock", exc)
            self.model = None

    def predict(self, image_bytes: bytes) -> dict:
        """Run plate recognition. Returns { plate_number, plate_confidence, detected }."""
        if self.model is not None:
            return self._predict_real(image_bytes)
        return self._predict_mock(image_bytes)

    def _predict_real(self, image_bytes: bytes) -> dict:
        """Real inference: detect plate box → multi-pass OCR pipeline."""
        import cv2

        # Decode image
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            logger.warning("[LPREngine] Failed to decode image bytes")
            return {"plate_number": "UNREADABLE", "plate_confidence": 0.0, "detected": False}

        # 1. Detect plate location
        results = self.model(img, conf=LPR_CONFIDENCE_THRESHOLD, verbose=False)

        if len(results) > 0 and len(results[0].boxes) > 0:
            box = results[0].boxes[0]
            det_conf = float(box.conf[0])
            xyxy = box.xyxyn[0].tolist()  # [xmin, ymin, xmax, ymax] normalized
            x1, y1, x2, y2 = xyxy
            w, h = x2 - x1, y2 - y1

            # 2. Build plate_box in [x1, y1, w, h, conf, cls] format
            plate_box = [x1, y1, w, h, det_conf, 0]

            # 3. Run multi-pass OCR via InferenceEngine
            if self._ie:
                ocr_result = self._ie.read_license_plate_text(img, plate_box)
                return {
                    "plate_number":     ocr_result.get("plate_number", "UNREADABLE"),
                    "plate_confidence": ocr_result.get("plate_confidence", 0.0),
                    "detected":         True,
                    # Legacy compat
                    "plate":            ocr_result.get("plate_number", "UNREADABLE"),
                    "confidence":       det_conf,
                }

        return {"plate_number": "UNREADABLE", "plate_confidence": 0.0, "detected": False,
                "plate": "UNREADABLE", "confidence": 0.0}

    @staticmethod
    def _predict_mock(image_bytes: bytes) -> dict:
        """Deterministic mock based on image hash."""
        idx = hash(image_bytes) % len(_SAMPLE_PLATES)
        plate = _SAMPLE_PLATES[idx]
        conf  = round(0.82 + (hash(image_bytes) % 15) / 100.0, 4)
        return {
            "plate_number":     plate,
            "plate_confidence": conf,
            "detected":         False,
            # Legacy compat
            "plate":            plate,
            "confidence":       conf,
        }


# Singleton instance
lpr_engine = LPREngine()
