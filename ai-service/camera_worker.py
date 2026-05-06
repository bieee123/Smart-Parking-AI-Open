#!/usr/bin/env python3
"""
camera_worker.py — Standalone live stream processor.
Baca video stream, kirim ke AI service, broadcast ke Node.js, persist ke MongoDB.

Usage:
  python camera_worker.py <stream_url_or_file>
  CCTV_URL=<url> python camera_worker.py
"""
import cv2
import requests
import time
import os
import sys

BACKEND_URL = os.getenv('BACKEND_URL', 'http://localhost:8000')
AI_URL      = os.getenv('AI_SERVICE_URL', 'http://localhost:9000')
CCTV_URL    = os.getenv('CCTV_URL', 'https://atcsdishub.medan.go.id/stream/L2AHMADYANIPULAUPINANG/stream.m3u8')
INTERVAL    = int(os.getenv('FRAME_INTERVAL', '3'))
CAMERA_ID   = os.getenv('CAMERA_ID', 'cam-001')


def analyze(frame_bytes: bytes) -> dict:
    """Send frame to AI service and return detection result."""
    try:
        r = requests.post(
            f'{AI_URL}/ai/traffic/analyze',
            files={'image': ('f.jpg', frame_bytes, 'image/jpeg')},
            timeout=10,
        )
        return r.json().get('data', {}) if r.ok else {}
    except Exception as e:
        print(f'[Worker] analyze error: {e}')
        return {}


def broadcast(data: dict):
    """Push latest result to backend SSE broadcast endpoint."""
    try:
        requests.post(f'{BACKEND_URL}/api/live/broadcast', json=data, timeout=5)
    except Exception as e:
        print(f'[Worker] broadcast error: {e}')


def persist(data: dict):
    """Persist detection data to backend ingestion endpoint."""
    try:
        requests.post(
            f'{BACKEND_URL}/api/ingest/traffic',
            json={
                'vehicle_count': data.get('vehicle_count', 0),
                'density_level': data.get('density_level', 'unknown'),
                'camera_id': CAMERA_ID,
                'violations': data.get('violations', []),
            },
            timeout=5,
        )
    except Exception as e:
        print(f'[Worker] persist error: {e}')


def run(source: str):
    print(f'[Worker] Source: {source} | Backend: {BACKEND_URL} | AI: {AI_URL}')
    cap = cv2.VideoCapture(source)
    if not cap.isOpened():
        print(f'[Worker] ERROR: cannot open {source}')
        sys.exit(1)

    fails = 0
    while True:
        ret, frame = cap.read()
        if not ret:
            fails += 1
            print(f'[Worker] Read failed ({fails}). Reconnecting...')
            time.sleep(5)
            cap = cv2.VideoCapture(source)
            if fails >= 10:
                print('[Worker] Too many failures. Exiting.')
                break
            continue
        fails = 0

        _, enc = cv2.imencode('.jpg', frame)
        result = analyze(enc.tobytes())
        if result:
            broadcast(result)
            persist(result)
            print(
                f'[Worker] V:{result.get("vehicle_count", 0)} '
                f'D:{result.get("density_level", "?")} '
                f'Src:{result.get("source", "?")} '
                f'Viol:{len(result.get("violations", []))}'
            )
        time.sleep(INTERVAL)

    cap.release()


if __name__ == '__main__':
    src = sys.argv[1] if len(sys.argv) > 1 else CCTV_URL
    if not src:
        print('[Worker] No source. Use: python camera_worker.py <url>')
        print('         or set CCTV_URL env variable.')
        sys.exit(1)
    run(src)
