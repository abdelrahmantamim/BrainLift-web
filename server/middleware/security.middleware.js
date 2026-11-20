import helmet from 'helmet';

// Force HTTPS in production
const enforceHTTPS = (req, res, next) => {
  // Skip in development
  if (process.env.NODE_ENV !== 'production') {
    return next();
  }

  // Check if request is already HTTPS
  const isHttps = req.secure || 
                  req.headers['x-forwarded-proto'] === 'https' ||
                  req.protocol === 'https';

  if (!isHttps) {
    console.log(`[Security] Redirecting HTTP to HTTPS for ${req.url}`);
    return res.redirect(301, `https://${req.headers.host}${req.url}`);
  }

  // Add HSTS header
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  
  next();
};

// Security headers configuration
const securityHeaders = helmet({
  // Content Security Policy
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // Consider removing unsafe-eval in production
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      connectSrc: ["'self'", "https://api.openai.com", "https://supabase.co", "wss://supabase.co"],
      mediaSrc: ["'self'"],
      objectSrc: ["'none'"],
      childSrc: ["'self'"],
      frameAncestors: ["'none'"],
      formAction: ["'self'"],
      upgradeInsecureRequests: [],
    },
  },
  
  // Cross-Origin-Embedder-Policy
  crossOriginEmbedderPolicy: false, // May need to adjust based on your needs
  
  // Cross-Origin-Opener-Policy
  crossOriginOpenerPolicy: { policy: "same-origin" },
  
  // Cross-Origin-Resource-Policy
  crossOriginResourcePolicy: { policy: "cross-origin" },
  
  // DNS Prefetch Control
  dnsPrefetchControl: { allow: false },
  
  // Expect-CT
  expectCt: {
    maxAge: 30,
    enforce: true,
  },
  
  // Frameguard
  frameguard: { action: 'deny' },
  
  // Hide Powered By
  hidePoweredBy: true,
  
  // HSTS is handled in enforceHTTPS
  hsts: false,
  
  // IE No Open
  ieNoOpen: true,
  
  // No Sniff
  noSniff: true,
  
  // Origin Agent Cluster
  originAgentCluster: true,
  
  // Permitted Cross Domain Policies
  permittedCrossDomainPolicies: { permittedPolicies: "none" },
  
  // Referrer Policy
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  
  // X-XSS-Protection (deprecated but still useful for older browsers)
  xssFilter: true,
});

// Additional security headers
const additionalSecurityHeaders = (req, res, next) => {
  // Permissions Policy (replaces Feature-Policy)
  res.setHeader(
    'Permissions-Policy',
    'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()'
  );
  
  // X-Content-Type-Options
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // X-Frame-Options (backup for CSP frame-ancestors)
  res.setHeader('X-Frame-Options', 'DENY');
  
  // Clear Site Data on logout
  if (req.path === '/api/auth/logout') {
    res.setHeader('Clear-Site-Data', '"cache", "cookies", "storage"');
  }
  
  next();
};

// CORS configuration for production
const productionCors = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      process.env.FRONTEND_URL,
      process.env.MOBILE_APP_URL,
      process.env.ADMIN_URL
    ].filter(Boolean);
    
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log(`[CORS] Blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['X-Total-Count', 'X-Page-Count'],
  maxAge: 86400 // 24 hours
};

// Request size limits
const requestSizeLimits = {
  json: '10mb', // General JSON limit
  urlencoded: '10mb',
  raw: '10mb',
  text: '10mb',
  
  // Special limits for specific routes
  fileUpload: '50mb',
  chatMessage: '100kb',
  profileUpdate: '1mb'
};

// Apply route-specific size limits
const applyRouteLimits = (req, res, next) => {
  if (req.path.includes('/upload') || req.path.includes('/files')) {
    req.app.set('json limit', requestSizeLimits.fileUpload);
  } else if (req.path.includes('/chat/message')) {
    req.app.set('json limit', requestSizeLimits.chatMessage);
  } else if (req.path.includes('/profile')) {
    req.app.set('json limit', requestSizeLimits.profileUpdate);
  } else {
    req.app.set('json limit', requestSizeLimits.json);
  }
  next();
};

// Security audit logging
const securityAuditLog = (req, res, next) => {
  // Log security-relevant events
  const securityEvents = [
    '/api/auth/login',
    '/api/auth/register',
    '/api/auth/logout',
    '/api/auth/reset-password',
    '/api/admin',
    '/api/files/delete'
  ];
  
  if (securityEvents.some(event => req.path.startsWith(event))) {
    console.log(`[Security Audit] ${req.method} ${req.path} from ${req.ip} - User: ${req.userId || 'anonymous'}`);
  }
  
  // Log failed authentication attempts
  const originalJson = res.json;
  res.json = function(data) {
    if (res.statusCode === 401 || res.statusCode === 403) {
      console.log(`[Security Audit] Authentication failure: ${req.method} ${req.path} from ${req.ip}`);
    }
    originalJson.call(this, data);
  };
  
  next();
};

export {
  enforceHTTPS,
  securityHeaders,
  additionalSecurityHeaders,
  productionCors,
  requestSizeLimits,
  applyRouteLimits,
  securityAuditLog
};