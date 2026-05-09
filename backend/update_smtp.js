import pg from 'pg';
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

const { Client } = pg;
const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

// Ambil dari argumen command line
const MY_EMAIL = process.argv[2];
const MY_APP_PASSWORD = process.argv[3];

async function update() {
  if (!MY_EMAIL || !MY_APP_PASSWORD) {
    console.error("❌ ERROR: Kurang argumen!");
    console.log("Cara pakai: node update_smtp.js \"EMAIL_ANDA\" \"APP_PASSWORD_ANDA\"");
    return;
  }

  try {
    await client.connect();
    console.log("Connected to database...");

    console.log(`Updating SMTP Settings to: ${MY_EMAIL}...`);

    await client.query("UPDATE system_settings SET value = $1 WHERE key = 'SMTP_USER'", [MY_EMAIL]);
    await client.query("UPDATE system_settings SET value = $1 WHERE key = 'SMTP_PASS'", [MY_APP_PASSWORD]);
    await client.query("UPDATE system_settings SET value = $1 WHERE key = 'SMTP_FROM'", [`SmartPark <${MY_EMAIL}>`]);

    console.log("✅ Update Berhasil! Sekarang sistem akan menggunakan email ini.");
    console.log("Tip: Silakan coba login/setup 2FA kembali.");

  } catch (err) {
    console.error("❌ Gagal update:", err.message);
  } finally {
    await client.end();
  }
}

update();
