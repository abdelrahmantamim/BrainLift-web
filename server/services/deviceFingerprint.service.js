import crypto from 'crypto';
import { getSupabase } from '../config/services.config.js';
import logger from '../utils/serverLogger.js';
import { UAParser } from 'ua-parser-js';

class DeviceFingerprintService {
  constructor() {
    this.supabase = null;
    this.fingerprintCache = new Map();
    this.cacheTTL = 5 * 60 * 1000; // 5 minutes
  }

  getSupabaseClient() {
    if (!this.supabase) {
      try {
        this.supabase = getSupabase();
      } catch (error) {
        logger.error('DeviceFingerprint', 'Failed to initialize Supabase:', error);
      }
    }
    return this.supabase;
  }

  /**
   * Generate device fingerprint from request
   */
  generateFingerprint(req) {
    const components = [];

    // User agent parsing
    const parser = new UAParser(req.headers['user-agent']);
    const ua = parser.getResult();
    
    // Core components
    components.push(ua.browser.name || 'unknown');
    components.push(ua.browser.version || 'unknown');
    components.push(ua.os.name || 'unknown');
    components.push(ua.os.version || 'unknown');
    components.push(ua.device.type || 'desktop');
    components.push(ua.device.vendor || 'unknown');
    components.push(ua.device.model || 'unknown');
    
    // Headers for additional entropy
    components.push(req.headers['accept-language'] || 'unknown');
    components.push(req.headers['accept-encoding'] || 'unknown');
    
    // Screen resolution from client (if provided)
    if (req.body?.deviceInfo) {
      components.push(req.body.deviceInfo.screenWidth || 'unknown');
      components.push(req.body.deviceInfo.screenHeight || 'unknown');
      components.push(req.body.deviceInfo.colorDepth || 'unknown');
      components.push(req.body.deviceInfo.timezone || 'unknown');
    }

    // Create hash
    const fingerprintString = components.join('|');
    const fingerprint = crypto
      .createHash('sha256')
      .update(fingerprintString)
      .digest('hex');

    return {
      fingerprint,
      components: {
        browser: `${ua.browser.name} ${ua.browser.version}`,
        os: `${ua.os.name} ${ua.os.version}`,
        device: ua.device.type || 'desktop',
        deviceModel: ua.device.model || 'unknown',
        userAgent: req.headers['user-agent']
      }
    };
  }

  /**
   * Check if device is suspicious based on fingerprint patterns
   */
  async checkDeviceTrust(fingerprint, userId, ip) {
    try {
      const supabase = this.getSupabaseClient();
      if (!supabase) return { trusted: true, reason: 'service_unavailable' };

      // Check cache first
      const cacheKey = `${fingerprint}:${userId}`;
      const cached = this.fingerprintCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
        return cached.result;
      }

      // Check for multiple accounts on same device
      const { data: deviceUsers, error: deviceError } = await supabase
        .from('device_fingerprints')
        .select('user_id, created_at')
        .eq('fingerprint', fingerprint)
        .order('created_at', { ascending: false });

      if (deviceError) {
        logger.error('DeviceFingerprint', 'Failed to check device users:', deviceError);
        return { trusted: true, reason: 'check_failed' };
      }

      // Check for suspicious patterns
      const uniqueUsers = new Set(deviceUsers?.map(d => d.user_id) || []);
      const accountsOnDevice = uniqueUsers.size;

      // Flag if too many accounts on same device
      if (accountsOnDevice > 5) {
        return {
          trusted: false,
          reason: 'too_many_accounts',
          details: {
            accountCount: accountsOnDevice,
            threshold: 5
          }
        };
      }

      // Check for rapid account creation
      const recentAccounts = deviceUsers?.filter(d => {
        const hoursSinceCreation = (Date.now() - new Date(d.created_at).getTime()) / (1000 * 60 * 60);
        return hoursSinceCreation < 24;
      }) || [];

      if (recentAccounts.length > 3) {
        return {
          trusted: false,
          reason: 'rapid_account_creation',
          details: {
            recentAccountCount: recentAccounts.length,
            timeWindow: '24 hours',
            threshold: 3
          }
        };
      }

      // Check for IP/device mismatch patterns
      const { data: ipHistory } = await supabase
        .from('device_fingerprints')
        .select('ip_address')
        .eq('fingerprint', fingerprint)
        .eq('user_id', userId)
        .order('last_seen', { ascending: false })
        .limit(10);

      const uniqueIPs = new Set(ipHistory?.map(h => h.ip_address) || []);
      if (uniqueIPs.size > 5) {
        return {
          trusted: false,
          reason: 'suspicious_ip_pattern',
          details: {
            uniqueIPCount: uniqueIPs.size,
            threshold: 5
          }
        };
      }

      // Device is trusted
      const result = { trusted: true, reason: 'passed_checks' };
      
      // Cache the result
      this.fingerprintCache.set(cacheKey, {
        result,
        timestamp: Date.now()
      });

      return result;
    } catch (error) {
      logger.error('DeviceFingerprint', 'Error checking device trust:', error);
      return { trusted: true, reason: 'error' };
    }
  }

  /**
   * Record device fingerprint
   */
  async recordFingerprint(fingerprint, userId, ip, components) {
    try {
      const supabase = this.getSupabaseClient();
      if (!supabase) return false;

      // First, check if the fingerprint exists
      const { data: existing } = await supabase
        .from('device_fingerprints')
        .select('access_count')
        .eq('fingerprint', fingerprint)
        .eq('user_id', userId)
        .single();

      // Upsert device fingerprint with incremented count
      const { error } = await supabase
        .from('device_fingerprints')
        .upsert({
          fingerprint: fingerprint,
          user_id: userId,
          ip_address: ip,
          device_info: components,
          last_seen: new Date().toISOString(),
          access_count: existing ? existing.access_count + 1 : 1
        }, {
          onConflict: 'fingerprint,user_id'
        });

      if (error) {
        logger.error('DeviceFingerprint', 'Failed to record fingerprint:', error);
        return false;
      }

      return true;
    } catch (error) {
      logger.error('DeviceFingerprint', 'Error recording fingerprint:', error);
      return false;
    }
  }

  /**
   * Check for referral fraud
   */
  async checkReferralFraud(referrerId, referredId) {
    try {
      const supabase = this.getSupabaseClient();
      if (!supabase) return { allowed: true };

      // Get fingerprints for both users
      const { data: referrerDevices } = await supabase
        .from('device_fingerprints')
        .select('fingerprint')
        .eq('user_id', referrerId);

      const { data: referredDevices } = await supabase
        .from('device_fingerprints')
        .select('fingerprint')
        .eq('user_id', referredId);

      if (!referrerDevices || !referredDevices) {
        return { allowed: true };
      }

      // Check for shared devices
      const referrerFingerprints = new Set(referrerDevices.map(d => d.fingerprint));
      const sharedDevices = referredDevices.filter(d => 
        referrerFingerprints.has(d.fingerprint)
      );

      if (sharedDevices.length > 0) {
        logger.warn('DeviceFingerprint', `Referral fraud detected: users ${referrerId} and ${referredId} share devices`);
        return {
          allowed: false,
          reason: 'shared_device',
          sharedFingerprints: sharedDevices.map(d => d.fingerprint)
        };
      }

      return { allowed: true };
    } catch (error) {
      logger.error('DeviceFingerprint', 'Error checking referral fraud:', error);
      return { allowed: true };
    }
  }

  /**
   * Get device history for a user
   */
  async getUserDeviceHistory(userId) {
    try {
      const supabase = this.getSupabaseClient();
      if (!supabase) return [];

      const { data: devices, error } = await supabase
        .from('device_fingerprints')
        .select('*')
        .eq('user_id', userId)
        .order('last_seen', { ascending: false });

      if (error) {
        logger.error('DeviceFingerprint', 'Failed to get device history:', error);
        return [];
      }

      return devices || [];
    } catch (error) {
      logger.error('DeviceFingerprint', 'Error getting device history:', error);
      return [];
    }
  }

  /**
   * Clean up old fingerprint data
   */
  async cleanupOldFingerprints(daysToKeep = 90) {
    try {
      const supabase = this.getSupabaseClient();
      if (!supabase) return;

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const { error } = await supabase
        .from('device_fingerprints')
        .delete()
        .lt('last_seen', cutoffDate.toISOString());

      if (error) {
        logger.error('DeviceFingerprint', 'Failed to cleanup old fingerprints:', error);
      } else {
        logger.info('DeviceFingerprint', `Cleaned up fingerprints older than ${daysToKeep} days`);
      }
    } catch (error) {
      logger.error('DeviceFingerprint', 'Error cleaning up fingerprints:', error);
    }
  }
}

// Create singleton instance
const deviceFingerprintService = new DeviceFingerprintService();

// Schedule cleanup every 24 hours
setInterval(() => {
  deviceFingerprintService.cleanupOldFingerprints();
}, 24 * 60 * 60 * 1000);

export default deviceFingerprintService;