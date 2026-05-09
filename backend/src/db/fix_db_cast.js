import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../.env') });

async function fixColumn() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('Connected to database...');

    // Fix assigned_zones column type with explicit casting
    console.log('Altering assigned_zones column type...');
    await client.query('ALTER TABLE "users" ALTER COLUMN "assigned_zones" TYPE jsonb USING assigned_zones::jsonb');
    
    console.log('Successfully updated assigned_zones column!');
  } catch (err) {
    console.error('Error fixing column:', err.message);
    if (err.message.includes('does not exist')) {
       console.log('Column assigned_zones might not exist yet, skipping manual fix...');
    }
  } finally {
    await client.end();
  }
}

fixColumn();
