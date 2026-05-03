"""Dashboard routes — summary & slots map."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.models import ParkingSlot, ParkingLog
from app.schemas.schemas import SuccessResponse
from app.utils import cache as cache_util

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get(
    "/summary",
    response_model=SuccessResponse,
    summary="Dashboard summary",
    description=(
        "Return aggregate counts of slots by status, today's log count, and last update timestamp."
    ),
)
def dashboard_summary(db: Session = Depends(get_db)):
    # Count by status
    status_rows = (
        db.query(ParkingSlot.status, func.count(ParkingSlot.id))
        .group_by(ParkingSlot.status)
        .all()
    )
    status_counts = {"available": 0, "occupied": 0, "reserved": 0, "blocked": 0}
    for st, cnt in status_rows:
        if st in status_counts:
            status_counts[st] = cnt

    total = sum(status_counts.values())

    # Today's logs
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    today_logs = db.query(ParkingLog).filter(ParkingLog.created_at >= today_start).count()

    # Last update — most recent log timestamp
    last_log = db.query(ParkingLog).order_by(ParkingLog.created_at.desc()).first()
    last_update = last_log.created_at if last_log else None

    return SuccessResponse(
        data={
            "total_slots": total,
            "available": status_counts["available"],
            "occupied": status_counts["occupied"],
            "reserved": status_counts["reserved"],
            "blocked": status_counts["blocked"],
            "today_logs": today_logs,
            "last_update": last_update,
        }
    )


@router.get(
    "/slots-map",
    response_model=SuccessResponse,
    summary="Slots map data",
    description="Return all slots with status & metadata for map visualization.",
)
def slots_map(db: Session = Depends(get_db)):
    slots = db.query(ParkingSlot).order_by(ParkingSlot.floor, ParkingSlot.zone, ParkingSlot.slot_number).all()
    data = [
        {
            "id": s.id,
            "slot_number": s.slot_number,
            "floor": s.floor,
            "zone": s.zone,
            "status": s.status,
            "slot_type": s.slot_type,
            "last_update": s.last_update,
        }
        for s in slots
    ]
    return SuccessResponse(data=data)
