import { body, param, query, validationResult } from 'express-validator';
import DOMPurify from 'isomorphic-dompurify';

// Common validation rules
export const validators = {
  // ID validators
  uuid: () => param('id').isUUID().withMessage('Invalid ID format'),
  numericId: () => param('id').isNumeric().withMessage('ID must be numeric'),
  
  // String validators with sanitization
  string: (field, min = 1, max = 255) => 
    body(field)
      .trim()
      .isLength({ min, max })
      .withMessage(`${field} must be between ${min} and ${max} characters`)
      .customSanitizer(value => DOMPurify.sanitize(value, { ALLOWED_TAGS: [] })),
  
  // Email validator
  email: () => 
    body('email')
      .trim()
      .normalizeEmail()
      .isEmail()
      .withMessage('Invalid email address'),
  
  // Password validator
  password: () => 
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .withMessage('Password must contain uppercase, lowercase, number and special character'),
  
  // URL validator
  url: (field) => 
    body(field)
      .trim()
      .isURL({ protocols: ['http', 'https'], require_protocol: true })
      .withMessage('Invalid URL'),
  
  // JSON validator
  json: (field) => 
    body(field)
      .isJSON()
      .withMessage(`${field} must be valid JSON`),
  
  // Array validators
  array: (field, minItems = 0, maxItems = 100) => 
    body(field)
      .isArray({ min: minItems, max: maxItems })
      .withMessage(`${field} must be an array with ${minItems}-${maxItems} items`),
  
  // Number validators
  integer: (field, min = 0, max = Number.MAX_SAFE_INTEGER) => 
    body(field)
      .isInt({ min, max })
      .withMessage(`${field} must be an integer between ${min} and ${max}`),
  
  // Boolean validator
  boolean: (field) => 
    body(field)
      .isBoolean()
      .withMessage(`${field} must be a boolean`),
  
  // Date validators
  date: (field) => 
    body(field)
      .isISO8601()
      .withMessage(`${field} must be a valid date`),
  
  // File validators
  fileName: () => 
    body('filename')
      .trim()
      .matches(/^[a-zA-Z0-9._-]+$/)
      .withMessage('Invalid filename')
      .isLength({ max: 255 })
      .withMessage('Filename too long'),
  
  // SQL injection prevention for search
  searchQuery: () => 
    query('q')
      .trim()
      .escape()
      .isLength({ max: 100 })
      .withMessage('Search query too long')
      .customSanitizer(value => value.replace(/[%_]/g, '\\$&')), // Escape SQL wildcards
  
  // Pagination validators
  pagination: () => [
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100')
  ],
  
  // Content type validators
  contentType: () => 
    body('contentType')
      .isIn(['quiz', 'flashcards', 'document', 'image'])
      .withMessage('Invalid content type'),
  
  // Share ID validator
  shareId: () => 
    param('shareId')
      .matches(/^[a-zA-Z0-9]{10}$/)
      .withMessage('Invalid share ID format')
};

// Validation middleware
export const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: {
        message: 'Validation failed',
        details: errors.array().map(err => ({
          field: err.param,
          message: err.msg,
          value: err.value
        }))
      }
    });
  }
  next();
};

// Common validation chains
export const validationChains = {
  // User routes
  updateProfile: [
    validators.string('name', 1, 100).optional(),
    validators.email().optional(),
    validators.string('bio', 0, 500).optional(),
    validators.url('avatar_url').optional(),
    validate
  ],
  
  // File routes
  uploadFile: [
    validators.fileName(),
    validators.string('folder_id').optional(),
    validate
  ],
  
  // Quiz routes
  createQuiz: [
    validators.string('title', 1, 200),
    validators.string('description', 0, 1000).optional(),
    validators.array('questions', 1, 100),
    validate
  ],
  
  // Chat routes
  sendMessage: [
    validators.string('message', 1, 5000),
    validators.string('conversationId').optional(),
    validators.array('fileIds').optional(),
    validate
  ],
  
  // Share routes
  createShare: [
    validators.contentType(),
    validators.string('contentId'),
    validators.string('title', 1, 200),
    validators.string('description', 0, 1000).optional(),
    validate
  ],
  
  // Search routes
  search: [
    validators.searchQuery(),
    validators.pagination(),
    validate
  ]
};

// Special validators for complex scenarios
export const customValidators = {
  // Validate quiz questions structure
  quizQuestions: () => 
    body('questions')
      .custom((questions) => {
        if (!Array.isArray(questions)) return false;
        
        return questions.every(q => 
          q.question && 
          typeof q.question === 'string' &&
          q.options && 
          Array.isArray(q.options) &&
          q.options.length >= 2 &&
          typeof q.correctAnswer === 'number' &&
          q.correctAnswer >= 0 &&
          q.correctAnswer < q.options.length
        );
      })
      .withMessage('Invalid quiz questions format'),
  
  // Validate flashcard deck structure
  flashcardDeck: () => 
    body('cards')
      .custom((cards) => {
        if (!Array.isArray(cards)) return false;
        
        return cards.every(card => 
          card.front && 
          typeof card.front === 'string' &&
          card.back && 
          typeof card.back === 'string'
        );
      })
      .withMessage('Invalid flashcard format'),
  
  // Validate file chunk structure
  fileChunk: () => 
    body('chunk')
      .custom((chunk) => {
        if (!chunk || typeof chunk !== 'object') return false;
        
        return chunk.content && 
               typeof chunk.content === 'string' &&
               chunk.page_number >= 0 &&
               chunk.chunk_index >= 0;
      })
      .withMessage('Invalid file chunk format')
};

// Sanitization utilities
export const sanitize = {
  // Remove HTML tags
  text: (text) => DOMPurify.sanitize(text, { ALLOWED_TAGS: [] }),
  
  // Allow basic formatting
  richText: (text) => DOMPurify.sanitize(text, {
    ALLOWED_TAGS: ['b', 'i', 'u', 'strong', 'em', 'p', 'br', 'ul', 'ol', 'li'],
    ALLOWED_ATTR: []
  }),
  
  // Escape SQL wildcards
  sqlWildcards: (text) => text.replace(/[%_\\]/g, '\\$&'),
  
  // Sanitize filename
  filename: (filename) => filename.replace(/[^a-zA-Z0-9._-]/g, '_'),
  
  // Sanitize JSON
  json: (obj) => {
    try {
      return JSON.parse(JSON.stringify(obj));
    } catch {
      return null;
    }
  }
};

// Request sanitization middleware
export const sanitizeRequest = (req, res, next) => {
  // Sanitize body
  if (req.body && typeof req.body === 'object') {
    Object.keys(req.body).forEach(key => {
      if (typeof req.body[key] === 'string') {
        req.body[key] = sanitize.text(req.body[key]);
      }
    });
  }
  
  // Sanitize query
  if (req.query && typeof req.query === 'object') {
    Object.keys(req.query).forEach(key => {
      if (typeof req.query[key] === 'string') {
        req.query[key] = sanitize.text(req.query[key]);
      }
    });
  }
  
  // Sanitize params
  if (req.params && typeof req.params === 'object') {
    Object.keys(req.params).forEach(key => {
      if (typeof req.params[key] === 'string') {
        req.params[key] = sanitize.text(req.params[key]);
      }
    });
  }
  
  next();
};

export default {
  validators,
  validate,
  validationChains,
  customValidators,
  sanitize,
  sanitizeRequest
};