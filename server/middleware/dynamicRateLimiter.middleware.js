const rateLimit = require('express-rate-limit');
const { getSupabase } = require('../config/services.config');

// Cache for rate limit configurations
let rateLimitCache = new Map();
let lastCacheUpdate = 0;
const CACHE_TTL = 30000; // 30 seconds cache for faster updates

// Store for rate limiter instances (reuse them to maintain state)
const limiterInstances = new Map();

// Load rate limit configurations from database
async function loadRateLimits() {
  try {
    console.log('[DynamicRateLimiter] Loading rate limits from database...');
    const supabase = getSupabase();
    
    const { data: rateLimits, error } = await supabase
      .from('rate_limits')
      .select('endpoint_pattern, window_ms, max_requests, message, skip_successful_requests, skip_failed_requests')
      .eq('is_active', true);
    
    if (error) {
      console.error('[DynamicRateLimiter] Error loading rate limits:', error);
      return;
    }
    
    // Clear and rebuild cache
    const newCache = new Map();
    
    rateLimits.forEach(limit => {
      newCache.set(limit.endpoint_pattern, {
        ...limit,
        limiter: createOrUpdateLimiterFromConfig(limit)
      });
    });
    
    rateLimitCache = newCache;
    lastCacheUpdate = Date.now();
    
    console.log(`[DynamicRateLimiter] Loaded ${rateLimits.length} rate limit configurations`);
  } catch (error) {
    console.error('[DynamicRateLimiter] Failed to load rate limits:', error);
  }
}

// Create or update a rate limiter from database configuration
function createOrUpdateLimiterFromConfig(config) {
  const key = config.endpoint_pattern;
  
  // Check if we already have a limiter for this endpoint
  if (limiterInstances.has(key)) {
    const existingLimiter = limiterInstances.get(key);
    // Update the configuration of the existing limiter
    // Note: express-rate-limit doesn't provide a direct way to update config,
    // but we can update the options object directly
    existingLimiter.options.windowMs = config.window_ms;
    existingLimiter.options.max = config.max_requests;
    existingLimiter.options.message = config.message;
    existingLimiter.options.skipSuccessfulRequests = config.skip_successful_requests || false;
    existingLimiter.options.skipFailedRequests = config.skip_failed_requests || false;
    
    console.log(`[DynamicRateLimiter] Updated existing limiter for ${key} - max: ${config.max_requests}, window: ${config.window_ms}ms`);
    return existingLimiter;
  }
  
  // Create a new limiter
  const newLimiter = rateLimit({
    windowMs: config.window_ms,
    max: config.max_requests,
    message: config.message,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: config.skip_successful_requests || false,
    skipFailedRequests: config.skip_failed_requests || false,
    handler: (req, res) => {
      console.log(`[Rate Limit] Blocked request from IP: ${req.ip} on ${req.path}`);
      res.status(429).json({
        error: {
          message: config.message,
          retryAfter: req.rateLimit.resetTime
        }
      });
    },
    keyGenerator: (req) => {
      // For authenticated endpoints, use user ID + endpoint
      if (config.endpoint_pattern.includes(':authenticated') && req.userId) {
        return `${req.userId}-${config.endpoint_pattern}`;
      }
      // Otherwise use IP + endpoint
      return `${req.ip}-${config.endpoint_pattern}`;
    },
    skip: (req) => {
      // Skip rate limiting for health checks
      if (req.path === '/health' || req.path === '/api/health') {
        return true;
      }
      
      // Skip if endpoint requires authentication but user is not authenticated
      if (config.endpoint_pattern.includes(':authenticated') && !req.userId) {
        return true;
      }
      
      return false;
    }
  });
  
  // Store the new limiter
  limiterInstances.set(key, newLimiter);
  console.log(`[DynamicRateLimiter] Created new limiter for ${key} - max: ${config.max_requests}, window: ${config.window_ms}ms`);
  return newLimiter;
}

// Find matching rate limit for a request path
function findMatchingRateLimit(path, isAuthenticated = false) {
  // First try exact match with authentication suffix
  if (isAuthenticated) {
    const authPattern = `${path}:authenticated`;
    if (rateLimitCache.has(authPattern)) {
      return rateLimitCache.get(authPattern);
    }
  }
  
  // Then try exact match
  if (rateLimitCache.has(path)) {
    return rateLimitCache.get(path);
  }
  
  // Then try wildcard patterns
  for (const [pattern, config] of rateLimitCache) {
    // Skip authenticated patterns if not authenticated
    if (pattern.includes(':authenticated') && !isAuthenticated) {
      continue;
    }
    
    // Convert wildcard pattern to regex
    const regexPattern = pattern
      .replace(':authenticated', '') // Remove auth suffix for matching
      .replace(/\*/g, '.*') // Replace * with .*
      .replace(/\//g, '\\/'); // Escape forward slashes
    
    const regex = new RegExp(`^${regexPattern}$`);
    if (regex.test(path)) {
      return config;
    }
  }
  
  return null;
}

// Dynamic rate limiter middleware
const dynamicRateLimiter = async (req, res, next) => {
  try {
    // Initialize if needed
    await initializeIfNeeded();
    
    // Refresh cache if needed
    if (Date.now() - lastCacheUpdate > CACHE_TTL) {
      await loadRateLimits();
    }
    
    // Find matching rate limit configuration
    const rateLimit = findMatchingRateLimit(req.path, !!req.userId);
    
    if (rateLimit && rateLimit.limiter) {
      // Apply the rate limiter
      return rateLimit.limiter(req, res, next);
    }
    
    // No rate limit found, continue
    next();
  } catch (error) {
    console.error('[DynamicRateLimiter] Error applying rate limit:', error);
    // On error, continue without rate limiting
    next();
  }
};

// Force reload of rate limits (useful after admin updates)
async function reloadRateLimits() {
  lastCacheUpdate = 0; // Force cache refresh
  await loadRateLimits();
}

// Initialize rate limits after services are ready
let initialized = false;
async function initializeIfNeeded() {
  if (!initialized) {
    try {
      await loadRateLimits();
      initialized = true;
      
      // Start periodic refresh every 5 minutes (reduced from 30s to save Supabase egress)
      setInterval(loadRateLimits, 5 * 60 * 1000);
    } catch (error) {
      console.error('[DynamicRateLimiter] Failed to initialize:', error);
    }
  }
}

module.exports = {
  dynamicRateLimiter,
  reloadRateLimits,
  loadRateLimits
};