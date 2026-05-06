import { db } from "./src/db/postgres.js";
import { sql } from "drizzle-orm";

async function checkDB() {
  try {
    const result = await db.execute(sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    console.log("Result keys:", Object.keys(result));
    
    // Attempt to print tables
    const tables = result.rows || result;
    if (Array.isArray(tables)) {
      console.log("Tables in DB:", tables.map(r => r.table_name || r));
    }

    const cameraColsResult = await db.execute(sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'cameras'
    `);
    const cols = cameraColsResult.rows || cameraColsResult;
    if (Array.isArray(cols)) {
      console.log("Cameras columns:", cols.map(c => (c.column_name || '??') + " (" + (c.data_type || '??') + ")"));
    }
    
    process.exit(0);
  } catch (err) {
    console.error("Check failed:", err);
    process.exit(1);
  }
}

checkDB();
