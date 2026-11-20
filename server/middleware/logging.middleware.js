const morgan = require('morgan');
const fs = require('fs');
const path = require('path');
const environments = require('../config/environments');

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Custom tokens
morgan.token('user-id', (req) => req.userId || 'anonymous');
morgan.token('response-time-ms', (req, res) => {
  if (!req._startTime) return '0';
  const ms = Date.now() - req._startTime;
  return ms.toFixed(3);
});
morgan.token('request-id', (req) => req.id || '-');

// Format for development
const devFormat = ':method :url :status :response-time-ms ms - :res[content-length]';

// Format for production (JSON)
const productionFormat = JSON.stringify({
  timestamp: ':date[iso]',
  method: ':method',
  url: ':url',
  status: ':status',
  responseTime: ':response-time-ms',
  contentLength: ':res[content-length]',
  userAgent: ':user-agent',
  remoteAddr: ':remote-addr',
  userId: ':user-id',
  requestId: ':request-id'
});

// Create write streams for different log levels
const accessLogStream = fs.createWriteStream(
  path.join(logsDir, 'access.log'),
  { flags: 'a' }
);

const errorLogStream = fs.createWriteStream(
  path.join(logsDir, 'error.log'),
  { flags: 'a' }
);

// Rotate logs daily
function rotateLogFiles() {
  const date = new Date().toISOString().split('T')[0];
  
  // Rotate access log
  const accessLogPath = path.join(logsDir, 'access.log');
  const rotatedAccessPath = path.join(logsDir, `access-${date}.log`);
  if (fs.existsSync(accessLogPath)) {
    fs.renameSync(accessLogPath, rotatedAccessPath);
  }
  
  // Rotate error log
  const errorLogPath = path.join(logsDir, 'error.log');
  const rotatedErrorPath = path.join(logsDir, `error-${date}.log`);
  if (fs.existsSync(errorLogPath)) {
    fs.renameSync(errorLogPath, rotatedErrorPath);
  }
  
  // Clean up old logs (keep 30 days)
  const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
  fs.readdirSync(logsDir).forEach(file => {
    const filePath = path.join(logsDir, file);
    const stats = fs.statSync(filePath);
    if (stats.isFile() && stats.mtimeMs < thirtyDaysAgo && file.includes('-')) {
      fs.unlinkSync(filePath);
    }
  });
}

// Schedule daily rotation
setInterval(rotateLogFiles, 24 * 60 * 60 * 1000);

// Request logging middleware
function requestLogger() {
  if (environments.isDevelopment) {
    return morgan(devFormat);
  } else {
    return morgan(productionFormat, { stream: accessLogStream });
  }
}

// Error logging middleware
function errorLogger(err, req, res, next) {
  const errorInfo = {
    timestamp: new Date().toISOString(),
    method: req.method,
    url: req.url,
    status: err.status || 500,
    error: {
      message: err.message,
      stack: environments.isProduction ? undefined : err.stack,
      code: err.code
    },
    userId: req.userId || 'anonymous',
    requestId: req.id,
    body: environments.isProduction ? undefined : req.body,
    query: req.query,
    params: req.params,
    headers: {
      'user-agent': req.headers['user-agent'],
      'content-type': req.headers['content-type'],
      'content-length': req.headers['content-length']
    },
    ip: req.ip || req.connection.remoteAddress
  };

  // Log to file
  errorLogStream.write(JSON.stringify(errorInfo) + '\n');

  // Log to console in development
  if (!environments.isProduction) {
    console.error('[Error]', errorInfo);
  }

  next(err);
}

// Response interceptor for detailed logging
function responseLogger(req, res, next) {
  // Store original methods
  const originalSend = res.send;
  const originalJson = res.json;
  const originalStatus = res.status;

  // Track response data
  let responseStatus = 200;
  let responseBody;

  // Override status method
  res.status = function(status) {
    responseStatus = status;
    return originalStatus.call(this, status);
  };

  // Override send method
  res.send = function(body) {
    responseBody = body;
    logResponse();
    return originalSend.call(this, body);
  };

  // Override json method
  res.json = function(body) {
    responseBody = body;
    logResponse();
    return originalJson.call(this, body);
  };

  // Log response details
  function logResponse() {
    if (environments.isProduction || req.method === 'GET') return;

    const logData = {
      timestamp: new Date().toISOString(),
      requestId: req.id,
      method: req.method,
      url: req.url,
      status: responseStatus,
      responseTime: Date.now() - req._startTime,
      userId: req.userId || 'anonymous',
      request: {
        body: req.body,
        query: req.query,
        params: req.params
      },
      response: {
        statusCode: responseStatus,
        body: responseStatus >= 400 ? responseBody : '[SUCCESS]'
      }
    };

    // Log errors to error log
    if (responseStatus >= 400) {
      errorLogStream.write(JSON.stringify(logData) + '\n');
    }
    
    // Log to console in development
    if (environments.isDevelopment) {
      console.log('[Response]', JSON.stringify(logData, null, 2));
    }
  }

  next();
}

// API analytics middleware
function apiAnalytics(req, res, next) {
  // Skip health checks and static files
  if (!req.url.startsWith('/api/') || req.url === '/health') {
    return next();
  }

  const startTime = Date.now();
  
  // Log request
  const requestLog = {
    timestamp: new Date().toISOString(),
    type: 'api_request',
    method: req.method,
    endpoint: req.url.split('?')[0],
    userId: req.userId || 'anonymous',
    ip: req.ip,
    userAgent: req.headers['user-agent']
  };

  // Track response
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const responseLog = {
      ...requestLog,
      type: 'api_response',
      status: res.statusCode,
      duration,
      success: res.statusCode < 400
    };

    // Write to analytics log
    if (environments.isProduction) {
      const analyticsStream = fs.createWriteStream(
        path.join(logsDir, 'analytics.log'),
        { flags: 'a' }
      );
      analyticsStream.write(JSON.stringify(responseLog) + '\n');
      analyticsStream.end();
    }
  });

  next();
}

module.exports = {
  requestLogger,
  errorLogger,
  responseLogger,
  apiAnalytics
};