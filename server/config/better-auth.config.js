import { betterAuth } from 'better-auth';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import logger from '../utils/serverLogger.js';

// Load environment variables
dotenv.config();

logger.info('BetterAuthConfig', 'Starting initialization...');

// Create PostgreSQL pool
logger.info('BetterAuthConfig', `Database URL: ${process.env.DATABASE_URL ? 'Set' : 'Not set'}`);
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});
logger.info('BetterAuthConfig', 'PostgreSQL pool created');

logger.info('BetterAuthConfig', 'Creating Better Auth instance...');

// Export Better Auth configuration
export const auth = betterAuth({
  // Database configuration - Better Auth accepts pg Pool directly
  database: pool,
  
  // Base URL for callbacks  
  baseURL: process.env.BASE_URL || process.env.SERVER_URL || 'https://api.getbrainlift.app',
  
  // Base path for auth routes
  basePath: '/api/auth',
  
  // Secret for signing tokens
  secret: process.env.BETTER_AUTH_SECRET || process.env.JWT_SECRET,
  
  // Session configuration
  session: {
    expiresIn: 30 * 24 * 60 * 60, // 30 days in seconds
    updateAge: 24 * 60 * 60, // Update session if older than 24 hours
    cookieName: 'better-auth.session_token',
    // Enable bearer token support for mobile apps
    fetchOptions: {
      onRequest: (request) => {
        // Support Bearer token in Authorization header
        const authHeader = request.headers.get('Authorization');
        if (authHeader?.startsWith('Bearer ')) {
          const token = authHeader.substring(7);
          // Set cookie header for Better Auth to process
          request.headers.set('Cookie', `better-auth.session_token=${token}`);
        }
      },
    },
  },
  
  // Email configuration
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false, // Set to true in production
    sendResetPassword: async ({ user, url }) => {
      logger.info('BetterAuth', `Password reset requested for: ${user.email}`);
      logger.info('BetterAuth', `Reset URL from Better Auth: ${url}`);
      
      // Extract token from the URL
      const urlObj = new URL(url);
      const token = urlObj.pathname.split('/').pop();
      
      // Construct the proper reset URL for the web app
      const webAppUrl = process.env.WEB_APP_URL || 'https://brain-lift-website.vercel.app';
      const finalResetUrl = `${webAppUrl}/auth/reset-password?token=${token}`;
      
      logger.info('BetterAuth', `Final reset URL: ${finalResetUrl}`);
      
      // Use existing email service
      const { sendPasswordResetEmail } = await import('../services/email.service.js');
      await sendPasswordResetEmail(user.email, finalResetUrl);
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
      teamId: process.env.APPLE_TEAM_ID,
      keyId: process.env.APPLE_KEY_ID,
      privateKey: process.env.APPLE_PRIVATE_KEY,
      redirectURI: process.env.APPLE_REDIRECT_URI || 'https://getbrainlift.app/api/auth/callback/apple',
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
  
  // Temporarily disable hooks until we figure out the correct format
  // hooks: {},
});

logger.info('BetterAuthConfig', 'Better Auth instance created successfully');

// Log available auth endpoints
if (auth.api) {
  logger.info('BetterAuthConfig', 'Available endpoints:', Object.keys(auth.api));
}

logger.info('BetterAuthConfig', 'Export complete');