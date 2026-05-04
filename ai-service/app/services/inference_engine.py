"""
Inference Engine — ONNX Runtime wrapper for Smart Parking AI models.

Loads vehicle detection, LPR, and parking slot models from the models/ directory.
Gracefully falls back to mock mode if any model file is not found.
"""

import os
import logging
import numpy as np

logger = logging.getLogger(__name__)

# Confidence threshold — detections below this are ignored
CONFIDENCE_THRESHOLD = 0.40

try:
    import onnxruntime as ort
    _ORT_AVAILABLE = True
except ImportError:
    _ORT_AVAILABLE = False
    logger.warning("[InferenceEngine] onnxruntime not installed. Running in mock mode.")

try:
    import cv2
    _CV2_AVAILABLE = True
except ImportError:
    _CV2_AVAILABLE = False
    logger.warning("[InferenceEngine] opencv-python not installed. Frame preprocessing disabled.")


class InferenceEngine:
    """
    Wraps ONNX Runtime sessions for vehicle detection, LPR, and parking slot analysis.
    Falls back gracefully to None (mock mode) when model files are missing.
    """

    def __init__(self):
        # Resolve model directory relative to this file
        model_dir = os.path.join(os.path.dirname(__file__), '..', '..', 'models')
        model_dir = os.path.abspath(model_dir)

        logger.info("[InferenceEngine] Loading models from: %s", model_dir)

        self.vehicle_session = self._load_model(os.path.join(model_dir, 'vehicle_model.onnx'))
        self.lpr_session = self._load_model(os.path.join(model_dir, 'lpr_model.onnx'))
        self.parking_session = self._load_model(os.path.join(model_dir, 'parking_model.onnx'))

        loaded = sum(1 for s in [self.vehicle_session, self.lpr_session, self.parking_session] if s is not None)
        logger.info("[InferenceEngine] %d/3 models loaded successfully.", loaded)

    def _load_model(self, path: str):
        """
        Load a single ONNX model. Returns None (mock fallback) if file not found or ORT unavailable.
        """
        if not _ORT_AVAILABLE:
            return None

        if not os.path.exists(path):
            logger.warning("[InferenceEngine] Model not found (mock fallback active): %s", path)
            return None

        try:
            session = ort.InferenceSession(path, providers=['CPUExecutionProvider'])
            logger.info("[InferenceEngine] Loaded: %s", os.path.basename(path))
            return session
        except Exception as e:
            logger.error("[InferenceEngine] Failed to load %s: %s", path, e)
            return None

    def preprocess_frame(self, frame: np.ndarray, size: tuple = (640, 640)) -> np.ndarray:
        """
        Letterbox-resize a frame to (H, W) without distortion, normalize to [0,1],
        and return as float32 NCHW tensor ready for ONNX inference.
        """
        if not _CV2_AVAILABLE:
            # Return a blank tensor if cv2 is unavailable
            return np.zeros((1, 3, size[0], size[1]), dtype=np.float32)

        h, w = frame.shape[:2]
        scale = min(size[0] / h, size[1] / w)
        new_h, new_w = int(h * scale), int(w * scale)
        resized = cv2.resize(frame, (new_w, new_h))

        # Paste onto grey canvas to preserve aspect ratio
        canvas = np.full((size[0], size[1], 3), 114, dtype=np.uint8)
        pad_h, pad_w = (size[0] - new_h) // 2, (size[1] - new_w) // 2
        canvas[pad_h:pad_h + new_h, pad_w:pad_w + new_w] = resized

        # Normalize and convert to NCHW float32
        img = canvas.astype(np.float32) / 255.0
        return np.transpose(img, (2, 0, 1))[np.newaxis]  # Shape: (1, 3, H, W)

    def detect_vehicles(self, frame: np.ndarray) -> list:
        """
        Run vehicle detection on a frame.
        Returns raw detection array, or empty list if model is not loaded.
        Filters out detections below CONFIDENCE_THRESHOLD.
        """
        if self.vehicle_session is None:
            return []  # Mock fallback — caller handles this

        try:
            input_tensor = self.preprocess_frame(frame)
            input_name = self.vehicle_session.get_inputs()[0].name
            outputs = self.vehicle_session.run(None, {input_name: input_tensor})
            detections = outputs[0]

            # Filter by confidence (assumes last column is confidence score)
            if detections.ndim == 2 and detections.shape[1] > 4:
                detections = detections[detections[:, 4] >= CONFIDENCE_THRESHOLD]

            return detections.tolist()
        except Exception as e:
            logger.error("[InferenceEngine] detect_vehicles error: %s", e)
            return []

    def check_parking_slots(self, frame: np.ndarray) -> list:
        """
        Run parking slot occupancy analysis on a frame.
        Returns raw output array, or empty list if model is not loaded.
        Filters out results below CONFIDENCE_THRESHOLD.
        """
        if self.parking_session is None:
            return []  # Mock fallback — caller handles this

        try:
            input_tensor = self.preprocess_frame(frame)
            input_name = self.parking_session.get_inputs()[0].name
            outputs = self.parking_session.run(None, {input_name: input_tensor})
            results = outputs[0]

            # Filter by confidence if result shape supports it
            if hasattr(results, 'ndim') and results.ndim == 2 and results.shape[1] > 4:
                results = results[results[:, 4] >= CONFIDENCE_THRESHOLD]

            return results.tolist()
        except Exception as e:
            logger.error("[InferenceEngine] check_parking_slots error: %s", e)
            return []

    @property
    def models_loaded(self) -> dict:
        """Returns a dict indicating which models are active (not in mock mode)."""
        return {
            'vehicle': self.vehicle_session is not None,
            'lpr': self.lpr_session is not None,
            'parking': self.parking_session is not None,
        }


# Module-level singleton — import this in stream_processor.py
inference_engine = InferenceEngine()
