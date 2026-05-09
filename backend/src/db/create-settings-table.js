import pg from 'pg';
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../.env') });

const { Client } = pg;
const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

async function setup() {
  try {
    await client.connect();
    console.log("Connected to PostgreSQL");

    const sql = `
      CREATE TABLE IF NOT EXISTS "system_settings" (
        "id" SERIAL PRIMARY KEY,
        "key" VARCHAR(100) NOT NULL UNIQUE,
        "value" TEXT NOT NULL,
        "description" TEXT,
        "created_at" TIMESTAMP DEFAULT NOW() NOT NULL,
        "updated_at" TIMESTAMP DEFAULT NOW() NOT NULL
      );
    `;

    console.log("Executing: Creating system_settings table...");
    await client.query(sql);
    console.log("✅ Table created or already exists!");

  } catch (err) {
    console.error("❌ Setup failed:", err.message);
  } finally {
    await client.end();
  }
}

setup();
