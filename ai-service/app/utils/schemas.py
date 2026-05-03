"""Pydantic models for request/response validation."""
from pydantic import BaseModel, Field
from typing import Optional


# ── LPR ──────────────────────────────────────────────────────
class LPRRequest(BaseModel):
    image: str = Field(..., description="Base64-encoded image string or raw bytes as hex")
    format: str = Field("base64", description="Image encoding: 'base64' or 'hex'")


class LPRResponse(BaseModel):
    plate: str
    confidence: float


# ── Vehicle Classification ───────────────────────────────────
class VehicleRequest(BaseModel):
    image: str = Field(..., description="Base64-encoded image string")
    format: str = Field("base64", description="Image encoding: 'base64' or 'hex'")


class VehicleResponse(BaseModel):
    type: str
    confidence: float


# ── Demand Prediction ────────────────────────────────────────
class DemandRequest(BaseModel):
    hour: int = Field(..., ge=0, le=23, description="Current hour of day (0-23)")
    horizon: int = Field(3, ge=1, le=24, description="Hours ahead to predict (1-24)")


class DemandResponse(BaseModel):
    prediction: list[float]
    hours_ahead: int


# ── Health ───────────────────────────────────────────────────
class HealthResponse(BaseModel):
    status: str
    models_loaded: bool
