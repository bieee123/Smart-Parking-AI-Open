import { db } from './postgres.js';
import { sql } from 'drizzle-orm';

async function run() {
  try {
    console.log('Adding security_stamp column...');
    await db.execute(sql`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS security_stamp UUID NOT NULL DEFAULT gen_random_uuid()
    `);
    console.log('✅ Column security_stamp added successfully!');
  } catch (err) {
    console.error('❌ Error adding column:', err.message);
  }
  process.exit(0);
}

run();
