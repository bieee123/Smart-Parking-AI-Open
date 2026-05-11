import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function run() {
  try {
    console.log('Seeding coordinates for parking slots...');
    const MAP_CENTER = { lat: -6.9175, lng: 107.6191 };
    
    const res = await pool.query('SELECT id FROM parking_slots');
    for (let i = 0; i < res.rows.length; i++) {
      const id = res.rows[i].id;
      // Randomly spread slots around center
      const lat = MAP_CENTER.lat + (Math.random() - 0.5) * 0.005;
      const lng = MAP_CENTER.lng + (Math.random() - 0.5) * 0.005;
      const type = i % 10 === 0 ? 'ev' : (i % 15 === 0 ? 'disabled' : 'standard');
      const floor = Math.floor(Math.random() * 3) + 1;

      await pool.query(
        'UPDATE parking_slots SET latitude = $1, longitude = $2, slot_type = $3, floor = $4 WHERE id = $5',
        [lat.toString(), lng.toString(), type, floor, id]
      );
    }
    console.log('Seeding finished.');
  } catch (err) {
    console.error('Error seeding:', err);
  } finally {
    await pool.end();
  }
}

run();
