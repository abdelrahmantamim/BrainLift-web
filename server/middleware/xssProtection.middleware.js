import DOMPurify from 'isomorphic-dompurify';
import lodash from 'lodash';
const { escape: htmlEscape } = lodash;

// XSS sanitization middleware
export const sanitizeInput = (req, res, next) => {
  // Recursively sanitize object properties
  const sanitizeObject = (obj, depth = 0) => {
    // Prevent infinite recursion
    if (depth > 10) return obj;
    
    if (Array.isArray(obj)) {
      return obj.map(item => sanitizeObject(item, depth + 1));
    }
    
    if (obj && typeof obj === 'object') {
      const sanitized = {};
      for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'string') {
          // Basic text sanitization - remove all HTML
          sanitized[key] = DOMPurify.sanitize(value, { 
            ALLOWED_TAGS: [],
            ALLOWED_ATTR: [],
            KEEP_CONTENT: true
          });
        } else {
          sanitized[key] = sanitizeObject(value, depth + 1);
        }
      }
      return sanitized;
    }
    
    return obj;
  };
  
  // Sanitize request body
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }
  
  // Sanitize query parameters
  if (req.query) {
    req.query = sanitizeObject(req.query);
  }
  
  // Sanitize URL parameters
  if (req.params) {
    req.params = sanitizeObject(req.params);
  }
  
  next();
};

// Rich text sanitization for specific fields
export const sanitizeRichText = (html) => {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'p', 'br', 'strong', 'em', 'u', 's', 
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li', 'blockquote', 'code', 'pre',
      'a', 'img'
    ],
    ALLOWED_ATTR: {
      'a': ['href', 'title', 'target'],
      'img': ['src', 'alt', 'width', 'height']
    },
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
    KEEP_CONTENT: true,
    ADD_TAGS: ['target'],
    ADD_ATTR: ['target'],
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover']
  });
};

// Response sanitization
export const sanitizeResponse = (req, res, next) => {
  const originalJson = res.json;
  
  res.json = function(data) {
    // Recursively escape strings in response
    const escapeStrings = (obj, depth = 0) => {
      if (depth > 10) return obj;
      
      if (Array.isArray(obj)) {
        return obj.map(item => escapeStrings(item, depth + 1));
      }
      
      if (obj && typeof obj === 'object') {
        const escaped = {};
        for (const [key, value] of Object.entries(obj)) {
          // Skip HTML content fields that should be pre-sanitized
          const skipFields = ['html_content', 'rich_text', 'formatted_content'];
          
          if (typeof value === 'string' && !skipFields.includes(key)) {
            // HTML escape for display
            escaped[key] = htmlEscape(value);
          } else {
            escaped[key] = escapeStrings(value, depth + 1);
          }
        }
        return escaped;
      }
      
      return obj;
    };
    
    // Apply escaping based on content type
    const contentType = res.getHeader('Content-Type');
    if (contentType && contentType.includes('application/json')) {
      // Skip escaping for certain safe endpoints
      const safeEndpoints = ['/api/charts/', '/api/pdf/'];
      const isSafeEndpoint = safeEndpoints.some(endpoint => req.path.startsWith(endpoint));
      
      if (!isSafeEndpoint) {
        data = escapeStrings(data);
      }
    }
    
    originalJson.call(this, data);
  };
  
  next();
};

// Content-Type validation
export const validateContentType = (req, res, next) => {
  // Ensure proper content type for JSON requests
  if (req.method !== 'GET' && req.method !== 'DELETE') {
    const contentType = req.get('content-type');
    
    if (!contentType || !contentType.includes('application/json')) {
      // Allow form data for file uploads
      if (!contentType || !contentType.includes('multipart/form-data')) {
        return res.status(400).json({
          error: { message: 'Content-Type must be application/json' }
        });
      }
    }
  }
  
  // Set response content type
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  
  next();
};

// NoSQL injection prevention for MongoDB/similar (if used)
export const preventNoSQLInjection = (req, res, next) => {
  const sanitizeQuery = (obj) => {
    if (typeof obj !== 'object' || obj === null) return obj;
    
    for (const key in obj) {
      // Remove any $ operators
      if (key.startsWith('$')) {
        delete obj[key];
        continue;
      }
      
      if (typeof obj[key] === 'object') {
        obj[key] = sanitizeQuery(obj[key]);
      }
    }
    
    return obj;
  };
  
  if (req.body) req.body = sanitizeQuery(req.body);
  if (req.query) req.query = sanitizeQuery(req.query);
  
  next();
};

// Special handling for chat messages
export const sanitizeChatMessage = (message) => {
  // Allow basic markdown but escape HTML
  let sanitized = DOMPurify.sanitize(message, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true
  });
  
  // Preserve code blocks
  sanitized = sanitized.replace(/```([\s\S]*?)```/g, (match, code) => {
    return '```' + htmlEscape(code) + '```';
  });
  
  // Preserve inline code
  sanitized = sanitized.replace(/`([^`]+)`/g, (match, code) => {
    return '`' + htmlEscape(code) + '`';
  });
  
  return sanitized;
};

// File name sanitization
export const sanitizeFileName = (filename) => {
  // Remove any path components
  filename = filename.replace(/^.*[\\\/]/, '');
  
  // Remove special characters
  filename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  
  // Limit length
  if (filename.length > 255) {
    const ext = filename.match(/\.[^.]+$/)?.[0] || '';
    filename = filename.substring(0, 255 - ext.length) + ext;
  }
  
  // Prevent directory traversal
  filename = filename.replace(/\.\./g, '_');
  
  return filename;
};

export default {
  sanitizeInput,
  sanitizeRichText,
  sanitizeResponse,
  validateContentType,
  preventNoSQLInjection,
  sanitizeChatMessage,
  sanitizeFileName
};