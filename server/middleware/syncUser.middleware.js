import { getSupabase } from '../config/services.config.js';
import { v4 as uuidv4 } from 'uuid';
import { isValidUUID } from '../utils/promptSanitizer.js';
import pool from '../utils/pgPool.js';

// Cache for ID mappings to reduce database queries
const idMappingCache = new Map();

// Cache for recently synced users - skip Supabase upserts if synced within TTL
const syncedUsersCache = new Map();
const SYNC_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

// Get or create UUID mapping for Better Auth ID
async function getOrCreateUUID(betterAuthId, email) {
  // Check cache first
  if (idMappingCache.has(betterAuthId)) {
    return idMappingCache.get(betterAuthId);
  }
  
  try {
    // Check if mapping exists
    const existingMapping = await pool.query(
      'SELECT uuid FROM auth_id_mapping WHERE better_auth_id = $1',
      [betterAuthId]
    );
    
    if (existingMapping.rows.length > 0) {
      const uuid = existingMapping.rows[0].uuid;
      idMappingCache.set(betterAuthId, uuid);
      return uuid;
    }
    
    // Check if a user already exists with this email (from before Better Auth)
    if (email) {
      const existingUser = await pool.query(
        'SELECT id FROM users WHERE email = $1',
        [email]
      );
      
      if (existingUser.rows.length > 0) {
        const existingUuid = existingUser.rows[0].id;
        console.log('[SyncUser] Found existing user with email, reusing UUID:', existingUuid);
        
        // Create mapping to existing user
        await pool.query(
          'INSERT INTO auth_id_mapping (better_auth_id, uuid) VALUES ($1, $2)',
          [betterAuthId, existingUuid]
        );
        
        idMappingCache.set(betterAuthId, existingUuid);
        return existingUuid;
      }
    }
    
    // Create new mapping with new UUID
    const newUuid = uuidv4();
    await pool.query(
      'INSERT INTO auth_id_mapping (better_auth_id, uuid) VALUES ($1, $2)',
      [betterAuthId, newUuid]
    );
    
    idMappingCache.set(betterAuthId, newUuid);
    return newUuid;
  } catch (error) {
    console.error('[SyncUser] Error managing ID mapping:', error);
    // Do NOT mint an unpersisted UUID here — that fragments a user's identity
    // across requests on a transient DB error. Fail loud so the caller retries.
    throw error;
  }
}

// Middleware to sync Better-Auth users to Supabase profiles and users tables
async function syncUserToSupabase(req, res, next) {
  // Only sync if we have an authenticated user
  if (!req.user || !req.user.id) {
    console.log('[SyncUser] No authenticated user, skipping sync');
    return next();
  }

  try {
    const betterAuthId = req.user.id;
    const email = req.user.email;
    const name = req.user.name || email;

    // Get or create UUID for this Better Auth ID. On a transient DB error this
    // throws (rather than minting a throwaway UUID); surface it as retryable.
    let userId;
    try {
      userId = await getOrCreateUUID(betterAuthId, email);
    } catch {
      return res.status(503).json({ error: { message: 'Service temporarily unavailable, please retry' } });
    }

    // Validate that the UUID is properly formatted
    if (!isValidUUID(userId)) {
      console.error('[SyncUser] Invalid UUID format:', userId);
      return res.status(500).json({ error: { message: 'Internal authentication error' } });
    }

    // Update req.userId to use the UUID
    req.userId = userId;
    req.user.uuid = userId; // Add UUID to user object

    // Skip Supabase upserts if this user was synced recently
    const lastSynced = syncedUsersCache.get(userId);
    if (lastSynced && (Date.now() - lastSynced) < SYNC_CACHE_TTL_MS) {
      return next();
    }

    const supabase = getSupabase();

    // First, ensure user exists in users table
    const { error: userUpsertError } = await supabase
      .from('users')
      .upsert({
        id: userId,
        email: email,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'id'
      })
      .select('id');

    if (userUpsertError) {
      console.error('[SyncUser] Error upserting user:', userUpsertError.message);
    }

    // Then, ensure profile exists - only insert if it doesn't exist
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .single();

    if (!existingProfile) {
      const { error: profileInsertError } = await supabase
        .from('profiles')
        .insert({
          id: userId,
          email: email,
          full_name: name,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          preferences: {},
          student_type: 'high_school',
          subscription_tier: 'free'
        });

      if (profileInsertError && profileInsertError.code !== '23505') {
        console.error('Error inserting profile:', profileInsertError);
      }
    }

    // Mark user as synced
    syncedUsersCache.set(userId, Date.now());

    // Continue to next middleware
    next();
  } catch (error) {
    console.error('Error in syncUserToSupabase middleware:', error);
    // Don't block the request if sync fails
    next();
  }
}

export { syncUserToSupabase };