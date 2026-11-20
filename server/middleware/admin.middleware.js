// Simple console logging for now

/**
 * Middleware to check if user is an admin
 */
const requireAdmin = async (req, res, next) => {
  try {
    // Check if user is authenticated first
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        error: {
          message: 'Authentication required',
          code: 'AUTH_REQUIRED'
        }
      });
    }

    // For now, we'll use a simple admin check
    // In production, this should check against a database field or role system
    const adminEmails = process.env.ADMIN_EMAILS ? process.env.ADMIN_EMAILS.split(',') : [];
    const adminUserIds = process.env.ADMIN_USER_IDS ? process.env.ADMIN_USER_IDS.split(',') : [];

    // Check if user is admin by email or ID
    const isAdminByEmail = adminEmails.includes(req.user.email);
    const isAdminById = adminUserIds.includes(req.user.id);
    
    // Also check if user has is_admin flag (from profiles table)
    const isAdminByFlag = req.user.is_admin === true;

    if (!isAdminByEmail && !isAdminById && !isAdminByFlag) {
      console.warn(`[Admin Middleware] Unauthorized admin access attempt by user ${req.user.id}`);
      return res.status(403).json({
        error: {
          message: 'Admin access required',
          code: 'ADMIN_REQUIRED'
        }
      });
    }

    // User is admin, proceed
    next();
  } catch (error) {
    console.error('[Admin Middleware] Error:', error);
    res.status(500).json({
      error: {
        message: 'Internal server error',
        code: 'ADMIN_CHECK_ERROR'
      }
    });
  }
};

/**
 * Middleware to check if user is admin (optional - doesn't block non-admins)
 * Adds isAdmin flag to req.user
 */
const checkAdmin = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      req.user = { ...req.user, isAdmin: false };
      return next();
    }

    const adminEmails = process.env.ADMIN_EMAILS ? process.env.ADMIN_EMAILS.split(',') : [];
    const adminUserIds = process.env.ADMIN_USER_IDS ? process.env.ADMIN_USER_IDS.split(',') : [];

    const isAdminByEmail = adminEmails.includes(req.user.email);
    const isAdminById = adminUserIds.includes(req.user.id);
    const isAdminByFlag = req.user.is_admin === true;

    req.user.isAdmin = isAdminByEmail || isAdminById || isAdminByFlag;
    
    next();
  } catch (error) {
    console.error('[Admin Middleware] Check admin error:', error);
    req.user.isAdmin = false;
    next();
  }
};

export {
  requireAdmin,
  checkAdmin
};