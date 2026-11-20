import { getCache, setCache, deleteCache, clearCachePattern } from '../config/redis.config.js';
import environments from '../config/environments.js';

// In-memory cache fallback
const memoryCache = new Map();
const memoryCacheTTL = new Map();

// Clean up expired memory cache entries
setInterval(() => {
  const now = Date.now();
  for (const [key, expiry] of memoryCacheTTL.entries()) {
    if (expiry < now) {
      memoryCache.delete(key);
      memoryCacheTTL.delete(key);
    }
  }
}, environments.current.cache.checkPeriod * 1000);

// Cache key generator
function generateCacheKey(req, prefix = 'api') {
  const userId = req.userId || 'anonymous';
  const method = req.method;
  const path = req.path;
  
  // Filter out cache-busting parameters
  const filteredQuery = { ...req.query };
  delete filteredQuery._t; // Remove timestamp cache buster
  delete filteredQuery._; // Remove jQuery cache buster
  
  const query = JSON.stringify(filteredQuery || {});
  
  return `${prefix}:${userId}:${method}:${path}:${query}`;
}

// Cache middleware factory
function cacheMiddleware(options = {}) {
  const {
    ttl = environments.current.cache.ttl,
    prefix = 'api',
    condition = () => true,
    keyGenerator = generateCacheKey
  } = options;

  return async (req, res, next) => {
    // Skip caching for non-GET requests or if condition is false
    if (req.method !== 'GET' || !condition(req)) {
      return next();
    }

    const cacheKey = keyGenerator(req, prefix);

    try {
      // Try to get from cache
      let cachedData = await getCache(cacheKey);
      
      // Fallback to memory cache if Redis is not available
      if (!cachedData && memoryCache.has(cacheKey)) {
        const expiry = memoryCacheTTL.get(cacheKey);
        if (expiry && expiry > Date.now()) {
          cachedData = memoryCache.get(cacheKey);
        } else {
          memoryCache.delete(cacheKey);
          memoryCacheTTL.delete(cacheKey);
        }
      }

      if (cachedData) {
        // Add cache headers
        res.set('X-Cache', 'HIT');
        res.set('X-Cache-Key', cacheKey);
        res.set('Cache-Control', `private, max-age=${ttl}`);
        
        return res.json(cachedData);
      }

      // Store original res.json
      const originalJson = res.json.bind(res);

      // Override res.json to cache the response
      res.json = function(data) {
        // Only cache successful responses
        if (res.statusCode < 400) {
          // Try Redis first
          setCache(cacheKey, data, ttl).catch(err => {
            console.error('[Cache] Redis set error:', err);
          });
          
          // Also set in memory cache as fallback
          memoryCache.set(cacheKey, data);
          memoryCacheTTL.set(cacheKey, Date.now() + (ttl * 1000));
        }

        // Add cache headers
        res.set('X-Cache', 'MISS');
        res.set('X-Cache-Key', cacheKey);
        res.set('Cache-Control', `private, max-age=${ttl}`);

        return originalJson(data);
      };

      next();
    } catch (error) {
      console.error('[Cache] Middleware error:', error);
      next();
    }
  };
}

// Cache invalidation middleware
function invalidateCache(patterns = []) {
  return async (req, res, next) => {
    const userId = req.userId || 'anonymous';

    try {
      // Invalidate cache based on patterns
      for (const pattern of patterns) {
        const cachePattern = pattern.replace(':userId', userId);

        // Clear from Redis (supports glob wildcards like *)
        await clearCachePattern(cachePattern.endsWith('*') ? cachePattern : cachePattern + '*').catch(console.error);

        // Clear from memory cache (uses includes, so strip trailing *)
        const memoryPattern = cachePattern.replace(/\*+$/, '');
        for (const key of memoryCache.keys()) {
          if (key.includes(memoryPattern)) {
            memoryCache.delete(key);
            memoryCacheTTL.delete(key);
          }
        }
      }
    } catch (error) {
      console.error('[Cache] Invalidation error:', error);
    }

    next();
  };
}

// Function to clear dashboard cache for a specific user
async function clearDashboardCache(userId) {
  try {
    const pattern = `dashboard:${userId}:*`;
    
    // Clear from Redis
    await clearCachePattern(pattern).catch(console.error);
    
    // Clear from memory cache
    for (const key of memoryCache.keys()) {
      if (key.includes(pattern) || key.includes(`dashboard:${userId}`)) {
        memoryCache.delete(key);
        memoryCacheTTL.delete(key);
      }
    }
    
    console.log(`[Cache] Cleared dashboard cache for user ${userId}`);
    return true;
  } catch (error) {
    console.error('[Cache] Error clearing dashboard cache:', error);
    return false;
  }
}

// Specific cache configurations for different endpoints
const cacheConfigs = {
  // User profile - cache for 5 minutes
  userProfile: {
    ttl: 300,
    prefix: 'user',
    condition: (req) => req.path === '/profile'
  },
  
  // Quiz list - cache for 30 seconds (reduced from 2 minutes)
  quizList: {
    ttl: 30,
    prefix: 'quiz:v3', // Version bump to invalidate old cache
    condition: (req) => req.path === '/list'
  },
  
  // File list - cache for 1 minute
  fileList: {
    ttl: 60,
    prefix: 'files',
    condition: (req) => req.path === '/list'
  },
  
  // Chat sessions - cache for 30 seconds
  chatSessions: {
    ttl: 30,
    prefix: 'chat',
    condition: (req) => req.path === '/sessions'
  },
  
  // Model config - cache for 10 minutes
  modelConfig: {
    ttl: 600,
    prefix: 'config',
    condition: (req) => req.path.includes('/model-config')
  }
};

// Clear user-specific cache
async function clearUserCache(userId) {
  const patterns = [
    `api:${userId}:*`,
    `user:${userId}:*`,
    `quiz:${userId}:*`,
    `quiz:v2:${userId}:*`,
    `quiz:v3:${userId}:*`,
    `files:${userId}:*`,
    `chat:${userId}:*`
  ];

  for (const pattern of patterns) {
    await clearCachePattern(pattern).catch(console.error);
    
    // Clear from memory cache
    for (const key of memoryCache.keys()) {
      if (key.includes(pattern.replace('*', ''))) {
        memoryCache.delete(key);
        memoryCacheTTL.delete(key);
      }
    }
  }
}

// Cache statistics
function getCacheStats() {
  return {
    memory: {
      size: memoryCache.size,
      keys: Array.from(memoryCache.keys())
    },
    ttl: {
      size: memoryCacheTTL.size
    }
  };
}

export {
  cacheMiddleware,
  invalidateCache,
  cacheConfigs,
  clearUserCache,
  clearDashboardCache,
  getCacheStats,
  generateCacheKey
};