// Auth middleware for Better Auth (ESM version)
// Uses custom session retrieval as workaround for Better Auth getSession issues

import { auth } from '../config/better-auth.config.js';
import logger from '../utils/serverLogger.js';
import { getSessionByToken, getExpiredSessionByToken, extractToken } from '../utils/better-auth-session.js';

// Main auth middleware using Better Auth's session management
export const authMiddleware = async (req, res, next) => {
  try {
    // Extract token from request
    const token = extractToken(req);
    
    if (!token) {
      return res.status(401).json({ 
        error: { message: 'Authentication required' } 
      });
    }
    
    // Use custom session retrieval as workaround
    const sessionData = await getSessionByToken(token);
    
    if (!sessionData || !sessionData.user) {
      return res.status(401).json({ 
        error: { message: 'Invalid or expired session' } 
      });
    }
    
    // Set user and session on request
    req.user = sessionData.user;
    req.session = sessionData.session;
    req.userId = sessionData.user.id; // For backwards compatibility
    
    next();
  } catch (error) {
    console.error('[Auth] Middleware error:', error);
    return res.status(500).json({ 
      error: { message: 'Authentication error' } 
    });
  }
};

// Wrapper for requireAuth to maintain compatibility
export const requireAuth = authMiddleware;

// Wrapper for requireAuthForRefresh
// Accepts expired sessions so that token refresh can work when the session just expired
export const requireAuthForRefresh = async (req, res, next) => {
  try {
    const token = extractToken(req);

    if (!token) {
      return res.status(401).json({
        error: { message: 'Authentication required' }
      });
    }

    // First try normal session lookup (non-expired)
    let sessionData = await getSessionByToken(token);

    if (!sessionData || !sessionData.user) {
      // Fall back: look up session even if expired (within 7 day grace period)
      sessionData = await getExpiredSessionByToken(token);
    }

    if (!sessionData || !sessionData.user) {
      return res.status(401).json({
        error: { message: 'Invalid or expired session' }
      });
    }

    req.user = sessionData.user;
    req.session = sessionData.session;
    req.userId = sessionData.user.id;

    next();
  } catch (error) {
    console.error('[Auth] RefreshAuth middleware error:', error);
    return res.status(500).json({
      error: { message: 'Authentication error' }
    });
  }
};

// Admin authentication middleware
export const adminAuthMiddleware = async (req, res, next) => {
  try {
    // First validate the session
    await requireAuth(req, res, (err) => {
      if (err) return next(err);
      
      // Check if user has admin role
      if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ 
          error: { message: 'Admin access required' } 
        });
      }
      
      next();
    });
  } catch (error) {
    console.error('[AdminAuth] Error:', error);
    res.status(401).json({ error: { message: 'Authentication failed' } });
  }
};

// Compatibility aliases
export const strictAuthMiddleware = requireAuth;