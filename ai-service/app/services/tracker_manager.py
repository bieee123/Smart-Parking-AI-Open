"""
TrackerManager — Per-Camera ByteTrack Integration.

Provides persistent vehicle IDs across frames to:
  - Eliminate flickering vehicle counts
  - Prevent duplicate counting of stationary vehicles
  - Support re-entry handling (new ID when vehicle returns)

Dependencies:
  pip install supervision>=0.21.0

Falls back gracefully to passthrough mode if supervision is unavailable.
"""
import logging
import time
import numpy as np
from collections import defaultdict
from typing import Optional

logger = logging.getLogger(__name__)

# ── Try to import supervision (ByteTrack wrapper) ──────────────────────────────
try:
    import supervision as sv
    _SV_AVAILABLE = True
    logger.info("[TrackerManager] supervision library available — ByteTrack ACTIVE.")
except ImportError:
    _SV_AVAILABLE = False
    logger.warning(
        "[TrackerManager] supervision not installed — tracking DISABLED. "
        "Run: pip install supervision>=0.21.0"
    )


class CameraTracker:
    """ByteTrack instance for a single camera stream."""

    def __init__(self, camera_id: str):
        self.camera_id = camera_id
        self.last_active = time.time()
        self._track_history: dict[int, list] = defaultdict(list)  # track_id → [count_frames]

        if _SV_AVAILABLE:
            self.tracker = sv.ByteTracker(
                track_activation_threshold=0.25,
                lost_track_buffer=30,       # Keep track alive for 30 frames after disappearance
                minimum_matching_threshold=0.8,
                minimum_consecutive_frames=2,  # Require 2 frames before confirming new track
            )
        else:
            self.tracker = None

    def update(self, detections_raw: list, frame_shape: tuple) -> list:
        """
        Update tracker with raw detection boxes.

        Args:
            detections_raw: list of [x1_norm, y1_norm, w_norm, h_norm, conf, cls]
            frame_shape: (height, width) of the source frame

        Returns:
            list of [x1_norm, y1_norm, w_norm, h_norm, conf, cls, track_id]
        """
        self.last_active = time.time()

        if not _SV_AVAILABLE or self.tracker is None or not detections_raw:
            # Passthrough: assign sequential fake IDs so downstream code works
            return [det + [i + 1] for i, det in enumerate(detections_raw)]

        h, w = frame_shape[:2]

        try:
            # Convert normalized [x1,y1,wn,hn] → pixel xyxy for supervision
            xyxy = []
            confs = []
            class_ids = []

            for det in detections_raw:
                x1n, y1n, wn, hn = det[0], det[1], det[2], det[3]
                x1 = x1n * w
                y1 = y1n * h
                x2 = (x1n + wn) * w
                y2 = (y1n + hn) * h
                xyxy.append([x1, y1, x2, y2])
                confs.append(det[4])
                class_ids.append(int(det[5]))

            sv_dets = sv.Detections(
                xyxy=np.array(xyxy, dtype=np.float32),
                confidence=np.array(confs, dtype=np.float32),
                class_id=np.array(class_ids, dtype=int),
            )

            tracked = self.tracker.update_with_detections(sv_dets)

            result = []
            for i in range(len(tracked)):
                x1, y1, x2, y2 = tracked.xyxy[i]
                conf = float(tracked.confidence[i]) if tracked.confidence is not None else 0.5
                cls  = int(tracked.class_id[i]) if tracked.class_id is not None else 0
                tid  = int(tracked.tracker_id[i]) if tracked.tracker_id is not None else i + 1

                # Normalize back to 0.0-1.0
                x1n = max(0.0, min(x1 / w, 1.0))
                y1n = max(0.0, min(y1 / h, 1.0))
                wn  = max(0.0, min((x2 - x1) / w, 1.0))
                hn  = max(0.0, min((y2 - y1) / h, 1.0))

                # Track frame history for stable counting
                self._track_history[tid].append(time.time())

                result.append([x1n, y1n, wn, hn, conf, cls, tid])

            return result

        except Exception as e:
            logger.error("[CameraTracker:%s] Tracking error: %s", self.camera_id, e)
            return [det + [i + 1] for i, det in enumerate(detections_raw)]

    def get_stable_count(self, tracked_dets: list, min_frames: int = 2) -> int:
        """Return only tracks that have been seen for at least min_frames."""
        stable = set()
        for det in tracked_dets:
            if len(det) > 6:
                tid = det[6]
                if len(self._track_history.get(tid, [])) >= min_frames:
                    stable.add(tid)
        return len(stable)

    def cleanup_old_tracks(self, ttl_seconds: float = 300.0):
        """Remove track history older than ttl_seconds to prevent memory growth."""
        cutoff = time.time() - ttl_seconds
        stale_ids = [
            tid for tid, history in self._track_history.items()
            if history and history[-1] < cutoff
        ]
        for tid in stale_ids:
            del self._track_history[tid]


class TrackerManager:
    """
    Manages per-camera ByteTrack instances.

    Each camera gets its own tracker so IDs don't collide across streams.
    Idle trackers are cleaned up after MAX_IDLE_SECONDS.
    """

    MAX_IDLE_SECONDS = 300  # 5 minutes

    def __init__(self):
        self._trackers: dict[str, CameraTracker] = {}
        self._lock = __import__("threading").Lock()
        logger.info(
            "[TrackerManager] Initialized. ByteTrack=%s",
            "ACTIVE" if _SV_AVAILABLE else "DISABLED (install supervision)"
        )

    def get_tracker(self, camera_id: str) -> CameraTracker:
        """Get or create a tracker for the given camera."""
        with self._lock:
            if camera_id not in self._trackers:
                self._trackers[camera_id] = CameraTracker(camera_id)
                logger.info("[TrackerManager] Created new tracker for camera: %s", camera_id)
            return self._trackers[camera_id]

    def update(self, camera_id: str, detections: list, frame_shape: tuple) -> list:
        """Update tracker for camera_id and return tracked detections with IDs."""
        tracker = self.get_tracker(camera_id)
        return tracker.update(detections, frame_shape)

    def cleanup_idle(self):
        """Remove trackers that haven't been used recently."""
        with self._lock:
            now = time.time()
            stale = [
                cid for cid, t in self._trackers.items()
                if now - t.last_active > self.MAX_IDLE_SECONDS
            ]
            for cid in stale:
                del self._trackers[cid]
                logger.info("[TrackerManager] Removed idle tracker: %s", cid)

    def remove_camera(self, camera_id: str):
        """Explicitly remove a tracker (e.g., when camera disconnects)."""
        with self._lock:
            if camera_id in self._trackers:
                del self._trackers[camera_id]
                logger.info("[TrackerManager] Removed tracker for: %s", camera_id)


# Singleton
tracker_manager = TrackerManager()
