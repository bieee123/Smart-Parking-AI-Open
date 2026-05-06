import { db } from './src/db/postgres.js';
import { parkingSlots } from './src/db/drizzle/schema.js';
import { eq } from 'drizzle-orm';

async function checkSlot() {
  const targetId = 'd409ce82-4266-446d-a94c-54d5235989fa';
  console.log(`--- Checking Slot ID: ${targetId} ---`);
  try {
    const [slot] = await db.select().from(parkingSlots).where(eq(parkingSlots.id, targetId)).limit(1);
    if (slot) {
      console.log('Slot Found:', JSON.stringify(slot, null, 2));
    } else {
      console.log('Slot NOT FOUND in database!');
    }
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

checkSlot();
