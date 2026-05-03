# Master Migration Guide: Smart-Parking AI Ecosystem
**Versi:** 1.0 (Integration Phase)
**Tujuan:** Panduan lengkap migrasi dari sistem Simulasi (Mock) ke sistem AI & Data Real-Time.

---

## 1. Arsitektur Sistem (High Level)
Sistem terdiri dari 3 blok utama yang saling berkomunikasi:
1.  **Frontend (React)**: UI Dashboard, Video Player, & Analytics Visualization.
2.  **Backend API (Node.js/Express)**: Orkestrator data, Manajemen User, & Penyimpanan History (PostgreSQL/MongoDB).
3.  **AI Service (Python/FastAPI)**: "Otak" utama untuk pemrosesan video, OCR Plat Nomor, & Prediksi Kepadatan menggunakan ONNX.

---

## 2. Status Model AI & Dataset
| Model | Jenis | Fungsi Utama | Status |
| :--- | :--- | :--- | :--- |
| `lpr_model.onnx` | LPR | Membaca plat nomor kendaraan secara real-time. | **Ready** |
| `vehicle_model.onnx` | YOLOv8 | Klasifikasi 6 jenis: Mobil, Motor, Bus, Truk, Van, Roda 3. | **Ready** |
| `parking_model.onnx` | YOLOv8 | Deteksi slot kosong & Parkir Liar (Illegal). | **Ready** |
| `visdrone_v1.onnx` | YOLOv8 | Deteksi kepadatan dari sudut pandang drone (Top-view). | *Training* |
| `bdd100k_v1.onnx` | YOLOv8 | Deteksi kepadatan Siang/Malam (Eye-level). | *Pending* |

---

## 3. Fitur per Halaman (Frontend)

### 3.1 Live Camera (`LiveCamera.jsx`)
*   **Fitur Saat Ini**: Playback HLS/M3U8, Resolusi Link YouTube, Sidebar List Kamera.
*   **Target Real-Time**:
    *   **AI Overlay**: Menggambar Bounding Boxes (kotak deteksi) di atas video secara dinamis.
    *   **Video Upload**: Section baru untuk upload file `.mp4` untuk dianalisis oleh AI.
    *   **Detection List**: Menampilkan tabel plat nomor yang baru saja terdeteksi (Last Detected Plates).

### 3.2 Dashboard (`Dashboard.jsx`)
*   **Fitur Saat Ini**: Grafik volume kendaraan (Mock), Status Area Parkir.
*   **Target Real-Time**:
    *   **Live Charts**: Sinkronisasi grafik dengan data jumlah kendaraan asli dari AI Service.
    *   **Occupancy Status**: Persentase slot terisi berdasarkan `parking_model.onnx`.

### 3.3 Predictive Analytics (`PredictiveAnalytics.jsx`)
*   **Fitur Saat Ini**: Prediksi okupansi 24 jam ke depan (Mock).
*   **Target Real-Time**:
    *   **ML Forecast**: Memanggil API `/ai/predict/demand` untuk mendapatkan estimasi kepadatan berdasarkan trend historis.

### 3.4 Executive Summary (`ExecutiveSummary.jsx`)
*   **Fitur Saat Ini**: Laporan statis & Rekomendasi (Rule-based).
*   **Target Real-Time**:
    *   **Automated Report**: Kalkulasi total kendaraan & pelanggaran per hari berdasarkan data asli di database.

---

## 4. Backend API & Endpoints (Node.js)

### 4.1 Traffic & Analytics
*   `GET /api/analytics/summary`: Mengambil ringkasan data dari database (bukan mock).
*   `GET /api/analytics/predictions`: Proxy ke AI Service untuk data ramalan cuaca/kepadatan.

### 4.2 Database Integration
*   **PostgreSQL**: Menyimpan `parking_slots` (status is_occupied) & `parking_logs`.
*   **MongoDB**: Menyimpan `violation_history` (Pelanggaran parkir liar hasil deteksi AI).

---

## 5. AI Service Endpoints (FastAPI - Port 9000)

### 5.1 Streaming & Inference
*   `GET /traffic/stream` (SSE): Mengirimkan hasil deteksi (count, plates, boxes) setiap detik ke frontend.
*   `GET /traffic/resolve`: Mengubah URL YouTube menjadi raw stream source untuk `hls.js`.

### 5.2 Video Processing (New)
*   `POST /traffic/upload`: Endpoint untuk menerima file video.
*   `GET /traffic/process-status`: SSE untuk mengirimkan progress bar analisis video (0% - 100%).

---

## 6. Langkah Eksekusi (The Next Steps)

1.  **AI Engine Setup**:
    *   Integrasikan `onnxruntime` di `ai-service/app/services/`.
    *   Ubah `StreamProcessor` agar memuat model dan melakukan inferensi per frame.
2.  **API Migration**:
    *   Hapus file `mockData.js` di backend.
    *   Ganti semua fungsi generator di `executiveSummary.js` dengan query database asli.
3.  **Frontend Connectivity**:
    *   Hubungkan `LiveCamera.jsx` ke SSE `/traffic/stream`.
    *   Implementasikan UI Canvas Overlay untuk bounding boxes.
4.  **Verification**:
    *   Test sistem dengan video upload pertama untuk memastikan deteksi plat nomor dan jenis kendaraan sudah akurat.

---
*Dokumen ini dibuat untuk memandu transisi total dari simulasi ke implementasi cerdas.*
