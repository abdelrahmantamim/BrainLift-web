// Better Auth routes wrapper
import express from 'express';
import { auth } from '../config/better-auth.config.js';
import logger from '../utils/serverLogger.js';
import { getSessionByToken } from '../utils/better-auth-session.js';
import { detectPlatform, tagSessionPlatform } from '../utils/session-platform.js';
import { trackDeviceFingerprint } from '../middleware/deviceFingerprint.middleware.js';
import { validate } from '../middleware/validate.js';
import { signUpSchema, signInSchema } from '../schemas/auth.schemas.js';

const router = express.Router();

// Debug middleware
router.use((req, res, next) => {
  console.log('[BetterAuth Router] Request:', req.method, req.path);
  next();
});

// Sign up endpoint
router.post('/sign-up/email', validate(signUpSchema), async (req, res) => {
  try {
    logger.info('BetterAuth', 'Sign up request', { email: req.body?.email });

    const result = await auth.api.signUpEmail({
      body: req.body,
      asResponse: false
    });

    logger.info('BetterAuth', 'Sign up result', { userId: result?.user?.id, hasToken: !!result?.token });

    // Track device fingerprint after successful signup
    if (result.user && result.user.id) {
      req.user = result.user;
      req.userId = result.user.id;
      await trackDeviceFingerprint(req, res, () => {});

      // Send welcome email
      try {
        const { sendWelcomeEmail } = await import('../services/email.service.js');
        await sendWelcomeEmail(result.user.email, result.user.name);
        logger.info('BetterAuth', 'Welcome email sent to:', result.user.email);
      } catch (emailError) {
        logger.error('BetterAuth', 'Failed to send welcome email:', emailError);
        // Don't fail the signup if email fails
      }
    }

    // Ensure token is at the top level (signUpEmail returns { user, session } but client expects { user, token })
    const response = { ...result };
    if (!response.token && response.session?.token) {
      response.token = response.session.token;
    }

    // Tag the session with the originating platform (derived from Origin header).
    if (response.token) {
      await tagSessionPlatform(response.token, detectPlatform(req));
    }

    res.json(response);
  } catch (error) {
    logger.error('BetterAuth', 'Sign up error:', error);
    res.status(400).json({
      error: {
        message: error.message || 'Sign up failed'
      }
    });
  }
});

// Sign in endpoint
router.post('/sign-in/email', validate(signInSchema), async (req, res) => {
  try {
    logger.info('BetterAuth', 'Sign in request', { email: req.body?.email });

    const result = await auth.api.signInEmail({
      body: req.body,
      asResponse: false
    });

    logger.info('BetterAuth', 'Sign in result', { userId: result?.user?.id, hasToken: !!result?.token });

    // Set the session cookie
    if (result.token) {
      res.cookie('better-auth.session_token', result.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        path: '/'
      });
    }

    // Tag the session with the originating platform (derived from Origin header).
    if (result.token) {
      await tagSessionPlatform(result.token, detectPlatform(req));
    }

    // Enhance the user data with profile information
    if (result.user && result.user.id) {
      const sessionData = await getSessionByToken(result.token);
      if (sessionData && sessionData.user) {
        result.user = sessionData.user;
      }

      // Track device fingerprint after successful login
      req.user = result.user;
      req.userId = result.user.id;
      await trackDeviceFingerprint(req, res, () => {});
    }

    res.json(result);
  } catch (error) {
    logger.error('BetterAuth', 'Sign in error:', error);
    console.error('[BetterAuth Sign-in] Full error:', error);
    console.error('[BetterAuth Sign-in] Error stack:', error.stack);
    res.status(400).json({
      error: {
        message: error.message || 'Sign in failed'
      }
    });
  }
});

// Get session endpoint (using workaround)
router.get('/get-session', async (req, res) => {
  try {
    // Extract token from header or cookie
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.substring(7)
      : req.cookies?.['better-auth.session_token'];

    if (!token) {
      return res.json(null);
    }

    // Use workaround to get session
    const sessionData = await getSessionByToken(token);

    if (!sessionData) {
      return res.json(null);
    }

    // Return in Better Auth format
    res.json({
      token: sessionData.session.token,
      user: sessionData.user,
      session: {
        id: sessionData.session.id,
        token: sessionData.session.token,
        userId: sessionData.session.userId,
        expiresAt: sessionData.session.expiresAt,
        platform: sessionData.session.platform || 'mobile',
      }
    });
  } catch (error) {
    logger.error('BetterAuth', 'Get session error:', error);
    res.status(500).json({
      error: {
        message: 'Failed to get session'
      }
    });
  }
});

// Get current user endpoint (me)
router.get('/me', async (req, res) => {
  try {
    // Extract token
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.substring(7)
      : req.cookies?.['better-auth.session_token'];

    if (!token) {
      return res.status(401).json({
        error: { message: 'Not authenticated' }
      });
    }

    // Get session data using our custom function
    const sessionData = await getSessionByToken(token);

    if (!sessionData || !sessionData.user) {
      return res.status(401).json({
        error: { message: 'Invalid session' }
      });
    }

    // Return user data with profile information
    res.json({
      user: sessionData.user
    });
  } catch (error) {
    logger.error('BetterAuth', 'Get me error:', error);
    res.status(500).json({
      error: {
        message: 'Failed to get user'
      }
    });
  }
});

// Sign out endpoint
router.post('/sign-out', async (req, res) => {
  try {
    // Extract token
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.substring(7)
      : req.cookies?.['better-auth.session_token'];

    if (token) {
      // Call Better Auth sign out
      await auth.api.signOut({
        headers: {
          cookie: `better-auth.session_token=${token}`
        },
        asResponse: false
      });

      // Add small delay to ensure database cleanup completes
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    // Clear cookie
    res.clearCookie('better-auth.session_token');
    res.json({ success: true });
  } catch (error) {
    logger.error('BetterAuth', 'Sign out error:', error);
    // Always return success for sign out, but still clear cookie
    res.clearCookie('better-auth.session_token');
    res.json({ success: true });
  }
});

// Forgot password endpoint
// Route path kept as /forget-password for web + mobile clients; Better Auth
// renamed the server API from `forgetPassword` to `requestPasswordReset` in 1.6.x.
router.post('/forget-password', async (req, res) => {
  try {
    const result = await auth.api.requestPasswordReset({
      body: req.body,
      asResponse: false
    });

    res.json(result || { success: true });
  } catch (error) {
    logger.error('BetterAuth', 'Forget password error:', error);
    res.status(400).json({
      error: {
        message: error.message || 'Failed to send reset email'
      }
    });
  }
});

// Reset password endpoint
router.post('/reset-password', async (req, res) => {
  try {
    const result = await auth.api.resetPassword({
      body: req.body,
      asResponse: false
    });

    res.json(result || { success: true });
  } catch (error) {
    logger.error('BetterAuth', 'Reset password error:', error);
    res.status(400).json({
      error: {
        message: error.message || 'Failed to reset password'
      }
    });
  }
});

// Change password endpoint with fallback
router.post('/change-password', async (req, res) => {
  console.log('[BetterAuth] Change password request');

  try {
    // Extract token from request
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.substring(7)
      : req.cookies?.['better-auth.session_token'];

    if (!token) {
      console.error('[BetterAuth] No session token found');
      return res.status(401).json({
        error: { message: 'Not authenticated' }
      });
    }

    // Get session to verify user
    const sessionData = await getSessionByToken(token);
    if (!sessionData || !sessionData.user) {
      return res.status(401).json({
        error: { message: 'Invalid session' }
      });
    }

    const userId = sessionData.user.id;
    console.log('[BetterAuth] Changing password for user:', userId);

    // Import required modules for password hashing
    const crypto = (await import('crypto')).default;
    const { scrypt } = await import('@noble/hashes/scrypt');
    const { bytesToHex } = await import('@noble/hashes/utils');
    const { default: pool } = await import('../utils/pgPool.js');

    // Check if user has OAuth accounts linked (OAuth users cannot change password)
    const oauthAccountResult = await pool.query(
      'SELECT id FROM "account" WHERE "userId" = $1 AND "providerId" IN ($2, $3)',
      [userId, 'google', 'apple']
    );

    if (oauthAccountResult.rows.length > 0) {
      console.log('[BetterAuth] OAuth user attempted to change password:', userId);
      return res.status(400).json({
        error: {
          message: 'Password change is not available for users who signed in with Apple, Google, or other social providers. Please use your social provider to manage your password.'
        }
      });
    }

    // First verify current password
    const accountResult = await pool.query(
      'SELECT password FROM account WHERE "userId" = $1 AND "providerId" = $2',
      [userId, 'credential']
    );

    if (accountResult.rows.length === 0) {
      return res.status(400).json({
        error: { message: 'No password account found' }
      });
    }

    const storedPassword = accountResult.rows[0].password;

    // Verify current password
    let isValidPassword = false;

    if (storedPassword) {
      if (storedPassword.startsWith('s2:')) {
        // New format: s2:salt:hash
        const [, salt, hash] = storedPassword.split(':');
        const key = scrypt(req.body.currentPassword, salt, { N: 16384, r: 8, p: 1, dkLen: 64 });
        const inputHash = bytesToHex(key);
        isValidPassword = (inputHash === hash);
      } else if (storedPassword.includes(':')) {
        // Old format: salt:hash
        const [salt, hash] = storedPassword.split(':');
        const key = scrypt(req.body.currentPassword, salt, { N: 16384, r: 8, p: 1, dkLen: 64 });
        const inputHash = bytesToHex(key);
        isValidPassword = (inputHash === hash);
      }
    }

    if (!isValidPassword) {
      return res.status(400).json({
        error: { message: 'Current password is incorrect' }
      });
    }

    // Hash new password
    const newSalt = crypto.randomBytes(16).toString('hex');
    const newKey = scrypt(req.body.newPassword, newSalt, { N: 16384, r: 8, p: 1, dkLen: 64 });
    const newHash = bytesToHex(newKey);
    const newPasswordHash = `s2:${newSalt}:${newHash}`;

    // Update password
    await pool.query(
      'UPDATE account SET password = $1, "updatedAt" = NOW() WHERE "userId" = $2 AND "providerId" = $3',
      [newPasswordHash, userId, 'credential']
    );

    console.log('[BetterAuth] Password changed successfully');

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('[BetterAuth] Change password error:', error);
    res.status(500).json({
      error: { message: 'Failed to change password' }
    });
  }
});

// Update user endpoint
router.patch('/update-user', async (req, res) => {
  try {
    // Extract token
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.substring(7)
      : req.cookies?.['better-auth.session_token'];

    const result = await auth.api.updateUser({
      body: req.body,
      headers: {
        cookie: `better-auth.session_token=${token}`
      },
      asResponse: false
    });

    res.json(result);
  } catch (error) {
    logger.error('BetterAuth', 'Update user error:', error);
    res.status(400).json({
      error: {
        message: error.message || 'Failed to update user'
      }
    });
  }
});

export default router;
