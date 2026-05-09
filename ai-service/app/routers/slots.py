"""
slots.py — Parking Slot Configuration & Occupancy API.

Endpoints:
  POST /ai/slots/define         — Define or update a single slot polygon
  POST /ai/slots/zone           — Bulk-load a zone (A, B, C)
  GET  /ai/slots/occupancy      — Current occupancy summary
  GET  /ai/slots/all            — All slots with status
  GET  /ai/slots/{slot_id}      — Single slot detail
  DELETE /ai/slots/{slot_id}    — Remove a slot
  POST /ai/slots/bootstrap      — Load default Zone A/B/C layout
  POST /ai/slots/analyze-frame  — Analyze occupancy from uploaded frame
"""
import logging
import numpy as np
import cv2

from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional

from app.services.slot_manager import slot_manager

try:
    from app.services.parking_analyzer import parking_analyzer as _parking_analyzer
    _ANALYZER_AVAILABLE = True
except Exception:
    _parking_analyzer = None
    _ANALYZER_AVAILABLE = False

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/slots", tags=["Parking Slot Intelligence"])


# ── Pydantic Models ────────────────────────────────────────────────────────────

class SlotDefinition(BaseModel):
    slot_id: str
    polygon: list               # [[x, y], [x, y], ...] normalized 0.0-1.0
    zone: str = "DEFAULT"
    vehicle_type: str = "car"   # car | motorbike | truck


class ZoneConfig(BaseModel):
    zone_id: str
    slots: list                 # list of {slot_id, polygon, vehicle_type}


# ── Routes ─────────────────────────────────────────────────────────────────────

@router.post("/define")
async def define_slot(body: SlotDefinition):
    """Define or update a single parking slot with its polygon coordinates."""
    try:
        _validate_polygon(body.polygon)
        slot_manager.define_slot(
            slot_id=body.slot_id,
            polygon=body.polygon,
            zone=body.zone,
            vehicle_type=body.vehicle_type,
        )
        return {
            "success": True,
            "message": f"Slot '{body.slot_id}' defined in zone '{body.zone}'.",
            "slot": slot_manager.get_slot(body.slot_id),
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error("[Slots] define_slot error: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/zone")
async def load_zone(body: ZoneConfig):
    """Bulk-load all slots for a zone."""
    try:
        for slot in body.slots:
            _validate_polygon(slot.get("polygon", []))

        slot_manager.load_zone(body.zone_id, body.slots)
        summary = slot_manager.occupancy_summary()
        return {
            "success": True,
            "message": f"Zone '{body.zone_id}' loaded with {len(body.slots)} slots.",
            "summary": summary,
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error("[Slots] load_zone error: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/occupancy")
async def get_occupancy():
    """Current parking occupancy summary for dashboard."""
    return {
        "success": True,
        "data": slot_manager.occupancy_summary(),
    }


@router.get("/all")
async def get_all_slots():
    """Return all configured slots with their current occupancy status."""
    return {
        "success": True,
        "data": {
            "slots": slot_manager.all_slots(),
            "summary": slot_manager.occupancy_summary(),
        }
    }


@router.get("/{slot_id}")
async def get_slot(slot_id: str):
    """Get details for a specific slot."""
    slot = slot_manager.get_slot(slot_id)
    if not slot:
        raise HTTPException(status_code=404, detail=f"Slot '{slot_id}' not found.")
    return {"success": True, "data": slot}


@router.delete("/{slot_id}")
async def delete_slot(slot_id: str):
    """Remove a parking slot definition."""
    if not slot_manager.get_slot(slot_id):
        raise HTTPException(status_code=404, detail=f"Slot '{slot_id}' not found.")
    slot_manager.remove_slot(slot_id)
    return {"success": True, "message": f"Slot '{slot_id}' removed."}


@router.post("/bootstrap")
async def bootstrap_default_zones(
    zones: Optional[list] = None
):
    """
    Bootstrap default Zone A, B, C layout.
    Loads 48 slots (16 per zone: 8 left + 8 right) with approximate polygons.
    Use this for demo/testing — calibrate via /define for production.
    """
    slot_manager.clear()
    slot_manager.bootstrap_default_zones()
    return {
        "success": True,
        "message": f"Default layout bootstrapped: {slot_manager.slot_count} slots in Zones A, B, C.",
        "summary": slot_manager.occupancy_summary(),
    }


@router.post("/analyze-frame")
async def analyze_frame_occupancy(image: UploadFile = File(...)):
    """
    Upload a parking lot image (top-view preferred) and get real-time
    slot occupancy based on configured polygon slots.

    Returns:
      - Per-slot occupancy
      - Overall summary (total/occupied/available)
      - Vehicle detections with slot associations
    """
    if slot_manager.slot_count == 0:
        return JSONResponse(
            status_code=400,
            content={
                "success": False,
                "error": "No slots configured. Call POST /ai/slots/bootstrap first.",
            },
        )

    try:
        contents = await image.read()
        nparr = np.frombuffer(contents, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if frame is None:
            raise HTTPException(status_code=400, detail="Invalid image format.")

        # Run vehicle detection
        from app.services.inference_engine import inference_engine
        vehicles = inference_engine.detect_vehicles(frame)
        crowd    = inference_engine.detect_crowd(frame)
        all_dets = (vehicles or []) + (crowd or [])

        # Associate with slots
        occupancy_map = slot_manager.associate(all_dets)
        summary       = slot_manager.occupancy_summary()

        # Sync occupied slots to backend
        _sync_occupancy_to_backend(occupancy_map)

        return {
            "success": True,
            "data": {
                "slots":           occupancy_map,
                "summary":         summary,
                "vehicle_count":   len(all_dets),
                "detection_count": len(all_dets),
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error("[Slots] analyze_frame_occupancy error: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ── Helpers ───────────────────────────────────────────────────────────────────

def _validate_polygon(polygon: list):
    """Validate polygon: must be a list of [x, y] pairs, all in 0.0-1.0 range."""
    if not polygon or len(polygon) < 3:
        raise ValueError("Polygon must have at least 3 points.")
    for pt in polygon:
        if not (isinstance(pt, (list, tuple)) and len(pt) == 2):
            raise ValueError(f"Each polygon point must be [x, y]. Got: {pt}")
        x, y = float(pt[0]), float(pt[1])
        if not (0.0 <= x <= 1.0 and 0.0 <= y <= 1.0):
            raise ValueError(
                f"Polygon coordinates must be normalized 0.0-1.0. Got: [{x}, {y}]"
            )


def _sync_occupancy_to_backend(occupancy_map: dict):
    """Fire-and-forget occupancy sync to backend."""
    try:
        import requests
        from app.config import BACKEND_URL

        slots_payload = [
            {
                "slot_number":   slot_id,
                "is_occupied":   data.get("is_occupied", False),
                "license_plate": data.get("license_plate", "UNKNOWN"),
                "vehicle_type":  data.get("occupant_type", "car"),
            }
            for slot_id, data in occupancy_map.items()
        ]
        requests.post(
            f"{BACKEND_URL}/api/ingest/occupancy",
            json={"slots": slots_payload},
            timeout=1.5,
        )
    except Exception:
        pass


@router.post("/spatial-analyze")
async def spatial_analyze(
    image:     UploadFile = File(...),
    camera_id: str = "DEFAULT",
    view_hint: str = "auto",    # "top_view" | "side_view" | "auto"
):
    """
    Full spatial parking intelligence for one frame.

    Returns:
      - view_type (auto-detected or overridden)
      - heatmap (10×10 density grid)
      - hotspots (high-density zones)
      - entry_exit (vehicle counter for side-view)
      - density_zones (left/center/right for top-view)
      - slot occupancy (if slots configured)
    """
    try:
        contents = await image.read()
        nparr    = np.frombuffer(contents, np.uint8)
        frame    = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if frame is None:
            raise HTTPException(status_code=400, detail="Invalid image format.")

        # Vehicle detection
        from app.services.inference_engine import inference_engine
        vehicles = inference_engine.detect_vehicles(frame)
        crowd    = inference_engine.detect_crowd(frame)
        all_dets = (vehicles or []) + (crowd or [])

        # Spatial analysis
        spatial = {}
        if _ANALYZER_AVAILABLE and _parking_analyzer:
            hint = None if view_hint == "auto" else view_hint
            spatial = _parking_analyzer.analyze(
                frame, all_dets, camera_id=camera_id, view_hint=hint
            )

        # Slot occupancy
        occupancy_map  = {}
        occ_summary    = {}
        if slot_manager.slot_count > 0:
            occupancy_map = slot_manager.associate(all_dets)
            occ_summary   = slot_manager.occupancy_summary()
            _sync_occupancy_to_backend(occupancy_map)

        return {
            "success": True,
            "data": {
                "vehicle_count":   len(all_dets),
                "spatial":         spatial,
                "slots":           occupancy_map,
                "occupancy":       occ_summary,
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error("[Slots] spatial_analyze error: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

