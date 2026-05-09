import { db } from '../src/db/postgres.js';
import { users } from '../src/db/drizzle/schema.js';
import { eq } from 'drizzle-orm';

async function disable2FA() {
  const email = 'gabrielle.lintong@student.president.ac.id';
  
  try {
    console.log(`Searching for user with email: ${email}...`);
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    
    if (!user) {
      console.error('User not found!');
      process.exit(1);
    }
    
    console.log(`Found user: ${user.username} (ID: ${user.id})`);
    console.log(`Current 2FA Status: ${user.two_factor_enabled ? 'ENABLED' : 'DISABLED'} (${user.two_factor_method})`);
    
    if (!user.two_factor_enabled) {
      console.log('2FA is already disabled for this user.');
    } else {
      await db.update(users)
        .set({ 
          two_factor_enabled: false,
          two_factor_method: 'totp', // Reset to default method
          two_factor_email_code: null,
          two_factor_email_expires: null
        })
        .where(eq(users.id, user.id));
      
      console.log('SUCCESS: 2FA has been disabled for this user.');
    }
    
    process.exit(0);
  } catch (err) {
    console.error('ERROR:', err.message);
    process.exit(1);
  }
}

disable2FA();
