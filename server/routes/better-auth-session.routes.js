import express from 'express';
import { auth } from '../config/better-auth.config.js';
import { getSessionByToken, getExpiredSessionByToken } from '../utils/better-auth-session.js';
import logger from '../utils/serverLogger.js';

const router = express.Router();

// Extend/refresh session endpoint
router.post('/extend-session', async (req, res) => {
  try {
    // Extract token from request
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') 
      ? authHeader.substring(7) 
      : req.cookies?.['better-auth.session_token'];
    
    if (!token) {
      return res.status(401).json({ 
        error: { message: 'No session token provided' } 
      });
    }
    
    logger.info('BetterAuth', 'Extending session for token:', token.substring(0, 20) + '...');
    
    // Try active session first, then expired (within 7-day grace period)
    let sessionData = await getSessionByToken(token);

    if (!sessionData || !sessionData.session) {
      // Session expired — try the 7-day grace window
      sessionData = await getExpiredSessionByToken(token);

      if (!sessionData || !sessionData.session) {
        logger.warn('BetterAuth', 'Session not found or beyond 7-day grace period');
        return res.status(401).json({
          error: { message: 'Session expired' }
        });
      }

      logger.info('BetterAuth', 'Expired session found within grace period, renewing');

      // Renew the expired session by updating expiresAt in the database
      try {
        const { default: pool } = await import('../utils/pgPool.js');
        const newExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
        await pool.query(
          `UPDATE session SET "expiresAt" = $1, "updatedAt" = NOW() WHERE token = $2`,
          [newExpiry, token]
        );
        sessionData.session.expiresAt = newExpiry;
        logger.info('BetterAuth', 'Session renewed successfully');
      } catch (renewError) {
        logger.error('BetterAuth', 'Failed to renew session:', renewError);
        return res.status(401).json({
          error: { message: 'Failed to renew session' }
        });
      }
    }

    // Return the session info with complete user data
    res.json({
      token: sessionData.session.token,
      sessionToken: sessionData.session.token,
      user: sessionData.user,
      expiresAt: sessionData.session.expiresAt
    });
    
  } catch (error) {
    logger.error('BetterAuth', 'Extend session error:', error);
    res.status(500).json({ 
      error: { message: 'Failed to extend session' } 
    });
  }
});

// Get session info
router.get('/session-info', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') 
      ? authHeader.substring(7) 
      : null;
    
    if (!token) {
      return res.json({ 
        isValid: false,
        message: 'No token provided'
      });
    }
    
    const sessionData = await getSessionByToken(token);
    
    if (!sessionData) {
      return res.json({ 
        isValid: false,
        message: 'Session not found'
      });
    }
    
    const now = new Date();
    const expiresAt = new Date(sessionData.session.expiresAt);
    const isExpired = now >= expiresAt;
    const hoursUntilExpiry = (expiresAt - now) / (1000 * 60 * 60);
    
    res.json({
      isValid: !isExpired,
      expiresAt: sessionData.session.expiresAt,
      hoursUntilExpiry: isExpired ? 0 : hoursUntilExpiry,
      shouldRefresh: hoursUntilExpiry < 24, // Refresh if less than 24 hours left
      userId: sessionData.user?.id
    });
    
  } catch (error) {
    logger.error('BetterAuth', 'Session info error:', error);
    res.json({ 
      isValid: false,
      message: 'Error checking session'
    });
  }
});

export default router;