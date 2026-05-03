# To-Do List: Migration from Mock to Real AI

Dokumen ini berisi langkah-langkah detail untuk mengganti sistem simulasi statis menjadi sistem deteksi AI real-time menggunakan model ONNX.

## 🟩 Phase 1: AI Engine Implementation (Backend)
- [ ] **Dependency Setup**: Install `onnxruntime-gpu` (atau cpu) dan `opencv-python` di environment `ai-service`.
- [ ] **Model Initialization**: Buat class `InferenceEngine` di `app/services/` yang memuat 3 model ONNX saat aplikasi start.
- [ ] **Frame Preprocessing**: Implementasikan teknik *Letterbox* agar gambar tidak gepeng saat di-resize ke 640x640.
- [ ] **Batch Inference**: Optimasi pemrosesan agar model Vehicle dan LPR tidak bertabrakan saat dijalankan bersamaan.

## 🟦 Phase 2: Data Streaming Integration
- [ ] **Mock Removal**: Hapus fungsi `generate_mock_data()` di `app/routers/traffic.py`.
- [ ] **State Management**: Gunakan `Shared Dictionary` atau `Redis` (opsional) untuk menyimpan hasil deteksi terbaru agar bisa diakses oleh SSE.
- [ ] **Confidence Thresholding**: Tambahkan filter agar deteksi di bawah 40% tidak ditampilkan (untuk mengurangi *false positives*).
- [ ] **Hybrid Sourcing Middleware**: Buat logic di backend untuk switch otomatis antara data Live (SSE) vs data History (DB) berdasarkan ketersediaan stream.

## 🟧 Phase 3: Frontend Visualization
- [ ] **Overlay Layer**: Implementasikan layer transparan di atas `react-player` untuk menggambar kotak deteksi.
- [ ] **SSE Mapping**: Petakan field JSON baru (misal: `detections: [{box: [x,y,w,h], label: 'car'}]`) ke fungsi render.
- [ ] **Alert System**: Buat notifikasi otomatis di UI jika terdeteksi "Illegal Parking" dari `parking_model.onnx`.

## 🟪 Phase 4: Video Analytics Feature
- [ ] **Multipart Form Handler**: Setup FastAPI untuk menerima upload file besar.
- [ ] **Frame-by-Frame Processor**: Loop video file menggunakan OpenCV dan kirim progress ke frontend.
- [ ] **Database Sync Service**: Implementasikan logic untuk menyimpan hasil agregat video (total kendaraan/pelanggaran) ke PostgreSQL/MongoDB agar Dashboard & Analytics ikut ter-update.
- [ ] **Result Summary**: Tampilkan laporan akhir setelah video selesai dianalisis.
## 🟨 Phase 5: Global UI Synchronization (Cleaning Mock Data)
Pastikan seluruh halaman berikut sudah mengambil data dari API Real-Time:
- [ ] **Dashboard (Home)**: Update grafik "Traffic Overview" agar mengambil data dari history deteksi AI (bukan random array).
- [ ] **Predictive Analytics**: Sinkronisasi data "Parking Occupancy" dengan hasil deteksi dari `parking_model.onnx`.
- [ ] **Executive Summary**: Update generator laporan agar menghitung angka asli (Total Kendaraan, Pelanggaran Terdeteksi) dari database.
- [ ] **Notification Center**: Pastikan push notification (misal: "Plat Terblokir Terdeteksi") berasal dari hasil LPR nyata.

---
*Status: Planning Phase*
*Target: Full Real-Time Integration*
