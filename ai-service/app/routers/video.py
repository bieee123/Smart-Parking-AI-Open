"""video.py — Video file upload dan analisis frame-by-frame."""
import os
import uuid
import asyncio
import json
import shutil
import tempfile
from datetime import datetime
import cv2
import numpy as np
from fastapi import APIRouter, UploadFile, File, BackgroundTasks
from fastapi.responses import StreamingResponse, JSONResponse

router = APIRouter(tags=["Video Analysis"])

# In-memory job store: { job_id: { progress, result, status, created_at } }
job_store: dict = {}

try:
    from app.services.inference_engine import inference_engine as _ie
    from app.services.ensemble_engine import EnsembleEngine
    _ensemble = EnsembleEngine(_ie)
except Exception as _e:
    print(f"[Video] EnsembleEngine unavailable: {_e}")
    _ensemble = None


@router.post("/traffic/upload")
async def upload_video(background_tasks: BackgroundTasks, video: UploadFile = File(...)):
    """Upload a video file for background AI analysis. Returns a job_id for tracking."""
    filename = video.filename or ""
    if not filename.lower().endswith(('.mp4', '.avi', '.mov')):
        return JSONResponse(
            status_code=400,
            content={"success": False, "error": "Hanya mendukung .mp4, .avi, .mov"},
        )

    _cleanup_old_jobs()
    job_id = str(uuid.uuid4())

    # Save to a temporary file using chunks to avoid OOM
    import shutil
    import tempfile
    tmp_dir = tempfile.gettempdir()
    tmp_path = os.path.join(tmp_dir, f"sp_{job_id}.mp4")

    try:
        with open(tmp_path, "wb") as buffer:
            # Stream the file to disk
            shutil.copyfileobj(video.file, buffer)
    except Exception as e:
        return JSONResponse(status_code=500, content={"success": False, "error": f"Gagal menyimpan file: {str(e)}"})

    try:
        loop = asyncio.get_event_loop()
        created_at = loop.time()
    except Exception:
        created_at = 0.0

    job_store[job_id] = {
        "progress": 5, # Start with 5% to show immediate responsiveness
        "result": None,
        "status": "queued",
        "created_at": created_at,
    }
    background_tasks.add_task(_process_video, job_id, tmp_path)
    return {"success": True, "data": {"job_id": job_id}}


@router.get("/traffic/process-status")
async def process_status(job_id: str):
    """SSE stream for job progress. Emits progress/result/status until done."""
    if job_id not in job_store:
        return JSONResponse(
            status_code=404,
            content={"success": False, "error": "Job tidak ditemukan"},
        )

    async def stream():
        while True:
            job = job_store.get(job_id, {})
            payload = {
                "progress": job.get("progress", 0),
                "result": job.get("result"),
                "status": job.get("status", "unknown"),
            }
            yield f"data: {json.dumps(payload)}\n\n"
            if job.get("progress", 0) >= 100 or job.get("status") in ("done", "error"):
                break
            await asyncio.sleep(1)

    return StreamingResponse(stream(), media_type="text/event-stream")


async def _process_video(job_id: str, file_path: str):
    """Background task: frame-by-frame ONNX analysis of uploaded video."""
    job_store[job_id]["status"] = "processing"
    total_v, total_viol, conf_sum, det_count, frames_done = 0, 0, 0.0, 0, 0
    try:
        cap = cv2.VideoCapture(file_path)
        if not cap.isOpened():
            raise ValueError("Tidak bisa buka file video")

        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) or 1
        fps = cap.get(cv2.CAP_PROP_FPS) or 25
        interval = max(1, int(fps))
        idx = 0

        sample_boxes = []
        last_sync_idx = 0
        sync_interval = int(fps * 5) # Sync every 5 seconds of video

        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break
            
            if idx % interval == 0 and _ensemble is not None:
                try:
                    # Use ensemble for full analysis
                    res = _ensemble.analyze_frame(frame)
                    v_count = res.get("vehicle_count", 0)
                    viol_count = len(res.get("violations", []))
                    
                    total_v += v_count
                    total_viol += viol_count
                    
                    if not sample_boxes and res.get("boxes"):
                        sample_boxes = res.get("boxes")
                        
                    frames_done += 1

                    # B3: Incremental Sync to Backend (every 5s of video)
                    if idx - last_sync_idx >= sync_interval:
                        try:
                            import requests as req
                            from datetime import datetime
                            backend_url = os.getenv("BACKEND_URL", "http://localhost:8000")
                            
                            dens, _ = _ensemble._assess(v_count)
                            ingest_payload = {
                                "vehicle_count": v_count,
                                "density_level": dens,
                                "camera_id": f"VIDEO_{job_id[:8]}",
                                "violations": [{"type": "illegal_parking", "confidence": 0.8} for _ in range(viol_count)],
                                "timestamp": datetime.now().isoformat()
                            }
                            req.post(f"{backend_url}/api/ingest/traffic", json=ingest_payload, timeout=2)
                            
                            # B4: Update real parking slots (PostgreSQL) for Dashboard/Map
                            try:
                                # Find an available slot to "occupy" in the DB
                                # For this demo, we use slot numbers A1-A10
                                slot_num = f"A{np.random.randint(1, 11)}"
                                occ_payload = {
                                    "slots": [{
                                        "slot_number": slot_num,
                                        "is_occupied": True,
                                        "license_plate": res.get("last_plate", "UNKNOWN"),
                                        "vehicle_type": res.get("vehicle_types", {}).get("car", 0) > 0 and "car" or "motorbike"
                                    }]
                                }
                                req.post(f"{backend_url}/api/ingest/occupancy", json=occ_payload, timeout=2)
                            except Exception: pass

                            last_sync_idx = idx
                            
                            # Update intermediate result for SSE
                            job_store[job_id]["result"] = {
                                "total_vehicles": v_count,
                                "avg_density": dens,
                                "last_plate": res.get("last_plate", "N/A"),
                                "is_intermediate": True
                            }
                        except Exception: pass

                except Exception:
                    pass
            
            idx += 1
            job_store[job_id]["progress"] = min(99, int((idx / total_frames) * 100))
            await asyncio.sleep(0)

        cap.release()

        # Final aggregate result
        avg_v = total_v // max(1, frames_done)
        density = "high" if avg_v > 15 else "medium" if avg_v > 7 else "low"

        result = {
            "total_vehicles": avg_v,
            "violations": total_viol,
            "frames_processed": frames_done,
            "boxes": sample_boxes,
            "avg_density": density,
            "summary": f"Video Analysis Complete: {avg_v} avg vehicles, {total_viol} violations."
        }
        job_store[job_id].update({"progress": 100, "result": result, "status": "done"})

        # Final Sync
        try:
            import requests as req
            from datetime import datetime
            backend_url = os.getenv("BACKEND_URL", "http://localhost:8000")
            req.post(f"{backend_url}/api/ingest/traffic", json={
                "vehicle_count": avg_v,
                "density_level": density,
                "camera_id": f"VIDEO_FINAL_{job_id[:8]}",
                "violations": [{"type": "illegal_parking", "confidence": 0.8} for _ in range(total_viol)],
                "timestamp": datetime.now().isoformat()
            }, timeout=2)
        except Exception: pass

    except Exception as e:
        job_store[job_id]["status"] = "error"
        job_store[job_id]["error"] = str(e)
    finally:
        # Cleanup video file
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
            except: pass


def _cleanup_old_jobs():
    """Remove jobs older than 1 hour to prevent memory leaks."""
    try:
        loop = asyncio.get_event_loop()
        now = loop.time()
        stale = [k for k, v in job_store.items() if now - v.get("created_at", now) > 3600]
        for jid in stale:
            del job_store[jid]
    except Exception:
        pass
