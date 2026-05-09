"""Smart Parking AI Microservice — FastAPI Application v2.0."""
import logging
import threading

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import PORT, HOST, CORS_ORIGINS

logger = logging.getLogger(__name__)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
)

# ── App Factory ───────────────────────────────────────────────────────────────
app = FastAPI(
    title="Smart Parking AI Service",
    description=(
        "Production-grade AI microservice for License Plate Recognition, "
        "Vehicle Classification, Parking Slot Intelligence, and Real-Time Analytics."
    ),
    version="2.0.0",
)

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Observability Middleware ───────────────────────────────────────────────────
import os as _os
from app.middleware.request_logger import RequestLoggingMiddleware
from app.middleware.rate_limiter import RateLimiterMiddleware

app.add_middleware(RequestLoggingMiddleware)
app.add_middleware(
    RateLimiterMiddleware,
    enabled=_os.getenv("RATE_LIMIT_ENABLED", "false").lower() == "true",
)

# ── Routers ───────────────────────────────────────────────────────────────────
from app.routers import lpr, vehicle, predict, health, traffic, video
from app.routers import slots       # Phase 3: Parking Intelligence
from app.routers import cameras     # Phase 4: Multi-Camera Scalability

app.include_router(lpr.router,     prefix="/ai")
app.include_router(vehicle.router, prefix="/ai")
app.include_router(predict.router, prefix="/ai")
app.include_router(health.router,  prefix="/ai")
app.include_router(traffic.router, prefix="/ai")
app.include_router(video.router,   prefix="/ai")
app.include_router(slots.router,   prefix="/ai")    # Phase 3
app.include_router(cameras.router, prefix="/ai")    # Phase 4


# ── Root endpoint ─────────────────────────────────────────────────────────────
@app.get("/", tags=["Root"])
async def root():
    return {
        "service": "Smart Parking AI",
        "version": "2.0.0",
        "endpoints": {
            "lpr":            "POST /ai/lpr/recognize",
            "lpr_all":        "POST /ai/lpr/recognize-all",
            "vehicle":        "POST /ai/vehicle/classify",
            "demand":         "POST /ai/predict/demand",
            "traffic":        "POST /ai/traffic/analyze",
            "stream":         "GET  /ai/traffic/stream",
            "video":          "POST /ai/traffic/upload",
            "health":         "GET  /ai/health",
            "slots":          "GET  /ai/slots/occupancy",
            "slots_define":   "POST /ai/slots/define",
            "slots_bootstrap":"POST /ai/slots/bootstrap",
            "slots_analyze":  "POST /ai/slots/analyze-frame",
            "cameras":        "GET  /ai/cameras",
            "cameras_add":    "POST /ai/cameras/add",
            "cameras_stream": "GET  /ai/cameras/{id}/stream",
        },
    }


# ── Startup ───────────────────────────────────────────────────────────────────
@app.on_event("startup")
async def startup_event():
    logger.info("=" * 60)
    logger.info("🧠 Smart Parking AI Service v2.0 starting")
    logger.info("📡 Listening on http://%s:%d", HOST, PORT)
    logger.info("🔗 CORS origins: %s", CORS_ORIGINS)
    logger.info("=" * 60)

    # ── C6: Pre-warm EasyOCR in background thread ──────────────────────────
    def _prewarm_ocr():
        try:
            from app.services.inference_engine import inference_engine
            logger.info("[Startup] Pre-warming EasyOCR reader...")
            inference_engine.prewarm_ocr()
            logger.info("[Startup] ✅ EasyOCR ready.")
        except Exception as e:
            logger.warning("[Startup] OCR pre-warm failed (non-fatal): %s", e)

    threading.Thread(target=_prewarm_ocr, daemon=True, name="ocr-prewarm").start()

    # ── Phase 3: Bootstrap default parking zones A, B, C ──────────────────
    def _bootstrap_slots():
        try:
            from app.services.slot_manager import slot_manager
            if slot_manager.slot_count == 0:
                logger.info("[Startup] Bootstrapping default parking zones A/B/C...")
                slot_manager.bootstrap_default_zones()
                logger.info(
                    "[Startup] ✅ %d parking slots ready (Zones A/B/C).",
                    slot_manager.slot_count,
                )
        except Exception as e:
            logger.warning("[Startup] Slot bootstrap failed (non-fatal): %s", e)

    threading.Thread(target=_bootstrap_slots, daemon=True, name="slot-bootstrap").start()

    # ── Model path diagnostics ─────────────────────────────────────────────
    try:
        import os
        from app.config import (
            VEHICLE_MODEL_PATH, LPR_MODEL_PATH,
            ILLEGAL_MODEL_PATH, CROWD_MODEL_PATH,
        )
        for name, path in [
            ("Vehicle", VEHICLE_MODEL_PATH),
            ("LPR",     LPR_MODEL_PATH),
            ("Illegal", ILLEGAL_MODEL_PATH),
            ("Crowd",   CROWD_MODEL_PATH),
        ]:
            status = "✅" if os.path.exists(path) else "❌ MISSING"
            logger.info("[Startup] %s model: %s %s", name, status, os.path.basename(path))
    except Exception as e:
        logger.warning("[Startup] Model path check failed: %s", e)


# ── Shutdown ───────────────────────────────────────────────────────────────────
@app.on_event("shutdown")
async def shutdown_event():
    logger.info("[Shutdown] Stopping AI service gracefully...")
    try:
        from app.services.stream_processor import stream_processor
        stream_processor.stop()
    except Exception:
        pass
    try:
        from app.services.camera_worker_pool import camera_pool
        camera_pool.stop_all()
    except Exception:
        pass
    try:
        from app.services.ocr_worker import ocr_worker
        ocr_worker.shutdown()
    except Exception:
        pass
    logger.info("[Shutdown] ✅ Shutdown complete.")


# ── Entry point ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=HOST, port=PORT, reload=True)
