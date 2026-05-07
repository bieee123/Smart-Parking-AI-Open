import pg from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

const { Client } = pg;
const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

async function migrate() {
  try {
    await client.connect();
    console.log("Connected to PostgreSQL");

    const statements = [
      'ALTER TABLE "cameras" ADD COLUMN IF NOT EXISTS "is_active" boolean DEFAULT true',
      'ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "full_name" varchar(100)',
      'ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "job_title" varchar(100)',
      'ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "phone" varchar(20)',
      'ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "bio" text',
      'ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "avatar_url" text',
      'ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "assigned_zones" text'
    ];

    for (const sql of statements) {
      console.log(`Executing: ${sql}`);
      await client.query(sql);
    }

    console.log("✅ Migration successful!");
  } catch (err) {
    console.error("❌ Migration failed:", err.message);
  } finally {
    await client.end();
  }
}

migrate();
