import bcrypt from 'bcrypt';
import { db } from './postgres.js';
import { users } from '../db/drizzle/schema.js';

async function createTester() {
  try {
    const hash = await bcrypt.hash("tester123", 10);
    await db.insert(users).values({
      username: "tester",
      email: "tester@test.com",
      password_hash: hash,
      full_name: "Tester Account",
      role: "admin",
    });
    console.log("✅ Tester user created with password: tester123");
    process.exit(0);
  } catch (err) {
    console.error("❌ Error:", err.message);
    process.exit(1);
  }
}

createTester();
