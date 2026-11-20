import express from 'express';
import { requireAdminAuth } from '../middleware/adminAuth.middleware.js';
import { getSupabase } from '../config/services.config.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { invalidateFileSizeCache } from '../middleware/dynamicUpload.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Get all files with pagination
router.get('/', requireAdminAuth, async (req, res) => {
  try {
    const supabase = getSupabase();
    const { page = 1, limit = 20, userId = '', type = '' } = req.query;
    
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    // Build query
    let query = supabase
      .from('files')
      .select('*, profiles!inner(email, name)', { count: 'exact' });
    
    // Apply filters
    if (userId) {
      query = query.eq('user_id', userId);
    }
    
    if (type) {
      query = query.eq('type', type);
    }
    
    // Apply pagination
    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + parseInt(limit) - 1);
    
    const { data: files, error, count } = await query;
    
    if (error) throw error;
    
    res.json({
      files,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('[Admin Files] Error fetching files:', error);
    res.status(500).json({
      error: { message: 'Failed to fetch files' }
    });
  }
});

// Get file statistics
router.get('/stats', requireAdminAuth, async (req, res) => {
  try {
    const supabase = getSupabase();
    
    // Get file type distribution
    const { data: fileTypes, error: typeError } = await supabase
      .from('files')
      .select('type');
    
    if (typeError) throw typeError;
    
    // Count by type
    const typeDistribution = {};
    let totalSize = 0;
    
    fileTypes.forEach(file => {
      const type = file.type || 'unknown';
      typeDistribution[type] = (typeDistribution[type] || 0) + 1;
    });
    
    // Get storage usage
    const uploadsDir = path.join(path.dirname(path.dirname(__dirname)), 'uploads');
    try {
      const files = await fs.readdir(uploadsDir, { recursive: true });
      for (const file of files) {
        const filePath = path.join(uploadsDir, file);
        const stat = await fs.stat(filePath);
        if (stat.isFile()) {
          totalSize += stat.size;
        }
      }
    } catch (err) {
      console.error('[Admin Files] Error calculating storage:', err);
    }
    
    // Get upload trends
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const { data: recentUploads, error: uploadError } = await supabase
      .from('files')
      .select('created_at')
      .gte('created_at', thirtyDaysAgo.toISOString());
    
    if (uploadError) throw uploadError;
    
    // Group by day
    const uploadsByDay = {};
    recentUploads.forEach(upload => {
      const day = new Date(upload.created_at).toISOString().split('T')[0];
      uploadsByDay[day] = (uploadsByDay[day] || 0) + 1;
    });
    
    res.json({
      totalFiles: fileTypes.length,
      typeDistribution,
      storageUsed: {
        bytes: totalSize,
        formatted: formatBytes(totalSize)
      },
      uploadTrend: Object.entries(uploadsByDay).map(([date, count]) => ({
        date,
        count
      })).sort((a, b) => a.date.localeCompare(b.date))
    });
  } catch (error) {
    console.error('[Admin Files] Error fetching stats:', error);
    res.status(500).json({
      error: { message: 'Failed to fetch file statistics' }
    });
  }
});

// Delete file
router.delete('/:fileId', requireAdminAuth, async (req, res) => {
  try {
    const { fileId } = req.params;
    const supabase = getSupabase();
    
    // Get file info first
    const { data: file, error: fetchError } = await supabase
      .from('files')
      .select('*')
      .eq('id', fileId)
      .single();
    
    if (fetchError || !file) {
      return res.status(404).json({
        error: { message: 'File not found' }
      });
    }
    
    // Delete from database
    const { error: deleteError } = await supabase
      .from('files')
      .delete()
      .eq('id', fileId);
    
    if (deleteError) throw deleteError;
    
    // Try to delete physical file
    if (file.filepath) {
      const filePath = path.join(path.dirname(path.dirname(__dirname)), file.filepath);
      try {
        await fs.unlink(filePath);
      } catch (err) {
        console.error('[Admin Files] Error deleting physical file:', err);
      }
    }
    
    res.json({
      success: true,
      message: 'File deleted successfully'
    });
  } catch (error) {
    console.error('[Admin Files] Error deleting file:', error);
    res.status(500).json({
      error: { message: 'Failed to delete file' }
    });
  }
});

// Get file details
router.get('/:fileId', requireAdminAuth, async (req, res) => {
  try {
    const { fileId } = req.params;
    const supabase = getSupabase();
    
    const { data: file, error } = await supabase
      .from('files')
      .select('*, profiles!inner(email, name)')
      .eq('id', fileId)
      .single();
    
    if (error || !file) {
      return res.status(404).json({
        error: { message: 'File not found' }
      });
    }
    
    // Get file size if available
    if (file.filepath) {
      const filePath = path.join(path.dirname(path.dirname(__dirname)), file.filepath);
      try {
        const stat = await fs.stat(filePath);
        file.size = stat.size;
        file.sizeFormatted = formatBytes(stat.size);
      } catch (err) {
        console.error('[Admin Files] Error getting file size:', err);
      }
    }
    
    res.json(file);
  } catch (error) {
    console.error('[Admin Files] Error fetching file details:', error);
    res.status(500).json({
      error: { message: 'Failed to fetch file details' }
    });
  }
});

// Get file size settings
router.get('/settings/size-limits', requireAdminAuth, async (req, res) => {
  try {
    const supabase = getSupabase();
    
    // Try to get settings from database
    const { data: settings, error } = await supabase
      .from('app_settings')
      .select('*')
      .eq('key', 'file_size_limits')
      .single();
    
    let fileSizeSettings;
    
    if (error || !settings) {
      // Use defaults if no settings in database
      fileSizeSettings = {
        maxFileSize: 10485760, // 10MB default
        allowedTypes: ['application/pdf', 'text/plain', 'text/csv', 'image/jpeg', 'image/png'],
        maxFilesPerUser: 100,
        storageQuotaPerUser: 104857600 // 100MB default
      };
      
      // Create default settings in database
      await supabase
        .from('app_settings')
        .insert({
          key: 'file_size_limits',
          value: fileSizeSettings,
          description: 'File upload size and type restrictions'
        });
    } else {
      fileSizeSettings = settings.value;
    }
    
    // Add formatted values
    const response = {
      ...fileSizeSettings,
      maxFileSizeFormatted: formatBytes(fileSizeSettings.maxFileSize),
      storageQuotaPerUserFormatted: formatBytes(fileSizeSettings.storageQuotaPerUser)
    };
    
    res.json(response);
  } catch (error) {
    console.error('[Admin Files] Error fetching size settings:', error);
    res.status(500).json({
      error: { message: 'Failed to fetch file size settings' }
    });
  }
});

// Update file size settings
router.put('/settings/size-limits', requireAdminAuth, async (req, res) => {
  try {
    const { maxFileSize, allowedTypes, maxFilesPerUser, storageQuotaPerUser } = req.body;
    const supabase = getSupabase();
    
    // Validation
    if (maxFileSize && (typeof maxFileSize !== 'number' || maxFileSize < 1024)) {
      return res.status(400).json({
        error: { message: 'Invalid max file size. Must be at least 1KB (1024 bytes)' }
      });
    }
    
    if (allowedTypes && !Array.isArray(allowedTypes)) {
      return res.status(400).json({
        error: { message: 'Allowed types must be an array' }
      });
    }
    
    // Get current settings
    const { data: currentSettings } = await supabase
      .from('app_settings')
      .select('*')
      .eq('key', 'file_size_limits')
      .single();
    
    const currentValues = currentSettings?.value || {
      maxFileSize: 10485760,
      allowedTypes: ['application/pdf', 'text/plain', 'text/csv', 'image/jpeg', 'image/png'],
      maxFilesPerUser: 100,
      storageQuotaPerUser: 104857600
    };
    
    // Merge with new values
    const updatedValues = {
      maxFileSize: maxFileSize || currentValues.maxFileSize,
      allowedTypes: allowedTypes || currentValues.allowedTypes,
      maxFilesPerUser: maxFilesPerUser || currentValues.maxFilesPerUser,
      storageQuotaPerUser: storageQuotaPerUser || currentValues.storageQuotaPerUser
    };
    
    // Update or insert settings
    if (currentSettings) {
      await supabase
        .from('app_settings')
        .update({
          value: updatedValues,
          updated_at: new Date().toISOString()
        })
        .eq('key', 'file_size_limits');
    } else {
      await supabase
        .from('app_settings')
        .insert({
          key: 'file_size_limits',
          value: updatedValues,
          description: 'File upload size and type restrictions'
        });
    }
    
    // Invalidate the file size cache so new uploads use the updated limit
    invalidateFileSizeCache();
    
    // Return formatted response
    const response = {
      success: true,
      settings: {
        ...updatedValues,
        maxFileSizeFormatted: formatBytes(updatedValues.maxFileSize),
        storageQuotaPerUserFormatted: formatBytes(updatedValues.storageQuotaPerUser)
      },
      message: 'File size settings updated successfully'
    };
    
    res.json(response);
  } catch (error) {
    console.error('[Admin Files] Error updating size settings:', error);
    res.status(500).json({
      error: { message: 'Failed to update file size settings' }
    });
  }
});

// Helper function to format bytes
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export default router;