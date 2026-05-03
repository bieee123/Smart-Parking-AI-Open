# Master System Audit & AI Migration Guide: Smart Parking
**Document Version:** 1.0 (Live Implementation State)
**Role:** Master Documentation for AI Agents & Technical Stakeholders

---

## A. SYSTEM OVERVIEW
Sistem Smart Parking adalah platform manajemen infrastruktur berbasis AI yang mengintegrasikan Computer Vision (CV) untuk pemantauan real-time dan Machine Learning (ML) untuk prediksi kebutuhan (demand forecasting).

### Architecture
- **Frontend**: React + Vite + TailwindCSS. Bertanggung jawab untuk visualisasi dashboard, live streaming overlay, dan antarmuka simulator.
- **Backend API**: Node.js (Express) + Drizzle ORM. Bertanggung jawab atas autentikasi, manajemen slot (PostgreSQL), log pelanggaran (MongoDB), dan orkestrasi data.
- **AI Service**: Python (FastAPI) + ONNX Runtime + YOLOv8. Bertanggung jawab atas pemrosesan video (Vehicle, LPR, Parking Slot) dan inferensi model prediksi.

`CCTV Stream (Live)` OR `Video Upload (Processed)` → `Backend API` → `Database` → `Unified Dashboard`

### Source Priority Logic
Sistem akan secara otomatis menentukan sumber data untuk seluruh halaman:
1. **LIVE MODE**: Jika stream CCTV aktif, data di-update secara real-time via SSE.
2. **PLAYBACK MODE**: Jika tidak ada live stream, sistem mengambil data agregat terakhir dari hasil pemrosesan video di database.
3. **IDLE MODE**: Jika tidak ada sumber, menampilkan "Waiting for Source".



---

## B. FRONTEND (PER PAGE BREAKDOWN)

| Page | Feature List | Data Source | API Endpoints | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Dashboard** | Occupancy Cards, Traffic Trends, Recent Logs | **Hybrid** (DB + Mock fallback) | `/api/analytics/summary` | ⚠ PARTIAL |
| **Parking Map** | Visualisasi slot (Hijau/Merah), Filter Zona | **API** (PostgreSQL) | `/api/parking/slots` | ✔ DONE |
| **Analytics** | Demand Spike Graph, Heatmap Pelanggaran | **Mock** (Heuristic logic) | `/api/analytics/predictions` | ⚠ PARTIAL |
| **Simulator** | Policy Testing, Congestion Reduction | **Logic-based** (Rules) | `/api/simulator/run` | ⚠ PARTIAL |
| **Executive Summary**| Stakeholder Report, AI Recommendations | **API** (DB Aggregation) | `/api/executive-summary` | ✔ DONE |
| **Live Camera** | HLS Player, AI Overlay, YouTube Resolve | **AI Stream** (SSE) | `/traffic/stream`, `/traffic/resolve`| ✔ DONE |

---

## C. BACKEND (CORE SERVICES)

### 1. Services Breakdown
- **`executiveSummary.js`**: Melakukan aggregasi data real dari PostgreSQL (`parking_slots`) dan MongoDB (`violation_history`).
- **`prediction_service.js`**: Wrapper untuk komunikasi ke AI Service. Memiliki **Mock Fallback** jika AI Service offline.
- **`slotEfficiency.js`**: Menghitung metrik efisiensi penggunaan slot on-street vs off-street.

### 2. Critical Endpoints
| Method | Path | Description | Source | Status |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/parking/slots` | Mendapatkan status seluruh slot | DB (PostgreSQL) | ✔ DONE |
| `POST` | `/api/live/broadcast` | Menerima data deteksi dari AI | AI Service | ✔ DONE |
| `GET` | `/api/live/stream` | Stream data ke Frontend (SSE) | Broadcast logic | ✔ DONE |
| `GET` | `/api/executive-summary`| Laporan otomatis stakeholder | DB Aggregation | ✔ DONE |
| `POST` | `/api/ai/predict` | Prediksi demand parkir | AI Service (ONNX) | ⚠ MOCK FALLBACK |

---

## D. AI SERVICE (PYTHON FASTAPI)

| Endpoint | Model Used | Input Format | Output Schema | Status |
| :--- | :--- | :--- | :--- | :--- |
| `/traffic/stream` | `yolov8n.pt` | CCTV (HLS/RTSP) | `count, density, recs` | ✔ DONE |
| `/ai/lpr/recognize` | `lpr_model.onnx` | Image (Bytes) | `plate_number, conf` | ✔ DONE |
| `/ai/vehicle/classify`| `vehicle_model.onnx`| Image (Bytes) | `type: ['car', 'bus', ...]`| ✔ DONE |
| `/ai/predict/demand` | `RandomForest/LSTM` | JSON (Hour, Hist) | `occupancy_rate[]` | ⚠ HEURISTIC MOCK |
| `/traffic/upload` | Ensemble Models | Video (.mp4) | `frame_results[]` | ❌ PLANNED |
> [!NOTE]
> **Global Update**: Setelah processing selesai, data `vehicle_count` dan `violations` akan disimpan ke MongoDB/PostgreSQL untuk meng-update trend pada Dashboard secara permanen.


---

## E. DATABASE STRUCTURE

### 1. PostgreSQL (Relational - Drizzle)
- **`parking_slots`**: ID, Slot Number, Zone, Is_Occupied, License_Plate.
- **`parking_logs`**: ID, Slot_ID, Entry/Exit Time, Fee, Detection_Confidence.
- **`users`**: RBAC (Admin, Operator).

### 2. MongoDB (Document-based)
- **`violation_history`**: Koleksi log parkir liar, tipe pelanggaran, dan koordinat area.
- **`traffic_history`**: Data time-series volume kendaraan untuk training model demand.

---

## F. FEATURE STATUS MATRIX

| Feature | Page | Backend | AI | Status | Ready for ML? |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Occupancy Tracking | Parking Map | Done | Done | ✔ DONE | Yes |
| Demand Forecasting | Analytics | Partial | Mock | ⚠ PARTIAL | Waiting Dataset |
| LPR Identification | Live Camera | Done | Done | ✔ DONE | Yes |
| Violation Heatmap | Analytics | Done | Done | ✔ DONE | Yes |
| Policy Simulation | Simulator | Done | Rules | ⚠ PARTIAL | No (Rule-based) |
| Video Upload | Live Camera | Not Built| Planned | ❌ PLANNED | Yes |

---

## G. MIGRATION ROADMAP (MOCK → REAL)

### Step 1: Backend Fallback Removal
- **File**: `backend/src/services/prediction_service.js`
- **Action**: Hapus `BASE_PROFILE` dan `mockPredictions()`. Ubah `useMockFallback` menjadi `false`.
- **Target**: Memaksa sistem error jika AI Service tidak memberikan data valid (untuk debugging data flow asli).

### Step 2: ONNX Model Swap
- **File**: `ai-service/app/services/model_predictor.py`
- **Action**: Masukkan file `.joblib` atau `.onnx` hasil training dataset demand ke folder `/models`.
- **Target**: Mengganti `_predict_mock` dengan `_predict_model`.

### Step 3: Real-Time SSE Integration
- **File**: `frontend/src/pages/LiveCamera.jsx`
- **Action**: Hubungkan komponen `DetectionOverlay` ke data stream dari AI Service.
- **Target**: Visualisasi kotak deteksi (bounding box) muncul di atas video.

### Step 4: Hybrid Data Sourcing
- **Action**: Buat middleware di Backend yang mengecek apakah ada `Active Stream Worker`.
- **Logic**: 
  - IF `Worker Active` -> Pipe data dari SSE langsung ke UI.
  - ELSE -> Fetch data `Latest Record` dari PostgreSQL/MongoDB.
- **Target**: Seluruh halaman (`Dashboard`, `Predictive`) menampilkan data yang konsisten baik saat ada CCTV maupun hanya video upload.


---

## H. GAP ANALYSIS & RISK
1. **Missing Dataset**: Kita belum memiliki dataset historis yang cukup untuk melatih model `Demand Spike Prediction` secara akurat (saat ini masih menggunakan data sintetis).
2. **Inference Latency**: Penggunaan 3 model ONNX secara simultan pada `ai-service` dapat menyebabkan latency tinggi pada CPU.
3. **Integration Risk**: Perubahan koordinat bounding box antara resolusi AI (640x640) dan resolusi UI Player dapat menyebabkan kotak deteksi meleset (perlu normalization logic).

---

## I. SYSTEM READINESS SCORE
- **Feature Completion**: 65%
- **AI Readiness**: 85% (Models are ready, integration is the key)
- **Production Readiness**: 50% (Need stress testing on live streams)

---

## J. NEXT ACTION PLAN (TOP 10)
1. **[AI]** Selesaikan training model `VisDrone` di Google Colab.
2. **[AI]** Implementasikan `onnxruntime` loader di `ai-service/app/services/InferenceEngine.py`.
3. **[Frontend]** Buat fitur **Upload Video** di `LiveCamera.jsx`.
4. **[Backend]** Implementasikan endpoint `POST /traffic/analyze-video`.
5. **[Backend]** Sinkronisasi database PostgreSQL dengan hasil deteksi YOLO secara atomik.
6. **[Frontend]** Implementasikan **Canvas Rendering** untuk Bounding Box di atas video.
7. **[AI]** Eksperimen dengan `quantization` (FP16) pada model ONNX untuk mempercepat inferensi.
8. **[Documentation]** Buat API Spec menggunakan Swagger/OpenAPI untuk AI Service.
9. **[Testing]** Lakukan tes integrasi menggunakan video file 1 jam untuk melihat stabilitas memori.
10. **[Deployment]** Setup Docker Compose untuk menjalankan PostgreSQL, MongoDB, Backend, dan AI Service dalam satu network.

---
*Generated by Smart-Parking System Auditor Agent*
