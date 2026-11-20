// Sensitive data filter for logging
const sensitiveFields = [
  'password',
  'token',
  'apiKey',
  'secret',
  'authorization',
  'cookie',
  'session',
  'creditCard',
  'ssn',
  'email',
  'phone',
  'address',
  'birthDate',
  'bankAccount',
  'privateKey',
  'passphrase'
];

const sensitivePatterns = [
  // Credit card numbers
  /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
  // SSN
  /\b\d{3}-\d{2}-\d{4}\b/g,
  // Email addresses (partial masking)
  /([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g,
  // Phone numbers
  /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g,
  // API keys (common patterns)
  /\b[A-Za-z0-9]{32,}\b/g,
  // JWT tokens
  /\beyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\b/g,
  // Basic auth headers
  /Basic\s+[A-Za-z0-9+/]+=*/g,
  // Bearer tokens
  /Bearer\s+[A-Za-z0-9-._~+/]+=*/g
];

// Deep clone object to avoid modifying original
const deepClone = (obj) => {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj.getTime());
  if (obj instanceof Array) return obj.map(item => deepClone(item));
  if (obj instanceof RegExp) return new RegExp(obj);
  
  const clonedObj = {};
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      clonedObj[key] = deepClone(obj[key]);
    }
  }
  return clonedObj;
};

// Filter sensitive data from objects
export const filterSensitiveData = (data, depth = 0) => {
  // Prevent infinite recursion
  if (depth > 10) return data;
  
  // Handle non-objects
  if (!data || typeof data !== 'object') {
    if (typeof data === 'string') {
      return filterSensitiveString(data);
    }
    return data;
  }
  
  // Clone to avoid modifying original
  const filtered = deepClone(data);
  
  // Handle arrays
  if (Array.isArray(filtered)) {
    return filtered.map(item => filterSensitiveData(item, depth + 1));
  }
  
  // Handle objects
  for (const key in filtered) {
    if (!filtered.hasOwnProperty(key)) continue;
    
    // Check if key name indicates sensitive data
    const lowerKey = key.toLowerCase();
    const isSensitiveField = sensitiveFields.some(field => 
      lowerKey.includes(field.toLowerCase())
    );
    
    if (isSensitiveField) {
      // Mask the entire value
      filtered[key] = '[REDACTED]';
    } else if (typeof filtered[key] === 'string') {
      // Check string content for sensitive patterns
      filtered[key] = filterSensitiveString(filtered[key]);
    } else if (typeof filtered[key] === 'object') {
      // Recursively filter nested objects
      filtered[key] = filterSensitiveData(filtered[key], depth + 1);
    }
  }
  
  return filtered;
};

// Filter sensitive patterns from strings
const filterSensitiveString = (str) => {
  let filtered = str;
  
  // Apply pattern-based filtering
  sensitivePatterns.forEach(pattern => {
    filtered = filtered.replace(pattern, (match) => {
      // Partial masking for some patterns
      if (pattern.source.includes('email')) {
        // Mask email but keep domain visible
        return match.replace(/([a-zA-Z0-9._%+-]+)@/, (m, p1) => {
          const visibleChars = Math.min(3, Math.floor(p1.length / 2));
          return p1.substring(0, visibleChars) + '***@';
        });
      }
      
      // Full masking for other patterns
      return '[REDACTED]';
    });
  });
  
  return filtered;
};

// Filter HTTP headers
export const filterHeaders = (headers) => {
  const filtered = { ...headers };
  const sensitiveHeaders = [
    'authorization',
    'cookie',
    'x-api-key',
    'x-auth-token',
    'x-csrf-token'
  ];
  
  for (const key in filtered) {
    if (sensitiveHeaders.includes(key.toLowerCase())) {
      filtered[key] = '[REDACTED]';
    }
  }
  
  return filtered;
};

// Filter URL query parameters
export const filterQueryParams = (url) => {
  try {
    const urlObj = new URL(url, 'http://example.com');
    const params = urlObj.searchParams;
    
    // List of sensitive parameter names
    const sensitiveParams = [
      'token',
      'key',
      'secret',
      'password',
      'auth',
      'session'
    ];
    
    // Filter sensitive parameters
    for (const [key, value] of params.entries()) {
      if (sensitiveParams.some(param => key.toLowerCase().includes(param))) {
        params.set(key, '[REDACTED]');
      }
    }
    
    urlObj.search = params.toString();
    return urlObj.pathname + urlObj.search;
  } catch (error) {
    // If URL parsing fails, return original
    return url;
  }
};

// Create filtered logger
export const createFilteredLogger = (logger) => {
  const filteredLogger = {};
  
  // Wrap each log level
  ['debug', 'info', 'warn', 'error', 'fatal'].forEach(level => {
    filteredLogger[level] = (message, ...args) => {
      // Filter the message
      const filteredMessage = typeof message === 'string' 
        ? filterSensitiveString(message)
        : message;
      
      // Filter additional arguments
      const filteredArgs = args.map(arg => {
        if (typeof arg === 'object') {
          return filterSensitiveData(arg);
        }
        if (typeof arg === 'string') {
          return filterSensitiveString(arg);
        }
        return arg;
      });
      
      // Call original logger
      logger[level](filteredMessage, ...filteredArgs);
    };
  });
  
  return filteredLogger;
};

// Express middleware for filtering logs
export const logFilterMiddleware = (req, res, next) => {
  // Store original values
  const originalUrl = req.url;
  const originalHeaders = req.headers;
  const originalBody = req.body;
  
  // Create filtered versions for logging
  req.filteredUrl = filterQueryParams(req.url);
  req.filteredHeaders = filterHeaders(req.headers);
  req.filteredBody = filterSensitiveData(req.body);
  
  // Restore original values (in case they were modified)
  req.url = originalUrl;
  req.headers = originalHeaders;
  req.body = originalBody;
  
  next();
};

// Audit log formatter
export const formatAuditLog = (event) => {
  const filtered = filterSensitiveData(event);
  
  return {
    timestamp: new Date().toISOString(),
    eventType: filtered.type,
    userId: filtered.userId,
    ip: filtered.ip,
    userAgent: filtered.userAgent,
    action: filtered.action,
    resource: filtered.resource,
    result: filtered.result,
    metadata: filtered.metadata || {}
  };
};

export default {
  filterSensitiveData,
  filterHeaders,
  filterQueryParams,
  createFilteredLogger,
  logFilterMiddleware,
  formatAuditLog
};