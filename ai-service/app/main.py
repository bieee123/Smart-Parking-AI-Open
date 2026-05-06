"""Smart Parking AI Microservice — FastAPI Application."""
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import PORT, HOST, CORS_ORIGINS
from app.routers import lpr, vehicle, predict, health, traffic, video

# ── Logging ───────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
)

logger = logging.getLogger(__name__)

# ── App Factory ───────────────────────────────────────────────
app = FastAPI(
    title="Smart Parking AI Service",
    description="AI microservice for License Plate Recognition, Vehicle Classification, and Parking Demand Prediction.",
    version="1.0.0",
)

# ── CORS ──────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────
app.include_router(lpr.router, prefix="/ai")
app.include_router(vehicle.router, prefix="/ai")
app.include_router(predict.router, prefix="/ai")
app.include_router(health.router, prefix="/ai")
app.include_router(traffic.router, prefix="/ai")
app.include_router(video.router, prefix="/ai")


# ── Root endpoint ─────────────────────────────────────────────
@app.get("/", tags=["Root"])
async def root():
    return {
        "service": "Smart Parking AI",
        "version": "1.0.0",
        "endpoints": {
            "lpr": "POST /ai/lpr/recognize",
            "vehicle": "POST /ai/vehicle/classify",
            "demand": "POST /ai/predict/demand",
            "traffic": "POST /ai/traffic/analyze",
            "health": "GET /ai/health",
        },
    }


# ── Startup event ─────────────────────────────────────────────
@app.on_event("startup")
async def startup_event():
    logger.info("=" * 60)
    logger.info("🧠 Smart Parking AI Service starting")
    logger.info("📡 Listening on http://%s:%d", HOST, PORT)
    logger.info("🔗 CORS origins: %s", CORS_ORIGINS)
    logger.info("=" * 60)


# ── Entry point ───────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=HOST, port=PORT, reload=True)
