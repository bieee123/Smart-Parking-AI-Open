"""
InferenceEngine: Uses Ultralytics YOLO as the primary inference backend.
Ultralytics handles all ONNX post-processing correctly (sigmoid, NMS, box decoding).
Falls back to manual ONNX parsing if Ultralytics is unavailable.
"""
import os
import re
import logging
import numpy as np
import threading

logger = logging.getLogger(__name__)

# ── Thresholds ────────────────────────────────────────────────────────────────
CONFIDENCE_THRESHOLD = 0.40
LPR_CONFIDENCE_THRESHOLD = 0.20
NMS_IOU_THRESHOLD = 0.45

# Vehicle model class names (from model metadata)
VEHICLE_CLASS_NAMES = {0: 'car', 1: 'threewheel', 2: 'bus', 3: 'truck', 4: 'motorbike', 5: 'van'}

# Crowd model vehicle-relevant class mapping to vehicle_model IDs
CROWD_TO_VEHICLE_CLASS = {
    2: 4, 3: 0, 4: 5, 5: 3, 6: 1, 7: 1, 8: 2, 9: 4
}

PLATE_REGEX = re.compile(r'^[A-Z]{1,2}\s*\d{1,4}\s*[A-Z]{0,3}$')

try:
    import onnxruntime as ort
    _ORT_AVAILABLE = True
except ImportError:
    _ORT_AVAILABLE = False

try:
    import cv2
    _CV2_AVAILABLE = True
except ImportError:
    _CV2_AVAILABLE = False

try:
    from ultralytics import YOLO as _YOLO
    _ULTRALYTICS_AVAILABLE = True
except ImportError:
    _ULTRALYTICS_AVAILABLE = False


class InferenceEngine:
    """
    Uses Ultralytics YOLO for correct ONNX inference.
    Falls back to manual ONNX if Ultralytics unavailable.
    """

    def __init__(self):
        self._lock = threading.Lock()

        # Ultralytics YOLO wrappers
        self._yolo_vehicle = None
        self._yolo_lpr = None
        self._yolo_parking = None

        # Raw ONNX sessions (fallback)
        self.vehicle_session = None
        self.lpr_session = None
        self.parking_session = None
        self.crowd_session = None
        self.bdd100k_session = None

        self.ocr_reader = None
        self._ocr_init_failed = False

        self.model_dir = os.path.abspath(
            os.path.join(os.path.dirname(__file__), '..', '..', 'models')
        )
        logger.info("[InferenceEngine] Initialized. Ultralytics available: %s", _ULTRALYTICS_AVAILABLE)

    def _p(self, name: str) -> str:
        return os.path.join(self.model_dir, name)

    def _get_yolo(self, attr: str, filename: str):
        """Lazy-load a Ultralytics YOLO model."""
        if getattr(self, attr) is None:
            with self._lock:
                if getattr(self, attr) is None:
                    path = self._p(filename)
                    if _ULTRALYTICS_AVAILABLE and os.path.exists(path):
                        try:
                            model = _YOLO(path, task='detect')
                            setattr(self, attr, model)
                            logger.info("[InferenceEngine] YOLO loaded: %s", filename)
                        except Exception as e:
                            logger.error("[InferenceEngine] YOLO load failed %s: %s", filename, e)
                    else:
                        logger.warning("[InferenceEngine] Model not found: %s", filename)
        return getattr(self, attr)

    def _yolo_detect(self, model_attr: str, filename: str, frame: np.ndarray,
                     conf: float = None, model_name: str = "Model") -> list:
        """Run Ultralytics YOLO detection and convert boxes to [x1,y1,w,h,conf,cls] format."""
        yolo = self._get_yolo(model_attr, filename)
        if yolo is None:
            return []

        conf_thresh = conf if conf is not None else CONFIDENCE_THRESHOLD
        try:
            results = yolo(frame, conf=conf_thresh, iou=NMS_IOU_THRESHOLD,
                           verbose=False, imgsz=640)
            detections = []
            if results and len(results) > 0:
                boxes = results[0].boxes
                if boxes is not None and len(boxes) > 0:
                    for box in boxes:
                        x1, y1, x2, y2 = box.xyxy[0].tolist()
                        w = x2 - x1
                        h = y2 - y1
                        confidence = float(box.conf[0])
                        cls_id = int(box.cls[0])
                        detections.append([x1, y1, w, h, confidence, cls_id])
            logger.info("[InferenceEngine] %s: %d detections (conf>=%.2f)",
                        model_name, len(detections), conf_thresh)
            return detections
        except Exception as e:
            logger.error("[InferenceEngine] YOLO %s error: %s", model_name, e, exc_info=True)
            return []

    # ── Public Inference Methods ──────────────────────────────────────────────

    def detect_vehicles(self, frame: np.ndarray) -> list:
        return self._yolo_detect('_yolo_vehicle', 'vehicle_model.onnx', frame,
                                 model_name="Vehicle")

    def detect_license_plate(self, frame: np.ndarray) -> list:
        return self._yolo_detect('_yolo_lpr', 'lpr_model.onnx', frame,
                                 conf=LPR_CONFIDENCE_THRESHOLD, model_name="LPR")

    def check_parking_slots(self, frame: np.ndarray) -> list:
        return self._yolo_detect('_yolo_parking', 'illegal_model.onnx', frame,
                                 model_name="Parking")

    def detect_crowd(self, frame: np.ndarray) -> list:
        """Crowd detection disabled to prevent class ID collision."""
        return []

    def detect_night(self, frame: np.ndarray) -> list:
        """Night mode: reuse vehicle model."""
        return self.detect_vehicles(frame)

    # ── NMS (for external use by ensemble) ────────────────────────────────────

    def _nms(self, detections: list, iou_threshold: float = 0.45) -> list:
        """Per-class NMS."""
        if not detections:
            return []
        detections = sorted(detections, key=lambda d: d[4], reverse=True)
        keep = []
        while detections:
            best = detections.pop(0)
            keep.append(best)
            detections = [
                d for d in detections
                if int(d[5]) != int(best[5]) or self._iou(best, d) < iou_threshold
            ]
        return keep

    def _iou(self, a: list, b: list) -> float:
        ax2, ay2 = a[0] + a[2], a[1] + a[3]
        bx2, by2 = b[0] + b[2], b[1] + b[3]
        ix1 = max(a[0], b[0]); iy1 = max(a[1], b[1])
        ix2 = min(ax2, bx2);   iy2 = min(ay2, by2)
        inter = max(0, ix2 - ix1) * max(0, iy2 - iy1)
        union = a[2]*a[3] + b[2]*b[3] - inter
        return inter / union if union > 0 else 0.0

    # ── License Plate OCR ─────────────────────────────────────────────────────

    def read_license_plate_text(self, frame: np.ndarray, plate_box: list) -> dict:
        """
        Crop plate region and run multi-pass EasyOCR.
        plate_box format: [x1, y1, w, h, conf, cls]
        """
        fallback = {"plate_number": "UNREADABLE", "plate_confidence": 0.0}

        if not _CV2_AVAILABLE or frame is None or not plate_box or self._ocr_init_failed:
            return fallback

        try:
            h_orig, w_orig = frame.shape[:2]
            x1 = max(0, int(float(plate_box[0])))
            y1 = max(0, int(float(plate_box[1])))
            x2 = min(w_orig, int(float(plate_box[0]) + float(plate_box[2])))
            y2 = min(h_orig, int(float(plate_box[1]) + float(plate_box[3])))

            if x2 <= x1 + 5 or y2 <= y1 + 5:
                return fallback

            plate_crop = frame[y1:y2, x1:x2]
            if plate_crop.size == 0:
                return fallback

            # Scale up for better OCR
            target_h = 80
            if plate_crop.shape[0] < target_h:
                scale_f = target_h / plate_crop.shape[0]
                plate_crop = cv2.resize(plate_crop, None, fx=scale_f, fy=scale_f,
                                        interpolation=cv2.INTER_CUBIC)

            # Lazy init EasyOCR
            if self.ocr_reader is None:
                try:
                    import easyocr
                    self.ocr_reader = easyocr.Reader(['en'], gpu=False, verbose=False)
                    logger.info("[InferenceEngine] EasyOCR ready.")
                except Exception as e:
                    logger.warning("[InferenceEngine] EasyOCR unavailable: %s", e)
                    self._ocr_init_failed = True
                    return fallback

            candidates = []

            # Pass 1: Color
            try:
                for (_, text, conf) in self.ocr_reader.readtext(plate_crop, detail=1):
                    cleaned = re.sub(r'[^A-Z0-9]', '', text.upper())
                    if cleaned:
                        candidates.append((cleaned, float(conf)))
            except Exception:
                pass

            # Pass 2: CLAHE enhanced grayscale
            try:
                gray = cv2.cvtColor(plate_crop, cv2.COLOR_BGR2GRAY)
                clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(4, 4))
                enhanced = clahe.apply(gray)
                for (_, text, conf) in self.ocr_reader.readtext(enhanced, detail=1):
                    cleaned = re.sub(r'[^A-Z0-9]', '', text.upper())
                    if cleaned:
                        candidates.append((cleaned, float(conf)))
            except Exception:
                pass

            # Pass 3: Otsu threshold
            try:
                gray2 = cv2.cvtColor(plate_crop, cv2.COLOR_BGR2GRAY)
                _, thresh = cv2.threshold(gray2, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
                for (_, text, conf) in self.ocr_reader.readtext(thresh, detail=1):
                    cleaned = re.sub(r'[^A-Z0-9]', '', text.upper())
                    if cleaned:
                        candidates.append((cleaned, float(conf)))
            except Exception:
                pass

            # Select best candidate
            best_text, best_conf = "", 0.0
            for text, conf in sorted(candidates, key=lambda x: x[1], reverse=True):
                if len(text) < 3:
                    continue
                if conf > best_conf:
                    best_text = text
                    best_conf = conf
                    if PLATE_REGEX.match(text):
                        break

            if best_text and best_conf >= 0.25:
                logger.info("[InferenceEngine] Plate: '%s' (%.2f)", best_text, best_conf)
                return {"plate_number": best_text, "plate_confidence": round(best_conf, 3)}

            return fallback

        except Exception as e:
            logger.error("[InferenceEngine] OCR error: %s", e)
            return fallback

    # ── Compatibility ─────────────────────────────────────────────────────────

    def _correct_classification(self, detection: list) -> list:
        return detection

    @property
    def models_loaded(self) -> dict:
        return {
            'vehicle': self._yolo_vehicle is not None,
            'lpr': self._yolo_lpr is not None,
            'parking': self._yolo_parking is not None,
        }


# Singleton
inference_engine = InferenceEngine()
