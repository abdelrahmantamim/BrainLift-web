import express from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { sendSupportEmail } from '../services/email.service.js';
import logger from '../utils/serverLogger.js';
import { body, validationResult } from 'express-validator';

const router = express.Router();

// Validation middleware
const validateSupport = [
  body('subject').trim().notEmpty().withMessage('Subject is required'),
  body('message').trim().notEmpty().withMessage('Message is required'),
  body('type').optional().isIn(['feedback', 'support', 'bug', 'feature']).withMessage('Invalid type'),
];

// Send support/feedback email
router.post('/contact', requireAuth, validateSupport, async (req, res) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: { 
          message: 'Validation failed', 
          details: errors.array() 
        } 
      });
    }

    const { subject, message, type = 'feedback' } = req.body;
    const user = req.user;

    logger.info('Support', `${type} request from user:`, user.email);

    // Send email
    await sendSupportEmail(
      user.email,
      user.name || user.email,
      subject,
      message,
      type
    );

    // Also store in database for tracking (optional)
    // You can add database storage here if needed

    res.json({
      success: true,
      message: 'Your message has been sent successfully. We\'ll get back to you soon!'
    });
  } catch (error) {
    logger.error('Support', 'Error sending support email:', error);
    res.status(500).json({
      error: {
        message: 'Failed to send message. Please try again later.'
      }
    });
  }
});

// Public contact form (no auth required)
const validatePublicContact = [
  body('email').trim().isEmail().withMessage('Valid email is required'),
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('subject').trim().notEmpty().withMessage('Subject is required'),
  body('message').trim().notEmpty().withMessage('Message is required'),
  body('type').optional().isIn(['feedback', 'support', 'bug', 'feature']).withMessage('Invalid type'),
];

router.post('/public-contact', validatePublicContact, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: {
          message: 'Validation failed',
          details: errors.array()
        }
      });
    }

    const { email, name, subject, message, type = 'support' } = req.body;

    logger.info('Support', `Public ${type} request from:`, email);

    await sendSupportEmail(email, name, subject, message, type);

    res.json({
      success: true,
      message: 'Your message has been sent successfully. We\'ll get back to you soon!'
    });
  } catch (error) {
    logger.error('Support', 'Error sending public support email:', error);
    res.status(500).json({
      error: {
        message: 'Failed to send message. Please try again later.'
      }
    });
  }
});

// Get support categories (for dropdown in form)
router.get('/categories', (req, res) => {
  res.json({
    categories: [
      { value: 'feedback', label: 'General Feedback', icon: '💬' },
      { value: 'support', label: 'Technical Support', icon: '🆘' },
      { value: 'bug', label: 'Report a Bug', icon: '🐛' },
      { value: 'feature', label: 'Feature Request', icon: '✨' }
    ]
  });
});

export default router;