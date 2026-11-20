import multer from 'multer';
import { getSupabase } from '../config/services.config.js';

// Cache for file size limit with TTL
let fileSizeCache = {
  limit: null,
  lastFetched: null,
  ttl: 60000 // 1 minute cache
};

// Function to invalidate cache
export function invalidateFileSizeCache() {
  fileSizeCache.limit = null;
  fileSizeCache.lastFetched = null;
  console.log('[DynamicUpload] File size cache invalidated');
}

// Get file size limit from database with caching
async function getFileSizeLimit() {
  try {
    // Check cache first
    const now = Date.now();
    if (fileSizeCache.limit !== null && 
        fileSizeCache.lastFetched && 
        (now - fileSizeCache.lastFetched) < fileSizeCache.ttl) {
      return fileSizeCache.limit;
    }

    // Fetch from database
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'file_size_limits')
      .single();

    let maxSizeBytes = 10 * 1024 * 1024; // Default 10MB
    if (!error && data && data.value) {
      // The value is stored as a JSON object with maxFileSize property in bytes
      const config = data.value;
      if (config.maxFileSize && typeof config.maxFileSize === 'number' && config.maxFileSize > 0) {
        maxSizeBytes = config.maxFileSize;
      }
    }

    // Update cache
    fileSizeCache.limit = maxSizeBytes;
    fileSizeCache.lastFetched = now;

    console.log(`[DynamicUpload] File size limit: ${maxSizeBytes / (1024 * 1024)}MB`);
    return fileSizeCache.limit;
  } catch (error) {
    console.error('[DynamicUpload] Error fetching file size limit:', error);
    // Return default on error
    return 10 * 1024 * 1024; // 10MB default
  }
}

// Clear cache when settings are updated
function clearFileSizeCache() {
  fileSizeCache.limit = null;
  fileSizeCache.lastFetched = null;
  console.log('[DynamicUpload] File size cache cleared');
}

// Create dynamic multer middleware for multiple files
function createDynamicUpload() {
  const storage = multer.memoryStorage();

  return async (req, res, next) => {
    try {
      // Get current file size limit
      const fileSize = await getFileSizeLimit();

      // Create multer instance with dynamic limit
      const upload = multer({
        storage: storage,
        limits: {
          fileSize: fileSize
        },
        fileFilter: (req, file, cb) => {
          // Allowed file types
          const allowedMimes = [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-powerpoint',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'text/plain',
            'text/markdown',
            'text/csv',
            'image/jpeg',
            'image/png',
            'image/gif',
            'image/webp',
            'image/heic',
            'image/heif'
          ];

          if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
          } else {
            cb(new Error(`File type ${file.mimetype} is not supported`), false);
          }
        }
      });

      // Default to multiple files for the upload endpoint
      const fieldName = 'files';
      const uploadMethod = upload.array(fieldName, 10); // Max 10 files

      // Execute multer with error handling
      uploadMethod(req, res, (err) => {
        if (err) {
          // Handle multer errors
          if (err.code === 'LIMIT_FILE_SIZE') {
            const limitMB = Math.round(fileSize / (1024 * 1024));
            return res.status(413).json({
              error: `File size exceeds the maximum limit of ${limitMB}MB`,
              code: 'FILE_TOO_LARGE',
              maxSize: fileSize
            });
          } else if (err.code === 'LIMIT_FILE_COUNT') {
            return res.status(400).json({
              error: 'Too many files uploaded',
              code: 'TOO_MANY_FILES'
            });
          } else if (err.message && err.message.includes('not supported')) {
            return res.status(400).json({
              error: err.message,
              code: 'UNSUPPORTED_FILE_TYPE'
            });
          } else {
            console.error('[DynamicUpload] Upload error:', err);
            return res.status(500).json({
              error: 'File upload failed',
              code: 'UPLOAD_ERROR'
            });
          }
        }
        next();
      });
    } catch (error) {
      console.error('[DynamicUpload] Middleware error:', error);
      return res.status(500).json({
        error: 'Upload configuration error',
        code: 'CONFIG_ERROR'
      });
    }
  };
}

// Create dynamic multer middleware for single file
function createDynamicSingleUpload(fieldName = 'file') {
  const storage = multer.memoryStorage();

  return async (req, res, next) => {
    try {
      // Get current file size limit
      const fileSize = await getFileSizeLimit();

      // Create multer instance with dynamic limit
      const upload = multer({
        storage: storage,
        limits: {
          fileSize: fileSize
        },
        fileFilter: (req, file, cb) => {
          // Allowed file types
          const allowedMimes = [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-powerpoint',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'text/plain',
            'text/markdown',
            'text/csv',
            'image/jpeg',
            'image/png',
            'image/gif',
            'image/webp',
            'image/heic',
            'image/heif'
          ];

          if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
          } else {
            cb(new Error(`File type ${file.mimetype} is not supported`), false);
          }
        }
      });

      // Use single file upload
      const uploadMethod = upload.single(fieldName);

      // Execute multer with error handling
      uploadMethod(req, res, (err) => {
        if (err) {
          // Handle multer errors
          if (err.code === 'LIMIT_FILE_SIZE') {
            const limitMB = Math.round(fileSize / (1024 * 1024));
            return res.status(413).json({
              error: `File size exceeds the maximum limit of ${limitMB}MB`,
              code: 'FILE_TOO_LARGE',
              maxSize: fileSize
            });
          } else if (err.message && err.message.includes('not supported')) {
            return res.status(400).json({
              error: err.message,
              code: 'UNSUPPORTED_FILE_TYPE'
            });
          } else {
            console.error('[DynamicUpload] Upload error:', err);
            return res.status(500).json({
              error: 'File upload failed',
              code: 'UPLOAD_ERROR'
            });
          }
        }
        next();
      });
    } catch (error) {
      console.error('[DynamicUpload] Middleware error:', error);
      return res.status(500).json({
        error: 'Upload configuration error',
        code: 'CONFIG_ERROR'
      });
    }
  };
}

export {
  createDynamicUpload,
  createDynamicSingleUpload,
  clearFileSizeCache,
  getFileSizeLimit
};