import express from 'express';
import { getSubscriptionLimits, updateSubscriptionLimits } from '../middleware/subscriptionLimits.middleware.js';

const router = express.Router();

// GET /admin/subscription-limits - Get current limits
router.get('/', async (req, res) => {
  try {
    const limits = await getSubscriptionLimits();
    res.json({ limits });
  } catch (error) {
    console.error('Failed to get subscription limits:', error);
    res.status(500).json({ error: { message: 'Failed to get subscription limits' } });
  }
});

// PUT /admin/subscription-limits - Update limits
router.put('/', async (req, res) => {
  try {
    const { limits } = req.body;

    if (!limits || typeof limits !== 'object') {
      return res.status(400).json({ error: { message: 'Missing or invalid limits object' } });
    }

    // Validate structure: must have free, premium, ultra tiers
    const requiredTiers = ['free', 'premium', 'ultra'];
    const requiredFields = ['generations', 'chat', 'export', 'chart', 'file_storage'];

    for (const tier of requiredTiers) {
      if (!limits[tier] || typeof limits[tier] !== 'object') {
        return res.status(400).json({ error: { message: `Missing tier: ${tier}` } });
      }
      for (const field of requiredFields) {
        if (typeof limits[tier][field] !== 'number') {
          return res.status(400).json({ error: { message: `Missing or invalid ${tier}.${field} (must be a number)` } });
        }
      }
    }

    await updateSubscriptionLimits(limits);
    res.json({ success: true, limits });
  } catch (error) {
    console.error('Failed to update subscription limits:', error);
    res.status(500).json({ error: { message: 'Failed to update subscription limits' } });
  }
});

export default router;
