import bcrypt from "bcrypt";
import { db } from "./postgres.js";
import { users } from "../db/drizzle/schema.js";

async function seedAdmin() {
  try {
    const hash = await bcrypt.hash("AdminPassword123", 10);

    await db.insert(users).values({
      username: "admin",
      email: "admin@system.com",
      password_hash: hash,
      role: "admin",
      is_active: true,
    });

    console.log("✅ Admin user created!");
    process.exit(0);
  } catch (err) {
    console.error("❌ Error seeding admin:", err.message);
    process.exit(1);
  }
}

seedAdmin();