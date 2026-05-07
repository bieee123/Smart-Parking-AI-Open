import bcrypt from 'bcrypt';
import { db } from './postgres.js';
import { users } from '../db/drizzle/schema.js';
import { eq } from 'drizzle-orm';

async function seedUser(username, email, password, role, fullName) {
  try {
    console.log(`Seeding user: ${username} (${role})...`);
    const hash = await bcrypt.hash(password, 10);

    const [existing] = await db.select().from(users).where(eq(users.username, username)).limit(1);

    if (existing) {
      console.log(`User ${username} exists, updating password and role...`);
      await db.update(users)
        .set({
          email,
          password_hash: hash,
          role,
          full_name: fullName,
          is_active: true,
          updated_at: new Date()
        })
        .where(eq(users.username, username));
      console.log(`✅ User ${username} updated!`);
    } else {
      await db.insert(users).values({
        username,
        email,
        password_hash: hash,
        role,
        full_name: fullName,
        is_active: true
      });
      console.log(`✅ User ${username} created!`);
    }
  } catch (err) {
    console.error(`❌ Error seeding ${username}:`, err.message);
  }
}

async function run() {
  await seedUser('operator', 'operator@smartparking.live', 'OperatorPassword123', 'operator', 'System Operator Smart Parking');
  await seedUser('viewer', 'viewer@smartparking.live', 'ViewerPassword123', 'viewer', 'Guest Viewer Smart Parking');
  process.exit(0);
}

run();
