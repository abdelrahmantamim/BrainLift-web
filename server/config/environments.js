const environments = {
  development: {
    name: 'development',
    port: process.env.PORT || 5001,
    apiUrl: process.env.API_URL || 'http://localhost:5001',
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
    mobileUrl: process.env.MOBILE_URL || 'http://localhost:8081',
    corsOrigins: [
      'http://localhost:5173',
      'http://localhost:8081',
      'http://localhost:3000',
      'http://localhost:3002',
      /^http:\/\/192\.168\.\d+\.\d+:\d+$/,
      /^http:\/\/10\.\d+\.\d+\.\d+:\d+$/,
      'https://getbrainlift.app',
      'https://app.getbrainlift.app'
    ],
    db: {
      poolMin: 2,
      poolMax: 10,
      poolIdleTimeout: 30000,
      statementTimeout: 30000
    },
    cache: {
      ttl: 300, // 5 minutes
      checkPeriod: 60 // 1 minute
    },
    logging: {
      level: 'debug',
      format: 'dev'
    }
  },
  
  staging: {
    name: 'staging',
    port: process.env.PORT || 5001,
    apiUrl: process.env.API_URL || 'https://staging-api.getbrainlift.app',
    frontendUrl: process.env.FRONTEND_URL || 'https://staging.getbrainlift.app',
    mobileUrl: process.env.MOBILE_URL || 'https://staging.getbrainlift.app',
    corsOrigins: [
      'https://staging.getbrainlift.app',
      'https://staging-api.getbrainlift.app'
    ],
    db: {
      poolMin: 5,
      poolMax: 20,
      poolIdleTimeout: 60000,
      statementTimeout: 60000
    },
    cache: {
      ttl: 600, // 10 minutes
      checkPeriod: 120 // 2 minutes
    },
    logging: {
      level: 'info',
      format: 'combined'
    }
  },
  
  production: {
    name: 'production',
    port: process.env.PORT || 5001,
    apiUrl: process.env.API_URL || 'https://api.getbrainlift.app',
    frontendUrl: process.env.FRONTEND_URL || 'https://getbrainlift.app',
    mobileUrl: process.env.MOBILE_URL || 'https://app.getbrainlift.app',
    corsOrigins: [
      'https://getbrainlift.app',
      'https://app.getbrainlift.app',
      'https://api.getbrainlift.app'
    ],
    db: {
      poolMin: 10,
      poolMax: 50,
      poolIdleTimeout: 120000,
      statementTimeout: 120000
    },
    cache: {
      ttl: 1800, // 30 minutes
      checkPeriod: 300 // 5 minutes
    },
    logging: {
      level: 'warn',
      format: 'json'
    }
  }
};

// Get current environment
const env = process.env.NODE_ENV || 'development';
const currentEnvironment = environments[env] || environments.development;

// Validate environment
function validateEnvironment() {
  const required = [
    'SUPABASE_URL',
    'SUPABASE_SERVICE_KEY',
    'JWT_SECRET',
    'BETTER_AUTH_SECRET',
    'OPENAI_API_KEY',
    'DATABASE_URL'
  ];
  
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0 && env !== 'development') {
    console.error('Missing required environment variables:', missing);
    process.exit(1);
  }
  
  if (env === 'production') {
    if (!process.env.POSTHOG_API_KEY) {
      console.warn('Warning: POSTHOG_API_KEY not set for production environment');
    }
    if (!process.env.REDIS_URL) {
      console.warn('Warning: REDIS_URL not set for production environment');
    }
  }
}

export default {
  current: currentEnvironment,
  isDevelopment: env === 'development',
  isStaging: env === 'staging',
  isProduction: env === 'production',
  validate: validateEnvironment
};

export { currentEnvironment, validateEnvironment };