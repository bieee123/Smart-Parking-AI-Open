"""Smart Parking AI System — FastAPI Application Entry Point."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from sqlalchemy.exc import IntegrityError

from app.config.settings import settings
from app.db.database import engine, Base
from app.middleware.error_handler import (
    validation_exception_handler,
    integrity_error_handler,
    generic_exception_handler,
)
from app.routes import auth, slots, logs, dashboard


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: create tables if they don't exist."""
    # Create all tables (idempotent — safe to run every startup)
    Base.metadata.create_all(bind=engine)
    print("✅ Database tables verified/created")
    yield
    # Shutdown: nothing special needed


app = FastAPI(
    title="Smart Parking AI System",
    description=(
        "REST API for the Smart Parking AI System. "
        "Provides authentication, parking slot management, event logging, and dashboard data. "
        "Redis-cached for performance."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# ── CORS ────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.cors_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Exception handlers ─────────────────────────────────────────────
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(IntegrityError, integrity_error_handler)
app.add_exception_handler(Exception, generic_exception_handler)

# ── Register routers ───────────────────────────────────────────────
app.include_router(auth.router, prefix="/api")
app.include_router(slots.router, prefix="/api")
app.include_router(logs.router, prefix="/api")
app.include_router(dashboard.router, prefix="/api")


# ── Root endpoint ──────────────────────────────────────────────────
@app.get("/", tags=["Root"])
def root():
    return {
        "message": "Smart Parking AI System API",
        "version": "1.0.0",
        "docs": "/docs",
    }


@app.get("/api/health", tags=["Health"])
def health():
    return {"status": "ok"}
