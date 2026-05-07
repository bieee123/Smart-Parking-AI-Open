import { db } from './postgres.js';
import { sql } from 'drizzle-orm';

async function run() {
  try {
    const rows = await db.execute(sql`SELECT * FROM user_activities ORDER BY created_at DESC LIMIT 10`);
    console.log('--- USER ACTIVITIES (Latest 10) ---');
    console.table(rows.rows);
  } catch (err) {
    console.error('Error fetching activities:', err.message);
  }
  process.exit(0);
}

run();
