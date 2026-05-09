"""
AI Service Configuration — Centralized & Environment-Driven.

All thresholds, paths and runtime settings are defined here.
Use .env overrides to tune without code changes.
"""
import os
import logging
import onnxruntime as ort
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

# ── Server ───────────────────────────────────────────────────────────────────
PORT = int(os.getenv("PORT", 9000))
HOST = os.getenv("HOST", "0.0.0.0")

# ── CORS ─────────────────────────────────────────────────────────────────────
CORS_ORIGINS = os.getenv(
    "CORS_ORIGINS", "http://localhost:8000,http://localhost:5173"
).split(",")

# ── Model Paths ───────────────────────────────────────────────────────────────
_BASE = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "models"))

VEHICLE_MODEL_PATH = os.getenv("VEHICLE_MODEL_PATH", os.path.join(_BASE, "vehicle_model.onnx"))
LPR_MODEL_PATH     = os.getenv("LPR_MODEL_PATH",     os.path.join(_BASE, "lpr_model.onnx"))
ILLEGAL_MODEL_PATH = os.getenv("ILLEGAL_MODEL_PATH", os.path.join(_BASE, "illegal_model.onnx"))
CROWD_MODEL_PATH   = os.getenv("CROWD_MODEL_PATH",   os.path.join(_BASE, "crowd_detection_model.onnx"))
BDD100K_MODEL_PATH = os.getenv("BDD100K_MODEL_PATH", os.path.join(_BASE, "bdd100k_model.onnx"))
PREDICT_MODEL_PATH = os.getenv("PREDICT_MODEL_PATH", os.path.join(_BASE, "prediction_model.onnx"))

# ── Confidence Thresholds (centralized — override via .env) ──────────────────
VEHICLE_CONFIDENCE_THRESHOLD = float(os.getenv("VEHICLE_CONF", "0.40"))
LPR_CONFIDENCE_THRESHOLD     = float(os.getenv("LPR_CONF",     "0.20"))
CROWD_CONFIDENCE_THRESHOLD   = float(os.getenv("CROWD_CONF",   "0.35"))
ILLEGAL_CONFIDENCE_THRESHOLD = float(os.getenv("ILLEGAL_CONF", "0.40"))
NMS_IOU_THRESHOLD            = float(os.getenv("NMS_IOU",      "0.45"))
OCR_MIN_CONFIDENCE           = float(os.getenv("OCR_MIN_CONF", "0.25"))

# ── Inference Image Size ──────────────────────────────────────────────────────
INFERENCE_IMG_SIZE = int(os.getenv("INFERENCE_IMG_SIZE", "640"))

# ── GPU / ONNX Runtime ────────────────────────────────────────────────────────
_available_providers = ort.get_available_providers()
if "CUDAExecutionProvider" in _available_providers:
    ONNX_PROVIDERS = ["CUDAExecutionProvider", "CPUExecutionProvider"]
    logger.info("[Config] CUDA detected — GPU inference enabled.")
else:
    ONNX_PROVIDERS = ["CPUExecutionProvider"]
    logger.info("[Config] No CUDA detected — CPU inference mode.")

# ── Stream / Camera Settings ──────────────────────────────────────────────────
FRAME_INTERVAL_SECONDS = float(os.getenv("FRAME_INTERVAL_SECONDS", "0.5"))  # Time-based, not count-based
MAX_CAMERAS            = int(os.getenv("MAX_CAMERAS", "10"))

# ── Video Processing ──────────────────────────────────────────────────────────
VIDEO_SAMPLE_FPS       = int(os.getenv("VIDEO_SAMPLE_FPS", "2"))    # Frames per second to sample
VIDEO_MAX_SIZE_MB      = int(os.getenv("VIDEO_MAX_SIZE_MB", "500"))  # Max upload size
VIDEO_JOB_TTL_SECONDS  = int(os.getenv("VIDEO_JOB_TTL", "3600"))    # 1 hour TTL

# ── Redis (optional) ──────────────────────────────────────────────────────────
REDIS_URL     = os.getenv("REDIS_URL", None)  # None = use in-memory fallback
REDIS_ENABLED = REDIS_URL is not None

# ── OCR Settings ──────────────────────────────────────────────────────────────
OCR_SCALE_TARGET_HEIGHT = int(os.getenv("OCR_SCALE_TARGET_H", "120"))
OCR_MAX_PLATES_PER_FRAME = int(os.getenv("OCR_MAX_PLATES", "5"))

# ── Backend Sync ──────────────────────────────────────────────────────────────
BACKEND_URL       = os.getenv("BACKEND_URL", "http://localhost:8000")
BACKEND_SYNC_INTERVAL = int(os.getenv("BACKEND_SYNC_INTERVAL", "10"))  # seconds
