import express from 'express';
import logger from '../utils/serverLogger.js';

const router = express.Router();

// In-memory feature flags store with default values
// In production, this would be stored in a database
let featureFlags = {
  'web-login-enabled': {
    id: 'web-login-enabled',
    name: 'Web Login Enabled',
    description: 'Enables web-based login and registration functionality',
    enabled: true
  }
};

/**
 * GET /api/feature-flags
 * Get all feature flags
 */
router.get('/', async (req, res) => {
  try {
    logger.info('FeatureFlags', 'Fetching all feature flags');
    
    const flags = Object.values(featureFlags);
    
    res.status(200).json({
      success: true,
      flags: flags
    });
  } catch (error) {
    logger.error('FeatureFlags', 'Error fetching feature flags:', error.message);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

/**
 * GET /api/feature-flags/:flagId
 * Get specific feature flag
 */
router.get('/:flagId', async (req, res) => {
  try {
    const { flagId } = req.params;
    logger.info('FeatureFlags', `Fetching feature flag: ${flagId}`);
    
    const flag = featureFlags[flagId];
    
    if (!flag) {
      return res.status(404).json({
        success: false,
        message: 'Feature flag not found'
      });
    }
    
    res.status(200).json({
      success: true,
      flag: flag
    });
  } catch (error) {
    logger.error('FeatureFlags', 'Error fetching feature flag:', error.message);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

/**
 * PUT /api/feature-flags/:flagId
 * Update specific feature flag
 */
router.put('/:flagId', async (req, res) => {
  try {
    const { flagId } = req.params;
    const { enabled } = req.body;
    
    logger.info('FeatureFlags', `Updating feature flag: ${flagId} to ${enabled}`);
    
    const flag = featureFlags[flagId];
    
    if (!flag) {
      return res.status(404).json({
        success: false,
        message: 'Feature flag not found'
      });
    }
    
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'Enabled must be a boolean value'
      });
    }
    
    // Update the flag
    featureFlags[flagId] = {
      ...flag,
      enabled: enabled
    };
    
    logger.info('FeatureFlags', `Feature flag ${flagId} updated successfully: ${enabled}`);
    
    res.status(200).json({
      success: true,
      flag: featureFlags[flagId]
    });
  } catch (error) {
    logger.error('FeatureFlags', 'Error updating feature flag:', error.message);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

/**
 * POST /api/feature-flags
 * Create new feature flag (for admin purposes)
 */
router.post('/', async (req, res) => {
  try {
    const { id, name, description, enabled = false } = req.body;
    
    logger.info('FeatureFlags', `Creating new feature flag: ${id}`);
    
    if (!id || !name || !description) {
      return res.status(400).json({
        success: false,
        message: 'ID, name, and description are required'
      });
    }
    
    if (featureFlags[id]) {
      return res.status(409).json({
        success: false,
        message: 'Feature flag already exists'
      });
    }
    
    const newFlag = {
      id,
      name,
      description,
      enabled: Boolean(enabled)
    };
    
    featureFlags[id] = newFlag;
    
    logger.info('FeatureFlags', `Feature flag ${id} created successfully`);
    
    res.status(201).json({
      success: true,
      flag: newFlag
    });
  } catch (error) {
    logger.error('FeatureFlags', 'Error creating feature flag:', error.message);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

/**
 * DELETE /api/feature-flags/:flagId
 * Delete feature flag (for admin purposes)
 */
router.delete('/:flagId', async (req, res) => {
  try {
    const { flagId } = req.params;
    
    logger.info('FeatureFlags', `Deleting feature flag: ${flagId}`);
    
    const flag = featureFlags[flagId];
    
    if (!flag) {
      return res.status(404).json({
        success: false,
        message: 'Feature flag not found'
      });
    }
    
    // Prevent deletion of critical flags
    if (flagId === 'web-login-enabled') {
      return res.status(403).json({
        success: false,
        message: 'Cannot delete critical system flag'
      });
    }
    
    delete featureFlags[flagId];
    
    logger.info('FeatureFlags', `Feature flag ${flagId} deleted successfully`);
    
    res.status(200).json({
      success: true,
      message: 'Feature flag deleted successfully'
    });
  } catch (error) {
    logger.error('FeatureFlags', 'Error deleting feature flag:', error.message);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

/**
 * GET /api/feature-flags/check/:flagId
 * Quick check if a specific flag is enabled (for client apps)
 */
router.get('/check/:flagId', async (req, res) => {
  try {
    const { flagId } = req.params;
    
    const flag = featureFlags[flagId];
    const enabled = flag ? flag.enabled : false;
    
    res.status(200).json({
      success: true,
      enabled: enabled
    });
  } catch (error) {
    logger.error('FeatureFlags', 'Error checking feature flag:', error.message);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

export default router;