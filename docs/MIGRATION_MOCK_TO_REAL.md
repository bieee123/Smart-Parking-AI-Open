# Migrasi: Mock / Rule-Based → Real ML & Data-Driven

**Smart Parking & Infrastructure Demand Management — Case 5**  
Dibuat: 2026-04-07 | Versi: 1.0.0

---

## Daftar Isi

1. [Ringkasan Eksekutif](#1-ringkasan-eksekutif)
2. [Backend Services](#2-backend-services)
3. [AI / ML Service (Python FastAPI)](#3-ai--ml-service-python-fastapi)
4. [Frontend Analytics Dashboard](#4-frontend-analytics-dashboard)
5. [Database & Data Pipeline](#5-database--data-pipeline)
6. [Testing](#6-testing)
7. [Urutan Migrasi yang Disarankan](#7-urutan-migrasi-yang-disarankan)
8. [Checklist Final](#8-checklist-final)

---

## 1. Ringkasan Eksekutif

Sistem saat ini berjalan 100% dengan **mock data** dan **rule-based logic**. Ketika dataset dan ML model tersedia, berikut adalah seluruh komponen yang perlu diganti, diurutkan berdasarkan prioritas.

| Prioritas | Modul | Kompleksitas | Estimasi Usaha |
|-----------|-------|-------------|----------------|
| 🔴 P0 | `executiveSummary.js` — Mock data generators | Rendah | 1-2 hari |
| 🔴 P0 | `analytics.controller.js` — Mock endpoints | Rendah | 1-2 hari |
| 🔴 P0 | `prediction_service.js` — AI fallback mock | Sedang | 2-3 hari |
| 🟡 P1 | `prediction_model.py` — Baseline heuristic | Sedang | 3-5 hari |
| 🟡 P1 | `model_predictor.py` — Heuristic mock | Sedang | 2-3 hari |
| 🟡 P1 | `slotEfficiency.js` — Sudah pakai PostgreSQL ✅ | **Siap** | 0 hari |
| 🟢 P2 | `simulator/rules.js` — Rule engine | Tinggi | 5-7 hari |
| 🟢 P2 | `training/pipeline.py` — Empty pipeline | Sedang | 3-5 hari |
| 🟢 P2 | Preprocessing & Feature Engineering | Sedang | 3-5 hari |

---

## 1.5. New Feature: Video Upload Analytics
Kebutuhan mendesak untuk memproses file video lokal sebagai alternatif CCTV yang tidak stabil.

| Komponen | Status Mock | Implementasi Real |
| :--- | :--- | :--- |
| **Frontend UI** | Belum ada | Section "Upload Analytics" di `LiveCamera.jsx` dengan drag-and-drop. |
| **File Handler** | N/A | FastAPI `UploadFile` handler untuk menyimpan video sementara. |
| **Processing** | N/A | OpenCV frame loop + ONNX Inference + SSE progress stream. |

---


## 2. Backend Services

### 2.1 `backend/src/services/executiveSummary.js`

| Fungsi Saat Ini | Sumber Data | Yang Perlu Diganti |
|-----------------|-------------|-------------------|
| `generateOccupancyData()` | Mock — baseOccupancy per jam hardcoded | **Query PostgreSQL** `parking_slots` (count is_occupied) + **AI Inference** `parking_model.onnx` |
| `generatePredictedTrends()` | Mock — baseProfile dict + random variation | **Panggil ML Model** via `prediction_service.js` → `POST /ai/predict/demand` |
| `generateViolationSummary()` | Mock — random count × baseCount | **AI Detection** `parking_model.onnx` (Illegal class) -> Save to MongoDB `violation_history` |
| `generateRecommendations()` | Rule-based IF/ELSE (11 rules) | **Pertahankan rule-based** dengan input dari real-time density AI. |

| `generateExecutiveSummary()` | Master function memanggil 3 generator di atas | Ganti panggilan mock → panggil real data service |

**Contoh perubahan:**

```diff
// SEBELUM (mock)
- function generateOccupancyData() {
-   const areas = [
-     { area: 'Downtown Central', capacity: 250,
-       baseOccupancy: hour >= 7 && hour <= 9 ? 0.72 : ... }
-   ];
-   areas.forEach(a => {
-     const variation = (Math.random() - 0.5) * 0.06;
-     a.occupancy_rate = a.baseOccupancy + variation;
-   });
-   return { ... };
- }

// SESUDAH (real data)
+ import { db } from '../db/postgres.js';
+ import { parkingSlots } from '../db/drizzle/schema.js';
+ import { getCollection } from '../db/mongo.js';
+
+ async function generateOccupancyData() {
+   // Query live slots
+   const slots = await db.select().from(parkingSlots);
+   const total = slots.length;
+   const occupied = slots.filter(s => s.is_occupied).length;
+
+   // Group by area from MongoDB or PostgreSQL
+   const areaStats = await db
+     .select({
+       zone: parkingSlots.zone,
+       total: count(),
+       occupied: sum(parkingSlots.is_occupied ? 1 : 0),
+     })
+     .from(parkingSlots)
+     .groupBy(parkingSlots.zone);
+
+   return { total_slots: total, occupied_slots: occupied, areas: areaStats, ... };
+ }
```

```diff
// SEBELUM (mock prediction)
- function generatePredictedTrends() {
-   const baseProfile = { 0: 0.15, 1: 0.12, ..., 14: 0.92, ... };
-   const predictions = [];
-   for (let i = 1; i <= 6; i++) {
-     const base = baseProfile[(currentHour + i) % 24];
-     const variation = (Math.random() - 0.5) * 0.04;
-     predictions.push(base + variation);
-   }
-   return { predictions, trend_label: 'stable', ... };
- }

// SESUDAH (ML prediction)
+ import { predictDemand } from './prediction_service.js';
+
+ async function generatePredictedTrends() {
+   const currentHour = new Date().getHours();
+   const mlResult = await predictDemand({
+     current_hour: currentHour,
+     horizon: 6,
+     history: await getRecentHistory(),  // dari DB
+   });
+
+   return {
+     predictions: mlResult.predictions.map((rate, i) => ({
+       hour: (currentHour + i + 1) % 24,
+       predicted_occupancy_rate: rate,
+       confidence: mlResult.confidence,
+     })),
+     trend_label: determineTrend(mlResult.predictions),
+     bottleneck_risk_level: assessRisk(mlResult.predictions),
+     model_type: mlResult.metadata.model_type,  // "lstm_v2", "xgboost", dll.
+   };
+ }
```

---

### 2.2 `backend/src/services/prediction_service.js`

| Komponen Saat Ini | Yang Perlu Diganti |
|-------------------|-------------------|
| `mockPredictions()` — BASE_PROFILE dict + random | **Hapus** setelah ML model siap. Biarkan sebagai fallback darurat. |
| `predictDemand()` — try AI → catch → mock fallback | **Pertahankan retry logic**. Hapus mock fallback atau jadikan `fallback: false` di config. |
| `predictDaily()` — mock 24 values | **Panggil** `POST /ai/predict/demand/daily` — mock fallback dihapus. |
| `predictWeekly()` — mock weekday/weekend pattern | **Panggil** `POST /ai/predict/demand/weekly` — mock fallback dihapus. |
| `predictionHealth()` — sudah benar | **Tidak perlu diganti** — sudah call real AI health endpoint. |

**Yang perlu ditambahkan:**

```javascript
// Config toggle untuk production vs development
const config = {
  useMockFallback: process.env.NODE_ENV === 'development',  // false di production
  aiServiceUrl: process.env.AI_SERVICE_URL,
  timeout: 5000,
};
```

---

### 2.3 `backend/src/controllers/analytics.controller.js`

| Endpoint | Status Saat Ini | Yang Perlu Diganti |
|----------|----------------|-------------------|
| `getOccupancyTrends` | Mock — `rand()` + `pointMap` | **Query** `parking_occupancy_history` (PostgreSQL/MongoDB time-series) |
| `getTrafficCorrelation` | Mock — `rand(0.60, 0.95)` | **Hitung** Pearson correlation dari `traffic_volume_history` |
| `getViolationHotspots` | Mock — `rand(15, 280)` + `pick()` | **Query** `violation_history` aggregate by zone |
| `getBottlenecks` | Mock — 3 static records | **Query** `bottleneck_map` collection / table |
| `getEfficiency` | Mock — `rand()` untuk semua metric | **Query** `slot_usage_trends` + `parking_logs` |
| `getSlotEfficiencyController` | ✅ Sudah pakai PostgreSQL | **Tidak perlu diganti** — sudah real |
| `getExecutiveSummary` | ✅ Sudah memanggil service | Service-nya yang diganti (lihat 2.1) |

---

### 2.4 `backend/src/simulator/rules.js`

| Komponen | Status | Yang Perlu Diganti |
|----------|--------|-------------------|
| `evaluateOccupancy()` | ✅ Rule-based, **pertahankan** | Bisa tetap rule-based atau diganti ML classifier |
| `detectBottleneck()` | ✅ Rule-based, **pertahankan** | Bisa ditingkatkan dengan ML anomaly detection |
| `evaluateViolations()` | ✅ Rule-based, **pertahankan** | Bisa tetap rule-based |
| `suggestAlternative()` | ✅ Rule-based, **pertahankan** | Bisa ditingkatkan dengan optimization algorithm |
| `calculateEfficiency()` | ✅ Rule-based formula, **pertahankan** | Formula bisa di-tune berdasarkan historical data |
| `simulatePolicy()` | Mock — elasticity assumptions | **Ganti** dengan causal inference model atau reinforcement learning |

**Catatan:** Simulator rule engine **tidak harus diganti**. Bisa tetap berjalan paralel dengan ML. ML hanya memberikan input yang lebih akurat ke rule engine.

---

## 3. AI / ML Service (Python FastAPI)

### 3.1 `ai-service/app/models/prediction_model.py`

| Komponen | Status Saat Ini | Yang Perlu Diganti |
|----------|----------------|-------------------|
| `_baseline_predict()` | ✅ Realistic heuristic, **pertahankan sebagai fallback** | Tidak diganti — jadi safety net |
| `_predict_with_model()` | ✅ Sudah siap terima sklearn/ONNX | **Implementasi** feature engineering yang sesuai dengan model training |
| `load_model()` | ✅ Sudah support .pkl, .joblib, .onnx | **Tidak perlu diganti** |
| `save_model()` | ✅ Sudah implementasi | **Tidak perlu diganti** |
| `predict_daily()` | Memanggil `predict()` | Otomatis berubah saat `predict()` pakai model |
| `predict_weekly()` | Memanggil `predict()` | Otomatis berubah saat `predict()` pakai model |

### 3.2 `ai-service/app/services/model_predictor.py`

| Komponen | Status | Yang Perlu Diganti |
|----------|--------|-------------------|
| `_predict_mock()` | ✅ Heuristic, **pertahankan sebagai fallback** | Tidak diganti |
| `_predict_model()` | ⚠️ Placeholder features | **Ganti** feature engineering sesuai training pipeline |
| `load_model()` | ✅ Sudah implementasi | Tidak perlu diganti |

### 3.3 `ai-service/training/pipeline.py`

| Step | Status Saat Ini | Yang Perlu Diimplementasi |
|------|----------------|--------------------------|
| `load_data()` | Empty dataframe placeholder | **Implementasi**: `pd.read_csv()` atau query DB (PostgreSQL/MongoDB) |
| `preprocess()` | Passthrough | **Implementasi**: missing value imputation, dedup, normalization |
| `engineer_features()` | Passthrough | **Implementasi**: temporal, lag, rolling, external features |
| `split_data()` | Empty lists | **Implementasi**: chronological time-series split |
| `train()` | `self.model = "baseline"` | **Implementasi**: RandomForest, XGBoost, LSTM, atau model lain |
| `evaluate()` | Placeholder metrics | **Implementasi**: MAE, RMSE, MAPE, R² dari `sklearn.metrics` |
| `save()` | Metadata only | **Implementasi**: `joblib.dump(model)` atau ONNX export |

**Dependencies yang perlu ditambahkan ke `requirements.txt`:**

```txt
pandas>=2.0.0
scikit-learn>=1.5.0
xgboost>=2.0.0          # opsional
tensorflow>=2.15.0      # opsional (untuk LSTM)
joblib>=1.3.0
```

### 3.4 `ai-service/app/utils/preprocessing.py`

Semua fungsi saat ini **placeholder log message only**. Perlu implementasi real:

| Fungsi | Implementasi yang Diperlukan |
|--------|-----------------------------|
| `handle_missing_values()` | `df.ffill()`, `df.fillna(df.mean())`, atau `SimpleImputer` |
| `remove_duplicates()` | `df.drop_duplicates(subset=['timestamp', 'slot_id'])` |
| `normalize_numeric()` | `MinMaxScaler` atau `StandardScaler` dari sklearn |
| `encode_categorical()` | `pd.get_dummies()` atau `OneHotEncoder` |
| `handle_outliers()` | IQR method, Z-score, atau `Winsorizer` |

### 3.5 `ai-service/app/utils/feature_engineering.py`

Semua fungsi saat ini **placeholder log message only**. Perlu implementasi real:

| Fungsi | Implementasi yang Diperlukan |
|--------|-----------------------------|
| `add_temporal_features()` | Extract hour, dayofweek, month, is_weekend, cyclic encoding (sin/cos) |
| `add_lag_features()` | `df.shift(1)`, `df.shift(3)`, `df.shift(24)` untuk autoregressive features |
| `add_rolling_features()` | `df.rolling(6).mean()`, `df.rolling(24).std()`, dll |
| `add_external_features()` | Join weather API, holiday calendar, event database |
| `create_target()` | `df['target'] = df['is_occupied'].shift(-horizon)` |

---

## 4. Frontend Analytics Dashboard

### 4.1 `frontend/src/pages/AnalyticsDashboard.jsx`

| Komponen | Status Saat Ini | Yang Perlu Diganti |
|----------|----------------|-------------------|
| Mock data constants | `MOCK_OCCUPANCY_HOURLY`, `MOCK_DEMAND_DATA`, dll | **Ganti** dengan `fetch()` call ke API endpoints |
| `loading` state | `setTimeout(() => setLoading(false), 1200)` | **Ganti** dengan `await fetch()` — set loading saat data di-fetch |
| `useEffect` data fetching | **Tidak ada** — hardcode data | **Tambahkan** `useEffect` yang memanggil `/api/analytics/...` endpoints |

**Contoh perubahan:**

```diff
// SEBELUM (mock data hardcoded)
- const MOCK_OCCUPANCY_HOURLY = [12, 8, 5, 4, 5, 10, 35, 68, ...];
- const MOCK_DEMAND_DATA = [
-   { hour: '+1h', predicted: 72, actual: 68 },
-   ...
- ];

// SESUDAH (real API call)
+ import { useState, useEffect } from 'react';
+
+ export default function AnalyticsDashboard() {
+   const [occupancyData, setOccupancyData] = useState(null);
+   const [predictionData, setPredictionData] = useState(null);
+   const [violationData, setViolationData] = useState(null);
+   const [loading, setLoading] = useState(true);
+   const [error, setError] = useState(null);
+
+   useEffect(() => {
+     async function fetchData() {
+       try {
+         const [occ, pred, viol] = await Promise.all([
+           fetch('/api/analytics/occupancy/trends?range=7d').then(r => r.json()),
+           fetch('/api/analytics/executive-summary').then(r => r.json()),
+           fetch('/api/analytics/violation/hotspots').then(r => r.json()),
+         ]);
+         setOccupancyData(occ.data);
+         setPredictionData(pred.data);
+         setViolationData(viol.data);
+       } catch (err) {
+         setError(err.message);
+       } finally {
+         setLoading(false);
+       }
+     }
+     fetchData();
+   }, []);
+
+   if (loading) return <SkeletonLoader />;
+   if (error) return <ErrorMessage error={error} />;
+
+   return <DashboardCharts data={occupancyData} predictions={predictionData} />;
+ }
```

### 4.2 Chart Components

| Komponen | Status | Perubahan |
|----------|--------|-----------|
| `OccupancyChart.jsx` | ✅ SVG line chart, siap terima data props | **Tidak perlu diganti** — sudah generic |
| `PredictedDemandChart.jsx` | ✅ SVG bar chart, siap terima data props | **Tidak perlu diganti** |
| `CorrelationChart.jsx` | ✅ SVG horizontal bars | **Tidak perlu diganti** |
| `ViolationHeatmap.jsx` | ✅ CSS grid heatmap | **Tidak perlu diganti** |
| `BottleneckMap.jsx` | ✅ CSS/HTML visual | **Tidak perlu diganti** |
| `EfficiencyStats.jsx` | ✅ Card grid | **Tidak perlu diganti** |

**Kesimpulan:** Semua chart components sudah **generic dan reusable**. Hanya `AnalyticsDashboard.jsx` yang perlu diganti dari mock data → API calls.

---

## 5. Database & Data Pipeline

### 5.1 Data Sources yang Perlu Dihubungkan

| Sumber Data | Target Module | Endpoint/Query |
|-------------|--------------|----------------|
| PostgreSQL `parking_slots` | `executiveSummary.js`, `slotEfficiency.js` | `SELECT * FROM parking_slots` |
| PostgreSQL `parking_logs` | `slotEfficiency.js`, `executiveSummary.js` | `SELECT * FROM parking_logs WHERE status = 'active'` |
| MongoDB `violation_history` | `executiveSummary.js`, analytics controller | `db.violation_history.aggregate([...])` |
| MongoDB `parking_occupancy_history` | `analytics.controller.js` (trends) | Time-series query by area + timestamp |
| MongoDB `traffic_volume_history` | `analytics.controller.js` (correlation) | Time-series query + calculate correlation |
| MongoDB `bottleneck_map` | `analytics.controller.js` (bottlenecks) | `db.bottleneck_map.find({ resolution_status: 'active' })` |
| MongoDB `slot_usage_trends` | `analytics.controller.js` (efficiency) | `db.slot_usage_trends.find({ granularity: 'daily' })` |
| AI Service `/ai/predict/demand` | `prediction_service.js`, `executiveSummary.js` | `POST` dengan history payload |

### 5.2 Schema Database

Database schema sudah siap di:
- `backend/src/db/schema/SQL_SCHEMA.sql` (PostgreSQL)
- `backend/src/db/schema/MONGODB_SCHEMA.js` (MongoDB)

Tidak ada perubahan schema yang diperlukan — schema sudah dirancang untuk menampung data real.

---

## 6. Testing

| Test File | Status Saat Ini | Yang Perlu Diganti/Ditambahkan |
|-----------|----------------|-------------------------------|
| `ai-service/tests/test_prediction_model.py` | ✅ 51 tests pass | **Tambahkan** tests dengan model real (load .pkl/.onnx) |
| `ai-service/tests/test_pipeline.py` | ✅ 30 tests pass | **Ganti** mock patch → real data fixtures |
| `ai-service/tests/test_api_contract.py` | ✅ 25 tests pass | **Pertahankan** — contract tests tetap valid |
| `backend/test/prediction_service.test.js` | ✅ 17 tests pass | **Tambahkan** tests dengan AI service real |
| `backend/tests/test_api.py` | Sudah ada | **Tambahkan** tests untuk `/analytics/executive-summary` |

**Test baru yang perlu dibuat:**
- Integration test: Backend → AI Service → ML Model → Response
- E2E test: Full pipeline `load_data → preprocess → train → evaluate → save`
- Data quality test: Validasi schema data dari PostgreSQL/MongoDB

---

## 7. Urutan Migrasi yang Disarankan

### Phase 1: Data Pipeline (Minggu 1-2)

```
1. Hubungkan database PostgreSQL → backend
   ├── Test query parking_slots, parking_logs
   └── Verifikasi data mengalir

2. Hubungkan database MongoDB → backend
   ├── Test query violation_history, bottleneck_map
   └── Verifikasi time-series queries

3. Implementasi data ingestion pipeline
   ├── Sensor data → parking_occupancy_history
   ├── Camera data → violation_history
   └── Traffic counter → traffic_volume_history
```

### Phase 2: Real Data di Backend (Minggu 3-4)

```
4. Ganti generateOccupancyData() → query PostgreSQL
5. Ganti generateViolationSummary() → query MongoDB
6. Ganti getOccupancyTrends() → query time-series
7. Ganti getViolationHotspots() → aggregate MongoDB
8. Ganti getBottlenecks() → query active bottlenecks
9. Ganti getTrafficCorrelation() → hitung Pearson dari real data
```

### Phase 3: ML Model Training (Minggu 5-7)

```
10. Implementasi training/pipeline.py
    ├── load_data() dari database
    ├── preprocess() dengan pandas
    ├── engineer_features() dengan lag/rolling features
    └── train() dengan XGBoost/LSTM

11. Train model pertama
    ├── Dataset: minimal 30 hari historical data
    ├── Target: occupancy_rate (next hour)
    └── Metric: MAE < 0.10, R² > 0.70

12. Save model → ai-service/models/prediction_model.pkl
```

### Phase 4: ML Inference Integration (Minggu 8)

```
13. prediction_model.py load model real
    ├── load_model() berhasil load .pkl
    └── _predict_with_model() berjalan

14. prediction_service.js pakai AI real
    ├── POST /ai/predict/demand → model infer
    └── Mock fallback dimatikan (useMockFallback: false)

15. executiveSummary.js panggil ML predictions
    ├── generatePredictedTrends() → predictDemand()
    └── Recommendations pakai ML confidence scores
```

### Phase 5: Frontend Integration (Minggu 9)

```
16. AnalyticsDashboard.jsx → fetch real API
    ├── useEffect dengan Promise.all(fetch endpoints)
    └── Skeleton loading state

17. Verifikasi semua charts render data real
18. Add error handling & retry logic
```

### Phase 6: Production Hardening (Minggu 10+)

```
19. Caching layer (Redis) untuk semua analytics queries
20. Rate limiting pada /api/analytics/* endpoints
21. Background job untuk pre-compute slot_usage_trends
22. Model retraining pipeline (automated, weekly)
23. Model monitoring (drift detection, accuracy tracking)
24. A/B testing framework untuk model comparison
```

---

## 8. Checklist Final

### Backend Services

- [ ] `executiveSummary.js` — `generateOccupancyData()` → query PostgreSQL
- [ ] `executiveSummary.js` — `generatePredictedTrends()` → call ML model
- [ ] `executiveSummary.js` — `generateViolationSummary()` → query MongoDB
- [ ] `prediction_service.js` — hapus mock fallback di production
- [ ] `analytics.controller.js` — semua 5 mock endpoints → real queries
- [ ] `slotEfficiency.js` — ✅ **sudah siap** (pakai PostgreSQL)
- [ ] `simulator/rules.js` — pertahankan rule-based, optional upgrade ke ML
- [ ] `simulator/engine.js` — pertahankan, ganti input dari mock → real data

### AI / ML Service

- [ ] `prediction_model.py` — `_predict_with_model()` implement feature engineering
- [ ] `model_predictor.py` — `_predict_model()` ganti features sesuai training
- [ ] `training/pipeline.py` — semua 7 steps implementasi real
- [ ] `preprocessing.py` — semua 5 functions implementasi real
- [ ] `feature_engineering.py` — semua 6 functions implementasi real
- [ ] `requirements.txt` — tambah pandas, scikit-learn, joblib

### Frontend

- [ ] `AnalyticsDashboard.jsx` — hapus mock constants, tambah useEffect + fetch
- [ ] `Loading states` — ganti setTimeout → async fetch loading
- [ ] `Error handling` — tambah error boundary untuk failed API calls
- [ ] Chart components — ✅ **tidak perlu diganti** (sudah generic)

### Database

- [ ] PostgreSQL schema deployed
- [ ] MongoDB collections created dengan indexes
- [ ] Data ingestion pipeline running
- [ ] Time-series retention policies aktif

### Testing

- [ ] Integration tests: Backend ↔ AI Service ↔ ML Model
- [ ] E2E tests: Full training pipeline
- [ ] Data quality tests: Schema validation
- [ ] Performance tests: Query latency < 500ms

---

## File Reference

| File | Path | Status |
|------|------|--------|
| Executive Summary Service | `backend/src/services/executiveSummary.js` | 🔴 Perlu diganti |
| Prediction Service | `backend/src/services/prediction_service.js` | 🟡 Perlu hapus mock |
| Analytics Controller | `backend/src/controllers/analytics.controller.js` | 🔴 Perlu diganti |
| Slot Efficiency | `backend/src/services/slotEfficiency.js` | ✅ Siap (PostgreSQL) |
| Simulator Rules | `backend/src/simulator/rules.js` | 🟢 Pertahankan |
| Prediction Model | `ai-service/app/models/prediction_model.py` | 🟡 Perlu feature engineering |
| Model Predictor | `ai-service/app/services/model_predictor.py` | 🟡 Perlu feature engineering |
| Training Pipeline | `ai-service/training/pipeline.py` | 🔴 Empty, perlu implementasi |
| Preprocessing Utils | `ai-service/app/utils/preprocessing.py` | 🔴 Placeholder only |
| Feature Engineering | `ai-service/app/utils/feature_engineering.py` | 🔴 Placeholder only |
| Analytics Dashboard | `frontend/src/pages/AnalyticsDashboard.jsx` | 🔴 Mock data hardcoded |
| Chart Components | `frontend/src/components/analytics/*.jsx` | ✅ Siap (generic) |
| SQL Schema | `backend/src/db/schema/SQL_SCHEMA.sql` | ✅ Siap |
| MongoDB Schema | `backend/src/db/schema/MONGODB_SCHEMA.js` | ✅ Siap |

---

**End of Document**

*Dokumen ini akan diupdate seiring kemajuan migrasi dari mock ke production.*
