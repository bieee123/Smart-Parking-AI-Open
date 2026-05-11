import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function run() {
  try {
    console.log('Adding columns to parking_slots...');
    await pool.query('ALTER TABLE parking_slots ADD COLUMN IF NOT EXISTS slot_type varchar(20) DEFAULT \'standard\' NOT NULL;');
    await pool.query('ALTER TABLE parking_slots ADD COLUMN IF NOT EXISTS latitude text;');
    await pool.query('ALTER TABLE parking_slots ADD COLUMN IF NOT EXISTS longitude text;');
    console.log('Columns added successfully.');
  } catch (err) {
    console.error('Error adding columns:', err);
  } finally {
    await pool.end();
  }
}

run();
