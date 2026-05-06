import { db } from "./src/db/postgres.js";
import { cameras } from "./src/db/drizzle/schema.js";

async function checkCameras() {
  try {
    const all = await db.select().from(cameras);
    console.log("Cameras in DB:", all);
    process.exit(0);
  } catch (err) {
    console.error("Check failed:", err);
    process.exit(1);
  }
}

checkCameras();
