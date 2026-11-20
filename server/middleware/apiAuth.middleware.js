// API Key Authentication Middleware
import logger from '../utils/serverLogger.js';

export function authenticateAPI(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  
  if (!apiKey) {
    logger.warn('Auth', `Missing API key from ${req.ip}`);
    return res.status(401).json({ 
      error: 'Missing API key',
      message: 'Please provide X-API-Key header' 
    });
  }
  
  if (apiKey !== process.env.EXPRESS_API_KEY) {
    logger.warn('Auth', `Invalid API key from ${req.ip}`);
    return res.status(401).json({ 
      error: 'Invalid API key' 
    });
  }
  
  // Log successful auth
  logger.debug('Auth', `API request authenticated from ${req.ip}`);
  
  next();
}

// Optional: Rate limiting per API key
const rateLimits = new Map();

export function rateLimitAPI(limit = 100, window = 60000) { // 100 requests per minute
  return (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    const now = Date.now();
    
    if (!rateLimits.has(apiKey)) {
      rateLimits.set(apiKey, {
        count: 1,
        resetTime: now + window
      });
      return next();
    }
    
    const keyData = rateLimits.get(apiKey);
    
    if (now > keyData.resetTime) {
      keyData.count = 1;
      keyData.resetTime = now + window;
      return next();
    }
    
    if (keyData.count >= limit) {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        retryAfter: Math.ceil((keyData.resetTime - now) / 1000)
      });
    }
    
    keyData.count++;
    next();
  };
}