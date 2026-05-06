import { pool } from "./src/db/postgres.js";
import { connectMongo, getCollection } from "./src/db/mongo.js";
import { connectRedis, client as redisClient } from "./src/db/redis.js";
import { db } from "./src/db/postgres.js";
import { parkingSlots, cameras, trafficLogs, analysisHistory } from "./src/db/drizzle/schema.js";

async function resetSystem() {
  console.log("🚀 Starting Full System Reset...");

  try {
    // 1. PostgreSQL Reset
    console.log("📊 Clearing PostgreSQL tables...");
    await db.delete(analysisHistory);
    await db.delete(trafficLogs);
    await db.delete(cameras);
    await db.delete(parkingSlots);
    console.log("✅ PostgreSQL tables cleared.");

    // 2. MongoDB Reset
    console.log("🍃 Clearing MongoDB collections...");
    await connectMongo();
    const collections = ['parking_history', 'violation_history', 'traffic_history', 'bottleneck_map'];
    for (const collName of collections) {
      const coll = await getCollection(collName);
      await coll.deleteMany({});
      console.log(`   - ${collName} cleared.`);
    }

    // 3. Redis Reset
    console.log("⚡ Clearing Redis cache...");
    const rClient = connectRedis();
    if (rClient) {
      await rClient.flushall();
      console.log("✅ Redis flushed.");
    }

    // 4. Seeding Initial Data
    console.log("🌱 Seeding 48 slots and default cameras...");
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
    await db.insert(parkingSlots).values(slotsToInsert);
    
    const defaultCameras = [
      { id: 'CAM-ENTRANCE', name: 'Entrance Gate', type: 'parking', status: 'online' },
      { id: 'CAM-ZONE-A', name: 'Zone A', type: 'parking', status: 'online' },
      { id: 'CAM-ZONE-B', name: 'Zone B', type: 'parking', status: 'online' },
      { id: 'CAM-ZONE-C', name: 'Zone C', type: 'parking', status: 'online' },
      { id: 'CAM-EXIT', name: 'Exit Gate', type: 'parking', status: 'online' },
      { id: 'ATCS-001', name: 'ATCS Pusat - 001', type: 'street', status: 'online', stream_url: 'https://atcsdishub.medan.go.id/stream/L2AHMADYANIPULAUPINANG/stream.m3u8' },
      { id: 'ATCS-002', name: 'ATCS Pusat - 002', type: 'street', status: 'online', stream_url: 'https://atcsdishub.medan.go.id/stream/L2SISINGAMANGARAJA/stream.m3u8' },
      { id: 'ATCS-003', name: 'ATCS Pusat - 003', type: 'street', status: 'online', stream_url: 'https://atcsdishub.medan.go.id/stream/L2GATOTSUBROTO/stream.m3u8' },
      { id: 'ATCS-004', name: 'ATCS Pusat - 004', type: 'street', status: 'offline', stream_url: 'https://atcsdishub.medan.go.id/stream/L2ISKANDARMUDA/stream.m3u8' },
    ];
    await db.insert(cameras).values(defaultCameras);

    console.log("✨ Reset Complete! System is now clean and data-ready.");
    process.exit(0);
  } catch (err) {
    console.error("❌ Reset failed:", err);
    process.exit(1);
  }
}

resetSystem();
