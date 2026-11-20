// Server with Better Auth (ESM version)
import dotenv from 'dotenv';
// Load environment variables FIRST before any other imports
dotenv.config();
import { validateEnvironment } from './config/environments.js';
validateEnvironment();

import express from 'express';
import cors from 'cors';
import compression from 'compression';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';
import cookieParser from 'cookie-parser';
import { toNodeHandler } from 'better-auth/node';

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import our custom logger
import logger from './utils/serverLogger.js';

logger.info('Server', 'Starting BrainLift server with Better Auth...');
logger.info('Server', `Node version: ${process.version}`);
logger.info('Server', `Environment: ${process.env.NODE_ENV || 'development'}`);

// Initialize services
import { initializeDatabase, getDatabase } from './config/database.config.js';
import { initializeServices, getSupabase } from './config/services.config.js';
import { initializeOcrPool } from './utils/initializeOcr.js';

// Initialize core services synchronously (fast)
try {
  logger.info('Server', 'Initializing database...');
  initializeDatabase();
  logger.info('Server', 'Initializing services...');
  initializeServices();
  logger.info('Server', '✅ Database and services initialized');
} catch (error) {
  logger.error('Server', '❌ Failed to initialize:', error.message);
  logger.error('Server', 'Stack trace:', error.stack);
  process.exit(1);
}

// Delay heavy initialization until after server starts
let ocrInitialized = false;
const initializeBackgroundServices = async () => {
  if (!ocrInitialized) {
    try {
      logger.info('Server', 'Initializing background services...');
      await initializeOcrPool();
      ocrInitialized = true;
      logger.info('Server', '✅ Background services initialized');
    } catch (err) {
      logger.warn('Server', 'Background services initialization failed:', err.message);
    }
  }
};

// Setup multer for file uploads
import { createDynamicUpload } from './middleware/dynamicUpload.js';
const dynamicUpload = createDynamicUpload();

// Import routes
import createFilesRouter from './routes/files-better-auth.routes.js';
const filesRouter = createFilesRouter(dynamicUpload);
// Mobile files routes removed (was using deprecated Clerk/Convex)
import aiRouter from './routes/ai.routes.js';
import adminRouter from './routes/admin.routes.js';
import adminModerationRouter from './routes/admin-moderation.routes.js';
import adminViralRouter from './routes/admin-viral.routes.js';
import adminCircuitBreakerRouter from './routes/admin-circuit-breaker.routes.js';
import notificationsRouter from './routes/notifications.routes.js';
import userRouter from './routes/user.routes.js';
import quizRouter from './routes/quiz.routes.js';
import flashcardsRouter from './routes/flashcards.routes.js';
import chatRouter from './routes/chat.routes.js';
import betterAuthRouter from './routes/better-auth.routes.js';
import betterAuthSessionRouter from './routes/better-auth-session.routes.js';
import shareRouter from './routes/share.routes.js';
import foldersRouter from './routes/folders.routes.js';
import pdfRouter from './routes/pdf.routes.js';
import qrRouter from './routes/qr.routes.js';
import oauthRouter from './routes/oauth.routes.js';
import statsRouter from './routes/stats.routes.js';
import xpRouter from './routes/xp.routes.js';
import profileRouter from './routes/profile.routes.js';
import chartsRouter from './routes/charts.routes.js';
import featureFlagsRouter from './routes/feature-flags.routes.js';
import supportRouter from './routes/support.routes.js';
import testOpenRouterRouter from './routes/test-openrouter.routes.js';
import webhookRouter from './routes/webhook.routes.js';

// Load model config
import { loadModelConfig } from './utils/modelConfig.js';
loadModelConfig();

// Import sync middleware
import { syncUserToSupabase } from './middleware/syncUser.middleware.js';

// Import rate limiters
import {
  apiLimiter,
  authLimiter,
  chatLimiter,
  uploadLimiter,
  generationLimiter,
  userChatLimiter,
  userGenerationLimiter
} from './middleware/rateLimiter.middleware.js';

const app = express();
const PORT = parseInt(process.env.PORT) || 3001;
console.log(`[Server] PORT environment variable: ${process.env.PORT}`);
console.log(`[Server] Using PORT: ${PORT}`);

// Import XSS protection
import { sanitizeInput, validateContentType } from './middleware/xssProtection.middleware.js';

// Import error sanitizer
import { sanitizeError } from './middleware/errorSanitizer.middleware.js';

// Import security middleware
import { enforceHTTPS } from './middleware/security.middleware.js';

// Trust proxy for rate limiting to work correctly behind reverse proxies
// Note: We use custom keyGenerator in rateLimiter.middleware.js to handle IP extraction
app.set('trust proxy', 1);

// Enforce HTTPS in production
app.use(enforceHTTPS);

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: ["'self'", "wss:", "https:"],
      fontSrc: ["'self'", "https:", "data:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
}));

// CORS configuration
const isProduction = process.env.NODE_ENV === 'production';

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);

    // Production origins (always included)
    const allowedOrigins = [
      'https://getbrainlift.app',  // Production web app
      'https://www.getbrainlift.app',
      'https://app.getbrainlift.app',
      'https://brain-lift-admin.vercel.app',  // Admin dashboard on Vercel
      'https://brain-lift-website.vercel.app',  // Web app on Vercel
      process.env.FRONTEND_URL,
      process.env.MOBILE_APP_URL,
      process.env.ADMIN_DASHBOARD_URL,  // Environment variable for admin dashboard
    ];

    // Development-only origins
    if (!isProduction) {
      allowedOrigins.push(
        'http://localhost:5173',  // Vite dev server
        'http://localhost:5174',  // Alternative Vite port
        'http://localhost:3000',  // Alternative web port
        'http://localhost:8081',
        'http://localhost:19006',
        'http://localhost:3002',  // Admin dashboard
        'exp://192.168.1.3:8081',
      );
    }

    const filtered = allowedOrigins.filter(Boolean);

    if (filtered.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log(`[CORS] Blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
}));

// Compression - skip for SSE (Server-Sent Events) responses
app.use(compression({
  filter: (req, res) => {
    // Don't compress SSE responses - they need to stream in real-time
    if (req.path.includes('/stream') || res.getHeader('Content-Type') === 'text/event-stream') {
      return false;
    }
    return compression.filter(req, res);
  }
}));

// Logging
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// Health check - responds immediately
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'ai-services',
    version: '2.0.0',
    port: PORT,
    env: process.env.NODE_ENV
  });
});

// Ready check - for Railway
app.get('/', (req, res) => {
  res.status(200).json({
    status: 'ready',
    service: 'brainlift-server',
    version: '2.0.0'
  });
});

// API health check
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'ai-services-api',
    version: '2.0.0'
  });
});

// Catch all unmatched routes early to prevent middleware issues
app.get('*', (req, res, next) => {
  // Only catch GET requests that look like health checks
  if (req.method === 'GET' && (req.path === '/healthz' || req.path === '/ready' || req.path === '/live')) {
    res.status(200).json({ status: 'ok' });
  } else {
    next();
  }
});

// Cookie parser (needed for Better Auth)
app.use(cookieParser());

// Body parsing middleware — 5MB to support base64 image uploads (avatars, chat backgrounds)
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// XSS Protection - sanitize all inputs
app.use(sanitizeInput);

// Request logging
app.use(morgan('combined', {
  stream: { write: (message) => logger.info('HTTP', message.trim()) },
}));

// Apply global rate limiting (less restrictive)
app.use('/api/', apiLimiter);

// Better Auth routes (must come before other routes) - with strict auth rate limiting
app.use('/api/auth', authLimiter, betterAuthRouter);
app.use('/api/auth/session', authLimiter, betterAuthSessionRouter);

// Import auth middleware for Better Auth
import { requireAuth } from './middleware/auth.middleware.js';
import { requireAuthForRefresh } from './middleware/auth.middleware.js';
import { trackDeviceFingerprint, requireTrustedDevice } from './middleware/deviceFingerprint.middleware.js';

// API Key authentication middleware
import { authenticateAPI } from './middleware/apiAuth.middleware.js';

// Web paywall: blocks free-tier users on web sessions from feature endpoints.
// No-op for mobile sessions (preserves existing mobile behavior 1:1).
import { requirePaidWeb } from './middleware/requirePaidWeb.middleware.js';
import { detectPlatform, tagSessionPlatform } from './utils/session-platform.js';

// AI Service routes (protected by API key) - with AI generation rate limiting
app.use('/api/ai', authenticateAPI, generationLimiter, aiRouter);

// Webhook routes (no auth - uses own Bearer token auth)
app.use('/api/webhooks/revenuecat', express.json(), webhookRouter);

// Public routes (no auth required) - still need rate limiting
app.use('/api/share', apiLimiter, shareRouter);
app.use('/api/oauth', authLimiter, oauthRouter);
app.use('/api/qr', apiLimiter, qrRouter);
app.use('/api/feature-flags', apiLimiter, featureFlagsRouter);

// Support/feedback routes (public contact endpoint + auth-protected routes)
app.post('/api/support/public-contact', apiLimiter, (req, res, next) => {
  // Forward to the support router's public-contact handler
  req.url = '/public-contact';
  supportRouter(req, res, next);
});
app.use('/api/support', requireAuth, apiLimiter, supportRouter);

// Protected routes (Better Auth required) - with specific rate limits
// /api/user contains both paywall-exempt (profile read, subscription) and gated (avatar, chat-background)
// routes — gating is applied inside the router, not at mount.
app.use('/api/user', requireAuth, trackDeviceFingerprint, syncUserToSupabase, express.json({ limit: '10mb' }), userRouter);
app.use('/api/profile', requireAuth, trackDeviceFingerprint, syncUserToSupabase, apiLimiter, express.json({ limit: '10mb' }), profileRouter);
app.use('/api/files', requireAuth, trackDeviceFingerprint, syncUserToSupabase, requirePaidWeb, uploadLimiter, filesRouter);
app.use('/api/folders', requireAuth, trackDeviceFingerprint, syncUserToSupabase, requirePaidWeb, apiLimiter, foldersRouter);
app.use('/api/quiz', requireAuth, trackDeviceFingerprint, syncUserToSupabase, requirePaidWeb, generationLimiter, quizRouter);
app.use('/api/flashcards', requireAuth, trackDeviceFingerprint, syncUserToSupabase, requirePaidWeb, generationLimiter, flashcardsRouter);
app.use('/api/chat', requireAuth, trackDeviceFingerprint, syncUserToSupabase, requirePaidWeb, userChatLimiter, chatRouter);
app.get('/api/notifications/vapid-key', apiLimiter, (req, res) => {
  const vapidPublicKey = process.env.VAPID_PUBLIC_KEY || 'BKd0G7BL7zKn7F8OVW5GWQmFPj0LpF5YnMHcG8LnZ0Q2F5R3JqCWV6V1t8LkJpX6QZ9F0M1KvQz2Q3F5R3JqCWV';
  res.json({ publicKey: vapidPublicKey });
});
app.use('/api/notifications', requireAuth, trackDeviceFingerprint, syncUserToSupabase, requirePaidWeb, apiLimiter, notificationsRouter);
app.use('/api/pdf', requireAuth, trackDeviceFingerprint, syncUserToSupabase, requirePaidWeb, uploadLimiter, pdfRouter); // PDF generation rate limiting
app.use('/api/stats', requireAuth, trackDeviceFingerprint, syncUserToSupabase, requirePaidWeb, apiLimiter, statsRouter);
app.use('/api/xp', requireAuth, trackDeviceFingerprint, syncUserToSupabase, requirePaidWeb, apiLimiter, xpRouter);
app.use('/api/charts', requireAuth, trackDeviceFingerprint, syncUserToSupabase, requirePaidWeb, generationLimiter, chartsRouter);

// Admin routes (separate auth)
app.use('/api/admin', adminRouter);
app.use('/api/admin/moderation', adminModerationRouter);
app.use('/api/admin/viral', adminViralRouter);
app.use('/api/admin/circuit-breaker', adminCircuitBreakerRouter);

// Test routes (for development/testing)
if (process.env.NODE_ENV !== 'production') {
  app.use('/api/test', requireAuth, testOpenRouterRouter);
}

// Static files
app.use('/uploads', requireAuth, express.static(path.join(__dirname, 'uploads')));

// Add refresh-token endpoint that accepts expired tokens - with rate limiting
app.post('/api/auth/refresh-token', authLimiter, requireAuthForRefresh, async (req, res) => {
  try {
    // User is already attached by requireAuthForRefresh middleware
    const user = req.user;

    // Generate new session token
    const { auth } = await import('./config/better-auth.config.js');
    const session = await auth.createSession({
      userId: user.id,
      expiresIn: 30 * 24 * 60 * 60, // 30 days
    });

    // Tag the refreshed session with its platform so the web paywall continues
    // to enforce after a token refresh (otherwise it defaults to 'mobile').
    await tagSessionPlatform(session.token, detectPlatform(req));

    res.json({
      token: session.token,
      expiresAt: session.expiresAt,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    });
  } catch (error) {
    logger.error('RefreshToken', 'Failed to refresh token:', error);
    res.status(401).json({ error: 'Failed to refresh token' });
  }
});

// Error handling - use sanitizeError middleware
app.use(sanitizeError);

// 404 handler
app.use((req, res) => {
  logger.warn('Server', `[404] Route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({ error: { message: 'Route not found' } });
});

// Model config is now reloaded on-demand when admin updates assignments
// No need for periodic checks

// Start server - bind to 0.0.0.0 for Railway
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Server] HTTP server started successfully`);
  console.log(`[Server] Listening on 0.0.0.0:${PORT}`);
  console.log(`
🚀 AI Services Server running on port ${PORT}
🤖 Services: AI generation, file processing, notifications
🔐 Authentication: Better Auth
📊 Admin dashboard available
✅ Ready for production`);

  // Initialize heavy services after server is listening
  // Delay initialization more to ensure Railway doesn't kill the process
  setTimeout(() => {
    initializeBackgroundServices();
  }, 5000); // Increased delay to 5 seconds
});

// Handle server errors
server.on('error', (error) => {
  console.error('[Server] Failed to start:', error);
  if (error.code === 'EADDRINUSE') {
    console.error(`[Server] Port ${PORT} is already in use`);
  }
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

let isShuttingDown = false;

async function gracefulShutdown(signal) {
  // Prevent multiple shutdown attempts
  if (isShuttingDown) {
    return;
  }
  isShuttingDown = true;

  console.log(`\n[${signal}] Graceful shutdown initiated...`);

  // Stop accepting new connections
  server.close(async () => {
    console.log('[Shutdown] HTTP server closed');

    try {
      // Clean up database connections
      const { closeDatabase } = await import('./config/database.config.js');
      await closeDatabase();
      // Close the shared pg pool used by routes/middleware/utils.
      const { closePool } = await import('./utils/pgPool.js');
      await closePool();
      console.log('[Shutdown] Database connections closed');

      // Clean up any other resources
      if (global.ocrPool) {
        await global.ocrPool.terminate();
        console.log('[Shutdown] OCR pool terminated');
      }

      console.log('[Shutdown] ✅ Graceful shutdown completed');
      // Exit cleanly - this is expected behavior, not an error
      process.exit(0);
    } catch (error) {
      console.error('[Shutdown] Error during cleanup:', error);
      process.exit(1);
    }
  });

  // Force shutdown after 10 seconds (matching PM2 config)
  setTimeout(() => {
    console.error('[Shutdown] ⚠️ Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
}

export default app;
