import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function run() {
  try {
    console.log('Restructuring parking slots (72 slots total)...');
    
    // 1. Clear existing slots
    // We use a transaction to be safe
    await pool.query('BEGIN');
    
    // Check if there are active logs or reservations that might prevent deletion
    // For this dev environment, we'll truncate with cascade
    await pool.query('TRUNCATE parking_slots CASCADE');
    
    const zones = ['A', 'B', 'C'];
    const MAP_CENTER = { lat: -6.9175, lng: 107.6191 };

    for (const zone of zones) {
      console.log(`Generating slots for Zone ${zone}...`);
      for (let i = 1; i <= 24; i++) {
        const slot_number = `${zone}-${i.toString().padStart(2, '0')}`;
        
        let slot_type = 'standard';
        if (i >= 17 && i <= 20) slot_type = 'ev';
        else if (i >= 21 && i <= 24) slot_type = 'disabled';

        // Generate mock coordinates around Bandung center
        const lat = MAP_CENTER.lat + (Math.random() - 0.5) * 0.005;
        const lng = MAP_CENTER.lng + (Math.random() - 0.5) * 0.005;

        await pool.query(
          'INSERT INTO parking_slots (slot_number, zone, slot_type, status, is_occupied, latitude, longitude) VALUES ($1, $2, $3, $4, $5, $6, $7)',
          [slot_number, zone, slot_type, 'empty', false, lat.toString(), lng.toString()]
        );
      }
    }

    await pool.query('COMMIT');
    console.log('Restructuring finished successfully. 72 slots created.');
  } catch (err) {
    await pool.query('ROLLBACK');
    console.error('Error during restructuring:', err);
  } finally {
    await pool.end();
  }
}

run();
