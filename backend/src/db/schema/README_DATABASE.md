# SMART PARKING & INFRASTRUCTURE DEMAND MANAGEMENT
## Complete Database Architecture Documentation

**Case 5** | Created: 2026-04-07  
**Optimized for**: Real-Time AI Analytics, Time-Series Prediction, Demand Forecasting

---

## TABLE OF CONTENTS

1. [A. Ringkasan Struktur](#a-ringkasan-struktur)
2. [B. Skema Database Lengkap](#b-skema-database-lengkap)
3. [C. Indexing & Relasi](#c-indexing--relasi)
4. [D. Dummy Sample Data](#d-dummy-sample-data)
5. [E. ERD Diagram (ASCII)](#e-erd-diagram-ascii)
6. [F. Catatan untuk Model Demand Prediction](#f-catatan-untuk-model-demand-prediction)
7. [G. Optimasi Query & Partisi](#g-optimasi-query--partisi)
8. [H. Pemilihan Database: SQL vs MongoDB](#h-pemilihan-database-sql-vs-mongodb)

---

## A. RINGKASAN STRUKTUR

### Overview

Database ini dirancang untuk mendukung sistem **Smart Parking** dengan kemampuan:
- Real-time occupancy monitoring (per-slot, per-menit)
- Traffic volume tracking (per-area, per-5-menit)
- Violation detection & tracking
- AI-powered demand prediction
- Bottleneck identification & monitoring
- Statistical trend aggregation

### 6 Core Tables/Collections

| # | Table/Collection | Purpose | Data Volume Estimate | Retention |
|---|-----------------|---------|---------------------|-----------|
| 1 | `parking_occupancy_history` | Riwayat status tiap slot parkir | ~1M records/day (500 slots × 288 readings) | 12 months |
| 2 | `traffic_volume_history` | Volume kendaraan per area | ~86K records/day (10 areas × 288 intervals) | 12 months |
| 3 | `violation_history` | Catatan pelanggaran parkir | ~100-500 records/day | 24 months |
| 4 | `prediction_results` | Hasil prediksi AI model | ~5K records/day (10 areas × 4 horizons × ~120 predictions) | 6 months |
| 5 | `bottleneck_map` | Titik kemacetan/overload | ~50-200 records/day | 6 months after resolution |
| 6 | `slot_usage_trends` | Agregasi statistik (hourly/daily/monthly) | ~15K records/day | Permanent (archive older) |

### Reference Tables (SQL only)

| Table | Purpose |
|-------|---------|
| `areas` | Definisi area/zona parkir |
| `parking_slots` | Master data tiap slot fisik |

> **Note**: MongoDB menggunakan koleksi yang sama sebagai reference collections.

---

## B. SKEMA DATABASE LENGKAP

### B.1 SQL Version (PostgreSQL)

File: `docs/database/SQL_SCHEMA.sql`

#### Core Tables

**1. parking_occupancy_history**
| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| occupancy_id | BIGSERIAL | PK | auto | Primary key, auto-increment |
| slot_id | UUID | FK | - | Reference to parking_slots |
| area_id | UUID | FK | - | Denormalized for query performance |
| timestamp | TIMESTAMPTZ | YES | NOW() | Time of sensor reading |
| is_occupied | BOOLEAN | YES | - | Current occupancy state |
| occupancy_status | VARCHAR(20) | YES | 'available' | available/occupied/reserved/maintenance |
| vehicle_type | VARCHAR(20) | NO | NULL | car/motorcycle/truck |
| license_plate | VARCHAR(20) | NO | NULL | Captured plate if occupied |
| session_id | UUID | NO | NULL | Links to parking session |
| entry_time | TIMESTAMPTZ | NO | NULL | Vehicle entry time |
| duration_minutes | INTEGER | NO | NULL | Computed duration |
| sensor_reading_id | VARCHAR(100) | NO | NULL | IoT sensor message ID |
| confidence_score | DECIMAL(3,2) | NO | 1.00 | Sensor confidence (0-1) |

**2. traffic_volume_history**
| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| volume_id | BIGSERIAL | PK | auto | Primary key |
| area_id | UUID | FK | - | Reference to areas |
| timestamp | TIMESTAMPTZ | YES | NOW() | Start of time window |
| interval_minutes | INTEGER | YES | 5 | Aggregation window (5/15/60) |
| vehicle_count | INTEGER | YES | 0 | Total vehicles counted |
| vehicles_entering | INTEGER | YES | 0 | Vehicles entering |
| vehicles_leaving | INTEGER | YES | 0 | Vehicles leaving |
| vehicle_type_counts | JSONB | NO | '{}' | {"car": 45, "motorcycle": 12} |
| avg_speed_kmh | DECIMAL(5,2) | NO | NULL | Average traffic speed |
| peak_count | INTEGER | NO | NULL | Max simultaneous vehicles |
| source | VARCHAR(30) | YES | 'sensor' | sensor/camera/manual/estimated |
| data_quality | VARCHAR(20) | YES | 'verified' | raw/verified/interpolated/estimated |

**3. violation_history**
| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| violation_id | UUID | PK | uuid_generate_v4() | Primary key |
| slot_id | UUID | FK (nullable) | NULL | Reference to parking_slots |
| area_id | UUID | FK | - | Reference to areas |
| timestamp | TIMESTAMPTZ | YES | NOW() | Detection time |
| violation_type | VARCHAR(40) | YES | - | illegal_parking/blocking/improper_parking/overtime |
| severity | VARCHAR(15) | YES | 'medium' | low/medium/high/critical |
| description | TEXT | NO | NULL | Human-readable description |
| evidence_image_url | TEXT | NO | NULL | Photo evidence URL |
| evidence_video_url | TEXT | NO | NULL | Video evidence URL |
| license_plate | VARCHAR(20) | NO | NULL | Offending vehicle plate |
| vehicle_type | VARCHAR(20) | NO | NULL | Type of vehicle |
| detected_by | VARCHAR(30) | YES | 'ai_camera' | ai_camera/sensor/patrol/report |
| detection_confidence | DECIMAL(3,2) | YES | 0.00 | AI confidence (0-1) |
| status | VARCHAR(20) | YES | 'pending' | pending/issued/appealed/resolved/dismissed |
| fine_amount | DECIMAL(10,2) | NO | NULL | Fine amount |
| fine_currency | VARCHAR(3) | YES | 'IDR' | Currency code |
| officer_id | UUID | NO | NULL | Processing officer |
| resolution_notes | TEXT | NO | NULL | Resolution notes |
| resolved_at | TIMESTAMPTZ | NO | NULL | Resolution timestamp |

**4. prediction_results**
| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| prediction_id | UUID | PK | uuid_generate_v4() | Primary key |
| area_id | UUID | FK | - | Reference to areas |
| timestamp | TIMESTAMPTZ | YES | NOW() | When prediction was made |
| prediction_time | TIMESTAMPTZ | YES | - | Target time being predicted |
| prediction_horizon | VARCHAR(20) | YES | - | short_term/medium_term/long_term |
| model_name | VARCHAR(50) | YES | - | Model identifier |
| model_version | VARCHAR(20) | YES | - | Model version |
| predicted_demand | INTEGER | YES | ≥0 | Predicted vehicle count |
| predicted_occupancy_rate | DECIMAL(5,4) | YES | - | Predicted rate (0-1) |
| confidence_lower | DECIMAL(5,4) | NO | NULL | Lower confidence bound |
| confidence_upper | DECIMAL(5,4) | NO | NULL | Upper confidence bound |
| prediction_interval | JSONB | NO | NULL | {"p10": 35, "p50": 52, "p90": 68} |
| features_used | JSONB | NO | NULL | Features used for prediction |
| input_data_window | JSONB | NO | NULL | Input data metadata |
| actual_demand | INTEGER | NO | NULL | Filled later for evaluation |
| actual_occupancy_rate | DECIMAL(5,4) | NO | NULL | Actual rate for evaluation |
| error_mae | DECIMAL(5,2) | NO | NULL | Mean Absolute Error |
| error_rmse | DECIMAL(5,2) | NO | NULL | Root Mean Squared Error |

**5. bottleneck_map**
| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| bottleneck_id | UUID | PK | uuid_generate_v4() | Primary key |
| area_id | UUID | FK | - | Reference to areas |
| location_name | VARCHAR(100) | YES | - | Human-readable name |
| latitude | DECIMAL(10,8) | YES | - | Center latitude |
| longitude | DECIMAL(11,8) | YES | - | Center longitude |
| radius_meters | INTEGER | YES | 50 | Affected radius |
| timestamp | TIMESTAMPTZ | YES | NOW() | Detection timestamp |
| start_time | TIMESTAMPTZ | YES | - | When bottleneck started |
| end_time | TIMESTAMPTZ | NO | NULL | When bottleneck ended |
| bottleneck_type | VARCHAR(30) | YES | - | congestion/overload/spillback/entry_queue/exit_block |
| severity_score | DECIMAL(3,2) | YES | 0-1 | Severity (0-1) |
| affected_slots | INTEGER | YES | 0 | Slots affected |
| affected_capacity | INTEGER | YES | 0 | Capacity affected |
| current_occupancy | INTEGER | NO | NULL | Current vehicles in zone |
| occupancy_rate | DECIMAL(5,4) | NO | NULL | Zone occupancy rate |
| avg_wait_time_min | DECIMAL(6,2) | NO | NULL | Average wait caused |
| contributing_factors | JSONB | NO | NULL | Context factors |
| resolution_status | VARCHAR(20) | YES | 'active' | active/mitigating/resolved/false_positive |
| mitigation_action | TEXT | NO | NULL | Action taken |
| detected_by | VARCHAR(30) | YES | 'auto' | auto/manual/model |

**6. slot_usage_trends**
| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| trend_id | BIGSERIAL | PK | auto | Primary key |
| slot_id | UUID | FK (nullable) | NULL | Reference to parking_slots |
| area_id | UUID | FK | - | Reference to areas |
| period_start | TIMESTAMPTZ | YES | - | Start of period |
| period_end | TIMESTAMPTZ | YES | - | End of period |
| granularity | VARCHAR(15) | YES | - | hourly/daily/weekly/monthly |
| total_occupancy_minutes | INTEGER | YES | 0 | Total occupied minutes |
| total_sessions | INTEGER | YES | 0 | Number of sessions |
| avg_duration_minutes | DECIMAL(8,2) | NO | 0.00 | Average duration |
| max_duration_minutes | INTEGER | NO | NULL | Longest session |
| min_duration_minutes | INTEGER | NO | NULL | Shortest session |
| occupancy_rate | DECIMAL(5,4) | YES | 0.0000 | % time occupied |
| peak_occupancy_time | TIMESTAMPTZ | NO | NULL | Time of peak usage |
| peak_concurrent | INTEGER | NO | 0 | Max concurrent vehicles |
| turnover_rate | DECIMAL(6,2) | NO | 0.00 | Sessions per hour |
| revenue_generated | DECIMAL(10,2) | NO | 0.00 | Revenue in period |
| violation_count | INTEGER | YES | 0 | Violations in period |
| vehicle_type_distribution | JSONB | NO | '{}' | Type breakdown |
| hourly_distribution | JSONB | NO | NULL | Occupancy by hour |
| day_of_week_distribution | JSONB | NO | NULL | Occupancy by day |

---

### B.2 MongoDB Version

File: `docs/database/MONGODB_SCHEMA.js`

MongoDB menggunakan **Time-Series Collections** native (MongoDB 5.0+) untuk 3 koleksi time-series:
- `parking_occupancy_history` — timeseries, bucketMaxSpanSeconds: 3600
- `traffic_volume_history` — timeseries, bucketMaxSpanSeconds: 3600
- `prediction_results` — timeseries, bucketMaxSpanSeconds: 3600

Dan **Standard Collections** untuk:
- `areas` — reference collection dengan JSON Schema validator
- `parking_slots` — reference collection dengan JSON Schema validator
- `violation_history` — standard collection dengan JSON Schema validator
- `bottleneck_map` — standard collection dengan JSON Schema validator
- `slot_usage_trends` — standard collection dengan JSON Schema validator

#### Time-Series Collection Structure (MongoDB native)

```javascript
{
    timeField: "timestamp",          // REQUIRED - indexed automatically
    metaField: "metadata",           // REQUIRED - compound indexed automatically
    granularity: "minutes",          // Expected data granularity
    bucketMaxSpanSeconds: 3600       // Internal bucket size
}
```

#### Document Structure per Collection

Identik dengan SQL version, dengan perbedaan:
- `_id` menggunakan ObjectId (auto-generated)
- Foreign keys menggunakan `ObjectId` references
- `metadata` field pada time-series collections mengandung `area_id`, `slot_id`, `slot_code`
- GeoJSON `location` field pada `bottleneck_map` untuk spatial queries

---

## C. INDEXING & RELASI

### C.1 Indexing Strategy

#### SQL Indexes (PostgreSQL)

| Table | Index Name | Columns | Type | Purpose |
|-------|-----------|---------|------|---------|
| **parking_occupancy_history** | idx_occupancy_timestamp | timestamp DESC | B-tree | Time range queries |
| | idx_occupancy_slot_time | slot_id, timestamp DESC | B-tree compound | Single slot history |
| | idx_occupancy_area_time | area_id, timestamp DESC | B-tree compound | Area analytics |
| | idx_occupancy_occupied | timestamp DESC (WHERE is_occupied=true) | Partial B-tree | Find busy slots |
| | idx_occupancy_session_id | session_id | Hash | Session joins |
| **traffic_volume_history** | idx_traffic_timestamp | timestamp DESC | B-tree | Time range queries |
| | idx_traffic_area_time | area_id, timestamp DESC | B-tree compound | Area traffic analysis |
| | idx_traffic_verified | timestamp DESC (WHERE data_quality='verified') | Partial B-tree | ML training data |
| **violation_history** | idx_violation_timestamp | timestamp DESC | B-tree | Time range queries |
| | idx_violation_area_time | area_id, timestamp DESC | B-tree compound | Area violations |
| | idx_violation_type | violation_type | B-tree | Filter by type |
| | idx_violation_status | status | B-tree | Filter by status |
| | idx_violation_unresolved_area | area_id, timestamp DESC (WHERE status IN ...) | Partial B-tree | Unresolved queue |
| **prediction_results** | idx_prediction_timestamp | timestamp DESC | B-tree | Recent predictions |
| | idx_prediction_time | prediction_time DESC | B-tree | Target time queries |
| | idx_prediction_area_time | area_id, prediction_time DESC | B-tree compound | Area predictions |
| | idx_prediction_model | model_name, model_version | B-tree compound | Model tracking |
| | idx_prediction_pending_eval | prediction_time DESC (WHERE actual_demand IS NULL) | Partial B-tree | Model evaluation queue |
| **bottleneck_map** | idx_bottleneck_timestamp | timestamp DESC | B-tree | Time range queries |
| | idx_bottleneck_area_time | area_id, timestamp DESC | B-tree compound | Area bottlenecks |
| | idx_bottleneck_status | resolution_status | B-tree | Filter by status |
| | idx_bottleneck_active | timestamp DESC (WHERE resolution_status='active') | Partial B-tree | Active bottlenecks |
| **slot_usage_trends** | idx_trend_period | period_start DESC, period_end DESC | B-tree compound | Period queries |
| | idx_trend_area_granularity | area_id, granularity | B-tree compound | Area aggregates |
| | idx_trend_slot_period | slot_id, period_start DESC (WHERE slot_id IS NOT NULL) | Partial B-tree | Slot trends |

#### MongoDB Indexes

| Collection | Index | Fields | Type | Purpose |
|-----------|-------|--------|------|---------|
| **areas** | idx_areas_code | area_code | Unique | Fast lookup |
| | idx_areas_type | area_type | Standard | Filter by type |
| | idx_areas_geospatial | location | 2dsphere | Spatial queries |
| **parking_slots** | idx_slots_code | slot_code | Unique | Fast lookup |
| | idx_slots_area | area_id | Standard | Area slots |
| | idx_slots_area_active | area_id, is_active | Compound | Active slots query |
| **parking_occupancy_history** | (auto) | timestamp, metadata | Time-series native | Auto-indexed |
| | idx_occupancy_slot_time | metadata.slot_id, timestamp | Compound | Slot history |
| | idx_occupancy_area_time | metadata.area_id, timestamp | Compound | Area analytics |
| | idx_occupancy_occupied | is_occupied, timestamp (partial) | Partial | Busy slots |
| **traffic_volume_history** | (auto) | timestamp, metadata | Time-series native | Auto-indexed |
| | idx_traffic_area_time | metadata.area_id, timestamp | Compound | Area traffic |
| | idx_traffic_verified | data_quality, timestamp (partial) | Partial | ML data |
| **violation_history** | idx_violation_timestamp | timestamp | Standard | Time queries |
| | idx_violation_area_time | area_id, timestamp | Compound | Area violations |
| | idx_violation_unresolved_area | area_id, timestamp (partial) | Partial | Unresolved queue |
| | idx_violation_plate | license_plate (sparse) | Sparse | Vehicle lookup |
| **prediction_results** | (auto) | timestamp, metadata | Time-series native | Auto-indexed |
| | idx_prediction_area_time | metadata.area_id, timestamp | Compound | Area predictions |
| | idx_prediction_time | prediction_time | Standard | Target time |
| | idx_prediction_model | metadata.model_name, metadata.model_version | Compound | Model tracking |
| | idx_prediction_pending_eval | prediction_time (partial) | Partial | Evaluation queue |
| **bottleneck_map** | idx_bottleneck_timestamp | timestamp | Standard | Time queries |
| | idx_bottleneck_area_time | area_id, timestamp | Compound | Area bottlenecks |
| | idx_bottleneck_active | timestamp (partial) | Partial | Active bottlenecks |
| | idx_bottleneck_geospatial | location | 2dsphere | Spatial queries |
| **slot_usage_trends** | idx_trend_period | period_start, period_end | Compound | Period queries |
| | idx_trend_area_granularity | area_id, granularity | Compound | Area aggregates |
| | idx_trend_slot_period | slot_id, period_start (partial) | Partial | Slot trends |

### C.2 Relationships

#### SQL (Foreign Keys)

```
areas (1) ──────────────────┬── (N) parking_slots
                            ├── (N) parking_occupancy_history
                            ├── (N) traffic_volume_history
                            ├── (N) violation_history
                            ├── (N) prediction_results
                            └── (N) bottleneck_map
                            └── (N) slot_usage_trends

parking_slots (1) ──────────┬── (N) parking_occupancy_history
                            ├── (N) violation_history (nullable)
                            └── (N) slot_usage_trends (nullable)
```

**Cascade Rules:**
- Delete area → cascade delete semua child records
- Delete slot → cascade delete occupancy history, SET NULL pada violation & trends
- Delete area/slot → tetap simpan prediction results untuk audit trail

#### MongoDB (ObjectId References)

```
areas { _id } ──────────────┬── parking_slots { area_id: ObjectId }
                            ├── parking_occupancy_history { metadata.area_id }
                            ├── traffic_volume_history { metadata.area_id }
                            ├── violation_history { area_id }
                            ├── prediction_results { metadata.area_id }
                            ├── bottleneck_map { area_id }
                            └── slot_usage_trends { area_id }

parking_slots { _id } ──────┬── parking_occupancy_history { metadata.slot_id }
                            ├── violation_history { slot_id } (nullable)
                            └── slot_usage_trends { slot_id } (nullable)
```

**Note**: MongoDB tidak memiliki foreign key enforcement. Referential integrity harus dijaga di application layer.

### C.3 TTL (Auto-Expire) Policies

| Table/Collection | TTL Field | Expire After | Reason |
|-----------------|-----------|--------------|--------|
| parking_occupancy_history | timestamp | 12 months | Raw sensor data, high volume |
| traffic_volume_history | timestamp | 12 months | Aggregated traffic data |
| prediction_results | timestamp | 6 months | Model outputs, retrained frequently |
| violation_history | resolved_at | 24 months | Compliance requirement |
| bottleneck_map | end_time | 6 months (resolved only) | Historical reference |

---

## D. DUMMY SAMPLE DATA

### D.1 SQL INSERT Statements

Terdapat dalam file `SQL_SCHEMA.sql` bagian akhir. Setiap tabel memiliki **3-6 records** sample.

### D.2 MongoDB Documents

Terdapat dalam file `MONGODB_SCHEMA.js` bagian akhir. Setiap koleksi memiliki **3-6 documents** sample.

### Sample Data Summary

| Table | Records | Description |
|-------|---------|-------------|
| areas | 3 | Downtown, Mall, Office |
| parking_slots | 3 | Standard, EV Charging, Compact |
| parking_occupancy_history | 6 | 5-minute interval readings |
| traffic_volume_history | 5 | 5-minute aggregated counts |
| violation_history | 3 | Overtime, Illegal, Blocking |
| prediction_results | 3 | Short & medium term predictions |
| bottleneck_map | 3 | Entry queue, Overload, Exit block |
| slot_usage_trends | 3 | Hourly, Daily, Monthly aggregates |

---

## E. ERD DIAGRAM (ASCII)

### Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                         SMART PARKING DATABASE - ERD                                │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│  ┌──────────────┐                     ┌──────────────────┐                         │
│  │   AREAS      │                     │ PARKING_SLOTS    │                         │
│  ├──────────────┤                     ├──────────────────┤                         │
│  │ PK area_id   │◄────────────────────┤ FK area_id       │                         │
│  │    area_code │  1            N     │ PK slot_id       │                         │
│  │    area_name │                     │    slot_code     │                         │
│  │    area_type │                     │    slot_number   │                         │
│  │    capacity  │                     │    floor_level   │                         │
│  │    lat/long  │                     │    zone          │                         │
│  │    boundary  │                     │    slot_type     │                         │
│  └──────┬───────┘                     │    sensor_id     │                         │
│         │                             │    price_per_hour│                         │
│         │                             └────────┬─────────┘                         │
│         │                                    │                                    │
│         ├────────────────────────────────────┼────────────────────────────────────┤
│         │                                    │                                    │
│         ▼                                    ▼                                    │
│  ┌──────────────────────────┐   ┌──────────────────────────────┐                 │
│  │ PARKING_OCCUPANCY_HISTORY│   │    TRAFFIC_VOLUME_HISTORY    │                 │
│  ├──────────────────────────┤   ├──────────────────────────────┤                 │
│  │ PK occupancy_id          │   │ PK volume_id                 │                 │
│  │ FK slot_id ──────────────┼───┤ FK area_id ──────────────────┼──┐              │
│  │ FK area_id ──────────────┼───┤    timestamp                 │  │              │
│  │    timestamp             │   │    interval_minutes          │  │              │
│  │    is_occupied           │   │    vehicle_count             │  │              │
│  │    occupancy_status      │   │    vehicles_entering         │  │              │
│  │    vehicle_type          │   │    vehicles_leaving          │  │              │
│  │    license_plate         │   │    vehicle_type_counts(JSON) │  │              │
│  │    session_id            │   │    avg_speed_kmh             │  │              │
│  │    confidence_score      │   │    peak_count                │  │              │
│  └──────────────────────────┘   │    source                    │  │              │
│                                 │    data_quality              │  │              │
│  [TIME-SERIES]                  └──────────────────────────────┘  │              │
│  [TTL: 12 months]                                                │              │
│                                                                  │              │
│         ▲                                                        │              │
│         │                                                        ▼              │
│  ┌──────────────────────────┐   ┌──────────────────────────────┐                 │
│  │    VIOLATION_HISTORY     │   │       BOTTLENECK_MAP         │                 │
│  ├──────────────────────────┤   ├──────────────────────────────┤                 │
│  │ PK violation_id          │   │ PK bottleneck_id             │                 │
│  │ FK slot_id (nullable)    │   │ FK area_id ──────────────────┼──┘              │
│  │ FK area_id ──────────────┼───┤    location_name             │                 │
│  │    timestamp             │   │    lat/long                  │                 │
│  │    violation_type        │   │    radius_meters             │                 │
│  │    severity              │   │    timestamp                 │                 │
│  │    description           │   │    start_time                │                 │
│  │    evidence_image_url    │   │    end_time (nullable)       │                 │
│  │    license_plate         │   │    bottleneck_type           │                 │
│  │    detected_by           │   │    severity_score            │                 │
│  │    detection_confidence  │   │    affected_slots            │                 │
│  │    status                │   │    affected_capacity         │                 │
│  │    fine_amount           │   │    current_occupancy         │                 │
│  │    resolved_at (nullable)│   │    occupancy_rate            │                 │
│  └──────────────────────────┘   │    avg_wait_time_min         │                 │
│  [TTL: 24 months after resolve] │    contributing_factors(JSON)│                 │
│                                 │    resolution_status         │                 │
│                                 │    mitigation_action         │                 │
│                                 └──────────────────────────────┘                 │
│                                                                                  │
│  ┌──────────────────────────┐                                                    │
│  │    PREDICTION_RESULTS    │                                                    │
│  ├──────────────────────────┤                                                    │
│  │ PK prediction_id         │                                                    │
│  │ FK area_id ──────────────┼────┐                                               │
│  │    timestamp             │    │                                               │
│  │    prediction_time       │    │                                               │
│  │    prediction_horizon    │    │            ┌──────────────────────────────┐   │
│  │    model_name            │    │            │      SLOT_USAGE_TRENDS       │   │
│  │    model_version         │    │            ├──────────────────────────────┤   │
│  │    predicted_demand      │    │            │ PK trend_id                  │   │
│  │    predicted_occupancy   │    └────────────┤ FK slot_id (nullable)        │   │
│  │    confidence_lower      │                 │ FK area_id ──────────────────┼───┘
│  │    confidence_upper      │                 │    period_start              │
│  │    prediction_interval   │                 │    period_end                │
│  │    features_used (JSON)  │                 │    granularity               │
│  │    input_data_window     │                 │    total_occupancy_minutes   │
│  │    actual_demand (null)  │                 │    total_sessions            │
│  │    actual_occupancy(null)│                 │    avg/max/min_duration      │
│  │    error_mae (null)      │                 │    occupancy_rate            │
│  │    error_rmse (null)     │                 │    peak_occupancy_time       │
│  └──────────────────────────┘                 │    peak_concurrent           │
│  [TIME-SERIES]                                │    turnover_rate             │
│  [TTL: 6 months]                              │    revenue_generated         │
│                                               │    violation_count           │
│                                               │    vehicle_type_dist (JSON)  │
│                                               │    hourly_dist (JSON)        │
│                                               │    dow_dist (JSON)           │
│                                               └──────────────────────────────┘
│
└─────────────────────────────────────────────────────────────────────────────────────┘
```

### Relationship Cardinality

```
AREAS (1) ──── (N) parking_occupancy_history
AREAS (1) ──── (N) traffic_volume_history
AREAS (1) ──── (N) violation_history
AREAS (1) ──── (N) prediction_results
AREAS (1) ──── (N) bottleneck_map
AREAS (1) ──── (N) slot_usage_trends

PARKING_SLOTS (1) ──── (N) parking_occupancy_history
PARKING_SLOTS (1) ──── (0..N) violation_history        [nullable]
PARKING_SLOTS (1) ──── (0..N) slot_usage_trends        [nullable]
```

---

## F. CATATAN UNTUK MODEL DEMAND PREDICTION

### F.1 Bagaimana Struktur Ini Digunakan oleh ML Models

#### 1. Feature Engineering Pipeline

```
┌─────────────────────────────────────────────────────────────────────┐
│                    FEATURE EXTRACTION FLOW                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  RAW DATA SOURICES              AGGREGATED FEATURES                 │
│  ┌───────────────────────┐      ┌───────────────────────────────┐  │
│  │ parking_occupancy     │─────►│ slot_usage_trends             │  │
│  │   (5-min readings)    │      │   (hourly/daily/monthly)      │  │
│  └───────────────────────┘      │   Features:                   │  │
│                                 │   - occupancy_rate            │  │
│  ┌───────────────────────┐      │   - turnover_rate             │  │
│  │ traffic_volume        │─────►│   - avg_duration              │  │
│  │   (5-min counts)      │      │   - vehicle_type_distribution │  │
│  └───────────────────────┘      │   - hourly_distribution       │  │
│                                 │   - day_of_week_distribution  │  │
│  ┌───────────────────────┐      │   - peak_concurrent           │  │
│  │ violation_history     │─────►│   - violation_count           │  │
│  │   (events)            │      │   - revenue_generated         │  │
│  └───────────────────────┘      └───────────────┬───────────────┘  │
│                                                  │                  │
│  ┌───────────────────────┐                       │                  │
│  │ bottleneck_map        │───────────────────────┤                  │
│  │   (hotspot events)    │                       │                  │
│  └───────────────────────┘                       ▼                  │
│                                              ┌───────────────┐     │
│                                              │ ML MODEL      │     │
│                                              │ INPUT VECTOR  │     │
│                                              └───────────────┘     │
└─────────────────────────────────────────────────────────────────────┘
```

#### 2. Per Setiap Tabel untuk ML

| Table | ML Usage | Feature Types |
|-------|----------|---------------|
| **parking_occupancy_history** | Primary input for occupancy prediction | Lag features (occupancy_t-1, t-2, ...), rolling averages, seasonality patterns |
| **traffic_volume_history** | Demand flow prediction, inflow/outflow modeling | Vehicle counts, speed trends, entering/leaving ratios |
| **violation_history** | Anomaly detection, demand pressure indicator | Violation rate per area, type distribution, severity trends |
| **prediction_results** | Model evaluation, retraining triggers, ensemble weighting | Error metrics (MAE, RMSE), confidence intervals, model comparison |
| **bottleneck_map** | Congestion prediction, spatial demand redistribution | Bottleneck frequency, severity scores, duration patterns |
| **slot_usage_trends** | Pre-computed features for fast inference | Historical averages, peak patterns, turnover rates |

#### 3. Model Training Query Examples

**Query untuk training data (SQL):**
```sql
-- Get 30 days of occupancy data for LSTM training
SELECT
    slot_id,
    timestamp,
    is_occupied::int AS occupied,
    EXTRACT(HOUR FROM timestamp) AS hour_of_day,
    EXTRACT(DOW FROM timestamp) AS day_of_week,
    AVG(is_occupied::int) OVER (
        PARTITION BY slot_id
        ORDER BY timestamp
        ROWS BETWEEN 12 PRECEDING AND 1 PRECEDING
    ) AS lag_1h_avg
FROM parking_occupancy_history
WHERE timestamp >= NOW() - INTERVAL '30 days'
ORDER BY slot_id, timestamp;
```

**Query untuk feature extraction (MongoDB):**
```javascript
// Get daily trends for feature engineering
db.slot_usage_trends.aggregate([
    { $match: {
        area_id: ObjectId("..."),
        granularity: "daily",
        period_start: { $gte: new Date("2026-03-01") }
    }},
    { $sort: { period_start: 1 }},
    { $project: {
        occupancy_rate: 1,
        turnover_rate: 1,
        total_sessions: 1,
        hourly_distribution: 1,
        vehicle_type_distribution: 1
    }}
]);
```

#### 4. Model Inference Pipeline

```
Real-time Data ──► Feature Store ──► Model Inference ──► prediction_results
     │                  │                   │                   │
     │                  │                   │                   │
  occupancy          Pre-computed       LSTM / XGBoost     Store results
  traffic            trend features     or other model     with metadata
  violations
```

### F.2 Kenapa Struktur Ini Optimal untuk Prediction & Analytics

#### 1. Time-Series Native Design
- **Granularity yang konsisten**: Semua time-series data menggunakan timestamp dengan resolusi menit
- **Bucket-based storage** (MongoDB): Optimal untuk time-range queries
- **Partitioning** (SQL): Data di-partisi per bulan untuk query performance

#### 2. Denormalisasi Strategis
- `area_id` disimpan di `parking_occupancy_history` meskipun sudah ada di `parking_slots`
  → Menghindari JOIN saat query area-level analytics
- `slot_code` dan `area_code` di `metadata` time-series MongoDB
  → Mengurangi lookup ke reference collections

#### 3. JSONB/Embedded Documents untuk Flexible Features
- `vehicle_type_counts`, `prediction_interval`, `contributing_factors`, `hourly_distribution`
  → Memudahkan penyimpanan struktur data kompleks tanpa schema migration
- ML models bisa menambah features baru tanpa ALTER TABLE

#### 4. Indexing untuk Query Patterns Umum
- **Time-range queries**: Semua tabel punya index pada timestamp
- **Area-based queries**: Compound index (area_id, timestamp)
- **Slot-level queries**: Compound index (slot_id, timestamp)
- **Partial indexes**: Hanya index data yang relevan (misal: `is_occupied = true`)

#### 5. TTL untuk Data Lifecycle Management
- Data raw sensor expire otomatis setelah 12 bulan
- Aggregated trends (`slot_usage_trends`) tidak expire → permanent historical data
- Prediction results expire lebih cepat (6 bulan) karena model sering di-retrain

#### 6. Support untuk Real-Time AI
- `prediction_results` menyimpan `features_used` dan `input_data_window`
  → Audit trail untuk reproducibility
- `actual_demand` dan `error_*` fields diisi setelah ground truth tersedia
  → Automated model evaluation
- `model_name` + `model_version` untuk tracking experiment & A/B testing

---

## G. OPTIMASI QUERY & PARTISI

### G.1 Query Optimization Strategies

#### 1. Time-Range Queries (Most Common)

**SQL:**
```sql
-- Covered by: idx_occupancy_area_time (area_id, timestamp DESC)
SELECT timestamp, is_occupied
FROM parking_occupancy_history
WHERE area_id = '...' AND timestamp >= NOW() - INTERVAL '1 hour'
ORDER BY timestamp DESC;
```

**MongoDB:**
```javascript
// Covered by: time-series native index on timestamp + metadata
db.parking_occupancy_history.find({
    "metadata.area_id": ObjectId("..."),
    timestamp: { $gte: new Date(Date.now() - 3600000) }
}).sort({ timestamp: -1 });
```

#### 2. Aggregation Queries

**SQL with Continuous Aggregates (TimescaleDB):**
```sql
-- Using materialized view instead of raw table
SELECT bucket, occupancy_rate
FROM occupancy_hourly_summary
WHERE area_id = '...' AND bucket >= NOW() - INTERVAL '7 days'
ORDER BY bucket;
```

**MongoDB with Pre-computed Trends:**
```javascript
// Query slot_usage_trends instead of raw occupancy data
db.slot_usage_trends.find({
    area_id: ObjectId("..."),
    granularity: "hourly",
    period_start: { $gte: new Date(Date.now() - 7*24*3600000) }
}).sort({ period_start: 1 });
```

#### 3. Prediction Lookup

**SQL:**
```sql
-- Covered by: idx_prediction_pending_eval
SELECT prediction_id, predicted_demand, prediction_time
FROM prediction_results
WHERE area_id = '...' AND actual_demand IS NULL
ORDER BY prediction_time DESC
LIMIT 10;
```

### G.2 Partitioning Strategy (SQL - PostgreSQL)

#### Time-Based Partitioning (Monthly)

```sql
-- Using TimescaleDB hypertables (recommended)
SELECT create_hypertable('parking_occupancy_history', 'timestamp',
    chunk_time_interval => INTERVAL '1 month');

SELECT create_hypertable('traffic_volume_history', 'timestamp',
    chunk_time_interval => INTERVAL '1 month');

SELECT create_hypertable('prediction_results', 'prediction_time',
    chunk_time_interval => INTERVAL '1 month');
```

#### Native PostgreSQL Partitioning (Alternative)

```sql
CREATE TABLE parking_occupancy_history (
    -- columns
) PARTITION BY RANGE (timestamp);

-- Create monthly partitions
CREATE TABLE parking_occupancy_history_2026_04
    PARTITION OF parking_occupancy_history
    FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');

CREATE TABLE parking_occupancy_history_2026_05
    PARTITION OF parking_occupancy_history
    FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
```

#### Retention Policies

```sql
-- Auto-drop chunks older than retention period
SELECT add_retention_policy('parking_occupancy_history',
    drop_after => INTERVAL '12 months');

SELECT add_retention_policy('traffic_volume_history',
    drop_after => INTERVAL '12 months');

SELECT add_retention_policy('prediction_results',
    drop_after => INTERVAL '6 months');
```

### G.3 Sharding Strategy (MongoDB)

For large-scale deployments (>10M documents/day):

```javascript
// Shard key recommendation
sh.shardCollection("smart_parking_db.parking_occupancy_history", {
    "metadata.area_id": "hashed",
    "timestamp": 1
});

sh.shardCollection("smart_parking_db.traffic_volume_history", {
    "metadata.area_id": "hashed",
    "timestamp": 1
});

sh.shardCollection("smart_parking_db.slot_usage_trends", {
    "area_id": 1,
    "granularity": 1,
    "period_start": -1
});
```

### G.4 Data Volume Estimates

| Table | Daily Records | Monthly Records | Storage (est.) |
|-------|--------------|-----------------|----------------|
| parking_occupancy_history | 1,000,000 | 30,000,000 | ~2.5 GB |
| traffic_volume_history | 86,400 | 2,592,000 | ~200 MB |
| violation_history | 300 | 9,000 | ~5 MB |
| prediction_results | 5,000 | 150,000 | ~50 MB |
| bottleneck_map | 100 | 3,000 | ~2 MB |
| slot_usage_trends | 15,000 | 450,000 | ~100 MB |

**Total estimated storage (1 year):** ~35 GB (with 12-month retention)

---

## H. PEMILIHAN DATABASE: SQL vs MongoDB

### Rekomendasi: **TimescaleDB (PostgreSQL)** untuk Production

| Aspect | SQL (PostgreSQL + TimescaleDB) | MongoDB |
|--------|-------------------------------|---------|
| **Time-Series Support** | Excellent (native hypertables, continuous aggregates) | Good (native time-series collections) |
| **ACID Compliance** | Full ACID | Eventual consistency (configurable) |
| **Analytics Queries** | Superior (window functions, CTEs, joins) | Good (aggregation pipeline) |
| **ML Integration** | Direct (PL/Python, PL/R, MADlib) | Via external services |
| **Schema Flexibility** | Moderate (ALTER TABLE required) | Excellent (schemaless) |
| **Real-Time Ingestion** | High (COPY, parallel inserts) | Very High (bulk writes) |
| **Spatial Queries** | Excellent (PostGIS) | Good (2dsphere) |
| **Data Retention** | Excellent (automatic chunk dropping) | Good (TTL indexes) |
| **Ecosystem** | Mature (BI tools, Grafana, etc.) | Mature (Atlas, Compass, etc.) |
| **Learning Curve** | Moderate | Low-Moderate |

### Kapan Pilih MongoDB?

- Tim sudah familiar dengan MongoDB
- Schema akan sering berubah (rapid iteration)
- Butuh horizontal scaling dari hari pertama
- Data tidak terstruktur atau semi-structured

### Kapan Pilih PostgreSQL + TimescaleDB?

- **Butuh analytics queries yang kompleks** (window functions, percentiles)
- **Integrasi dengan ML tools** (Scikit-learn via PL/Python, MADlib)
- **ACID compliance** untuk financial transactions (parking payments)
- **PostGIS** untuk spatial analysis
- **Tim sudah menggunakan PostgreSQL** di stack yang ada

### Hybrid Approach (Recommended for Scale)

```
┌─────────────────────────────────────────────────────┐
│                 HYBRID ARCHITECTURE                  │
├─────────────────────────────────────────────────────┤
│                                                     │
│  IoT Sensors ──► MongoDB (raw ingestion)            │
│                      │                              │
│                      ▼                              │
│              ETL Pipeline                           │
│              (Airflow/dbt)                          │
│                      │                              │
│                      ▼                              │
│              TimescaleDB (analytics + ML)           │
│                      │                              │
│                      ▼                              │
│              AI Microservice (FastAPI)              │
│                      │                              │
│                      ▼                              │
│              prediction_results (both DBs)          │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**Flow:**
1. MongoDB menerima data sensor real-time (high write throughput)
2. ETL pipeline meng-aggregate dan transform ke TimescaleDB
3. ML model train dari TimescaleDB (analytics-optimized)
4. Prediction results ditulis ke kedua database

---

## APPENDIX

### A. Data Type Rationale

| Data Type | Why This Type | Alternatives Considered |
|-----------|--------------|------------------------|
| TIMESTAMPTZ | timezone-aware, critical for multi-location | TIMESTAMP (no TZ), INTEGER (epoch) |
| UUID | Globally unique, no sequence bottleneck | BIGSERIAL (sequential, less scalable) |
| DECIMAL(5,4) | Exact precision for rates (0.0000-1.0000) | FLOAT (imprecise for comparisons) |
| JSONB | Queryable, indexable, flexible schema | JSON (not indexable), separate columns |
| BIGSERIAL | 64-bit auto-increment, good for time-series | UUID (larger, slower for inserts) |
| VARCHAR(n) | Length-constrained, efficient | TEXT (unconstrained), CHAR (fixed) |

### B. Enum Values Reference

**occupancy_status:** `available`, `occupied`, `reserved`, `maintenance`
**vehicle_type:** `car`, `motorcycle`, `truck`, `bicycle`
**violation_type:** `illegal_parking`, `blocking`, `improper_parking`, `overtime`, `no_permit`, `disabled_abuse`, `ev_non_ev`
**severity:** `low`, `medium`, `high`, `critical`
**prediction_horizon:** `short_term` (15min), `medium_term` (1hr), `long_term` (24hr)
**bottleneck_type:** `congestion`, `overload`, `spillback`, `entry_queue`, `exit_block`
**granularity:** `hourly`, `daily`, `weekly`, `monthly`
**resolution_status:** `active`, `mitigating`, `resolved`, `false_positive`

### C. File Locations

| File | Content |
|------|---------|
| `docs/database/SQL_SCHEMA.sql` | Complete PostgreSQL schema with indexes & dummy data |
| `docs/database/MONGODB_SCHEMA.js` | Complete MongoDB schema with indexes & dummy data |
| `docs/database/README_DATABASE.md` | This documentation file |

---

**End of Documentation**

*Schema version: 1.0.0*
*Last updated: 2026-04-07*
*Maintained by: Smart Parking Engineering Team*
