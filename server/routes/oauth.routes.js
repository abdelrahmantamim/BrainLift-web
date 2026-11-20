import express from 'express';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import authPool from '../utils/pgPool.js';
import appleSignin from 'apple-signin-auth';
import { getSupabase } from '../config/services.config.js';
import { OAuth2Client } from 'google-auth-library';
import { detectPlatform } from '../utils/session-platform.js';

// Valid Google OAuth audiences (client IDs). A token is accepted if its `aud`
// matches any configured client ID. Credentials are provisioned per-platform.
function getGoogleAudiences() {
  return [
    process.env.GOOGLE_CLIENT_ID,
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
  ].filter(Boolean);
}

const router = express.Router();

// Helper: ensure auth_id_mapping exists for OAuth users so syncUserToSupabase resolves correctly
async function ensureAuthIdMapping(betterAuthId, supabaseUuid) {
  try {
    const existing = await authPool.query(
      'SELECT uuid FROM auth_id_mapping WHERE better_auth_id = $1',
      [betterAuthId]
    );
    if (existing.rows.length === 0) {
      await authPool.query(
        'INSERT INTO auth_id_mapping (better_auth_id, uuid) VALUES ($1, $2) ON CONFLICT (better_auth_id) DO NOTHING',
        [betterAuthId, supabaseUuid]
      );
      console.log(`[OAuth] Created auth_id_mapping: ${betterAuthId} -> ${supabaseUuid}`);
    }
  } catch (error) {
    console.error('[OAuth] Failed to create auth_id_mapping:', error.message);
  }
}

// Apple Sign-In for mobile apps
router.post('/apple/mobile', async (req, res) => {
  try {
    const { identityToken, fullName } = req.body;
    
    console.log('[OAuth] Apple Sign-In request for mobile');
    
    if (!identityToken) {
      return res.status(400).json({
        error: { message: 'Identity token is required' }
      });
    }

    // Cryptographically verify the identity token against Apple's public keys.
    // The audience MUST be our server-configured client/bundle ID; never trust
    // identity claims from the request body.
    if (!process.env.APPLE_CLIENT_ID) {
      console.error('[OAuth] APPLE_CLIENT_ID is not configured');
      return res.status(500).json({ error: { message: 'Apple Sign-In is not configured' } });
    }

    let decoded;
    try {
      decoded = await appleSignin.verifyIdToken(identityToken, {
        audience: process.env.APPLE_CLIENT_ID,
        ignoreExpiration: false,
      });
    } catch {
      console.log('[OAuth] Apple token verification failed');
      return res.status(401).json({ error: { message: 'Invalid Apple identity token' } });
    }

    // Identity is taken ONLY from the verified payload. `sub` is the stable
    // identifier; Apple may omit `email` on repeat logins, so existing users
    // are resolved by sub via the linked `account` row — NEVER by a
    // client-supplied email (that would allow account takeover).
    const userId = decoded.sub; // Apple user ID (stable)
    const userEmail = decoded.email; // verified email; may be absent on repeat logins

    if (!userId) {
      return res.status(400).json({
        error: { message: 'Apple token missing required claims' }
      });
    }

    let dbUserId;
    let isNewUser = false;

    // 1) Resolve by the stable Apple sub (covers repeat logins without email).
    const linkedAccount = await authPool.query(
      'SELECT "userId" FROM "account" WHERE "providerId" = $1 AND "accountId" = $2',
      ['apple', userId]
    );
    if (linkedAccount.rows.length > 0) {
      dbUserId = linkedAccount.rows[0].userId;
    } else if (userEmail) {
      // 2) Fall back to the VERIFIED email (first login, or pre-link accounts).
      const userRecord = await authPool.query(
        'SELECT id FROM "user" WHERE email = $1',
        [userEmail]
      );
      if (userRecord.rows.length > 0) {
        dbUserId = userRecord.rows[0].id;
      }
    }

    if (!dbUserId) {
      if (!userEmail) {
        // No linked account and no verified email — cannot safely resolve or
        // create an identity for this token.
        return res.status(400).json({
          error: { message: 'Apple did not provide an email for this account' }
        });
      }

      // Create new user
      dbUserId = uuidv4();
      isNewUser = true;

      // Extract name from fullName object
      let displayName = userEmail.split('@')[0];
      if (fullName?.givenName || fullName?.familyName) {
        displayName = [fullName.givenName, fullName.familyName].filter(Boolean).join(' ');
      }

      await authPool.query(
        'INSERT INTO "user" (id, email, name, "createdAt", "updatedAt") VALUES ($1, $2, $3, NOW(), NOW())',
        [dbUserId, userEmail, displayName]
      );

      // Also create in Supabase for compatibility
      const supabase = getSupabase();
      await supabase.from('users').insert({
        id: dbUserId,
        email: userEmail,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      await supabase.from('profiles').insert({
        id: dbUserId,
        email: userEmail,
        full_name: displayName,
        subscription_tier: 'free',
        student_type: 'high_school',
        preferences: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      console.log(`[OAuth] Created new user via Apple Sign-In: ${userEmail}`);
    }

    // Ensure auth_id_mapping exists so syncUserToSupabase resolves to the correct UUID
    await ensureAuthIdMapping(dbUserId, dbUserId);

    // Link the Apple sub to this user if not already linked, so future logins
    // resolve by sub even when Apple omits the email claim.
    if (linkedAccount.rows.length === 0) {
      const accountId = uuidv4();
      await authPool.query(
        'INSERT INTO "account" (id, "userId", "accountId", "providerId", "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, NOW(), NOW())',
        [accountId, dbUserId, userId, 'apple']
      );
    }

    // Create session
    const sessionId = uuidv4();
    const sessionToken = `better-auth-${sessionId}`;
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const sessionPlatform = detectPlatform(req);

    await authPool.query(
      'INSERT INTO "session" (id, "userId", "expiresAt", token, platform) VALUES ($1, $2, $3, $4, $5)',
      [sessionId, dbUserId, expiresAt, sessionToken, sessionPlatform]
    );
    
    // Get full user data
    const fullUserRecord = await authPool.query(
      'SELECT * FROM "user" WHERE id = $1',
      [dbUserId]
    );
    
    const user = fullUserRecord.rows[0];
    
    // Return response in same format as regular login
    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role || 'user',
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        hasOAuthAccount: true,
        authMethod: 'apple',
      },
      token: sessionToken,
      sessionToken: sessionToken,
      isNewUser,
    });
    
  } catch (error) {
    console.error('[OAuth] Apple Sign-In error:', error);
    res.status(500).json({ 
      error: { message: 'Failed to authenticate with Apple' } 
    });
  }
});

// Google Sign-In for mobile apps
router.post('/google/mobile', async (req, res) => {
  try {
    const { idToken } = req.body;

    console.log('[OAuth] Google Sign-In request for mobile');

    if (!idToken) {
      return res.status(400).json({
        error: { message: 'Google ID token is required' }
      });
    }

    const audiences = getGoogleAudiences();
    if (audiences.length === 0) {
      console.error('[OAuth] No Google client IDs configured');
      return res.status(500).json({ error: { message: 'Google Sign-In is not configured' } });
    }

    // Cryptographically verify the ID token with Google. Identity comes ONLY
    // from the verified payload, never from a client-supplied `user` object.
    const client = new OAuth2Client();
    let payload;
    try {
      const ticket = await client.verifyIdToken({ idToken, audience: audiences });
      payload = ticket.getPayload();
    } catch {
      console.log('[OAuth] Google token verification failed');
      return res.status(401).json({ error: { message: 'Invalid Google ID token' } });
    }

    const userEmail = payload.email;
    const googleUserId = payload.sub;
    const displayName = payload.name || (userEmail ? userEmail.split('@')[0] : 'User');
    const photoUrl = payload.picture;

    if (!userEmail || !googleUserId) {
      return res.status(400).json({
        error: { message: 'Google token missing required claims' }
      });
    }
    
    // Check if user already exists
    let userRecord = await authPool.query(
      'SELECT * FROM "user" WHERE email = $1',
      [userEmail]
    );
    
    let dbUserId;
    let isNewUser = false;
    
    if (userRecord.rows.length === 0) {
      // Create new user
      dbUserId = uuidv4();
      isNewUser = true;
      
      await authPool.query(
        'INSERT INTO "user" (id, email, name, "createdAt", "updatedAt") VALUES ($1, $2, $3, NOW(), NOW())',
        [dbUserId, userEmail, displayName]
      );
      
      // Also create in Supabase for compatibility
      const supabase = getSupabase();
      await supabase.from('users').insert({
        id: dbUserId,
        email: userEmail,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
      
      await supabase.from('profiles').insert({
        id: dbUserId,
        email: userEmail,
        full_name: displayName,
        avatar_url: photoUrl,
        subscription_tier: 'free',
        student_type: 'high_school',
        preferences: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      console.log(`[OAuth] Created new user via Google Sign-In: ${userEmail}`);
    } else {
      dbUserId = userRecord.rows[0].id;

      // Update profile with Google photo if available
      if (photoUrl) {
        const supabase = getSupabase();
        await supabase.from('profiles')
          .update({ avatar_url: photoUrl })
          .eq('id', dbUserId);
      }
    }
    
    // Ensure auth_id_mapping exists so syncUserToSupabase resolves to the correct UUID
    await ensureAuthIdMapping(dbUserId, dbUserId);

    // Check if Google account already linked
    const accountRecord = await authPool.query(
      'SELECT * FROM "account" WHERE "userId" = $1 AND "providerId" = $2',
      [dbUserId, 'google']
    );
    
    if (accountRecord.rows.length === 0) {
      // Link Google account
      await authPool.query(
        'INSERT INTO "account" ("userId", "providerId", "accountId", "createdAt", "updatedAt") VALUES ($1, $2, $3, NOW(), NOW())',
        [dbUserId, 'google', googleUserId]
      );
      console.log(`[OAuth] Linked Google account for user: ${userEmail}`);
    }
    
    // Get fresh user data from Supabase
    const supabase = getSupabase();
    const { data: userData } = await supabase
      .from('users')
      .select('*, profiles(*)')
      .eq('id', dbUserId)
      .single();
    
    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: dbUserId, 
        email: userEmail,
        provider: 'google'
      },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );
    
    // Generate refresh token
    const refreshToken = jwt.sign(
      { 
        userId: dbUserId,
        type: 'refresh',
        provider: 'google'
      },
      process.env.JWT_SECRET,
      { expiresIn: '90d' }
    );
    
    console.log(`[OAuth] Google Sign-In successful for: ${userEmail}`);
    
    res.json({
      success: true,
      token,
      refreshToken,
      user: userData,
      isNewUser
    });
  } catch (error) {
    console.error('[OAuth] Google Sign-In error:', error);
    res.status(500).json({ 
      error: { message: 'Failed to authenticate with Google' } 
    });
  }
});

// Simplified Google OAuth endpoint - forwards to /google/mobile handler
router.post('/google', (req, res, next) => {
  req.url = '/google/mobile';
  router.handle(req, res, next);
});

export default router;