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

async function seed() {
  try {
    await client.connect();
    console.log("Connected to PostgreSQL");

    const settings = [
      { key: 'SMTP_HOST', value: process.env.SMTP_HOST || 'smtp.gmail.com', desc: 'SMTP Host address' },
      { key: 'SMTP_PORT', value: process.env.SMTP_PORT || '587', desc: 'SMTP Port number' },
      { key: 'SMTP_USER', value: process.env.SMTP_USER || '', desc: 'SMTP Username (Email)' },
      { key: 'SMTP_PASS', value: process.env.SMTP_PASS || '', desc: 'SMTP Password (App Password)' },
      { key: 'SMTP_FROM', value: process.env.SMTP_FROM || 'SmartPark <noreply@smartpark.com>', desc: 'Sender Email Name' },
      { key: 'SMTP_SECURE', value: process.env.SMTP_SECURE || 'false', desc: 'Use TLS/SSL (true/false)' }
    ];

    for (const s of settings) {
      console.log(`Seeding: ${s.key}...`);
      await client.query(`
        INSERT INTO "system_settings" (key, value, description)
        VALUES ($1, $2, $3)
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
      `, [s.key, s.value, s.desc]);
    }

    console.log("✅ Settings seeded successfully!");

  } catch (err) {
    console.error("❌ Seeding failed:", err.message);
  } finally {
    await client.end();
  }
}

seed();
