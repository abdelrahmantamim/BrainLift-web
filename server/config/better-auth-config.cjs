const { betterAuth } = require('better-auth');
const { Pool } = require('pg');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Check if required configuration exists
const isConfigured = !!(process.env.DATABASE_URL && process.env.BETTER_AUTH_SECRET);

// Create PostgreSQL adapter only if configured
let postgresAdapter = null;
let pool = null;

if (isConfigured) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });

  postgresAdapter = {
    async query(sql, params) {
      try {
        const result = await pool.query(sql, params);
        return result.rows;
      } catch (error) {
        console.error('Database query error:', error);
        throw error;
      }
    },
    
    async transaction(fn) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await fn({
          async query(sql, params) {
            const res = await client.query(sql, params);
            return res.rows;
          }
        });
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    }
  };
}

// Export Better Auth configuration
const auth = betterAuth({
  // Database configuration (use in-memory if not configured)
  database: postgresAdapter || {
    type: 'sqlite',
    filename: ':memory:',
  },
  
  // Base URL for callbacks
  baseURL: process.env.BASE_URL || 'http://localhost:3001',
  
  // Secret for signing tokens
  secret: process.env.BETTER_AUTH_SECRET || process.env.JWT_SECRET,
  
  // Session configuration
  session: {
    expiresIn: 30 * 24 * 60 * 60, // 30 days in seconds
    updateAge: 24 * 60 * 60, // Update session if older than 24 hours
    cookieName: 'tutorapp-session',
  },
  
  // Email configuration
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false, // Set to true in production
    sendResetPassword: async ({ user, url }) => {
      // Use existing email service
      const { sendPasswordResetEmail } = require('../services/email.service.js');
      await sendPasswordResetEmail(user.email, url);
    },
  },
  
  // Social providers (configure as needed)
  socialProviders: {
    google: process.env.GOOGLE_CLIENT_ID ? {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    } : undefined,
    
    apple: process.env.APPLE_CLIENT_ID ? {
      clientId: process.env.APPLE_CLIENT_ID,
      clientSecret: process.env.APPLE_CLIENT_SECRET,
    } : undefined,
    
    facebook: process.env.FACEBOOK_CLIENT_ID ? {
      clientId: process.env.FACEBOOK_CLIENT_ID,
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
    } : undefined,
  },
  
  // User configuration
  user: {
    additionalFields: {
      role: {
        type: 'string',
        defaultValue: 'user',
      },
      metadata: {
        type: 'json',
        defaultValue: {},
      },
    },
  },
  
  // Advanced features
  advanced: {
    // Enable two-factor authentication
    twoFactor: {
      issuer: 'BrainLift',
    },
    
    // Device management
    deviceManagement: {
      enabled: true,
    },
    
    // Rate limiting
    rateLimit: {
      enabled: true,
      window: 15 * 60 * 1000, // 15 minutes
      max: 100, // max requests per window
    },
  },
  
  // Hooks for custom logic
  hooks: {
    after: [
      {
        matcher: '/signup',
        handler: async ({ user }) => {
          // Sync user to Supabase for compatibility
          if (isConfigured) {
            try {
              const { getSupabase } = require('../config/services.config.js');
              const supabase = getSupabase();
              
              // Create user in public.users table
              await supabase.from('users').insert({
                id: user.id,
                email: user.email,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              });
              
              // Create profile
              await supabase.from('profiles').insert({
                id: user.id,
                email: user.email,
                full_name: user.name || user.email.split('@')[0],
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              });
              
              console.log(`[Better-Auth] Created user profile for ${user.email}`);
            } catch (error) {
              console.error('[Better-Auth] Failed to sync user to Supabase:', error);
            }
          }
        },
      },
    ],
  },
});

module.exports = {
  auth,
  isConfigured,
  authDb: pool
};