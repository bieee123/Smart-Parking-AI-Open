import bcrypt from 'bcrypt';
import { db } from './postgres.js';
import { users } from '../db/drizzle/schema.js';
import { eq } from 'drizzle-orm';

async function setupAdmin() {
  try {
    const username = "admin";
    const password = "AdminPassword123";
    const email = "admin@smartparking.live";
    const fullName = "Admin System Smart Parking";
    const jobTitle = "Super Admin";
    
    console.log(`Setting up admin user: ${username}...`);

    // Check if user exists
    const [existing] = await db.select().from(users).where(eq(users.username, username)).limit(1);

    if (existing) {
      console.log("User exists, updating profile...");
      await db.update(users)
        .set({
          email: email,
          full_name: fullName,
          job_title: jobTitle,
          role: "admin",
          updated_at: new Date()
        })
        .where(eq(users.username, username));
      console.log("✅ Admin profile updated!");
    } else {
      console.log("User does not exist, creating new admin...");
      const hash = await bcrypt.hash(password, 10);
      await db.insert(users).values({
        username: username,
        email: email,
        password_hash: hash,
        full_name: fullName,
        job_title: jobTitle,
        role: "admin",
        is_active: true
      });
      console.log("✅ New Admin user created!");
    }

    process.exit(0);
  } catch (err) {
    console.error("❌ Error setting up admin:", err.message);
    process.exit(1);
  }
}

setupAdmin();
