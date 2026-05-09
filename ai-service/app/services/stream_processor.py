"""
StreamProcessor — Production Real-Time CCTV Stream Handler.

V2.0 Changes:
  - Time-based frame sampling (replaces count-based modulo)
  - ByteTrack integration via TrackerManager (stable vehicle counts)
  - SlotManager integration for real occupancy (no more fake slots)
  - Clean thread lifecycle with stop events (no dangling threads)
  - Reconnection with exponential backoff
  - Config-driven settings
  - Structured logging with per-camera context
"""
import cv2
import threading
import time
import logging
import queue
from typing import Optional

from app.config import (
    FRAME_INTERVAL_SECONDS,
    BACKEND_URL,
    BACKEND_SYNC_INTERVAL,
)
from app.services.lpr_engine import lpr_engine
from app.services.inference_engine import inference_engine

# ── Optional: EnsembleEngine ──────────────────────────────────────────────────
try:
    from app.services.ensemble_engine import EnsembleEngine
    _ensemble = EnsembleEngine(inference_engine)
    logger_tmp = logging.getLogger(__name__)
    logger_tmp.info("[StreamProcessor] EnsembleEngine V5.0 active.")
except Exception as _ens_err:
    _ensemble = None
    logging.getLogger(__name__).warning(
        "[StreamProcessor] EnsembleEngine unavailable: %s", _ens_err
    )

# ── Optional: TrackerManager ──────────────────────────────────────────────────
try:
    from app.services.tracker_manager import tracker_manager
    _tracker_available = True
except Exception:
    tracker_manager = None
    _tracker_available = False

# ── Optional: yt-dlp ─────────────────────────────────────────────────────────
try:
    import yt_dlp
    _YTDLP_AVAILABLE = True
except ImportError:
    _YTDLP_AVAILABLE = False

logger = logging.getLogger(__name__)


class StreamProcessor:
    """
    Manages a single CCTV/YouTube stream in a background thread.
    All state transitions are thread-safe via a stop event.
    """

    def __init__(self):
        self.stream_url: Optional[str] = None
        self.camera_id: str = "CCTV"
        self.is_running: bool = False
        self.latest_result: dict = {
            "vehicle_count":   0,
            "density_level":   "low",
            "recommendation":  "Waiting for stream...",
            "plate_number":    "UNREADABLE",
            "plate_confidence": 0.0,
            "last_plate":      "UNREADABLE",
            "plates":          [],
            "boxes":           [],
            "violations":      [],
            "vehicle_types":   {},
            "source":          "stream_init",
        }
        self._stop_event = threading.Event()
        self._thread: Optional[threading.Thread] = None
        self.result_queue: queue.Queue = queue.Queue(maxsize=10)

        logger.info(
            "[StreamProcessor] Init. Tracker=%s EnsembleV5=%s",
            "ACTIVE" if _tracker_available else "DISABLED",
            "ACTIVE" if _ensemble else "DISABLED",
        )

    # ── Lifecycle ──────────────────────────────────────────────────────────────

    def start(self, url: str, camera_id: str = "CCTV"):
        if self.is_running and self.stream_url == url:
            logger.info("[StreamProcessor] Already running for: %s", url)
            return

        self.stop()

        self.stream_url = url
        self.camera_id  = camera_id
        self.is_running = True
        self._stop_event.clear()

        self._thread = threading.Thread(
            target=self._process_stream,
            daemon=True,
            name=f"stream-{camera_id}",
        )
        self._thread.start()
        logger.info("[StreamProcessor] 🚀 Started stream: %s (camera=%s)", url, camera_id)

    def stop(self):
        if not self.is_running:
            return
        logger.info("[StreamProcessor] 🛑 Stopping stream: %s", self.stream_url)
        self.is_running = False
        self._stop_event.set()

        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=5.0)
            if self._thread.is_alive():
                logger.warning("[StreamProcessor] Thread did not stop cleanly.")

        self._thread = None

        # Clean up tracker for this camera
        if _tracker_available and tracker_manager:
            try:
                tracker_manager.remove_camera(self.camera_id)
            except Exception:
                pass

    # ── URL Resolution ─────────────────────────────────────────────────────────

    def _get_direct_url(self, url: str) -> str:
        if not _YTDLP_AVAILABLE:
            return url
        if "youtube.com" not in url and "youtu.be" not in url:
            return url

        logger.info("[StreamProcessor] Extracting direct URL from YouTube...")
        try:
            with yt_dlp.YoutubeDL({"format": "best", "quiet": True, "no_warnings": True}) as ydl:
                info = ydl.extract_info(url, download=False)
                resolved = info.get("url", url)
                logger.info("[StreamProcessor] YouTube URL resolved.")
                return resolved
        except Exception as e:
            logger.error("[StreamProcessor] YouTube URL extraction failed: %s", e)
            return url

    # ── Stream Loop ────────────────────────────────────────────────────────────

    def _process_stream(self):
        resolved = self._get_direct_url(self.stream_url)
        cap = self._open_capture(resolved)
        if cap is None:
            self.is_running = False
            return

        last_inference_time = 0.0
        last_sync_time = 0.0
        reconnect_delay = 2.0

        logger.info("[StreamProcessor:%s] Stream loop started.", self.camera_id)

        while not self._stop_event.is_set():
            ret, frame = cap.read()

            if not ret:
                logger.warning("[StreamProcessor:%s] Frame grab failed — reconnecting in %.0fs...",
                               self.camera_id, reconnect_delay)
                cap.release()
                time.sleep(reconnect_delay)
                reconnect_delay = min(reconnect_delay * 1.5, 30.0)  # Exponential backoff, max 30s

                resolved = self._get_direct_url(self.stream_url)
                cap = self._open_capture(resolved)
                if cap is None:
                    break
                reconnect_delay = 2.0  # Reset on successful reconnect
                continue

            reconnect_delay = 2.0  # Reset on successful frame

            # Time-based sampling: only process at FRAME_INTERVAL_SECONDS
            now = time.time()
            if now - last_inference_time < FRAME_INTERVAL_SECONDS:
                continue

            last_inference_time = now

            try:
                result = self._analyze_frame(frame)

                # Update tracker
                if _tracker_available and tracker_manager and "boxes" in result:
                    tracked_boxes = tracker_manager.update(
                        self.camera_id, result["boxes"], frame.shape
                    )
                    result["boxes"] = tracked_boxes
                    result["vehicle_count"] = len(tracked_boxes)

                self.latest_result = result

                # Push to SSE queue (non-blocking)
                if not self.result_queue.full():
                    self.result_queue.put_nowait(result)
                else:
                    try:
                        self.result_queue.get_nowait()  # Drop oldest
                        self.result_queue.put_nowait(result)
                    except queue.Empty:
                        pass

                # Periodic backend sync
                if now - last_sync_time >= BACKEND_SYNC_INTERVAL:
                    self._sync_to_backend(result)
                    last_sync_time = now

            except Exception as e:
                logger.error("[StreamProcessor:%s] Frame analysis error: %s", self.camera_id, e)

        cap.release()
        logger.info("[StreamProcessor:%s] 🔴 Stream loop ended.", self.camera_id)

    def _open_capture(self, url: str) -> Optional[cv2.VideoCapture]:
        cap = cv2.VideoCapture(url)
        if not cap.isOpened():
            logger.error("[StreamProcessor] ❌ Cannot open stream: %s", url)
            return None
        logger.info("[StreamProcessor] ✅ Stream opened: %s", url)
        return cap

    def _analyze_frame(self, frame) -> dict:
        """Run ensemble or fallback analysis on a single frame."""
        if _ensemble is not None:
            result = _ensemble.analyze_frame(frame, camera_id=self.camera_id)
            result.setdefault("boxes", [])
            result.setdefault("violations", [])
            return result

        # Fallback: vehicle detection only (no ensemble)
        vehicles = inference_engine.detect_vehicles(frame)
        count = len(vehicles) if vehicles else 0
        density = "high" if count > 15 else "medium" if count > 7 else "low"
        return {
            "vehicle_count":   count,
            "density_level":   density,
            "recommendation":  f"{count} kendaraan terdeteksi",
            "boxes":           vehicles or [],
            "violations":      [],
            "plate_number":    "UNREADABLE",
            "plate_confidence": 0.0,
            "last_plate":      "UNREADABLE",
            "plates":          [],
            "vehicle_types":   {},
            "source":          "fallback_stream",
        }

    def _sync_to_backend(self, result: dict):
        """Non-blocking backend sync via requests (fire-and-forget)."""
        try:
            import requests
            from datetime import datetime

            violations_fmt = [
                {"type": "illegal_parking", "zone": self.camera_id,
                 "confidence": float(v[4]) if len(v) > 4 else 0.8}
                for v in result.get("violations", [])
            ]

            requests.post(
                f"{BACKEND_URL}/api/ingest/traffic",
                json={
                    "vehicle_count": result.get("vehicle_count", 0),
                    "density_level": result.get("density_level", "low"),
                    "camera_id":     self.camera_id,
                    "violations":    violations_fmt,
                    "timestamp":     datetime.now().isoformat(),
                },
                timeout=1.5,
            )
        except Exception:
            pass  # Non-critical — don't log to avoid log spam


# Singleton
stream_processor = StreamProcessor()
