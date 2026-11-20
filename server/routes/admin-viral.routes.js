import express from 'express';
import { requireAdminAuth } from '../middleware/adminAuth.middleware.js';
import viralEventMonitor from '../services/viralEventMonitor.service.js';
import { getSupabase } from '../config/services.config.js';
import logger from '../utils/serverLogger.js';

const router = express.Router();

// Get viral monitoring status
router.get('/status', requireAdminAuth, async (req, res) => {
  try {
    const status = viralEventMonitor.getStatus();
    res.json(status);
  } catch (error) {
    logger.error('AdminViral', 'Error getting viral status:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get current metrics
router.get('/metrics', requireAdminAuth, async (req, res) => {
  try {
    const metrics = await viralEventMonitor.getMetrics();
    res.json(metrics);
  } catch (error) {
    logger.error('AdminViral', 'Error getting metrics:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get viral event history
router.get('/history', requireAdminAuth, async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const history = await viralEventMonitor.getViralEventHistory(parseInt(days));
    res.json(history);
  } catch (error) {
    logger.error('AdminViral', 'Error getting viral history:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get viral event statistics
router.get('/stats', requireAdminAuth, async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const supabase = getSupabase();
    
    const { data: stats, error } = await supabase
      .rpc('get_viral_event_stats', { p_days: parseInt(days) });
    
    if (error) {
      logger.error('AdminViral', 'Failed to fetch viral stats:', error);
      return res.status(500).json({ error: 'Failed to fetch statistics' });
    }
    
    res.json(stats[0] || {
      total_events: 0,
      active_events: 0,
      avg_duration_minutes: 0,
      max_duration_minutes: 0,
      events_by_hour: {}
    });
  } catch (error) {
    logger.error('AdminViral', 'Error getting viral stats:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update viral thresholds
router.put('/thresholds', requireAdminAuth, async (req, res) => {
  try {
    const { thresholds } = req.body;
    
    if (!thresholds || typeof thresholds !== 'object') {
      return res.status(400).json({ error: 'Invalid thresholds' });
    }
    
    // Validate threshold values
    const validKeys = ['sharesPerMinute', 'newUsersPerMinute', 'apiRequestsPerSecond', 'importsPerMinute', 'notificationsPerMinute'];
    for (const [key, value] of Object.entries(thresholds)) {
      if (!validKeys.includes(key)) {
        return res.status(400).json({ error: `Invalid threshold key: ${key}` });
      }
      if (typeof value !== 'number' || value <= 0) {
        return res.status(400).json({ error: `Invalid threshold value for ${key}: must be positive number` });
      }
    }
    
    viralEventMonitor.updateThresholds(thresholds);
    
    res.json({
      success: true,
      message: 'Thresholds updated',
      thresholds: viralEventMonitor.getStatus().thresholds
    });
  } catch (error) {
    logger.error('AdminViral', 'Error updating thresholds:', error);
    res.status(500).json({ error: error.message });
  }
});

// Manually trigger viral check
router.post('/check', requireAdminAuth, async (req, res) => {
  try {
    await viralEventMonitor.checkForViralEvent();
    const status = viralEventMonitor.getStatus();
    
    res.json({
      success: true,
      message: 'Viral check completed',
      isViralMode: status.isViralMode,
      currentMetrics: status.currentMetrics
    });
  } catch (error) {
    logger.error('AdminViral', 'Error triggering viral check:', error);
    res.status(500).json({ error: error.message });
  }
});

// Start/stop monitoring
router.post('/monitoring/:action', requireAdminAuth, async (req, res) => {
  try {
    const { action } = req.params;
    
    if (action === 'start') {
      viralEventMonitor.startMonitoring();
      res.json({ success: true, message: 'Monitoring started' });
    } else if (action === 'stop') {
      viralEventMonitor.stopMonitoring();
      res.json({ success: true, message: 'Monitoring stopped' });
    } else {
      res.status(400).json({ error: 'Invalid action. Use start or stop' });
    }
  } catch (error) {
    logger.error('AdminViral', 'Error controlling monitoring:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;