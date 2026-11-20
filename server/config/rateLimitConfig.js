import viralEventMonitor from '../services/viralEventMonitor.service.js';
import logger from '../utils/serverLogger.js';

// Dynamic rate limit configuration
let rateLimitConfig = {
  api: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 500, // Increased from 100
    message: 'Too many API requests, please try again later.'
  },
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 25, // Reduced from 100 to production-ready limit for security
    message: 'Too many authentication attempts, please try again later.',
    skipSuccessfulRequests: true // Only count failed attempts
  },
  chat: {
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 100, // Increased from 20 - users can have conversations
    message: 'Too many chat messages, please slow down.'
  },
  upload: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 50, // Increased from 10 - users may upload multiple files
    message: 'Too many file uploads, please try again later.'
  },
  generation: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 50, // Increased from 10 - too restrictive for quiz/flashcard/chart generation
    message: 'Too many generation requests, please try again later.'
  },
  userChat: {
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 200, // Increased from 50
    message: 'You have reached your chat message limit, please wait a few minutes.',
    requireAuth: true
  },
  userGeneration: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 100, // Increased from 20
    message: 'You have reached your content generation limit for this hour.',
    requireAuth: true
  },
  shareCreation: {
    windowMs: 60 * 1000, // 1 minute
    max: 10, // Max 10 shares per minute to prevent spam
    message: 'Too many share links created. Please wait a minute and try again.',
    requireAuth: true
  },
  shareAccess: {
    windowMs: 60 * 1000, // 1 minute  
    max: 30, // Max 30 share accesses per minute
    message: 'Too many share access attempts. Please wait and try again.'
  }
};

// Get current configuration
export const getRateLimitConfig = (limiterType) => {
  return rateLimitConfig[limiterType] || rateLimitConfig.api;
};

// Update configuration (for admin dashboard)
export const updateRateLimitConfig = (limiterType, newConfig) => {
  if (rateLimitConfig[limiterType]) {
    rateLimitConfig[limiterType] = {
      ...rateLimitConfig[limiterType],
      ...newConfig
    };
    console.log(`[RateLimitConfig] Updated ${limiterType} config:`, rateLimitConfig[limiterType]);
    return true;
  }
  return false;
};

// Get all configurations
export const getAllRateLimitConfigs = () => {
  return { ...rateLimitConfig };
};

// Reset to defaults
export const resetRateLimitConfig = (limiterType) => {
  const defaults = {
    api: { windowMs: 15 * 60 * 1000, max: 500 },
    auth: { windowMs: 15 * 60 * 1000, max: 25, skipSuccessfulRequests: true }, // Production-ready limit
    chat: { windowMs: 5 * 60 * 1000, max: 100 },
    upload: { windowMs: 60 * 60 * 1000, max: 50 },
    generation: { windowMs: 15 * 60 * 1000, max: 50 },
    userChat: { windowMs: 5 * 60 * 1000, max: 200, requireAuth: true },
    userGeneration: { windowMs: 60 * 60 * 1000, max: 100, requireAuth: true },
    shareCreation: { windowMs: 60 * 1000, max: 10, requireAuth: true },
    shareAccess: { windowMs: 60 * 1000, max: 30 }
  };

  if (limiterType && defaults[limiterType]) {
    rateLimitConfig[limiterType] = {
      ...defaults[limiterType],
      message: rateLimitConfig[limiterType].message
    };
  } else if (!limiterType) {
    // Reset all
    Object.keys(defaults).forEach(key => {
      rateLimitConfig[key] = {
        ...defaults[key],
        message: rateLimitConfig[key].message
      };
    });
  }
};

// Viral surge multiplier for rate limits
let viralSurgeMultiplier = 1.0;

// Enable surge protection (reduce limits)
export const enableSurgeProtection = () => {
  viralSurgeMultiplier = 0.3; // Reduce limits to 30% during viral events
  logger.warn('RateLimitConfig', 'SURGE PROTECTION ENABLED - Rate limits reduced to 30%');
};

// Disable surge protection (restore normal limits)
export const disableSurgeProtection = () => {
  viralSurgeMultiplier = 1.0;
  logger.info('RateLimitConfig', 'Surge protection disabled - Rate limits restored to normal');
};

// Get adjusted rate limit based on viral status
export const getAdjustedRateLimit = (limiterType) => {
  const config = getRateLimitConfig(limiterType);
  if (viralSurgeMultiplier < 1.0) {
    return {
      ...config,
      max: Math.max(1, Math.floor(config.max * viralSurgeMultiplier)),
      message: config.message + ' (Viral surge protection active)'
    };
  }
  return config;
};

// Listen for viral events
viralEventMonitor.on('viral-event-started', () => {
  enableSurgeProtection();
});

viralEventMonitor.on('viral-event-ended', () => {
  disableSurgeProtection();
});

export default {
  getRateLimitConfig,
  updateRateLimitConfig,
  getAllRateLimitConfigs,
  resetRateLimitConfig,
  enableSurgeProtection,
  disableSurgeProtection,
  getAdjustedRateLimit
};