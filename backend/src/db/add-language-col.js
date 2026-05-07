import pg from 'pg';
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const { Client } = pg;
const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

async function migrate() {
  try {
    await client.connect();
    console.log("Connected to PostgreSQL");

    const sql = 'ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "language" varchar(10) DEFAULT \'en\' NOT NULL';
    
    console.log(`Executing: ${sql}`);
    await client.query(sql);

    console.log("✅ Migration successful! Added 'language' column to 'users' table.");
  } catch (err) {
    console.error("❌ Migration failed:", err.message);
  } finally {
    await client.end();
  }
}

migrate();
