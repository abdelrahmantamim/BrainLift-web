import crypto from 'crypto';
import logger from './serverLogger.js';

// Secrets manager for secure API key handling
class SecretsManager {
  constructor() {
    this.encryptionKey = process.env.SECRETS_ENCRYPTION_KEY;
    
    if (!this.encryptionKey) {
      // Generate a key if not provided (not recommended for production)
      logger.warn('SecretsManager', 'No SECRETS_ENCRYPTION_KEY found, generating temporary key');
      this.encryptionKey = crypto.randomBytes(32).toString('hex');
    }
    
    this.algorithm = 'aes-256-gcm';
    this.saltLength = 64;
    this.tagLength = 16;
    this.iterations = 100000;
  }

  // Encrypt a secret
  encrypt(text) {
    try {
      const salt = crypto.randomBytes(this.saltLength);
      const key = crypto.pbkdf2Sync(this.encryptionKey, salt, this.iterations, 32, 'sha256');
      const iv = crypto.randomBytes(16);
      
      const cipher = crypto.createCipheriv(this.algorithm, key, iv);
      
      const encrypted = Buffer.concat([
        cipher.update(text, 'utf8'),
        cipher.final()
      ]);
      
      const tag = cipher.getAuthTag();
      
      return Buffer.concat([salt, iv, tag, encrypted]).toString('base64');
    } catch (error) {
      logger.error('SecretsManager', 'Encryption failed:', error);
      throw new Error('Failed to encrypt secret');
    }
  }

  // Decrypt a secret
  decrypt(encryptedText) {
    try {
      const buffer = Buffer.from(encryptedText, 'base64');
      
      const salt = buffer.slice(0, this.saltLength);
      const iv = buffer.slice(this.saltLength, this.saltLength + 16);
      const tag = buffer.slice(this.saltLength + 16, this.saltLength + 16 + this.tagLength);
      const encrypted = buffer.slice(this.saltLength + 16 + this.tagLength);
      
      const key = crypto.pbkdf2Sync(this.encryptionKey, salt, this.iterations, 32, 'sha256');
      
      const decipher = crypto.createDecipheriv(this.algorithm, key, iv);
      decipher.setAuthTag(tag);
      
      return decipher.update(encrypted) + decipher.final('utf8');
    } catch (error) {
      logger.error('SecretsManager', 'Decryption failed:', error);
      throw new Error('Failed to decrypt secret');
    }
  }

  // Rotate encryption key
  async rotateKey(newKey, secrets) {
    const results = [];
    
    for (const [name, encryptedValue] of Object.entries(secrets)) {
      try {
        // Decrypt with old key
        const decrypted = this.decrypt(encryptedValue);
        
        // Update key
        this.encryptionKey = newKey;
        
        // Encrypt with new key
        const reencrypted = this.encrypt(decrypted);
        
        results.push({
          name,
          success: true,
          newValue: reencrypted
        });
      } catch (error) {
        results.push({
          name,
          success: false,
          error: error.message
        });
      }
    }
    
    return results;
  }

  // Generate secure API key
  generateApiKey(prefix = 'sk') {
    const randomBytes = crypto.randomBytes(32);
    const timestamp = Date.now().toString(36);
    const key = `${prefix}_${timestamp}_${randomBytes.toString('base64url')}`;
    return key;
  }

  // Hash API key for storage
  hashApiKey(apiKey) {
    return crypto
      .createHash('sha256')
      .update(apiKey)
      .digest('hex');
  }

  // Validate API key format
  validateApiKeyFormat(apiKey) {
    // Expected format: prefix_timestamp_randomstring
    const pattern = /^[a-z]{2,}_[a-z0-9]+_[A-Za-z0-9_-]+$/;
    return pattern.test(apiKey);
  }

  // Create secure token
  createSecureToken(payload, expiresIn = '1h') {
    const header = {
      alg: 'HS256',
      typ: 'JWT'
    };
    
    const now = Math.floor(Date.now() / 1000);
    const expirationTime = this.parseExpiration(expiresIn);
    
    const claims = {
      ...payload,
      iat: now,
      exp: now + expirationTime,
      jti: crypto.randomBytes(16).toString('hex')
    };
    
    const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
    const encodedPayload = Buffer.from(JSON.stringify(claims)).toString('base64url');
    
    const signature = crypto
      .createHmac('sha256', this.encryptionKey)
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest('base64url');
    
    return `${encodedHeader}.${encodedPayload}.${signature}`;
  }

  // Parse expiration time
  parseExpiration(expiration) {
    const units = {
      s: 1,
      m: 60,
      h: 3600,
      d: 86400,
      w: 604800
    };
    
    const match = expiration.match(/^(\d+)([smhdw])$/);
    if (!match) {
      throw new Error('Invalid expiration format');
    }
    
    const [, value, unit] = match;
    return parseInt(value) * units[unit];
  }

  // Secure compare to prevent timing attacks
  secureCompare(a, b) {
    if (a.length !== b.length) {
      return false;
    }
    
    return crypto.timingSafeEqual(
      Buffer.from(a),
      Buffer.from(b)
    );
  }

  // Mask sensitive data for logging
  maskSensitive(data, fieldsToMask = ['password', 'token', 'apiKey', 'secret']) {
    if (typeof data !== 'object' || data === null) {
      return data;
    }
    
    const masked = Array.isArray(data) ? [...data] : { ...data };
    
    for (const key in masked) {
      if (fieldsToMask.some(field => key.toLowerCase().includes(field.toLowerCase()))) {
        masked[key] = '***REDACTED***';
      } else if (typeof masked[key] === 'object') {
        masked[key] = this.maskSensitive(masked[key], fieldsToMask);
      }
    }
    
    return masked;
  }

  // Generate CSRF token
  generateCSRFToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  // Validate CSRF token
  validateCSRFToken(token, sessionToken) {
    if (!token || !sessionToken) {
      return false;
    }
    
    return this.secureCompare(token, sessionToken);
  }
}

// Singleton instance
let instance = null;

export const getSecretsManager = () => {
  if (!instance) {
    instance = new SecretsManager();
  }
  return instance;
};

// Environment variable validation
export const validateEnvironmentSecrets = () => {
  const requiredSecrets = [
    'JWT_SECRET',
    'BETTER_AUTH_SECRET',
    'SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY'
  ];
  
  const warnings = [];
  const errors = [];
  
  for (const secret of requiredSecrets) {
    if (!process.env[secret]) {
      errors.push(`Missing required secret: ${secret}`);
    } else if (process.env[secret].length < 32) {
      warnings.push(`Secret ${secret} appears to be weak (less than 32 characters)`);
    }
  }
  
  // Check for default/example values
  const defaultPatterns = [
    /example/i,
    /default/i,
    /changeme/i,
    /your-/i,
    /xxx/i,
    /123456/,
    /password/i
  ];
  
  for (const [key, value] of Object.entries(process.env)) {
    if (key.includes('SECRET') || key.includes('KEY') || key.includes('TOKEN')) {
      for (const pattern of defaultPatterns) {
        if (pattern.test(value)) {
          warnings.push(`${key} appears to contain a default/example value`);
        }
      }
    }
  }
  
  return { errors, warnings };
};

// API key management
export class APIKeyManager {
  constructor() {
    this.secretsManager = getSecretsManager();
  }

  // Create new API key
  async create(userId, name, permissions = []) {
    const apiKey = this.secretsManager.generateApiKey();
    const hashedKey = this.secretsManager.hashApiKey(apiKey);
    
    const keyData = {
      id: crypto.randomUUID(),
      userId,
      name,
      hashedKey,
      permissions,
      createdAt: new Date(),
      lastUsedAt: null,
      expiresAt: null
    };
    
    // Return both the key data and the actual key (only shown once)
    return {
      keyData,
      apiKey
    };
  }

  // Validate API key
  async validate(apiKey) {
    if (!this.secretsManager.validateApiKeyFormat(apiKey)) {
      return { valid: false, error: 'Invalid API key format' };
    }
    
    const hashedKey = this.secretsManager.hashApiKey(apiKey);
    
    // Here you would check the database for the hashed key
    // This is a placeholder for the actual implementation
    
    return {
      valid: true,
      userId: 'user-id',
      permissions: ['read', 'write']
    };
  }

  // Revoke API key
  async revoke(keyId) {
    // Database operation to mark key as revoked
    logger.info('APIKeyManager', `API key ${keyId} revoked`);
    return true;
  }
}

export default {
  getSecretsManager,
  validateEnvironmentSecrets,
  APIKeyManager
};