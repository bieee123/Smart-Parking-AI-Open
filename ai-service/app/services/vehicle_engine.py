"""Vehicle Type Classification engine.

Uses ONNX Runtime when a model file is present.
Falls back to a deterministic mock inference for development/testing.
"""
import os
import logging
import numpy as np

from app.config import VEHICLE_MODEL_PATH, VEHICLE_CONFIDENCE_THRESHOLD

logger = logging.getLogger(__name__)

_VALID_TYPES = ["car", "motorcycle", "truck"]


class VehicleEngine:
    """Wrapper around the vehicle classifier ONNX model (or mock fallback)."""

    def __init__(self, model_path: str = VEHICLE_MODEL_PATH):
        self.model_path = model_path
        self.session = None
        self._load_model()

    def _load_model(self) -> None:
        if not os.path.isfile(self.model_path):
            logger.warning("Vehicle model not found at %s — using mock inference", self.model_path)
            return

        try:
            import onnxruntime as ort
            self.session = ort.InferenceSession(self.model_path, providers=["CPUExecutionProvider"])
            logger.info("Vehicle model loaded successfully from %s", self.model_path)
        except Exception as exc:
            logger.error("Failed to load vehicle model: %s — falling back to mock", exc)
            self.session = None

    def classify(self, image_bytes: bytes) -> dict:
        """Run vehicle type classification.

        Parameters
        ----------
        image_bytes : bytes
            Raw image data (JPEG/PNG/…).

        Returns
        -------
        dict
            {"type": str, "confidence": float}
        """
        if self.session is not None:
            return self._classify_onnx(image_bytes)
        return self._classify_mock(image_bytes)

    # ── ONNX inference ────────────────────────────────────────
    def _classify_onnx(self, image_bytes: bytes) -> dict:
        """Real ONNX Runtime inference."""
        import cv2
        from app.utils.image_tools import bytes_to_cv2, resize_to_max_edge

        img = bytes_to_cv2(image_bytes)
        img = resize_to_max_edge(img, 224)

        # Pre-process: resize to model input size, normalize
        rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        blob = rgb.astype(np.float32) / 255.0
        blob = np.expand_dims(blob, axis=0)

        input_name = self.session.get_inputs()[0].name
        outputs = self.session.run(None, {input_name: blob})

        vtype, conf = self._decode_onnx_output(outputs)
        return {"type": vtype, "confidence": float(conf)}

    @staticmethod
    def _decode_onnx_output(outputs: list) -> tuple[str, float]:
        """Decode raw ONNX output to (vehicle_type, confidence).

        TODO: Replace with actual decoding logic matching your model.
        """
        raw = outputs[0]
        idx = int(np.argmax(raw))
        type_map = {0: "car", 1: "motorcycle", 2: "truck"}
        vtype = type_map.get(idx, "car")
        conf = float(np.max(raw))
        return vtype, conf

    # ── Mock inference ────────────────────────────────────────
    @staticmethod
    def _classify_mock(image_bytes: bytes) -> dict:
        """Deterministic mock classifier based on image byte content."""
        # Use hash of image bytes to pick a type — same image → same result
        idx = hash(image_bytes) % len(_VALID_TYPES)
        vtype = _VALID_TYPES[idx]

        # Confidence between 0.78 and 0.95
        conf = 0.78 + (hash(image_bytes + b"conf") % 17) / 100.0

        return {"type": vtype, "confidence": round(conf, 4)}


# Singleton instance
vehicle_engine = VehicleEngine()
