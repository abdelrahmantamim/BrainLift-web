import jwt from 'jsonwebtoken';
import { getSupabase } from '../config/services.config.js';

// Admin authentication middleware
// Admin dashboard still uses JWT tokens for now
export const requireAdminAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: { message: 'No token provided' } });
    }
    
    // Use JWT_SECRET from environment
    const JWT_SECRET = process.env.JWT_SECRET || process.env.BETTER_AUTH_SECRET;
    if (!JWT_SECRET) {
      console.error('[Admin Auth] No JWT_SECRET configured');
      return res.status(500).json({ error: { message: 'Server configuration error' } });
    }
    
    // Verify JWT token
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Check if this is an admin token
    if (!decoded.isAdmin) {
      return res.status(403).json({ error: { message: 'Admin access required' } });
    }
    
    // Verify admin still exists and is active
    const supabase = getSupabase();
    const { data: adminUser, error } = await supabase
      .from('admin_users')
      .select('*')
      .eq('id', decoded.userId)
      .eq('is_active', true)
      .single();
    
    if (error || !adminUser) {
      return res.status(403).json({ error: { message: 'Admin access revoked or not found' } });
    }
    
    // Attach admin info to request
    req.adminId = adminUser.id;
    req.adminEmail = adminUser.email;
    req.adminRole = adminUser.role || 'admin';
    req.admin = adminUser;
    
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: { message: 'Invalid token' } });
    } else if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: { message: 'Token expired' } });
    }
    
    console.error('[Admin Auth] Middleware error:', error);
    return res.status(401).json({ error: { message: 'Authentication failed' } });
  }
};

// Session-based admin check for in-app routes that authenticate the end user via
// a Better Auth session (requireAuth ran first, so req.user.email is populated).
// Authorizes against the admin_users table — NOT an email suffix. Merely owning
// an "@getbrainlift.app" address is not sufficient; the email must be a known,
// active admin.
export const requireSessionAdmin = async (req, res, next) => {
  try {
    const email = req.user?.email;
    if (!email) {
      return res.status(401).json({ error: { message: 'Authentication required' } });
    }
    const supabase = getSupabase();
    const { data: adminUser, error } = await supabase
      .from('admin_users')
      .select('id')
      .eq('email', email)
      .eq('is_active', true)
      .single();
    if (error || !adminUser) {
      return res.status(403).json({ error: { message: 'Admin access required' } });
    }
    return next();
  } catch (err) {
    console.error('[Admin Auth] session admin check failed:', err);
    return res.status(500).json({ error: { message: 'Authorization error' } });
  }
};