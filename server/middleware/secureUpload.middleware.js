import crypto from 'crypto';
import path from 'path';
import { promisify } from 'util';

// Dynamic import for file-type
let fileType;
try {
  fileType = await import('file-type');
} catch (error) {
  console.warn('[SecureUpload] file-type package not available, using basic validation');
}

// Magic numbers for file type validation
const FILE_SIGNATURES = {
  'application/pdf': Buffer.from([0x25, 0x50, 0x44, 0x46]), // %PDF
  'image/jpeg': Buffer.from([0xFF, 0xD8, 0xFF]),
  'image/png': Buffer.from([0x89, 0x50, 0x4E, 0x47]),
  'image/gif': Buffer.from([0x47, 0x49, 0x46]),
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': Buffer.from([0x50, 0x4B, 0x03, 0x04]), // PK.. (zip)
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': Buffer.from([0x50, 0x4B, 0x03, 0x04]),
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': Buffer.from([0x50, 0x4B, 0x03, 0x04])
};

// Allowed MIME types with their extensions
const ALLOWED_FILE_TYPES = {
  'application/pdf': ['.pdf'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/vnd.ms-powerpoint': ['.ppt'],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
  'application/vnd.ms-excel': ['.xls'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'text/plain': ['.txt'],
  'text/markdown': ['.md'],
  'text/csv': ['.csv'],
  'image/jpeg': ['.jpg', '.jpeg', '.png'],
  'image/png': ['.png', '.jpg', '.jpeg'],
  'image/gif': ['.gif'],
  'image/webp': ['.webp'],
  'image/heic': ['.heic'],
  'image/heif': ['.heif']
};

// Maximum file sizes by type
const MAX_FILE_SIZES = {
  'application/pdf': 50 * 1024 * 1024, // 50MB
  'application/msword': 20 * 1024 * 1024, // 20MB
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 20 * 1024 * 1024,
  'application/vnd.ms-powerpoint': 50 * 1024 * 1024,
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 50 * 1024 * 1024,
  'application/vnd.ms-excel': 20 * 1024 * 1024,
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 20 * 1024 * 1024,
  'text/plain': 5 * 1024 * 1024, // 5MB
  'text/markdown': 5 * 1024 * 1024,
  'text/csv': 10 * 1024 * 1024,
  'image/jpeg': 10 * 1024 * 1024, // 10MB
  'image/png': 10 * 1024 * 1024,
  'image/gif': 5 * 1024 * 1024,
  'image/webp': 10 * 1024 * 1024,
  'image/heic': 20 * 1024 * 1024,
  'image/heif': 20 * 1024 * 1024
};

// Validate file buffer against magic numbers
async function validateFileType(buffer, mimetype) {
  try {
    // If file-type is available, use it for accurate detection
    if (fileType && fileType.fileTypeFromBuffer) {
      const fileTypeResult = await fileType.fileTypeFromBuffer(buffer);
      
      if (!fileTypeResult) {
        // For text files, file-type might not detect them
        if (mimetype.startsWith('text/')) {
          return true;
        }
        // Check magic numbers manually
        return checkMagicNumbers(buffer, mimetype);
      }
      
      // Check if detected type matches declared type
      // Allow image type mismatches (e.g., iOS photo picker may report .jpg as image/png)
      if (fileTypeResult.mime !== mimetype) {
        const bothImages = fileTypeResult.mime.startsWith('image/') && mimetype.startsWith('image/');
        return bothImages && ALLOWED_FILE_TYPES[fileTypeResult.mime];
      }
      return true;
    } else {
      // Fallback to manual magic number checking
      return checkMagicNumbers(buffer, mimetype);
    }
  } catch (error) {
    console.error('[SecureUpload] File type validation error:', error);
    return false;
  }
}

// Manual magic number checking
function checkMagicNumbers(buffer, mimetype) {
  const signature = FILE_SIGNATURES[mimetype];
  if (!signature) {
    // If no signature defined, allow text files
    return mimetype.startsWith('text/');
  }
  
  // Check if buffer starts with the expected signature
  return buffer.slice(0, signature.length).equals(signature);
}

// Sanitize filename to prevent path traversal
function sanitizeFilename(filename) {
  // Remove any directory components
  const basename = path.basename(filename);
  
  // Remove special characters except dots and hyphens
  const sanitized = basename.replace(/[^a-zA-Z0-9.-]/g, '_');
  
  // Ensure it doesn't start with a dot (hidden file)
  if (sanitized.startsWith('.')) {
    return '_' + sanitized.substring(1);
  }
  
  // Limit length
  const maxLength = 255;
  if (sanitized.length > maxLength) {
    const ext = path.extname(sanitized);
    const nameWithoutExt = sanitized.substring(0, sanitized.length - ext.length);
    return nameWithoutExt.substring(0, maxLength - ext.length) + ext;
  }
  
  return sanitized;
}

// Generate secure filename with random component
function generateSecureFilename(originalFilename, userId) {
  const sanitized = sanitizeFilename(originalFilename);
  const ext = path.extname(sanitized);
  const nameWithoutExt = sanitized.substring(0, sanitized.length - ext.length);
  
  // Generate random component
  const randomBytes = crypto.randomBytes(8).toString('hex');
  const timestamp = Date.now();
  
  // Create secure filename: userId_timestamp_random_originalname.ext
  return `${userId}_${timestamp}_${randomBytes}_${nameWithoutExt}${ext}`;
}

// Scan file content for malicious patterns
async function scanFileContent(buffer, mimetype) {
  // Basic pattern matching for common malicious content in text files only
  // PDFs are binary and their raw buffer text causes too many false positives
  // (e.g. "commerce" matches .com, "one =" matches event handlers)
  if (mimetype.startsWith('text/')) {
    const maliciousPatterns = [
      /<script[\s\S]*?<\/script>/gi, // Script tags
      /javascript:/gi, // JavaScript protocol
      /\bon\w+\s*=/gi, // Event handlers (word boundary to avoid "one =", "only =")
      /<iframe/gi, // Iframes
      /<object\s/gi, // Objects (with space to avoid "objecting")
      /<embed/gi, // Embeds
      /eval\s*\(/gi, // Eval function
      /document\.write/gi, // Document.write
    ];

    const content = buffer.toString('utf8', 0, Math.min(buffer.length, 10000)); // Check first 10KB

    for (const pattern of maliciousPatterns) {
      if (pattern.test(content)) {
        console.warn('[SecureUpload] Potentially malicious pattern detected:', pattern);
        return false;
      }
    }
  }
  
  return true;
}

// Main validation middleware
export async function validateUpload(req, res, next) {
  try {
    const files = req.files || (req.file ? [req.file] : []);
    
    if (!files || files.length === 0) {
      return res.status(400).json({
        error: { message: 'No files uploaded' }
      });
    }
    
    // Validate each file
    for (const file of files) {
      // Check MIME type is allowed
      if (!ALLOWED_FILE_TYPES[file.mimetype]) {
        return res.status(400).json({
          error: { 
            message: `File type ${file.mimetype} is not allowed`,
            allowedTypes: Object.keys(ALLOWED_FILE_TYPES)
          }
        });
      }
      
      // Check file extension matches MIME type
      const ext = path.extname(file.originalname).toLowerCase();
      const allowedExts = ALLOWED_FILE_TYPES[file.mimetype];
      if (!allowedExts.includes(ext)) {
        return res.status(400).json({
          error: { 
            message: `File extension ${ext} does not match MIME type ${file.mimetype}`
          }
        });
      }
      
      // Check file size
      const maxSize = MAX_FILE_SIZES[file.mimetype];
      if (file.size > maxSize) {
        return res.status(413).json({
          error: { 
            message: `File size ${file.size} exceeds maximum allowed size of ${maxSize} bytes for ${file.mimetype}`
          }
        });
      }
      
      // Validate file type by magic numbers
      const isValidType = await validateFileType(file.buffer, file.mimetype);
      if (!isValidType) {
        return res.status(400).json({
          error: { 
            message: 'File content does not match declared type'
          }
        });
      }
      
      // Scan for malicious content
      const isSafe = await scanFileContent(file.buffer, file.mimetype);
      if (!isSafe) {
        return res.status(400).json({
          error: { 
            message: 'File contains potentially malicious content'
          }
        });
      }
      
      // Add secure filename to file object
      file.secureFilename = generateSecureFilename(file.originalname, req.userId || 'anonymous');
    }
    
    next();
  } catch (error) {
    console.error('[SecureUpload] Validation error:', error);
    return res.status(500).json({
      error: { message: 'File validation failed' }
    });
  }
}

// Middleware to limit upload frequency per user
const uploadTracking = new Map();
const UPLOAD_WINDOW = 60 * 1000; // 1 minute
const MAX_UPLOADS_PER_WINDOW = 10;

export function rateLimitUploads(req, res, next) {
  const userId = req.userId || req.ip;
  const now = Date.now();
  
  // Get or create user's upload history
  if (!uploadTracking.has(userId)) {
    uploadTracking.set(userId, []);
  }
  
  const userUploads = uploadTracking.get(userId);
  
  // Remove old entries outside the window
  const recentUploads = userUploads.filter(timestamp => now - timestamp < UPLOAD_WINDOW);
  uploadTracking.set(userId, recentUploads);
  
  // Check if user has exceeded limit
  if (recentUploads.length >= MAX_UPLOADS_PER_WINDOW) {
    return res.status(429).json({
      error: { 
        message: `Upload limit exceeded. Maximum ${MAX_UPLOADS_PER_WINDOW} uploads per minute.`,
        retryAfter: Math.ceil((recentUploads[0] + UPLOAD_WINDOW - now) / 1000)
      }
    });
  }
  
  // Add current upload to history
  recentUploads.push(now);
  
  next();
}

// Clean up old tracking data periodically
setInterval(() => {
  const now = Date.now();
  for (const [userId, uploads] of uploadTracking.entries()) {
    const recentUploads = uploads.filter(timestamp => now - timestamp < UPLOAD_WINDOW);
    if (recentUploads.length === 0) {
      uploadTracking.delete(userId);
    } else {
      uploadTracking.set(userId, recentUploads);
    }
  }
}, UPLOAD_WINDOW);

export default {
  validateUpload,
  rateLimitUploads,
  sanitizeFilename,
  generateSecureFilename
};