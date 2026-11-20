const environments = require('./environments');
const fs = require('fs');
const path = require('path');

// PostHog client (module-level)
let posthogClient = null;

// Metrics storage
const metrics = {
  requests: new Map(),
  errors: new Map(),
  performance: new Map(),
  custom: new Map()
};

// Initialize monitoring
function initializeMonitoring() {
  if (process.env.POSTHOG_API_KEY) {
    try {
      const { PostHog } = require('posthog-node');

      posthogClient = new PostHog(process.env.POSTHOG_API_KEY, {
        host: process.env.POSTHOG_HOST || 'https://us.i.posthog.com',
      });

      console.log('[Monitoring] PostHog initialized');
      return posthogClient;
    } catch (error) {
      console.error('[Monitoring] Failed to initialize PostHog:', error);
    }
  }

  console.log('[Monitoring] Running without PostHog (local monitoring only)');
  return null;
}

// Track API request
function trackRequest(req, res) {
  const endpoint = `${req.method} ${req.path}`;
  const timestamp = new Date().toISOString();
  const duration = Date.now() - req._startTime;

  // Store request metrics
  if (!metrics.requests.has(endpoint)) {
    metrics.requests.set(endpoint, {
      count: 0,
      totalDuration: 0,
      errors: 0,
      statusCodes: {}
    });
  }

  const metric = metrics.requests.get(endpoint);
  metric.count++;
  metric.totalDuration += duration;

  if (!metric.statusCodes[res.statusCode]) {
    metric.statusCodes[res.statusCode] = 0;
  }
  metric.statusCodes[res.statusCode]++;

  if (res.statusCode >= 400) {
    metric.errors++;
  }

  // Track performance
  const perfKey = `${timestamp.slice(0, 13)}:00:00`; // Hour bucket
  if (!metrics.performance.has(perfKey)) {
    metrics.performance.set(perfKey, {
      requests: 0,
      avgDuration: 0,
      errors: 0
    });
  }

  const perf = metrics.performance.get(perfKey);
  perf.requests++;
  perf.avgDuration = ((perf.avgDuration * (perf.requests - 1)) + duration) / perf.requests;
  if (res.statusCode >= 400) {
    perf.errors++;
  }
}

// Track error
function trackError(error, req = {}) {
  const timestamp = new Date().toISOString();
  const errorKey = error.message || 'Unknown error';

  if (!metrics.errors.has(errorKey)) {
    metrics.errors.set(errorKey, {
      count: 0,
      firstSeen: timestamp,
      lastSeen: timestamp,
      endpoints: new Set()
    });
  }

  const metric = metrics.errors.get(errorKey);
  metric.count++;
  metric.lastSeen = timestamp;
  if (req.path) {
    metric.endpoints.add(`${req.method} ${req.path}`);
  }

  // Log to file in production
  if (environments.isProduction) {
    const errorLog = {
      timestamp,
      error: {
        message: error.message,
        stack: error.stack,
        code: error.code
      },
      request: {
        method: req.method,
        path: req.path,
        userId: req.userId,
        ip: req.ip
      }
    };

    const logsDir = path.join(__dirname, '../logs');
    fs.appendFileSync(
      path.join(logsDir, 'errors.log'),
      JSON.stringify(errorLog) + '\n'
    );
  }
}

// Track custom metric
function trackMetric(name, value, tags = {}) {
  const timestamp = new Date().toISOString();
  const key = `${name}:${JSON.stringify(tags)}`;

  if (!metrics.custom.has(key)) {
    metrics.custom.set(key, {
      values: [],
      tags
    });
  }

  metrics.custom.get(key).values.push({
    value,
    timestamp
  });
}

// Get metrics summary
function getMetricsSummary() {
  const summary = {
    requests: {},
    errors: [],
    performance: {},
    custom: {}
  };

  // Aggregate request metrics
  for (const [endpoint, data] of metrics.requests.entries()) {
    summary.requests[endpoint] = {
      count: data.count,
      avgDuration: Math.round(data.totalDuration / data.count),
      errorRate: Math.round((data.errors / data.count) * 100),
      statusCodes: data.statusCodes
    };
  }

  // Top errors
  const errorArray = Array.from(metrics.errors.entries())
    .map(([message, data]) => ({
      message,
      count: data.count,
      firstSeen: data.firstSeen,
      lastSeen: data.lastSeen,
      endpoints: Array.from(data.endpoints)
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  summary.errors = errorArray;

  // Recent performance
  const perfKeys = Array.from(metrics.performance.keys())
    .sort()
    .slice(-24); // Last 24 hours

  for (const key of perfKeys) {
    const data = metrics.performance.get(key);
    summary.performance[key] = {
      requests: data.requests,
      avgDuration: Math.round(data.avgDuration),
      errorRate: Math.round((data.errors / data.requests) * 100)
    };
  }

  // Custom metrics
  for (const [key, data] of metrics.custom.entries()) {
    const [name] = key.split(':');
    if (!summary.custom[name]) {
      summary.custom[name] = [];
    }

    const recentValues = data.values.slice(-100);
    const avg = recentValues.reduce((sum, v) => sum + v.value, 0) / recentValues.length;

    summary.custom[name].push({
      tags: data.tags,
      count: data.values.length,
      average: avg,
      latest: recentValues[recentValues.length - 1]
    });
  }

  return summary;
}

// Clean old metrics (keep last 24 hours)
function cleanOldMetrics() {
  const cutoff = Date.now() - (24 * 60 * 60 * 1000);
  const cutoffDate = new Date(cutoff).toISOString();

  // Clean performance metrics
  for (const [key, data] of metrics.performance.entries()) {
    if (key < cutoffDate) {
      metrics.performance.delete(key);
    }
  }

  // Clean custom metrics
  for (const [key, data] of metrics.custom.entries()) {
    data.values = data.values.filter(v => v.timestamp > cutoffDate);
    if (data.values.length === 0) {
      metrics.custom.delete(key);
    }
  }
}

// Schedule cleanup
setInterval(cleanOldMetrics, 60 * 60 * 1000); // Every hour

// Express middleware
function monitoringMiddleware(req, res, next) {
  // Skip health checks
  if (req.path === '/health' || req.path === '/ready' || req.path === '/live') {
    return next();
  }

  // Track on response finish
  res.on('finish', () => {
    trackRequest(req, res);
  });

  next();
}

// Error tracking middleware
function errorTrackingMiddleware(err, req, res, next) {
  trackError(err, req);

  // Send to PostHog if available
  if (posthogClient) {
    const distinctId = req.userId || 'anonymous';
    posthogClient.capture({
      distinctId,
      event: '$exception',
      properties: {
        $exception_message: err.message,
        $exception_stack_trace: err.stack,
        $exception_type: err.name || 'Error',
        request_method: req.method,
        request_url: req.url,
        request_path: req.path,
        status_code: res.statusCode,
      },
    });
  }

  next(err);
}

// Shutdown monitoring (flush PostHog events)
async function shutdownMonitoring() {
  if (posthogClient) {
    await posthogClient.shutdown();
    console.log('[Monitoring] PostHog shut down');
  }
}

module.exports = {
  initializeMonitoring,
  shutdownMonitoring,
  trackRequest,
  trackError,
  trackMetric,
  getMetricsSummary,
  monitoringMiddleware,
  errorTrackingMiddleware
};