import { db } from "./src/db/postgres.js";
import { sql } from "drizzle-orm";

async function cleanup() {
  try {
    console.log("Dropping redundant table 'analysis_history'...");
    await db.execute(sql`DROP TABLE IF EXISTS analysis_history CASCADE;`);
    console.log("✅ Dropped.");
    process.exit(0);
  } catch (err) {
    console.error("Cleanup failed:", err);
    process.exit(1);
  }
}

cleanup();
