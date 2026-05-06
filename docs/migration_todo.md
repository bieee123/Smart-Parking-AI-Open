# To-Do List: Migration from Mock to Real AI

Dokumen ini berisi langkah-langkah detail untuk mengganti sistem simulasi statis menjadi sistem deteksi AI real-time menggunakan model ONNX.

## 🟩 Phase 1: AI Engine Implementation (Backend)
- [x] **Dependency Setup**: Install `onnxruntime` and `opencv-python`.
- [x] **Model Initialization**: `InferenceEngine` loads 4 models (Vehicle, LPR, Illegal, Crowd).
- [x] **Frame Preprocessing**: Letterbox resizing implemented for 640x640.
- [x] **Batch Inference**: Optimized via `EnsembleEngine`.

## 🟦 Phase 2: Data Streaming Integration
- [x] **Mock Removal**: `analyze_frame` now prefers real AI results.
- [x] **State Management**: Real-time sync to Backend Ingestion API.
- [x] **Confidence Thresholding**: Filtered at 20% (tunable).
- [x] **Hybrid Sourcing Middleware**: AI-service broadcasts via SSE.

## 🟧 Phase 3: Frontend Visualization
- [x] **Overlay Layer**: SVG/Canvas overlay in `LiveCamera.jsx`.
- [x] **SSE Mapping**: Direct mapping of AI boxes to UI.
- [x] **Alert System**: Visual "ILLEGAL" markers for violations.

## 🟪 Phase 4: Video Analytics Feature
- [x] **Multipart Form Handler**: FastAPI `/traffic/upload` implemented.
- [x] **Frame-by-Frame Processor**: OpenCV background loop in `video.py`.
- [x] **Database Sync Service**: Aggregate results saved to MongoDB via Ingestion API.
- [x] **Result Summary**: Narrative summary generated after analysis.
## 🟨 Phase 5: Global UI Synchronization (Cleaning Mock Data)
Pastikan seluruh halaman berikut sudah mengambil data dari API Real-Time:
- [ ] **Dashboard (Home)**: Update grafik "Traffic Overview" agar mengambil data dari history deteksi AI (bukan random array).
- [ ] **Predictive Analytics**: Sinkronisasi data "Parking Occupancy" dengan hasil deteksi dari `parking_model.onnx`.
- [ ] **Executive Summary**: Update generator laporan agar menghitung angka asli (Total Kendaraan, Pelanggaran Terdeteksi) dari database.
- [ ] **Notification Center**: Pastikan push notification (misal: "Plat Terblokir Terdeteksi") berasal dari hasil LPR nyata.

## 🟫 Phase 6: Multi-Model Ensemble Implementation (Optimization)
- [x] **Brightness Detector Module**: Lighting mode analysis (Day/Night).
- [x] **Parallel Inference Engine**: `ThreadPoolExecutor` for concurrent models.
- [x] **NMS Merge Logic**: deduplication across multiple models.
- [x] **Dynamic Switching**: Mode-aware model routing implemented.

---
*Status: Planning Phase*
*Target: Full Real-Time Integration*
