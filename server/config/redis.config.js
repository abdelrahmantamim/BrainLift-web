import Redis from 'ioredis';
import environments from './environments.js';

let redisClient = null;

function initializeRedis() {
  // Only initialize Redis if URL is provided
  if (!process.env.REDIS_URL) {
    console.log('[Redis] No REDIS_URL provided, skipping Redis initialization');
    return null;
  }

  try {
    const redisOptions = {
      enableOfflineQueue: false,
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      reconnectOnError: (err) => {
        const targetError = 'READONLY';
        if (err.message.includes(targetError)) {
          // Only reconnect when the error contains "READONLY"
          return true;
        }
        return false;
      }
    };

    // Production-specific options
    if (environments.isProduction) {
      redisOptions.tls = process.env.REDIS_TLS === 'true' ? {} : undefined;
      redisOptions.password = process.env.REDIS_PASSWORD;
    }

    redisClient = new Redis(process.env.REDIS_URL, redisOptions);

    redisClient.on('connect', () => {
      console.log('[Redis] Connected successfully');
    });

    redisClient.on('error', (err) => {
      console.error('[Redis] Connection error:', err.message);
    });

    redisClient.on('close', () => {
      console.log('[Redis] Connection closed');
    });

    redisClient.on('reconnecting', () => {
      console.log('[Redis] Reconnecting...');
    });

    return redisClient;
  } catch (error) {
    console.error('[Redis] Failed to initialize:', error);
    return null;
  }
}

function getRedisClient() {
  return redisClient;
}

// Cache wrapper functions
async function getCache(key) {
  if (!redisClient) return null;
  
  try {
    const data = await redisClient.get(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('[Redis] Get cache error:', error);
    return null;
  }
}

async function setCache(key, value, ttl = environments.current.cache.ttl) {
  if (!redisClient) return false;
  
  try {
    await redisClient.setex(key, ttl, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error('[Redis] Set cache error:', error);
    return false;
  }
}

async function deleteCache(key) {
  if (!redisClient) return false;
  
  try {
    await redisClient.del(key);
    return true;
  } catch (error) {
    console.error('[Redis] Delete cache error:', error);
    return false;
  }
}

async function clearCachePattern(pattern) {
  if (!redisClient) return false;
  
  try {
    const keys = await redisClient.keys(pattern);
    if (keys.length > 0) {
      await redisClient.del(...keys);
    }
    return true;
  } catch (error) {
    console.error('[Redis] Clear cache pattern error:', error);
    return false;
  }
}

// Graceful shutdown
async function closeRedis() {
  if (redisClient) {
    await redisClient.quit();
    console.log('[Redis] Connection closed gracefully');
  }
}

export {
  initializeRedis,
  getRedisClient,
  getCache,
  setCache,
  deleteCache,
  clearCachePattern,
  closeRedis
};