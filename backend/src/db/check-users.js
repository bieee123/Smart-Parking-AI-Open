import { db } from './postgres.js';
import { users } from '../db/drizzle/schema.js';

async function checkUsers() {
  try {
    const allUsers = await db.select({
      id: users.id,
      username: users.username,
      email: users.email,
      role: users.role,
      is_active: users.is_active
    }).from(users);
    
    console.log("Current Users:", JSON.stringify(allUsers, null, 2));
    process.exit(0);
  } catch (err) {
    console.error("Error checking users:", err.message);
    process.exit(1);
  }
}

checkUsers();
