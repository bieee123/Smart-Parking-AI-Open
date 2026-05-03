import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import config from '../config/env.js';

const { Pool } = pg;

const pool = new Pool({
  connectionString: config.databaseUrl,
});

const db = drizzle(pool);

export { db, pool };
