// ============================================================================
// SMART PARKING & INFRASTRUCTURE DEMAND MANAGEMENT
// MongoDB Database Schema (MongoDB Version)
// Optimized for Time-Series Analytics & ML Prediction Pipelines
// ============================================================================

// Database: smart_parking_db
// Created: 2026-04-07
// Purpose: Real-time parking analytics, demand forecasting, violation tracking
// MongoDB Version: 6.0+ (uses time-series collections where applicable)
// ============================================================================

use smart_parking_db;

// ============================================================================
// 1. REFERENCE COLLECTION: areas
// ============================================================================
// Defines parking areas/zones for traffic volume & bottleneck mapping
// ============================================================================

db.createCollection("areas", {
    validator: {
        $jsonSchema: {
            bsonType: "object",
            required: ["area_code", "area_name", "area_type", "capacity", "latitude", "longitude", "is_active"],
            properties: {
                area_code: {
                    bsonType: "string",
                    description: "Unique area identifier, e.g., 'AREA-A', 'MALL-1'"
                },
                area_name: {
                    bsonType: "string",
                    description: "Human-readable area name"
                },
                area_type: {
                    bsonType: "string",
                    enum: ["public", "mall", "office", "residential", "street"],
                    description: "Type of parking area"
                },
                capacity: {
                    bsonType: "int",
                    minimum: 1,
                    description: "Total slot capacity of the area"
                },
                latitude: {
                    bsonType: "double",
                    description: "Center point latitude (WGS84)"
                },
                longitude: {
                    bsonType: "double",
                    description: "Center point longitude (WGS84)"
                },
                boundary_polygon: {
                    bsonType: "object",
                    description: "GeoJSON polygon defining area boundary"
                },
                is_active: {
                    bsonType: "bool",
                    description: "Whether area is currently active"
                },
                created_at: {
                    bsonType: "date",
                    description: "Record creation timestamp"
                },
                updated_at: {
                    bsonType: "date",
                    description: "Last update timestamp"
                }
            }
        }
    }
});

// ============================================================================
// 2. REFERENCE COLLECTION: parking_slots
// ============================================================================
// Master table for all parking slots in the system
// ============================================================================

db.createCollection("parking_slots", {
    validator: {
        $jsonSchema: {
            bsonType: "object",
            required: ["slot_code", "slot_number", "floor_level", "zone", "area_id", "slot_type", "is_active"],
            properties: {
                slot_code: {
                    bsonType: "string",
                    description: "Unique slot code, e.g., 'A-001', 'B-142'"
                },
                slot_number: {
                    bsonType: "int",
                    description: "Physical slot number"
                },
                floor_level: {
                    bsonType: "int",
                    description: "Floor level (1, 2, 3, ...)"
                },
                zone: {
                    bsonType: "string",
                    description: "Zone identifier within area"
                },
                area_id: {
                    bsonType: "objectId",
                    description: "Reference to areas collection"
                },
                slot_type: {
                    bsonType: "string",
                    enum: ["standard", "compact", "disabled", "ev_charging", "motorcycle"],
                    description: "Type of parking slot"
                },
                is_active: {
                    bsonType: "bool",
                    description: "Whether slot is operational"
                },
                latitude: {
                    bsonType: "double",
                    description: "GPS latitude (optional for indoor)"
                },
                longitude: {
                    bsonType: "double",
                    description: "GPS longitude (optional for indoor)"
                },
                sensor_id: {
                    bsonType: "string",
                    description: "IoT sensor identifier"
                },
                price_per_hour: {
                    bsonType: "decimal",
                    description: "Hourly parking rate"
                },
                created_at: {
                    bsonType: "date",
                    description: "Record creation timestamp"
                },
                updated_at: {
                    bsonType: "date",
                    description: "Last update timestamp"
                }
            }
        }
    }
});

// ============================================================================
// 3. TIME-SERIES COLLECTION: parking_occupancy_history
// ============================================================================
// Uses MongoDB native time-series collection for optimized storage & queries
// Records occupancy state changes per slot at minute/hour granularity
// ============================================================================

db.createCollection("parking_occupancy_history", {
    timeseries: {
        timeField: "timestamp",
        metaField: "metadata",
        granularity: "minutes",
        bucketMaxSpanSeconds: 3600  // 1 hour buckets
    },
    expireAfterSeconds: 31536000  // TTL: 12 months auto-expire
});

// Schema documentation (MongoDB time-series collections don't support validators)
// Document structure:
// {
//     timestamp: Date,                        // REQUIRED - time of reading
//     metadata: {                              // REQUIRED - compound index field
//         slot_id: ObjectId,                   // Reference to parking_slots
//         area_id: ObjectId,                   // Denormalized for query performance
//         slot_code: string                    // Denormalized for fast lookups
//     },
//     is_occupied: boolean,                    // REQUIRED - current occupancy state
//     occupancy_status: string,                // "available" | "occupied" | "reserved" | "maintenance"
//     vehicle_type: string,                    // "car" | "motorcycle" | "truck" (null if empty)
//     license_plate: string,                   // Captured plate (if occupied & camera present)
//     session_id: ObjectId,                    // Links to parking session if occupied
//     entry_time: Date,                        // Vehicle entry timestamp
//     duration_minutes: int,                   // Computed duration if occupied
//     sensor_reading_id: string,               // Original IoT sensor message ID
//     confidence_score: double                 // Sensor confidence (0.00 - 1.00)
// }

// ============================================================================
// 4. TIME-SERIES COLLECTION: traffic_volume_history
// ============================================================================
// Aggregated vehicle count per area per time interval
// ============================================================================

db.createCollection("traffic_volume_history", {
    timeseries: {
        timeField: "timestamp",
        metaField: "metadata",
        granularity: "minutes",
        bucketMaxSpanSeconds: 3600
    },
    expireAfterSeconds: 31536000  // TTL: 12 months auto-expire
});

// Document structure:
// {
//     timestamp: Date,                        // REQUIRED - start of time window
//     metadata: {
//         area_id: ObjectId,                   // Reference to areas
//         area_code: string                    // Denormalized
//     },
//     interval_minutes: int,                   // Aggregation window: 5, 15, 60
//     vehicle_count: int,                      // Total vehicles counted
//     vehicles_entering: int,                  // Vehicles entering area
//     vehicles_leaving: int,                   // Vehicles leaving area
//     vehicle_type_counts: {                   // Breakdown by type
//         car: int,
//         motorcycle: int,
//         truck: int
//     },
//     avg_speed_kmh: double,                   // Average traffic speed
//     peak_count: int,                         // Max simultaneous vehicles
//     source: string,                          // "sensor" | "camera" | "manual" | "estimated"
//     data_quality: string                     // "raw" | "verified" | "interpolated" | "estimated"
// }

// ============================================================================
// 5. COLLECTION: violation_history
// ============================================================================
// Records all parking violations detected by the system
// ============================================================================

db.createCollection("violation_history", {
    validator: {
        $jsonSchema: {
            bsonType: "object",
            required: ["area_id", "timestamp", "violation_type", "severity", "detected_by", "status"],
            properties: {
                slot_id: {
                    bsonType: "objectId",
                    description: "Reference to parking_slots (null if not in defined slot)"
                },
                area_id: {
                    bsonType: "objectId",
                    description: "Reference to areas - WHERE violation occurred"
                },
                timestamp: {
                    bsonType: "date",
                    description: "Time of violation detection"
                },
                violation_type: {
                    bsonType: "string",
                    enum: [
                        "illegal_parking", "blocking", "improper_parking",
                        "overtime", "no_permit", "disabled_abuse", "ev_non_ev"
                    ],
                    description: "Type of violation"
                },
                severity: {
                    bsonType: "string",
                    enum: ["low", "medium", "high", "critical"],
                    description: "Violation severity level"
                },
                description: {
                    bsonType: "string",
                    description: "Human-readable description"
                },
                evidence_image_url: {
                    bsonType: "string",
                    description: "Photo evidence URL"
                },
                evidence_video_url: {
                    bsonType: "string",
                    description: "Video evidence URL (optional)"
                },
                license_plate: {
                    bsonType: "string",
                    description: "Offending vehicle plate number"
                },
                vehicle_type: {
                    bsonType: "string",
                    description: "Type of offending vehicle"
                },
                detected_by: {
                    bsonType: "string",
                    enum: ["ai_camera", "sensor", "patrol", "report"],
                    description: "Detection method"
                },
                detection_confidence: {
                    bsonType: "double",
                    minimum: 0,
                    maximum: 1,
                    description: "AI confidence score (0.00 - 1.00)"
                },
                status: {
                    bsonType: "string",
                    enum: ["pending", "issued", "appealed", "resolved", "dismissed"],
                    description: "Current violation status"
                },
                fine_amount: {
                    bsonType: "decimal",
                    description: "Fine amount in local currency"
                },
                fine_currency: {
                    bsonType: "string",
                    description: "ISO 4217 currency code (default: IDR)"
                },
                officer_id: {
                    bsonType: "objectId",
                    description: "Officer who processed (if manual)"
                },
                resolution_notes: {
                    bsonType: "string",
                    description: "Notes when resolved"
                },
                resolved_at: {
                    bsonType: "date",
                    description: "When violation was resolved"
                },
                created_at: {
                    bsonType: "date",
                    description: "Record creation timestamp"
                }
            }
        }
    }
});

// ============================================================================
// 6. TIME-SERIES COLLECTION: prediction_results
// ============================================================================
// Stores demand prediction results from AI/ML models
// ============================================================================

db.createCollection("prediction_results", {
    timeseries: {
        timeField: "timestamp",
        metaField: "metadata",
        granularity: "minutes",
        bucketMaxSpanSeconds: 3600
    },
    expireAfterSeconds: 15768000  // TTL: 6 months auto-expire
});

// Document structure:
// {
//     timestamp: Date,                        // REQUIRED - time prediction was made
//     metadata: {
//         area_id: ObjectId,                   // Reference to areas
//         area_code: string,
//         model_name: string,                  // Model identifier
//         model_version: string                // Model version
//     },
//     prediction_time: Date,                   // Target time being predicted
//     prediction_horizon: string,              // "short_term" | "medium_term" | "long_term"
//     predicted_demand: int,                   // Predicted vehicle count
//     predicted_occupancy_rate: double,        // Predicted occupancy rate (0.0000 - 1.0000)
//     confidence_lower: double,                // Lower bound of confidence interval
//     confidence_upper: double,                // Upper bound of confidence interval
//     prediction_interval: {                   // Percentile predictions
//         p10: int,
//         p50: int,
//         p90: int
//     },
//     features_used: [string],                 // List of features used
//     input_data_window: {
//         start: Date,
//         end: Date,
//         granularity: string
//     },
//     actual_demand: int,                      // Filled later for evaluation
//     actual_occupancy_rate: double,           // Actual rate for evaluation
//     error_mae: double,                       // Mean Absolute Error (post-hoc)
//     error_rmse: double                       // Root Mean Squared Error (post-hoc)
// }

// ============================================================================
// 7. COLLECTION: bottleneck_map
// ============================================================================
// Identifies and tracks congestion hotspots and overloaded areas
// ============================================================================

db.createCollection("bottleneck_map", {
    validator: {
        $jsonSchema: {
            bsonType: "object",
            required: [
                "area_id", "location_name", "latitude", "longitude",
                "timestamp", "start_time", "bottleneck_type",
                "severity_score", "affected_slots", "resolution_status"
            ],
            properties: {
                area_id: {
                    bsonType: "objectId",
                    description: "Reference to areas"
                },
                location_name: {
                    bsonType: "string",
                    description: "Human-readable location name"
                },
                latitude: {
                    bsonType: "double",
                    description: "Bottleneck center latitude"
                },
                longitude: {
                    bsonType: "double",
                    description: "Bottleneck center longitude"
                },
                radius_meters: {
                    bsonType: "int",
                    description: "Affected radius in meters"
                },
                timestamp: {
                    bsonType: "date",
                    description: "Detection timestamp"
                },
                start_time: {
                    bsonType: "date",
                    description: "When bottleneck started"
                },
                end_time: {
                    bsonType: "date",
                    description: "When bottleneck ended (null if ongoing)"
                },
                bottleneck_type: {
                    bsonType: "string",
                    enum: ["congestion", "overload", "spillback", "entry_queue", "exit_block"],
                    description: "Type of bottleneck"
                },
                severity_score: {
                    bsonType: "double",
                    minimum: 0,
                    maximum: 1,
                    description: "Severity score (0.00 - 1.00)"
                },
                affected_slots: {
                    bsonType: "int",
                    description: "Number of slots affected"
                },
                affected_capacity: {
                    bsonType: "int",
                    description: "Total capacity affected"
                },
                current_occupancy: {
                    bsonType: "int",
                    description: "Current vehicles in bottleneck zone"
                },
                occupancy_rate: {
                    bsonType: "double",
                    description: "Current occupancy rate in zone"
                },
                avg_wait_time_min: {
                    bsonType: "double",
                    description: "Average wait time caused (minutes)"
                },
                contributing_factors: {
                    bsonType: "object",
                    description: "Context factors contributing to bottleneck"
                },
                resolution_status: {
                    bsonType: "string",
                    enum: ["active", "mitigating", "resolved", "false_positive"],
                    description: "Current resolution status"
                },
                mitigation_action: {
                    bsonType: "string",
                    description: "Action taken to resolve"
                },
                detected_by: {
                    bsonType: "string",
                    enum: ["auto", "manual", "model"],
                    description: "Detection method"
                },
                created_at: {
                    bsonType: "date",
                    description: "Record creation timestamp"
                }
            }
        }
    }
});

// ============================================================================
// 8. COLLECTION: slot_usage_trends
// ============================================================================
// Pre-computed statistical summaries for fast analytics & ML feature extraction
// ============================================================================

db.createCollection("slot_usage_trends", {
    validator: {
        $jsonSchema: {
            bsonType: "object",
            required: [
                "area_id", "period_start", "period_end",
                "granularity", "total_occupancy_minutes",
                "total_sessions", "occupancy_rate"
            ],
            properties: {
                slot_id: {
                    bsonType: "objectId",
                    description: "Reference to parking_slots (null if area-level aggregate)"
                },
                area_id: {
                    bsonType: "objectId",
                    description: "Reference to areas"
                },
                period_start: {
                    bsonType: "date",
                    description: "Start of aggregation period"
                },
                period_end: {
                    bsonType: "date",
                    description: "End of aggregation period"
                },
                granularity: {
                    bsonType: "string",
                    enum: ["hourly", "daily", "weekly", "monthly"],
                    description: "Aggregation granularity"
                },
                total_occupancy_minutes: {
                    bsonType: "int",
                    description: "Total minutes slot was occupied"
                },
                total_sessions: {
                    bsonType: "int",
                    description: "Number of parking sessions"
                },
                avg_duration_minutes: {
                    bsonType: "double",
                    description: "Average session duration"
                },
                max_duration_minutes: {
                    bsonType: "int",
                    description: "Longest single session"
                },
                min_duration_minutes: {
                    bsonType: "int",
                    description: "Shortest single session"
                },
                occupancy_rate: {
                    bsonType: "double",
                    minimum: 0,
                    maximum: 1,
                    description: "% of time slot was occupied"
                },
                peak_occupancy_time: {
                    bsonType: "date",
                    description: "Timestamp of peak usage"
                },
                peak_concurrent: {
                    bsonType: "int",
                    description: "Max concurrent vehicles (for area-level)"
                },
                turnover_rate: {
                    bsonType: "double",
                    description: "Sessions per hour"
                },
                revenue_generated: {
                    bsonType: "decimal",
                    description: "Revenue from this slot/area in period"
                },
                violation_count: {
                    bsonType: "int",
                    description: "Violations in this period"
                },
                vehicle_type_distribution: {
                    bsonType: "object",
                    description: "Vehicle type breakdown: {car: 0.75, motorcycle: 0.20, truck: 0.05}"
                },
                hourly_distribution: {
                    bsonType: "object",
                    description: "Occupancy by hour of day: {0: 0.1, 8: 0.85, ...}"
                },
                day_of_week_distribution: {
                    bsonType: "object",
                    description: "Occupancy by day: {1: 0.6, 2: 0.7, ..., 7: 0.9}"
                },
                computed_at: {
                    bsonType: "date",
                    description: "When this aggregate was computed"
                }
            }
        }
    }
});

// ============================================================================
// INDEXING STRATEGY
// ============================================================================

// ---- areas indexes ----
db.areas.createIndex({ "area_code": 1 }, { unique: true });
db.areas.createIndex({ "area_type": 1 });
db.areas.createIndex({ "is_active": 1 });
// 2dsphere index for geographic queries
db.areas.createIndex({ 
    "location": "2dsphere" 
}, { 
    name: "idx_areas_geospatial" 
});

// ---- parking_slots indexes ----
db.parking_slots.createIndex({ "slot_code": 1 }, { unique: true });
db.parking_slots.createIndex({ "area_id": 1 });
db.parking_slots.createIndex({ "zone": 1 });
db.parking_slots.createIndex({ "slot_type": 1 });
db.parking_slots.createIndex({ "is_active": 1 });
db.parking_slots.createIndex({ "area_id": 1, "is_active": 1 });
db.parking_slots.createIndex({ "sensor_id": 1 }, { sparse: true });

// ---- parking_occupancy_history indexes (time-series auto-indexed on timestamp + metadata) ----
// MongoDB time-series collections automatically index:
//   - timeField (timestamp)
//   - metaField (metadata)
// Additional compound indexes:
db.parking_occupancy_history.createIndex({ 
    "metadata.slot_id": 1, 
    "timestamp": -1 
}, { name: "idx_occupancy_slot_time" });

db.parking_occupancy_history.createIndex({ 
    "metadata.area_id": 1, 
    "timestamp": -1 
}, { name: "idx_occupancy_area_time" });

db.parking_occupancy_history.createIndex({ 
    "is_occupied": 1, 
    "timestamp": -1 
}, { 
    name: "idx_occupancy_occupied",
    partialFilterExpression: { is_occupied: true }
});

db.parking_occupancy_history.createIndex({ 
    "metadata.slot_id": 1, 
    "is_occupied": 1, 
    "timestamp": -1 
}, { name: "idx_occupancy_slot_status_time" });

// ---- traffic_volume_history indexes ----
db.traffic_volume_history.createIndex({ 
    "metadata.area_id": 1, 
    "timestamp": -1 
}, { name: "idx_traffic_area_time" });

db.traffic_volume_history.createIndex({ 
    "data_quality": 1, 
    "timestamp": -1 
}, {
    name: "idx_traffic_verified",
    partialFilterExpression: { data_quality: "verified" }
});

db.traffic_volume_history.createIndex({ 
    "interval_minutes": 1, 
    "timestamp": -1 
}, { name: "idx_traffic_interval_time" });

// ---- violation_history indexes ----
db.violation_history.createIndex({ "timestamp": -1 }, { name: "idx_violation_timestamp" });
db.violation_history.createIndex({ "area_id": 1, "timestamp": -1 }, { name: "idx_violation_area_time" });
db.violation_history.createIndex({ "violation_type": 1 }, { name: "idx_violation_type" });
db.violation_history.createIndex({ "status": 1 }, { name: "idx_violation_status" });
db.violation_history.createIndex({ "severity": 1 }, { name: "idx_violation_severity" });
db.violation_history.createIndex({ "license_plate": 1 }, { sparse: true, name: "idx_violation_plate" });

// Partial index: unresolved violations
db.violation_history.createIndex(
    { "area_id": 1, "timestamp": -1 },
    { 
        name: "idx_violation_unresolved_area",
        partialFilterExpression: { 
            status: { $in: ["pending", "issued"] } 
        }
    }
);

// TTL index: auto-archive resolved violations after 24 months
// db.violation_history.createIndex(
//     { "resolved_at": 1 },
//     { 
//         expireAfterSeconds: 63072000,  // 24 months
//         partialFilterExpression: { status: "resolved" },
//         name: "idx_violation_ttl_resolved"
//     }
// );

// ---- prediction_results indexes ----
db.prediction_results.createIndex({ 
    "metadata.area_id": 1, 
    "timestamp": -1 
}, { name: "idx_prediction_area_time" });

db.prediction_results.createIndex({ 
    "prediction_time": -1 
}, { name: "idx_prediction_time" });

db.prediction_results.createIndex({ 
    "metadata.model_name": 1, 
    "metadata.model_version": 1 
}, { name: "idx_prediction_model" });

db.prediction_results.createIndex({ 
    "prediction_horizon": 1, 
    "prediction_time": -1 
}, { name: "idx_prediction_horizon_time" });

// Partial index: unevaluated predictions
db.prediction_results.createIndex(
    { "prediction_time": -1 },
    {
        name: "idx_prediction_pending_eval",
        partialFilterExpression: { actual_demand: { $exists: false } }
    }
);

// ---- bottleneck_map indexes ----
db.bottleneck_map.createIndex({ "timestamp": -1 }, { name: "idx_bottleneck_timestamp" });
db.bottleneck_map.createIndex({ "area_id": 1, "timestamp": -1 }, { name: "idx_bottleneck_area_time" });
db.bottleneck_map.createIndex({ "resolution_status": 1 }, { name: "idx_bottleneck_status" });
db.bottleneck_map.createIndex({ "bottleneck_type": 1 }, { name: "idx_bottleneck_type" });
db.bottleneck_map.createIndex({ "severity_score": -1 }, { name: "idx_bottleneck_severity" });

// Partial: active bottlenecks
db.bottleneck_map.createIndex(
    { "timestamp": -1 },
    {
        name: "idx_bottleneck_active",
        partialFilterExpression: { resolution_status: "active" }
    }
);

// 2dsphere for spatial bottleneck queries
db.bottleneck_map.createIndex({ 
    "location": "2dsphere" 
}, { name: "idx_bottleneck_geospatial" });

// ---- slot_usage_trends indexes ----
db.slot_usage_trends.createIndex({ 
    "period_start": -1, 
    "period_end": -1 
}, { name: "idx_trend_period" });

db.slot_usage_trends.createIndex({ 
    "area_id": 1, 
    "granularity": 1 
}, { name: "idx_trend_area_granularity" });

db.slot_usage_trends.createIndex(
    { "slot_id": 1, "period_start": -1 },
    { 
        name: "idx_trend_slot_period",
        partialFilterExpression: { slot_id: { $exists: true } }
    }
);

db.slot_usage_trends.createIndex({ 
    "granularity": 1, 
    "period_start": -1 
}, { name: "idx_trend_granularity_time" });

// ============================================================================
// DATA RETENTION (TTL Indexes)
// ============================================================================

// Time-series collections already have expireAfterSeconds set during creation:
// - parking_occupancy_history: 12 months
// - traffic_volume_history: 12 months
// - prediction_results: 6 months

// For non-time-series collections with resolvable data:
// TTL on resolved violations (24 months after resolution)
db.violation_history.createIndex(
    { "resolved_at": 1 },
    {
        expireAfterSeconds: 63072000,
        partialFilterExpression: {
            status: "resolved",
            resolved_at: { $exists: true }
        },
        name: "idx_violation_ttl_resolved"
    }
);

// TTL on resolved bottlenecks (6 months after resolution)
db.bottleneck_map.createIndex(
    { "end_time": 1 },
    {
        expireAfterSeconds: 15768000,
        partialFilterExpression: {
            resolution_status: "resolved",
            end_time: { $exists: true }
        },
        name: "idx_bottleneck_ttl_resolved"
    }
);

// ============================================================================
// DUMMY SAMPLE DATA
// ============================================================================

// --- Insert sample areas ---
db.areas.insertMany([
    {
        _id: ObjectId("aaaaaaaaaaaaaaaaaaaaaaaa1"),
        area_code: "AREA-A",
        area_name: "Downtown Central Parking",
        area_type: "public",
        capacity: NumberInt(250),
        latitude: -6.2088,
        longitude: 106.8456,
        boundary_polygon: {
            type: "Polygon",
            coordinates: [[[106.8450, -6.2085], [106.8462, -6.2085], [106.8462, -6.2091], [106.8450, -6.2091], [106.8450, -6.2085]]]
        },
        is_active: true,
        created_at: new Date("2026-01-01T00:00:00Z"),
        updated_at: new Date("2026-04-01T00:00:00Z")
    },
    {
        _id: ObjectId("bbbbbbbbbbbbbbbbbbbbbbbb2"),
        area_code: "AREA-B",
        area_name: "Shopping Mall Garage",
        area_type: "mall",
        capacity: NumberInt(500),
        latitude: -6.2297,
        longitude: 106.8295,
        boundary_polygon: {
            type: "Polygon",
            coordinates: [[[106.8285, -6.2290], [106.8305, -6.2290], [106.8305, -6.2304], [106.8285, -6.2304], [106.8285, -6.2290]]]
        },
        is_active: true,
        created_at: new Date("2026-01-01T00:00:00Z"),
        updated_at: new Date("2026-04-01T00:00:00Z")
    },
    {
        _id: ObjectId("cccccccccccccccccccccccc3"),
        area_code: "AREA-C",
        area_name: "Office Complex Zone",
        area_type: "office",
        capacity: NumberInt(180),
        latitude: -6.2186,
        longitude: 106.8026,
        boundary_polygon: {
            type: "Polygon",
            coordinates: [[[106.8020, -6.2180], [106.8032, -6.2180], [106.8032, -6.2192], [106.8020, -6.2192], [106.8020, -6.2180]]]
        },
        is_active: true,
        created_at: new Date("2026-01-01T00:00:00Z"),
        updated_at: new Date("2026-04-01T00:00:00Z")
    }
]);

// --- Insert sample parking_slots ---
db.parking_slots.insertMany([
    {
        _id: ObjectId("slot1111111111111111111"),
        slot_code: "A-001",
        slot_number: NumberInt(1),
        floor_level: NumberInt(1),
        zone: "Zone-A",
        area_id: ObjectId("aaaaaaaaaaaaaaaaaaaaaaaa1"),
        slot_type: "standard",
        is_active: true,
        latitude: -6.2087,
        longitude: 106.8455,
        sensor_id: "SENSOR-A001",
        price_per_hour: NumberDecimal("5000.00"),
        created_at: new Date("2026-01-01T00:00:00Z"),
        updated_at: new Date("2026-04-01T00:00:00Z")
    },
    {
        _id: ObjectId("slot2222222222222222222"),
        slot_code: "A-002",
        slot_number: NumberInt(2),
        floor_level: NumberInt(1),
        zone: "Zone-A",
        area_id: ObjectId("aaaaaaaaaaaaaaaaaaaaaaaa1"),
        slot_type: "ev_charging",
        is_active: true,
        latitude: -6.2087,
        longitude: 106.8456,
        sensor_id: "SENSOR-A002",
        price_per_hour: NumberDecimal("8000.00"),
        created_at: new Date("2026-01-01T00:00:00Z"),
        updated_at: new Date("2026-04-01T00:00:00Z")
    },
    {
        _id: ObjectId("slot3333333333333333333"),
        slot_code: "B-101",
        slot_number: NumberInt(101),
        floor_level: NumberInt(2),
        zone: "Zone-B",
        area_id: ObjectId("bbbbbbbbbbbbbbbbbbbbbbbb2"),
        slot_type: "compact",
        is_active: true,
        latitude: -6.2296,
        longitude: 106.8294,
        sensor_id: "SENSOR-B101",
        price_per_hour: NumberDecimal("6000.00"),
        created_at: new Date("2026-01-01T00:00:00Z"),
        updated_at: new Date("2026-04-01T00:00:00Z")
    }
]);

// --- Insert sample parking_occupancy_history ---
db.parking_occupancy_history.insertMany([
    {
        timestamp: new Date("2026-04-07T01:00:00Z"),
        metadata: {
            slot_id: ObjectId("slot1111111111111111111"),
            area_id: ObjectId("aaaaaaaaaaaaaaaaaaaaaaaa1"),
            slot_code: "A-001"
        },
        is_occupied: true,
        occupancy_status: "occupied",
        vehicle_type: "car",
        license_plate: "B 1234 ABC",
        session_id: ObjectId("session111111111111111"),
        entry_time: new Date("2026-04-07T00:45:00Z"),
        duration_minutes: NumberInt(15),
        sensor_reading_id: "READ-20260407-010000-A001",
        confidence_score: 0.98
    },
    {
        timestamp: new Date("2026-04-07T01:05:00Z"),
        metadata: {
            slot_id: ObjectId("slot1111111111111111111"),
            area_id: ObjectId("aaaaaaaaaaaaaaaaaaaaaaaa1"),
            slot_code: "A-001"
        },
        is_occupied: true,
        occupancy_status: "occupied",
        vehicle_type: "car",
        license_plate: "B 1234 ABC",
        session_id: ObjectId("session111111111111111"),
        entry_time: new Date("2026-04-07T00:45:00Z"),
        duration_minutes: NumberInt(20),
        sensor_reading_id: "READ-20260407-010500-A001",
        confidence_score: 0.97
    },
    {
        timestamp: new Date("2026-04-07T01:00:00Z"),
        metadata: {
            slot_id: ObjectId("slot2222222222222222222"),
            area_id: ObjectId("aaaaaaaaaaaaaaaaaaaaaaaa1"),
            slot_code: "A-002"
        },
        is_occupied: false,
        occupancy_status: "available",
        vehicle_type: null,
        license_plate: null,
        session_id: null,
        entry_time: null,
        duration_minutes: null,
        sensor_reading_id: "READ-20260407-010000-A002",
        confidence_score: 1.0
    },
    {
        timestamp: new Date("2026-04-07T01:05:00Z"),
        metadata: {
            slot_id: ObjectId("slot2222222222222222222"),
            area_id: ObjectId("aaaaaaaaaaaaaaaaaaaaaaaa1"),
            slot_code: "A-002"
        },
        is_occupied: true,
        occupancy_status: "occupied",
        vehicle_type: "car",
        license_plate: "B 5678 DEF",
        session_id: ObjectId("session222222222222222"),
        entry_time: new Date("2026-04-07T01:03:00Z"),
        duration_minutes: NumberInt(2),
        sensor_reading_id: "READ-20260407-010500-A002",
        confidence_score: 0.95
    },
    {
        timestamp: new Date("2026-04-07T01:00:00Z"),
        metadata: {
            slot_id: ObjectId("slot3333333333333333333"),
            area_id: ObjectId("bbbbbbbbbbbbbbbbbbbbbbbb2"),
            slot_code: "B-101"
        },
        is_occupied: true,
        occupancy_status: "occupied",
        vehicle_type: "motorcycle",
        license_plate: "B 9012 GHI",
        session_id: ObjectId("session333333333333333"),
        entry_time: new Date("2026-04-07T00:50:00Z"),
        duration_minutes: NumberInt(10),
        sensor_reading_id: "READ-20260407-010000-B101",
        confidence_score: 0.99
    },
    {
        timestamp: new Date("2026-04-07T01:05:00Z"),
        metadata: {
            slot_id: ObjectId("slot3333333333333333333"),
            area_id: ObjectId("bbbbbbbbbbbbbbbbbbbbbbbb2"),
            slot_code: "B-101"
        },
        is_occupied: true,
        occupancy_status: "occupied",
        vehicle_type: "motorcycle",
        license_plate: "B 9012 GHI",
        session_id: ObjectId("session333333333333333"),
        entry_time: new Date("2026-04-07T00:50:00Z"),
        duration_minutes: NumberInt(15),
        sensor_reading_id: "READ-20260407-010500-B101",
        confidence_score: 0.99
    }
]);

// --- Insert sample traffic_volume_history ---
db.traffic_volume_history.insertMany([
    {
        timestamp: new Date("2026-04-07T01:00:00Z"),
        metadata: {
            area_id: ObjectId("aaaaaaaaaaaaaaaaaaaaaaaa1"),
            area_code: "AREA-A"
        },
        interval_minutes: NumberInt(5),
        vehicle_count: NumberInt(45),
        vehicles_entering: NumberInt(28),
        vehicles_leaving: NumberInt(17),
        vehicle_type_counts: { car: NumberInt(30), motorcycle: NumberInt(12), truck: NumberInt(3) },
        avg_speed_kmh: 25.50,
        peak_count: NumberInt(38),
        source: "sensor",
        data_quality: "verified"
    },
    {
        timestamp: new Date("2026-04-07T01:05:00Z"),
        metadata: {
            area_id: ObjectId("aaaaaaaaaaaaaaaaaaaaaaaa1"),
            area_code: "AREA-A"
        },
        interval_minutes: NumberInt(5),
        vehicle_count: NumberInt(52),
        vehicles_entering: NumberInt(35),
        vehicles_leaving: NumberInt(17),
        vehicle_type_counts: { car: NumberInt(38), motorcycle: NumberInt(10), truck: NumberInt(4) },
        avg_speed_kmh: 22.30,
        peak_count: NumberInt(42),
        source: "sensor",
        data_quality: "verified"
    },
    {
        timestamp: new Date("2026-04-07T01:00:00Z"),
        metadata: {
            area_id: ObjectId("bbbbbbbbbbbbbbbbbbbbbbbb2"),
            area_code: "AREA-B"
        },
        interval_minutes: NumberInt(5),
        vehicle_count: NumberInt(78),
        vehicles_entering: NumberInt(50),
        vehicles_leaving: NumberInt(28),
        vehicle_type_counts: { car: NumberInt(55), motorcycle: NumberInt(18), truck: NumberInt(5) },
        avg_speed_kmh: 18.70,
        peak_count: NumberInt(65),
        source: "sensor",
        data_quality: "verified"
    },
    {
        timestamp: new Date("2026-04-07T01:05:00Z"),
        metadata: {
            area_id: ObjectId("bbbbbbbbbbbbbbbbbbbbbbbb2"),
            area_code: "AREA-B"
        },
        interval_minutes: NumberInt(5),
        vehicle_count: NumberInt(65),
        vehicles_entering: NumberInt(30),
        vehicles_leaving: NumberInt(35),
        vehicle_type_counts: { car: NumberInt(42), motorcycle: NumberInt(15), truck: NumberInt(8) },
        avg_speed_kmh: 20.10,
        peak_count: NumberInt(58),
        source: "sensor",
        data_quality: "verified"
    },
    {
        timestamp: new Date("2026-04-07T01:00:00Z"),
        metadata: {
            area_id: ObjectId("cccccccccccccccccccccccc3"),
            area_code: "AREA-C"
        },
        interval_minutes: NumberInt(5),
        vehicle_count: NumberInt(22),
        vehicles_entering: NumberInt(15),
        vehicles_leaving: NumberInt(7),
        vehicle_type_counts: { car: NumberInt(18), motorcycle: NumberInt(3), truck: NumberInt(1) },
        avg_speed_kmh: 30.20,
        peak_count: NumberInt(20),
        source: "sensor",
        data_quality: "verified"
    }
]);

// --- Insert sample violation_history ---
db.violation_history.insertMany([
    {
        _id: ObjectId("viol11111111111111111111"),
        slot_id: ObjectId("slot1111111111111111111"),
        area_id: ObjectId("aaaaaaaaaaaaaaaaaaaaaaaa1"),
        timestamp: new Date("2026-04-07T01:15:00Z"),
        violation_type: "overtime",
        severity: "medium",
        description: "Vehicle exceeded 2-hour parking limit by 45 minutes",
        evidence_image_url: "https://storage.smartparking.com/evidence/viol-001.jpg",
        license_plate: "B 1234 ABC",
        vehicle_type: "car",
        detected_by: "ai_camera",
        detection_confidence: 0.96,
        status: "pending",
        fine_amount: NumberDecimal("50000.00"),
        fine_currency: "IDR",
        created_at: new Date("2026-04-07T01:15:00Z")
    },
    {
        _id: ObjectId("viol22222222222222222222"),
        slot_id: null,
        area_id: ObjectId("bbbbbbbbbbbbbbbbbbbbbbbb2"),
        timestamp: new Date("2026-04-07T01:20:00Z"),
        violation_type: "illegal_parking",
        severity: "high",
        description: "Vehicle parked in fire lane blocking access",
        evidence_image_url: "https://storage.smartparking.com/evidence/viol-002.jpg",
        evidence_video_url: "https://storage.smartparking.com/evidence/viol-002.mp4",
        license_plate: "B 9999 XYZ",
        vehicle_type: "car",
        detected_by: "ai_camera",
        detection_confidence: 0.99,
        status: "issued",
        fine_amount: NumberDecimal("150000.00"),
        fine_currency: "IDR",
        created_at: new Date("2026-04-07T01:20:00Z")
    },
    {
        _id: ObjectId("viol33333333333333333333"),
        slot_id: ObjectId("slot3333333333333333333"),
        area_id: ObjectId("bbbbbbbbbbbbbbbbbbbbbbbb2"),
        timestamp: new Date("2026-04-07T01:30:00Z"),
        violation_type: "blocking",
        severity: "high",
        description: "Motorcycle blocking adjacent slot access",
        evidence_image_url: "https://storage.smartparking.com/evidence/viol-003.jpg",
        license_plate: "B 9012 GHI",
        vehicle_type: "motorcycle",
        detected_by: "ai_camera",
        detection_confidence: 0.92,
        status: "pending",
        fine_amount: NumberDecimal("75000.00"),
        fine_currency: "IDR",
        created_at: new Date("2026-04-07T01:30:00Z")
    }
]);

// --- Insert sample prediction_results ---
db.prediction_results.insertMany([
    {
        _id: ObjectId("pred11111111111111111111"),
        timestamp: new Date("2026-04-07T01:00:00Z"),
        metadata: {
            area_id: ObjectId("aaaaaaaaaaaaaaaaaaaaaaaa1"),
            area_code: "AREA-A",
            model_name: "lstm_v2",
            model_version: "2.1.0"
        },
        prediction_time: new Date("2026-04-07T01:15:00Z"),
        prediction_horizon: "short_term",
        predicted_demand: NumberInt(185),
        predicted_occupancy_rate: 0.7400,
        confidence_lower: 0.6800,
        confidence_upper: 0.8000,
        prediction_interval: { p10: NumberInt(165), p50: NumberInt(185), p90: NumberInt(210) },
        features_used: ["occupancy", "traffic", "hour_of_day", "day_of_week"],
        input_data_window: {
            start: new Date("2026-04-07T00:00:00Z"),
            end: new Date("2026-04-07T01:00:00Z"),
            granularity: "5min"
        },
        actual_demand: NumberInt(178),
        actual_occupancy_rate: 0.7120,
        error_mae: 7.00,
        error_rmse: 9.50
    },
    {
        _id: ObjectId("pred22222222222222222222"),
        timestamp: new Date("2026-04-07T01:00:00Z"),
        metadata: {
            area_id: ObjectId("aaaaaaaaaaaaaaaaaaaaaaaa1"),
            area_code: "AREA-A",
            model_name: "lstm_v2",
            model_version: "2.1.0"
        },
        prediction_time: new Date("2026-04-07T02:00:00Z"),
        prediction_horizon: "medium_term",
        predicted_demand: NumberInt(210),
        predicted_occupancy_rate: 0.8400,
        confidence_lower: 0.7600,
        confidence_upper: 0.9100,
        prediction_interval: { p10: NumberInt(190), p50: NumberInt(210), p90: NumberInt(235) },
        features_used: ["occupancy", "traffic", "weather", "events"],
        input_data_window: {
            start: new Date("2026-04-07T00:00:00Z"),
            end: new Date("2026-04-07T01:00:00Z"),
            granularity: "5min"
        },
        actual_demand: null,
        actual_occupancy_rate: null,
        error_mae: null,
        error_rmse: null
    },
    {
        _id: ObjectId("pred33333333333333333333"),
        timestamp: new Date("2026-04-07T01:00:00Z"),
        metadata: {
            area_id: ObjectId("bbbbbbbbbbbbbbbbbbbbbbbb2"),
            area_code: "AREA-B",
            model_name: "xgboost_demand",
            model_version: "1.3.0"
        },
        prediction_time: new Date("2026-04-07T01:15:00Z"),
        prediction_horizon: "short_term",
        predicted_demand: NumberInt(420),
        predicted_occupancy_rate: 0.8400,
        confidence_lower: 0.7900,
        confidence_upper: 0.8900,
        prediction_interval: { p10: NumberInt(395), p50: NumberInt(420), p90: NumberInt(455) },
        features_used: ["occupancy", "traffic", "violations", "hour_of_day"],
        input_data_window: {
            start: new Date("2026-04-07T00:00:00Z"),
            end: new Date("2026-04-07T01:00:00Z"),
            granularity: "5min"
        },
        actual_demand: NumberInt(435),
        actual_occupancy_rate: 0.8700,
        error_mae: 15.00,
        error_rmse: 18.20
    }
]);

// --- Insert sample bottleneck_map ---
db.bottleneck_map.insertMany([
    {
        _id: ObjectId("bn11111111111111111111"),
        area_id: ObjectId("aaaaaaaaaaaaaaaaaaaaaaaa1"),
        location_name: "Downtown Main Entrance",
        latitude: -6.2090,
        longitude: 106.8460,
        radius_meters: NumberInt(75),
        location: { type: "Point", coordinates: [106.8460, -6.2090] },
        timestamp: new Date("2026-04-07T01:10:00Z"),
        start_time: new Date("2026-04-07T00:45:00Z"),
        end_time: null,
        bottleneck_type: "entry_queue",
        severity_score: 0.82,
        affected_slots: NumberInt(15),
        affected_capacity: NumberInt(15),
        current_occupancy: NumberInt(14),
        occupancy_rate: 0.9333,
        avg_wait_time_min: 12.50,
        contributing_factors: { event: "rush_hour", weather: "clear" },
        resolution_status: "active",
        mitigation_action: null,
        detected_by: "auto",
        created_at: new Date("2026-04-07T01:10:00Z")
    },
    {
        _id: ObjectId("bn22222222222222222222"),
        area_id: ObjectId("bbbbbbbbbbbbbbbbbbbbbbbb2"),
        location_name: "Mall Level 2 North Wing",
        latitude: -6.2299,
        longitude: 106.8290,
        radius_meters: NumberInt(50),
        location: { type: "Point", coordinates: [106.8290, -6.2299] },
        timestamp: new Date("2026-04-07T01:00:00Z"),
        start_time: new Date("2026-04-07T00:30:00Z"),
        end_time: null,
        bottleneck_type: "overload",
        severity_score: 0.91,
        affected_slots: NumberInt(45),
        affected_capacity: NumberInt(45),
        current_occupancy: NumberInt(44),
        occupancy_rate: 0.9778,
        avg_wait_time_min: 18.30,
        contributing_factors: { event: "weekend_shopping", promotion: "sale" },
        resolution_status: "mitigating",
        mitigation_action: "Redirecting incoming vehicles to Level 3 overflow area",
        detected_by: "auto",
        created_at: new Date("2026-04-07T01:00:00Z")
    },
    {
        _id: ObjectId("bn33333333333333333333"),
        area_id: ObjectId("cccccccccccccccccccccccc3"),
        location_name: "Office Tower B Exit",
        latitude: -6.2188,
        longitude: 106.8030,
        radius_meters: NumberInt(40),
        location: { type: "Point", coordinates: [106.8030, -6.2188] },
        timestamp: new Date("2026-04-07T01:20:00Z"),
        start_time: new Date("2026-04-07T01:00:00Z"),
        end_time: new Date("2026-04-07T01:35:00Z"),
        bottleneck_type: "exit_block",
        severity_score: 0.65,
        affected_slots: NumberInt(8),
        affected_capacity: NumberInt(8),
        current_occupancy: NumberInt(6),
        occupancy_rate: 0.7500,
        avg_wait_time_min: 5.20,
        contributing_factors: { event: "shift_change" },
        resolution_status: "resolved",
        mitigation_action: "Cleared blocked lane, resumed normal exit flow",
        detected_by: "auto",
        created_at: new Date("2026-04-07T01:20:00Z")
    }
]);

// --- Insert sample slot_usage_trends ---
db.slot_usage_trends.insertMany([
    {
        _id: ObjectId("trend1111111111111111111"),
        slot_id: ObjectId("slot1111111111111111111"),
        area_id: ObjectId("aaaaaaaaaaaaaaaaaaaaaaaa1"),
        period_start: new Date("2026-04-07T01:00:00Z"),
        period_end: new Date("2026-04-07T02:00:00Z"),
        granularity: "hourly",
        total_occupancy_minutes: NumberInt(52),
        total_sessions: NumberInt(1),
        avg_duration_minutes: 52.00,
        max_duration_minutes: NumberInt(52),
        min_duration_minutes: NumberInt(52),
        occupancy_rate: 0.8667,
        peak_occupancy_time: new Date("2026-04-07T01:30:00Z"),
        peak_concurrent: NumberInt(1),
        turnover_rate: 1.00,
        revenue_generated: NumberDecimal("4333.33"),
        violation_count: NumberInt(0),
        vehicle_type_distribution: { car: 1.0 },
        hourly_distribution: { "8": 0.90, "9": 0.83 },
        computed_at: new Date("2026-04-07T02:05:00Z")
    },
    {
        _id: ObjectId("trend2222222222222222222"),
        slot_id: null,
        area_id: ObjectId("aaaaaaaaaaaaaaaaaaaaaaaa1"),
        period_start: new Date("2026-04-07T00:00:00Z"),
        period_end: new Date("2026-04-07T23:59:59Z"),
        granularity: "daily",
        total_occupancy_minutes: NumberInt(18750),
        total_sessions: NumberInt(142),
        avg_duration_minutes: 132.04,
        max_duration_minutes: NumberInt(480),
        min_duration_minutes: NumberInt(8),
        occupancy_rate: 0.7500,
        peak_occupancy_time: new Date("2026-04-07T17:00:00Z"),
        peak_concurrent: NumberInt(189),
        turnover_rate: 0.57,
        revenue_generated: NumberDecimal("708333.33"),
        violation_count: NumberInt(5),
        vehicle_type_distribution: { car: 0.72, motorcycle: 0.23, truck: 0.05 },
        hourly_distribution: { "7": 0.45, "8": 0.85, "9": 0.90, "12": 0.88, "17": 0.95, "18": 0.70 },
        day_of_week_distribution: { "1": 0.65, "2": 0.72, "3": 0.78, "4": 0.80, "5": 0.88, "6": 0.92, "7": 0.70 },
        computed_at: new Date("2026-04-08T00:05:00Z")
    },
    {
        _id: ObjectId("trend3333333333333333333"),
        slot_id: null,
        area_id: ObjectId("bbbbbbbbbbbbbbbbbbbbbbbb2"),
        period_start: new Date("2026-04-01T00:00:00Z"),
        period_end: new Date("2026-04-30T23:59:59Z"),
        granularity: "monthly",
        total_occupancy_minutes: NumberInt(425000),
        total_sessions: NumberInt(3250),
        avg_duration_minutes: 130.77,
        max_duration_minutes: NumberInt(720),
        min_duration_minutes: NumberInt(5),
        occupancy_rate: 0.8200,
        peak_occupancy_time: new Date("2026-04-15T12:00:00Z"),
        peak_concurrent: NumberInt(485),
        turnover_rate: 0.14,
        revenue_generated: NumberDecimal("19500000.00"),
        violation_count: NumberInt(42),
        vehicle_type_distribution: { car: 0.68, motorcycle: 0.25, truck: 0.07 },
        hourly_distribution: { "10": 0.75, "11": 0.85, "12": 0.90, "15": 0.80, "16": 0.88 },
        day_of_week_distribution: { "1": 0.70, "2": 0.75, "3": 0.78, "4": 0.82, "5": 0.90, "6": 0.95, "7": 0.85 },
        computed_at: new Date("2026-05-01T00:10:00Z")
    }
]);

// ============================================================================
// END OF SCHEMA
// ============================================================================

print("MongoDB Smart Parking Schema initialized successfully!");
print("Collections created: 8 (2 reference, 3 time-series, 3 standard)");
print("Indexes created: 35+ across all collections");
print("TTL policies: 3 auto-expire policies active");
