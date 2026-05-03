"""Parking slot CRUD routes with Redis caching."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.models import ParkingSlot, ParkingLog
from app.middleware.auth import get_current_user, User
from app.schemas.schemas import (
    SlotCreate,
    SlotUpdate,
    SlotResponse,
    SuccessResponse,
    ErrorResponse,
)
from app.utils import cache as cache_util

router = APIRouter(prefix="/slots", tags=["Parking Slots"])


@router.get(
    "",
    response_model=SuccessResponse,
    summary="List all parking slots",
    description="Return every parking slot. Result is cached for 10 s.",
)
def list_slots(db: Session = Depends(get_db)):
    # Try cache first
    cached = cache_util.cache_get(cache_util.SLOTS_ALL_KEY)
    if cached is not None:
        return SuccessResponse(data=cached)

    rows = db.query(ParkingSlot).order_by(ParkingSlot.floor, ParkingSlot.zone, ParkingSlot.slot_number).all()
    data = [SlotResponse.model_validate(s).model_dump() for s in rows]

    cache_util.cache_set(cache_util.SLOTS_ALL_KEY, data, ttl=cache_util.CACHE_TTL_SHORT)
    return SuccessResponse(data=data)


@router.get(
    "/{slot_id}",
    response_model=SuccessResponse,
    summary="Get slot by ID",
    description="Return a single parking slot detail. Cached for 10 s.",
    responses={404: {"model": ErrorResponse, "description": "Slot not found"}},
)
def get_slot(slot_id: int, db: Session = Depends(get_db)):
    cached = cache_util.cache_get(cache_util.slot_by_id_key(slot_id))
    if cached is not None:
        return SuccessResponse(data=cached)

    slot = db.query(ParkingSlot).filter(ParkingSlot.id == slot_id).first()
    if slot is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"success": False, "message": "Slot not found", "error_code": "SLOT_NOT_FOUND"},
        )

    data = SlotResponse.model_validate(slot).model_dump()
    cache_util.cache_set(cache_util.slot_by_id_key(slot_id), data, ttl=cache_util.CACHE_TTL_SHORT)
    return SuccessResponse(data=data)


@router.post(
    "",
    response_model=SuccessResponse,
    summary="Create a parking slot",
    description="Add a new parking slot. Invalidates the slot-list cache.",
    responses={409: {"model": ErrorResponse, "description": "Slot number already exists"}},
)
def create_slot(payload: SlotCreate, db: Session = Depends(get_db), _user: User = Depends(get_current_user)):
    existing = db.query(ParkingSlot).filter(ParkingSlot.slot_number == payload.slot_number).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"success": False, "message": "Slot number already exists", "error_code": "DUPLICATE_SLOT"},
        )

    slot = ParkingSlot(
        slot_number=payload.slot_number,
        floor=payload.floor,
        zone=payload.zone,
        status=payload.status,
        slot_type=payload.slot_type,
    )
    db.add(slot)
    db.commit()
    db.refresh(slot)

    # Invalidate caches
    cache_util.cache_delete(cache_util.SLOTS_ALL_KEY)

    return SuccessResponse(data=SlotResponse.model_validate(slot).model_dump())


@router.put(
    "/{slot_id}",
    response_model=SuccessResponse,
    summary="Update a parking slot",
    description="Patch fields of an existing slot. Invalidates caches.",
    responses={
        404: {"model": ErrorResponse, "description": "Slot not found"},
        409: {"model": ErrorResponse, "description": "Slot number conflict"},
    },
)
def update_slot(
    slot_id: int,
    payload: SlotUpdate,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    slot = db.query(ParkingSlot).filter(ParkingSlot.id == slot_id).first()
    if slot is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"success": False, "message": "Slot not found", "error_code": "SLOT_NOT_FOUND"},
        )

    # Validate slot_number uniqueness if changing
    if payload.slot_number and payload.slot_number != slot.slot_number:
        conflict = db.query(ParkingSlot).filter(
            ParkingSlot.slot_number == payload.slot_number,
            ParkingSlot.id != slot_id,
        ).first()
        if conflict:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={"success": False, "message": "Slot number already exists", "error_code": "DUPLICATE_SLOT"},
            )
        slot.slot_number = payload.slot_number

    if payload.floor is not None:
        slot.floor = payload.floor
    if payload.zone is not None:
        slot.zone = payload.zone
    if payload.status is not None:
        slot.status = payload.status
    if payload.slot_type is not None:
        slot.slot_type = payload.slot_type

    db.commit()
    db.refresh(slot)

    # Invalidate caches
    cache_util.cache_delete(cache_util.SLOTS_ALL_KEY)
    cache_util.cache_delete(cache_util.slot_by_id_key(slot_id))

    return SuccessResponse(data=SlotResponse.model_validate(slot).model_dump())


@router.delete(
    "/{slot_id}",
    response_model=SuccessResponse,
    summary="Delete a parking slot",
    description="Remove a slot. Fails if referenced by logs.",
    responses={
        404: {"model": ErrorResponse, "description": "Slot not found"},
        409: {"model": ErrorResponse, "description": "Slot referenced by logs"},
    },
)
def delete_slot(slot_id: int, db: Session = Depends(get_db), _user: User = Depends(get_current_user)):
    slot = db.query(ParkingSlot).filter(ParkingSlot.id == slot_id).first()
    if slot is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"success": False, "message": "Slot not found", "error_code": "SLOT_NOT_FOUND"},
        )

    # Check FK — cannot delete if referenced by logs
    log_count = db.query(ParkingLog).filter(ParkingLog.slot_id == slot_id).count()
    if log_count > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "success": False,
                "message": f"Cannot delete slot: referenced by {log_count} log(s)",
                "error_code": "SLOT_IN_USE",
            },
        )

    db.delete(slot)
    db.commit()

    # Invalidate caches
    cache_util.cache_delete(cache_util.SLOTS_ALL_KEY)
    cache_util.cache_delete(cache_util.slot_by_id_key(slot_id))

    return SuccessResponse(data={"message": "Slot deleted successfully"})
