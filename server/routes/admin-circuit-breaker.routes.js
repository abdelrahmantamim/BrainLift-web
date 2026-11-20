import express from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requireSessionAdmin } from '../middleware/adminAuth.middleware.js';
import circuitBreakerManager from '../services/circuitBreaker.service.js';
import logger from '../utils/serverLogger.js';

const router = express.Router();

// Get all circuit breakers status
router.get('/status', requireAuth, requireSessionAdmin, async (req, res) => {
  try {
    const status = circuitBreakerManager.getAllStatus();
    res.json(status);
  } catch (error) {
    logger.error('AdminCircuitBreaker', 'Error getting status:', error);
    res.status(500).json({ error: error.message });
  }
});

// Reset a specific circuit breaker
router.post('/reset/:name', requireAuth, requireSessionAdmin, async (req, res) => {
  try {
    const { name } = req.params;
    
    const success = circuitBreakerManager.resetBreaker(name);
    
    if (success) {
      logger.info('AdminCircuitBreaker', `Circuit breaker ${name} reset by admin`);
      res.json({ success: true, message: `Circuit breaker ${name} reset successfully` });
    } else {
      res.status(404).json({ error: `Circuit breaker ${name} not found` });
    }
  } catch (error) {
    logger.error('AdminCircuitBreaker', 'Error resetting breaker:', error);
    res.status(500).json({ error: error.message });
  }
});

// Reset all circuit breakers
router.post('/reset-all', requireAuth, requireSessionAdmin, async (req, res) => {
  try {
    circuitBreakerManager.resetAll();
    logger.info('AdminCircuitBreaker', 'All circuit breakers reset by admin');
    res.json({ success: true, message: 'All circuit breakers reset successfully' });
  } catch (error) {
    logger.error('AdminCircuitBreaker', 'Error resetting all breakers:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get circuit breaker metrics
router.get('/metrics/:name', requireAuth, requireSessionAdmin, async (req, res) => {
  try {
    const { name } = req.params;
    const status = circuitBreakerManager.getAllStatus();
    
    if (status[name]) {
      res.json(status[name]);
    } else {
      res.status(404).json({ error: `Circuit breaker ${name} not found` });
    }
  } catch (error) {
    logger.error('AdminCircuitBreaker', 'Error getting metrics:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;