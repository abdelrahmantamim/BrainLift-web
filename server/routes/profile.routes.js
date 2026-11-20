import express from 'express';
import pool from '../utils/pgPool.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { syncUserToSupabase } from '../middleware/syncUser.middleware.js';

const router = express.Router();

// Change password endpoint
router.post('/change-password', requireAuth, syncUserToSupabase, async (req, res) => {
  console.log('[Profile] Change password request for user:', req.userId);
  
  try {
    // Check if user has OAuth accounts linked (OAuth users cannot change password)
    const oauthAccountResult = await pool.query(
      'SELECT id FROM "account" WHERE "userId" = $1 AND "providerId" IN ($2, $3)',
      [req.user.id, 'google', 'apple']
    );
    
    if (oauthAccountResult.rows.length > 0) {
      console.log('[Profile] OAuth user attempted to change password:', req.user.id);
      return res.status(400).json({ 
        error: { 
          message: 'Password change is not available for users who signed in with Apple, Google, or other social providers. Please use your social provider to manage your password.' 
        } 
      });
    }

    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ 
        error: { message: 'Current password and new password are required' } 
      });
    }
    
    // Password validation
    if (newPassword.length < 8) {
      return res.status(400).json({ 
        error: { message: 'New password must be at least 8 characters long' } 
      });
    }
    
    // First, try using Better Auth's native changePassword API
    // NOTE: As of 2025-01-18, Better Auth's changePassword API has session validation issues
    // It fails with UNAUTHORIZED even with valid sessions. The workaround below handles this.
    console.log('[Profile] Attempting native Better Auth changePassword...');
    
    try {
      const { auth } = await import('../config/better-auth.config.js');
      
      // Get the session token from the request
      const authHeader = req.headers.authorization;
      const token = authHeader?.startsWith('Bearer ') 
        ? authHeader.substring(7) 
        : null;
      
      if (!token) {
        throw new Error('No session token found');
      }
      
      // Use Better Auth's changePassword API
      const result = await auth.api.changePassword({
        body: {
          currentPassword: currentPassword,
          newPassword: newPassword,
          revokeOtherSessions: false
        },
        headers: {
          cookie: `better-auth.session_token=${token}`
        },
        asResponse: false
      });
      
      console.log('[Profile] Password changed successfully using native API');
      
      // SECURITY: Invalidate all sessions for this user except the current one
      try {
        const currentSessionToken = token;
        
        // Get current session ID
        const currentSessionResult = await pool.query(
          'SELECT id FROM session WHERE token = $1',
          [currentSessionToken]
        );
        
        const currentSessionId = currentSessionResult.rows[0]?.id;
        
        // Delete all other sessions for this user
        const deleteResult = await pool.query(
          'DELETE FROM session WHERE "userId" = $1 AND id != $2',
          [req.user.id, currentSessionId || '']
        );
        
        console.log(`[Profile] Invalidated ${deleteResult.rowCount} other sessions after password change`);
        
      } catch (sessionError) {
        console.error('[Profile] Failed to invalidate other sessions:', sessionError);
        // Don't fail the password change if session invalidation fails
      }
      
      return res.json({ 
        success: true, 
        message: 'Password changed successfully. Other sessions have been logged out.'
      });
      
    } catch (nativeError) {
      console.error('[Profile] Native changePassword failed:', nativeError.message);
      console.log('[Profile] Falling back to workaround method...');
      
      // FALLBACK: If native API fails, use the workaround method
      // This creates temporary users to verify and create password hashes
      
      // Get current password hash from account table
      const accountResult = await pool.query(
        'SELECT password FROM account WHERE "userId" = $1 AND "providerId" = $2',
        [req.user.id, 'credential']
      );
      
      if (accountResult.rows.length === 0) {
        return res.status(400).json({ 
          error: { message: 'No password account found' } 
        });
      }
      
      const storedPassword = accountResult.rows[0].password;
      
      // Since Better Auth password verification is complex, we'll use a workaround
      // Create a temporary user to verify the password works
      console.log('[Profile] Verifying current password...');
      
      try {
        // Try to sign in with current credentials to verify password
        const { auth } = await import('../config/better-auth.config.js');
        
        // Get user email
        const userResult = await pool.query(
          'SELECT email FROM "user" WHERE id = $1',
          [req.user.id]
        );
        
        if (userResult.rows.length === 0) {
          return res.status(404).json({ 
            error: { message: 'User not found' } 
          });
        }
        
        const userEmail = userResult.rows[0].email;
        
        // Attempt sign in to verify current password
        try {
          await auth.api.signInEmail({
            body: {
              email: userEmail,
              password: currentPassword
            },
            asResponse: false
          });
          
          console.log('[Profile] Current password verified');
        } catch (signInError) {
          console.log('[Profile] Current password verification failed');
          return res.status(400).json({ 
            error: { message: 'Current password is incorrect' } 
          });
        }
        
      } catch (error) {
        console.error('[Profile] Password verification error:', error);
        return res.status(500).json({ 
          error: { message: 'Failed to verify password' } 
        });
      }
      
      // Create a new password hash using Better Auth
      // We need to create a temporary user to get a valid password hash
      console.log('[Profile] Creating new password hash...');
      
      try {
        const { auth } = await import('../config/better-auth.config.js');
        const tempEmail = `temp-pwd-${Date.now()}@example.com`;
        
        // Create temporary user with new password
        const tempUser = await auth.api.signUpEmail({
          body: {
            email: tempEmail,
            password: newPassword,
            name: 'Temp User'
          },
          asResponse: false
        });
        
        // Get the password hash
        const hashResult = await pool.query(
          'SELECT password FROM account WHERE "userId" = $1 AND "providerId" = $2',
          [tempUser.user.id, 'credential']
        );
        
        if (hashResult.rows.length === 0) {
          throw new Error('Could not get password hash');
        }
        
        const newPasswordHash = hashResult.rows[0].password;
        
        // Update user's password
        await pool.query(
          'UPDATE account SET password = $1, "updatedAt" = NOW() WHERE "userId" = $2 AND "providerId" = $3',
          [newPasswordHash, req.user.id, 'credential']
        );
        
        // Clean up temporary user
        await pool.query('DELETE FROM session WHERE "userId" = $1', [tempUser.user.id]);
        await pool.query('DELETE FROM account WHERE "userId" = $1', [tempUser.user.id]);
        await pool.query('DELETE FROM "user" WHERE id = $1', [tempUser.user.id]);
        
        console.log('[Profile] Password hash created and updated');
        
      } catch (error) {
        console.error('[Profile] Failed to create new password hash:', error);
        return res.status(500).json({ 
          error: { message: 'Failed to update password' } 
        });
      }
      
      console.log('[Profile] Password changed successfully using workaround');
      
      // SECURITY: Invalidate all sessions for this user except the current one
      try {
        const currentSessionToken = req.headers.authorization?.substring(7); // Remove 'Bearer '
        
        // Get current session ID
        const currentSessionResult = await pool.query(
          'SELECT id FROM session WHERE token = $1',
          [currentSessionToken]
        );
        
        const currentSessionId = currentSessionResult.rows[0]?.id;
        
        // Delete all other sessions for this user
        const deleteResult = await pool.query(
          'DELETE FROM session WHERE "userId" = $1 AND id != $2',
          [req.user.id, currentSessionId || '']
        );
        
        console.log(`[Profile] Invalidated ${deleteResult.rowCount} other sessions after password change`);
        
      } catch (sessionError) {
        console.error('[Profile] Failed to invalidate other sessions:', sessionError);
        // Don't fail the password change if session invalidation fails
      }
      
      return res.json({ 
        success: true, 
        message: 'Password changed successfully. Other sessions have been logged out.'
      });
    }
    
  } catch (error) {
    console.error('[Profile] Change password error:', error);
    res.status(500).json({ 
      error: { message: 'Failed to change password' } 
    });
  }
});

// Get user profile
router.get('/me', requireAuth, syncUserToSupabase, async (req, res) => {
  try {
    // Get profile data using email join
    const profileResult = await pool.query(
      `SELECT p.*, u.email, u.name, u.id 
       FROM profiles p 
       JOIN "user" u ON p.email = u.email
       WHERE u.id = $1`,
      [req.user.id]
    );
    
    if (profileResult.rows.length === 0) {
      return res.status(404).json({ 
        error: { message: 'Profile not found' } 
      });
    }
    
    const profile = profileResult.rows[0];
    
    res.json({
      id: profile.id,
      email: profile.email,
      name: profile.name,
      username: profile.full_name,
      avatar_url: profile.avatar_url,
      student_type: profile.student_type,
      chat_background_url: profile.chat_background_url,
      created_at: profile.created_at,
      updated_at: profile.updated_at
    });
    
  } catch (error) {
    console.error('[Profile] Get profile error:', error);
    res.status(500).json({ 
      error: { message: 'Failed to get profile' } 
    });
  }
});

// Update user profile
router.patch('/me', requireAuth, syncUserToSupabase, async (req, res) => {
  try {
    const { name, username, avatar_url } = req.body;
    const updates = [];
    const values = [];
    let paramCount = 1;
    
    if (name !== undefined) {
      updates.push(`name = $${paramCount}`);
      values.push(name);
      paramCount++;
    }
    
    if (username !== undefined) {
      updates.push(`username = $${paramCount}`);
      values.push(username);
      paramCount++;
    }
    
    if (avatar_url !== undefined) {
      updates.push(`avatar_url = $${paramCount}`);
      values.push(avatar_url);
      paramCount++;
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ 
        error: { message: 'No fields to update' } 
      });
    }
    
    updates.push(`updated_at = NOW()`);
    values.push(req.user.email);
    
    // Update profile using email
    await pool.query(
      `UPDATE profiles SET ${updates.join(', ')} WHERE email = $${paramCount}`,
      values
    );
    
    // Also update user table if name was changed
    if (name !== undefined) {
      await pool.query(
        'UPDATE "user" SET name = $1, "updatedAt" = NOW() WHERE id = $2',
        [name, req.user.id]
      );
    }
    
    res.json({ 
      success: true,
      message: 'Profile updated successfully'
    });
    
  } catch (error) {
    console.error('[Profile] Update profile error:', error);
    res.status(500).json({ 
      error: { message: 'Failed to update profile' } 
    });
  }
});

export default router;