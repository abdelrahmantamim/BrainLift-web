import rateLimit from 'express-rate-limit';
import { getRateLimitConfig, getAdjustedRateLimit } from '../config/rateLimitConfig.js';

// Create different limiters for different endpoints
const createLimiter = (options) => {
  return rateLimit({
    windowMs: options.windowMs || 15 * 60 * 1000, // Default: 15 minutes
    max: options.max || 100, // Default: 100 requests per window
    message: options.message || 'Too many requests from this IP, please try again later.',
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    // Custom key generator to handle trust proxy properly
    keyGenerator: (req) => {
      // Use x-forwarded-for if available, otherwise use req.ip
      const forwarded = req.headers['x-forwarded-for'];
      if (forwarded) {
        // Get the first IP in the chain (the client IP)
        return forwarded.split(',')[0].trim();
      }
      return req.ip || req.connection.remoteAddress;
    },
    handler: (req, res) => {
      console.log(`[Rate Limit] Blocked request from IP: ${req.ip}`);
      res.status(429).json({
        error: {
          message: options.message || 'Too many requests, please try again later.',
          retryAfter: req.rateLimit.resetTime
        }
      });
    },
    skip: (req) => {
      // Skip rate limiting for health checks
      return req.path === '/health' || req.path === '/api/health';
    }
  });
};

// Create limiters at initialization with initial config
const limiters = {};

// Create a per-user rate limiter using user ID from JWT
const createUserLimiter = (options) => {
  return rateLimit({
    ...options,
    keyGenerator: (req) => {
      // Use user ID from JWT if available, otherwise fall back to IP
      if (req.userId) {
        return req.userId;
      }
      // Use the same IP extraction logic as the main limiter
      const forwarded = req.headers['x-forwarded-for'];
      if (forwarded) {
        return forwarded.split(',')[0].trim();
      }
      return req.ip || req.connection.remoteAddress;
    },
    skip: (req) => {
      // Skip if no user ID (not authenticated)
      return !req.userId && options.requireAuth;
    }
  });
};

// Initialize all limiters
const initializeLimiters = () => {
  limiters.api = createLimiter(getRateLimitConfig('api'));
  limiters.auth = createLimiter(getRateLimitConfig('auth'));
  limiters.chat = createLimiter(getRateLimitConfig('chat'));
  limiters.upload = createLimiter(getRateLimitConfig('upload'));
  limiters.generation = createLimiter(getRateLimitConfig('generation'));
  limiters.shareCreation = createLimiter(getRateLimitConfig('shareCreation'));
  limiters.shareAccess = createLimiter(getRateLimitConfig('shareAccess'));
  
  // Also initialize user-specific limiters
  limiters.userChat = createUserLimiter({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 50, // 50 messages per 5 minutes for authenticated users
    message: 'Too many messages. Please wait a few minutes before sending more.',
    requireAuth: true
  });
  
  limiters.userGeneration = createUserLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 20, // 20 generations per hour for authenticated users
    message: 'Too many AI generations. Please try again later.',
    requireAuth: true
  });
};

// Create dynamic middleware that uses pre-created limiters
const createDynamicLimiter = (limiterType) => {
  return (req, res, next) => {
    // Use the pre-created limiter
    const limiter = limiters[limiterType];
    
    if (!limiter) {
      console.error(`[Rate Limiter] Unknown limiter type: ${limiterType}`);
      return next();
    }
    
    // Apply the limiter
    limiter(req, res, next);
  };
};

// Initialize on startup
initializeLimiters();


// General API rate limiter
const apiLimiter = createDynamicLimiter('api');

// Moderate limiter for auth endpoints
const authLimiter = createDynamicLimiter('auth');

// Moderate limiter for chat endpoints (AI is expensive)
const chatLimiter = createDynamicLimiter('chat');

// File upload limiter
const uploadLimiter = createDynamicLimiter('upload');

// Quiz/Flashcard generation limiter
const generationLimiter = createDynamicLimiter('generation');

// Share creation limiter - prevent spam sharing
const shareCreationLimiter = createDynamicLimiter('shareCreation');

// Share access limiter - prevent scraping/abuse
const shareAccessLimiter = createDynamicLimiter('shareAccess');

// User-specific chat limiter (more generous for authenticated users)
const userChatLimiter = (req, res, next) => limiters.userChat(req, res, next);

// User-specific generation limiter
const userGenerationLimiter = (req, res, next) => limiters.userGeneration(req, res, next);

/**
 * Reset rate limit counters for a specific key (IP address or user ID)
 * across all limiters. express-rate-limit stores use the key from keyGenerator.
 * The default MemoryStore exposes a resetKey method.
 */
const resetKeyAcrossAllLimiters = async (key) => {
  const results = [];
  for (const [name, limiter] of Object.entries(limiters)) {
    try {
      // express-rate-limit v7 stores are accessible and have resetKey
      if (limiter && typeof limiter.resetKey === 'function') {
        await limiter.resetKey(key);
        results.push({ limiter: name, reset: true });
      } else {
        results.push({ limiter: name, reset: false, reason: 'no resetKey method' });
      }
    } catch (err) {
      results.push({ limiter: name, reset: false, reason: err.message });
    }
  }
  return results;
};

export {
  apiLimiter,
  authLimiter,
  chatLimiter,
  uploadLimiter,
  generationLimiter,
  shareCreationLimiter,
  shareAccessLimiter,
  userChatLimiter,
  userGenerationLimiter,
  createLimiter,
  createUserLimiter,
  resetKeyAcrossAllLimiters
};