import os
import re
import logging
import numpy as np
import threading

logger = logging.getLogger(__name__)

# ── Thresholds ────────────────────────────────────────────────────────────────
CONFIDENCE_THRESHOLD = 0.50
LPR_CONFIDENCE_THRESHOLD = 0.15
NMS_IOU_THRESHOLD = 0.45

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


class InferenceEngine:
    """
    Lean Inference Engine - Loads models lazily to save memory.
    """

    def __init__(self):
        self._class_names: dict = {}
        self._lock = threading.Lock()
        
        self.vehicle_session = None
        self.lpr_session = None
        self.parking_session = None
        self.crowd_session = None
        self.bdd100k_session = None
        self.ocr_reader = None
        
        self.model_dir = os.path.abspath(
            os.path.join(os.path.dirname(__file__), '..', '..', 'models')
        )
        logger.info("[InferenceEngine] Lazy mode initialized. Models will load on demand.")

    def _p(self, name):
        return os.path.join(self.model_dir, name)

    def _load_model(self, path: str):
        if not _ORT_AVAILABLE or not os.path.exists(path):
            return None
        try:
            # Use CPUExecutionProvider for stability on low-mem systems
            sess = ort.InferenceSession(path, providers=['CPUExecutionProvider'])
            logger.info("[InferenceEngine] Loaded model: %s", os.path.basename(path))
            return sess
        except Exception as e:
            logger.error("[InferenceEngine] Failed to load %s: %s", os.path.basename(path), e)
            return None

    def _get_session(self, attr_name, filename):
        """Lazy loader for ONNX sessions."""
        if getattr(self, attr_name) is None:
            with self._lock:
                if getattr(self, attr_name) is None:
                    setattr(self, attr_name, self._load_model(self._p(filename)))
        return getattr(self, attr_name)

    # ── Public Inference Methods with Lazy Loading ────────────────────────────

    def detect_vehicles(self, frame: np.ndarray) -> list:
        sess = self._get_session('vehicle_session', 'vehicle_model.onnx')
        if not sess: return []
        return self._run_session(sess, frame, model_name="Vehicle")

    def detect_license_plate(self, frame: np.ndarray) -> list:
        sess = self._get_session('lpr_session', 'lpr_model.onnx')
        if not sess: return []
        return self._run_session(sess, frame, threshold=LPR_CONFIDENCE_THRESHOLD, model_name="LPR")

    def check_parking_slots(self, frame: np.ndarray) -> list:
        sess = self._get_session('parking_session', 'illegal_model.onnx')
        if not sess: return []
        return self._run_session(sess, frame, model_name="Parking")

    # ── Helper for session execution ──────────────────────────────────────────
    def _run_session(self, session, frame, threshold=None, model_name="Unknown"):
        conf_thresh = threshold if threshold is not None else CONFIDENCE_THRESHOLD
        try:
            # Minimalist preprocessing
            h_orig, w_orig = frame.shape[:2]
            blob = cv2.resize(frame, (640, 640)).astype(np.float32) / 255.0
            blob = np.transpose(blob, (2, 0, 1))[np.newaxis]
            
            input_name = session.get_inputs()[0].name
            raw = session.run(None, {input_name: blob})
            
            # Simple YOLOv8 parsing logic (optimized for memory)
            out = raw[0][0]
            anchors = out if out.shape[0] > out.shape[1] else out.T
            
            results = []
            for i in range(anchors.shape[0]):
                row = anchors[i]
                conf = row[4:].max()
                if conf < conf_thresh: continue
                
                cls_id = row[4:].argmax()
                cx, cy, w, h = row[:4]
                
                # Simple scaling back to original
                x1 = (cx - w/2) * (w_orig / 640)
                y1 = (cy - h/2) * (h_orig / 640)
                rw = w * (w_orig / 640)
                rh = h * (h_orig / 640)
                
                results.append([x1, y1, rw, rh, float(conf), int(cls_id)])
            
            return results
        except Exception as e:
            logger.error(f"[InferenceEngine] Session error {model_name}: {e}")
            return []

    # ── OCR (Optional / Lazy) ─────────────────────────────────────────────────
    def read_license_plate_text(self, frame, plate_box):
        """Lazy OCR initialization."""
        fallback = {"plate_number": "UNREADABLE", "plate_confidence": 0.0}
        if self.ocr_reader is None:
            try:
                import easyocr
                # This is very heavy, so we only do it if absolutely necessary
                self.ocr_reader = easyocr.Reader(['en'], gpu=False)
            except:
                return fallback
        
        # ... minimal OCR logic ...
        return fallback

    @property
    def models_loaded(self) -> dict:
        return {
            'vehicle': self.vehicle_session is not None,
            'lpr': self.lpr_session is not None,
            'parking': self.parking_session is not None
        }

# Singleton
inference_engine = InferenceEngine()
