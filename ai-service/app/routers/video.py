"""
video.py — Production Video File Upload & Background AI Analysis.

V2.0 Changes:
  - C4: REMOVED np.random.randint() fake slot assignment
  - C4: Real slot association via SlotManager
  - H6: True async via run_in_executor (no more blocking event loop)
  - C5: job_store backed by Redis when available, in-memory fallback
  - Security: file size validation, type checking, path sanitization
  - Structured per-job logging
"""
import os
import uuid
import asyncio
import json
import logging
import time
from datetime import datetime
from typing import Optional

import cv2
import numpy as np
from fastapi import APIRouter, UploadFile, File, BackgroundTasks, HTTPException
from fastapi.responses import StreamingResponse, JSONResponse

from app.config import (
    BACKEND_URL,
    BACKEND_SYNC_INTERVAL,
    VIDEO_MAX_SIZE_MB,
    VIDEO_JOB_TTL_SECONDS,
    VIDEO_SAMPLE_FPS,
    REDIS_ENABLED,
    REDIS_URL,
)

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Video Analysis"])

# ── Model imports ─────────────────────────────────────────────────────────────
try:
    from app.services.inference_engine import inference_engine as _ie
    from app.services.ensemble_engine import EnsembleEngine
    _ensemble = EnsembleEngine(_ie)
except Exception as _e:
    logger.error("[Video] EnsembleEngine unavailable: %s", _e)
    _ensemble = None

try:
    from app.services.slot_manager import slot_manager
    _slot_manager_available = True
except Exception:
    slot_manager = None
    _slot_manager_available = False

# ── Job Storage (Redis-backed with in-memory fallback) ────────────────────────
class JobStore:
    """Abstraction over Redis/in-memory job storage."""

    def __init__(self):
        self._redis = None
        self._local: dict = {}

        if REDIS_ENABLED:
            try:
                import redis
                self._redis = redis.from_url(REDIS_URL, decode_responses=True)
                self._redis.ping()
                logger.info("[JobStore] ✅ Redis connected: %s", REDIS_URL)
            except Exception as e:
                logger.warning("[JobStore] Redis unavailable (%s) — using in-memory.", e)
                self._redis = None

    def set(self, job_id: str, data: dict, ttl: int = VIDEO_JOB_TTL_SECONDS):
        if self._redis:
            self._redis.setex(f"job:{job_id}", ttl, json.dumps(data))
        else:
            data["_created_at"] = time.time()
            self._local[job_id] = data

    def get(self, job_id: str) -> Optional[dict]:
        if self._redis:
            raw = self._redis.get(f"job:{job_id}")
            return json.loads(raw) if raw else None
        return self._local.get(job_id)

    def update(self, job_id: str, patch: dict, ttl: int = VIDEO_JOB_TTL_SECONDS):
        current = self.get(job_id) or {}
        current.update(patch)
        self.set(job_id, current, ttl)

    def exists(self, job_id: str) -> bool:
        if self._redis:
            return bool(self._redis.exists(f"job:{job_id}"))
        return job_id in self._local

    def cleanup_local(self):
        """Remove local in-memory jobs older than TTL."""
        now = time.time()
        stale = [
            k for k, v in self._local.items()
            if now - v.get("_created_at", now) > VIDEO_JOB_TTL_SECONDS
        ]
        for k in stale:
            del self._local[k]


job_store = JobStore()


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("/traffic/upload")
async def upload_video(background_tasks: BackgroundTasks, video: UploadFile = File(...)):
    """
    Upload a video file for background AI analysis.
    Returns a job_id for progress tracking via SSE.
    """
    # Security: validate file type
    filename = video.filename or ""
    if not filename.lower().endswith((".mp4", ".avi", ".mov")):
        raise HTTPException(status_code=400, detail="Only .mp4, .avi, .mov supported.")

    # Security: validate file size
    max_bytes = VIDEO_MAX_SIZE_MB * 1024 * 1024
    chunk_size = 8192
    total_read = 0
    chunks = []

    while True:
        chunk = await video.read(chunk_size)
        if not chunk:
            break
        total_read += len(chunk)
        if total_read > max_bytes:
            raise HTTPException(
                status_code=413,
                detail=f"File exceeds {VIDEO_MAX_SIZE_MB}MB limit.",
            )
        chunks.append(chunk)

    content = b"".join(chunks)

    # Save to temp file (no path traversal risk — uuid-based name)
    job_id = str(uuid.uuid4())
    tmp_dir = os.environ.get("TEMP", "/tmp")
    # Sanitize: only alphanumeric + dash in job_id
    safe_id = "".join(c for c in job_id if c.isalnum() or c == "-")
    tmp_path = os.path.join(tmp_dir, f"sp_{safe_id}.mp4")

    try:
        with open(tmp_path, "wb") as f:
            f.write(content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {e}")

    # Initialize job record
    job_store.set(job_id, {
        "progress": 5,
        "status":   "queued",
        "result":   None,
        "error":    None,
    })

    background_tasks.add_task(_process_video_background, job_id, tmp_path)
    logger.info("[Video] Job %s queued for: %s", job_id[:8], filename)

    return {"success": True, "data": {"job_id": job_id}}


@router.get("/traffic/process-status")
async def process_status(job_id: str):
    """SSE stream for video processing progress."""
    # Validate job_id format (prevent path injection)
    if not job_id or len(job_id) > 50 or not all(c.isalnum() or c == "-" for c in job_id):
        raise HTTPException(status_code=400, detail="Invalid job_id.")

    if not job_store.exists(job_id):
        raise HTTPException(status_code=404, detail="Job not found.")

    async def stream():
        while True:
            job = job_store.get(job_id)
            if not job:
                yield f"data: {json.dumps({'status': 'not_found'})}\n\n"
                break

            payload = {
                "progress": job.get("progress", 0),
                "result":   job.get("result"),
                "status":   job.get("status", "unknown"),
                "error":    job.get("error"),
            }
            yield f"data: {json.dumps(payload)}\n\n"

            if job.get("progress", 0) >= 100 or job.get("status") in ("done", "error"):
                break
            await asyncio.sleep(0.8)

    return StreamingResponse(stream(), media_type="text/event-stream")


# ── Background Video Processor ────────────────────────────────────────────────

async def _process_video_background(job_id: str, file_path: str):
    """
    Background task: offloads CPU-intensive processing to thread pool
    so the FastAPI event loop is never blocked.
    """
    try:
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, _sync_process_video, job_id, file_path)
    except Exception as e:
        logger.error("[Video:%s] Unexpected error: %s", job_id[:8], e)
        job_store.update(job_id, {"status": "error", "error": str(e), "progress": 100})
    finally:
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
            except Exception:
                pass


def _sync_process_video(job_id: str, file_path: str):
    """
    Synchronous video processor (runs in thread pool).
    C4 FIX: Uses SlotManager for real slot association (no fake random slots).
    """
    short_id = job_id[:8]
    logger.info("[Video:%s] Processing started: %s", short_id, file_path)

    total_v    = 0
    total_viol = 0
    frames_done = 0
    sample_boxes = []
    plates_seen: dict = {}     # track_id → plate_number
    slot_occupancy: dict = {}  # slot_id → occupancy dict
    last_sync_time = time.time()

    try:
        cap = cv2.VideoCapture(file_path)
        if not cap.isOpened():
            raise ValueError("Cannot open video file.")

        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) or 1
        source_fps   = cap.get(cv2.CAP_PROP_FPS) or 25.0
        # Sample at VIDEO_SAMPLE_FPS (default 2fps), but don't exceed source FPS
        interval = max(1, int(source_fps / min(VIDEO_SAMPLE_FPS, source_fps)))

        logger.info(
            "[Video:%s] %d frames @ %.0ffps → sampling every %d frames",
            short_id, total_frames, source_fps, interval,
        )

        idx = 0
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break

            # Update progress every frame for smooth SSE progress bar
            progress = min(98, int((idx / total_frames) * 100))
            job_store.update(job_id, {"progress": progress, "status": "processing"})

            if idx % interval == 0 and _ensemble is not None:
                try:
                    res = _ensemble.analyze_frame(frame)
                    v_count    = res.get("vehicle_count", 0)
                    viol_count = len(res.get("violations", []))
                    boxes      = res.get("boxes", [])

                    total_v    += v_count
                    total_viol += viol_count
                    frames_done += 1

                    if not sample_boxes and boxes:
                        sample_boxes = boxes

                    # Collect plates from multi-LPR
                    for plate_info in res.get("plates", []):
                        pn = plate_info.get("plate_number", "UNREADABLE")
                        if pn and pn != "UNREADABLE":
                            tid = plate_info.get("track_id")
                            if tid:
                                plates_seen[tid] = pn

                    # C4 FIX: Real slot association via SlotManager
                    if _slot_manager_available and slot_manager and slot_manager.slot_count > 0:
                        slot_occupancy = slot_manager.associate(boxes, plate_map=plates_seen)

                        # Sync slot occupancy to backend
                        now = time.time()
                        if now - last_sync_time >= BACKEND_SYNC_INTERVAL:
                            _sync_occupancy_to_backend(slot_occupancy, short_id)
                            last_sync_time = now

                    # Periodic traffic sync
                    _sync_traffic_to_backend(res, short_id)

                    # Update intermediate result for SSE
                    job_store.update(job_id, {
                        "result": {
                            "total_vehicles": v_count,
                            "avg_density":    res.get("density_level", "low"),
                            "last_plate":     res.get("last_plate", "N/A"),
                            "plates":         res.get("plates", []),
                            "is_intermediate": True,
                        }
                    })

                except Exception as e:
                    logger.warning("[Video:%s] Frame %d analysis error: %s", short_id, idx, e)

            idx += 1

        cap.release()

        # Final aggregate
        avg_v   = total_v // max(1, frames_done)
        density = "high" if avg_v > 15 else "medium" if avg_v > 7 else "low"

        # Slot summary for final result
        occ_summary = {}
        if _slot_manager_available and slot_manager:
            occ_summary = slot_manager.occupancy_summary()

        final_result = {
            "total_vehicles":  avg_v,
            "violations":      total_viol,
            "frames_processed": frames_done,
            "boxes":           sample_boxes,
            "avg_density":     density,
            "occupancy":       occ_summary,
            "plates_detected": list(set(plates_seen.values())),
            "summary": (
                f"Analysis Complete: avg {avg_v} vehicles, "
                f"{total_viol} violations, "
                f"{occ_summary.get('occupied_slots', 0)}/{occ_summary.get('total_slots', 0)} slots occupied."
            ),
        }

        job_store.update(job_id, {"progress": 100, "result": final_result, "status": "done"})
        logger.info("[Video:%s] ✅ Processing complete. %d frames analyzed.", short_id, frames_done)

    except Exception as e:
        logger.error("[Video:%s] ❌ Processing failed: %s", short_id, e, exc_info=True)
        job_store.update(job_id, {"status": "error", "error": str(e), "progress": 100})


def _sync_traffic_to_backend(result: dict, job_tag: str):
    """Fire-and-forget traffic sync (non-blocking)."""
    try:
        import requests
        violations_fmt = [
            {"type": "illegal_parking", "confidence": float(v[4]) if len(v) > 4 else 0.8}
            for v in result.get("violations", [])
        ]
        requests.post(
            f"{BACKEND_URL}/api/ingest/traffic",
            json={
                "vehicle_count": result.get("vehicle_count", 0),
                "density_level": result.get("density_level", "low"),
                "camera_id":     f"VIDEO_{job_tag}",
                "violations":    violations_fmt,
                "timestamp":     datetime.now().isoformat(),
            },
            timeout=1.5,
        )
    except Exception:
        pass


def _sync_occupancy_to_backend(slot_occupancy: dict, job_tag: str):
    """Sync real slot occupancy (from SlotManager) to backend."""
    if not slot_occupancy:
        return
    try:
        import requests
        slots_payload = []
        for slot_id, slot_data in slot_occupancy.items():
            slots_payload.append({
                "slot_number":  slot_id,
                "is_occupied":  slot_data.get("is_occupied", False),
                "license_plate": slot_data.get("license_plate", "UNKNOWN"),
                "vehicle_type": slot_data.get("occupant_type", "car"),
            })
        requests.post(
            f"{BACKEND_URL}/api/ingest/occupancy",
            json={"slots": slots_payload},
            timeout=1.5,
        )
    except Exception:
        pass
