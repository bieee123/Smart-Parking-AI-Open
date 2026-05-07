import {
  pgTable,
  serial,
  varchar,
  text,
  timestamp,
  boolean,
  integer,
  uuid,
  jsonb,
} from 'drizzle-orm/pg-core';

// Users table
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  username: varchar('username', { length: 50 }).notNull().unique(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  password_hash: text('password_hash').notNull(),
  full_name: varchar('full_name', { length: 100 }),
  job_title: varchar('job_title', { length: 100 }),
  phone: varchar('phone', { length: 20 }),
  bio: text('bio'),
  avatar_url: text('avatar_url'),
  security_stamp: uuid('security_stamp').defaultRandom().notNull(),
  assigned_zones: jsonb('assigned_zones'), // array of zone IDs for operators
  role: varchar('role', { length: 20 }).notNull().default('user'), // admin, operator, viewer
  language: varchar('language', { length: 10 }).notNull().default('en'), // en, id
  is_active: boolean('is_active').notNull().default(true),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Parking Slots table
export const parkingSlots = pgTable('parking_slots', {
  id: uuid('id').defaultRandom().primaryKey(),
  slot_number: varchar('slot_number', { length: 10 }).notNull().unique(),
  floor: integer('floor').notNull().default(1),
  zone: varchar('zone', { length: 5 }).notNull(), // A, B, C, etc.
  is_occupied: boolean('is_occupied').notNull().default(false),
  status: varchar('status', { length: 20 }).notNull().default('empty'), // empty, occupied, reserved, offline, error
  vehicle_type: varchar('vehicle_type', { length: 20 }), // car, motorcycle, truck
  license_plate: varchar('license_plate', { length: 20 }),
  camera_id: varchar('camera_id', { length: 50 }),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Parking Logs table
export const parkingLogs = pgTable('parking_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  slot_id: uuid('slot_id').references(() => parkingSlots.id),
  license_plate: varchar('license_plate', { length: 20 }).notNull(),
  vehicle_type: varchar('vehicle_type', { length: 20 }).notNull(),
  entry_time: timestamp('entry_time').defaultNow().notNull(),
  exit_time: timestamp('exit_time'),
  duration_minutes: integer('duration_minutes'),
  fee: integer('fee').default(0),
  status: varchar('status', { length: 20 }).notNull().default('active'), // active, completed, overdue
  detection_confidence: integer('detection_confidence'), // AI confidence score
  entry_image_url: text('entry_image_url'),
  exit_image_url: text('exit_image_url'),
  created_at: timestamp('created_at').defaultNow().notNull(),
});

// Cameras table for persistent configuration
export const cameras = pgTable('cameras', {
  id: varchar('id', { length: 50 }).primaryKey(), // e.g. CAM-01
  name: varchar('name', { length: 100 }).notNull(),
  type: varchar('type', { length: 20 }).notNull(), // parking, street
  status: varchar('status', { length: 20 }).notNull().default('online'), // online, offline
  zone: varchar('zone', { length: 50 }),
  stream_url: text('stream_url'),
  is_active: boolean('is_active').default(true),
  last_active: timestamp('last_active'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Traffic Logs (Street Traffic)
export const trafficLogs = pgTable('traffic_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  camera_id: varchar('camera_id', { length: 50 }).notNull(),
  vehicle_count: integer('vehicle_count').notNull().default(0),
  density_level: varchar('density_level', { length: 20 }).notNull(), // low, medium, high
  timestamp: timestamp('timestamp').defaultNow().notNull(),
});

// Analysis History (Manual Uploads)
export const analysisHistory = pgTable('ai_analysis_history', {
  id: uuid('id').defaultRandom().primaryKey(),
  filename: text('filename').notNull(),
  media_type: varchar('media_type', { length: 10 }).notNull(), // image, video
  result_summary: text('result_summary'),
  detailed_result: text('detailed_result'), // JSON string or text summary
  created_at: timestamp('created_at').defaultNow().notNull(),
});

// User Activities (Security Logs)
export const userActivities = pgTable('user_activities', {
  id: uuid('id').defaultRandom().primaryKey(),
  user_id: uuid('user_id').references(() => users.id).notNull(),
  action: varchar('action', { length: 50 }).notNull(), // login, password_change, profile_update
  device_info: text('device_info'), // e.g. Chrome on Windows
  ip_address: varchar('ip_address', { length: 45 }),
  created_at: timestamp('created_at').defaultNow().notNull(),
});
