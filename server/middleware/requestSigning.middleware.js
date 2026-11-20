import crypto from 'crypto';
import logger from '../utils/serverLogger.js';

// Request signing configuration
const SIGNATURE_HEADER = 'X-Signature';
const TIMESTAMP_HEADER = 'X-Timestamp';
const REQUEST_ID_HEADER = 'X-Request-ID';
const SIGNATURE_ALGORITHM = 'sha256';
const MAX_TIMESTAMP_AGE = 5 * 60 * 1000; // 5 minutes

// Generate signature for request
export const generateSignature = (payload, timestamp, secret) => {
  const message = `${timestamp}.${JSON.stringify(payload)}`;
  return crypto
    .createHmac(SIGNATURE_ALGORITHM, secret)
    .update(message)
    .digest('hex');
};

// Verify request signature
export const verifySignature = (secret) => {
  return (req, res, next) => {
    // Skip signature verification for non-critical endpoints
    const criticalEndpoints = [
      '/api/auth/delete-account',
      '/api/auth/change-password',
      '/api/profile/update-email',
      '/api/files/delete',
      '/api/quiz/delete',
      '/api/flashcards/delete',
      '/api/admin/',
      '/api/notifications/send',
      '/api/user/delete'
    ];

    const isCriticalEndpoint = criticalEndpoints.some(endpoint => 
      req.path.startsWith(endpoint)
    );

    if (!isCriticalEndpoint) {
      return next();
    }

    try {
      const signature = req.headers[SIGNATURE_HEADER.toLowerCase()];
      const timestamp = req.headers[TIMESTAMP_HEADER.toLowerCase()];
      const requestId = req.headers[REQUEST_ID_HEADER.toLowerCase()];

      // Check if headers are present
      if (!signature || !timestamp) {
        logger.warn('RequestSigning', `Missing signature headers for ${req.path}`);
        return res.status(400).json({
          error: {
            message: 'Request signature required',
            code: 'MISSING_SIGNATURE'
          }
        });
      }

      // Validate timestamp
      const requestTime = parseInt(timestamp, 10);
      const currentTime = Date.now();
      
      if (isNaN(requestTime)) {
        return res.status(400).json({
          error: {
            message: 'Invalid timestamp',
            code: 'INVALID_TIMESTAMP'
          }
        });
      }

      // Check timestamp age
      if (Math.abs(currentTime - requestTime) > MAX_TIMESTAMP_AGE) {
        logger.warn('RequestSigning', `Expired timestamp for ${req.path}`);
        return res.status(400).json({
          error: {
            message: 'Request expired',
            code: 'REQUEST_EXPIRED'
          }
        });
      }

      // Check for replay attacks using request ID
      if (requestId) {
        // In production, you would check a cache/database for used request IDs
        // For now, we'll just validate the format
        const requestIdPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
        if (!requestIdPattern.test(requestId)) {
          return res.status(400).json({
            error: {
              message: 'Invalid request ID',
              code: 'INVALID_REQUEST_ID'
            }
          });
        }
      }

      // Get signing secret
      const signingSecret = process.env.REQUEST_SIGNING_SECRET || process.env.BETTER_AUTH_SECRET;
      if (!signingSecret) {
        logger.error('RequestSigning', 'No signing secret configured');
        return res.status(500).json({
          error: {
            message: 'Server configuration error',
            code: 'CONFIG_ERROR'
          }
        });
      }

      // Calculate expected signature
      const payload = req.method === 'GET' ? req.query : req.body;
      const expectedSignature = generateSignature(payload, timestamp, signingSecret);

      // Timing-safe comparison
      if (!crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      )) {
        logger.warn('RequestSigning', `Invalid signature for ${req.path} from ${req.ip}`);
        return res.status(401).json({
          error: {
            message: 'Invalid signature',
            code: 'INVALID_SIGNATURE'
          }
        });
      }

      // Attach request metadata
      req.signatureVerified = true;
      req.requestId = requestId;
      req.requestTimestamp = requestTime;

      logger.info('RequestSigning', `Verified signature for ${req.path}`);
      next();
    } catch (error) {
      logger.error('RequestSigning', 'Signature verification error:', error);
      return res.status(500).json({
        error: {
          message: 'Signature verification failed',
          code: 'VERIFICATION_ERROR'
        }
      });
    }
  };
};

// Client-side helper to sign requests
export const signRequest = (method, url, body, secret) => {
  const timestamp = Date.now();
  const requestId = crypto.randomUUID();
  const payload = method === 'GET' ? {} : body;
  
  const signature = generateSignature(payload, timestamp, secret);
  
  return {
    headers: {
      [SIGNATURE_HEADER]: signature,
      [TIMESTAMP_HEADER]: timestamp.toString(),
      [REQUEST_ID_HEADER]: requestId
    }
  };
};

// Middleware to add signature info to responses
export const addSignatureInfo = (req, res, next) => {
  if (req.signatureVerified) {
    res.setHeader('X-Signature-Verified', 'true');
    res.setHeader('X-Request-ID', req.requestId || '');
  }
  next();
};

// Generate client signing secret (one-time operation)
export const generateClientSecret = () => {
  return crypto.randomBytes(32).toString('hex');
};

// Validate webhook signatures (for external services)
export const validateWebhookSignature = (secret, headerName = 'X-Webhook-Signature') => {
  return (req, res, next) => {
    try {
      const signature = req.headers[headerName.toLowerCase()];
      
      if (!signature) {
        return res.status(401).json({
          error: {
            message: 'Missing webhook signature',
            code: 'MISSING_WEBHOOK_SIGNATURE'
          }
        });
      }

      // Calculate expected signature
      const payload = JSON.stringify(req.body);
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex');

      // Timing-safe comparison
      if (!crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      )) {
        logger.warn('WebhookValidation', `Invalid webhook signature from ${req.ip}`);
        return res.status(401).json({
          error: {
            message: 'Invalid webhook signature',
            code: 'INVALID_WEBHOOK_SIGNATURE'
          }
        });
      }

      next();
    } catch (error) {
      logger.error('WebhookValidation', 'Webhook validation error:', error);
      return res.status(500).json({
        error: {
          message: 'Webhook validation failed',
          code: 'WEBHOOK_VALIDATION_ERROR'
        }
      });
    }
  };
};

export default {
  generateSignature,
  verifySignature,
  signRequest,
  addSignatureInfo,
  generateClientSecret,
  validateWebhookSignature
};