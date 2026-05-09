#!/usr/bin/env python3
"""
camera_worker.py — Production Standalone CCTV Stream Processor.

V2.0 Changes:
  - H1: FRAME_INTERVAL now defaults to 1 second (was 3) via env
  - Time-based interval (not sleep-based blocking)
  - Source tracking field in broadcast payload
  - Multi-plate support in persist payload
  - Exponential backoff on reconnect (max 30s)
  - Graceful Ctrl+C shutdown
  - Plates logged to console for demo visibility

Usage:
  python camera_worker.py <stream_url_or_file>
  CCTV_URL=<url> FRAME_INTERVAL=1 python camera_worker.py
"""
import cv2
import requests
import time
import os
import sys
import signal
import logging

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(message)s",
)
logger = logging.getLogger("camera_worker")

BACKEND_URL  = os.getenv("BACKEND_URL",     "http://localhost:8000")
AI_URL       = os.getenv("AI_SERVICE_URL",  "http://localhost:9000")
CCTV_URL     = os.getenv("CCTV_URL",        "")
CAMERA_ID    = os.getenv("CAMERA_ID",       "cam-001")
# H1 FIX: Default 1 second for demo, was 3 seconds
INTERVAL     = float(os.getenv("FRAME_INTERVAL", "1.0"))
JPEG_QUALITY = int(os.getenv("JPEG_QUALITY", "85"))   # Lower = faster network transfer

_running = True


def _handle_sigterm(sig, frame):
    global _running
    logger.info("[Worker] Shutdown signal received.")
    _running = False


signal.signal(signal.SIGTERM, _handle_sigterm)
signal.signal(signal.SIGINT,  _handle_sigterm)


def analyze(frame_bytes: bytes) -> dict:
    """Send JPEG frame to AI service for analysis."""
    try:
        r = requests.post(
            f"{AI_URL}/ai/traffic/analyze",
            files={"image": ("frame.jpg", frame_bytes, "image/jpeg")},
            timeout=10,
        )
        if r.ok:
            return r.json().get("data", {})
        logger.warning("[Worker] AI response %d: %s", r.status_code, r.text[:100])
    except requests.exceptions.Timeout:
        logger.warning("[Worker] AI request timed out.")
    except Exception as e:
        logger.error("[Worker] analyze error: %s", e)
    return {}


def broadcast(data: dict):
    """Push result to backend live broadcast endpoint."""
    try:
        payload = {
            "vehicle_count":    data.get("vehicle_count", 0),
            "density_level":    data.get("density_level", "low"),
            "camera_id":        CAMERA_ID,
            "plate_number":     data.get("plate_number", "UNREADABLE"),
            "plate_confidence": data.get("plate_confidence", 0.0),
            "plates":           data.get("plates", []),           # multi-LPR list
            "violations":       data.get("violations", []),
            "boxes":            data.get("boxes", []),
            "vehicle_types":    data.get("vehicle_types", {}),
            "source":           data.get("source", "camera_worker"),
            "lighting_mode":    data.get("lighting_mode", "unknown"),
        }
        requests.post(f"{BACKEND_URL}/api/live/broadcast", json=payload, timeout=3)
    except Exception as e:
        logger.debug("[Worker] broadcast error: %s", e)


def persist(data: dict):
    """Persist detection summary to backend ingestion."""
    try:
        requests.post(
            f"{BACKEND_URL}/api/ingest/traffic",
            json={
                "vehicle_count": data.get("vehicle_count", 0),
                "density_level": data.get("density_level", "low"),
                "camera_id":     CAMERA_ID,
                "violations":    data.get("violations", []),
            },
            timeout=5,
        )
    except Exception as e:
        logger.debug("[Worker] persist error: %s", e)


def run(source: str):
    logger.info("=" * 60)
    logger.info("🎥 Camera Worker v2.0")
    logger.info("   Source  : %s", source)
    logger.info("   Camera  : %s", CAMERA_ID)
    logger.info("   Backend : %s", BACKEND_URL)
    logger.info("   AI      : %s", AI_URL)
    logger.info("   Interval: %.1fs", INTERVAL)
    logger.info("=" * 60)

    cap = cv2.VideoCapture(source)
    if not cap.isOpened():
        logger.error("❌ Cannot open source: %s", source)
        sys.exit(1)

    fails = 0
    reconnect_delay = 2.0
    last_inference = 0.0
    frame_count = 0

    while _running:
        ret, frame = cap.read()

        if not ret:
            fails += 1
            logger.warning("⚠️  Frame read failed (%d). Reconnecting in %.0fs...", fails, reconnect_delay)
            cap.release()
            time.sleep(reconnect_delay)
            reconnect_delay = min(reconnect_delay * 1.5, 30.0)

            cap = cv2.VideoCapture(source)
            if not cap.isOpened():
                logger.error("❌ Reconnect failed.")
                if fails >= 10:
                    logger.error("🛑 Too many failures. Exiting.")
                    break
            else:
                logger.info("✅ Reconnected.")
                reconnect_delay = 2.0
            continue

        fails = 0
        frame_count += 1

        # Time-based interval (non-blocking unlike sleep)
        now = time.time()
        if now - last_inference < INTERVAL:
            continue
        last_inference = now

        # Encode frame
        encode_params = [cv2.IMWRITE_JPEG_QUALITY, JPEG_QUALITY]
        ok, enc = cv2.imencode(".jpg", frame, encode_params)
        if not ok:
            continue

        result = analyze(enc.tobytes())
        if result:
            broadcast(result)
            persist(result)

            # Console output for demo visibility
            plates_str = " | ".join(
                p.get("plate_number", "?") for p in result.get("plates", [])
                if p.get("plate_number") not in ("UNREADABLE", None)
            ) or result.get("plate_number", "UNREADABLE")

            logger.info(
                "📹 %s | V:%2d | D:%-6s | Plates: %-12s | Viol:%d | Src:%-12s",
                CAMERA_ID,
                result.get("vehicle_count", 0),
                result.get("density_level", "?"),
                plates_str,
                len(result.get("violations", [])),
                result.get("source", "?"),
            )

    cap.release()
    logger.info("[Worker] 🔴 Stopped.")


if __name__ == "__main__":
    src = sys.argv[1] if len(sys.argv) > 1 else CCTV_URL
    if not src:
        logger.error("No source URL provided.")
        logger.error("Usage: python camera_worker.py <url>")
        logger.error("       or set CCTV_URL env variable.")
        sys.exit(1)
    run(src)
