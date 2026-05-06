import { db } from './src/db/postgres.js';
import { parkingLogs, parkingSlots } from './src/db/drizzle/schema.js';
import { eq, desc } from 'drizzle-orm';

async function checkLogs() {
  console.log('--- Checking Logs and Slots ---');
  try {
    const logs = await db
      .select({
        log_id: parkingLogs.id,
        slot_id: parkingLogs.slot_id,
        slot_number: parkingSlots.slot_number,
      })
      .from(parkingLogs)
      .leftJoin(parkingSlots, eq(parkingLogs.slot_id, parkingSlots.id))
      .limit(5);

    console.log('Logs Join Result:', JSON.stringify(logs, null, 2));

    const totalLogs = await db.select().from(parkingLogs);
    console.log('Total Logs in DB:', totalLogs.length);

    const totalSlots = await db.select().from(parkingSlots);
    console.log('Total Slots in DB:', totalSlots.length);
    if (totalSlots.length > 0) {
        console.log('Sample Slot ID:', totalSlots[0].id);
    }
    
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

checkLogs();
