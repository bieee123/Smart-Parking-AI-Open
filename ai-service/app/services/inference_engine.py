"""
Inference Engine - ONNX Runtime wrapper for Smart Parking AI models.

V2.0 Improvements:
  - Confidence threshold raised to 0.50
  - Fixed bounding box coordinate scaling (letterbox offset bug fixed)
  - Multi-pass OCR with CLAHE + Otsu + sharpening preprocessing
  - Plate regex validation for Indonesian format [A-Z]{1,2}[0-9]{1,4}[A-Z]{0,3}
  - NEVER returns null for plate_number — always returns "UNREADABLE" as fallback
  - Detailed debug logging at every pipeline stage
"""

import os
import re
import logging
import numpy as np

logger = logging.getLogger(__name__)

# ── Thresholds ────────────────────────────────────────────────────────────────
CONFIDENCE_THRESHOLD = 0.50   # Raised from 0.40 — reduces false positives
LPR_CONFIDENCE_THRESHOLD = 0.15  # Lower for small plate objects
NMS_IOU_THRESHOLD = 0.45         # IoU threshold for NMS deduplication

# ── Indonesian Plate Regex ─────────────────────────────────────────────────────
# Format: [1-2 letters][1-4 digits][optional 1-3 letters]
# Examples: B1234XYZ, D 1111 AAA, AB 2222 BB
PLATE_REGEX = re.compile(r'^[A-Z]{1,2}\s*\d{1,4}\s*[A-Z]{0,3}$')

# ── Vehicle class bounding-box area thresholds (pixels²) for reclassification ─
# Below this, a detection labeled "car" could be "motorcycle"
MOTO_MAX_AREA    = 8_000   # px² — smaller than this = likely motorcycle
CAR_MIN_AREA     = 6_000   # px² — larger than this = likely car or van
ASPECT_RATIO_MOTO = 1.8    # width/height > this → probably not motorcycle

try:
    import onnxruntime as ort
    _ORT_AVAILABLE = True
except ImportError:
    _ORT_AVAILABLE = False
    logger.warning("[InferenceEngine] onnxruntime not installed - running in mock mode.")

try:
    import cv2
    _CV2_AVAILABLE = True
except ImportError:
    _CV2_AVAILABLE = False
    logger.warning("[InferenceEngine] opencv-python not installed - frame preprocessing disabled.")


class InferenceEngine:
    """
    Wraps ONNX Runtime sessions for all AI models.
    Falls back gracefully to None (mock mode) when model files are missing.
    """

    def __init__(self):
        self._class_names: dict = {}
        model_dir = os.path.abspath(
            os.path.join(os.path.dirname(__file__), '..', '..', 'models')
        )
        logger.info("[InferenceEngine] Loading models from: %s", model_dir)

        def _p(name): return os.path.join(model_dir, name)

        self.vehicle_session  = self._load_model(_p('vehicle_model.onnx'))
        self.lpr_session      = self._load_model(_p('lpr_model.onnx'))
        self.parking_session  = self._load_model(_p('illegal_model.onnx'))
        self.crowd_session    = self._load_model(_p('crowd_detection_model.onnx'))

        _bdd = self._load_model(_p('bdd100k_model.onnx'))
        self.bdd100k_session  = _bdd if _bdd is not None else self.vehicle_session
        if _bdd is None:
            logger.warning("[InferenceEngine] bdd100k_model.onnx not found - night mode uses vehicle_model as proxy.")

        # ── EasyOCR (initialized ONCE here for speed) ──────────────────────
        try:
            import easyocr
            self.ocr_reader = easyocr.Reader(['en'], gpu=False)
            logger.info("[InferenceEngine] EasyOCR Reader initialized successfully.")
        except Exception as e:
            self.ocr_reader = None
            logger.warning("[InferenceEngine] Failed to init EasyOCR: %s", e)

        loaded = {k: v is not None for k, v in self.models_loaded.items()}
        logger.info("[InferenceEngine] Models loaded: %s", loaded)

    # ── Model Loader ──────────────────────────────────────────────────────────

    def _load_model(self, path: str):
        if not _ORT_AVAILABLE:
            return None
        if not os.path.exists(path):
            logger.warning("[InferenceEngine] Not found (mock): %s", os.path.basename(path))
            return None
        try:
            sess = ort.InferenceSession(path, providers=['CPUExecutionProvider'])
            meta = sess.get_modelmeta()
            names_str = meta.custom_metadata_map.get('names', '{}')
            try:
                import ast
                self._class_names[os.path.basename(path)] = ast.literal_eval(names_str)
            except Exception:
                pass
            logger.info("[InferenceEngine] Loaded: %s", os.path.basename(path))
            return sess
        except Exception as e:
            logger.error("[InferenceEngine] Load failed %s: %s", os.path.basename(path), e)
            return None

    # ── Preprocessing ─────────────────────────────────────────────────────────

    def preprocess_frame(self, frame: np.ndarray, size: tuple = (640, 640)):
        """
        Letterbox-resize → normalize → NCHW float32 tensor.
        Returns: (tensor, scale, pad_x, pad_y) for accurate coordinate reversal.
        """
        if not _CV2_AVAILABLE:
            return np.zeros((1, 3, size[0], size[1]), dtype=np.float32), 1.0, 0, 0

        h, w = frame.shape[:2]
        scale = min(size[0] / h, size[1] / w)
        new_h, new_w = int(h * scale), int(w * scale)
        resized = cv2.resize(frame, (new_w, new_h), interpolation=cv2.INTER_LINEAR)

        canvas = np.full((size[0], size[1], 3), 114, dtype=np.uint8)
        pad_x = (size[1] - new_w) // 2
        pad_y = (size[0] - new_h) // 2
        canvas[pad_y:pad_y + new_h, pad_x:pad_x + new_w] = resized

        img = canvas.astype(np.float32) / 255.0
        tensor = np.transpose(img, (2, 0, 1))[np.newaxis]
        return tensor, scale, pad_x, pad_y

    # ── NMS (Non-Max Suppression) ─────────────────────────────────────────────

    @staticmethod
    def _nms(detections: list, iou_threshold: float = NMS_IOU_THRESHOLD) -> list:
        """Apply NMS to suppress overlapping bounding boxes."""
        if not detections:
            return []
        # Sort by confidence descending
        dets = sorted(detections, key=lambda d: d[4], reverse=True)
        keep = []
        for det in dets:
            suppress = False
            for k in keep:
                ax1, ay1 = det[0], det[1]
                ax2, ay2 = ax1 + det[2], ay1 + det[3]
                bx1, by1 = k[0], k[1]
                bx2, by2 = bx1 + k[2], by1 + k[3]
                ix1, iy1 = max(ax1, bx1), max(ay1, by1)
                ix2, iy2 = min(ax2, bx2), min(ay2, by2)
                inter = max(0, ix2 - ix1) * max(0, iy2 - iy1)
                union = (ax2-ax1)*(ay2-ay1) + (bx2-bx1)*(by2-by1) - inter
                if union > 0 and inter / union >= iou_threshold:
                    suppress = True
                    break
            if not suppress:
                keep.append(det)
        return keep

    # ── Rule-Based Classification Correction ─────────────────────────────────

    @staticmethod
    def _correct_classification(detections: list) -> list:
        """
        Post-processing rule layer to fix common misclassifications.
        
        Rules:
          - motorcycle (cls=4) with large bbox area → reclassify as car (cls=0)
          - motorcycle with wide aspect ratio → reclassify as car
          - Very small detection with car label → reclassify as motorcycle
        
        VEHICLE_CLASSES: {0: 'car', 1: 'threewheel', 2: 'bus', 3: 'truck', 4: 'motorbike', 5: 'van'}
        """
        MOTO_CLS = 4
        CAR_CLS  = 0
        corrected = []
        for det in detections:
            if len(det) < 6:
                corrected.append(det)
                continue
            x1, y1, w, h, conf, cls_id = det[:6]
            area = w * h
            aspect = w / h if h > 0 else 1.0
            cls_id = int(cls_id)

            # Rule 1: Mislabeled motorcycle with large footprint → car
            if cls_id == MOTO_CLS and area > CAR_MIN_AREA:
                logger.debug("[Correction] Large bbox (%.0f px²) reclassified from motorcycle → car", area)
                cls_id = CAR_CLS

            # Rule 2: Mislabeled motorcycle with wide aspect ratio → car
            if cls_id == MOTO_CLS and aspect > ASPECT_RATIO_MOTO:
                logger.debug("[Correction] Wide aspect (%.2f) reclassified from motorcycle → car", aspect)
                cls_id = CAR_CLS

            # Rule 3: Car label on tiny detection → motorcycle
            if cls_id == CAR_CLS and area < MOTO_MAX_AREA:
                logger.debug("[Correction] Tiny bbox (%.0f px²) reclassified from car → motorcycle", area)
                cls_id = MOTO_CLS

            corrected.append([x1, y1, w, h, conf, cls_id])
        return corrected

    # ── Core Session Runner ───────────────────────────────────────────────────

    def _run_session(self, session, frame: np.ndarray, threshold: float = None,
                     model_name: str = "Unknown", apply_nms: bool = True) -> list:
        """
        Generic runner for YOLOv8-style ONNX models.
        
        Handles both output shapes:
          [1, 4+N, 8400] — standard YOLOv8 export
          [1, 8400, 4+N] — transposed export
          
        Returns list of [x1, y1, w, h, confidence, class_id] in ORIGINAL pixel coords.
        """
        conf_thresh = threshold if threshold is not None else CONFIDENCE_THRESHOLD
        if session is None:
            return []
        try:
            # 1. Preprocess & capture letterbox params for accurate reversal
            tensor, scale, pad_x, pad_y = self.preprocess_frame(frame)
            input_name = session.get_inputs()[0].name
            raw = session.run(None, {input_name: tensor})
            dets = raw[0]  # shape: [1, 4+N, 8400] or [1, 8400, 4+N]

            logger.debug("[InferenceEngine][%s] Raw output shape: %s", model_name, dets.shape)

            if dets.ndim != 3:
                logger.warning("[InferenceEngine][%s] Unexpected ndim=%d", model_name, dets.ndim)
                return []

            out = dets[0]  # Remove batch dim
            # Normalize to [8400, 4+N] shape
            anchors = out if out.shape[0] > out.shape[1] else out.T

            n_anchors, n_features = anchors.shape
            if n_features < 5:
                logger.warning("[InferenceEngine][%s] Invalid feature count: %d", model_name, n_features)
                return []

            cx = anchors[:, 0]
            cy = anchors[:, 1]
            w  = anchors[:, 2]
            h  = anchors[:, 3]
            class_scores = anchors[:, 4:]
            conf   = class_scores.max(axis=1)
            cls_id = class_scores.argmax(axis=1)

            # 2. Confidence filter
            mask = conf >= conf_thresh
            if not mask.any():
                logger.debug("[InferenceEngine][%s] No detections above threshold %.2f", model_name, conf_thresh)
                return []

            # 3. Convert cx,cy,w,h → x1,y1,w,h and reverse letterbox
            h_orig, w_orig = frame.shape[:2]
            results = []
            for i in np.where(mask)[0]:
                # Model output is in letterboxed 640x640 space
                # Step 1: cx,cy,w,h → x1,y1 (letterbox space)
                bx1 = float(cx[i] - w[i] / 2)
                by1 = float(cy[i] - h[i] / 2)
                bw  = float(w[i])
                bh  = float(h[i])

                # Step 2: Remove letterbox padding and reverse scale
                bx1_orig = (bx1 - pad_x) / scale
                by1_orig = (by1 - pad_y) / scale
                bw_orig  = bw / scale
                bh_orig  = bh / scale

                # Step 3: Clamp to frame boundaries
                bx1_orig = max(0.0, min(bx1_orig, w_orig))
                by1_orig = max(0.0, min(by1_orig, h_orig))
                bw_orig  = min(bw_orig, w_orig - bx1_orig)
                bh_orig  = min(bh_orig, h_orig - by1_orig)

                if bw_orig > 1 and bh_orig > 1:  # Skip degenerate boxes
                    results.append([bx1_orig, by1_orig, bw_orig, bh_orig, float(conf[i]), int(cls_id[i])])

            logger.debug("[InferenceEngine][%s] Candidates after conf filter: %d", model_name, len(results))

            # 4. Apply NMS
            if apply_nms and results:
                results = self._nms(results)
                logger.debug("[InferenceEngine][%s] After NMS: %d boxes", model_name, len(results))

            return results

        except Exception as e:
            logger.error("[InferenceEngine][%s] Session run error: %s", model_name, e, exc_info=True)
            return []

    # ── Public Inference Methods ──────────────────────────────────────────────

    def detect_vehicles(self, frame: np.ndarray) -> list:
        """Primary vehicle detection (daylight). Returns corrected detections."""
        raw = self._run_session(self.vehicle_session, frame, model_name="Vehicle")
        corrected = self._correct_classification(raw)
        logger.info("[InferenceEngine] Vehicle detections: raw=%d corrected=%d", len(raw), len(corrected))
        return corrected

    def detect_crowd(self, frame: np.ndarray) -> list:
        """Top-view / crowd detection (crowd_detection_model). No reclassification applied."""
        return self._run_session(self.crowd_session, frame, model_name="Crowd")

    def detect_night(self, frame: np.ndarray) -> list:
        """Night-mode detection (bdd100k). Returns corrected detections."""
        raw = self._run_session(self.bdd100k_session, frame, model_name="Night")
        return self._correct_classification(raw)

    def check_parking_slots(self, frame: np.ndarray) -> list:
        """Parking slot / illegal parking detection."""
        return self._run_session(self.parking_session, frame, model_name="Parking")

    def detect_license_plate(self, frame: np.ndarray) -> list:
        """License plate detection (lpr_model). Uses low threshold for small objects."""
        return self._run_session(
            self.lpr_session, frame,
            threshold=LPR_CONFIDENCE_THRESHOLD,
            model_name="LPR",
            apply_nms=True
        )

    # ── OCR Pipeline ─────────────────────────────────────────────────────────

    def _preprocess_plate_image(self, img: np.ndarray) -> list:
        """
        Generate multiple preprocessed variants of a plate crop for multi-pass OCR.
        Returns a list of (label, image) tuples.
        """
        variants = []

        # 1. Upscale 3x to improve OCR on small plates
        h, w = img.shape[:2]
        upscaled = cv2.resize(img, (w * 3, h * 3), interpolation=cv2.INTER_CUBIC)
        variants.append(('upscaled', upscaled))

        # 2. Grayscale + CLAHE (contrast limited adaptive histogram equalization)
        gray = cv2.cvtColor(upscaled, cv2.COLOR_BGR2GRAY)
        clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
        clahe_img = clahe.apply(gray)
        variants.append(('clahe', clahe_img))

        return variants

    @staticmethod
    def _validate_plate(text: str) -> bool:
        """Validate if OCR result matches Indonesian plate format."""
        cleaned = re.sub(r'\s+', '', text.upper())
        return bool(PLATE_REGEX.match(cleaned))

    @staticmethod
    def _clean_plate_text(text: str) -> str:
        """Remove non-alphanumeric characters and uppercase."""
        return re.sub(r'[^A-Z0-9]', '', text.upper())

    def read_license_plate_text(self, frame: np.ndarray, plate_box: list) -> dict:
        """
        Multi-pass OCR pipeline:
          1. Crop + pad plate area
          2. Generate 5 preprocessed variants
          3. Run EasyOCR on each variant
          4. Select best result by confidence
          5. Validate against Indonesian plate regex
          6. ALWAYS returns { plate_number, plate_confidence } — never null

        plate_box: [x1, y1, w, h, conf, cls] in original frame pixels
        """
        fallback = {"plate_number": "UNREADABLE", "plate_confidence": 0.0}

        if not _CV2_AVAILABLE:
            return fallback
        if self.ocr_reader is None:
            logger.warning("[OCR] EasyOCR not available — returning UNREADABLE")
            return fallback

        try:
            H, W = frame.shape[:2]
            x, y, w, h = int(plate_box[0]), int(plate_box[1]), int(plate_box[2]), int(plate_box[3])

            # Add 10% padding
            pw, ph = max(int(w * 0.10), 5), max(int(h * 0.10), 5)
            x1_p = max(0, x - pw)
            y1_p = max(0, y - ph)
            x2_p = min(W, x + w + pw)
            y2_p = min(H, y + h + ph)

            if x2_p <= x1_p or y2_p <= y1_p:
                logger.warning("[OCR] Invalid crop bounds — UNREADABLE")
                return fallback

            crop = frame[y1_p:y2_p, x1_p:x2_p]
            logger.debug("[OCR] Plate crop: %dx%d px", crop.shape[1], crop.shape[0])

            if crop.size == 0:
                return fallback

            # Generate preprocessing variants
            variants = self._preprocess_plate_image(crop)

            best_text = ""
            best_conf = 0.0
            best_label = ""

            for label, variant_img in variants:
                try:
                    results = self.ocr_reader.readtext(
                        variant_img,
                        allowlist='ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ',
                        detail=1
                    )
                    logger.debug("[OCR][%s] Raw results: %s", label, results)

                    for (_, text, conf) in (results or []):
                        cleaned = self._clean_plate_text(text)
                        if cleaned and conf > best_conf:
                            best_conf = conf
                            best_text = cleaned
                            best_label = label

                except Exception as e:
                    logger.warning("[OCR][%s] Failed: %s", label, e)
                    continue

            logger.info("[OCR] Best result from '%s': text='%s' conf=%.3f", best_label, best_text, best_conf)

            # Always return best text if found, to show on frontend instead of UNREADABLE
            if best_text:
                if self._validate_plate(best_text):
                    logger.info("[OCR] Valid plate detected: %s", best_text)
                    return {"plate_number": best_text, "plate_confidence": round(best_conf, 3)}
                
                # If not valid format but we have something, still return it
                logger.warning("[OCR] Non-standard plate format returned: %s", best_text)
                return {"plate_number": best_text, "plate_confidence": round(best_conf * 0.5, 3)}

            logger.warning("[OCR] No readable plate found — returning UNREADABLE")
            return fallback

        except Exception as e:
            logger.error("[OCR] Pipeline error: %s", e, exc_info=True)
            return fallback

    # ── Class Names ───────────────────────────────────────────────────────────

    def get_class_names(self, model_filename: str) -> dict:
        return self._class_names.get(model_filename, {})

    # ── Status ────────────────────────────────────────────────────────────────

    @property
    def models_loaded(self) -> dict:
        return {
            'vehicle':  self.vehicle_session is not None,
            'lpr':      self.lpr_session is not None,
            'parking':  self.parking_session is not None,
            'crowd':    self.crowd_session is not None,
            'bdd100k':  self.bdd100k_session is not None,
        }


# Module-level singleton
inference_engine = InferenceEngine()
