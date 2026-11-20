/**
 * Field Selection Middleware
 * 
 * Allows clients to specify which fields they want in the response
 * to reduce payload size and improve performance.
 * 
 * Usage:
 * - Query parameter: ?fields=id,name,email
 * - Header: X-Fields: id,name,email
 * 
 * Example:
 * GET /api/user/profile?fields=id,name,avatar_url
 * Returns only: { id: "123", name: "John", avatar_url: "..." }
 */

const selectFields = (data, fields) => {
  if (!fields || fields.length === 0) return data;
  
  if (Array.isArray(data)) {
    return data.map(item => selectFields(item, fields));
  }
  
  if (typeof data !== 'object' || data === null) return data;
  
  const result = {};
  fields.forEach(field => {
    if (field.includes('.')) {
      // Handle nested fields like "user.name"
      const [parent, ...rest] = field.split('.');
      if (data[parent] !== undefined) {
        if (!result[parent]) result[parent] = {};
        const nestedField = rest.join('.');
        const nestedValue = selectFields(data[parent], [nestedField]);
        if (nestedValue && typeof nestedValue === 'object') {
          Object.assign(result[parent], nestedValue);
        } else {
          result[parent] = nestedValue;
        }
      }
    } else {
      // Handle regular fields
      if (data[field] !== undefined) {
        result[field] = data[field];
      }
    }
  });
  
  return result;
};

const parseFields = (fieldsString) => {
  if (!fieldsString) return null;
  return fieldsString.split(',').map(f => f.trim()).filter(f => f);
};

const fieldSelectionMiddleware = (req, res, next) => {
  // Get fields from query parameter or header
  const fieldsParam = req.query.fields || req.headers['x-fields'];
  
  if (fieldsParam) {
    req.selectedFields = parseFields(fieldsParam);
    
    // Override res.json to apply field selection
    const originalJson = res.json.bind(res);
    res.json = function(data) {
      if (req.selectedFields && data) {
        // Apply field selection to the response data
        if (data.data) {
          // If response has a 'data' property (common pattern)
          data.data = selectFields(data.data, req.selectedFields);
        } else if (data.conversations || data.files || data.quizzes || data.flashcards) {
          // Handle specific list responses
          Object.keys(data).forEach(key => {
            if (Array.isArray(data[key])) {
              data[key] = selectFields(data[key], req.selectedFields);
            }
          });
        } else if (!data.error && !data.message) {
          // Apply to root level data if it's not an error response
          data = selectFields(data, req.selectedFields);
        }
      }
      return originalJson(data);
    };
  }
  
  next();
};

// Middleware for specific routes that always need field selection
const enforceFieldSelection = (defaultFields) => {
  return (req, res, next) => {
    if (!req.query.fields && !req.headers['x-fields']) {
      req.selectedFields = defaultFields;
      
      const originalJson = res.json.bind(res);
      res.json = function(data) {
        if (req.selectedFields && data && !data.error) {
          data = selectFields(data, req.selectedFields);
        }
        return originalJson(data);
      };
    }
    next();
  };
};

module.exports = {
  fieldSelectionMiddleware,
  enforceFieldSelection,
  selectFields,
  parseFields
};