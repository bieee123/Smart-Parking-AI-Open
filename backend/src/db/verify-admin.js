import bcrypt from 'bcrypt';
import { db } from './postgres.js';
import { users } from '../db/drizzle/schema.js';
import { eq, or } from 'drizzle-orm';

async function verifyAdmin() {
  const identifier = "admin";
  const password = "AdminPassword123";

  try {
    const [user] = await db
      .select()
      .from(users)
      .where(or(eq(users.email, identifier), eq(users.username, identifier)))
      .limit(1);

    if (!user) {
      console.log("❌ User not found");
      return;
    }

    console.log(`User found: ${user.username}`);
    console.log(`Email: ${user.email}`);
    console.log(`Role: ${user.role}`);
    console.log(`Is Active: ${user.is_active}`);

    const isValid = await bcrypt.compare(password, user.password_hash);
    console.log(`Password Match: ${isValid}`);
    
    if (!isValid) {
      // Let's check what's in the hash
      console.log(`Hash in DB: ${user.password_hash}`);
      const testHash = await bcrypt.hash(password, 10);
      console.log(`New test hash: ${testHash}`);
    }

    process.exit(0);
  } catch (err) {
    console.error("❌ Error:", err.message);
    process.exit(1);
  }
}

verifyAdmin();
