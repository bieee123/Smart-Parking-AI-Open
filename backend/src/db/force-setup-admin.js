import bcrypt from 'bcrypt';
import { db } from './postgres.js';
import { users } from '../db/drizzle/schema.js';
import { eq } from 'drizzle-orm';

async function forceSetupAdmin() {
  try {
    const username = "admin";
    const password = "AdminPassword123";
    const email = "admin@smartparking.live";
    const fullName = "Admin System Smart Parking";
    const jobTitle = "Super Admin";
    
    console.log(`Force setting up admin user: ${username}...`);
    const hash = await bcrypt.hash(password, 10);

    const [existing] = await db.select().from(users).where(eq(users.username, username)).limit(1);

    if (existing) {
      console.log("User exists, forcing update of profile and password...");
      await db.update(users)
        .set({
          email: email,
          password_hash: hash,
          full_name: fullName,
          job_title: jobTitle,
          role: "admin",
          is_active: true,
          updated_at: new Date()
        })
        .where(eq(users.username, username));
      console.log("✅ Admin profile and password force-updated!");
    } else {
      console.log("User does not exist, creating new admin...");
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
    console.error("❌ Error:", err.message);
    process.exit(1);
  }
}

forceSetupAdmin();
