"""
camera_worker_pool.py — Multi-Camera Scalable Worker Pool.

Manages N independent per-camera StreamProcessor instances.
Each camera gets its own:
  - Isolated inference thread
  - ByteTrack tracker (via TrackerManager)
  - Result queue (SSE broadcast)
  - Reconnection backoff state

Max cameras controlled by MAX_CAMERAS env var (default: 10).
Idle cameras auto-cleaned after 5 minutes.

Architecture:
  CameraWorkerPool
    ├── camera_id_1 → CameraWorker (thread + StreamProcessor)
    ├── camera_id_2 → CameraWorker (thread + StreamProcessor)
    └── ...
"""
import logging
import threading
import time
import queue
from typing import Optional

from app.config import MAX_CAMERAS, FRAME_INTERVAL_SECONDS, BACKEND_URL, BACKEND_SYNC_INTERVAL
from app.services.inference_engine import inference_engine

logger = logging.getLogger(__name__)

try:
    from app.services.ensemble_engine import EnsembleEngine
    _base_ensemble = EnsembleEngine(inference_engine)
except Exception as _e:
    _base_ensemble = None
    logger.warning("[CameraPool] EnsembleEngine unavailable: %s", _e)

try:
    from app.services.tracker_manager import tracker_manager
    _tracker_available = True
except Exception:
    tracker_manager = None
    _tracker_available = False


class CameraWorker:
    """
    Single-camera inference worker.
    Owns a thread, a result queue, and reconnect state.
    """

    def __init__(self, camera_id: str, url: str):
        self.camera_id      = camera_id
        self.url            = url
        self.is_running     = False
        self.last_active    = time.time()
        self.result_queue   = queue.Queue(maxsize=5)
        self.latest_result: dict = {}
        self.frames_processed = 0
        self.error_count    = 0
        self.started_at     = time.time()
        self._stop_event    = threading.Event()
        self._thread: Optional[threading.Thread] = None

    def start(self):
        if self.is_running:
            return
        self.is_running = True
        self._stop_event.clear()
        self._thread = threading.Thread(
            target=self._run,
            daemon=True,
            name=f"cam-{self.camera_id}",
        )
        self._thread.start()
        logger.info("[CameraPool] 🚀 Camera '%s' started: %s", self.camera_id, self.url)

    def stop(self):
        if not self.is_running:
            return
        logger.info("[CameraPool] 🛑 Stopping camera: %s", self.camera_id)
        self.is_running = False
        self._stop_event.set()
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=5.0)
        # Clean tracker state
        if _tracker_available and tracker_manager:
            try:
                tracker_manager.remove_camera(self.camera_id)
            except Exception:
                pass

    def _resolve_url(self, url: str) -> str:
        try:
            import yt_dlp
            if "youtube.com" in url or "youtu.be" in url:
                with yt_dlp.YoutubeDL({"format": "best", "quiet": True}) as ydl:
                    info = ydl.extract_info(url, download=False)
                    return info.get("url", url)
        except Exception:
            pass
        return url

    def _run(self):
        import cv2
        resolved     = self._resolve_url(self.url)
        cap          = None
        reconnect_d  = 2.0
        last_inf     = 0.0
        last_sync    = 0.0

        while not self._stop_event.is_set():
            # Open capture if not open
            if cap is None or not cap.isOpened():
                cap = cv2.VideoCapture(resolved)
                if not cap.isOpened():
                    logger.warning("[Camera:%s] Cannot open — retry in %.0fs", self.camera_id, reconnect_d)
                    time.sleep(reconnect_d)
                    reconnect_d = min(reconnect_d * 1.5, 30.0)
                    self.error_count += 1
                    continue
                reconnect_d = 2.0
                logger.info("[Camera:%s] ✅ Stream opened.", self.camera_id)

            ret, frame = cap.read()
            if not ret:
                cap.release()
                cap = None
                logger.warning("[Camera:%s] Frame grab failed — reconnecting...", self.camera_id)
                time.sleep(reconnect_d)
                reconnect_d = min(reconnect_d * 1.5, 30.0)
                continue

            reconnect_d   = 2.0
            self.last_active = time.time()

            # Time-based interval
            now = time.time()
            if now - last_inf < FRAME_INTERVAL_SECONDS:
                continue
            last_inf = now

            try:
                # Inference
                if _base_ensemble:
                    result = _base_ensemble.analyze_frame(frame, camera_id=self.camera_id)
                else:
                    vehicles = inference_engine.detect_vehicles(frame)
                    result   = {
                        "vehicle_count": len(vehicles or []),
                        "density_level": "low",
                        "boxes":         vehicles or [],
                        "violations":    [],
                        "plates":        [],
                        "source":        "pool_fallback",
                    }

                # Tracker integration
                if _tracker_available and tracker_manager and result.get("boxes"):
                    tracked = tracker_manager.update(
                        self.camera_id, result["boxes"], frame.shape
                    )
                    result["boxes"]         = tracked
                    result["vehicle_count"] = len(tracked)

                result["camera_id"] = self.camera_id
                self.latest_result  = result
                self.frames_processed += 1

                # Push to SSE queue (non-blocking, drop oldest if full)
                if self.result_queue.full():
                    try:
                        self.result_queue.get_nowait()
                    except queue.Empty:
                        pass
                self.result_queue.put_nowait(result)

                # Backend sync
                if now - last_sync >= BACKEND_SYNC_INTERVAL:
                    self._sync(result)
                    last_sync = now

            except Exception as e:
                logger.error("[Camera:%s] Inference error: %s", self.camera_id, e)
                self.error_count += 1

        if cap:
            cap.release()
        logger.info("[Camera:%s] 🔴 Worker stopped. Frames: %d", self.camera_id, self.frames_processed)

    def _sync(self, result: dict):
        try:
            import requests
            from datetime import datetime
            requests.post(
                f"{BACKEND_URL}/api/ingest/traffic",
                json={
                    "vehicle_count": result.get("vehicle_count", 0),
                    "density_level": result.get("density_level", "low"),
                    "camera_id":     self.camera_id,
                    "violations":    result.get("violations", []),
                    "timestamp":     datetime.now().isoformat(),
                },
                timeout=1.5,
            )
        except Exception:
            pass

    def status(self) -> dict:
        return {
            "camera_id":       self.camera_id,
            "url":             self.url,
            "is_running":      self.is_running,
            "frames_processed": self.frames_processed,
            "error_count":     self.error_count,
            "uptime_seconds":  int(time.time() - self.started_at),
            "last_active":     int(time.time() - self.last_active),
            "queue_size":      self.result_queue.qsize(),
        }


class CameraWorkerPool:
    """
    Thread-safe pool of per-camera CameraWorker instances.

    Lifecycle:
      pool.add("cam-001", "rtsp://...")    → Starts new worker
      pool.remove("cam-001")              → Stops worker cleanly
      pool.get_result("cam-001")          → Latest detection result
      pool.status()                       → All cameras status dict
    """

    def __init__(self):
        self._workers: dict[str, CameraWorker] = {}
        self._lock = threading.Lock()
        self._cleanup_timer: Optional[threading.Timer] = None
        self._schedule_cleanup()
        logger.info(
            "[CameraPool] Initialized. Max cameras: %d | Tracker: %s",
            MAX_CAMERAS,
            "ACTIVE" if _tracker_available else "DISABLED",
        )

    # ── Public API ─────────────────────────────────────────────────────────────

    def add(self, camera_id: str, url: str) -> dict:
        """Add and start a new camera worker."""
        with self._lock:
            if camera_id in self._workers:
                logger.info("[CameraPool] Camera '%s' already running.", camera_id)
                return self._workers[camera_id].status()

            if len(self._workers) >= MAX_CAMERAS:
                raise RuntimeError(
                    f"Max camera limit ({MAX_CAMERAS}) reached. "
                    "Remove an existing camera first."
                )

            worker = CameraWorker(camera_id, url)
            self._workers[camera_id] = worker
            worker.start()
            return worker.status()

    def remove(self, camera_id: str) -> bool:
        """Stop and remove a camera worker."""
        with self._lock:
            worker = self._workers.pop(camera_id, None)
        if worker:
            worker.stop()
            logger.info("[CameraPool] Camera '%s' removed.", camera_id)
            return True
        return False

    def get_result(self, camera_id: str) -> Optional[dict]:
        """Get the latest detection result for a camera."""
        with self._lock:
            worker = self._workers.get(camera_id)
        return worker.latest_result if worker else None

    def get_queue(self, camera_id: str) -> Optional[queue.Queue]:
        """Get the result queue for a camera (for SSE streaming)."""
        with self._lock:
            worker = self._workers.get(camera_id)
        return worker.result_queue if worker else None

    def status(self) -> dict:
        """Return status of all camera workers."""
        with self._lock:
            cameras = [w.status() for w in self._workers.values()]
        return {
            "total_cameras": len(cameras),
            "max_cameras":   MAX_CAMERAS,
            "cameras":       cameras,
        }

    def list_cameras(self) -> list:
        with self._lock:
            return list(self._workers.keys())

    def stop_all(self):
        """Stop all workers cleanly."""
        with self._lock:
            workers = list(self._workers.values())
            self._workers.clear()
        for w in workers:
            w.stop()
        logger.info("[CameraPool] All cameras stopped.")

    # ── Auto-cleanup ───────────────────────────────────────────────────────────

    def _schedule_cleanup(self):
        self._cleanup_timer = threading.Timer(300.0, self._cleanup_idle)
        self._cleanup_timer.daemon = True
        self._cleanup_timer.start()

    def _cleanup_idle(self):
        """Remove cameras idle for > 10 minutes."""
        now = time.time()
        with self._lock:
            stale = [
                cid for cid, w in self._workers.items()
                if now - w.last_active > 600 and not w.is_running
            ]
        for cid in stale:
            self.remove(cid)
            logger.info("[CameraPool] Auto-removed idle camera: %s", cid)
        self._schedule_cleanup()


# Singleton
camera_pool = CameraWorkerPool()
