import { fromNodeHeaders } from 'better-auth/node';
import { auth } from '../config/better-auth.config.js';
import jwt from 'jsonwebtoken';

// Middleware to handle both Better-Auth sessions and legacy JWT tokens during migration
export const betterAuthMiddleware = async (req, res, next) => {
  try {
    // First, try Better-Auth session
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });
    
    if (session) {
      // Better-Auth session found
      req.user = session.user;
      req.session = session.session;
      req.userId = session.user.id;
      req.authType = 'better-auth';
      return next();
    }
    
    // Fallback to legacy JWT during migration period
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.userId = decoded.userId;
        req.authType = 'legacy-jwt';
        
        // Log legacy auth usage for monitoring migration progress
        console.log(`[Auth] Legacy JWT used for user: ${decoded.userId}`);
        
        return next();
      } catch (jwtError) {
        // JWT is invalid or expired
        console.error('Legacy JWT error:', jwtError.message);
      }
    }
    
    // No valid authentication found
    return res.status(401).json({ 
      error: 'Authentication required',
      message: 'Please sign in to continue'
    });
    
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({ 
      error: 'Authentication error',
      message: 'Failed to verify authentication'
    });
  }
};

// Middleware specifically for Better-Auth only (no legacy fallback)
export const requireBetterAuth = async (req, res, next) => {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });
    
    if (!session) {
      return res.status(401).json({ 
        error: 'Authentication required',
        message: 'Please sign in using the new authentication system'
      });
    }
    
    req.user = session.user;
    req.session = session.session;
    req.userId = session.user.id;
    
    next();
  } catch (error) {
    console.error('Better-Auth middleware error:', error);
    return res.status(500).json({ 
      error: 'Authentication error',
      message: 'Failed to verify authentication'
    });
  }
};

// Helper to get user from either auth system
export const getCurrentUser = async (req) => {
  if (req.authType === 'better-auth') {
    return req.user;
  }
  
  // For legacy auth, fetch user from database
  if (req.authType === 'legacy-jwt' && req.userId) {
    const { getSupabase } = await import('../config/services.config.js');
    const supabase = getSupabase();
    
    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('id', req.userId)
      .single();
    
    return user;
  }
  
  return null;
};