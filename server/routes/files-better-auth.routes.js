import express from 'express';
import path from 'path';
import { promises as fs } from 'fs';
import { authMiddleware, requireAuth } from '../middleware/auth.middleware.js';
import { getSupabase } from '../config/services.config.js';
import { getServiceSupabase } from '../utils/getServiceSupabase.js';
import { SUPPORTED_TYPES, getSupportedFormatsMessage } from '../utils/supportedTypes.js';
import { createDynamicSingleUpload } from '../middleware/dynamicUpload.js';
import { validateUpload, rateLimitUploads } from '../middleware/secureUpload.middleware.js';
import { getTotalFileCount, getSubscriptionLimits, checkSubscriptionLimit } from '../middleware/subscriptionLimits.middleware.js';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const fileProcessor = require('../services/fileProcessor.cjs');

console.log('[Files Routes] File loaded at:', new Date().toISOString());

// Export a function that takes upload middleware
export default function createFilesRouter(dynamicUpload) {
  const router = express.Router();
  
  // Auth middleware is already applied at the server level before this router
  // router.use(authMiddleware); // Removed to prevent overriding req.userId

  // Debug middleware to log all responses
  router.use((req, res, next) => {
  const originalJson = res.json;
  res.json = function(data) {
    console.log('[Files] Response being sent:', {
      url: req.url,
      statusCode: res.statusCode,
      dataKeys: data ? Object.keys(data) : 'null',
      dataPreview: data ? JSON.stringify(data).substring(0, 100) : 'null'
    });
    originalJson.call(this, data);
  };
  next();
});

  // Get user files - MOVED OUTSIDE module.exports
  router.get('/list', async (req, res) => {
  try {
    console.log('[Files] Fetching files for user:', req.userId);
    console.log('[Files] Has req.user?', !!req.user);
    console.log('[Files] Type of req.user:', typeof req.user);
    
    try {
    console.log('[Files] Inside try block');
    const supabase = getSupabase();
    console.log('[Files] Got supabase client');
    
    // Fetch files from database
    console.log('[Files] Executing query...');
    const { data: files, error } = await supabase
      .from('files')
      .select('id, name, size, type, uploaded_at, folder_id')
      .eq('user_id', req.userId)
      .order('uploaded_at', { ascending: false });
    
    console.log(`[Files] Query completed. Error:`, error);
    console.log(`[Files] Query result: ${files?.length || 0} files found for user ${req.userId}`);
    
    if (error) {
      console.error('Error fetching files:', error);
      return res.json({ files: [] });
    }
    
    // Log first few files for debugging
    if (files && files.length > 0) {
      console.log('[Files] Sample files:', files.slice(0, 3).map(f => ({
        id: f.id,
        name: f.name,
        user_id: f.user_id
      })));
    }
    
    // Transform files to match frontend expectations
    const transformedFiles = files.map(file => ({
      id: file.id,
      name: file.name,
      size: file.size,
      type: file.type,
      uploadedAt: file.uploaded_at,
      folder_id: file.folder_id || null
    }));
    
    console.log(`[Files] Returning ${transformedFiles.length} files`);
    console.log('[Files] Response structure:', {
      files: transformedFiles.length,
      firstFile: transformedFiles[0] ? {
        id: transformedFiles[0].id,
        name: transformedFiles[0].name,
        hasSize: transformedFiles[0].size !== undefined,
        hasType: transformedFiles[0].type !== undefined
      } : null
    });
    
    const responseData = { files: transformedFiles };
    console.log('[Files] Sending response:', JSON.stringify(responseData).substring(0, 200) + '...');
    res.json(responseData);
    } catch (error) {
      console.error('Files list inner error:', error);
      res.status(500).json({ error: { message: 'Internal server error' } });
    }
  } catch (outerError) {
    console.error('[Files] OUTER ERROR:', outerError);
    console.error('[Files] Stack:', outerError.stack);
    res.status(500).json({ error: { message: 'Critical error in files list' } });
  }
});

  // Get file size limit configuration
  router.get('/size-limit', async (req, res) => {
  try {
    const supabase = getSupabase();
    
    // Try to get from app_settings first
    const { data, error } = await supabase
      .rpc('get_app_setting', { p_key: 'file_size_limit' })
      .single();
    
    let config;
    if (!error && data) {
      config = data;
    } else {
      // Fallback to default
      config = { limit_mb: 10, max_allowed_mb: 50 };
    }
    
    res.json({ 
      limitMB: config.limit_mb,
      maxAllowedMB: config.max_allowed_mb,
      limitBytes: config.limit_mb * 1024 * 1024
    });
  } catch (error) {
    console.error('Error fetching file size limit:', error);
    // Return default values on error
    res.json({ 
      limitMB: 10,
      maxAllowedMB: 50,
      limitBytes: 10 * 1024 * 1024
    });
  }
});

// Create single file upload middleware for image analysis
const dynamicSingleImageUpload = createDynamicSingleUpload('image');
  // Upload files - with rate limiting and secure validation
  router.post('/upload', rateLimitUploads, checkSubscriptionLimit('file_upload'), dynamicUpload, validateUpload, async (req, res) => {
    console.log('[Files/Upload] === File Upload Request ===');
    console.log('[Files/Upload] Endpoint: POST /api/files/upload');
    console.log('[Files/Upload] User:', req.userId);
    console.log('[Files/Upload] Files count:', req.files?.length || 0);
    console.log('[Files/Upload] Files:', req.files?.map(f => ({
      originalname: f.originalname,
      mimetype: f.mimetype,
      size: f.size,
      encoding: f.encoding
    })));
    console.log('[Files/Upload] Body:', req.body);
    console.log('[Files/Upload] Timestamp:', new Date().toISOString());
    
    try {
      const supabase = getSupabase();
      
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: { message: 'No files uploaded' } });
      }
      
      const userId = req.userId;
      const folderId = req.body.folderId || null;
      
      
      // Validate file types before processing
      const unsupportedFiles = [];
      for (const file of req.files) {
        const typeInfo = SUPPORTED_TYPES[file.mimetype];
        if (!typeInfo) {
          unsupportedFiles.push({
            name: file.originalname,
            type: file.mimetype,
            message: `File type "${file.mimetype.split('/').pop()}" is not supported. Supported formats: ${getSupportedFormatsMessage()}.`
          });
        } else if (!typeInfo.supported) {
          unsupportedFiles.push({
            name: file.originalname,
            type: file.mimetype,
            message: typeInfo.message || `${typeInfo.name} files are not supported`
          });
        }
      }
      
      if (unsupportedFiles.length > 0) {
        return res.status(400).json({
          error: {
            message: 'Some files have unsupported formats',
            details: unsupportedFiles
          }
        });
      }

      // Check file storage limit (total files, not daily)
      const currentFileCount = await getTotalFileCount(userId);
      const allLimits = await getSubscriptionLimits();
      // Get user tier from profile
      const { data: tierData } = await supabase
        .from('profiles')
        .select('subscription_tier, subscription_end_date')
        .eq('id', userId)
        .single();
      const userTier = (tierData?.subscription_tier &&
        (!tierData.subscription_end_date || new Date(tierData.subscription_end_date) >= new Date()))
        ? tierData.subscription_tier : 'free';
      const tierLimits = allLimits[userTier] || allLimits.free;
      const rawFileStorage = tierLimits.file_storage;
      const fileStorageLimit = (rawFileStorage && typeof rawFileStorage === 'object') ? rawFileStorage.limit : (rawFileStorage ?? 10);

      if (fileStorageLimit !== -1 && currentFileCount + req.files.length > fileStorageLimit) {
        return res.status(429).json({
          error: {
            message: `File storage limit reached. You have ${currentFileCount}/${fileStorageLimit} files. Delete files to upload more, or upgrade your plan.`,
            code: 'FILE_STORAGE_LIMIT_REACHED',
            tier: userTier,
            limit: fileStorageLimit,
            usage: currentFileCount,
            incoming: req.files.length,
          }
        });
      }

      // User profile should already exist due to syncUserToSupabase middleware
      
      const uploadedFiles = [];
      const failedFiles = [];
      
      for (const file of req.files) {
        try {
          console.log(`Processing file: ${file.originalname}, size: ${file.size}, type: ${file.mimetype}`);

          // Convert HEIC/HEIF to JPEG before processing
          if (file.mimetype === 'image/heic' || file.mimetype === 'image/heif') {
            try {
              const sharp = (await import('sharp')).default;
              file.buffer = await sharp(file.buffer).jpeg({ quality: 85 }).toBuffer();
              file.mimetype = 'image/jpeg';
              file.originalname = file.originalname.replace(/\.(heic|heif)$/i, '.jpg');
              console.log(`[Files/Upload] Converted HEIC/HEIF to JPEG: ${file.originalname}`);
            } catch (convErr) {
              console.error('[Files/Upload] HEIC conversion failed:', convErr);
              failedFiles.push({ name: file.originalname, error: 'Could not convert HEIC image. Please export as JPEG.' });
              continue;
            }
          }

          // Generate unique filename with sanitization
          const timestamp = Date.now();
          // Sanitize filename: remove special characters, replace spaces with underscores
          const sanitizedName = file.originalname
            .replace(/[^a-zA-Z0-9.-]/g, '_') // Replace special chars with underscore
            .replace(/_+/g, '_') // Replace multiple underscores with single
            .replace(/^_|_$/g, ''); // Remove leading/trailing underscores
          const uniqueName = `${timestamp}-${sanitizedName}`;
          const filePath = `${userId}/${uniqueName}`;
          
          // Upload to Supabase Storage
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('user-files')
            .upload(filePath, file.buffer, {
              contentType: file.mimetype,
              upsert: false
            });
          
          if (uploadError) {
            console.error('Storage upload error:', uploadError);
            console.error('Failed file path:', filePath);
            console.error('Original filename:', file.originalname);
            console.error('Sanitized filename:', uniqueName);
            
            // If RLS policy error, try to save file metadata directly to database
            if (uploadError.message && uploadError.message.includes('row-level security policy')) {
              console.log('RLS policy error detected, saving file metadata to database only');
              
              // Save file metadata to database without storage
              const { data: fileRecord, error: dbError } = await supabase
                .from('files')
                .insert([{
                  user_id: userId,
                  name: file.originalname,
                  size: file.size,
                  type: file.mimetype,
                  path: null, // No storage path since upload failed
                  folder_id: folderId
                }])
                .select('id, name, size, type, uploaded_at')
                .single();
              
              if (!dbError && fileRecord) {
                // Process file content for chunks from buffer
                try {
                  const processed = await fileProcessor.processFileIntelligent(file.buffer, file.mimetype, file.originalname, 'upload', false);
                  
                  if (processed.chunks && processed.chunks.length > 0) {
                    // Save chunks to database
                    const chunksToSave = processed.chunks.map((chunk, index) => ({
                      file_id: fileRecord.id,
                      chunk_index: index,
                      content: chunk.content,
                      metadata: chunk.metadata
                    }));
                    
                    const { error: chunkError } = await supabase
                      .from('file_chunks')
                      .insert(chunksToSave);
                    
                    if (chunkError) {
                      console.error('Error saving chunks:', chunkError);
                    }
                  }
                  
                  uploadedFiles.push({
                    id: fileRecord.id,
                    name: fileRecord.name,
                    size: fileRecord.size,
                    type: fileRecord.type,
                    uploadedAt: fileRecord.uploaded_at
                  });
                  
                  continue; // Skip the rest and process next file
                } catch (processError) {
                  console.error('File processing error:', processError);
                }
              }
            }
            
            // Provide more user-friendly error messages
            let errorMessage = 'Failed to upload file';
            if (uploadError.message) {
              if (uploadError.message.includes('row-level security')) {
                errorMessage = 'Permission denied. Please ensure you are logged in correctly.';
              } else if (uploadError.message.includes('payload too large')) {
                errorMessage = 'File is too large. Maximum file size is 50MB.';
              } else if (uploadError.message.includes('quota')) {
                errorMessage = 'Storage quota exceeded. Please delete some files to free up space.';
              } else {
                errorMessage = uploadError.message;
              }
            }
            
            failedFiles.push({
              name: file.originalname,
              error: errorMessage
            });
            // Continue with next file
            continue;
          }
          
          console.log('File uploaded to storage:', filePath);
          
          // Save file metadata to database
          const { data: fileRecord, error: dbError } = await supabase
            .from('files')
            .insert([{
              user_id: userId,
              name: file.originalname,
              size: file.size,
              type: file.mimetype,
              path: filePath,
              folder_id: folderId
            }])
            .select('id, name, size, type, uploaded_at')
            .single();
          
          if (dbError) {
            console.error('Database insert error:', dbError);
            failedFiles.push({
              name: file.originalname,
              error: dbError.message || 'Failed to save to database'
            });
            // Try to delete the uploaded file
            await supabase.storage
              .from('user-files')
              .remove([filePath]);
            continue;
          }
          
          // Process file content for chunks
          let processingSuccessful = false;
          try {
            console.log(`[Files] Processing file content: ${file.originalname}, type: ${file.mimetype}`);
            const processed = await fileProcessor.processFileIntelligent(file.buffer, file.mimetype, file.originalname, 'upload', false);
            
            console.log(`[Files] File processed, chunks: ${processed.chunks?.length || 0}`);
            
            if (processed.chunks && processed.chunks.length > 0) {
              // Save chunks to database
              const chunksToSave = processed.chunks.map((chunk, index) => ({
                file_id: fileRecord.id,
                chunk_index: index,
                content: chunk.content,
                metadata: chunk.metadata
              }));
              
              console.log(`[Files] Saving ${chunksToSave.length} chunks for file ${fileRecord.id}`);
              
              const { error: chunkError } = await supabase
                .from('file_chunks')
                .insert(chunksToSave);
              
              if (chunkError) {
                console.error('Error saving chunks:', chunkError);
                console.error('Chunk save details:', { file_id: fileRecord.id, chunk_count: chunksToSave.length });
              } else {
                processingSuccessful = true;
                console.log(`[Files] Successfully saved ${chunksToSave.length} chunks`);
                
                // Skip status update - files table doesn't have status column
                // and it's not needed since we track processing by presence of chunks
                console.log(`[Files] File processing completed for ${fileRecord.id}`);
                
                // Delete original file from storage to save space
                console.log(`[Files] Deleting original file from storage: ${filePath}`);
                await supabase.storage
                  .from('user-files')
                  .remove([filePath]);
              }
            }
          } catch (processError) {
            console.error('File processing error:', processError);
            // Note: File was uploaded but processing failed
            processingSuccessful = false;
          }
          
          uploadedFiles.push({
            id: fileRecord.id,
            name: fileRecord.name,
            size: fileRecord.size,
            type: fileRecord.type,
            uploadedAt: fileRecord.uploaded_at,
            processingStatus: processingSuccessful ? 'completed' : 'uploaded_only',
            processingNote: !processingSuccessful ? 'Text extraction not available for this file type' : undefined
          });
          
        } catch (error) {
          console.error('[Files/Upload] Error processing individual file:', {
            filename: file.originalname,
            mimetype: file.mimetype,
            size: file.size,
            error: error.message,
            stack: error.stack,
            timestamp: new Date().toISOString()
          });
          failedFiles.push({
            originalname: file.originalname,
            error: error.message
          });
        }
      }
      
      if (uploadedFiles.length === 0) {
        return res.status(500).json({ 
          error: { 
            message: 'Failed to upload any files',
            details: failedFiles
          } 
        });
      }
      
      const response = {
        message: `Successfully uploaded ${uploadedFiles.length} file${uploadedFiles.length > 1 ? 's' : ''}`,
        files: uploadedFiles
      };
      
      if (failedFiles.length > 0) {
        response.warnings = failedFiles;
        response.message += ` (${failedFiles.length} failed)`;
      }
      
      // Track file upload activity
      if (uploadedFiles.length > 0) {
        try {
          const statsModule = await import('./stats.routes.js');
          
          // Track each uploaded file as a separate activity
          for (const file of uploadedFiles) {
            await statsModule.trackUserActivity(supabase, userId, {
              sessionType: 'file_upload',
              contentId: file.id,
              contentTitle: file.name,
              startTime: new Date().toISOString(),
              endTime: new Date().toISOString(),
              questionsAnswered: 1, // Each file upload counts as 1 activity
              metadata: {
                fileId: file.id,
                fileName: file.name,
                fileSize: file.size,
                fileType: file.type,
                folderId: folderId,
                storagePath: file.storage_path,
                status: file.status
              }
            });
          }
          
          console.log(`[Files/Upload] Activity tracked for ${uploadedFiles.length} file(s)`);
        } catch (trackingError) {
          console.error('[Files/Upload] Error tracking file upload activity:', trackingError);
          // Don't fail the request if tracking fails
        }
      }
      
      res.json(response);
    } catch (error) {
      console.error('[Files/Upload] Upload error:', {
        error: error.message,
        stack: error.stack,
        userId: req.userId,
        filesCount: req.files?.length || 0,
        timestamp: new Date().toISOString()
      });
      res.status(500).json({ error: { message: 'Internal server error' } });
    }
  });

  // Test endpoint
  router.get('/test', (req, res) => {
    console.log('[Files Test] User ID:', req.userId);
    res.json({ 
      test: true, 
      userId: req.userId,
      timestamp: new Date().toISOString()
    });
  });

  // Process file content
  router.get('/:fileId/process', async (req, res) => {
    const { fileId } = req.params;
    console.log('Processing file:', fileId);
    
    try {
      const supabase = getSupabase();
      
      // Get file info from database
      const { data: file, error: fetchError } = await supabase
        .from('files')
        .select('id, name, type, path')
        .eq('id', fileId)
        .eq('user_id', req.userId)
        .single();

      if (fetchError || !file) {
        return res.status(404).json({ error: { message: 'File not found' } });
      }

      // Check if we already have processed chunks
      // Use service role to bypass RLS if available
      const serviceSupabase = getServiceSupabase();
      const dbClient = serviceSupabase || supabase;

      const { data: existingChunks, error: chunksError } = await dbClient
        .from('file_chunks')
        .select('id, content, chunk_index, metadata')
        .eq('file_id', fileId)
        .order('chunk_index', { ascending: true });
      
      if (!chunksError && existingChunks && existingChunks.length > 0) {
        // Always return existing chunks - don't reprocess files that already have chunks
        console.log(`File has ${existingChunks.length} existing chunks`);
        
        // Update file status to processed if not already
        if (file.status !== 'processed' && file.status !== 'already_processed') {
          await supabase
            .from('files')
            .update({ status: 'processed' })
            .eq('id', fileId);
        }
        
        // Return existing chunks
        return res.json({
          fileId: file.id,
          fileName: file.name,
          chunks: existingChunks.map(c => ({
            id: c.id,
            content: c.content,
            metadata: c.metadata
          })),
          totalChunks: existingChunks.length,
          status: 'processed'
        });
      }
      
      // Download file from storage
      if (file.path) {
        try {
          const { data: fileData, error: downloadError } = await supabase.storage
            .from('user-files')
            .download(file.path);
          
          if (downloadError) {
            console.error('Download error:', downloadError);
            // Return mock data for now
            const mockContent = `This is a sample content for ${file.name}. In production, this would contain the actual file content.`;
            const mockChunks = [{
              id: 'chunk_0',
              content: mockContent,
              metadata: { fileName: file.name, chunkIndex: 0 }
            }];
            
            return res.json({
              fileId: file.id,
              fileName: file.name,
              chunks: mockChunks,
              totalChunks: 1,
              totalCharacters: mockContent.length
            });
          }
          
          // Convert blob to buffer
          const buffer = Buffer.from(await fileData.arrayBuffer());
          
          // Process the file
          const processed = await fileProcessor.processFile(buffer, file.type, file.name);
          
          // Save chunks to database
          const chunksToSave = processed.chunks.map((chunk, index) => ({
            file_id: fileId,
            chunk_index: index,
            content: chunk.content,
            metadata: chunk.metadata
          }));
          
          const { error: saveError } = await supabase
            .from('file_chunks')
            .insert(chunksToSave);
          
          if (saveError) {
            console.error('Save chunks error:', saveError);
          }
          
          // Update file status to processed
          await supabase
            .from('files')
            .update({ status: 'processed' })
            .eq('id', fileId);
          
          return res.json({
            fileId: file.id,
            fileName: file.name,
            chunks: processed.chunks,
            totalChunks: processed.totalChunks,
            totalCharacters: processed.totalCharacters,
            status: 'processed'
          });
        } catch (processingError) {
          console.error('File processing error:', processingError);
          // Return mock data as fallback
          const mockContent = `Sample educational content from ${file.name}:\n\nChapter 1: Introduction\nThis document covers important concepts that will help you in your studies.\n\nKey Points:\n- Understanding fundamentals is crucial\n- Practice makes perfect\n- Always ask questions when in doubt`;
          
          const mockChunks = [{
            id: 'chunk_0',
            content: mockContent,
            metadata: { fileName: file.name, chunkIndex: 0 }
          }];
          
          return res.json({
            fileId: file.id,
            fileName: file.name,
            chunks: mockChunks,
            totalChunks: 1,
            totalCharacters: mockContent.length
          });
        }
      } else {
        // For files without storage path, return mock data
        const mockContent = `Sample content from ${file.name}:\n\nThis is educational material that can help you learn.\n\nTopics covered:\n- Basic concepts\n- Advanced techniques\n- Practice exercises`;
        
        return res.json({
          fileId: file.id,
          fileName: file.name,
          chunks: [{
            id: 'chunk_0',
            content: mockContent,
            metadata: { fileName: file.name, chunkIndex: 0 }
          }],
          totalChunks: 1,
          totalCharacters: mockContent.length
        });
      }
    } catch (error) {
      console.error('File processing error:', error);
      res.status(500).json({ error: { message: 'Failed to process file' } });
    }
  });

  // Rename file
  router.patch('/:fileId/rename', async (req, res) => {
    const { fileId } = req.params;
    const { name } = req.body;
    console.log('Renaming file:', fileId, 'new name:', name);
    
    try {
      // Validate name
      if (!name || !name.trim()) {
        return res.status(400).json({ error: { message: 'File name is required' } });
      }
      
      const newName = name.trim();
      
      // Validate name length
      if (newName.length > 255) {
        return res.status(400).json({ error: { message: 'File name too long (max 255 characters)' } });
      }
      
      const supabase = getSupabase();
      
      // Update file name
      const { data: file, error } = await supabase
        .from('files')
        .update({ name: newName })
        .eq('id', fileId)
        .eq('user_id', req.userId)
        .select('id, name, size, type, uploaded_at, folder_id')
        .single();
      
      if (error) {
        console.error('Error renaming file:', error);
        return res.status(500).json({ error: { message: 'Failed to rename file' } });
      }
      
      if (!file) {
        return res.status(404).json({ error: { message: 'File not found' } });
      }
      
      res.json({ 
        file: {
          id: file.id,
          name: file.name,
          type: file.type,
          size: file.size,
          uploadedAt: file.created_at,
        },
        message: 'File renamed successfully' 
      });
    } catch (error) {
      console.error('Rename file error:', error);
      res.status(500).json({ error: { message: 'Internal server error' } });
    }
  });

  // Update file
  router.patch('/:fileId', async (req, res) => {
    const { fileId } = req.params;
    const { folder_id } = req.body;
    console.log('Updating file:', fileId, 'folder_id:', folder_id);
    
    try {
      const supabase = getSupabase();
      
      // Update file
      const { data: file, error } = await supabase
        .from('files')
        .update({ folder_id: folder_id })
        .eq('id', fileId)
        .eq('user_id', req.userId)
        .select('id, name, size, type, uploaded_at, folder_id')
        .single();
      
      if (error) {
        console.error('Error updating file:', error);
        return res.status(500).json({ error: { message: 'Failed to update file' } });
      }
      
      res.json({ file, message: 'File updated successfully' });
    } catch (error) {
      console.error('Update file error:', error);
      res.status(500).json({ error: { message: 'Internal server error' } });
    }
  });

  // Delete file
  router.delete('/:fileId', async (req, res) => {
    const { fileId } = req.params;
    console.log('Deleting file:', fileId);
    
    try {
      const supabase = getSupabase();
      
      // Get file info first
      const { data: file, error: fetchError } = await supabase
        .from('files')
        .select('id, path')
        .eq('id', fileId)
        .eq('user_id', req.userId)
        .single();

      if (fetchError || !file) {
        return res.status(404).json({ error: { message: 'File not found' } });
      }

      // Count chunks that will be deleted (for logging)
      const { count: chunkCount } = await supabase
        .from('file_chunks')
        .select('*', { count: 'exact', head: true })
        .eq('file_id', fileId);
      
      console.log(`File ${fileId} has ${chunkCount || 0} chunks that will be deleted`);
      
      // Try to delete from storage
      if (file.path) {
        const { error: storageError } = await supabase.storage
          .from('user-files')
          .remove([file.path]);
        
        if (storageError) {
          console.error('Storage deletion error:', storageError);
        }
      }
      
      // Delete from database
      const { error: deleteError } = await supabase
        .from('files')
        .delete()
        .eq('id', fileId)
        .eq('user_id', req.userId);
      
      if (deleteError) {
        console.error('Database deletion error:', deleteError);
        return res.status(500).json({ error: { message: 'Failed to delete file' } });
      }
      
      console.log(`Successfully deleted file ${fileId} and ${chunkCount || 0} chunks`);
      res.json({ 
        message: 'File deleted successfully',
        deletedChunks: chunkCount || 0
      });
    } catch (error) {
      console.error('Delete file error:', error);
      res.status(500).json({ error: { message: 'Internal server error' } });
    }
  });

  // Legacy endpoint for compatibility
  router.get('/', (_, res) => {
    console.log('Fetching files list (legacy)');
    
    // Return mock files
    res.json({
      files: [
        {
          id: '1',
          name: 'Mathematics Notes.pdf',
          size: 1024000,
          type: 'application/pdf',
          created_at: new Date(Date.now() - 86400000).toISOString(),
        },
        {
          id: '2',
          name: 'Physics Chapter 5.docx',
          size: 512000,
          type: 'application/docx',
          created_at: new Date(Date.now() - 172800000).toISOString(),
        },
      ]
    });
  });

  // Debug endpoint to check file chunks
  router.get('/:fileId/debug-chunks', async (req, res) => {
    const { fileId } = req.params;
    console.log('[Debug] Checking chunks for file:', fileId);
    
    try {
      const supabase = getSupabase();
      const serviceSupabase = getServiceSupabase();
      
      // Get file info
      const { data: file, error: fileError } = await supabase
        .from('files')
        .select('*')
        .eq('id', fileId)
        .single();
      
      console.log('[Debug] File info:', file);
      
      // Try regular supabase
      const { data: chunks1, error: error1 } = await supabase
        .from('file_chunks')
        .select('*')
        .eq('file_id', fileId);
      
      console.log('[Debug] Regular supabase chunks:', chunks1?.length || 0, 'error:', error1);
      
      // Try service supabase if available
      let chunks2 = null;
      let error2 = null;
      if (serviceSupabase) {
        const result = await serviceSupabase
          .from('file_chunks')
          .select('*')
          .eq('file_id', fileId);
        chunks2 = result.data;
        error2 = result.error;
        console.log('[Debug] Service supabase chunks:', chunks2?.length || 0, 'error:', error2);
      }
      
      res.json({
        file,
        regularChunks: {
          count: chunks1?.length || 0,
          error: error1,
          sample: chunks1?.[0]
        },
        serviceChunks: {
          count: chunks2?.length || 0,
          error: error2,
          sample: chunks2?.[0]
        }
      });
    } catch (error) {
      console.error('[Debug] Error:', error);
      res.status(500).json({ error: { message: 'Debug error', details: error.message } });
    }
  });

  // NEW ENDPOINT: Advanced Image Analysis for Testing
  router.post('/analyze-image', dynamicSingleImageUpload, async (req, res) => {
    console.log('Advanced image analysis request');
    
    try {
      if (!req.file) {
        return res.status(400).json({ error: { message: 'No image file provided' } });
      }

      const file = req.file;
      
      // Validate file type
      if (!file.mimetype.startsWith('image/')) {
        return res.status(400).json({ error: { message: 'File must be an image' } });
      }

      console.log(`[ImageAnalysis] Processing ${file.originalname} (${file.size} bytes)`);
      
      // Use the advanced image processor directly
      const { default: advancedImageProcessor } = await import('../services/advancedImageProcessor.cjs');
      const result = await advancedImageProcessor.processEducationalImage(file.buffer, file.originalname);
      
      // Also get basic file processing for comparison
      const basicResult = await fileProcessor.processFileIntelligent(file.buffer, file.mimetype, file.originalname, 'upload', false);
      
      // Return comprehensive analysis
      res.json({
        success: true,
        fileName: file.originalname,
        fileSize: file.size,
        analysis: {
          advanced: result,
          basic: basicResult,
          comparison: {
            contentType: result.contentType.primary,
            confidence: result.metadata.confidence,
            hasStructuredData: !!basicResult.structuredData,
            hasOpenCV: result.metadata.hasOpenCV
          }
        },
        // Format for easy AI consumption
        aiReadyData: basicResult.structuredData || {
          contentType: result.contentType.primary,
          rawText: result.ocrResult.text,
          confidence: result.metadata.confidence
        }
      });
      
    } catch (error) {
      console.error('Advanced image analysis error:', error);
      res.status(500).json({ 
        error: { 
          message: 'Image analysis failed',
          details: error.message 
        } 
      });
    }
  });

  // Get file size limit endpoint for mobile app
  router.get('/size-limit', requireAuth, async (req, res) => {
    try {
      const supabase = getSupabase();
      
      // Try to get settings from database
      const { data: settings, error } = await supabase
        .from('app_settings')
        .select('value')
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
      } else {
        fileSizeSettings = settings.value;
      }
      
      // Return in format expected by mobile app
      res.json({
        limitMB: Math.round(fileSizeSettings.maxFileSize / 1048576),
        limitBytes: fileSizeSettings.maxFileSize,
        allowedTypes: fileSizeSettings.allowedTypes
      });
    } catch (error) {
      console.error('[Files] Error fetching size limit:', error);
      // Return default on error
      res.json({
        limitMB: 10,
        limitBytes: 10485760,
        allowedTypes: ['application/pdf', 'text/plain', 'text/csv', 'image/jpeg', 'image/png']
      });
    }
  });

  return router;
}