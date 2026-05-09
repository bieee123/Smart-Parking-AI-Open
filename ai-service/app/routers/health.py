"""
health.py — Production Health Check Endpoints.

V2.0: Per-model status, GPU detection, OCR warmup status, and uptime.
"""
import time
import logging
import os

from fastapi import APIRouter
from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Health"])

_start_time = time.time()


@router.get("/health")
async def health():
    """
    Full system health check.
    Returns per-model load status, GPU availability, OCR status, and uptime.
    """
    uptime_seconds = int(time.time() - _start_time)

    # ── Model status ──────────────────────────────────────────────────────────
    model_status = {}
    engine_source = "unknown"
    try:
        from app.services.inference_engine import inference_engine
        loaded = inference_engine.models_loaded
        model_status = {
            "vehicle":  {"loaded": loaded.get("vehicle", False),  "path": _basename("VEHICLE_MODEL_PATH")},
            "lpr":      {"loaded": loaded.get("lpr", False),      "path": _basename("LPR_MODEL_PATH")},
            "parking":  {"loaded": loaded.get("parking", False),  "path": _basename("ILLEGAL_MODEL_PATH")},
            "crowd":    {"loaded": loaded.get("crowd", False),     "path": _basename("CROWD_MODEL_PATH")},
        }
        engine_source = "inference_engine"
    except Exception as e:
        model_status = {"error": str(e)}

    # ── OCR status ────────────────────────────────────────────────────────────
    ocr_ready = False
    try:
        from app.services.inference_engine import inference_engine
        ocr_ready = inference_engine.ocr_reader is not None
    except Exception:
        pass

    # ── GPU status ────────────────────────────────────────────────────────────
    gpu_info = {}
    try:
        import onnxruntime as ort
        available = ort.get_available_providers()
        gpu_info = {
            "cuda_available": "CUDAExecutionProvider" in available,
            "active_providers": available,
        }
    except Exception:
        gpu_info = {"cuda_available": False, "error": "onnxruntime not available"}

    # ── Tracker status ────────────────────────────────────────────────────────
    tracker_status = {"active": False}
    try:
        from app.services.tracker_manager import _SV_AVAILABLE, tracker_manager
        tracker_status = {
            "active":         _SV_AVAILABLE,
            "active_cameras": len(tracker_manager._trackers),
        }
    except Exception:
        pass

    # ── Stream status ─────────────────────────────────────────────────────────
    stream_status = {"running": False}
    try:
        from app.services.stream_processor import stream_processor
        stream_status = {
            "running": stream_processor.is_running,
            "url":     stream_processor.stream_url,
        }
    except Exception:
        pass

    # ── Slot manager status ───────────────────────────────────────────────────
    slot_status = {"configured": False}
    try:
        from app.services.slot_manager import slot_manager, _SHAPELY_AVAILABLE
        slot_status = {
            "configured":   slot_manager.slot_count > 0,
            "slot_count":   slot_manager.slot_count,
            "shapely":      _SHAPELY_AVAILABLE,
            "occupancy":    slot_manager.occupancy_summary() if slot_manager.slot_count > 0 else {},
        }
    except Exception:
        pass

    # ── Camera Pool status ────────────────────────────────────────────────────
    camera_pool_status = {"active": False}
    try:
        from app.services.camera_worker_pool import camera_pool
        camera_pool_status = camera_pool.status()
        camera_pool_status["active"] = True
    except Exception:
        pass

    # ── Overall status ────────────────────────────────────────────────────────
    any_model_loaded = any(v.get("loaded", False) for v in model_status.values() if isinstance(v, dict))
    overall_status   = "healthy" if any_model_loaded else "degraded"

    return {
        "status":        overall_status,
        "version":       "2.0.0",
        "uptime_seconds": uptime_seconds,
        "ocr_ready":     ocr_ready,
        "gpu":           gpu_info,
        "models":        model_status,
        "tracker":       tracker_status,
        "stream":        stream_status,
        "slots":         slot_status,
        "camera_pool":   camera_pool_status,
    }


@router.get("/health/models")
async def model_health():
    """Quick model-only health check for monitoring."""
    try:
        from app.services.inference_engine import inference_engine
        return {"status": "ok", "models": inference_engine.models_loaded}
    except Exception as e:
        return JSONResponse(status_code=503, content={"status": "error", "error": str(e)})


def _basename(env_key: str) -> str:
    """Return just the filename of a model path env var."""
    try:
        from app.config import (
            VEHICLE_MODEL_PATH, LPR_MODEL_PATH,
            ILLEGAL_MODEL_PATH, CROWD_MODEL_PATH,
        )
        mapping = {
            "VEHICLE_MODEL_PATH": VEHICLE_MODEL_PATH,
            "LPR_MODEL_PATH":     LPR_MODEL_PATH,
            "ILLEGAL_MODEL_PATH": ILLEGAL_MODEL_PATH,
            "CROWD_MODEL_PATH":   CROWD_MODEL_PATH,
        }
        path = mapping.get(env_key, "")
        return os.path.basename(path)
    except Exception:
        return ""
