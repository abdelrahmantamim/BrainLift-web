import logger from '../utils/serverLogger.js';

// Error sanitization middleware
export const sanitizeError = (err, req, res, next) => {
  // Log full error for debugging
  logger.error('Error', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    ip: req.ip,
    userId: req.user?.id
  });

  // Determine if we're in development mode
  const isDevelopment = process.env.NODE_ENV === 'development';

  // Default error response
  let statusCode = err.status || err.statusCode || 500;
  let errorResponse = {
    error: {
      message: 'An error occurred',
      code: 'INTERNAL_ERROR'
    }
  };

  // Map specific errors to safe messages
  const errorMap = {
    'ValidationError': {
      message: 'Invalid input provided',
      code: 'VALIDATION_ERROR',
      status: 400
    },
    'UnauthorizedError': {
      message: 'Authentication required',
      code: 'UNAUTHORIZED',
      status: 401
    },
    'ForbiddenError': {
      message: 'Access denied',
      code: 'FORBIDDEN',
      status: 403
    },
    'NotFoundError': {
      message: 'Resource not found',
      code: 'NOT_FOUND',
      status: 404
    },
    'ConflictError': {
      message: 'Resource conflict',
      code: 'CONFLICT',
      status: 409
    },
    'RateLimitError': {
      message: 'Too many requests',
      code: 'RATE_LIMIT',
      status: 429
    },
    'JsonWebTokenError': {
      message: 'Invalid token',
      code: 'INVALID_TOKEN',
      status: 401
    },
    'TokenExpiredError': {
      message: 'Token expired',
      code: 'TOKEN_EXPIRED',
      status: 401
    }
  };

  // Check for known error types
  const errorType = err.name || err.constructor.name;
  if (errorMap[errorType]) {
    statusCode = errorMap[errorType].status;
    errorResponse.error.message = errorMap[errorType].message;
    errorResponse.error.code = errorMap[errorType].code;
  } else {
    // Sanitize error messages in production
    if (!isDevelopment) {
      // Remove sensitive patterns from error messages
      const sensitivePatterns = [
        /password/i,
        /token/i,
        /secret/i,
        /key/i,
        /database/i,
        /connection/i,
        /ECONNREFUSED/,
        /ETIMEDOUT/,
        /\/[\w\/\-_.]+\.(js|ts|jsx|tsx)/g, // File paths
        /line \d+/gi, // Line numbers
        /column \d+/gi, // Column numbers
        /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, // IP addresses
        /:[0-9]+/g, // Port numbers
        /postgresql:\/\/[^@]+@/g, // Database URLs
        /https?:\/\/[^@]+@/g, // URLs with credentials
      ];

      let sanitizedMessage = err.message || 'An error occurred';
      sensitivePatterns.forEach(pattern => {
        sanitizedMessage = sanitizedMessage.replace(pattern, '[REDACTED]');
      });

      // Generic messages for common HTTP status codes
      const genericMessages = {
        400: 'Bad request',
        401: 'Authentication required',
        403: 'Access denied',
        404: 'Not found',
        409: 'Conflict',
        422: 'Validation failed',
        429: 'Too many requests',
        500: 'Internal server error',
        502: 'Service unavailable',
        503: 'Service unavailable',
        504: 'Request timeout'
      };

      errorResponse.error.message = genericMessages[statusCode] || sanitizedMessage;
    } else {
      // In development, provide more detail
      errorResponse = {
        error: {
          message: err.message,
          code: err.code || 'INTERNAL_ERROR',
          ...(err.errors && { errors: err.errors }),
          stack: err.stack
        }
      };
    }
  }

  // Add request ID for tracking
  if (req.id) {
    errorResponse.error.requestId = req.id;
  }

  // Send response
  res.status(statusCode).json(errorResponse);
};

// Async error wrapper
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Custom error classes
export class ValidationError extends Error {
  constructor(message, errors = null) {
    super(message);
    this.name = 'ValidationError';
    this.status = 400;
    this.errors = errors;
  }
}

export class UnauthorizedError extends Error {
  constructor(message = 'Authentication required') {
    super(message);
    this.name = 'UnauthorizedError';
    this.status = 401;
  }
}

export class ForbiddenError extends Error {
  constructor(message = 'Access denied') {
    super(message);
    this.name = 'ForbiddenError';
    this.status = 403;
  }
}

export class NotFoundError extends Error {
  constructor(message = 'Resource not found') {
    super(message);
    this.name = 'NotFoundError';
    this.status = 404;
  }
}

export class ConflictError extends Error {
  constructor(message = 'Resource conflict') {
    super(message);
    this.name = 'ConflictError';
    this.status = 409;
  }
}

export class RateLimitError extends Error {
  constructor(message = 'Too many requests') {
    super(message);
    this.name = 'RateLimitError';
    this.status = 429;
  }
}

export default {
  sanitizeError,
  asyncHandler,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  RateLimitError
};