-- ============================================================================
-- SMART PARKING & INFRASTRUCTURE DEMAND MANAGEMENT
-- PostgreSQL Database Schema (SQL Version)
-- Optimized for Time-Series Analytics & ML Prediction Pipelines
-- ============================================================================

-- Database: smart_parking_db
-- Created: 2026-04-07
-- Purpose: Real-time parking analytics, demand forecasting, violation tracking
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "timescaledb" IF EXISTS;

-- ============================================================================
-- 1. REFERENCE TABLE: parking_slots
-- ============================================================================
-- Master table for all parking slots in the system
-- ============================================================================

CREATE TABLE IF NOT EXISTS parking_slots (
    slot_id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slot_code           VARCHAR(20) NOT NULL UNIQUE,                -- e.g., "A-001", "B-142"
    slot_number         INTEGER NOT NULL,                            -- Physical slot number
    floor_level         INTEGER NOT NULL DEFAULT 1,                  -- Floor number (1, 2, 3, ...)
    zone                VARCHAR(50) NOT NULL,                        -- Zone identifier: "Zone-A", "Zone-B"
    area_id             UUID NOT NULL,                               -- Foreign key to areas table
    slot_type           VARCHAR(20) NOT NULL DEFAULT 'standard',     -- standard, compact, disabled, ev_charging, motorcycle
    is_active           BOOLEAN NOT NULL DEFAULT true,               -- Slot operational status
    latitude            DECIMAL(10, 8),                              -- GPS coordinates (optional for indoor)
    longitude           DECIMAL(11, 8),
    sensor_id           VARCHAR(50),                                 -- IoT sensor identifier
    price_per_hour      DECIMAL(8, 2) NOT NULL DEFAULT 0.00,         -- Dynamic pricing support
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_parking_slots_area FOREIGN KEY (area_id) 
        REFERENCES areas(area_id) ON DELETE CASCADE
);

COMMENT ON TABLE parking_slots IS 'Master reference table for all physical parking slots';

-- ============================================================================
-- 2. REFERENCE TABLE: areas
-- ============================================================================
-- Defines parking areas/zones for traffic volume & bottleneck mapping
-- ============================================================================

CREATE TABLE IF NOT EXISTS areas (
    area_id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    area_code           VARCHAR(20) NOT NULL UNIQUE,                 -- e.g., "AREA-A", "MALL-1"
    area_name           VARCHAR(100) NOT NULL,                       -- Human-readable name
    area_type           VARCHAR(30) NOT NULL DEFAULT 'public',       -- public, mall, office, residential, street
    capacity            INTEGER NOT NULL CHECK (capacity > 0),       -- Total slot capacity
    latitude            DECIMAL(10, 8) NOT NULL,                     -- Center point coordinates
    longitude           DECIMAL(11, 8) NOT NULL,
    boundary_polygon    JSONB,                                       -- GeoJSON polygon for area boundary
    is_active           BOOLEAN NOT NULL DEFAULT true,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE areas IS 'Geographic/logical areas grouping parking slots';

-- ============================================================================
-- 3. TABLE: parking_occupancy_history (TIME-SERIES)
-- ============================================================================
-- Records occupancy state changes per slot at minute/hour granularity
-- ============================================================================

CREATE TABLE IF NOT EXISTS parking_occupancy_history (
    occupancy_id        BIGSERIAL PRIMARY KEY,                       -- Auto-increment for time-series performance
    slot_id             UUID NOT NULL,                               -- Reference to parking slot
    area_id             UUID NOT NULL,                               -- Denormalized for query performance
    timestamp           TIMESTAMPTZ NOT NULL DEFAULT NOW(),          -- Exact time of reading
    is_occupied         BOOLEAN NOT NULL,                            -- Current occupancy state
    occupancy_status    VARCHAR(20) NOT NULL DEFAULT 'available',    -- available, occupied, reserved, maintenance
    vehicle_type        VARCHAR(20),                                 -- car, motorcycle, truck (NULL if empty)
    license_plate       VARCHAR(20),                                 -- Captured plate (if occupied & camera present)
    session_id          UUID,                                        -- Links to parking session if occupied
    entry_time          TIMESTAMPTZ,                                 -- Vehicle entry timestamp
    duration_minutes    INTEGER,                                     -- Computed duration if occupied
    sensor_reading_id   VARCHAR(100),                                -- Original IoT sensor message ID
    confidence_score    DECIMAL(3, 2) DEFAULT 1.00,                  -- Sensor confidence (0.00 - 1.00)

    CONSTRAINT fk_occupancy_slot FOREIGN KEY (slot_id) 
        REFERENCES parking_slots(slot_id) ON DELETE CASCADE,
    CONSTRAINT fk_occupancy_area FOREIGN KEY (area_id) 
        REFERENCES areas(area_id) ON DELETE CASCADE
);

-- Partition by time range (monthly) for massive scale
-- CREATE TABLE IF NOT EXISTS parking_occupancy_history PARTITION BY RANGE (timestamp);

COMMENT ON TABLE parking_occupancy_history IS 'Time-series record of parking slot occupancy states';

-- ============================================================================
-- 4. TABLE: traffic_volume_history (TIME-SERIES)
-- ============================================================================
-- Aggregated vehicle count per area per time interval
-- ============================================================================

CREATE TABLE IF NOT EXISTS traffic_volume_history (
    volume_id           BIGSERIAL PRIMARY KEY,
    area_id             UUID NOT NULL,                               -- Area being measured
    timestamp           TIMESTAMPTZ NOT NULL DEFAULT NOW(),          -- Start of time window
    interval_minutes    INTEGER NOT NULL DEFAULT 5,                  -- Aggregation window: 5, 15, 60
    vehicle_count       INTEGER NOT NULL DEFAULT 0 CHECK (vehicle_count >= 0),
    vehicles_entering   INTEGER NOT NULL DEFAULT 0,                  -- Vehicles entering area
    vehicles_leaving    INTEGER NOT NULL DEFAULT 0,                  -- Vehicles leaving area
    vehicle_type_counts JSONB DEFAULT '{}',                          -- {"car": 45, "motorcycle": 12, "truck": 3}
    avg_speed_kmh       DECIMAL(5, 2),                               -- Average traffic speed in area
    peak_count          INTEGER,                                     -- Max simultaneous vehicles in interval
    source              VARCHAR(30) NOT NULL DEFAULT 'sensor',       -- sensor, camera, manual, estimated
    data_quality        VARCHAR(20) NOT NULL DEFAULT 'verified',     -- raw, verified, interpolated, estimated
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_traffic_area FOREIGN KEY (area_id) 
        REFERENCES areas(area_id) ON DELETE CASCADE
);

COMMENT ON TABLE traffic_volume_history IS 'Time-series traffic volume per area per time interval';

-- ============================================================================
-- 5. TABLE: violation_history
-- ============================================================================
-- Records all parking violations detected by the system
-- ============================================================================

CREATE TABLE IF NOT EXISTS violation_history (
    violation_id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slot_id             UUID,                                        -- NULL if not in a defined slot
    area_id             UUID NOT NULL,                               -- Area where violation occurred
    timestamp           TIMESTAMPTZ NOT NULL DEFAULT NOW(),          -- Time of violation detection
    violation_type      VARCHAR(40) NOT NULL,                        -- illegal_parking, blocking, improper_parking, 
                                                                     -- overtime, no_permit, disabled_abuse, ev_non_ev
    severity            VARCHAR(15) NOT NULL DEFAULT 'medium',       -- low, medium, high, critical
    description         TEXT,                                        -- Human-readable description
    evidence_image_url  TEXT,                                        -- Photo evidence URL
    evidence_video_url  TEXT,                                        -- Video evidence URL (optional)
    license_plate       VARCHAR(20),                                 -- Offending vehicle plate
    vehicle_type        VARCHAR(20),                                 -- Type of offending vehicle
    detected_by         VARCHAR(30) NOT NULL DEFAULT 'ai_camera',    -- ai_camera, sensor, patrol, report
    detection_confidence DECIMAL(3, 2) NOT NULL DEFAULT 0.00,        -- AI confidence score (0.00 - 1.00)
    status              VARCHAR(20) NOT NULL DEFAULT 'pending',      -- pending, issued, appealed, resolved, dismissed
    fine_amount         DECIMAL(10, 2),                              -- Fine amount (local currency)
    fine_currency       VARCHAR(3) NOT NULL DEFAULT 'IDR',           -- Currency code
    officer_id          UUID,                                        -- Officer who processed (if manual)
    resolution_notes    TEXT,                                        -- Notes when resolved
    resolved_at         TIMESTAMPTZ,                                 -- When violation was resolved
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_violation_slot FOREIGN KEY (slot_id) 
        REFERENCES parking_slots(slot_id) ON DELETE SET NULL,
    CONSTRAINT fk_violation_area FOREIGN KEY (area_id) 
        REFERENCES areas(area_id) ON DELETE CASCADE
);

COMMENT ON TABLE violation_history IS 'Historical record of all parking violations';

-- ============================================================================
-- 6. TABLE: prediction_results (TIME-SERIES)
-- ============================================================================
-- Stores demand prediction results from AI/ML models
-- ============================================================================

CREATE TABLE IF NOT EXISTS prediction_results (
    prediction_id       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    area_id             UUID NOT NULL,                               -- Predicted area
    timestamp           TIMESTAMPTZ NOT NULL DEFAULT NOW(),          -- Time prediction was made
    prediction_time     TIMESTAMPTZ NOT NULL,                        -- Target time being predicted for
    prediction_horizon  VARCHAR(20) NOT NULL,                        -- short_term (15min), medium_term (1hr), long_term (24hr)
    model_name          VARCHAR(50) NOT NULL,                        -- Model identifier: "lstm_v2", "xgboost_demand"
    model_version       VARCHAR(20) NOT NULL,                        -- Model version for tracking
    predicted_demand    INTEGER NOT NULL CHECK (predicted_demand >= 0), -- Predicted vehicle count
    predicted_occupancy_rate DECIMAL(5, 4) NOT NULL,                 -- Predicted occupancy rate (0.0000 - 1.0000)
    confidence_lower    DECIMAL(5, 4),                               -- Lower bound of confidence interval
    confidence_upper    DECIMAL(5, 4),                               -- Upper bound of confidence interval
    prediction_interval JSONB,                                       -- {"p10": 35, "p50": 52, "p90": 68}
    features_used       JSONB,                                       -- List of features used: ["occupancy", "traffic", "weather"]
    input_data_window   JSONB,                                       -- {"start": "...", "end": "...", "granularity": "5min"}
    actual_demand       INTEGER,                                     -- Filled in later for model evaluation
    actual_occupancy_rate DECIMAL(5, 4),                             -- Actual rate for model evaluation
    error_mae           DECIMAL(5, 2),                               -- Mean Absolute Error (post-hoc)
    error_rmse          DECIMAL(5, 2),                               -- Root Mean Squared Error (post-hoc)
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_prediction_area FOREIGN KEY (area_id) 
        REFERENCES areas(area_id) ON DELETE CASCADE
);

COMMENT ON TABLE prediction_results IS 'AI model demand prediction results with actuals for evaluation';

-- ============================================================================
-- 7. TABLE: bottleneck_map
-- ============================================================================
-- Identifies and tracks congestion hotspots and overloaded areas
-- ============================================================================

CREATE TABLE IF NOT EXISTS bottleneck_map (
    bottleneck_id       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    area_id             UUID NOT NULL,                               -- Affected area
    location_name       VARCHAR(100) NOT NULL,                       -- Human-readable location name
    latitude            DECIMAL(10, 8) NOT NULL,                     -- Bottleneck center point
    longitude           DECIMAL(11, 8) NOT NULL,
    radius_meters       INTEGER NOT NULL DEFAULT 50,                 -- Affected radius
    timestamp           TIMESTAMPTZ NOT NULL DEFAULT NOW(),          -- Detection timestamp
    start_time          TIMESTAMPTZ NOT NULL,                        -- When bottleneck started
    end_time            TIMESTAMPTZ,                                 -- When bottleneck ended (NULL if ongoing)
    bottleneck_type     VARCHAR(30) NOT NULL,                        -- congestion, overload, spillback, entry_queue, exit_block
    severity_score      DECIMAL(3, 2) NOT NULL CHECK (severity_score >= 0 AND severity_score <= 1.00), -- 0.00 - 1.00
    affected_slots      INTEGER NOT NULL DEFAULT 0,                  -- Number of slots affected
    affected_capacity   INTEGER NOT NULL DEFAULT 0,                  -- Total capacity affected
    current_occupancy   INTEGER,                                     -- Current vehicles in bottleneck zone
    occupancy_rate      DECIMAL(5, 4),                               -- Current occupancy rate in zone
    avg_wait_time_min   DECIMAL(6, 2),                               -- Average wait time caused (minutes)
    contributing_factors JSONB,                                      -- {"event": "concert", "weather": "rain", "time": "rush_hour"}
    resolution_status   VARCHAR(20) NOT NULL DEFAULT 'active',       -- active, mitigating, resolved, false_positive
    mitigation_action   TEXT,                                        -- Action taken to resolve
    detected_by         VARCHAR(30) NOT NULL DEFAULT 'auto',         -- auto, manual, model
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_bottleneck_area FOREIGN KEY (area_id) 
        REFERENCES areas(area_id) ON DELETE CASCADE
);

COMMENT ON TABLE bottleneck_map IS 'Congestion hotspots and parking overload detection records';

-- ============================================================================
-- 8. TABLE: slot_usage_trends (AGGREGATED TIME-SERIES)
-- ============================================================================
-- Pre-computed statistical summaries for fast analytics & ML feature extraction
-- ============================================================================

CREATE TABLE IF NOT EXISTS slot_usage_trends (
    trend_id            BIGSERIAL PRIMARY KEY,
    slot_id             UUID,                                        -- NULL if area-level aggregate
    area_id             UUID NOT NULL,                               -- Area being summarized
    period_start        TIMESTAMPTZ NOT NULL,                        -- Start of aggregation period
    period_end          TIMESTAMPTZ NOT NULL,                        -- End of aggregation period
    granularity         VARCHAR(15) NOT NULL,                        -- hourly, daily, weekly, monthly
    total_occupancy_minutes INTEGER NOT NULL DEFAULT 0,              -- Total minutes slot was occupied
    total_sessions      INTEGER NOT NULL DEFAULT 0,                  -- Number of parking sessions
    avg_duration_minutes DECIMAL(8, 2) DEFAULT 0.00,                 -- Average session duration
    max_duration_minutes INTEGER,                                    -- Longest single session
    min_duration_minutes INTEGER,                                    -- Shortest single session
    occupancy_rate      DECIMAL(5, 4) NOT NULL DEFAULT 0.0000,      -- % of time slot was occupied
    peak_occupancy_time TIMESTAMPTZ,                                 -- Timestamp of peak usage
    peak_concurrent     INTEGER DEFAULT 0,                           -- Max concurrent vehicles (for area-level)
    turnover_rate       DECIMAL(6, 2) DEFAULT 0.00,                  -- Sessions per hour
    revenue_generated   DECIMAL(10, 2) DEFAULT 0.00,                 -- Revenue from this slot/area in period
    violation_count     INTEGER NOT NULL DEFAULT 0,                  -- Violations in this period
    vehicle_type_distribution JSONB DEFAULT '{}',                    -- {"car": 0.75, "motorcycle": 0.20, "truck": 0.05}
    hourly_distribution JSONB,                                       -- {0: 0.1, 1: 0.05, ..., 23: 0.8} occupancy by hour
    day_of_week_distribution JSONB,                                  -- {1: 0.6, 2: 0.7, ..., 7: 0.9} occupancy by day
    computed_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),          -- When this aggregate was computed

    CONSTRAINT fk_trend_slot FOREIGN KEY (slot_id) 
        REFERENCES parking_slots(slot_id) ON DELETE SET NULL,
    CONSTRAINT fk_trend_area FOREIGN KEY (area_id) 
        REFERENCES areas(area_id) ON DELETE CASCADE
);

COMMENT ON TABLE slot_usage_trends IS 'Pre-aggregated usage statistics for fast analytics and ML features';

-- ============================================================================
-- INDEXING STRATEGY
-- ============================================================================

-- ---- parking_occupancy_history indexes ----
-- Time-series range queries (most common: "give me occupancy for last X hours")
CREATE INDEX idx_occupancy_timestamp ON parking_occupancy_history USING btree (timestamp DESC);

-- Compound: query by slot + time (single slot history)
CREATE INDEX idx_occupancy_slot_time ON parking_occupancy_history USING btree (slot_id, timestamp DESC);

-- Compound: query by area + time (area-level analytics)
CREATE INDEX idx_occupancy_area_time ON parking_occupancy_history USING btree (area_id, timestamp DESC);

-- Partial index: only occupied slots (for finding busy slots)
CREATE INDEX idx_occupancy_occupied ON parking_occupancy_history 
    USING btree (timestamp DESC) WHERE is_occupied = true;

-- Hash index on session_id for join queries
CREATE INDEX idx_occupancy_session_id ON parking_occupancy_history USING hash (session_id);

-- ---- traffic_volume_history indexes ----
CREATE INDEX idx_traffic_timestamp ON traffic_volume_history USING btree (timestamp DESC);
CREATE INDEX idx_traffic_area_time ON traffic_volume_history USING btree (area_id, timestamp DESC);

-- Partial: only verified data (for ML training)
CREATE INDEX idx_traffic_verified ON traffic_volume_history 
    USING btree (timestamp DESC) WHERE data_quality = 'verified';

-- ---- violation_history indexes ----
CREATE INDEX idx_violation_timestamp ON violation_history USING btree (timestamp DESC);
CREATE INDEX idx_violation_area_time ON violation_history USING btree (area_id, timestamp DESC);
CREATE INDEX idx_violation_type ON violation_history USING btree (violation_type);
CREATE INDEX idx_violation_status ON violation_history USING btree (status);

-- Compound: unresolved violations by area
CREATE INDEX idx_violation_unresolved_area ON violation_history 
    USING btree (area_id, timestamp DESC) WHERE status IN ('pending', 'issued');

-- ---- prediction_results indexes ----
CREATE INDEX idx_prediction_timestamp ON prediction_results USING btree (timestamp DESC);
CREATE INDEX idx_prediction_time ON prediction_results USING btree (prediction_time DESC);
CREATE INDEX idx_prediction_area_time ON prediction_results USING btree (area_id, prediction_time DESC);
CREATE INDEX idx_prediction_model ON prediction_results USING btree (model_name, model_version);

-- Partial: predictions that haven't been evaluated yet
CREATE INDEX idx_prediction_pending_eval ON prediction_results 
    USING btree (prediction_time DESC) WHERE actual_demand IS NULL;

-- ---- bottleneck_map indexes ----
CREATE INDEX idx_bottleneck_timestamp ON bottleneck_map USING btree (timestamp DESC);
CREATE INDEX idx_bottleneck_area_time ON bottleneck_map USING btree (area_id, timestamp DESC);
CREATE INDEX idx_bottleneck_status ON bottleneck_map USING btree (resolution_status);
CREATE INDEX idx_bottleneck_active ON bottleneck_map 
    USING btree (timestamp DESC) WHERE resolution_status = 'active';

-- Spatial index for geographic queries (if PostGIS is available)
-- CREATE INDEX idx_bottleneck_spatial ON bottleneck_map USING gist (ST_MakePoint(longitude, latitude));

-- ---- slot_usage_trends indexes ----
CREATE INDEX idx_trend_period ON slot_usage_trends USING btree (period_start DESC, period_end DESC);
CREATE INDEX idx_trend_area_granularity ON slot_usage_trends USING btree (area_id, granularity);
CREATE INDEX idx_trend_slot_period ON slot_usage_trends USING btree (slot_id, period_start DESC) WHERE slot_id IS NOT NULL;

-- ---- areas & parking_slots indexes ----
CREATE INDEX idx_slots_area ON parking_slots USING btree (area_id);
CREATE INDEX idx_slots_active ON parking_slots USING btree (area_id) WHERE is_active = true;
CREATE INDEX idx_areas_type ON areas USING btree (area_type);

-- ============================================================================
-- TTL / DATA RETENTION POLICY (Using pg_partman or TimescaleDB)
-- ============================================================================

-- TimescaleDB hypertable conversion (if TimescaleDB extension is available)
-- SELECT create_hypertable('parking_occupancy_history', 'timestamp', chunk_time_interval => INTERVAL '1 month');
-- SELECT create_hypertable('traffic_volume_history', 'timestamp', chunk_time_interval => INTERVAL '1 month');
-- SELECT create_hypertable('prediction_results', 'prediction_time', chunk_time_interval => INTERVAL '1 month');

-- Data retention policies (auto-drop old chunks)
-- SELECT add_retention_policy('parking_occupancy_history', drop_after => INTERVAL '12 months');
-- SELECT add_retention_policy('traffic_volume_history', drop_after => INTERVAL '12 months');
-- SELECT add_retention_policy('prediction_results', drop_after => INTERVAL '6 months');

-- For raw violation data, keep longer for compliance
-- SELECT add_retention_policy('violation_history', drop_after => INTERVAL '24 months');

-- ============================================================================
-- CONTINUOUS AGGREGATES (TimescaleDB) - Optional but recommended
-- ============================================================================

-- Materialized view for hourly occupancy summary
-- CREATE MATERIALIZED VIEW occupancy_hourly_summary
-- WITH (timescaledb.continuous) AS
-- SELECT
--     time_bucket('1 hour', timestamp) AS bucket,
--     area_id,
--     COUNT(*) AS total_readings,
--     SUM(CASE WHEN is_occupied THEN 1 ELSE 0 END) AS occupied_count,
--     AVG(CASE WHEN is_occupied THEN 1.0 ELSE 0.0 END) AS occupancy_rate
-- FROM parking_occupancy_history
-- GROUP BY bucket, area_id
-- WITH NO DATA;

-- ============================================================================
-- DUMMY SAMPLE DATA
-- ============================================================================

-- Insert sample areas
INSERT INTO areas (area_id, area_code, area_name, area_type, capacity, latitude, longitude) VALUES
    ('a1111111-1111-1111-1111-111111111111', 'AREA-A', 'Downtown Central Parking', 'public', 250, -6.2088, 106.8456),
    ('a2222222-2222-2222-2222-222222222222', 'AREA-B', 'Shopping Mall Garage', 'mall', 500, -6.2297, 106.8295),
    ('a3333333-3333-3333-3333-333333333333', 'AREA-C', 'Office Complex Zone', 'office', 180, -6.2186, 106.8026);

-- Insert sample parking slots
INSERT INTO parking_slots (slot_id, slot_code, slot_number, floor_level, zone, area_id, slot_type, sensor_id, price_per_hour) VALUES
    ('s1111111-1111-1111-1111-111111111111', 'A-001', 1, 1, 'Zone-A', 'a1111111-1111-1111-1111-111111111111', 'standard', 'SENSOR-A001', 5000.00),
    ('s2222222-2222-2222-2222-222222222222', 'A-002', 2, 1, 'Zone-A', 'a1111111-1111-1111-1111-111111111111', 'ev_charging', 'SENSOR-A002', 8000.00),
    ('s3333333-3333-3333-3333-333333333333', 'B-101', 101, 2, 'Zone-B', 'a2222222-2222-2222-2222-222222222222', 'compact', 'SENSOR-B101', 6000.00);

-- Insert sample parking_occupancy_history
INSERT INTO parking_occupancy_history (slot_id, area_id, timestamp, is_occupied, occupancy_status, vehicle_type, license_plate, confidence_score) VALUES
    ('s1111111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111', '2026-04-07 08:00:00+07', true, 'occupied', 'car', 'B 1234 ABC', 0.98),
    ('s1111111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111', '2026-04-07 08:05:00+07', true, 'occupied', 'car', 'B 1234 ABC', 0.97),
    ('s2222222-2222-2222-2222-222222222222', 'a1111111-1111-1111-1111-111111111111', '2026-04-07 08:00:00+07', false, 'available', NULL, NULL, 1.00),
    ('s2222222-2222-2222-2222-222222222222', 'a1111111-1111-1111-1111-111111111111', '2026-04-07 08:05:00+07', true, 'occupied', 'car', 'B 5678 DEF', 0.95),
    ('s3333333-3333-3333-3333-333333333333', 'a2222222-2222-2222-2222-222222222222', '2026-04-07 08:00:00+07', true, 'occupied', 'motorcycle', 'B 9012 GHI', 0.99),
    ('s3333333-3333-3333-3333-333333333333', 'a2222222-2222-2222-2222-222222222222', '2026-04-07 08:05:00+07', true, 'occupied', 'motorcycle', 'B 9012 GHI', 0.99);

-- Insert sample traffic_volume_history
INSERT INTO traffic_volume_history (area_id, timestamp, interval_minutes, vehicle_count, vehicles_entering, vehicles_leaving, vehicle_type_counts, avg_speed_kmh, peak_count) VALUES
    ('a1111111-1111-1111-1111-111111111111', '2026-04-07 08:00:00+07', 5, 45, 28, 17, '{"car": 30, "motorcycle": 12, "truck": 3}', 25.50, 38),
    ('a1111111-1111-1111-1111-111111111111', '2026-04-07 08:05:00+07', 5, 52, 35, 17, '{"car": 38, "motorcycle": 10, "truck": 4}', 22.30, 42),
    ('a2222222-2222-2222-2222-222222222222', '2026-04-07 08:00:00+07', 5, 78, 50, 28, '{"car": 55, "motorcycle": 18, "truck": 5}', 18.70, 65),
    ('a2222222-2222-2222-2222-222222222222', '2026-04-07 08:05:00+07', 5, 65, 30, 35, '{"car": 42, "motorcycle": 15, "truck": 8}', 20.10, 58),
    ('a3333333-3333-3333-3333-333333333333', '2026-04-07 08:00:00+07', 5, 22, 15, 7, '{"car": 18, "motorcycle": 3, "truck": 1}', 30.20, 20);

-- Insert sample violation_history
INSERT INTO violation_history (violation_id, slot_id, area_id, timestamp, violation_type, severity, description, license_plate, vehicle_type, detected_by, detection_confidence, status, fine_amount) VALUES
    ('v1111111-1111-1111-1111-111111111111', 's1111111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111', '2026-04-07 08:15:00+07', 'overtime', 'medium', 'Vehicle exceeded 2-hour parking limit by 45 minutes', 'B 1234 ABC', 'car', 'ai_camera', 0.96, 'pending', 50000.00),
    ('v2222222-2222-2222-2222-222222222222', NULL, 'a2222222-2222-2222-2222-222222222222', '2026-04-07 08:20:00+07', 'illegal_parking', 'high', 'Vehicle parked in fire lane blocking access', 'B 9999 XYZ', 'car', 'ai_camera', 0.99, 'issued', 150000.00),
    ('v3333333-3333-3333-3333-333333333333', 's3333333-3333-3333-3333-333333333333', 'a2222222-2222-2222-2222-222222222222', '2026-04-07 08:30:00+07', 'blocking', 'high', 'Motorcycle blocking adjacent slot access', 'B 9012 GHI', 'motorcycle', 'ai_camera', 0.92, 'pending', 75000.00);

-- Insert sample prediction_results
INSERT INTO prediction_results (prediction_id, area_id, timestamp, prediction_time, prediction_horizon, model_name, model_version, predicted_demand, predicted_occupancy_rate, confidence_lower, confidence_upper, prediction_interval, features_used, actual_demand, actual_occupancy_rate) VALUES
    ('p1111111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111', '2026-04-07 08:00:00+07', '2026-04-07 08:15:00+07', 'short_term', 'lstm_v2', '2.1.0', 185, 0.7400, 0.6800, 0.8000, '{"p10": 165, "p50": 185, "p90": 210}', '["occupancy", "traffic", "hour_of_day", "day_of_week"]', 178, 0.7120),
    ('p2222222-2222-2222-2222-222222222222', 'a1111111-1111-1111-1111-111111111111', '2026-04-07 08:00:00+07', '2026-04-07 09:00:00+07', 'medium_term', 'lstm_v2', '2.1.0', 210, 0.8400, 0.7600, 0.9100, '{"p10": 190, "p50": 210, "p90": 235}', '["occupancy", "traffic", "weather", "events"]', NULL, NULL),
    ('p3333333-3333-3333-3333-333333333333', 'a2222222-2222-2222-2222-222222222222', '2026-04-07 08:00:00+07', '2026-04-07 08:15:00+07', 'short_term', 'xgboost_demand', '1.3.0', 420, 0.8400, 0.7900, 0.8900, '{"p10": 395, "p50": 420, "p90": 455}', '["occupancy", "traffic", "violations", "hour_of_day"]', 435, 0.8700);

-- Insert sample bottleneck_map
INSERT INTO bottleneck_map (bottleneck_id, area_id, location_name, latitude, longitude, radius_meters, timestamp, start_time, bottleneck_type, severity_score, affected_slots, affected_capacity, current_occupancy, occupancy_rate, avg_wait_time_min, contributing_factors, resolution_status) VALUES
    ('b1111111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111', 'Downtown Main Entrance', -6.2090, 106.8460, 75, '2026-04-07 08:10:00+07', '2026-04-07 07:45:00+07', 'entry_queue', 0.82, 15, 15, 14, 0.9333, 12.50, '{"event": "rush_hour", "weather": "clear"}', 'active'),
    ('b2222222-2222-2222-2222-222222222222', 'a2222222-2222-2222-2222-222222222222', 'Mall Level 2 North Wing', -6.2299, 106.8290, 50, '2026-04-07 08:00:00+07', '2026-04-07 07:30:00+07', 'overload', 0.91, 45, 45, 44, 0.9778, 18.30, '{"event": "weekend_shopping", "promotion": "sale"}', 'mitigating'),
    ('b3333333-3333-3333-3333-333333333333', 'a3333333-3333-3333-3333-333333333333', 'Office Tower B Exit', -6.2188, 106.8030, 40, '2026-04-07 08:20:00+07', '2026-04-07 08:00:00+07', 'exit_block', 0.65, 8, 8, 6, 0.7500, 5.20, '{"event": "shift_change"}', 'resolved');

-- Insert sample slot_usage_trends
INSERT INTO slot_usage_trends (slot_id, area_id, period_start, period_end, granularity, total_occupancy_minutes, total_sessions, avg_duration_minutes, max_duration_minutes, min_duration_minutes, occupancy_rate, peak_concurrent, turnover_rate, revenue_generated, violation_count, vehicle_type_distribution, hourly_distribution) VALUES
    ('s1111111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111', '2026-04-07 08:00:00+07', '2026-04-07 09:00:00+07', 'hourly', 52, 1, 52.00, 52, 52, 0.8667, 1, 1.00, 4333.33, 0, '{"car": 1.0}', '{"8": 0.90, "9": 0.83}'),
    (NULL, 'a1111111-1111-1111-1111-111111111111', '2026-04-07 00:00:00+07', '2026-04-07 23:59:59+07', 'daily', 18750, 142, 132.04, 480, 8, 0.7500, 189, 0.57, 708333.33, 5, '{"car": 0.72, "motorcycle": 0.23, "truck": 0.05}', '{"7": 0.45, "8": 0.85, "9": 0.90, "12": 0.88, "17": 0.95, "18": 0.70}'),
    (NULL, 'a2222222-2222-2222-2222-222222222222', '2026-04-01 00:00:00+07', '2026-04-30 23:59:59+07', 'monthly', 425000, 3250, 130.77, 720, 5, 0.8200, 485, 0.14, 19500000.00, 42, '{"car": 0.68, "motorcycle": 0.25, "truck": 0.07}', '{"10": 0.75, "11": 0.85, "12": 0.90, "15": 0.80, "16": 0.88}');

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================
