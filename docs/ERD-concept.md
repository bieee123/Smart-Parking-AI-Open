Siap, Gabrielle! Kita akan desain **ERD Database** untuk proyek _Smart Parking & Infrastructure Demand Management_ + kompatibel dengan **fitur tambahan**.
Desain ERD ini akan:

✔ memenuhi **core requirement (yang ada di gambar)**
✔ scalable untuk fitur tambahan (AI navigation, reservation, digital twin, emergency vehicle)
✔ clean & competition-ready

---

# ✅ **🔷 FINAL ERD Design — Smart Parking AI System**

Aku buatkan ERD dengan kelompok tabel (modular), lalu setelah itu aku tampilkan ERD versi diagram teks.

---

# 📌 **1. TABLE GROUPS (CATEGORY BASED)**

## **A. CCTV / REAL-TIME DETECTION TABLES**

### **1) cctv_cameras**

Menyimpan info kamera.

- id
- location_id
- stream_url
- status
- type (entrance, exit, lane, on-street)

### **2) detection_logs**

Hasil deteksi YOLOv8 (mobil/bike/truck).

- id
- camera_id
- timestamp
- vehicle_id (nullable)
- bbox
- class_name
- confidence

### **3) parking_slots**

Slot parkir (on-street & off-street).

- id
- location_id
- slot_number
- slot_type (offstreet/onstreet)
- is_reserved
- latitude / longitude
- status (free/occupied/unknown)

### **4) slot_occupancy_logs**

Untuk tracking histori occupancy.

- id
- slot_id
- timestamp
- status
- vehicle_id (nullable)

---

## **B. VEHICLE TRACKING + ILLEGAL PARKING**

### **5) vehicles**

- id
- plate_number
- type (car/bike/van/bus/truck)
- registered (boolean)

### **6) illegal_parking_logs**

AI mendeteksi mobil parkir sembarang.

- id
- vehicle_id
- camera_id
- location_id
- timestamp
- duration
- severity_score
- violation_type (blocking, double-park, no-parking-zone)

---

## **C. PREDICTION MODELS (CORE COMPETITION REQUIREMENTS)**

### **7) demand_forecast**

Time-series prediction result.

- id
- location_id
- timestamp_predicted
- predicted_demand
- confidence

### **8) traffic_data**

Input untuk analisis korelasi.

- id
- location_id
- timestamp
- traffic_flow_speed
- vehicle_count

---

## **D. LOCATION / INFRASTRUCTURE**

### **9) locations**

- id
- name
- type (parking_lot, onstreet_zone, road_segment)
- max_capacity
- coordinate_area

---

## **E. POLICY SIMULATOR (CORE FEATURE)**

### **10) simulation_scenarios**

- id
- title
- description
- parameters_json (policy changes)
- created_at

### **11) simulation_results**

- id
- scenario_id
- timestamp
- expected_congestion
- expected_occupancy
- illegal_parking_reduction
- policy_score

---

## **F. USER SYSTEM (for dashboard & reservation)**

### **12) users**

- id
- name
- email
- role (admin, operator, driver)
- password_hash

### **13) reservations** (fitur tambahan)

- id
- user_id
- slot_id
- start_time
- end_time
- status (active, expired, cancelled)

---

## **G. AI NAVIGATION & EMERGENCY**

### **14) navigation_routes**

AI-generated recommended route.

- id
- user_id
- from_location
- to_location
- route_json
- estimated_time

### **15) emergency_requests**

- id
- vehicle_id
- location_id
- timestamp
- priority_level
- status (in_progress/completed)

---

## **H. DIGITAL TWIN (extra feature)**

### **16) twin_state_logs**

Untuk visualisasi 3D state.

- id
- location_id
- timestamp
- slot_status_json
- traffic_status_json
- event_notes

---

# 🟦 **📊 FINAL ERD DIAGRAM (TEXT FORMAT)**

Gunakan ini sebagai struktur ERD dalam proposal/lomba.

```
LOCATIONS (id PK, name, type, max_capacity, coordinate_area)
    | 1 - many
    |
CCTV_CAMERAS (id PK, location_id FK, stream_url, status, type)

DETECTION_LOGS (id PK, camera_id FK, vehicle_id FK, timestamp, bbox, class_name, confidence)

PARKING_SLOTS (id PK, location_id FK, slot_number, slot_type, is_reserved, lat, long, status)
    | 1 - many
    |
SLOT_OCCUPANCY_LOGS (id PK, slot_id FK, timestamp, status, vehicle_id FK)

VEHICLES (id PK, plate_number, type, registered)

ILLEGAL_PARKING_LOGS (id PK, vehicle_id FK, camera_id FK, location_id FK,
                       timestamp, duration, severity_score, violation_type)

TRAFFIC_DATA (id PK, location_id FK, timestamp, traffic_flow_speed, vehicle_count)

DEMAND_FORECAST (id PK, location_id FK, timestamp_predicted, predicted_demand, confidence)

SIMULATION_SCENARIOS (id PK, title, description, parameters_json, created_at)
    | 1 - many
    |
SIMULATION_RESULTS (id PK, scenario_id FK, timestamp,
                    expected_congestion, expected_occupancy,
                    illegal_parking_reduction, policy_score)

USERS (id PK, name, email, role, password_hash)

RESERVATIONS (id PK, user_id FK, slot_id FK, start_time, end_time, status)

NAVIGATION_ROUTES (id PK, user_id FK, from_location, to_location, route_json, estimated_time)

EMERGENCY_REQUESTS (id PK, vehicle_id FK, location_id FK, timestamp, priority_level, status)

TWIN_STATE_LOGS (id PK, location_id FK, timestamp, slot_status_json, traffic_status_json, event_notes)
```

---

# 🟢 **ERD ini mendukung semua fitur:**

### ✔ core project (yang ada di gambar):

- demand prediction
- occupancy analysis
- violation analysis
- traffic correlation
- dashboard
- simulator

### ✔ fitur tambahan:

- AI navigation → table _navigation_routes_
- illegal parking prediction → logs + forecast model
- reservation → table _reservations_
- digital twin → _twin_state_logs_
- emergency allocation → _emergency_requests_

---

# Jika kamu mau, aku bisa lanjutkan:

✅ Visual ERD Diagram (gambar kotak-panah secara profesional)
✅ SQL table creation (.sql file lengkap)
✅ API endpoints untuk semua tabel
✅ Folder structure backend FastAPI + database

Mau dibuatkan versi visual ERD atau SQL?
