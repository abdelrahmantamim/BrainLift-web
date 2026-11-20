import deviceFingerprintService from '../services/deviceFingerprint.service.js';
import logger from '../utils/serverLogger.js';

/**
 * Middleware to track device fingerprints
 */
export const trackDeviceFingerprint = async (req, res, next) => {
  try {
    // Skip if no user
    if (!req.user || !req.userId) {
      return next();
    }

    // Generate fingerprint
    const { fingerprint, components } = deviceFingerprintService.generateFingerprint(req);
    
    // Get client IP
    const ip = req.ip || req.connection.remoteAddress;
    
    // Record fingerprint asynchronously (don't block request)
    deviceFingerprintService.recordFingerprint(
      fingerprint,
      req.userId,
      ip,
      components
    ).catch(err => {
      logger.error('DeviceFingerprint', 'Failed to record fingerprint:', err);
    });

    // Attach fingerprint to request for downstream use
    req.deviceFingerprint = fingerprint;
    req.deviceInfo = components;

    next();
  } catch (error) {
    logger.error('DeviceFingerprint', 'Error in middleware:', error);
    // Don't block request on fingerprint errors
    next();
  }
};

/**
 * Middleware to check device trust for sensitive operations
 */
export const requireTrustedDevice = async (req, res, next) => {
  try {
    // Skip if no user
    if (!req.user || !req.userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Generate fingerprint if not already done
    if (!req.deviceFingerprint) {
      const { fingerprint } = deviceFingerprintService.generateFingerprint(req);
      req.deviceFingerprint = fingerprint;
    }

    // Check device trust
    const ip = req.ip || req.connection.remoteAddress;
    const trustResult = await deviceFingerprintService.checkDeviceTrust(
      req.deviceFingerprint,
      req.userId,
      ip
    );

    if (!trustResult.trusted) {
      logger.warn('DeviceFingerprint', 
        `Untrusted device detected for user ${req.userId}:`,
        trustResult
      );
      
      return res.status(403).json({
        error: 'Device not trusted',
        reason: trustResult.reason,
        details: trustResult.details
      });
    }

    next();
  } catch (error) {
    logger.error('DeviceFingerprint', 'Error checking device trust:', error);
    // Allow request on error to avoid blocking legitimate users
    next();
  }
};

/**
 * Middleware to check for referral fraud
 */
export const checkReferralFraud = async (req, res, next) => {
  try {
    const { referrerId } = req.body;
    const referredId = req.userId;

    if (!referrerId || !referredId) {
      return next();
    }

    const fraudCheck = await deviceFingerprintService.checkReferralFraud(
      referrerId,
      referredId
    );

    if (!fraudCheck.allowed) {
      logger.warn('DeviceFingerprint',
        `Referral fraud detected between ${referrerId} and ${referredId}:`,
        fraudCheck
      );
      
      return res.status(403).json({
        error: 'Referral not allowed',
        reason: fraudCheck.reason
      });
    }

    next();
  } catch (error) {
    logger.error('DeviceFingerprint', 'Error checking referral fraud:', error);
    // Allow request on error
    next();
  }
};