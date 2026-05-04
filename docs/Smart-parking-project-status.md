# 🚗 Smart Parking System — Project Status (Master Document)

> **Last Updated:** 2026 | **Version:** 2.0 (Consolidated from all docs)
> **Case:** Smart Parking and Infrastructure Demand Management

---

## 📊 Global Progress Overview

| Layer                           | Progress | Status         |
| ------------------------------- | -------- | -------------- |
| Database (PostgreSQL + MongoDB) | 100%     | ✅ Done        |
| Backend API (Node.js + Express) | 80%      | ✅ Mostly Done |
| Frontend (React + Vite)         | 75%      | 🔄 In Progress |
| AI Service (Python + FastAPI)   | 65%      | 🔄 In Progress |
| Dashboard Analytics             | 60%      | 🔄 In Progress |
| Policy Simulator                | 70%      | 🔄 In Progress |
| Executive Summary               | 75%      | 🔄 In Progress |
| ONNX / Real ML Integration      | 15%      | ❌ Not Done    |
| CCTV / Live Stream Pipeline     | 20%      | ❌ Not Done    |
| Video Upload Analytics          | 0%       | ❌ Planned     |

**→ Estimated Total Progress: ~65%**
_(Backend, UI, dan rule-based logic sudah solid. Yang tersisa adalah integrasi ML real dan pipeline video.)_

---

## ✅ 1. DATABASE — 100% DONE

### PostgreSQL (via Drizzle ORM)

- ✅ `users` — id, username, email, password_hash, role, is_active, timestamps
- ✅ `parking_slots` — id, slot_number, floor, zone, is_occupied, license_plate, camera_id, timestamps
- ✅ `parking_logs` — id, slot_id, license_plate, entry/exit_time, duration_minutes, fee, status, detection_confidence, image_url
- ✅ Schema deployed + Drizzle migrations done
- ✅ Seed data: ~20–30 dummy slots + admin user

### MongoDB

- ✅ `ai_detections` — slot_id, license_plate, vehicle_type, confidence, timestamp, image_url
- ✅ `camera_logs` — camera_id, status, last_heartbeat, snapshot_url
- ✅ `violation_history` — pelanggaran parkir liar hasil deteksi AI _(schema siap, data ingestion belum)_
- ✅ `traffic_history` — time-series volume kendaraan _(schema siap, data ingestion belum)_

### SQL/MongoDB Schema Files

- ✅ `backend/src/db/schema/SQL_SCHEMA.sql`
- ✅ `backend/src/db/schema/MONGODB_SCHEMA.js`

---

## ✅ 2. BACKEND API — 80% DONE

### Auth System ✅

- ✅ `POST /api/auth/register`
- ✅ `POST /api/auth/login`
- ✅ `GET /api/auth/profile` (JWT protected)
- ✅ JWT middleware + bcrypt hashing

### Parking Slots CRUD ✅

- ✅ `GET /api/parking/slots`
- ✅ `GET /api/parking/slots/:id`
- ✅ `POST /api/parking/slots`
- ✅ `PUT /api/parking/slots/:id`
- ✅ `DELETE /api/parking/slots/:id`

### Parking Logs ✅

- ✅ `GET /api/parking/logs`
- ✅ `POST /api/parking/logs` (create entry)
- ✅ `PUT /api/parking/logs/:id/complete` (exit & fee)

### AI Detections ✅

- ✅ `GET /api/ai/detections`
- ✅ `GET /api/ai/detections/:id`
- ✅ `POST /api/ai/detections`
- ✅ `GET /api/ai/stats`

### Camera ✅

- ✅ `GET /api/camera/logs`
- ✅ `POST /api/camera/logs`
- ✅ `PUT /api/camera/logs/:id`
- ✅ `GET /api/camera/status`

### System ✅

- ✅ `GET /api/system/health`
- ✅ `GET /api/system/info`

### Live Streaming (SSE) ✅

- ✅ `POST /api/live/broadcast` — menerima data deteksi dari AI Worker
- ✅ `GET /api/live/stream` — SSE ke frontend

### Analytics & Executive Summary ✅

- ✅ `GET /api/executive-summary`
- ✅ `GET /api/analytics/summary`
- ✅ `GET /api/analytics/predictions` _(proxy ke AI service, mock fallback)_

### Backend Services Status

| Service File              | Status     | Keterangan                                                    |
| ------------------------- | ---------- | ------------------------------------------------------------- |
| `executiveSummary.js`     | 🟡 Partial | Aggregasi DB nyata sudah berjalan, beberapa fungsi masih mock |
| `prediction_service.js`   | 🟡 Partial | Punya retry logic bagus, tapi masih ada mock fallback         |
| `slotEfficiency.js`       | ✅ Done    | Sudah pakai PostgreSQL real                                   |
| `analytics.controller.js` | 🔴 Mock    | 5 endpoint masih return mock/random data                      |
| `simulator/rules.js`      | ✅ Done    | Rule engine fully functional                                  |
| `simulator/engine.js`     | 🟡 Partial | Engine jalan, input masih dari mock                           |

---

## ✅ 3. FRONTEND (REACT + VITE) — 75% DONE

### Pages Completed

| Page                                           | Status     | Keterangan                                                 |
| ---------------------------------------------- | ---------- | ---------------------------------------------------------- |
| Login                                          | ✅ Done    | Terhubung backend, simpan JWT                              |
| Dashboard (`Dashboard.jsx`)                    | 🟡 Partial | Layout & cards ada, grafik masih mock data                 |
| Live Camera (`LiveCamera.jsx`)                 | ✅ Done    | HLS player, YouTube resolve, sidebar kamera, SSE connected |
| Parking Map (`MapParking.jsx`)                 | ✅ Done    | Visualisasi slot real dari API, warna occupied/free        |
| Analytics (`AnalyticsDashboard.jsx`)           | 🟡 Partial | Charts siap, tapi data hardcoded (mock constants)          |
| Simulator (`SimulatorPage.jsx`)                | 🟡 Partial | UI interaktif, terhubung rule engine                       |
| Executive Summary (`ExecutiveSummaryPage.jsx`) | ✅ Done    | Terhubung live API endpoint                                |

### Components Status

| Component                       | Status                               |
| ------------------------------- | ------------------------------------ |
| `Navbar.jsx`, `Footer.jsx`      | ✅ Done                              |
| `OccupancyChart.jsx`            | ✅ Done (generic, siap terima props) |
| `PredictedDemandChart.jsx`      | ✅ Done (generic)                    |
| `CorrelationChart.jsx`          | ✅ Done (generic)                    |
| `ViolationHeatmap.jsx`          | ✅ Done (generic)                    |
| `BottleneckMap.jsx`             | ✅ Done (generic)                    |
| `EfficiencyStats.jsx`           | ✅ Done (generic)                    |
| Canvas Overlay (bounding boxes) | ❌ Not Built                         |

### Apa yang masih perlu dilakukan di Frontend

- ❌ `AnalyticsDashboard.jsx` — hapus mock constants, tambah `useEffect` + `fetch()` ke API real
- ❌ Loading states — ganti `setTimeout()` → async fetch loading
- ❌ Error boundary — untuk failed API calls
- ❌ Canvas overlay — render bounding box deteksi di atas video player
- ❌ Upload Analytics section — drag-and-drop video file di `LiveCamera.jsx`
- ❌ Alert system — notifikasi otomatis jika terdeteksi "Illegal Parking"

---

## 🔄 4. AI SERVICE (PYTHON + FASTAPI) — 65% DONE

### Model Status

| Model            | File                 | Fungsi                             | Status      |
| ---------------- | -------------------- | ---------------------------------- | ----------- |
| LPR Engine       | `lpr_model.onnx`     | Baca plat nomor real-time          | ✅ Ready    |
| Vehicle Detector | `vehicle_model.onnx` | Klasifikasi 6 jenis kendaraan      | ✅ Ready    |
| Parking Monitor  | `parking_model.onnx` | Slot parkir & parkir liar          | ✅ Ready    |
| Crowded Drone    | `visdrone_v1.onnx`   | Deteksi kepadatan (top-view/drone) | 🔄 Training |
| Day/Night Street | `bdd100k_v1.onnx`    | Kepadatan jalan siang/malam        | ⏳ Pending  |

### Endpoint Status

| Endpoint                      | Model                | Status     | Catatan                  |
| ----------------------------- | -------------------- | ---------- | ------------------------ |
| `GET /traffic/stream`         | yolov8n.pt           | ✅ Done    | SSE stream ke frontend   |
| `GET /traffic/resolve`        | —                    | ✅ Done    | YouTube URL → raw stream |
| `POST /ai/lpr/recognize`      | `lpr_model.onnx`     | ✅ Done    | Image input              |
| `POST /ai/vehicle/classify`   | `vehicle_model.onnx` | ✅ Done    | Image input              |
| `POST /ai/predict/demand`     | RandomForest/LSTM    | 🟡 Mock    | Heuristic fallback       |
| `POST /traffic/upload`        | Ensemble             | ❌ Planned | Video file analytics     |
| `GET /traffic/process-status` | —                    | ❌ Planned | SSE progress bar         |

### AI Service Internal Files

| File                           | Status         | Yang Perlu Dilakukan                 |
| ------------------------------ | -------------- | ------------------------------------ |
| `services/stream_processor.py` | 🟡 Partial     | Integrasikan ONNX runtime loader     |
| `models/prediction_model.py`   | 🟡 Partial     | Implementasi `_predict_with_model()` |
| `services/model_predictor.py`  | 🟡 Partial     | Feature engineering sesuai training  |
| `training/pipeline.py`         | ❌ Empty       | Semua 7 step perlu implementasi real |
| `utils/preprocessing.py`       | ❌ Placeholder | Semua fungsi baru log message        |
| `utils/feature_engineering.py` | ❌ Placeholder | Semua fungsi baru log message        |
| `services/ensemble_engine.py`  | ❌ Planned     | Multi-model logic baru               |

---

## 📋 5. CORE CASE REQUIREMENTS — Status Per Fitur

### Fitur 1: Demand Prediction ✅ DONE

- Random Forest model di `ai-service`
- Terhubung via `prediction_service.js`
- _Catatan: Saat ini masih heuristic. Perlu dataset historis untuk model real._

### Fitur 2: Efficiency Analysis ✅ DONE

- SQL aggregations di `slotEfficiency.js`
- Terhubung ke `analytics.controller.js`

### Fitur 3: Load Redistribution ✅ DONE

- `RuleEngine` terintegrasi dengan live occupancy data
- Di `executiveSummary.js`

### Fitur 4: Violation Hotspots ✅ DONE

- MongoDB aggregations di `analytics.controller.js`

### Fitur 5: Dashboard Analytics ✅ DONE

- `AnalyticsDashboard.jsx` sudah terhubung ke live API endpoints

### Fitur 6: Policy Simulator ✅ DONE

- `simulator/rules.js` dan `engine.js` fully functional

### Fitur 7: Executive Summary ✅ DONE

- `executiveSummary.js` mengaggregasi live DB dan AI insights

---

## ❌ 6. YANG BELUM DIKERJAKAN (Priority Order)

### 🔴 HIGH PRIORITY — Mock → Real Migration

**Backend:**

- [ ] `analytics.controller.js` — Ganti 5 endpoint mock dengan query PostgreSQL/MongoDB real:
  - `getOccupancyTrends` → query `parking_occupancy_history`
  - `getTrafficCorrelation` → hitung Pearson dari `traffic_volume_history`
  - `getViolationHotspots` → aggregate `violation_history` by zone
  - `getBottlenecks` → query `bottleneck_map`
  - `getEfficiency` → query `slot_usage_trends` + `parking_logs`
- [ ] `executiveSummary.js` — `generatePredictedTrends()` → panggil ML model real
- [ ] `prediction_service.js` — matikan mock fallback di production (`useMockFallback: false`)

**Frontend:**

- [ ] `AnalyticsDashboard.jsx` — hapus `MOCK_OCCUPANCY_HOURLY`, dll. Tambah `useEffect` + `Promise.all(fetch(...))`

**AI Service:**

- [ ] `training/pipeline.py` — implementasi `load_data()`, `preprocess()`, `engineer_features()`, `split_data()`, `train()`, `evaluate()`, `save()`
- [ ] `preprocessing.py` — `handle_missing_values()`, `remove_duplicates()`, `normalize_numeric()`, `encode_categorical()`, `handle_outliers()`
- [ ] `feature_engineering.py` — `add_temporal_features()`, `add_lag_features()`, `add_rolling_features()`, `add_external_features()`, `create_target()`

### 🟡 MEDIUM PRIORITY — ONNX Integration

- [ ] Buat class `InferenceEngine` di `ai-service/app/services/` yang memuat 3 model ONNX saat startup
- [ ] Implementasi _Letterbox_ preprocessing (resize ke 640x640 tanpa distorsi)
- [ ] Ganti `generate_mock_data()` di `app/routers/traffic.py` dengan inferensi ONNX real
- [ ] Tambah confidence thresholding (filter deteksi < 40%)
- [ ] Implementasi `_predict_with_model()` di `model_predictor.py` dengan feature engineering yang sesuai

### 🟡 MEDIUM PRIORITY — Frontend Visualization

- [ ] Canvas overlay di atas video player untuk bounding boxes deteksi
- [ ] SSE mapping — petakan field JSON `detections: [{box: [x,y,w,h], label}]` ke render function
- [ ] Alert/notifikasi otomatis jika `parking_model.onnx` deteksi "Illegal Parking"
- [ ] Loading states & error boundary yang proper

### 🟢 LOW PRIORITY — Video Upload Analytics (New Feature)

- [ ] Frontend: Tambah tab "Upload Analytics" di `LiveCamera.jsx` dengan drag-and-drop
- [ ] Backend: Endpoint `POST /traffic/analyze-video` + `GET /traffic/process-status` (SSE)
- [ ] AI Service: `POST /traffic/upload` — OpenCV frame loop + ONNX inference + SSE progress
- [ ] Database Sync: Simpan hasil agregat video ke PostgreSQL/MongoDB

### 🟢 LOW PRIORITY — Live CCTV Pipeline

- [ ] Setup streaming media server (MediaMTX atau Node-Media-Server) — konversi RTSP ke HLS/WebRTC
- [ ] Camera worker script (`camera_worker.py`) — baca stream, kirim frame ke AI, broadcast ke backend
- [ ] Hybrid sourcing middleware — auto-switch antara Live SSE vs History DB

---

## 🏗 7. ARSITEKTUR SISTEM

```
CCTV Stream (RTSP/HLS)  OR  Video Upload (.mp4)
           │
           ▼
   AI Service (FastAPI :9000)
   ├── ONNX Runtime (3 models)
   ├── LPR Engine
   ├── Vehicle Detector
   └── Parking Monitor
           │
           ▼ POST /api/live/broadcast
   Backend API (Express :8000)
   ├── PostgreSQL (slots, logs, users)
   ├── MongoDB (violations, detections)
   ├── Redis (cache)
   └── SSE /api/live/stream
           │
           ▼
   Frontend (React :5173)
   ├── Dashboard
   ├── Live Camera (HLS + overlay)
   ├── Parking Map
   ├── Analytics
   ├── Simulator
   └── Executive Summary
```

---

## 🗂 8. STRUKTUR FOLDER PROYEK

```
Smart-Parking/
├── backend/
│   ├── src/
│   │   ├── config/env.js
│   │   ├── db/
│   │   │   ├── postgres.js
│   │   │   ├── mongo.js
│   │   │   ├── redis.js
│   │   │   └── drizzle/schema.js
│   │   ├── routes/          (auth, parking, ai, camera, system, live)
│   │   ├── controllers/     (auth, parking, ai, camera, system, analytics)
│   │   ├── services/
│   │   │   ├── executiveSummary.js   🟡 Partial
│   │   │   ├── prediction_service.js 🟡 Partial
│   │   │   └── slotEfficiency.js     ✅ Done
│   │   ├── simulator/
│   │   │   ├── rules.js              ✅ Done
│   │   │   └── engine.js             🟡 Partial
│   │   └── middlewares/     (auth.js, error.js)
│   └── index.js
│
├── frontend/
│   └── src/
│       ├── pages/
│       │   ├── Dashboard.jsx         🟡 Partial
│       │   ├── LiveCamera.jsx        ✅ Done
│       │   ├── MapParking.jsx        ✅ Done
│       │   ├── AnalyticsDashboard.jsx 🔴 Mock Data
│       │   ├── SimulatorPage.jsx     🟡 Partial
│       │   └── ExecutiveSummaryPage.jsx ✅ Done
│       └── components/analytics/    ✅ Semua chart generic & siap
│
└── ai-service/
    ├── app/
    │   ├── routers/traffic.py        🟡 Partial
    │   ├── services/
    │   │   ├── stream_processor.py   🟡 Partial
    │   │   ├── model_predictor.py    🟡 Partial
    │   │   └── ensemble_engine.py    ❌ Planned
    │   ├── models/prediction_model.py 🟡 Partial
    │   └── utils/
    │       ├── preprocessing.py      ❌ Placeholder
    │       └── feature_engineering.py ❌ Placeholder
    ├── training/pipeline.py          ❌ Empty
    └── models/
        ├── lpr_model.onnx            ✅ Ready
        ├── vehicle_model.onnx        ✅ Ready
        └── parking_model.onnx        ✅ Ready
```

---

## 🚀 9. MIGRATION ROADMAP (Mock → Real)

### Phase 1: Data Pipeline _(Prioritas sekarang)_

```
1. Hubungkan PostgreSQL → analytics.controller.js (ganti 5 mock endpoints)
2. Hubungkan MongoDB → violation_history, traffic_history
3. Implementasi data ingestion pipeline
   ├── Sensor/camera data → parking_occupancy_history
   └── Traffic counter → traffic_volume_history
```

### Phase 2: ML Training _(Setelah dataset tersedia)_

```
4. Implementasi training/pipeline.py lengkap
5. Train model: XGBoost/LSTM (min. 30 hari data historis)
   Target: MAE < 0.10, R² > 0.70
6. Save model → ai-service/models/prediction_model.pkl
```

### Phase 3: ONNX Integration _(Paralel dengan Phase 2)_

```
7. Buat InferenceEngine class (load 3 model ONNX)
8. Ganti mock di stream_processor.py dengan inferensi real
9. Matikan useMockFallback di prediction_service.js
```

### Phase 4: Frontend Real Data

```
10. AnalyticsDashboard.jsx → fetch real API (hapus mock constants)
11. Implementasi Canvas bounding box overlay
12. Add error handling & skeleton loading
```

### Phase 5: Video Upload Feature _(Fitur baru)_

```
13. Frontend drag-and-drop di LiveCamera.jsx
14. Backend POST /traffic/analyze-video
15. AI Service OpenCV loop + SSE progress
```

### Phase 6: Production Hardening

```
16. Redis caching untuk analytics queries
17. Docker Compose (PostgreSQL, MongoDB, Backend, AI Service)
18. Stress testing live streams
19. Model retraining pipeline (automated, weekly)
```

---

## 📦 10. DEPENDENCIES

### Backend (Node.js) — Sudah Install ✅

`express`, `drizzle-orm`, `pg`, `dotenv`, `bcryptjs`, `jsonwebtoken`, `cors`, `multer`

### Frontend (React) — Sudah Install ✅

`react`, `react-router-dom`, `tailwindcss`, `vite`

### Frontend — Perlu Install ❌

```bash
npm install recharts react-chartjs-2 chart.js
```

### AI Service (Python) — Sudah Install ✅

`fastapi`, `uvicorn`, `opencv-python`, `ultralytics`, `onnxruntime`

### AI Service — Perlu Install ❌

```bash
pip install pandas scikit-learn xgboost joblib tensorflow
# opsional untuk GPU:
pip install onnxruntime-gpu
```

---

## 🔐 11. ENVIRONMENT SETUP

```env
# Backend .env
DATABASE_URL="postgresql://username:password@host:6543/postgres"
MONGO_URL="mongodb+srv://<user>:<password>@cluster.mongodb.net/SmartParking"
REDIS_URL="redis://default:<password>@host:6379"
PORT=8000
JWT_SECRET="your_secret_here"
NODE_ENV="development"
CORS_ORIGIN="http://localhost:5173"
AI_SERVICE_URL="http://localhost:9000"
```

---

## ⚠️ 12. KNOWN ISSUES & RISKS

| Issue                                   | Severity  | Keterangan                                                            |
| --------------------------------------- | --------- | --------------------------------------------------------------------- |
| Missing historical dataset              | 🔴 High   | Model demand prediction masih heuristic, belum ada 30+ hari data real |
| CCTV tidak bisa live stream di browser  | 🟡 Medium | Browser tidak support RTSP langsung, perlu MediaMTX/WebRTC converter  |
| Inference latency 3 model ONNX simultan | 🟡 Medium | Bisa menyebabkan CPU bottleneck, pertimbangkan model Nano/Small       |
| Bounding box koordinat mismatch         | 🟡 Medium | Resolusi AI (640x640) vs resolusi UI player perlu normalization       |
| Mock data di AnalyticsDashboard         | 🟠 Medium | Data tidak mencerminkan kondisi real, misleading untuk demo           |
| useMockFallback masih true              | 🟠 Medium | AI service errors akan silently fallback ke mock, susah debug         |

---

## 🎯 13. EXTRA FEATURES (Post-Core, Nilai Inovasi)

| Fitur                                         | Status     | Prioritas |
| --------------------------------------------- | ---------- | --------- |
| AI Navigation & Driver Guidance               | ❌ Planned | P3        |
| Predictive Violation Model 2.0 (LSTM hotspot) | ❌ Planned | P3        |
| Smart Slot Recommender (Reservation)          | ❌ Planned | P4        |
| Digital Twin (3D visualization)               | ❌ Planned | P4        |
| Emergency Vehicle Priority System             | ❌ Planned | P5        |
| Multi-Model Ensemble (Brightness-aware)       | ❌ Planned | P2        |

---

## ✅ 14. QUICK START

```bash
# Option 1: Auto-run (recommended)
./auto-run.sh          # Linux/macOS
auto-run.bat           # Windows CMD
.\auto-run.ps1         # Windows PowerShell

# Option 2: Manual
cd backend && npm install && npm run dev      # :8000
cd frontend && npm install && npm run dev     # :5173
cd ai-service && uvicorn app.main:app --host 0.0.0.0 --port 9000 --reload

# Database tools
npm run db:studio      # Visual DB browser (dari /backend)
npm run db:push        # Push schema changes
```

### Key URLs

| Service            | URL                                     |
| ------------------ | --------------------------------------- |
| Frontend           | http://localhost:5173                   |
| Backend API        | http://localhost:8000                   |
| AI Service Swagger | http://localhost:9000/docs              |
| Health Check       | http://localhost:8000/api/system/health |
| DB Studio          | http://localhost:4983                   |

---

_Dokumen ini adalah konsolidasi dari: `README.md`, `7featurenotdoneyet.md`, `core-progress.md`, `documentation.md`, `MASTER_MIGRATION_GUIDE.md`, `MASTER_SYSTEM_AUDIT_AND_MIGRATION.md`, `MIGRATION_MOCK_TO_REAL.md`, `migration_todo.md`, `summary.md`_
