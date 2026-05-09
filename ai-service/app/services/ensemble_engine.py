"""
EnsembleEngine — Production Multi-Model Fusion with Full LPR, Crowd & Slot Intelligence.

V5.1 Changes:
  - C1: Crowd model merged in parallel with vehicle model
  - C2: Multi-plate OCR — ALL detected plates processed
  - Phase 3: SlotManager integrated — per-frame occupancy map in every response
  - Dual-model parallel detection via ThreadPoolExecutor
  - Config-driven thresholds
  - Structured timing logs per stage
  - occupancy_map + occupancy_summary added to response (additive, backward-compatible)
"""

import cv2
import time
import numpy as np
import logging
from concurrent.futures import ThreadPoolExecutor

# Phase 3: Slot Intelligence
try:
    from app.services.slot_manager import slot_manager as _slot_manager
    _SLOTS_AVAILABLE = True
except Exception:
    _slot_manager = None
    _SLOTS_AVAILABLE = False

from app.config import (
    VEHICLE_CONFIDENCE_THRESHOLD,
    NMS_IOU_THRESHOLD,
    ILLEGAL_CONFIDENCE_THRESHOLD,
    OCR_MAX_PLATES_PER_FRAME,
)

logger = logging.getLogger(__name__)

# ── Class Mappings ─────────────────────────────────────────────────────────────
VEHICLE_CLASSES = {0: "car", 1: "threewheel", 2: "bus", 3: "truck", 4: "motorbike", 5: "van"}
ILLEGAL_CLASS_ID = 2


def to_float(v):
    """Safely convert nested list/array/string to float."""
    try:
        if isinstance(v, (list, tuple, np.ndarray)):
            if len(v) == 0:
                return 0.0
            return to_float(v[0])
        return float(v)
    except (TypeError, ValueError, IndexError):
        return 0.0


class EnsembleEngine:
    """
    Multi-model ensemble with:
    - Parallel vehicle + crowd detection
    - Full multi-plate LPR pipeline
    - Lighting-aware mode switching
    """

    def __init__(self, inference_engine):
        self.engine = inference_engine
        # BUG-5 FIX: Persistent thread pool — NOT created per-frame
        self._pool = ThreadPoolExecutor(max_workers=2, thread_name_prefix="ensemble")
        logger.info("[EnsembleEngine] Initialized V5.1. Multi-LPR + Crowd Fusion active. Pool=persistent.")

    # ── Lighting Utils ─────────────────────────────────────────────────────────

    def get_brightness(self, frame: np.ndarray) -> float:
        try:
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            return float(np.mean(gray))
        except Exception:
            return 128.0

    def get_lighting_mode(self, brightness: float) -> str:
        if brightness > 80:
            return "daylight"
        elif brightness < 50:
            return "night"
        return "mixed"

    # ── Main Analysis ──────────────────────────────────────────────────────────

    def analyze_frame(self, frame: np.ndarray, camera_id: str = "CCTV") -> dict:
        try:
            t_start = time.perf_counter()
            brightness = self.get_brightness(frame)
            mode = self.get_lighting_mode(brightness)

            # 1. PARALLEL: Vehicle + Crowd detection (C1: crowd now active)
            raw_vehicles = self._detect_parallel(frame, mode)
            filtered_vehicles = self._filter(raw_vehicles, VEHICLE_CONFIDENCE_THRESHOLD)
            deduped_vehicles = self._nms_merge(filtered_vehicles)

            # 2. Parking slot violations
            raw_slots = self.engine.check_parking_slots(frame)
            filtered_slots = self._filter(raw_slots, ILLEGAL_CONFIDENCE_THRESHOLD)
            violations = [s for s in filtered_slots if len(s) > 5 and int(s[5]) == ILLEGAL_CLASS_ID]

            # 3. Aggregate
            count = len(deduped_vehicles)
            vehicle_types = self._classify_vehicles(deduped_vehicles)
            density, recommendation = self._assess(count)

            # 4. C2 FIX: Multi-Plate LPR — process ALL detected plates
            raw_plates = self.engine.detect_license_plate(frame)
            logger.info("[EnsembleEngine] LPR raw detections: %d", len(raw_plates))

            plates_result = []
            plate_number = "UNREADABLE"
            plate_confidence = 0.0

            if raw_plates:
                # Sort by confidence — process best first, up to OCR_MAX_PLATES_PER_FRAME
                sorted_plates = sorted(raw_plates, key=lambda x: to_float(x[4]), reverse=True)
                for plate_box in sorted_plates[:OCR_MAX_PLATES_PER_FRAME]:
                    ocr = self.engine.read_license_plate_text(frame, plate_box)
                    plates_result.append({
                        "plate_number":     ocr.get("plate_number", "UNREADABLE"),
                        "plate_confidence": ocr.get("plate_confidence", 0.0),
                        "box":              plate_box[:4],   # [x1,y1,w,h]
                    })

                # Primary plate = highest OCR confidence
                readable = [p for p in plates_result if p["plate_number"] != "UNREADABLE"]
                if readable:
                    best = max(readable, key=lambda p: p["plate_confidence"])
                    plate_number = best["plate_number"]
                    plate_confidence = best["plate_confidence"]

                logger.info(
                    "[EnsembleEngine] Multi-LPR: %d plates processed, primary='%s' (%.2f)",
                    len(plates_result), plate_number, plate_confidence,
                )

            # 5. Normalize all bounding boxes to 0.0–1.0
            def norm(box):
                if len(box) < 6:
                    return None
                return [
                    max(0.0, min(to_float(box[0]), 1.0)),
                    max(0.0, min(to_float(box[1]), 1.0)),
                    max(0.0, min(to_float(box[2]), 1.0)),
                    max(0.0, min(to_float(box[3]), 1.0)),
                    to_float(box[4]),
                    int(box[5]),
                ]

            norm_boxes = [nb for nb in (norm(b) for b in deduped_vehicles) if nb]
            norm_violations = [nb for nb in (norm(b) for b in violations) if nb]

            # Append plate boxes with class_id=99 for frontend rendering
            for p in (raw_plates or []):
                nb = norm(p)
                if nb:
                    nb[5] = 99
                    norm_boxes.append(nb)

            # 6. Phase 3: Slot Intelligence — associate detections with parking polygons
            occupancy_map     = {}
            occupancy_summary = {}
            if _SLOTS_AVAILABLE and _slot_manager and _slot_manager.slot_count > 0:
                try:
                    # Build plate map: {track_id → plate_number} from multi-LPR results
                    plate_map = {}
                    for i, pl in enumerate(plates_result):
                        if pl.get("plate_number") not in ("UNREADABLE", None):
                            plate_map[i] = pl["plate_number"]

                    occupancy_map     = _slot_manager.associate(norm_boxes, plate_map=plate_map)
                    occupancy_summary = _slot_manager.occupancy_summary()

                    logger.debug(
                        "[EnsembleEngine] Slot occupancy: %d/%d occupied",
                        occupancy_summary.get("occupied_slots", 0),
                        occupancy_summary.get("total_slots", 0),
                    )
                except Exception as _se:
                    logger.warning("[EnsembleEngine] SlotManager error: %s", _se)

            t_total = (time.perf_counter() - t_start) * 1000
            logger.info(
                "[EnsembleEngine] Frame analyzed in %.0fms | vehicles=%d density=%s mode=%s slots=%s",
                t_total, count, density, mode,
                f"{occupancy_summary.get('occupied_slots', 0)}/{occupancy_summary.get('total_slots', 0)}"
                if occupancy_summary else "no-slots",
            )

            return {
                # Vehicle detection
                "vehicle_count":    count,
                "density_level":    density,
                "recommendation":   recommendation,
                "boxes":            norm_boxes,
                "violations":       norm_violations,
                "vehicle_types":    vehicle_types,
                # Lighting
                "lighting_mode":    mode,
                "brightness":       round(brightness, 1),
                # LPR — single primary plate (backward compatible)
                "plate_number":     plate_number,
                "plate_confidence": plate_confidence,
                "last_plate":       plate_number,           # legacy key
                # C2: Multi-plate array (new, additive)
                "plates":           plates_result,
                # Phase 3: Slot Occupancy (new, additive — won't break frontend)
                "occupancy_map":     occupancy_map,
                "occupancy_summary": occupancy_summary,
                # Meta
                "summary":          self._summary(count, density, mode, camera_id),
                "source":           "ensemble_v5.1",
                "inference_ms":     round(t_total, 1),
            }

        except Exception as e:
            logger.error("[EnsembleEngine] analyze_frame error: %s", e, exc_info=True)
            return self._fallback_result()

    # ── Parallel Detection ─────────────────────────────────────────────────────

    def _detect_parallel(self, frame: np.ndarray, mode: str) -> list:
        """
        C1 FIX: Run vehicle model + crowd model in PARALLEL.
        BUG-5 FIX: Uses persistent self._pool instead of creating a new executor per frame.
        """
        f_vehicle = self._pool.submit(self.engine.detect_vehicles, frame)
        f_crowd   = self._pool.submit(self.engine.detect_crowd, frame)

        try:
            vehicle_dets = f_vehicle.result(timeout=10.0) or []
        except Exception as e:
            logger.warning("[EnsembleEngine] Vehicle detect timeout/error: %s", e)
            vehicle_dets = []
        try:
            crowd_dets = f_crowd.result(timeout=10.0) or []
        except Exception as e:
            logger.warning("[EnsembleEngine] Crowd detect timeout/error: %s", e)
            crowd_dets = []

        logger.debug(
            "[EnsembleEngine] Parallel detect: vehicle=%d crowd=%d",
            len(vehicle_dets), len(crowd_dets),
        )

        # Merge both detection sets, then remove duplicates via NMS
        return vehicle_dets + crowd_dets

    def shutdown(self):
        """Cleanly shut down the persistent thread pool."""
        self._pool.shutdown(wait=False)
        logger.info("[EnsembleEngine] Thread pool shut down.")

    # ── Helpers ────────────────────────────────────────────────────────────────

    def _filter(self, detections: list, threshold: float) -> list:
        result = []
        for d in (detections or []):
            try:
                if isinstance(d, (list, tuple)) and len(d) > 0 and isinstance(d[0], (list, tuple)):
                    d = d[0]
                if len(d) >= 5:
                    conf = to_float(d[4])
                    if conf >= threshold:
                        clean = [to_float(v) for v in d[:5]]
                        clean.append(int(to_float(d[5])) if len(d) > 5 else 0)
                        result.append(clean)
            except Exception:
                continue
        return result

    def _nms_merge(self, detections: list) -> list:
        """Cross-model NMS to remove duplicates after merging vehicle + crowd."""
        if not detections:
            return []
        try:
            return self.engine._nms(detections, iou_threshold=NMS_IOU_THRESHOLD)
        except Exception:
            return sorted(detections, key=lambda d: d[4], reverse=True)

    def _classify_vehicles(self, detections: list) -> dict:
        counts = {v: 0 for v in VEHICLE_CLASSES.values()}
        for d in detections:
            if len(d) > 5:
                label = VEHICLE_CLASSES.get(int(d[5]))
                if label in counts:
                    counts[label] += 1
        return counts

    def _assess(self, count: int) -> tuple:
        if count > 15:
            return "high",   "Heavy traffic. Redirect to off-street parking."
        elif count > 7:
            return "medium", "Traffic building. Monitor entrance."
        return "low",        "Traffic smooth. No action required."

    def _summary(self, count: int, density: str, mode: str, camera_id: str) -> str:
        mode_map = {"daylight": "Siang Hari", "night": "Malam Hari", "mixed": "Transisi"}
        dens_map = {"high": "Padat", "medium": "Sedang", "low": "Lancar"}
        return (
            f"{camera_id}: Kondisi {dens_map.get(density, density).lower()} "
            f"({mode_map.get(mode, mode)}), terdeteksi {count} kendaraan."
        )

    def _fallback_result(self) -> dict:
        return {
            "vehicle_count":    0,
            "density_level":    "low",
            "recommendation":   "AI Engine Error — using fallback.",
            "boxes":            [],
            "violations":       [],
            "vehicle_types":    {},
            "lighting_mode":    "unknown",
            "brightness":       0.0,
            "plate_number":     "UNREADABLE",
            "plate_confidence": 0.0,
            "last_plate":       "UNREADABLE",
            "plates":           [],
            "occupancy_map":    {},
            "occupancy_summary": {},
            "summary":          "AI Engine Error.",
            "source":           "fallback",
            "inference_ms":     0.0,
        }
