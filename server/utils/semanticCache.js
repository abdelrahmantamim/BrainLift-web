// Semantic cache for similar questions
import crypto from 'crypto';

class SemanticCache {
  constructor(options = {}) {
    this.cache = new Map();
    this.maxSize = options.maxSize || 1000;
    this.ttl = options.ttl || 3600000; // 1 hour default
    this.similarityThreshold = options.similarityThreshold || 0.95;
  }

  // Generate a normalized hash for the message
  _normalizeMessage(message) {
    return message
      .toLowerCase()
      // Keep Unicode letters, numbers, and spaces (supports Arabic, Chinese, etc.)
      .replace(/[^\p{L}\p{N}\s]/gu, '') // Remove punctuation but keep all Unicode letters
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  // Generate cache key based on message and context
  _generateKey(message, modelName, userId, language = 'en', responseStyle = 'detailed') {
    const normalized = this._normalizeMessage(message);
    const context = `${modelName}:${userId}:${language}:${responseStyle}`;
    return crypto
      .createHash('sha256')
      .update(`${normalized}:${context}`)
      .digest('hex');
  }

  // Calculate simple similarity between two normalized messages
  _calculateSimilarity(msg1, msg2) {
    const words1 = msg1.split(' ');
    const words2 = msg2.split(' ');
    
    // Quick length check
    const lengthRatio = Math.min(words1.length, words2.length) / Math.max(words1.length, words2.length);
    if (lengthRatio < 0.8) return 0;
    
    // Word overlap
    const set1 = new Set(words1);
    const set2 = new Set(words2);
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return intersection.size / union.size;
  }

  // Get cached response if available
  get(message, modelName, userId, language = 'en', responseStyle = 'detailed') {
    const key = this._generateKey(message, modelName, userId, language, responseStyle);
    const cached = this.cache.get(key);
    
    if (cached) {
      const age = Date.now() - cached.timestamp;
      if (age < this.ttl) {
        console.log(`[SemanticCache] Direct hit for: "${message.substring(0, 50)}..." (${responseStyle})`);
        return cached.response;
      } else {
        // Expired
        this.cache.delete(key);
      }
    }
    
    // Try to find similar messages with same response style
    const normalized = this._normalizeMessage(message);
    for (const [cachedKey, cachedValue] of this.cache.entries()) {
      if (cachedValue.modelName === modelName && 
          cachedValue.userId === userId && 
          cachedValue.language === language &&
          cachedValue.responseStyle === responseStyle) {
        const similarity = this._calculateSimilarity(normalized, cachedValue.normalizedMessage);
        if (similarity >= this.similarityThreshold) {
          const age = Date.now() - cachedValue.timestamp;
          if (age < this.ttl) {
            console.log(`[SemanticCache] Similar hit (${Math.round(similarity * 100)}%) for: "${message.substring(0, 50)}..." (${responseStyle})`);
            return cachedValue.response;
          }
        }
      }
    }
    
    return null;
  }

  // Store response in cache
  set(message, modelName, userId, response, language = 'en', responseStyle = 'detailed') {
    const key = this._generateKey(message, modelName, userId, language, responseStyle);
    const normalized = this._normalizeMessage(message);
    
    // Implement LRU eviction
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }
    
    this.cache.set(key, {
      response,
      normalizedMessage: normalized,
      modelName,
      userId,
      language,
      responseStyle,
      timestamp: Date.now()
    });
    
    console.log(`[SemanticCache] Stored response for: "${message.substring(0, 50)}..." (${responseStyle})`);
  }

  // Clear cache for a specific user
  clearUser(userId) {
    for (const [key, value] of this.cache.entries()) {
      if (value.userId === userId) {
        this.cache.delete(key);
      }
    }
  }

  // Get cache statistics
  getStats() {
    const now = Date.now();
    let activeCount = 0;
    let expiredCount = 0;
    
    for (const value of this.cache.values()) {
      if (now - value.timestamp < this.ttl) {
        activeCount++;
      } else {
        expiredCount++;
      }
    }
    
    return {
      totalSize: this.cache.size,
      activeEntries: activeCount,
      expiredEntries: expiredCount,
      maxSize: this.maxSize,
      ttlMs: this.ttl
    };
  }
}

// Create singleton instance
const semanticCache = new SemanticCache({
  maxSize: 500,
  ttl: 1800000, // 30 minutes
  similarityThreshold: 0.9
});

export default semanticCache;