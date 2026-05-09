"""
cameras.py — Multi-Camera Management REST API & SSE Broadcaster.

Endpoints:
  POST   /ai/cameras/add          — Register & start a new camera
  DELETE /ai/cameras/{camera_id}  — Stop and remove a camera
  GET    /ai/cameras              — List all active cameras + status
  GET    /ai/cameras/{camera_id}  — Single camera status
  GET    /ai/cameras/{camera_id}/stream  — SSE stream for one camera
  POST   /ai/cameras/stop-all     — Emergency stop all cameras
"""
import asyncio
import json
import logging

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.services.camera_worker_pool import camera_pool

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/cameras", tags=["Multi-Camera Management"])


# ── Pydantic Models ────────────────────────────────────────────────────────────

class CameraAddRequest(BaseModel):
    camera_id: str
    url:       str
    label:     str = ""   # Human-readable label for UI


# ── Routes ─────────────────────────────────────────────────────────────────────

@router.post("/add")
async def add_camera(body: CameraAddRequest):
    """
    Register and start inference on a new camera stream.

    Supports: RTSP, HTTP m3u8, YouTube URLs, local video files.
    Returns camera status immediately; inference starts in background.
    """
    try:
        # Sanitize camera_id (alphanumeric + dash/underscore only)
        safe_id = "".join(c for c in body.camera_id if c.isalnum() or c in "-_")
        if not safe_id:
            raise HTTPException(status_code=400, detail="Invalid camera_id.")

        status = camera_pool.add(safe_id, body.url)
        return {
            "success": True,
            "message": f"Camera '{safe_id}' added and starting.",
            "data":    status,
        }
    except RuntimeError as e:
        raise HTTPException(status_code=429, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error("[Cameras] add_camera error: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{camera_id}")
async def remove_camera(camera_id: str):
    """Stop and remove a camera worker."""
    removed = camera_pool.remove(camera_id)
    if not removed:
        raise HTTPException(status_code=404, detail=f"Camera '{camera_id}' not found.")
    return {"success": True, "message": f"Camera '{camera_id}' stopped and removed."}


@router.get("")
async def list_cameras():
    """List all active cameras with status metrics."""
    return {
        "success": True,
        "data":    camera_pool.status(),
    }


@router.get("/{camera_id}/status")
async def get_camera_status(camera_id: str):
    """Get status and latest result for a single camera."""
    result = camera_pool.get_result(camera_id)
    pool_status = camera_pool.status()
    cam_status  = next(
        (c for c in pool_status["cameras"] if c["camera_id"] == camera_id), None
    )
    if cam_status is None:
        raise HTTPException(status_code=404, detail=f"Camera '{camera_id}' not found.")

    return {
        "success": True,
        "data": {
            "status": cam_status,
            "latest_result": result,
        }
    }


@router.get("/{camera_id}/stream")
async def stream_camera(camera_id: str):
    """
    SSE stream for a single camera's live detection results.
    Connect from frontend with: new EventSource('/ai/cameras/{id}/stream')
    """
    result_queue = camera_pool.get_queue(camera_id)
    if result_queue is None:
        raise HTTPException(status_code=404, detail=f"Camera '{camera_id}' not found.")

    async def event_gen():
        while True:
            # Check if camera still alive
            if camera_id not in camera_pool.list_cameras():
                yield f"data: {json.dumps({'status': 'camera_stopped'})}\n\n"
                break

            # Try to get latest result (timeout = 2s)
            try:
                loop   = asyncio.get_event_loop()
                result = await asyncio.wait_for(
                    loop.run_in_executor(None, result_queue.get, True, 2.0),
                    timeout=3.0,
                )
                result["camera_id"] = camera_id
                yield f"data: {json.dumps(result)}\n\n"
            except (asyncio.TimeoutError, Exception):
                # Send keepalive on timeout
                yield f"data: {json.dumps({'keepalive': True, 'camera_id': camera_id})}\n\n"

    return StreamingResponse(event_gen(), media_type="text/event-stream")


@router.get("/{camera_id}/latest")
async def get_latest(camera_id: str):
    """Get the most recent detection result for a camera (non-streaming)."""
    result = camera_pool.get_result(camera_id)
    if result is None:
        raise HTTPException(status_code=404, detail=f"Camera '{camera_id}' not found or no data yet.")
    return {"success": True, "data": result}


@router.post("/stop-all")
async def stop_all_cameras():
    """Emergency stop all running camera workers."""
    count = len(camera_pool.list_cameras())
    camera_pool.stop_all()
    return {
        "success": True,
        "message": f"Stopped {count} camera(s).",
    }
