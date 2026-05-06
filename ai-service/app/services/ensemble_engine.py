"""
ensemble_engine.py - Multi-Model Ensemble with full LPR pipeline.

V4.0 Changes:
  - Consumes new read_license_plate_text() which returns { plate_number, plate_confidence }
  - plate_number is NEVER null — guaranteed "UNREADABLE" fallback from inference_engine
  - Frontend response always includes: vehicle_type, confidence, bounding_box, plate_number, plate_confidence
  - Classification correction layer called via inference_engine._correct_classification()
  - NMS now applied per-model via inference_engine._nms()
  - Bounding boxes normalized correctly after letterbox fix in InferenceEngine
"""

import cv2
import numpy as np
import logging
import os
from concurrent.futures import ThreadPoolExecutor, as_completed

logger = logging.getLogger(__name__)

# ── Class Mappings ─────────────────────────────────────────────────────────────
VEHICLE_CLASSES     = {0: 'car', 1: 'threewheel', 2: 'bus', 3: 'truck', 4: 'motorbike', 5: 'van'}
ILLEGAL_CLASS_ILLEGAL = 2
CROWD_VEHICLE_CLASSES = {3: 'car', 4: 'van', 5: 'truck', 8: 'bus', 9: 'motor', 2: 'bicycle'}

IOU_THRESHOLD  = 0.45
CONF_THRESHOLD = 0.50   # Increased from 0.20 — stricter filter


def to_float(v):
    """Safely convert nested list/array/string to float."""
    try:
        if isinstance(v, (list, tuple, np.ndarray)):
            if len(v) == 0: return 0.0
            return to_float(v[0])
        return float(v)
    except (TypeError, ValueError, IndexError):
        return 0.0


class EnsembleEngine:
    def __init__(self, inference_engine):
        self.engine = inference_engine
        logger.info("[EnsembleEngine] Initialized V4.0. Full LPR pipeline active.")

    def get_brightness(self, frame: np.ndarray) -> float:
        try:
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            return float(np.mean(gray))
        except Exception:
            return 128.0

    def get_lighting_mode(self, brightness: float) -> str:
        if brightness > 80:   return "daylight"
        elif brightness < 50: return "night"
        return "mixed"

    def analyze_frame(self, frame: np.ndarray, camera_id: str = "CCTV") -> dict:
        try:
            brightness = self.get_brightness(frame)
            mode = self.get_lighting_mode(brightness)

            # 1. Vehicle Detection (NMS + correction applied inside InferenceEngine)
            raw_vehicles = self._detect_by_mode(frame, mode)
            filtered_vehicles = self._filter(raw_vehicles, CONF_THRESHOLD)
            deduped_vehicles  = self._nms_merge(filtered_vehicles)

            # 2. Parking slot violations
            raw_slots       = self.engine.check_parking_slots(frame)
            filtered_slots  = self._filter(raw_slots, CONF_THRESHOLD)
            violations      = [s for s in filtered_slots if len(s) > 5 and int(s[5]) == ILLEGAL_CLASS_ILLEGAL]

            # 3. Aggregation
            count         = len(deduped_vehicles)
            vehicle_types = self._classify_vehicles(deduped_vehicles)
            density, recommendation = self._assess(count)

            # 4. License Plate Recognition (Full Pipeline)
            plate_number     = "UNREADABLE"
            plate_confidence = 0.0

            raw_plates = self.engine.detect_license_plate(frame)
            logger.info("[EnsembleEngine] LPR raw detections: %d", len(raw_plates))

            if raw_plates:
                # Select best plate box by confidence
                best_plate_box = max(raw_plates, key=lambda x: to_float(x[4]))
                logger.info("[EnsembleEngine] Best plate box: %s", best_plate_box)

                # Run full multi-pass OCR pipeline
                ocr_result = self.engine.read_license_plate_text(frame, best_plate_box)
                plate_number     = ocr_result.get("plate_number", "UNREADABLE")
                plate_confidence = ocr_result.get("plate_confidence", 0.0)
                logger.info("[EnsembleEngine] OCR Result: plate='%s' conf=%.3f", plate_number, plate_confidence)

            # 5. Normalize boxes to 0.0–1.0 for frontend
            H_orig, W_orig = frame.shape[:2]

            def norm(box):
                if len(box) < 6:
                    return None
                x1_n = max(0.0, min(to_float(box[0]) / W_orig, 1.0))
                y1_n = max(0.0, min(to_float(box[1]) / H_orig, 1.0))
                w_n  = max(0.0, min(to_float(box[2]) / W_orig, 1.0))
                h_n  = max(0.0, min(to_float(box[3]) / H_orig, 1.0))
                return [x1_n, y1_n, w_n, h_n, to_float(box[4]), int(box[5])]

            norm_boxes      = [nb for nb in (norm(b) for b in deduped_vehicles) if nb]
            norm_violations = [nb for nb in (norm(b) for b in violations) if nb]

            # 6. Append plate boxes to norm_boxes with class_id=99 for UI rendering
            if raw_plates:
                for p in raw_plates:
                    nb = norm(p)
                    if nb:
                        nb[5] = 99  # Plate class marker for frontend
                        norm_boxes.append(nb)

            summary = self.generate_summary(count, density, mode, camera_id)

            return {
                # Vehicle detection
                "vehicle_count":   count,
                "density_level":   density,
                "recommendation":  recommendation,
                "boxes":           norm_boxes,
                "violations":      norm_violations,
                "vehicle_types":   vehicle_types,
                # Lighting
                "lighting_mode":   mode,
                "brightness":      round(brightness, 1),
                # LPR — ALWAYS populated, never null
                "plate_number":    plate_number,
                "plate_confidence": plate_confidence,
                # Legacy key for backward compatibility
                "last_plate":      plate_number,
                # Meta
                "summary":         summary,
                "source":          "ensemble",
            }

        except Exception as e:
            logger.error("[EnsembleEngine] analyze_frame error: %s", e, exc_info=True)
            return self._fallback_result()

    def _detect_by_mode(self, frame: np.ndarray, mode: str) -> list:
        if mode == "daylight":
            runners = [self.engine.detect_vehicles]
            if self.engine.crowd_session:
                runners.append(self.engine.detect_crowd)
            return self._run_parallel(frame, runners)
        elif mode == "night":
            if self.engine.bdd100k_session:
                return self.engine.detect_night(frame)
            return self.engine.detect_vehicles(frame)
        else:
            runners = [self.engine.detect_vehicles]
            if self.engine.bdd100k_session:
                runners.append(self.engine.detect_night)
            return self._run_parallel(frame, runners)

    def _run_parallel(self, frame: np.ndarray, runners: list) -> list:
        all_dets = []
        with ThreadPoolExecutor(max_workers=len(runners)) as ex:
            futures = [ex.submit(fn, frame) for fn in runners]
            for f in as_completed(futures):
                try:
                    res = f.result()
                    if res:
                        all_dets.extend(res)
                except Exception as e:
                    logger.warning("[EnsembleEngine] Parallel detection error: %s", e)
        return all_dets

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
        """Final cross-model NMS to remove duplicates after ensemble merging."""
        if not detections:
            return []
        try:
            return self.engine._nms(detections, iou_threshold=IOU_THRESHOLD)
        except Exception:
            # Fallback: simple sort by confidence
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

    def generate_summary(self, count: int, density: str, mode: str, camera_id: str) -> str:
        mode_map = {"daylight": "Siang Hari", "night": "Malam Hari", "mixed": "Transisi"}
        dens_map = {"high": "Padat", "medium": "Sedang", "low": "Lancar"}
        m = mode_map.get(mode, "Normal")
        d = dens_map.get(density, "Normal")
        return f"{camera_id}: {d} ({m}), {count} kendaraan terdeteksi."

    def _fallback_result(self) -> dict:
        return {
            "vehicle_count":     0,
            "density_level":     "low",
            "recommendation":    "Normal",
            "boxes":             [],
            "violations":        [],
            "vehicle_types":     {},
            "lighting_mode":     "unknown",
            "brightness":        0.0,
            "plate_number":      "UNREADABLE",
            "plate_confidence":  0.0,
            "last_plate":        "UNREADABLE",
            "summary":           "AI Engine Error.",
            "source":            "fallback",
        }
