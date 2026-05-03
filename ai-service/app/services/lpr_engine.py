"""License Plate Recognition (LPR) engine.

Uses ONNX Runtime for inference when a model file exists.
Falls back to a deterministic mock inference so the service
is fully functional without real model files during development.
"""
import os
import logging
import numpy as np

from app.config import LPR_MODEL_PATH, LPR_CONFIDENCE_THRESHOLD

logger = logging.getLogger(__name__)

# Sample plates the mock recogniser cycles through
_SAMPLE_PLATES = [
    "B 1234 XYZ",
    "B 5678 ABC",
    "B 9012 DEF",
    "B 3456 GHI",
    "B 7890 JKL",
    "D 1111 AAA",
    "AB 2222 BB",
]


class LPREngine:
    """Wrapper around the LPR YOLOv8 model (or mock fallback)."""

    def __init__(self, model_path: str = LPR_MODEL_PATH):
        self.model_path = model_path
        self.model = None
        self._load_model()

    def _load_model(self) -> None:
        """Attempt to load the YOLO model using Ultralytics."""
        if not os.path.isfile(self.model_path):
            logger.warning("LPR model not found at %s — using mock inference", self.model_path)
            return

        try:
            from ultralytics import YOLO
            # Load the exported ONNX model (or .pt)
            self.model = YOLO(self.model_path)
            logger.info("LPR model loaded successfully using Ultralytics from %s", self.model_path)
        except Exception as exc:
            logger.error("Failed to load LPR model: %s — falling back to mock", exc)
            self.model = None

    def predict(self, image_bytes: bytes) -> dict:
        """Run plate recognition."""
        if self.model is not None:
            return self._predict_real(image_bytes)
        return self._predict_mock(image_bytes)

    def _predict_real(self, image_bytes: bytes) -> dict:
        """Real inference using Ultralytics YOLO + OCR placeholder."""
        import cv2
        from app.utils.image_tools import bytes_to_cv2

        img = bytes_to_cv2(image_bytes)
        
        # 1. Detection: Find the plate
        results = self.model(img, conf=LPR_CONFIDENCE_THRESHOLD, verbose=False)
        
        if len(results) > 0 and len(results[0].boxes) > 0:
            # Get the best detection box
            box = results[0].boxes[0]
            conf = float(box.conf[0])
            xyxy = box.xyxy[0].tolist() # [xmin, ymin, xmax, ymax]
            
            # 2. Crop the plate for OCR
            x1, y1, x2, y2 = map(int, xyxy)
            plate_crop = img[y1:y2, x1:x2]
            
            # 3. OCR: Read the text
            # Recommendation: Run 'pip install easyocr'
            plate_text = self._read_plate_text(plate_crop)
            
            return {
                "plate": plate_text,
                "confidence": conf,
                "detected": True
            }
        
        return {"plate": "NO_PLATE_DETECTED", "confidence": 0.0, "detected": False}

    def _read_plate_text(self, plate_img) -> str:
        """Placeholder for OCR logic. Connect EasyOCR here."""
        try:
            # Jika user sudah install easyocr, ini akan jalan
            import easyocr
            import numpy as np
            
            # Initialize reader (should be done once in __init__ for speed)
            reader = easyocr.Reader(['en'])
            result = reader.readtext(plate_img)
            
            if result:
                # Ambil teks dari hasil deteksi OCR pertama
                return result[0][1].upper()
        except ImportError:
            logger.debug("EasyOCR not installed, using detection-only mode")
        
        return "B 1234 XXX (Detected)"

    # ── Mock inference ──
    @staticmethod
    def _predict_mock(image_bytes: bytes) -> dict:
        idx = hash(image_bytes) % len(_SAMPLE_PLATES)
        plate = _SAMPLE_PLATES[idx]
        conf = 0.82 + (hash(image_bytes) % 15) / 100.0
        return {"plate": plate, "confidence": round(conf, 4), "detected": False}


# Singleton instance
lpr_engine = LPREngine()
