import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { getSupabase } from '../config/services.config.js';
import { validate } from '../middleware/validate.js';
import { adminLoginSchema } from '../schemas/auth.schemas.js';

const router = express.Router();

// Admin login endpoint
router.post('/login', validate(adminLoginSchema), async (req, res) => {
  try {
    const { email, password } = req.body;

    const supabase = getSupabase();

    // Check if user exists in admin_users table
    const { data: adminUser, error } = await supabase
      .from('admin_users')
      .select('id, email, password_hash, is_active, name')
      .eq('email', email)
      .single();

    if (error || !adminUser) {
      console.log('[Admin Auth] Admin user not found:', email);
      return res.status(401).json({
        error: { message: 'Invalid credentials' }
      });
    }

    // Check if admin is active
    if (!adminUser.is_active) {
      console.log('[Admin Auth] Inactive admin login attempt:', email);
      return res.status(403).json({
        error: { message: 'Account is inactive. Please contact support.' }
      });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, adminUser.password_hash);
    if (!isValidPassword) {
      console.log('[Admin Auth] Invalid password for:', email);
      return res.status(401).json({
        error: { message: 'Invalid credentials' }
      });
    }

    // Generate admin JWT token
    const token = jwt.sign(
      {
        userId: adminUser.id,
        email: adminUser.email,
        role: 'admin', // All admin_users are admins
        isAdmin: true
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Update last login
    await supabase
      .from('admin_users')
      .update({ last_login: new Date().toISOString() })
      .eq('id', adminUser.id);

    console.log('[Admin Auth] Successful login:', email);

    res.json({
      success: true,
      token,
      user: {
        id: adminUser.id,
        email: adminUser.email,
        name: adminUser.name,
        role: 'admin'
      }
    });
  } catch (error) {
    console.error('[Admin Auth] Login error:', error);
    res.status(500).json({
      error: { message: 'Internal server error' }
    });
  }
});

// Admin logout endpoint
router.post('/logout', (req, res) => {
  // Client should clear the token
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

// Check admin session
router.get('/check', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: { message: 'No token provided' }
      });
    }

    const token = authHeader.substring(7);

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      if (!decoded.isAdmin || decoded.role !== 'admin') {
        return res.status(403).json({
          error: { message: 'Invalid admin token' }
        });
      }

      res.json({
        success: true,
        user: {
          id: decoded.userId,
          email: decoded.email,
          role: decoded.role
        }
      });
    } catch (jwtError) {
      return res.status(401).json({
        error: { message: 'Invalid or expired token' }
      });
    }
  } catch (error) {
    console.error('[Admin Auth] Check error:', error);
    res.status(500).json({
      error: { message: 'Internal server error' }
    });
  }
});

// Refresh admin token
router.post('/refresh', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: { message: 'No token provided' }
      });
    }

    const token = authHeader.substring(7);

    try {
      // Verify token even if expired to get the payload
      const decoded = jwt.verify(token, process.env.JWT_SECRET, { ignoreExpiration: true });

      if (!decoded.isAdmin || decoded.role !== 'admin') {
        return res.status(403).json({
          error: { message: 'Invalid admin token' }
        });
      }

      const supabase = getSupabase();

      // Verify admin still exists and is active
      const { data: adminUser, error } = await supabase
        .from('admin_users')
        .select('*')
        .eq('id', decoded.userId)
        .eq('is_active', true)
        .single();

      if (error || !adminUser) {
        return res.status(403).json({
          error: { message: 'Admin access revoked or not found' }
        });
      }

      // Generate new token
      const newToken = jwt.sign(
        {
          userId: adminUser.id,
          email: adminUser.email,
          role: 'admin',
          isAdmin: true
        },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );

      res.json({
        success: true,
        token: newToken,
        user: {
          id: adminUser.id,
          email: adminUser.email,
          name: adminUser.name,
          role: 'admin'
        }
      });
    } catch (jwtError) {
      return res.status(401).json({
        error: { message: 'Invalid token' }
      });
    }
  } catch (error) {
    console.error('[Admin Auth] Refresh error:', error);
    res.status(500).json({
      error: { message: 'Internal server error' }
    });
  }
});

export default router;
