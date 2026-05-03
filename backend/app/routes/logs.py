"""Parking log routes — create, list with filters, recent."""

from datetime import date, datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.models import ParkingLog, ParkingSlot
from app.middleware.auth import get_current_user, User
from app.schemas.schemas import (
    LogCreate,
    LogResponse,
    SuccessResponse,
    ErrorResponse,
)
from app.utils import cache as cache_util

router = APIRouter(prefix="/logs", tags=["Parking Logs"])


@router.post(
    "",
    response_model=SuccessResponse,
    summary="Create a parking log entry",
    description=(
        "Record a parking event. Automatically updates the associated slot's status: "
        "`vehicle_enter` → occupied, `vehicle_exit` → available."
    ),
    responses={
        404: {"model": ErrorResponse, "description": "Slot not found"},
        400: {"model": ErrorResponse, "description": "Invalid event for slot state"},
    },
)
def create_log(payload: LogCreate, db: Session = Depends(get_db), _user: User = Depends(get_current_user)):
    # Verify slot exists
    slot = db.query(ParkingSlot).filter(ParkingSlot.id == payload.slot_id).first()
    if slot is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"success": False, "message": "Slot not found", "error_code": "SLOT_NOT_FOUND"},
        )

    # Validate event vs current slot status
    if payload.event == "vehicle_enter" and slot.status == "occupied":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "success": False,
                "message": "Slot is already occupied",
                "error_code": "SLOT_OCCUPIED",
            },
        )
    if payload.event == "vehicle_exit" and slot.status != "occupied":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "success": False,
                "message": "Slot is not occupied — cannot log exit",
                "error_code": "SLOT_NOT_OCCUPIED",
            },
        )

    # Create log
    log_entry = ParkingLog(
        slot_id=payload.slot_id,
        event=payload.event,
        license_plate=payload.license_plate,
        image_url=payload.image_url,
    )
    db.add(log_entry)

    # Auto-update slot status
    if payload.event == "vehicle_enter":
        slot.status = "occupied"
    elif payload.event == "vehicle_exit":
        slot.status = "available"

    db.commit()
    db.refresh(log_entry)

    # Invalidate caches
    cache_util.cache_delete(cache_util.SLOTS_ALL_KEY)
    cache_util.cache_delete(cache_util.slot_by_id_key(payload.slot_id))
    cache_util.cache_delete(cache_util.LOGS_RECENT_KEY)

    return SuccessResponse(data=LogResponse.model_validate(log_entry).model_dump())


@router.get(
    "",
    response_model=SuccessResponse,
    summary="List parking logs with filters",
    description="Supports pagination, date filter, event filter, and slot filter.",
)
def list_logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    date_from: Optional[date] = Query(None, description="Filter logs from this date (YYYY-MM-DD)"),
    date_to: Optional[date] = Query(None, description="Filter logs until this date (YYYY-MM-DD)"),
    event: Optional[str] = Query(None, description="Filter by event type"),
    slot_id: Optional[int] = Query(None, description="Filter by slot ID"),
    db: Session = Depends(get_db),
):
    query = db.query(ParkingLog)

    if date_from:
        query = query.filter(func.date(ParkingLog.created_at) >= date_from)
    if date_to:
        query = query.filter(func.date(ParkingLog.created_at) <= date_to)
    if event:
        query = query.filter(ParkingLog.event == event)
    if slot_id:
        query = query.filter(ParkingLog.slot_id == slot_id)

    total = query.count()
    logs = (
        query.order_by(ParkingLog.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return SuccessResponse(
        data={
            "logs": [LogResponse.model_validate(l).model_dump() for l in logs],
            "total": total,
            "page": page,
            "page_size": page_size,
        }
    )


@router.get(
    "/recent",
    response_model=SuccessResponse,
    summary="Recent logs for dashboard",
    description="Return the last 20 log entries. Cached for 10 s.",
)
def recent_logs(db: Session = Depends(get_db)):
    cached = cache_util.cache_get(cache_util.LOGS_RECENT_KEY)
    if cached is not None:
        return SuccessResponse(data=cached)

    logs = db.query(ParkingLog).order_by(ParkingLog.created_at.desc()).limit(20).all()
    data = {
        "logs": [LogResponse.model_validate(l).model_dump() for l in logs],
        "count": len(logs),
    }

    cache_util.cache_set(cache_util.LOGS_RECENT_KEY, data, ttl=cache_util.CACHE_TTL_SHORT)
    return SuccessResponse(data=data)
