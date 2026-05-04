from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse, StreamingResponse
import os
import cv2
import tempfile
import shutil
import logging
import asyncio
import json

from app.services.traffic_engine import traffic_analyzer
from app.services.stream_processor import stream_processor

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Traffic Analysis"])

@router.post("/traffic/upload")
async def analyze_video_upload(video: UploadFile = File(...)):
    """Process an uploaded video file frame-by-frame and return aggregated AI results."""
    if not video.content_type.startswith("video/"):
        raise HTTPException(status_code=400, detail="File must be a video.")

    # Save to a temporary file
    temp_dir = tempfile.mkdtemp()
    file_path = os.path.join(temp_dir, video.filename)
    
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(video.file, buffer)

        # Open video with OpenCV
        cap = cv2.VideoCapture(file_path)
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        fps = int(cap.get(cv2.CAP_PROP_FPS))
        
        # Analyze every 'step' frames to save time (e.g., every 1 second)
        step = max(1, fps)
        
        results = []
        frame_idx = 0
        
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break
            
            if frame_idx % step == 0:
                # Convert frame to bytes for traffic_analyzer
                _, img_encoded = cv2.imencode('.jpg', frame)
                analysis = traffic_analyzer.analyze_frame(img_encoded.tobytes())
                results.append(analysis)
            
            frame_idx += 1

        cap.release()
        
        # Aggregate results
        if not results:
            return {"success": False, "detail": "No frames processed"}

        total_v = sum(r['vehicle_count'] for r in results)
        avg_v = total_v // len(results)
        
        # Determine average density
        densities = [r['density_level'] for r in results]
        most_common_density = max(set(densities), key=densities.count)

        return {
            "success": True,
            "total_vehicles": total_v,
            "avg_vehicles_per_sec": avg_v,
            "avg_density": most_common_density,
            "frames_processed": len(results),
            "sample_plate": results[0].get("last_plate", "N/A")
        }

    except Exception as e:
        logger.error(f"Video processing failed: {e}")
        return JSONResponse(status_code=500, content={"success": False, "detail": str(e)})
    finally:
        # Cleanup
        shutil.rmtree(temp_dir)

@router.post("/traffic/analyze")
async def analyze_traffic(image: UploadFile = File(...)):
    if not image.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image.")

    try:
        contents = await image.read()
        result = traffic_analyzer.analyze_frame(contents)
        
        return JSONResponse(content={
            "success": True,
            "data": result
        })
    except Exception as exc:
        logger.error(f"Traffic analysis failed: {exc}")
        raise HTTPException(status_code=500, detail="Internal server error during analysis")

@router.get("/traffic/stream")
async def stream_traffic_ai(url: str):
    """Start AI processing on a stream and return real-time results via SSE."""
    stream_processor.start(url)

    async def event_generator():
        while True:
            if not stream_processor.is_running:
                break
            
            # Get latest data from processor
            data = stream_processor.latest_result
            yield f"data: {json.dumps(data)}\n\n"
            
            await asyncio.sleep(1) # Send update every second

    return StreamingResponse(event_generator(), media_type="text/event-stream")

@router.get("/traffic/resolve")
async def resolve_stream_url(url: str):
    """Helper to resolve YouTube URLs to direct m3u8 for the frontend player."""
    resolved = stream_processor._get_direct_url(url)
    return {"resolved_url": resolved}
