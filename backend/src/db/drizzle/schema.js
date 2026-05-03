import {
  pgTable,
  serial,
  varchar,
  text,
  timestamp,
  boolean,
  integer,
  uuid,
} from 'drizzle-orm/pg-core';

// Users table
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  username: varchar('username', { length: 50 }).notNull().unique(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  password_hash: text('password_hash').notNull(),
  role: varchar('role', { length: 20 }).notNull().default('user'), // admin, operator, user
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

// AI Detections schema (for reference, stored in MongoDB)
// Collection: ai_detections
// Fields: { _id, slot_id, license_plate, vehicle_type, confidence, timestamp, image_url }

// Camera Logs schema (for reference, stored in MongoDB)
// Collection: camera_logs
// Fields: { _id, camera_id, status, last_heartbeat, snapshot_url, created_at }
