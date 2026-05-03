from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


# ── Generic response schemas ───────────────────────────────────────
class SuccessResponse(BaseModel):
    success: bool = True
    data: dict | list | None = None


class ErrorResponse(BaseModel):
    success: bool = False
    message: str
    error_code: str


# ── Auth schemas ───────────────────────────────────────────────────
class LoginRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=50, examples=["admin"])
    password: str = Field(..., min_length=4, max_length=128, examples=["admin123"])


class LoginResponse(BaseModel):
    success: bool = True
    data: dict


class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    role: str
    is_active: bool
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ── Parking Slot schemas ───────────────────────────────────────────
class SlotCreate(BaseModel):
    slot_number: str = Field(..., min_length=1, max_length=10, examples=["A-001"])
    floor: int = Field(default=1, ge=1, le=99)
    zone: str = Field(default="A", max_length=5)
    status: str = Field(default="available", pattern="^(available|occupied|reserved|blocked)$")
    slot_type: str = Field(default="regular", pattern="^(regular|disabled|VIP|EV)$")


class SlotUpdate(BaseModel):
    slot_number: Optional[str] = Field(None, min_length=1, max_length=10)
    floor: Optional[int] = Field(None, ge=1, le=99)
    zone: Optional[str] = Field(None, max_length=5)
    status: Optional[str] = Field(None, pattern="^(available|occupied|reserved|blocked)$")
    slot_type: Optional[str] = Field(None, pattern="^(regular|disabled|VIP|EV)$")


class SlotResponse(BaseModel):
    id: int
    slot_number: str
    floor: int
    zone: str
    status: str
    slot_type: str
    last_update: Optional[datetime] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ── Parking Log schemas ────────────────────────────────────────────
VALID_EVENTS = {"vehicle_enter", "vehicle_exit", "violation", "manual_update"}


class LogCreate(BaseModel):
    slot_id: int = Field(..., gt=0)
    event: str = Field(..., pattern="^(vehicle_enter|vehicle_exit|violation|manual_update)$")
    license_plate: Optional[str] = Field(None, max_length=20)
    image_url: Optional[str] = None


class LogResponse(BaseModel):
    id: int
    slot_id: int
    event: str
    license_plate: Optional[str] = None
    image_url: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class LogListResponse(BaseModel):
    success: bool = True
    data: dict  # {logs: [...], total, page, page_size}


# ── Dashboard schemas ──────────────────────────────────────────────
class DashboardSummary(BaseModel):
    total_slots: int
    available: int
    occupied: int
    reserved: int
    blocked: int
    today_logs: int
    last_update: Optional[datetime] = None


class SlotMapEntry(BaseModel):
    id: int
    slot_number: str
    floor: int
    zone: str
    status: str
    slot_type: str
    last_update: Optional[datetime] = None
