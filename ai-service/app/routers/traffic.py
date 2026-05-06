from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse, StreamingResponse
import os
import cv2
import numpy as np
import tempfile
import shutil
import logging
import asyncio
import json

from app.services.traffic_engine import traffic_analyzer
from app.services.stream_processor import stream_processor

# B1: Import ensemble
try:
    from app.services.inference_engine import inference_engine as _ie
    from app.services.ensemble_engine import EnsembleEngine
    _ensemble = EnsembleEngine(_ie)
except Exception as _ens_err:
    print(f"[Traffic Router] EnsembleEngine init failed: {_ens_err}")
    _ensemble = None

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Traffic Analysis"])

# ── InferenceEngine (optional — graceful if models not found) ─────────────────
try:
    from app.services.inference_engine import InferenceEngine
    _inference_engine = InferenceEngine()
except Exception as _ie_err:
    print(f"[Traffic Router] InferenceEngine init failed: {_ie_err}")
    _inference_engine = None


def generate_mock_data():
    """Generate mock traffic detection data for fallback + heuristic boxes."""
    import random
    count = random.randint(3, 12)
    density = "high" if count > 15 else "medium" if count > 7 else "low"

    boxes = []
    for _ in range(count):
        x = random.uniform(0.1, 0.8)
        y = random.uniform(0.1, 0.8)
        boxes.append([x, y, 0.1, 0.08, round(random.uniform(0.7, 0.95), 2), random.randint(0, 4)])

    violations = [[random.uniform(0.2, 0.7), random.uniform(0.2, 0.7), 0.12, 0.1, 0.85, 5]] if random.random() > 0.5 else []

    rec = {
        "high":   "Heavy traffic. Redirect to off-street parking.",
        "medium": "Traffic building. Monitor entrance.",
        "low":    "Traffic smooth. No action required.",
    }[density]

    return {
        "vehicle_count":    count,
        "density_level":    density,
        "recommendation":   rec,
        "boxes":            boxes,
        "violations":       violations,
        # LPR fields — always present
        "plate_number":     "UNREADABLE",
        "plate_confidence": 0.0,
        "last_plate":       "UNREADABLE",
        "summary":          f"Simulasi: {count} kendaraan terdeteksi (Mock AI)",
    }


def get_detection_result(frame=None, camera_id="CCTV"):
    """
    Priority: EnsembleEngine -> InferenceEngine fallback -> Heuristic Mock.
    """
    if _ensemble is not None and frame is not None:
        try:
            res = _ensemble.analyze_frame(frame, camera_id=camera_id)
            # If real model found nothing, but we are in dev, use mock fallback
            if res.get("vehicle_count") == 0 and os.getenv("NODE_ENV") != "production":
                 mock = generate_mock_data()
                 mock["source"] = "mock_fallback"
                 return mock
            return res
        except Exception as e:
            print(f"[Traffic] Ensemble failed: {e}")

    if _inference_engine is not None and frame is not None:
        try:
            vehicles = _inference_engine.detect_vehicles(frame)
            slots = _inference_engine.check_parking_slots(frame)
            # Normalize ONNX output (assuming 640x640 model input)
            filtered = [[float(x)/640, float(y)/640, float(w)/640, float(h)/640, float(conf), int(cls)] 
                        for (x,y,w,h,conf,cls) in (vehicles or []) if float(conf) >= 0.40]
            violations = [[float(x)/640, float(y)/640, float(w)/640, float(h)/640, float(conf), int(cls)] 
                          for (x,y,w,h,conf,cls) in (slots or []) if int(cls) == 5 and float(conf) >= 0.40]
            count = len(filtered)
            density = "high" if count > 15 else "medium" if count > 7 else "low"
            return {
                "vehicle_count": count, "density_level": density, "recommendation": "Dideteksi oleh InferenceEngine",
                "boxes": filtered, "violations": violations, "source": "onnx",
            }
        except Exception: pass

    # Fallback — mock with heuristic boxes
    mock = generate_mock_data()
    mock["source"] = "mock_heuristic"
    return mock


@router.get("/traffic/stream")
async def stream_traffic_ai(url: str):
    """Start AI processing on a stream and return real-time results via SSE."""
    stream_processor.start(url)

    async def event_generator():
        last_sync = 0
        while True:
            if not stream_processor.is_running:
                break

            data = dict(stream_processor.latest_result)
            data.setdefault("boxes", [])
            data.setdefault("violations", [])
            yield f"data: {json.dumps(data)}\n\n"

            # B3: Periodically sync to DB (every 10 seconds or if violation found)
            now_time = asyncio.get_event_loop().time()
            has_violation = len(data.get("violations", [])) > 0
            if (now_time - last_sync > 10) or has_violation:
                try:
                    import requests as req
                    from datetime import datetime
                    backend_url = os.getenv("BACKEND_URL", "http://localhost:8000")
                    
                    # Convert AI violations [x,y,w,h,conf,cls] to Backend format
                    formatted_violations = []
                    for v in data.get("violations", []):
                        formatted_violations.append({
                            "type": "illegal_parking",
                            "zone": "STREAM_ZONE",
                            "confidence": float(v[4]) if len(v) > 4 else 0.8
                        })

                    req.post(f"{backend_url}/api/ingest/traffic", json={
                        "vehicle_count": data.get("vehicle_count", 0),
                        "density_level": data.get("density_level", "low"),
                        "camera_id": "STREAM_AI",
                        "violations": formatted_violations,
                        "timestamp": datetime.now().isoformat()
                    }, timeout=1)
                    last_sync = now_time
                except Exception: pass

            await asyncio.sleep(1)

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.post("/traffic/analyze")
async def analyze_image(image: UploadFile = File(...)):
    """
    Satu frame JPEG/PNG → deteksi → return result & persist ke backend.
    Digunakan oleh LiveCamera.jsx, camera_worker.py, dan video processor.
    """
    try:
        contents = await image.read()
        nparr = np.frombuffer(contents, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if frame is None:
            return JSONResponse(status_code=400, content={"success": False, "error": "Invalid image format"})

        # Run multi-model ensemble analysis
        result = get_detection_result(frame)

        # Sync result to backend for analytics history
        try:
            import requests as req
            from datetime import datetime
            backend_url = os.getenv("BACKEND_URL", "http://localhost:8000")
            
            # Format according to backend ingestion schema
            # Convert AI violations [x,y,w,h,conf,cls] to Backend format
            formatted_violations = []
            for v in result.get("violations", []):
                formatted_violations.append({
                    "type": "illegal_parking",
                    "zone": "UPLOAD_ZONE",
                    "confidence": float(v[4]) if len(v) > 4 else 0.8
                })

            ingest_payload = {
                "vehicle_count": result.get("vehicle_count", 0),
                "density_level": result.get("density_level", "low"),
                "camera_id": "UPLOAD_ANALYSIS",
                "violations": formatted_violations,
                "timestamp": datetime.now().isoformat()
            }
            req.post(f"{backend_url}/api/ingest/traffic", json=ingest_payload, timeout=2)
        except Exception as e:
            print(f"[Traffic Sync] Failed: {e}")

        return {"success": True, "data": result}
    except Exception as e:
        return JSONResponse(status_code=500, content={"success": False, "error": str(e)})

@router.get("/traffic/resolve")
async def resolve_stream_url(url: str):
    """Helper to resolve YouTube URLs to direct m3u8 for the frontend player."""
    resolved = stream_processor._get_direct_url(url)
    return {"resolved_url": resolved}
