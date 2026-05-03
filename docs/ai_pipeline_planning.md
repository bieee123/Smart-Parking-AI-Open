# AI Pipeline Integration Planning: Mock to Real & Video Analytics

Dokumen ini merinci rencana teknis untuk transisi dari data simulasi (mock) ke inferensi AI nyata menggunakan model ONNX yang tersedia, serta penambahan fitur **Upload Video Analytics**.

## 1. Status Model AI
| Model | Nama File | Fungsi | Status |
| :--- | :--- | :--- | :--- |
| **LPR Engine** | `lpr_model.onnx` | Deteksi & OCR Plat Nomor | Ready |
| **Vehicle Detector** | `vehicle_model.onnx` | Klasifikasi 6 jenis kendaraan | Ready |
| **Parking Monitor** | `parking_model.onnx` | Slot parkir & Parkir liar | Ready |
| **Crowded Drone** | `visdrone_v1.onnx` | Deteksi kepadatan (High angle) | *Training* |
| **Day/Night Street** | `bdd100k_v1.onnx` | Kepadatan jalan raya (Low angle) | *Pending* |

---

## 2. Fitur Baru: Video Upload Analytics
Karena keterbatasan akses CCTV publik, sistem akan mendukung analisis file video lokal.

### Workflow Teknis:
1. **Frontend (`LiveCamera.jsx`)**:
   - Menambahkan tab atau section "Upload Analytics".
   - Drag-and-drop area untuk file `.mp4` atau `.avi`.
   - Progress bar saat video diproses.
2. **Backend (`ai-service`)**:
   - Endpoint baru: `POST /traffic/analyze-video`.
   - Menggunakan `OpenCV (cv2.VideoCapture)` untuk membaca file video yang diunggah.
   - Loop per frame:
     - Jalankan `Vehicle Detector` + `LPR Engine`.
     - Hitung statistik per detik.
     - Kirim hasil via **SSE (Server-Sent Events)** ke UI agar visualisasi muncul secara real-time.

---

## 3. Integrasi "Mock to Real"
Mengganti data statis dengan hasil deteksi dari 3 model utama yang sudah siap.

### Modifikasi Backend (`app/services/stream_processor.py`):
- Memuat 3 model sekaligus saat startup menggunakan `onnxruntime`.
- **Logic Pipeline**:
  ```python
  frame = get_frame()
  # 1. Deteksi Kendaraan (Vehicle Detection)
  vehicles = vehicle_model.detect(frame)
  # 2. Untuk setiap kendaraan, jika area kecil -> Jalankan LPR
  for v in vehicles:
      plate = lpr_model.read(v.crop)
  # 3. Deteksi Area Parkir (Parking Detection)
  slots = parking_model.check_slots(frame)
  ```

---

## 4. UI/UX Concept di `LiveCamera.jsx`
- **Toggle Switch**: Pilih antara "Live CCTV" atau "Video File".
- **Overlay Dinamis**: Kotak deteksi (bounding boxes) akan digambar di atas video menggunakan koordinat asli dari model AI.
- **Analytics Dashboard**: Grafik jumlah kendaraan akan diperbarui secara otomatis berdasarkan deteksi pada video yang diputar.

---

## 5. Roadmap Eksekusi
1. **Phase 1**: Integrasi 3 model ONNX ke `ai-service` (Mengganti mock data di `/traffic/stream`).
2. **Phase 2**: Implementasi UI Upload Video di `LiveCamera.jsx`.
3. **Phase 3**: Pembuatan worker backend untuk memproses file video.
4. **Phase 4**: Integrasi model `VisDrone` dan `BDD100K` setelah training selesai.

> [!IMPORTANT]
> Fitur ini memungkinkan sistem tetap bisa didemonstrasikan meskipun tidak ada koneksi internet/CCTV luar, cukup dengan memutar rekaman video parkiran yang sudah ada.
