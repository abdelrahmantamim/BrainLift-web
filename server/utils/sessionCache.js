// Simple in-memory LRU cache for session data
class SessionCache {
  constructor(maxSize = 100, ttlMs = 5 * 60 * 1000) { // 5 minutes default TTL
    this.cache = new Map();
    this.maxSize = maxSize;
    this.ttlMs = ttlMs;
    this.hits = 0;
    this.misses = 0;
  }
  
  // Get cached session data
  get(key) {
    const item = this.cache.get(key);
    if (!item) {
      this.misses++;
      return null;
    }
    
    // Check if expired
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      this.misses++;
      return null;
    }
    
    // Move to end (LRU)
    this.cache.delete(key);
    this.cache.set(key, item);
    
    this.hits++;
    return item.data;
  }
  
  // Set session data with TTL
  set(key, data) {
    // Delete oldest if at capacity
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    this.cache.set(key, {
      data,
      expiry: Date.now() + this.ttlMs
    });
  }
  
  // Invalidate specific session
  invalidate(key) {
    this.cache.delete(key);
  }
  
  // Invalidate all sessions for a user
  invalidateUser(userId) {
    for (const [key] of this.cache) {
      if (key.startsWith(`user:${userId}:`)) {
        this.cache.delete(key);
      }
    }
  }
  
  // Clear entire cache
  clear() {
    this.cache.clear();
  }
  
  // Get cache stats
  getStats() {
    let validCount = 0;
    let expiredCount = 0;
    const now = Date.now();
    
    for (const [key, item] of this.cache) {
      if (now > item.expiry) {
        expiredCount++;
      } else {
        validCount++;
      }
    }
    
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      validCount,
      expiredCount,
      hitRate: this.hits / (this.hits + this.misses) || 0
    };
  }
}

// Singleton instance
const sessionCache = new SessionCache();

// Cache key generators
const cacheKeys = {
  userSessions: (userId, page = 1, limit = 20) => 
    `user:${userId}:sessions:${page}:${limit}`,
  
  sessionDetail: (sessionId) => 
    `session:${sessionId}`,
  
  sessionMessages: (sessionId, page = 1, limit = 50) => 
    `session:${sessionId}:messages:${page}:${limit}`,
  
  sessionSummary: (sessionId) => 
    `session:${sessionId}:summary`
};

export {
  sessionCache,
  cacheKeys
};