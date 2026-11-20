import express from 'express';
import pool from '../utils/pgPool.js';
import { requireAdminAuth } from '../middleware/adminAuth.middleware.js';
import {
  getAllRateLimitConfigs,
  updateRateLimitConfig,
  resetRateLimitConfig
} from '../config/rateLimitConfig.js';
import { resetKeyAcrossAllLimiters } from '../middleware/rateLimiter.middleware.js';

const router = express.Router();

// Get all rate limit configurations
router.get('/rate-limits', requireAdminAuth, (req, res) => {
  try {
    const configs = getAllRateLimitConfigs();
    
    // Convert to format expected by frontend
    const formattedConfigs = Object.entries(configs).map(([key, config]) => ({
      id: key,
      endpoint_pattern: `/${key}/*`,
      endpoint_name: key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1').trim(),
      description: `Rate limit for ${key} endpoints`,
      window_ms: config.windowMs,
      max_requests: config.max,
      message: config.message || 'Too many requests, please try again later.',
      skip_successful_requests: config.skipSuccessfulRequests || false,
      skip_failed_requests: false,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));

    res.json({
      success: true,
      data: formattedConfigs,
      rateLimits: formattedConfigs // Add for frontend compatibility
    });
  } catch (error) {
    console.error('[Admin] Failed to get rate limit configs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve rate limit configurations'
    });
  }
});

// Update a specific rate limit configuration
router.put('/rate-limits/:limiterType', requireAdminAuth, (req, res) => {
  try {
    const { limiterType } = req.params;
    const { windowMinutes, maxRequests, message } = req.body;

    if (!windowMinutes || !maxRequests) {
      return res.status(400).json({
        success: false,
        error: 'Window minutes and max requests are required'
      });
    }

    const newConfig = {
      windowMs: windowMinutes * 60 * 1000,
      max: maxRequests
    };

    if (message) {
      newConfig.message = message;
    }

    const updated = updateRateLimitConfig(limiterType, newConfig);

    if (!updated) {
      return res.status(404).json({
        success: false,
        error: 'Rate limiter type not found'
      });
    }

    res.json({
      success: true,
      message: `Rate limit configuration for ${limiterType} updated successfully`
    });
  } catch (error) {
    console.error('[Admin] Failed to update rate limit config:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update rate limit configuration'
    });
  }
});

// Reset rate limit configuration to defaults
router.post('/rate-limits/:limiterType/reset', requireAdminAuth, (req, res) => {
  try {
    const { limiterType } = req.params;
    
    resetRateLimitConfig(limiterType);

    res.json({
      success: true,
      message: `Rate limit configuration for ${limiterType} reset to defaults`
    });
  } catch (error) {
    console.error('[Admin] Failed to reset rate limit config:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reset rate limit configuration'
    });
  }
});

// Reset all rate limit configurations
router.post('/rate-limits/reset-all', requireAdminAuth, (req, res) => {
  try {
    resetRateLimitConfig();

    res.json({
      success: true,
      message: 'All rate limit configurations reset to defaults'
    });
  } catch (error) {
    console.error('[Admin] Failed to reset all rate limit configs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reset rate limit configurations'
    });
  }
});

// Reset rate limits for a specific user (by email, user ID, or IP)
router.post('/rate-limits/reset-user', requireAdminAuth, async (req, res) => {
  try {
    const { identifier } = req.body; // email, userId, or IP address

    if (!identifier || typeof identifier !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'identifier is required (email, userId, or IP address)'
      });
    }

    const keysToReset = [identifier.trim()];

    // If identifier looks like an email, also look up the user ID
    if (identifier.includes('@')) {
      try {
        const result = await pool.query(
          'SELECT id FROM "user" WHERE email = $1 LIMIT 1',
          [identifier.trim()]
        );
        if (result.rows.length > 0) {
          keysToReset.push(result.rows[0].id);
        }
      } catch (dbErr) {
        console.error('[Admin] Failed to look up user by email:', dbErr.message);
        // Continue anyway — will still try resetting by the raw identifier
      }
    }

    const allResults = [];
    for (const key of keysToReset) {
      const results = await resetKeyAcrossAllLimiters(key);
      allResults.push({ key, results });
    }

    console.log(`[Admin] Rate limits reset for keys: ${keysToReset.join(', ')}`);

    res.json({
      success: true,
      message: `Rate limits reset for: ${keysToReset.join(', ')}`,
      details: allResults
    });
  } catch (error) {
    console.error('[Admin] Failed to reset user rate limits:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reset user rate limits'
    });
  }
});

export default router;