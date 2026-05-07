import { db } from './postgres.js';
import { sql } from 'drizzle-orm';

async function run() {
  try {
    const rows = await db.execute(sql`SELECT id, username FROM users`);
    console.table(rows.rows);
  } catch (err) {
    console.error('Error:', err.message);
  }
  process.exit(0);
}

run();
