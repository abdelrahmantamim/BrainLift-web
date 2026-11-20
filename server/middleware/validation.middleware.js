const { body, param, query, validationResult } = require('express-validator');
const validator = require('validator');
const xss = require('xss');

// Custom sanitizers
const sanitizeInput = (value) => {
  if (typeof value !== 'string') return value;
  // Remove XSS attempts
  return xss(value, {
    whiteList: {}, // No HTML tags allowed
    stripIgnoreTag: true,
    stripIgnoreTagBody: ['script']
  });
};

// Validation error handler
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log('[Validation] === Validation Failed ===');
    console.log('[Validation] Endpoint:', req.method, req.originalUrl);
    console.log('[Validation] Errors:', JSON.stringify(errors.array(), null, 2));
    console.log('[Validation] Request body:', {
      ...req.body,
      password: req.body.password ? '[REDACTED]' : undefined
    });
    console.log('[Validation] Timestamp:', new Date().toISOString());
    
    // Create a user-friendly error message
    const errorMessages = errors.array().map(err => {
      // Map field names to user-friendly names
      const fieldNames = {
        email: 'Email',
        password: 'Password',
        username: 'Username',
        name: 'Name'
      };
      
      const fieldName = fieldNames[err.path] || err.path;
      return `${fieldName}: ${err.msg}`;
    });
    
    return res.status(400).json({ 
      error: { 
        message: errorMessages.join('. '),
        details: errors.array()
      } 
    });
  }
  next();
};

// Common validation rules
const commonValidations = {
  // Email validation
  email: () => 
    body('email')
      .trim()
      .isEmail().withMessage('Invalid email format')
      .normalizeEmail()
      .isLength({ max: 255 }).withMessage('Email too long'),

  // Password validation
  password: () =>
    body('password')
      .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).*$/)
      .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),

  // Username validation
  username: () =>
    body('username')
      .trim()
      .isLength({ min: 3, max: 30 }).withMessage('Username must be 3-30 characters')
      .matches(/^[a-zA-Z0-9_-]+$/).withMessage('Username can only contain letters, numbers, underscores and hyphens')
      .customSanitizer(sanitizeInput),

  // UUID validation
  uuid: (field) =>
    param(field)
      .isUUID().withMessage('Invalid ID format'),

  // Text content validation
  textContent: (field, maxLength = 5000) =>
    body(field)
      .trim()
      .isLength({ min: 1, max: maxLength }).withMessage(`${field} must be 1-${maxLength} characters`)
      .customSanitizer(sanitizeInput),

  // Optional text content
  optionalText: (field, maxLength = 5000) =>
    body(field)
      .optional()
      .trim()
      .isLength({ max: maxLength }).withMessage(`${field} must be less than ${maxLength} characters`)
      .customSanitizer(sanitizeInput),

  // Pagination validation
  pagination: () => [
    query('page')
      .optional()
      .isInt({ min: 1 }).withMessage('Page must be a positive integer')
      .toInt(),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
      .toInt()
  ],

  // File validation
  fileId: () =>
    body('fileId')
      .isUUID().withMessage('Invalid file ID'),

  // Array of UUIDs validation
  uuidArray: (field) =>
    body(field)
      .isArray().withMessage(`${field} must be an array`)
      .custom((arr) => arr.every(id => validator.isUUID(id)))
      .withMessage(`All ${field} must be valid UUIDs`),

  // JSON validation
  jsonField: (field) =>
    body(field)
      .optional()
      .isJSON().withMessage(`${field} must be valid JSON`)
};

// Route-specific validations
const validations = {
  // Auth validations
  auth: {
    register: [
      commonValidations.email(),
      commonValidations.password(),
      body('username')
        .optional()
        .trim()
        .isLength({ min: 3, max: 30 }).withMessage('Username must be 3-30 characters')
        .matches(/^[a-zA-Z0-9_-]+$/).withMessage('Username can only contain letters, numbers, underscores and hyphens')
        .customSanitizer(sanitizeInput),
      handleValidationErrors
    ],
    
    login: [
      commonValidations.email(),
      body('password').notEmpty().withMessage('Password is required'),
      handleValidationErrors
    ],
    
    forgotPassword: [
      commonValidations.email(),
      handleValidationErrors
    ],
    
    resetPassword: [
      body('token').notEmpty().withMessage('Reset token is required'),
      commonValidations.password(),
      handleValidationErrors
    ]
  },

  // Chat validations
  chat: {
    sendMessage: [
      commonValidations.textContent('message', 10000),
      body('conversationId').optional().isUUID().withMessage('Invalid conversation ID'),
      body('fileContext').optional().isObject().withMessage('File context must be an object'),
      handleValidationErrors
    ],
    
    getConversation: [
      commonValidations.uuid('conversationId'),
      ...commonValidations.pagination(),
      handleValidationErrors
    ],
    
    updateTitle: [
      commonValidations.uuid('conversationId'),
      commonValidations.textContent('title', 100),
      handleValidationErrors
    ],
    
    deleteConversation: [
      commonValidations.uuid('conversationId'),
      handleValidationErrors
    ]
  },

  // File validations
  files: {
    upload: [
      // File validation is handled by multer
      body('folderId').optional().isUUID().withMessage('Invalid folder ID'),
      handleValidationErrors
    ],
    
    process: [
      commonValidations.uuid('fileId'),
      handleValidationErrors
    ],
    
    delete: [
      commonValidations.uuid('fileId'),
      handleValidationErrors
    ],
    
    processMultiple: [
      commonValidations.uuidArray('fileIds'),
      handleValidationErrors
    ]
  },

  // Quiz validations
  quiz: {
    generate: [
      commonValidations.textContent('topic', 200),
      body('difficulty').isIn(['easy', 'medium', 'hard']).withMessage('Invalid difficulty'),
      body('questionCount').isInt({ min: 1, max: 50 }).withMessage('Question count must be 1-50'),
      body('sourceType').optional().isIn(['topic', 'file']).withMessage('Invalid source type'),
      handleValidationErrors
    ],
    
    manual: [
      body('title').trim().isLength({ min: 1, max: 200 }).withMessage('Title required'),
      body('difficulty').isIn(['easy', 'medium', 'hard']).withMessage('Invalid difficulty'),
      body('questions').isArray({ min: 1, max: 50 }).withMessage('Questions must be 1-50 items'),
      body('questions.*.question').notEmpty().withMessage('Question text required'),
      body('questions.*.options').isArray({ min: 2, max: 6 }).withMessage('2-6 options required'),
      body('questions.*.correctAnswer').isInt({ min: 0, max: 5 }).withMessage('Invalid answer index'),
      handleValidationErrors
    ],
    
    submit: [
      commonValidations.uuid('quizId'),
      body('answers').isArray().withMessage('Answers must be an array'),
      body('answers.*').isInt({ min: 0, max: 5 }).withMessage('Invalid answer'),
      handleValidationErrors
    ]
  },

  // Flashcard validations
  flashcards: {
    generate: [
      commonValidations.textContent('topic', 5000),
      body('sourceType').optional().isIn(['topic', 'notes']).withMessage('Invalid source type'),
      body('count').optional().isInt({ min: 5, max: 50 }).withMessage('Count must be 5-50'),
      handleValidationErrors
    ],
    
    manual: [
      body('topic').trim().isLength({ min: 1, max: 200 }).withMessage('Topic required'),
      body('cards').isArray({ min: 1, max: 20 }).withMessage('Cards must be 1-20 items'),
      body('cards.*.question').notEmpty().withMessage('Question required'),
      body('cards.*.answer').notEmpty().withMessage('Answer required'),
      handleValidationErrors
    ],
    
    updateReview: [
      commonValidations.uuid('cardId'),
      body('difficulty').isIn(['easy', 'good', 'hard']).withMessage('Invalid difficulty'),
      handleValidationErrors
    ]
  },

  // User validations
  user: {
    updateProfile: [
      commonValidations.optionalText('bio', 500),
      commonValidations.optionalText('displayName', 50),
      body('preferences').optional().isObject().withMessage('Preferences must be an object'),
      handleValidationErrors
    ],
    
    updateSettings: [
      body('theme').optional().isIn(['light', 'dark', 'system']).withMessage('Invalid theme'),
      body('notifications').optional().isBoolean().withMessage('Notifications must be boolean'),
      body('language').optional().isIn(['en', 'es', 'fr', 'de', 'zh', 'ar']).withMessage('Invalid language'),
      handleValidationErrors
    ]
  },

  // Folder validations
  folders: {
    create: [
      commonValidations.textContent('name', 100),
      body('parentId').optional().isUUID().withMessage('Invalid parent folder ID'),
      handleValidationErrors
    ],
    
    update: [
      commonValidations.uuid('folderId'),
      commonValidations.textContent('name', 100),
      handleValidationErrors
    ],
    
    delete: [
      commonValidations.uuid('folderId'),
      handleValidationErrors
    ],
    
    processFolder: [
      commonValidations.uuid('folderId'),
      handleValidationErrors
    ]
  }
};

// SQL injection prevention for raw queries (if any)
const preventSQLInjection = (value) => {
  if (typeof value !== 'string') return value;
  
  // Remove common SQL injection patterns
  const sqlPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|CREATE|ALTER|EXEC|EXECUTE)\b)/gi,
    /(--|\/\*|\*\/|;|'|")/g,
    /(\bOR\b\s*\d+\s*=\s*\d+)/gi,
    /(\bAND\b\s*\d+\s*=\s*\d+)/gi
  ];
  
  let sanitized = value;
  sqlPatterns.forEach(pattern => {
    sanitized = sanitized.replace(pattern, '');
  });
  
  return sanitized;
};

// Middleware to sanitize all inputs
const sanitizeAllInputs = (req, res, next) => {
  // Sanitize body
  if (req.body) {
    Object.keys(req.body).forEach(key => {
      if (typeof req.body[key] === 'string') {
        req.body[key] = sanitizeInput(req.body[key]);
        req.body[key] = preventSQLInjection(req.body[key]);
      }
    });
  }
  
  // Sanitize query params
  if (req.query) {
    Object.keys(req.query).forEach(key => {
      if (typeof req.query[key] === 'string') {
        req.query[key] = sanitizeInput(req.query[key]);
        req.query[key] = preventSQLInjection(req.query[key]);
      }
    });
  }
  
  // Sanitize params
  if (req.params) {
    Object.keys(req.params).forEach(key => {
      if (typeof req.params[key] === 'string') {
        req.params[key] = sanitizeInput(req.params[key]);
        req.params[key] = preventSQLInjection(req.params[key]);
      }
    });
  }
  
  next();
};

module.exports = {
  validations,
  handleValidationErrors,
  commonValidations,
  sanitizeAllInputs,
  sanitizeInput,
  preventSQLInjection
};