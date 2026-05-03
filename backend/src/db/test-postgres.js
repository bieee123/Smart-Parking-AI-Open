import { pool } from './postgres.js';

async function testConnection() {
  try {
    const result = await pool.query('SELECT NOW() as current_time');
    console.log('✅ PostgreSQL connected successfully');
    console.log(`   Server time: ${result.rows[0].current_time}`);
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ PostgreSQL connection failed');
    console.error(`   Error: ${error.message}`);
    console.error('');
    console.error('   Possible fixes:');
    console.error('   1. Check DATABASE_URL in .env file');
    console.error('   2. Ensure PostgreSQL server is running');
    console.error('   3. Verify network connectivity to database host');
    process.exit(1);
  }
}

testConnection();
