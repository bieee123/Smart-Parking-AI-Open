"""
parking_analyzer.py — Parking View Classifier & Spatial Reasoning Engine.

Automatically determines if a camera feed is:
  - Top-View (aerial/overhead parking lot)
  - Side-View (entrance/street-level camera)

And applies view-appropriate analytics:
  - Top-View: Occupancy grid, slot polygon matching, density heatmap
  - Side-View: Vehicle tracking, LPR focus, entry/exit counting
"""
import logging
import time
import numpy as np
import cv2
from typing import Optional

logger = logging.getLogger(__name__)


# ── View Classification ────────────────────────────────────────────────────────

class ViewClassifier:
    """
    Heuristic-based parking view classifier.

    Top-View signatures:
      - Vehicles appear small relative to frame (bbox height < 20% of frame)
      - High vehicle density (many small bboxes)
      - Uniform color distribution (asphalt + vehicle tops)

    Side-View signatures:
      - Vehicles appear larger (bbox height > 30% of frame)
      - Fewer vehicles per frame
      - Strong horizontal vanishing point
    """

    TOP_VIEW_MAX_BBOX_H    = 0.22   # bbox height/frame height
    SIDE_VIEW_MIN_BBOX_H   = 0.28
    TOP_VIEW_MIN_COUNT     = 4      # Need several vehicles for top-view confidence

    def classify(self, frame: np.ndarray, detections: list) -> str:
        """
        Returns 'top_view', 'side_view', or 'unknown'.
        """
        if not detections or len(detections) == 0:
            return self._fallback_from_frame(frame)

        # Measure avg bbox height relative to frame
        avg_h = np.mean([float(d[3]) for d in detections if len(d) > 3])

        if avg_h < self.TOP_VIEW_MAX_BBOX_H and len(detections) >= self.TOP_VIEW_MIN_COUNT:
            return "top_view"
        elif avg_h > self.SIDE_VIEW_MIN_BBOX_H:
            return "side_view"

        return self._fallback_from_frame(frame)

    def _fallback_from_frame(self, frame: np.ndarray) -> str:
        """Use frame texture analysis as fallback view classifier."""
        try:
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            h, w = gray.shape

            # Check gradient magnitude — side-view has strong horizontal edges
            sobel_x = cv2.Sobel(gray, cv2.CV_64F, 1, 0, ksize=3)
            sobel_y = cv2.Sobel(gray, cv2.CV_64F, 0, 1, ksize=3)
            mag_x   = float(np.mean(np.abs(sobel_x)))
            mag_y   = float(np.mean(np.abs(sobel_y)))

            # Side-view: strong vertical edges (car bodies)
            if mag_x > mag_y * 1.5:
                return "side_view"
            # Top-view: more uniform gradient
            return "top_view"
        except Exception:
            return "unknown"


# ── Density Heatmap ────────────────────────────────────────────────────────────

class DensityHeatmap:
    """
    Builds a spatial density grid from detection bounding boxes.
    Used for top-view parking analytics visualization.
    """

    def __init__(self, grid_w: int = 10, grid_h: int = 10):
        self.grid_w = grid_w
        self.grid_h = grid_h

    def compute(self, detections: list) -> list:
        """
        Returns a grid_h × grid_w 2D list with vehicle counts per cell.

        Args:
            detections: list of [x1_norm, y1_norm, w_norm, h_norm, conf, cls]

        Returns:
            list[list[int]] — 2D heatmap grid
        """
        grid = [[0] * self.grid_w for _ in range(self.grid_h)]
        for d in detections:
            if len(d) < 4:
                continue
            # Center point of bbox
            cx = float(d[0]) + float(d[2]) / 2.0
            cy = float(d[1]) + float(d[3]) / 2.0

            gx = min(self.grid_w - 1, int(cx * self.grid_w))
            gy = min(self.grid_h - 1, int(cy * self.grid_h))
            grid[gy][gx] += 1

        return grid

    def hotspots(self, grid: list, threshold: int = 2) -> list:
        """Return list of [grid_x, grid_y] cells with count >= threshold."""
        result = []
        for gy, row in enumerate(grid):
            for gx, count in enumerate(row):
                if count >= threshold:
                    result.append({
                        "grid_x":    gx,
                        "grid_y":    gy,
                        "count":     count,
                        "x_norm":    gx / self.grid_w,
                        "y_norm":    gy / self.grid_h,
                    })
        return result


# ── Entry/Exit Counter ─────────────────────────────────────────────────────────

class EntryExitCounter:
    """
    Side-view entry/exit counter using virtual detection line.

    Vehicles crossing the center horizontal line from top→bottom = Entry.
    Vehicles crossing from bottom→top = Exit.

    Works best with ByteTrack persistent IDs.
    """

    def __init__(self, line_y: float = 0.5):
        """
        Args:
            line_y: normalized Y coordinate of the counting line (default: center)
        """
        self.line_y        = line_y
        self._prev_cy:     dict[int, float] = {}   # track_id → last center_y
        self._last_seen:   dict[int, int]   = {}   # track_id → last frame index
        self.entry_count:  int = 0
        self.exit_count:   int = 0
        self._counted:     set = set()
        self._frame_idx:   int = 0
        self.TTL_FRAMES:   int = 300  # BUG-3 FIX: prune tracks not seen for 300 frames

    def update(self, tracked_detections: list) -> dict:
        """
        Update counters from tracked detections.

        Args:
            tracked_detections: list of [x1, y1, w, h, conf, cls, track_id]

        Returns:
            {"entries": int, "exits": int, "net_count": int}
        """
        self._frame_idx += 1
        active_ids = set()

        for det in tracked_detections:
            if len(det) < 7:
                continue
            track_id = int(det[6])
            cy = float(det[1]) + float(det[3]) / 2.0
            active_ids.add(track_id)
            self._last_seen[track_id] = self._frame_idx

            prev = self._prev_cy.get(track_id)
            if prev is not None and track_id not in self._counted:
                if prev < self.line_y <= cy:
                    self.entry_count += 1
                    self._counted.add(track_id)
                    logger.info("[EntryExit] Entry #%d (track %d)", self.entry_count, track_id)
                elif prev > self.line_y >= cy:
                    self.exit_count += 1
                    self._counted.add(track_id)
                    logger.info("[EntryExit] Exit #%d (track %d)", self.exit_count, track_id)

            self._prev_cy[track_id] = cy

        # BUG-3 FIX: Prune tracks not seen for TTL_FRAMES to prevent unbounded growth
        if self._frame_idx % 100 == 0:
            stale = [
                tid for tid, last in self._last_seen.items()
                if self._frame_idx - last > self.TTL_FRAMES
            ]
            for tid in stale:
                self._prev_cy.pop(tid, None)
                self._last_seen.pop(tid, None)
            if stale:
                logger.debug("[EntryExit] Pruned %d stale tracks", len(stale))

        return {
            "entries":   self.entry_count,
            "exits":     self.exit_count,
            "net_count": self.entry_count - self.exit_count,
        }

    def reset(self):
        self._prev_cy.clear()
        self._counted.clear()
        self.entry_count = 0
        self.exit_count  = 0


# ── Master Parking Analyzer ────────────────────────────────────────────────────

class ParkingAnalyzer:
    """
    High-level parking analytics engine.

    Combines:
      - ViewClassifier (top/side auto-detection)
      - DensityHeatmap (spatial vehicle distribution)
      - EntryExitCounter (per-camera traffic counting)
      - SlotManager (polygon occupancy)
    """

    def __init__(self):
        self.view_classifier    = ViewClassifier()
        self.density_heatmap    = DensityHeatmap()
        self._entry_exit:       dict[str, EntryExitCounter] = {}
        logger.info("[ParkingAnalyzer] Initialized.")

    def get_entry_exit(self, camera_id: str) -> EntryExitCounter:
        if camera_id not in self._entry_exit:
            self._entry_exit[camera_id] = EntryExitCounter()
        return self._entry_exit[camera_id]

    def analyze(
        self,
        frame:       np.ndarray,
        detections:  list,
        camera_id:   str = "DEFAULT",
        view_hint:   Optional[str] = None,  # "top_view" | "side_view" | None (auto)
    ) -> dict:
        """
        Full spatial analysis for a single frame.

        Returns:
            {
              "view_type":      str,
              "heatmap":        list[list[int]],
              "hotspots":       list[dict],
              "entry_exit":     dict,
              "density_zones":  dict,
            }
        """
        t0 = time.perf_counter()

        # 1. View classification
        view_type = view_hint or self.view_classifier.classify(frame, detections)

        # 2. Density heatmap
        grid     = self.density_heatmap.compute(detections)
        hotspots = self.density_heatmap.hotspots(grid, threshold=1)

        # 3. Entry/exit counting (side-view)
        entry_exit = {}
        if view_type == "side_view":
            counter    = self.get_entry_exit(camera_id)
            entry_exit = counter.update(detections)

        # 4. Density zone analysis (top-view)
        density_zones = {}
        if view_type == "top_view":
            density_zones = self._zone_density(detections)

        elapsed_ms = (time.perf_counter() - t0) * 1000
        logger.debug(
            "[ParkingAnalyzer] %s | view=%s | detections=%d | %.0fms",
            camera_id, view_type, len(detections), elapsed_ms,
        )

        return {
            "view_type":     view_type,
            "heatmap":       grid,
            "hotspots":      hotspots,
            "entry_exit":    entry_exit,
            "density_zones": density_zones,
            "analysis_ms":   round(elapsed_ms, 1),
        }

    def _zone_density(self, detections: list) -> dict:
        """
        Divide frame into Left/Center/Right thirds and count vehicles per zone.
        Useful for top-view parking lot row analysis.
        """
        zones = {"left": 0, "center": 0, "right": 0}
        for d in detections:
            if len(d) < 3:
                continue
            cx = float(d[0]) + float(d[2]) / 2.0
            if cx < 0.33:
                zones["left"]   += 1
            elif cx < 0.67:
                zones["center"] += 1
            else:
                zones["right"]  += 1
        return zones


# Singletons
view_classifier  = ViewClassifier()
density_heatmap  = DensityHeatmap()
parking_analyzer = ParkingAnalyzer()
