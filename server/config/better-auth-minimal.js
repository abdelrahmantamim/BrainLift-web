// Minimal Better Auth configuration for testing
import { betterAuth } from 'better-auth';
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  // Add connection pool settings to handle rapid connections better
  max: process.env.NODE_ENV === 'production' ? 50 : 20, // Maximum pool size
  idleTimeoutMillis: 30000, // 30 seconds
  connectionTimeoutMillis: 2000, // 2 seconds
});

export const auth = betterAuth({
  database: pool,
  baseURL: process.env.BASE_URL || process.env.SERVER_URL || 'https://api.getbrainlift.app',
  basePath: '/api/auth',
  secret: process.env.BETTER_AUTH_SECRET || process.env.JWT_SECRET,
  
  // Session configuration
  session: {
    expiresIn: 7 * 24 * 60 * 60, // 7 days in seconds
    updateAge: 24 * 60 * 60, // Update session if older than 24 hours
    cookieName: 'better-auth.session_token',
    // Ensure Better Auth uses the token field
    fields: {
      token: 'token'
    }
  },
  
  // Enable email/password authentication
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    sendResetPassword: async ({ user, url }) => {
      console.log('[BetterAuth] Password reset requested for:', user.email);
      console.log('[BetterAuth] Reset URL:', url);
      
      // Extract token from the URL
      const urlObj = new URL(url);
      const token = urlObj.pathname.split('/').pop();
      
      // Construct the proper reset URL for the web app
      const webAppUrl = process.env.WEB_APP_URL || 'https://brain-lift-website.vercel.app';
      const finalResetUrl = `${webAppUrl}/auth/reset-password?token=${token}`;
      
      console.log('[BetterAuth] Final reset URL:', finalResetUrl);
      
      // Use existing email service
      const { sendPasswordResetEmail } = await import('../services/email.service.js');
      
      try {
        await sendPasswordResetEmail(user.email, finalResetUrl);
        console.log('[BetterAuth] Password reset email sent successfully');
      } catch (error) {
        console.error('[BetterAuth] Failed to send password reset email:', error);
        throw error;
      }
    },
  },
  
  // Ensure tables use correct names
  user: {
    modelName: 'user',
  },
  account: {
    modelName: 'account',
  },
});

console.log('Minimal Better Auth configured');
console.log('Available endpoints:', Object.keys(auth.api));