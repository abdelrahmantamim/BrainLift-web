// Email configuration
import dotenv from 'dotenv';

dotenv.config();

// Supported email providers
export const EMAIL_PROVIDERS = {
  RESEND: 'resend',
  SENDGRID: 'sendgrid',
  SMTP: 'smtp',
  CONSOLE: 'console', // For development
};

// Get email configuration from environment
export const getEmailConfig = () => {
  const provider = process.env.EMAIL_PROVIDER || EMAIL_PROVIDERS.CONSOLE;
  
  switch (provider) {
    case EMAIL_PROVIDERS.RESEND:
      return {
        provider: EMAIL_PROVIDERS.RESEND,
        apiKey: process.env.RESEND_API_KEY,
        fromEmail: process.env.EMAIL_FROM || 'noreply@getbrainlift.app',
        fromName: process.env.EMAIL_FROM_NAME || 'BrainLift',
      };
      
    case EMAIL_PROVIDERS.SENDGRID:
      return {
        provider: EMAIL_PROVIDERS.SENDGRID,
        apiKey: process.env.SENDGRID_API_KEY,
        fromEmail: process.env.EMAIL_FROM || 'noreply@getbrainlift.app',
        fromName: process.env.EMAIL_FROM_NAME || 'BrainLift',
      };
      
    case EMAIL_PROVIDERS.SMTP:
      return {
        provider: EMAIL_PROVIDERS.SMTP,
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
        fromEmail: process.env.EMAIL_FROM || 'noreply@getbrainlift.app',
        fromName: process.env.EMAIL_FROM_NAME || 'BrainLift',
      };
      
    default:
      return {
        provider: EMAIL_PROVIDERS.CONSOLE,
        fromEmail: process.env.EMAIL_FROM || 'noreply@getbrainlift.app',
        fromName: process.env.EMAIL_FROM_NAME || 'BrainLift',
      };
  }
};

// Default export for easier importing
export default {
  EMAIL_PROVIDERS,
  getEmailConfig,
};