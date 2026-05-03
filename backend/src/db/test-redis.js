import { connectRedis } from './redis.js';

async function testConnection() {
  try {
    const redis = connectRedis();
    if (!redis) {
      throw new Error('Redis client not initialized');
    }

    // Wait a moment for connection to establish
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Test with a ping
    const result = await redis.ping();
    if (result === 'PONG') {
      console.log('✅ Redis connected successfully');
      await redis.quit();
      process.exit(0);
    } else {
      throw new Error('Unexpected ping response');
    }
  } catch (error) {
    console.error('❌ Redis connection failed');
    console.error(`   Error: ${error.message}`);
    console.error('');
    console.error('   Possible fixes:');
    console.error('   1. Check REDIS_URL in .env file');
    console.error('   2. Ensure Redis server is running');
    console.error('   3. Verify port and password are correct');
    console.error('   4. Note: Redis is optional — backend will run without cache');
    process.exit(1);
  }
}

testConnection();
