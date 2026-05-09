"""
ocr_worker.py — Async OCR Process Pool Worker.

Runs EasyOCR in a separate ProcessPoolExecutor so it never blocks
the FastAPI event loop or the inference thread.

Features:
  - ProcessPoolExecutor with configurable workers
  - Async-compatible via asyncio.run_in_executor
  - Fallback to synchronous OCR if pool unavailable
  - Result caching per plate-hash (avoids re-OCR of same plate)
  - Thread-safe cache with TTL expiry

Usage:
  from app.services.ocr_worker import ocr_worker
  result = await ocr_worker.read_plate_async(frame, plate_box)
"""
import asyncio
import hashlib
import logging
import time
import threading
from typing import Optional
from concurrent.futures import ThreadPoolExecutor

import cv2
import numpy as np

from app.config import OCR_SCALE_TARGET_HEIGHT, OCR_MIN_CONFIDENCE, OCR_MAX_PLATES_PER_FRAME

logger = logging.getLogger(__name__)

# ── Cache ──────────────────────────────────────────────────────────────────────
class PlateCache:
    """
    LRU-style cache: stores OCR results keyed by plate image hash.
    Avoids re-running expensive EasyOCR on the same plate crop every frame.
    TTL = 30s (plate won't change while vehicle is parked).
    """
    TTL = 30.0

    def __init__(self, max_size: int = 64):
        self._cache: dict[str, tuple] = {}   # hash → (result, timestamp)
        self._lock = threading.Lock()
        self._max = max_size

    def _hash(self, img: np.ndarray) -> str:
        # Downsample to 32x16 before hashing for speed
        small = cv2.resize(img, (32, 16), interpolation=cv2.INTER_AREA)
        return hashlib.md5(small.tobytes()).hexdigest()

    def get(self, img: np.ndarray) -> Optional[dict]:
        key = self._hash(img)
        with self._lock:
            if key in self._cache:
                result, ts = self._cache[key]
                if time.time() - ts < self.TTL:
                    return result
                del self._cache[key]
        return None

    def set(self, img: np.ndarray, result: dict):
        key = self._hash(img)
        with self._lock:
            if len(self._cache) >= self._max:
                # Evict oldest
                oldest = min(self._cache, key=lambda k: self._cache[k][1])
                del self._cache[oldest]
            self._cache[key] = (result, time.time())


class OCRWorker:
    """
    Async-compatible OCR worker using a ThreadPoolExecutor.

    NOTE: Uses ThreadPoolExecutor (not ProcessPoolExecutor) because
    EasyOCR holds GPU/ONNX state that cannot be pickled for multiprocessing.
    Tasks run in parallel threads, each calling the shared inference_engine
    reader which is thread-safe via its internal lock.
    """

    def __init__(self, max_workers: int = 2):
        self._executor = ThreadPoolExecutor(
            max_workers=max_workers,
            thread_name_prefix="ocr-worker",
        )
        self._cache = PlateCache()
        logger.info("[OCRWorker] Initialized with %d thread workers.", max_workers)

    def read_plate_sync(self, frame: np.ndarray, plate_box: list) -> dict:
        """
        Synchronous single-plate OCR.
        Delegates to InferenceEngine.read_license_plate_text().
        """
        from app.services.inference_engine import inference_engine
        return inference_engine.read_license_plate_text(frame, plate_box)

    async def read_plate_async(self, frame: np.ndarray, plate_box: list) -> dict:
        """
        Async wrapper: runs OCR in thread pool so event loop is never blocked.

        Args:
            frame:     Full BGR frame.
            plate_box: [x1_norm, y1_norm, w_norm, h_norm, conf, cls]

        Returns:
            {"plate_number": str, "plate_confidence": float}
        """
        # Check cache first (using a quick crop for hashing)
        try:
            h, w = frame.shape[:2]
            x1 = max(0, int(float(plate_box[0]) * w))
            y1 = max(0, int(float(plate_box[1]) * h))
            x2 = min(w, int((float(plate_box[0]) + float(plate_box[2])) * w))
            y2 = min(h, int((float(plate_box[1]) + float(plate_box[3])) * h))
            crop = frame[y1:y2, x1:x2]
            if crop.size > 0:
                cached = self._cache.get(crop)
                if cached:
                    logger.debug("[OCRWorker] Cache hit for plate.")
                    return cached
        except Exception:
            crop = None

        # Run OCR in thread pool
        try:
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(
                self._executor,
                self.read_plate_sync,
                frame,
                plate_box,
            )
            # Cache result
            if crop is not None and crop.size > 0:
                self._cache.set(crop, result)
            return result
        except Exception as e:
            logger.error("[OCRWorker] Async OCR error: %s", e)
            return {"plate_number": "UNREADABLE", "plate_confidence": 0.0}

    async def read_all_plates_async(
        self, frame: np.ndarray, plate_boxes: list
    ) -> list:
        """
        Process ALL detected plate boxes concurrently.
        Returns list of OCR results, one per plate_box.

        This is the key function for multi-plate support in real-time streams.
        """
        if not plate_boxes:
            return []

        # Limit to OCR_MAX_PLATES_PER_FRAME to prevent overload
        boxes_to_process = sorted(
            plate_boxes, key=lambda b: float(b[4]), reverse=True
        )[:OCR_MAX_PLATES_PER_FRAME]

        tasks = [self.read_plate_async(frame, box) for box in boxes_to_process]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        out = []
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                logger.warning("[OCRWorker] Plate %d error: %s", i, result)
                out.append({"plate_number": "UNREADABLE", "plate_confidence": 0.0})
            else:
                result["box"] = plate_boxes[i][:4]
                out.append(result)

        return out

    def shutdown(self):
        self._executor.shutdown(wait=False)
        logger.info("[OCRWorker] Executor shut down.")


# Singleton
ocr_worker = OCRWorker(max_workers=2)
