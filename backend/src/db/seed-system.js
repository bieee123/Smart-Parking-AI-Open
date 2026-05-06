import { db } from "./postgres.js";
import { parkingSlots, cameras } from "../db/drizzle/schema.js";

async function seedSystem() {
  console.log("🌱 Seeding 48 slots and default cameras...");

  try {
    // 1. Seed Slots (Zone A, B, C - 16 each)
    const zones = ["A", "B", "C"];
    const slotsToInsert = [];

    for (const zone of zones) {
      for (let i = 1; i <= 16; i++) {
        slotsToInsert.push({
          slot_number: `${zone}1-${i.toString().padStart(2, '0')}`,
          floor: 1,
          zone: zone,
          is_occupied: false,
          status: 'empty'
        });
      }
    }

    // Clear and insert slots
    await db.delete(parkingSlots);
    await db.insert(parkingSlots).values(slotsToInsert);
    console.log(`✅ ${slotsToInsert.length} slots created.`);

    // 2. Seed Default Cameras
    const defaultCameras = [
      { id: 'CAM-P1', name: 'Parking Entrance A', type: 'parking', status: 'online' },
      { id: 'CAM-P2', name: 'Parking North B', type: 'parking', status: 'online' },
      { id: 'CAM-S1', name: 'Main Intersection', type: 'street', status: 'online' },
      { id: 'CAM-S2', name: 'East Highway Exit', type: 'street', status: 'online' },
    ];

    await db.delete(cameras);
    await db.insert(cameras).values(defaultCameras);
    console.log(`✅ ${defaultCameras.length} cameras initialized.`);

    process.exit(0);
  } catch (err) {
    console.error("❌ Seeding failed:", err);
    process.exit(1);
  }
}

seedSystem();
