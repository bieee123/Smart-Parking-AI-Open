import Redis from 'ioredis';
import config from '../config/env.js';

let redis;

function connectRedis() {
  try {
    redis = new Redis(config.redisUrl, {
      retryStrategy: (times) => {
        if (times > 3) {
          console.warn('⚠️ Redis: Max retries reached, disabling cache');
          return null;
        }
        return Math.min(times * 200, 2000);
      },
    });

    redis.on('connect', () => console.log('✅ Redis connected successfully'));
    redis.on('error', (err) => console.error('❌ Redis error:', err.message));

    return redis;
  } catch (error) {
    console.error('❌ Redis connection error:', error.message);
    return null;
  }
}

async function setCache(key, value, ttl = 3600) {
  if (!redis) return null;
  try {
    const data = typeof value === 'object' ? JSON.stringify(value) : value;
    if (ttl) {
      await redis.setex(key, ttl, data);
    } else {
      await redis.set(key, data);
    }
    return true;
  } catch (error) {
    console.error('Redis setCache error:', error.message);
    return null;
  }
}

async function getCache(key, parse = true) {
  if (!redis) return null;
  try {
    const data = await redis.get(key);
    if (!data) return null;
    return parse ? JSON.parse(data) : data;
  } catch (error) {
    console.error('Redis getCache error:', error.message);
    return null;
  }
}

async function deleteCache(key) {
  if (!redis) return null;
  try {
    await redis.del(key);
    return true;
  } catch (error) {
    console.error('Redis deleteCache error:', error.message);
    return null;
  }
}

// Delete all keys matching a pattern (uses SCAN for safety)
async function deleteCacheByPattern(pattern) {
  if (!redis) return null;
  try {
    let cursor = '0';
    do {
      const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = nextCursor;
      if (keys.length > 0) {
        await redis.del(keys);
      }
    } while (cursor !== '0');
    return true;
  } catch (error) {
    console.error('Redis deleteCacheByPattern error:', error.message);
    return null;
  }
}

export { connectRedis, setCache, getCache, deleteCache, deleteCacheByPattern };
