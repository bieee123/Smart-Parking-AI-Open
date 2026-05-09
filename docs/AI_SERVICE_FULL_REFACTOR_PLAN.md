# FULL AI-SERVICE REFACTOR & ACCURACY IMPROVEMENT PLAN
## Smart Parking AI — Enterprise Production Upgrade

---

## 1. Complete Problem List (Grounded in Real Code)

### 🔴 CRITICAL
| # | Problem | Location | Impact |
|---|---------|----------|--------|
| C1 | `crowd_detection_model.onnx` hardcoded to return `[]` | `inference_engine.py:143` | Zero traffic density intelligence |
| C2 | OCR only processes single best-plate per frame | `ensemble_engine.py:87` | Multi-vehicle LPR completely absent |
| C3 | No temporal tracking — frame-by-frame counting | `stream_processor.py:94-97` | Flickering counts, duplicate vehicles |
| C4 | Video occupancy uses `np.random.randint` for slot assignment | `video.py:154` | Fake slot data in PostgreSQL |
| C5 | `job_store` is in-memory dict — lost on restart | `video.py:17` | All processing history wiped on any crash |
| C6 | EasyOCR initialized synchronously on first request | `inference_engine.py:216-222` | 3-10s freeze on first live camera frame |
| C7 | `config.py` has `LPR_CONFIDENCE_THRESHOLD=0.5` but `inference_engine.py` uses `0.20` | Both files | Inconsistent thresholds, silent override |

### 🟠 HIGH
| # | Problem | Location | Impact |
|---|---------|----------|--------|
| H1 | `FRAME_INTERVAL=3` in camera_worker blocks real-time feel | `camera_worker.py:19` | System feels broken to demo audience |
| H2 | `_nms` in `inference_engine.py` is a simple Python loop — no batching | `inference_engine.py:152-165` | Slow at high vehicle density |
| H3 | No polygon ROI for parking slots — density is purely vehicle count | `ensemble_engine.py:205-210` | Useless for actual occupancy mapping |
| H4 | `traffic.py` mock fallback silently masks real model failures | `traffic.py:38-68, 99-102` | Presenters won't know AI is broken |
| H5 | `StreamProcessor` does not stop cleanly — thread left dangling | `stream_processor.py:55-60` | Memory leaks on multi-camera switch |
| H6 | `video.py` uses blocking `await asyncio.sleep(0)` — not true async | `video.py:182` | Blocks FastAPI event loop during video |
| H7 | No GPU/CUDA auto-detection — always runs CPU path | `inference_engine.py` | 10x slower than necessary on GPU machines |

### 🟡 MEDIUM
| # | Problem | Location | Impact |
|---|---------|----------|--------|
| M1 | No superresolution or deblur before OCR | `inference_engine.py:207-212` | Fails on low-res CCTV footage |
| M2 | Plate regex too restrictive — misses valid plates | `inference_engine.py:27` | Drops plates with non-standard format |
| M3 | `LPREngine` has its own model loader, duplicates `InferenceEngine` loader | `lpr_engine.py:45-56` | Two YOLO instances loaded for same model |
| M4 | `config.py` missing crowd/illegal model paths | `config.py` | Hardcoded paths scattered in code |
| M5 | Brightness threshold for night mode is arbitrary (80/50) | `ensemble_engine.py:54-56` | Unreliable in mixed lighting scenes |
| M6 | `_process_video` in `video.py` samples 1 frame/second regardless of content | `video.py:106` | Misses fast-moving vehicles |
| M7 | No health-check for individual model load status | `health.py` | No way to know which model failed |

---

## 2. Root Cause Fixes

### Fix C1 — Activate Traffic Congestion Model
**File**: `inference_engine.py`
```python
# BEFORE (line 143)
def detect_crowd(self, frame: np.ndarray) -> list:
    """Crowd detection disabled to prevent class ID collision."""
    return []

# AFTER — Apply ID offset mapping before merging
CROWD_TO_VEHICLE_CLASS = {2: 4, 3: 0, 4: 5, 5: 3, 6: 1, 7: 1, 8: 2, 9: 4}

def detect_crowd(self, frame: np.ndarray) -> list:
    raw = self._yolo_detect('_yolo_crowd', 'crowd_detection_model.onnx', frame, model_name="Crowd")
    mapped = []
    for det in raw:
        cls_id = int(det[5])
        if cls_id in CROWD_TO_VEHICLE_CLASS:
            det[5] = CROWD_TO_VEHICLE_CLASS[cls_id]
            mapped.append(det)
    return mapped
```
**Why it works**: The `CROWD_TO_VEHICLE_CLASS` mapping already exists in the code but is never applied. By remapping class IDs before NMS, the crowd model's detections can be safely merged with the vehicle model without ID collision.

### Fix C2 — Multi-Vehicle LPR
**File**: `ensemble_engine.py`
```python
# AFTER — process all detected plates, not just the best
plates_result = []
if raw_plates:
    for plate_box in raw_plates:  # iterate ALL plates
        ocr = self.engine.read_license_plate_text(frame, plate_box)
        if ocr.get("plate_number") != "UNREADABLE":
            plates_result.append(ocr)
# Report primary plate + all detected plates list
plate_number = plates_result[0]["plate_number"] if plates_result else "UNREADABLE"
```

### Fix C3 — Integrate ByteTrack
**New File**: `app/services/tracker.py`
```python
# Use supervision library's ByteTrack wrapper (zero-dependency install)
# pip install supervision
import supervision as sv
tracker = sv.ByteTracker()
# Wrap detections before returning from EnsembleEngine
```
**Why**: ByteTrack assigns persistent IDs across frames. Vehicle count becomes stable because each vehicle keeps its ID even when partially occluded.

### Fix C4 — Real Slot Association
**File**: `video.py:154-163`
```python
# REMOVE: slot_num = f"A{np.random.randint(1, 11)}"
# REPLACE: map detected bounding boxes to pre-configured slot polygons
# from app.services.slot_manager import SlotManager
# occupied_slots = slot_manager.associate(res.get("boxes", []))
```

### Fix C6 — Pre-warm EasyOCR at Startup
**File**: `app/main.py`
```python
@app.on_event("startup")
async def startup_event():
    # Pre-initialize OCR in background thread
    import threading
    def _prewarm():
        from app.services.inference_engine import inference_engine
        import numpy as np
        dummy = np.zeros((80, 200, 3), dtype=np.uint8)
        inference_engine.read_license_plate_text(dummy, [0, 0, 1, 1, 0.5, 0])
    threading.Thread(target=_prewarm, daemon=True).start()
```

---

## 3. Refactored Architecture

### Current Architecture (Problematic)
```
FastAPI Router → EnsembleEngine → InferenceEngine (3 YOLO models sequential)
                              → LPREngine (duplicate loader)
StreamProcessor → Thread → EnsembleEngine
VideoRouter → BackgroundTask → EnsembleEngine (in-memory job store)
```

### Proposed Architecture (Production-Grade)
```
FastAPI API Layer
    ├── /ai/traffic/analyze   → AnalysisPipeline
    ├── /ai/traffic/stream    → StreamManager
    ├── /ai/video/upload      → JobQueue (Redis or asyncio.Queue)
    └── /ai/health            → HealthRegistry

AnalysisPipeline
    ├── Preprocessor          (resize, letterbox, normalize)
    ├── DetectorPool          (vehicle + crowd models, parallel)
    ├── TrackerManager        (ByteTrack per camera_id)
    ├── ViolationDetector     (illegal_model.onnx + polygon ROI)
    ├── LPRPipeline           (multi-plate, async OCR queue)
    ├── SlotManager           (polygon ROI occupancy mapping)
    └── ResultAggregator      (merge + normalize output)

StreamManager
    ├── CameraWorker × N      (per camera thread)
    ├── FrameQueue            (asyncio.Queue per camera)
    └── SSEBroadcaster        (per client)
```

---

## 4. Detection Pipeline Improvements

### 4.1 Pre-Processing
- **Current**: Direct `cv2.imdecode` → YOLO call (no explicit letterbox verification).
- **Fix**: Add explicit `letterbox()` function before inference to guarantee 640x640 with correct padding record, so denormalization is exact.

### 4.2 Dual-Model Fusion (Vehicle + Crowd)
- **Current**: `_detect_by_mode()` only calls `detect_vehicles()`.
- **Fix**: Run both models in parallel via `ThreadPoolExecutor`, then merge with per-class NMS:
```python
def _detect_by_mode(self, frame, mode):
    with ThreadPoolExecutor(max_workers=2) as ex:
        f1 = ex.submit(self.engine.detect_vehicles, frame)
        f2 = ex.submit(self.engine.detect_crowd, frame)
    return f1.result() + f2.result()  # merge before NMS
```

### 4.3 NMS Improvement
- **Current**: Simple Python loop, single-class NMS (`inference_engine._nms`).
- **Fix**: Use `torchvision.ops.nms` or `cv2.dnn.NMSBoxes` which are C++-accelerated and support batch operations.

### 4.4 Confidence Threshold Unification
- Centralize all thresholds in `config.py`:
```python
VEHICLE_CONF   = float(os.getenv("VEHICLE_CONF", "0.40"))
LPR_CONF       = float(os.getenv("LPR_CONF",     "0.20"))
CROWD_CONF     = float(os.getenv("CROWD_CONF",   "0.35"))
ILLEGAL_CONF   = float(os.getenv("ILLEGAL_CONF", "0.40"))
NMS_IOU        = float(os.getenv("NMS_IOU",      "0.45"))
```

---

## 5. Tracking Improvements

### Install
```bash
pip install supervision  # Wraps ByteTrack cleanly
```

### Implementation
**New File**: `app/services/tracker_manager.py`
```python
import supervision as sv
from collections import defaultdict

class TrackerManager:
    """Per-camera ByteTrack instances to prevent cross-camera ID contamination."""
    def __init__(self):
        self._trackers: dict[str, sv.ByteTracker] = defaultdict(
            lambda: sv.ByteTracker(track_activation_threshold=0.25, minimum_consecutive_frames=2)
        )

    def update(self, camera_id: str, detections: sv.Detections) -> sv.Detections:
        return self._trackers[camera_id].update_with_detections(detections)
```

**Key Improvements**:
- **Persistent IDs**: Same vehicle = same ID across frames.
- **Anti-Duplicate Counting**: Vehicle parked for 5 minutes = counted once, not 300 times.
- **Re-entry**: If vehicle leaves and returns, new ID is assigned correctly.

---

## 6. OCR Pipeline Redesign

### 6.1 Pre-warming (Fix C6)
Warm up EasyOCR at application startup to eliminate first-request freeze.

### 6.2 Super-Resolution (New)
Before cropping and passing to OCR, apply lightweight upscaling for small plates:
```python
# In read_license_plate_text()
target_h = 120  # Increase from current 80px
if plate_crop.shape[0] < target_h:
    scale_f = target_h / plate_crop.shape[0]
    plate_crop = cv2.resize(plate_crop, None, fx=scale_f, fy=scale_f,
                            interpolation=cv2.INTER_LANCZOS4)  # Better quality than INTER_CUBIC
```

### 6.3 Adaptive Sharpening
```python
# After scaling, apply unsharp mask
blurred = cv2.GaussianBlur(plate_crop, (0, 0), 3)
sharpened = cv2.addWeighted(plate_crop, 1.5, blurred, -0.5, 0)
```

### 6.4 Async OCR Queue (Prevents FPS Drop)
```python
# New: OCR runs in a separate process pool, doesn't block inference
from concurrent.futures import ProcessPoolExecutor
_ocr_executor = ProcessPoolExecutor(max_workers=2)

async def run_ocr_async(plate_crop):
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(_ocr_executor, _ocr_worker, plate_crop)
```

### 6.5 Multi-Plate Support
Iterate all detected plate boxes, not just the best one. Return as a list in the API response:
```json
{
  "plates": [
    {"plate_number": "B1234XYZ", "confidence": 0.92, "box": [...]},
    {"plate_number": "AB5678CD", "confidence": 0.78, "box": [...]}
  ],
  "primary_plate": "B1234XYZ"
}
```

---

## 7. Parking Analytics (Slot Intelligence)

### 7.1 New Component: SlotManager
**New File**: `app/services/slot_manager.py`
```python
class SlotManager:
    """
    Manages polygon-based parking slot definitions.
    Slots are stored as normalized polygon coordinates [0.0-1.0].
    """
    def __init__(self):
        self.slots: dict[str, list] = {}  # {slot_id: [[x,y], [x,y], [x,y], [x,y]]}

    def define_slot(self, slot_id: str, polygon: list):
        self.slots[slot_id] = polygon

    def associate(self, detections: list) -> dict[str, str]:
        """
        For each detection center point, find which slot polygon contains it.
        Returns {slot_id: status} where status is 'occupied' or 'empty'.
        """
        result = {s: 'empty' for s in self.slots}
        for det in detections:
            cx = det[0] + det[2] / 2  # center x
            cy = det[1] + det[3] / 2  # center y
            for slot_id, poly in self.slots.items():
                if self._point_in_polygon(cx, cy, poly):
                    result[slot_id] = 'occupied'
                    break
        return result

    @staticmethod
    def _point_in_polygon(x, y, polygon):
        """Ray casting algorithm for point-in-polygon."""
        import shapely.geometry as geo
        return geo.Point(x, y).within(geo.Polygon(polygon))
```

### 7.2 Admin Slot Configuration API
New endpoint: `POST /ai/slots/configure` to allow admins to draw parking slot polygons on the camera feed via the dashboard UI.

---

## 8. Performance Optimizations

### 8.1 GPU Auto-Detection
```python
# In config.py
import onnxruntime as ort
ONNX_PROVIDERS = (
    ['CUDAExecutionProvider', 'CPUExecutionProvider']
    if 'CUDAExecutionProvider' in ort.get_available_providers()
    else ['CPUExecutionProvider']
)
```

### 8.2 Frame Interval for Stream
Change `camera_worker.py` `FRAME_INTERVAL` for demo:
```python
INTERVAL = int(os.getenv('FRAME_INTERVAL', '1'))  # Was 3, change to 1 for demo
```

### 8.3 Stream Frame Skip Optimization
In `stream_processor.py`, replace frame count modulo with time-based sampling:
```python
last_inference = 0
TARGET_INTERVAL = 0.5  # seconds between inference calls

if time.time() - last_inference >= TARGET_INTERVAL:
    # run inference
    last_inference = time.time()
```

### 8.4 Video Processing — True Async
Use `run_in_executor` for CPU-bound video work to avoid blocking FastAPI event loop:
```python
loop = asyncio.get_event_loop()
result = await loop.run_in_executor(None, _sync_process_frame, frame)
```

---

## 9. Scalability Improvements

### 9.1 Per-Camera Thread Isolation
```python
class CameraWorkerPool:
    """Manages N independent camera workers."""
    def __init__(self, max_cameras=10):
        self.workers: dict[str, threading.Thread] = {}
        self.max = max_cameras

    def add_camera(self, camera_id, url):
        if len(self.workers) >= self.max:
            raise RuntimeError("Max camera limit reached")
        t = threading.Thread(target=self._worker, args=(camera_id, url), daemon=True)
        self.workers[camera_id] = t
        t.start()
```

### 9.2 Redis Job Queue (for Video Processing)
Replace in-memory `job_store` dict with Redis to survive restarts:
```python
import redis
r = redis.Redis()
r.hset(f"job:{job_id}", mapping={"progress": 0, "status": "queued"})
```

### 9.3 Model Singleton Guard
Ensure models are loaded exactly once, not per-request:
- `InferenceEngine` is already a singleton via module-level `inference_engine = InferenceEngine()`.
- `LPREngine` creates a second YOLO instance for the same `lpr_model.onnx` — **eliminate this duplicate**.

---

## 10. Recommended Models

| Use Case | Current | Recommended | Reason |
|----------|---------|-------------|--------|
| Vehicle Detection | YOLOv8n | **YOLOv8s or YOLOv8m** | n is too small for top-view |
| Traffic Congestion | YOLOv8 (disabled) | **Activate + merge with vehicle model** | Already exists, just fix mapping |
| Plate Detection | YOLOv8n | **YOLOv8n-LPR** (fine-tuned) | Specialized for plate aspect ratios |
| OCR | EasyOCR | **EasyOCR + PaddleOCR ensemble** | PaddleOCR is faster on CPU |
| Parking Occupancy | None (count-based) | **SlotManager + polygon ROI** | No 3rd model needed |
| Night Detection | None | **BDD100K** (in training) | Specifically trained for low-light |
| Tracking | None | **ByteTrack via supervision** | Proven, easy to integrate |

---

## 11. Recommended Folder Structure

```
ai-service/
├── app/
│   ├── config.py                  # Centralized config (all thresholds)
│   ├── main.py                    # FastAPI app + startup pre-warming
│   ├── routers/
│   │   ├── traffic.py
│   │   ├── video.py
│   │   ├── lpr.py
│   │   ├── slots.py               # NEW: Slot configuration API
│   │   └── health.py
│   └── services/
│       ├── inference_engine.py    # YOLO model wrappers (fix crowd model)
│       ├── ensemble_engine.py     # Multi-model fusion (fix multi-LPR)
│       ├── tracker_manager.py     # NEW: ByteTrack per camera
│       ├── slot_manager.py        # NEW: Polygon ROI occupancy
│       ├── lpr_engine.py          # Simplify — delegate to InferenceEngine
│       ├── ocr_worker.py          # NEW: Async OCR process pool
│       ├── stream_processor.py    # Fix thread leak & time-based sampling
│       └── preprocessor.py        # NEW: Centralized resize/letterbox/normalize
├── models/
│   ├── vehicle_model.onnx
│   ├── lpr_model.onnx
│   ├── illegal_model.onnx
│   ├── crowd_detection_model.onnx # To be activated
│   └── bdd100k_model.onnx         # Pending training
├── training/
├── tests/
├── camera_worker.py
├── requirements.txt
└── Dockerfile
```

---

## 12. Implementation Plan

### Short-Term (Before Presentation — 3 Days)
| Priority | Task | File | Time |
|----------|------|------|------|
| 🔴 1 | Activate crowd model with ID offset mapping | `inference_engine.py` | 2h |
| 🔴 2 | Pre-warm EasyOCR at startup | `main.py` | 30m |
| 🔴 3 | Set `FRAME_INTERVAL=1` for demo | `camera_worker.py` | 5m |
| 🔴 4 | Fix config threshold inconsistency | `config.py`, `inference_engine.py` | 30m |
| 🟠 5 | Add mock-indicator in API response | `traffic.py` | 1h |
| 🟠 6 | Multi-LPR: iterate all plates | `ensemble_engine.py` | 2h |

### Mid-Term (Post-Presentation — 1 Week)
- Integrate ByteTrack via `supervision` library.
- Implement `SlotManager` with polygon ROI.
- Fix video.py async blocking issue.
- Centralize all config to `config.py`.
- Eliminate duplicate `LPREngine` model loader.

### Long-Term (Production Hardening — 1 Month)
- Redis job queue for video processing.
- GPU auto-detection and CUDA execution provider.
- Async OCR process pool.
- Multi-camera worker pool with health checks.
- BDD100K night model integration.
- Admin UI for slot polygon drawing.

---

## 13. Migration Plan

### Phase 1 (Zero-Downtime, Additive)
All short-term fixes are purely additive or parameter changes.
- No API contract changes.
- No model replacements — same `.onnx` files.
- Just activate disabled code paths and fix thresholds.

### Phase 2 (Modular Replacement)
- Add `tracker_manager.py` alongside existing engine — `EnsembleEngine` calls tracker optionally.
- Add `slot_manager.py` as opt-in — existing count-based density still works as fallback.

### Phase 3 (Architecture Upgrade)
- Replace in-memory `job_store` with Redis — requires `redis-py` install.
- Modularize into `preprocessor.py` and `ocr_worker.py`.
- This phase carries migration risk — requires integration testing.

---

## 14. Final Expected Improvements

| Metric | Current Estimate | After Short-Term | After Full Refactor |
|--------|-----------------|-----------------|---------------------|
| Vehicle Detection Accuracy | ~75% | ~82% (crowd model active) | ~92% (better model) |
| OCR First-Request Latency | 3-10s | <0.5s (pre-warm) | <0.2s (async pool) |
| Multi-Vehicle LPR | 0% (single plate only) | 100% (all plates) | 100% + temporal stab. |
| Parking Occupancy Accuracy | ~50% (count-based) | ~50% | ~90% (polygon ROI) |
| Stream FPS (CPU) | ~2 FPS | ~5 FPS | ~10-15 FPS |
| Stream FPS (GPU) | ~5 FPS | ~10 FPS | ~40-60 FPS |
| Tracking Stability | 0% (frame-by-frame) | 0% | ~95% (ByteTrack) |
| Multi-Camera Support | 1 (thread-unsafe) | 2-3 (with fixes) | 10+ (worker pool) |
| Demo Stability Risk | HIGH | LOW | VERY LOW |
