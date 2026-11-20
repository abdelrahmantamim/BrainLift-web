import zxcvbn from 'zxcvbn';
import logger from './serverLogger.js';

// Password policy configuration
const passwordPolicy = {
  minLength: 8,
  maxLength: 128,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
  minStrengthScore: 3, // zxcvbn score (0-4)
  preventCommonPasswords: true,
  preventUserInfoInPassword: true,
  preventRepeatingChars: 3,
  preventSequentialChars: 3,
  passwordHistory: 5, // Number of previous passwords to check
  maxAge: 90 * 24 * 60 * 60 * 1000, // 90 days in milliseconds
};

// Common passwords to block (top 100)
const commonPasswords = [
  'password', '123456', 'password123', 'admin', 'letmein',
  'welcome', 'monkey', '1234567890', 'qwerty', 'abc123',
  'Password1', 'password1', '123456789', 'welcome123',
  'admin123', 'root', 'toor', 'pass', 'test', 'guest',
  'master', 'hello', 'hello123', '1234', '12345',
  'default', 'changeme', 'test123', 'demo', 'oracle',
  'temp', 'temp123', 'password!', 'Password123',
  'qwerty123', 'zxcvbnm', 'asdfghjkl', 'password1234'
];

// Special characters allowed in passwords
const specialChars = '!@#$%^&*()_+-=[]{}|;:,.<>?';

// Validate password against policy
export const validatePassword = (password, userInfo = {}) => {
  const errors = [];
  const warnings = [];

  // Check if password is provided
  if (!password) {
    errors.push('Password is required');
    return { valid: false, errors, warnings, score: 0 };
  }

  // Check length
  if (password.length < passwordPolicy.minLength) {
    errors.push(`Password must be at least ${passwordPolicy.minLength} characters long`);
  }
  if (password.length > passwordPolicy.maxLength) {
    errors.push(`Password must not exceed ${passwordPolicy.maxLength} characters`);
  }

  // Check character requirements
  if (passwordPolicy.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (passwordPolicy.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (passwordPolicy.requireNumbers && !/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  if (passwordPolicy.requireSpecialChars && !new RegExp(`[${specialChars.replace(/[\[\]\\]/g, '\\$&')}]`).test(password)) {
    errors.push('Password must contain at least one special character');
  }

  // Check for common passwords
  if (passwordPolicy.preventCommonPasswords) {
    const lowerPassword = password.toLowerCase();
    if (commonPasswords.some(common => lowerPassword.includes(common))) {
      errors.push('Password is too common or contains common words');
    }
  }

  // Check for user info in password
  if (passwordPolicy.preventUserInfoInPassword && userInfo) {
    const userFields = [
      userInfo.email,
      userInfo.username,
      userInfo.firstName,
      userInfo.lastName,
      userInfo.name
    ].filter(Boolean).map(field => field.toLowerCase());

    for (const field of userFields) {
      if (field && password.toLowerCase().includes(field)) {
        errors.push('Password must not contain your personal information');
        break;
      }
    }
  }

  // Check for repeating characters
  if (passwordPolicy.preventRepeatingChars) {
    const repeatPattern = new RegExp(`(.)\\1{${passwordPolicy.preventRepeatingChars - 1},}`);
    if (repeatPattern.test(password)) {
      errors.push(`Password must not contain ${passwordPolicy.preventRepeatingChars} or more repeating characters`);
    }
  }

  // Check for sequential characters
  if (passwordPolicy.preventSequentialChars) {
    if (hasSequentialChars(password, passwordPolicy.preventSequentialChars)) {
      warnings.push(`Password contains ${passwordPolicy.preventSequentialChars} or more sequential characters`);
    }
  }

  // Check password strength using zxcvbn
  const strengthResult = zxcvbn(password, [
    ...(userInfo.email ? [userInfo.email] : []),
    ...(userInfo.username ? [userInfo.username] : []),
    ...(userInfo.name ? userInfo.name.split(' ') : [])
  ]);

  if (strengthResult.score < passwordPolicy.minStrengthScore) {
    errors.push('Password is not strong enough');
    
    // Add specific feedback from zxcvbn
    if (strengthResult.feedback.warning) {
      warnings.push(strengthResult.feedback.warning);
    }
    strengthResult.feedback.suggestions.forEach(suggestion => {
      warnings.push(suggestion);
    });
  }

  // Additional strength checks
  if (password.length < 15 && strengthResult.score < 4) {
    warnings.push('Consider using a longer password for better security');
  }

  // Check for dictionary words
  if (strengthResult.sequence.some(match => match.dictionary_name)) {
    warnings.push('Password contains dictionary words - consider using a passphrase');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    score: strengthResult.score,
    crackTime: strengthResult.crack_times_display.offline_slow_hashing_1e4_per_second,
    strength: ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong'][strengthResult.score]
  };
};

// Check for sequential characters
const hasSequentialChars = (password, maxSequential) => {
  const sequences = [
    'abcdefghijklmnopqrstuvwxyz',
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    '0123456789',
    'qwertyuiop',
    'asdfghjkl',
    'zxcvbnm'
  ];

  for (const seq of sequences) {
    for (let i = 0; i <= seq.length - maxSequential; i++) {
      const subSeq = seq.substr(i, maxSequential);
      const reverseSeq = subSeq.split('').reverse().join('');
      
      if (password.includes(subSeq) || password.includes(reverseSeq)) {
        return true;
      }
    }
  }
  
  return false;
};

// Generate password suggestions
export const generatePasswordSuggestions = () => {
  const suggestions = [
    'Use a passphrase with 4+ random words',
    'Include uppercase, lowercase, numbers, and symbols',
    'Avoid personal information like names or birthdays',
    'Make it at least 12 characters long',
    'Use a unique password for each account',
    'Consider using a password manager'
  ];

  return suggestions;
};

// Generate strong password
export const generateStrongPassword = (length = 16, options = {}) => {
  const defaults = {
    uppercase: true,
    lowercase: true,
    numbers: true,
    symbols: true,
    excludeSimilar: true,
    excludeAmbiguous: true
  };

  const settings = { ...defaults, ...options };
  
  let charset = '';
  let password = '';

  // Build character set
  if (settings.lowercase) {
    charset += settings.excludeSimilar ? 'abcdefghjkmnpqrstuvwxyz' : 'abcdefghijklmnopqrstuvwxyz';
  }
  if (settings.uppercase) {
    charset += settings.excludeSimilar ? 'ABCDEFGHJKLMNPQRSTUVWXYZ' : 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  }
  if (settings.numbers) {
    charset += settings.excludeSimilar ? '23456789' : '0123456789';
  }
  if (settings.symbols) {
    charset += settings.excludeAmbiguous ? '!@#$%^&*' : '!@#$%^&*()_+-=[]{}|;:,.<>?';
  }

  // Ensure at least one character from each required set
  const requiredChars = [];
  if (settings.lowercase) requiredChars.push(getRandomChar('abcdefghjkmnpqrstuvwxyz'));
  if (settings.uppercase) requiredChars.push(getRandomChar('ABCDEFGHJKLMNPQRSTUVWXYZ'));
  if (settings.numbers) requiredChars.push(getRandomChar('23456789'));
  if (settings.symbols) requiredChars.push(getRandomChar('!@#$%^&*'));

  // Fill the rest randomly
  for (let i = requiredChars.length; i < length; i++) {
    password += getRandomChar(charset);
  }

  // Insert required characters at random positions
  for (const char of requiredChars) {
    const position = Math.floor(Math.random() * password.length);
    password = password.slice(0, position) + char + password.slice(position);
  }

  // Final shuffle
  password = password.split('').sort(() => Math.random() - 0.5).join('');

  return password.slice(0, length);
};

// Get random character from string
const getRandomChar = (str) => {
  return str.charAt(Math.floor(Math.random() * str.length));
};

// Check password age
export const checkPasswordAge = (lastChanged) => {
  if (!lastChanged) {
    return { expired: true, daysRemaining: 0 };
  }

  const age = Date.now() - new Date(lastChanged).getTime();
  const daysOld = Math.floor(age / (24 * 60 * 60 * 1000));
  const maxDays = Math.floor(passwordPolicy.maxAge / (24 * 60 * 60 * 1000));
  
  return {
    expired: age > passwordPolicy.maxAge,
    daysRemaining: Math.max(0, maxDays - daysOld),
    daysOld,
    requiresChange: daysOld > (maxDays - 14) // Warn 14 days before expiry
  };
};

// Check password history
export const checkPasswordHistory = async (hashedPassword, passwordHistory = []) => {
  // In production, you would compare hashed passwords
  // This is a placeholder - actual implementation would use bcrypt.compare
  
  const recentPasswords = passwordHistory.slice(0, passwordPolicy.passwordHistory);
  
  for (const oldPassword of recentPasswords) {
    if (oldPassword === hashedPassword) {
      return {
        isReused: true,
        message: `Password has been used in the last ${passwordPolicy.passwordHistory} passwords`
      };
    }
  }
  
  return { isReused: false };
};

// Password strength meter component data
export const getPasswordStrengthInfo = (password) => {
  if (!password) {
    return {
      score: 0,
      width: '0%',
      color: '#dc3545',
      text: 'Enter a password'
    };
  }

  const result = zxcvbn(password);
  const colors = ['#dc3545', '#fd7e14', '#ffc107', '#20c997', '#198754'];
  const texts = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong'];
  
  return {
    score: result.score,
    width: `${(result.score + 1) * 20}%`,
    color: colors[result.score],
    text: texts[result.score],
    crackTime: result.crack_times_display.offline_slow_hashing_1e4_per_second
  };
};

// Export password policy for client-side validation
export const getPasswordPolicy = () => {
  return {
    minLength: passwordPolicy.minLength,
    requireUppercase: passwordPolicy.requireUppercase,
    requireLowercase: passwordPolicy.requireLowercase,
    requireNumbers: passwordPolicy.requireNumbers,
    requireSpecialChars: passwordPolicy.requireSpecialChars,
    specialChars: specialChars
  };
};

export default {
  validatePassword,
  generatePasswordSuggestions,
  generateStrongPassword,
  checkPasswordAge,
  checkPasswordHistory,
  getPasswordStrengthInfo,
  getPasswordPolicy
};