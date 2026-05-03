from fastapi.responses import JSONResponse, StreamingResponse
import logging
import asyncio
import json

from app.services.traffic_engine import traffic_analyzer
from app.services.stream_processor import stream_processor

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Traffic Analysis"])

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
