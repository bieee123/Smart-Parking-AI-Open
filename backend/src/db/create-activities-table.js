import { db } from './postgres.js';
import { sql } from 'drizzle-orm';

async function run() {
  try {
    console.log('Creating user_activities table...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS user_activities (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id),
        action VARCHAR(50) NOT NULL,
        device_info TEXT,
        ip_address VARCHAR(45),
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    console.log('✅ Table user_activities created successfully!');
  } catch (err) {
    console.error('❌ Error creating table:', err.message);
  }
  process.exit(0);
}

run();
