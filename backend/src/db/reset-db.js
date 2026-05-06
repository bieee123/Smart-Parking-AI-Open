import { db } from "./postgres.js";
import { parkingSlots, parkingLogs, users } from "../db/drizzle/schema.js";
import { getDb, connectMongo } from "./mongo.js";
import { connectRedis, deleteCacheByPattern } from "./redis.js";
import bcrypt from "bcrypt";

async function resetDatabase() {
  console.log("🧹 Resetting database to zero...");

  try {
    // 1. PostgreSQL - Logs and Slots
    console.log("  - Clearing PostgreSQL (logs, then slots)...");
    await db.delete(parkingLogs);
    await db.delete(parkingSlots);
    
    // 2. PostgreSQL - Users (Optional: Keep Admin)
    // We'll delete all then re-seed the admin to be safe
    console.log("  - Resetting Users (re-seeding admin)...");
    await db.delete(users);
    const hash = await bcrypt.hash("admin123", 10);
    await db.insert(users).values({
      username: "admin",
      email: "admin@smartparking.io",
      password_hash: hash,
      role: "admin",
      is_active: true,
    });

    // 3. MongoDB
    console.log("  - Clearing MongoDB collections...");
    await connectMongo();
    const dbMongo = getDb();
    await dbMongo.collection("ai_detections").deleteMany({});
    await dbMongo.collection("camera_logs").deleteMany({});

    // 4. Redis
    console.log("  - Clearing Redis cache...");
    const redis = connectRedis();
    if (redis) {
      await deleteCacheByPattern("*");
    }

    console.log("✅ Database reset complete! (Admin: admin / admin123)");
    process.exit(0);
  } catch (err) {
    console.error("❌ Reset failed:", err);
    process.exit(1);
  }
}

resetDatabase();
