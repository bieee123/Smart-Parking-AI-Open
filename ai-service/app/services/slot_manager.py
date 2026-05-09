"""
SlotManager — Polygon-Based Parking Slot Occupancy Intelligence.

Replaces the fake np.random.randint() slot assignment with real
spatial reasoning: associates detected vehicle bounding boxes
with pre-configured parking slot polygons.

Features:
  - Configurable polygon slots (normalized 0.0-1.0 coordinates)
  - Point-in-polygon vehicle-to-slot association
  - Persistent occupancy state with timestamp tracking
  - Top-view, side-view, and angled parking support
  - Zone grouping (e.g., Zone A, Zone B, Zone C)
  - Thread-safe updates

Dependencies:
  pip install shapely  (optional, for accurate polygon math)
  Falls back to bounding-box centroid check if shapely unavailable.
"""

import logging
import time
import threading
from typing import Optional
from collections import defaultdict

logger = logging.getLogger(__name__)

try:
    from shapely.geometry import Point, Polygon as ShapelyPolygon
    _SHAPELY_AVAILABLE = True
except ImportError:
    _SHAPELY_AVAILABLE = False
    logger.warning(
        "[SlotManager] shapely not installed — using bbox centroid fallback. "
        "Run: pip install shapely"
    )


class ParkingSlot:
    """A single parking bay defined by a polygon in normalized coordinates."""

    def __init__(
        self,
        slot_id: str,
        polygon: list,          # [[x, y], [x, y], ...] normalized 0.0-1.0
        zone: str = "DEFAULT",
        vehicle_type: str = "car",   # Expected vehicle type: car/motorbike/truck
    ):
        self.slot_id = slot_id
        self.polygon = polygon
        self.zone = zone
        self.vehicle_type = vehicle_type

        # Runtime state
        self.is_occupied = False
        self.occupant_track_id: Optional[int] = None
        self.occupant_plate: Optional[str] = None
        self.occupant_type: Optional[str] = None
        self.occupied_since: Optional[float] = None
        self.last_updated: float = time.time()

        # Build shapely polygon for accurate PiP checks
        if _SHAPELY_AVAILABLE and len(polygon) >= 3:
            self._shape = ShapelyPolygon(polygon)
        else:
            self._shape = None

    def contains_point(self, x: float, y: float) -> bool:
        """Check if point (x, y) is inside this slot's polygon."""
        if self._shape is not None:
            return self._shape.contains(Point(x, y))
        # Fallback: simple bounding-box check
        xs = [p[0] for p in self.polygon]
        ys = [p[1] for p in self.polygon]
        return min(xs) <= x <= max(xs) and min(ys) <= y <= max(ys)

    def mark_occupied(self, track_id=None, plate=None, vtype=None):
        if not self.is_occupied:
            self.occupied_since = time.time()
        self.is_occupied = True
        self.occupant_track_id = track_id
        self.occupant_plate = plate or "UNREADABLE"
        self.occupant_type = vtype
        self.last_updated = time.time()

    def mark_empty(self):
        self.is_occupied = False
        self.occupant_track_id = None
        self.occupant_plate = None
        self.occupant_type = None
        self.occupied_since = None
        self.last_updated = time.time()

    def to_dict(self) -> dict:
        return {
            "slot_id":       self.slot_id,
            "zone":          self.zone,
            "vehicle_type":  self.vehicle_type,
            "is_occupied":   self.is_occupied,
            "track_id":      self.occupant_track_id,
            "license_plate": self.occupant_plate,
            "occupant_type": self.occupant_type,
            "occupied_since": self.occupied_since,
            "polygon":       self.polygon,
        }


class SlotManager:
    """
    Thread-safe parking slot manager.

    Usage:
        1. Define slots via define_slot() or load_zone()
        2. Call associate(detections) after every frame analysis
        3. Read occupancy_summary() for dashboard/API
    """

    def __init__(self):
        self.slots: dict[str, ParkingSlot] = {}
        self._lock = threading.Lock()
        logger.info(
            "[SlotManager] Initialized. Shapely=%s",
            "ACTIVE" if _SHAPELY_AVAILABLE else "DISABLED (bbox fallback)"
        )

    # ── Slot Configuration ──────────────────────────────────────────────────────

    def define_slot(
        self,
        slot_id: str,
        polygon: list,
        zone: str = "DEFAULT",
        vehicle_type: str = "car",
    ):
        """Define or update a parking slot."""
        with self._lock:
            self.slots[slot_id] = ParkingSlot(slot_id, polygon, zone, vehicle_type)
            logger.info("[SlotManager] Slot defined: %s (zone=%s)", slot_id, zone)

    def remove_slot(self, slot_id: str):
        with self._lock:
            if slot_id in self.slots:
                del self.slots[slot_id]

    def load_zone(self, zone_id: str, slot_configs: list):
        """
        Bulk-load slots for a zone.
        slot_configs: [{"slot_id": "A01", "polygon": [[...]], "vehicle_type": "car"}, ...]
        """
        for cfg in slot_configs:
            self.define_slot(
                slot_id=cfg["slot_id"],
                polygon=cfg["polygon"],
                zone=zone_id,
                vehicle_type=cfg.get("vehicle_type", "car"),
            )
        logger.info("[SlotManager] Zone %s: %d slots loaded", zone_id, len(slot_configs))

    def clear(self):
        with self._lock:
            self.slots.clear()

    # ── Occupancy Association ───────────────────────────────────────────────────

    def associate(self, detections: list, plate_map: Optional[dict] = None) -> dict:
        """
        Associate vehicle detections with parking slots.

        Args:
            detections: list of [x1_norm, y1_norm, w_norm, h_norm, conf, cls] or with track_id [7th element]
            plate_map:  optional {track_id: plate_number} from LPR pipeline

        Returns:
            dict of {slot_id: ParkingSlot.to_dict()}
        """
        if not self.slots:
            return {}

        with self._lock:
            # Reset all slots to empty first
            occupied_slots = set()

            for det in detections:
                if len(det) < 4:
                    continue
                # Center point of bounding box
                cx = det[0] + det[2] / 2.0
                cy = det[1] + det[3] / 2.0
                track_id = int(det[6]) if len(det) > 6 else None
                cls_id = int(det[5]) if len(det) > 5 else 0
                plate = plate_map.get(track_id) if plate_map and track_id else None

                from app.services.inference_engine import VEHICLE_CLASS_NAMES
                vtype = VEHICLE_CLASS_NAMES.get(cls_id, "unknown")

                for slot in self.slots.values():
                    if slot.slot_id not in occupied_slots and slot.contains_point(cx, cy):
                        slot.mark_occupied(track_id=track_id, plate=plate, vtype=vtype)
                        occupied_slots.add(slot.slot_id)
                        break

            # Mark unoccupied slots
            for slot_id, slot in self.slots.items():
                if slot_id not in occupied_slots and slot.is_occupied:
                    slot.mark_empty()

            return {sid: s.to_dict() for sid, s in self.slots.items()}

    # ── Occupancy Summary ───────────────────────────────────────────────────────

    def occupancy_summary(self) -> dict:
        """Return aggregated occupancy stats for API/dashboard."""
        with self._lock:
            total = len(self.slots)
            occupied = sum(1 for s in self.slots.values() if s.is_occupied)
            available = total - occupied

            zones: dict[str, dict] = defaultdict(lambda: {"total": 0, "occupied": 0})
            for s in self.slots.values():
                zones[s.zone]["total"] += 1
                if s.is_occupied:
                    zones[s.zone]["occupied"] += 1

            return {
                "total_slots":    total,
                "occupied_slots": occupied,
                "available_slots": available,
                "occupancy_rate": round(occupied / total, 3) if total > 0 else 0.0,
                "zones":          dict(zones),
            }

    def get_slot(self, slot_id: str) -> Optional[dict]:
        with self._lock:
            s = self.slots.get(slot_id)
            return s.to_dict() if s else None

    def all_slots(self) -> list:
        with self._lock:
            return [s.to_dict() for s in self.slots.values()]

    @property
    def slot_count(self) -> int:
        return len(self.slots)

    # ── Default Zone Bootstrap ──────────────────────────────────────────────────

    def bootstrap_default_zones(self):
        """
        Load default Zone A, B, C with 16 slots each based on
        the prototype layout (8 left + 8 right per zone).

        Polygons are approximate normalized coordinates for a
        top-view parking area. Calibrate via admin UI in production.
        """
        import numpy as np

        zones = ["A", "B", "C"]
        for z_idx, zone in enumerate(zones):
            zone_x_offset = z_idx / 3.0

            for side in range(2):  # 0 = left, 1 = right
                x_base = zone_x_offset + (side * 0.15)

                for slot_idx in range(8):
                    slot_id = f"{zone}{(slot_idx * 2 + side + 1):02d}"
                    y_base = slot_idx / 8.0
                    y_top = y_base
                    y_bot = y_base + 0.12

                    x_left = x_base
                    x_right = x_base + 0.12

                    polygon = [
                        [x_left, y_top],
                        [x_right, y_top],
                        [x_right, y_bot],
                        [x_left, y_bot],
                    ]
                    self.define_slot(
                        slot_id=slot_id,
                        polygon=polygon,
                        zone=zone,
                        vehicle_type="car",
                    )

        logger.info(
            "[SlotManager] Default zones A/B/C bootstrapped — %d total slots.",
            self.slot_count,
        )


# Singleton
slot_manager = SlotManager()
