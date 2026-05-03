Baik Gabrielle — aku akan membuat **planning 1 bulan yang sangat terstruktur**, dengan **prioritas utama adalah fitur yang tertulis pada gambar (core competition requirements)**.
**4 fitur tambahan baru akan dikerjakan setelah fitur inti selesai**, sesuai permintaanmu.

---

# ✅ **📅 1-Month Priority-Based Plan (Core First, Extra Features Later)**

**Case Title:** Smart Parking and Infrastructure Demand Management
**Goal Utama:** Menyelesaikan *parking demand prediction, occupancy analysis, violation analysis,* dashboard, simulator, dan executive summary* (sesuai gambar).
**Extra Features:**

1. AI Navigation & Driver Guidance
2. Illegal Parking Prediction 2.0 (Predictive Violation Model)
3. Parking Reservation System (AI Slot Suggestion)
4. Digital Twin
5. Priority Allocation for Emergency Vehicles

---

# 🗓 **WEEK 1 — Fokus 100% pada Core Model & Dataset**

## **Day 1 – Day 2: Problem Understanding + Architecture**

✔ Baca ulang case, analisa challenge
✔ Tentukan workflow:

* CCTV feed → Object Detection → Parking Occupancy Model
* Historical data → Time-series predictive model
* Traffic data → Correlation model
  ✔ Arsitektur lengkap dibuat

**Output:** Architecture Diagram + User Flow

---

## **Day 3 – Day 4: Dataset Collection (Core Only)**

Core dataset yang diperlukan sesuai gambar:

1. **Historical parking occupancy**
2. **Area vehicle volume data**
3. **Traffic flow speed data**
4. **CCTV or parking image dataset** untuk model occupancy (PKLot / CNRPark)

**Output:** Dataset folder + preprocessing pipeline

---

## **Day 5 – Day 7: Build Core AI Models**

### 1) **Parking Occupancy Prediction Model**

* Train YOLOv8/YOLOv10
* Output: Occupied / Free / Unknown
* Eval mAP

### 2) **Parking Demand Spike Prediction**

* Gunakan: LSTM, Prophet, atau XGBoost
* Input:

  * historical volume
  * traffic speed
  * time & activity pattern

### 3) **Traffic Smoothness Analysis**

* Correlate:

  * On-street parking volume
  * Off-street parking volume
  * Traffic speed
* Regression model untuk melihat impact

**Output:**
✔ 3 Core Models selesai (no dashboard yet)
✔ mAP, RMSE, dan correlation metrics

---

# 🗓 **WEEK 2 — Integrasi Model + Dashboard + Violation Analysis**

## **Day 8 – Day 10: Backend Logic (CRM + CCTV Integration)**

Sesuai gambar:

* Integrasi API occupancy model
* Integrasi CCTV stream
* Data pipeline dari AI model → Backend → Dashboard

**Output:** Basic working backend

---

## **Day 11 – Day 13: Dashboard (Core Requirement)**

Dashboard harus bisa:

* Visualization of parking load distribution
* Visualization of space availability
* Traffic-speed map
* Peak demand prediction graph

Tech stack example:

* Frontend: React
* Backend: FastAPI / Flask

**Output:** Dashboard v1 live

---

## **Day 14: Parking Violation Combination Analysis**

Sesuai gambar:

* Analisis gabungan antara:

  * Violation data (illegal parking)
  * Bottleneck points
* Output:

  * Heatmap
  * Root cause map
  * Risk score per zone

**Output:** Violation Heatmap + Score

---

# 🗓 **WEEK 3 — Simulator + Optimization + Executive Summary**

## **Day 15 – Day 17: Parking Management Simulator**

Fungsi sesuai gambar:

* Simulate policy changes:

  * on-street vs off-street allocation
  * illegal parking penalty
  * redistribution of vehicles
* AI menghitung:

  * perubahan traffic flow
  * congestion reduction

**Output:** Simulator v1 + scenario testing

---

## **Day 18 – Day 19: Model Optimization**

* ONNX Runtime
* Quantization
* FPS improvement untuk CCTV live detection
* Latency < 200ms

**Output:** Optimized model pipeline

---

## **Day 20 – Day 21: Executive Summary**

Isi sesuai gambar:

* Stakeholder report
* Key findings
* Recommendations
* Dashboard insights
* Bottleneck reduction strategy

**Output:** Executive Summary Final

---

# 🗓 **WEEK 4 — ONLY NOW Extra Features Begin (If Core is Done)**

Jika semua fitur utama sudah selesai **pada minggu ke-3**, maka Week 4 dipakai hanya untuk fitur tambahan.

Urutan Prioritas Fitur Tambahan:

---

## **Day 22 – Day 23: AI Navigation & Driver Guidance**

Input:

* Real-time free space
* Predicted demand
  Output:
* Recommended route
* Avoid congestion
* ETA calculation

---

## **Day 24 – Day 25: Predictive Violation Model**

Meningkatkan model “illegal parking prediction” dengan:

* LSTM forecasting for violation hotspots
* Time-based risk score
* Vehicle-type-based violation probability

---

## **Day 26 – Day 27: Parking Reservation Suggestion (AI Slot Recommender)**

Model uses:

* Historical occupancy
* Distance to entrance
* Price
* Traffic impact

Output:

* Smart slot recommendation
* Multi-criteria ranking system

---

## **Day 28: Digital Twin**

* 3D visual: Real-time parking lot
* Live occupancy overlay
* Violation alerts visualized in 3D

---

## **Day 29 – Day 30: Emergency Vehicle Priority System**

* Auto-block clearance
* Immediate reservation
* Fastest-path algorithm
* Broadcast alert to dashboard

---

# 🎯 **Final Deliverables (For AI Competition)**

## Core (Wajib – dari gambar)

✔ Parking occupancy prediction
✔ Demand spike prediction
✔ On-street vs off-street efficiency analysis
✔ Violation & bottleneck combination analysis
✔ Dashboard
✔ Simulator
✔ Executive Summary

## Extra (Opsional, nilai inovasi)

✔ AI Navigation
✔ Predictive Violation v2
✔ Reservation Recommender
✔ Digital Twin
✔ Emergency Vehicle Priority

---

# Jika kamu mau, aku bisa lanjut buat:

✅ Gantt Chart 1 bulan (versi tabel / grafik)
✅ System architecture diagram (professional)
✅ Workflow diagram end-to-end
✅ Technical report full version untuk kompetisi

Mau dibuatkan yang mana dulu?
