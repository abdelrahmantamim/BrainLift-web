// Better Auth Session Workaround
// Handles session retrieval directly from database since Better Auth's getSession has issues

import pool from './pgPool.js';
import logger from './serverLogger.js';

/**
 * Get session and user data by token
 * This is a workaround for Better Auth's getSession returning null
 * @param {string} token - Session token
 * @returns {Promise<{user: Object, session: Object}|null>}
 */
export async function getSessionByToken(token) {
  if (!token) return null;
  
  try {
    // Get session from database
    const sessionResult = await pool.query(
      `SELECT * FROM session WHERE token = $1 AND "expiresAt" > NOW()`,
      [token]
    );
    
    if (sessionResult.rows.length === 0) {
      return null;
    }
    
    const session = sessionResult.rows[0];
    
    // Get user data with profile information
    const userResult = await pool.query(
      `SELECT u.*, p.avatar_url, p.full_name, p.student_type, p.chat_background_url
       FROM "user" u 
       LEFT JOIN profiles p ON u.email = p.email 
       WHERE u.id = $1`,
      [session.userId]
    );
    
    if (userResult.rows.length === 0) {
      return null;
    }
    
    const user = userResult.rows[0];
    
    // Return in Better Auth format with profile data
    // Prioritize profile full_name over user name, as profile is updated more frequently
    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.full_name || user.name, // Use profile full_name if available, fallback to user.name
        image: user.image || user.avatar_url, // Fallback to avatar_url if image is not set
        avatar_url: user.avatar_url,
        username: user.full_name || user.name, // Use full_name as username
        student_type: user.student_type || 'high_school', // Default to high_school if not set
        chat_background_url: user.chat_background_url,
        emailVerified: user.emailVerified,
        role: user.role,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      session: {
        id: session.id,
        userId: session.userId,
        expiresAt: session.expiresAt,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        token: session.token,
        platform: session.platform || 'mobile',
      }
    };
  } catch (error) {
    logger.error('SessionWorkaround', 'Error getting session:', error);
    return null;
  }
}

/**
 * Get session and user data by token, even if session is expired (within 1 day grace period).
 * Used by requireAuthForRefresh to allow token refresh for recently-expired sessions.
 * @param {string} token - Session token
 * @returns {Promise<{user: Object, session: Object}|null>}
 */
export async function getExpiredSessionByToken(token) {
  if (!token) return null;

  try {
    const sessionResult = await pool.query(
      `SELECT * FROM session WHERE token = $1 AND "expiresAt" > NOW() - INTERVAL '1 day'`,
      [token]
    );

    if (sessionResult.rows.length === 0) {
      return null;
    }

    const session = sessionResult.rows[0];

    const userResult = await pool.query(
      `SELECT u.*, p.avatar_url, p.full_name, p.student_type, p.chat_background_url
       FROM "user" u
       LEFT JOIN profiles p ON u.email = p.email
       WHERE u.id = $1`,
      [session.userId]
    );

    if (userResult.rows.length === 0) {
      return null;
    }

    const user = userResult.rows[0];

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.full_name || user.name,
        image: user.image || user.avatar_url,
        avatar_url: user.avatar_url,
        username: user.full_name || user.name,
        student_type: user.student_type || 'high_school',
        chat_background_url: user.chat_background_url,
        emailVerified: user.emailVerified,
        role: user.role,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      session: {
        id: session.id,
        userId: session.userId,
        expiresAt: session.expiresAt,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        token: session.token,
        platform: session.platform || 'mobile',
      }
    };
  } catch (error) {
    logger.error('SessionWorkaround', 'Error getting expired session:', error);
    return null;
  }
}

/**
 * Extract token from request
 * @param {Object} req - Express request object
 * @returns {string|null} Token or null
 */
export function extractToken(req) {
  // Check cookie first
  if (req.cookies && req.cookies['better-auth.session_token']) {
    return req.cookies['better-auth.session_token'];
  }
  
  // Check Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  
  return null;
}

export default {
  getSessionByToken,
  getExpiredSessionByToken,
  extractToken
};