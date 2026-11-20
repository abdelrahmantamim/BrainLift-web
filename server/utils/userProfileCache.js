// Simple in-memory cache for user profiles
class UserProfileCache {
  constructor(options = {}) {
    this.cache = new Map();
    this.ttl = options.ttl || 5 * 60 * 1000; // 5 minutes default
    this.maxSize = options.maxSize || 1000;
  }

  get(userId) {
    const cached = this.cache.get(userId);
    if (!cached) return null;
    
    if (Date.now() > cached.expiry) {
      this.cache.delete(userId);
      return null;
    }
    
    return cached.data;
  }

  set(userId, profile) {
    // Evict oldest entries if cache is full
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }
    
    this.cache.set(userId, {
      data: profile,
      expiry: Date.now() + this.ttl
    });
  }

  invalidate(userId) {
    this.cache.delete(userId);
  }

  clear() {
    this.cache.clear();
  }

  getStats() {
    let activeCount = 0;
    const now = Date.now();
    
    for (const [_, cached] of this.cache) {
      if (now <= cached.expiry) {
        activeCount++;
      }
    }
    
    return {
      size: this.cache.size,
      active: activeCount,
      maxSize: this.maxSize,
      ttl: this.ttl
    };
  }
}

// Export singleton instance
const userProfileCache = new UserProfileCache();
export default userProfileCache;