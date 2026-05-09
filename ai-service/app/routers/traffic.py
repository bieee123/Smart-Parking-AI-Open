"""
traffic.py — Core Traffic Analysis & Real-Time Stream Router.

V2.0 Changes:
  - H4: Mock fallback now CLEARLY LABELED — source field = "mock_heuristic"
       and is logged as WARNING so it's visible in server logs
  - OCRWorker integrated for async multi-plate processing
  - EnsembleEngine V5 used for all real analysis
  - Cleaner fallback chain: Ensemble → InferenceEngine → Mock (labeled)
  - backend_url from config (not scattered os.getenv)
"""
import os
import cv2
import json
import logging
import asyncio
import random
import numpy as np
import tempfile

from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse, StreamingResponse

from app.config import BACKEND_URL, BACKEND_SYNC_INTERVAL

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Traffic Analysis"])

# ── Engine Imports ─────────────────────────────────────────────────────────────
try:
    from app.services.inference_engine import inference_engine as _ie
    from app.services.ensemble_engine import EnsembleEngine
    _ensemble = EnsembleEngine(_ie)
    logger.info("[Traffic] EnsembleEngine V5 active.")
except Exception as e:
    logger.error("[Traffic] EnsembleEngine init failed: %s", e)
    _ensemble = None

try:
    from app.services.ocr_worker import ocr_worker
    _ocr_available = True
except Exception:
    _ocr_available = False

# ── Mock Fallback (clearly labeled) ──────────────────────────────────────────

def _mock_result(reason: str = "") -> dict:
    """
    H4 FIX: Mock data is now:
      1. Clearly labeled with source='mock_heuristic'
      2. Logged as WARNING so operators know AI is degraded
      3. Never silently passed off as real detection
    """
    count   = random.randint(3, 12)
    density = "high" if count > 15 else "medium" if count > 7 else "low"
    rec_map = {
        "high":   "Heavy traffic. Redirect to off-street parking.",
        "medium": "Traffic building. Monitor entrance.",
        "low":    "Traffic smooth. No action required.",
    }
    boxes = [
        [random.uniform(0.1, 0.8), random.uniform(0.1, 0.8), 0.1, 0.08,
         round(random.uniform(0.7, 0.95), 2), random.randint(0, 4)]
        for _ in range(count)
    ]

    logger.warning(
        "[Traffic] ⚠️  MOCK DATA RETURNED — real AI unavailable. Reason: %s",
        reason or "EnsembleEngine not loaded",
    )

    return {
        "vehicle_count":    count,
        "density_level":    density,
        "recommendation":   rec_map[density],
        "boxes":            boxes,
        "violations":       [],
        "plate_number":     "UNREADABLE",
        "plate_confidence": 0.0,
        "last_plate":       "UNREADABLE",
        "plates":           [],
        "summary":          f"⚠️ Mock AI: {count} kendaraan (simulasi — model tidak tersedia)",
        "source":           "mock_heuristic",   # H4: clearly labeled
        "is_mock":          True,               # H4: explicit boolean flag for frontend
    }


def _get_result(frame=None, camera_id: str = "CCTV") -> dict:
    """
    Priority chain:
      1. EnsembleEngine V5 (best — crowd+vehicle+multi-LPR)
      2. InferenceEngine fallback (vehicle detect only)
      3. Mock (labeled)
    """
    # 1. Ensemble
    if _ensemble is not None and frame is not None:
        try:
            return _ensemble.analyze_frame(frame, camera_id=camera_id)
        except Exception as e:
            logger.error("[Traffic] Ensemble failed: %s", e)

    # 2. InferenceEngine direct
    if frame is not None:
        try:
            from app.services.inference_engine import inference_engine
            vehicles = inference_engine.detect_vehicles(frame)
            slots    = inference_engine.check_parking_slots(frame)

            filtered  = [d for d in (vehicles or []) if float(d[4]) >= 0.40]
            viols     = [d for d in (slots    or []) if len(d) > 5 and int(d[5]) == 2 and float(d[4]) >= 0.40]
            count     = len(filtered)
            density   = "high" if count > 15 else "medium" if count > 7 else "low"

            return {
                "vehicle_count":    count,
                "density_level":    density,
                "recommendation":   "Detected by InferenceEngine (ensemble unavailable).",
                "boxes":            filtered,
                "violations":       viols,
                "plate_number":     "UNREADABLE",
                "plate_confidence": 0.0,
                "last_plate":       "UNREADABLE",
                "plates":           [],
                "source":           "inference_engine_fallback",
                "is_mock":          False,
            }
        except Exception as e:
            logger.error("[Traffic] InferenceEngine fallback failed: %s", e)

    return _mock_result(reason="No frame available or all models failed")


# ── Routes ─────────────────────────────────────────────────────────────────────

@router.post("/traffic/analyze")
async def analyze_image(image: UploadFile = File(...)):
    """
    Single JPEG/PNG frame → detection → return result & persist to backend.
    Used by: LiveCamera.jsx, camera_worker.py, video processor.
    """
    try:
        contents = await image.read()
        nparr    = np.frombuffer(contents, np.uint8)
        frame    = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if frame is None:
            raise HTTPException(status_code=400, detail="Invalid image format.")

        result = _get_result(frame)

        # Async multi-plate OCR if OCR worker available and plates found
        if _ocr_available and _ie is not None:
            raw_plates = _ie.detect_license_plate(frame)
            if raw_plates:
                try:
                    plates_all = await ocr_worker.read_all_plates_async(frame, raw_plates)
                    readable   = [p for p in plates_all if p["plate_number"] != "UNREADABLE"]
                    if readable:
                        result["plates"] = plates_all
                        best = max(readable, key=lambda p: p["plate_confidence"])
                        result["plate_number"]     = best["plate_number"]
                        result["plate_confidence"] = best["plate_confidence"]
                        result["last_plate"]       = best["plate_number"]
                except Exception as e:
                    logger.warning("[Traffic] Async OCR failed: %s", e)

        # Non-blocking backend sync
        _sync_to_backend(result, camera_id="UPLOAD_ANALYSIS")

        return {"success": True, "data": result}

    except HTTPException:
        raise
    except Exception as e:
        logger.error("[Traffic] analyze_image error: %s", e, exc_info=True)
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": str(e)},
        )


@router.get("/traffic/stream")
async def stream_traffic_ai(url: str, camera_id: str = "STREAM_AI"):
    """Start AI processing on a CCTV/YouTube stream and return real-time results via SSE."""
    from app.services.stream_processor import stream_processor
    stream_processor.start(url, camera_id=camera_id)

    async def event_generator():
        last_sync = 0.0
        while True:
            if not stream_processor.is_running:
                break

            data = dict(stream_processor.latest_result)
            data.setdefault("boxes", [])
            data.setdefault("violations", [])
            data.setdefault("plates", [])

            yield f"data: {json.dumps(data)}\n\n"

            # Periodic backend sync
            now = asyncio.get_event_loop().time()
            if (now - last_sync > BACKEND_SYNC_INTERVAL) or len(data.get("violations", [])) > 0:
                _sync_to_backend(data, camera_id=camera_id)
                last_sync = now

            await asyncio.sleep(1)

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.get("/traffic/resolve")
async def resolve_stream_url(url: str):
    """Helper to resolve YouTube URLs to direct m3u8."""
    from app.services.stream_processor import stream_processor
    resolved = stream_processor._get_direct_url(url)
    return {"resolved_url": resolved}


# ── Helpers ───────────────────────────────────────────────────────────────────

def _sync_to_backend(result: dict, camera_id: str = "UPLOAD_ANALYSIS"):
    """Fire-and-forget sync to backend ingestion endpoint."""
    try:
        import requests
        from datetime import datetime

        violations_fmt = [
            {
                "type":       "illegal_parking",
                "zone":       camera_id,
                "confidence": float(v[4]) if len(v) > 4 else 0.8,
            }
            for v in result.get("violations", [])
        ]
        requests.post(
            f"{BACKEND_URL}/api/ingest/traffic",
            json={
                "vehicle_count": result.get("vehicle_count", 0),
                "density_level": result.get("density_level", "low"),
                "camera_id":     camera_id,
                "violations":    violations_fmt,
                "timestamp":     datetime.now().isoformat(),
                "is_mock":       result.get("is_mock", False),
            },
            timeout=1.5,
        )
    except Exception:
        pass
