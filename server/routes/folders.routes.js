import express from 'express';
const router = express.Router();
import { authMiddleware, requireAuth } from '../middleware/auth.middleware.js';
import { getSupabase } from '../config/services.config.js';

// Auth middleware is already applied at the server level before this router
// router.use(authMiddleware); // Removed to prevent overriding req.userId

// Create folder
router.post('/create', async (req, res) => {
  const { name, parent_folder_id } = req.body;
  console.log('Creating folder:', { name, parent_folder_id });
  
  try {
    const supabase = getSupabase();
    
    if (!name || !name.trim()) {
      return res.status(400).json({ error: { message: 'Folder name is required' } });
    }
    
    // Create folder
    const { data: folder, error } = await supabase
      .from('folders')
      .insert([{
        user_id: req.userId,
        name: name.trim(),
        parent_folder_id: parent_folder_id || null
      }])
      .select()
      .single();
    
    if (error) {
      console.error('Error creating folder:', error);
      return res.status(500).json({ error: { message: 'Failed to create folder' } });
    }
    
    res.json({
      folder,
      message: 'Folder created successfully'
    });
  } catch (error) {
    console.error('Create folder error:', error);
    res.status(500).json({ error: { message: 'Internal server error' } });
  }
});

// Get user folders
router.get('/list', async (req, res) => {
  console.log('Fetching user folders');
  
  try {
    const supabase = getSupabase();
    
    // Fetch folders from database
    const { data: folders, error } = await supabase
      .from('folders')
      .select('*')
      .eq('user_id', req.userId)
      .order('name', { ascending: true });
    
    if (error) {
      console.error('Error fetching folders:', error);
      return res.json({ folders: [] });
    }
    
    res.json({ folders: folders || [] });
  } catch (error) {
    console.error('Folders list error:', error);
    res.status(500).json({ error: { message: 'Internal server error' } });
  }
});

// Update folder
router.patch('/:folderId', async (req, res) => {
  const { folderId } = req.params;
  const { name, parent_folder_id } = req.body;
  console.log('Updating folder:', folderId);
  
  try {
    const supabase = getSupabase();
    
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (parent_folder_id !== undefined) updateData.parent_folder_id = parent_folder_id;
    
    const { data: folder, error } = await supabase
      .from('folders')
      .update(updateData)
      .eq('id', folderId)
      .eq('user_id', req.userId)
      .select()
      .single();
    
    if (error) {
      console.error('Error updating folder:', error);
      return res.status(500).json({ error: { message: 'Failed to update folder' } });
    }
    
    res.json({ folder, message: 'Folder updated successfully' });
  } catch (error) {
    console.error('Update folder error:', error);
    res.status(500).json({ error: { message: 'Internal server error' } });
  }
});

// Delete folder
router.delete('/:folderId', async (req, res) => {
  const { folderId } = req.params;
  console.log('Deleting folder:', folderId);
  
  try {
    const supabase = getSupabase();
    
    // Check if folder has files
    const { count } = await supabase
      .from('files')
      .select('*', { count: 'exact', head: true })
      .eq('folder_id', folderId)
      .eq('user_id', req.userId);
    
    if (count > 0) {
      return res.status(400).json({ 
        error: { message: 'Cannot delete folder that contains files' } 
      });
    }
    
    // Delete folder
    const { error } = await supabase
      .from('folders')
      .delete()
      .eq('id', folderId)
      .eq('user_id', req.userId);
    
    if (error) {
      console.error('Error deleting folder:', error);
      return res.status(500).json({ error: { message: 'Failed to delete folder' } });
    }
    
    res.json({ message: 'Folder deleted successfully' });
  } catch (error) {
    console.error('Delete folder error:', error);
    res.status(500).json({ error: { message: 'Internal server error' } });
  }
});

// Process folder (get all files in folder with chunks)
router.post('/:folderId/process', async (req, res) => {
  const { folderId } = req.params;
  console.log('Processing folder:', folderId);
  
  try {
    const supabase = getSupabase();
    
    // Get folder info
    const { data: folder, error: folderError } = await supabase
      .from('folders')
      .select('*')
      .eq('id', folderId)
      .eq('user_id', req.userId)
      .single();
    
    if (folderError || !folder) {
      return res.status(404).json({ error: { message: 'Folder not found' } });
    }
    
    // Get all files in folder
    const { data: files, error: filesError } = await supabase
      .from('files')
      .select('*')
      .eq('folder_id', folderId)
      .eq('user_id', req.userId);
    
    if (filesError) {
      console.error('Error fetching folder files:', filesError);
      return res.status(500).json({ error: { message: 'Failed to fetch folder files' } });
    }
    
    if (!files || files.length === 0) {
      return res.json({
        folderId: folder.id,
        folderName: folder.name,
        processedFiles: [],
        totalFiles: 0
      });
    }
    
    // Get all file IDs
    const fileIds = files.map(f => f.id);
    
    // Try to use optimized function to get all chunk counts in one query
    let chunkCounts = {};
    try {
      const { data: counts, error: countsError } = await supabase
        .rpc('get_file_chunk_counts', { p_file_ids: fileIds });
      
      if (!countsError && counts) {
        // Convert array to map for easy lookup
        counts.forEach(item => {
          chunkCounts[item.file_id] = parseInt(item.chunk_count) || 0;
        });
      } else {
        // Fallback to individual queries if function doesn't exist
        console.log('Using fallback chunk count implementation');
        for (const file of files) {
          try {
            const { count } = await supabase
              .from('file_chunks')
              .select('*', { count: 'exact', head: true })
              .eq('file_id', file.id);
            chunkCounts[file.id] = count || 0;
          } catch (error) {
            console.error(`Error checking file ${file.id}:`, error);
            chunkCounts[file.id] = -1; // Mark as error
          }
        }
      }
    } catch (error) {
      console.error('Error getting chunk counts:', error);
      // Fallback to individual queries
      for (const file of files) {
        try {
          const { count } = await supabase
            .from('file_chunks')
            .select('*', { count: 'exact', head: true })
            .eq('file_id', file.id);
          chunkCounts[file.id] = count || 0;
        } catch (error) {
          console.error(`Error checking file ${file.id}:`, error);
          chunkCounts[file.id] = -1; // Mark as error
        }
      }
    }
    
    // Process results
    const processedFiles = files.map(file => {
      const chunkCount = chunkCounts[file.id];
      
      if (chunkCount === -1) {
        return {
          id: file.id,
          name: file.name,
          type: file.type,
          size: file.size,
          status: 'error',
          error: 'Failed to check file status'
        };
      } else if (chunkCount > 0) {
        return {
          id: file.id,
          name: file.name,
          type: file.type,
          size: file.size,
          status: 'already_processed',
          chunkCount: chunkCount
        };
      } else {
        return {
          id: file.id,
          name: file.name,
          type: file.type,
          size: file.size,
          status: 'needs_processing',
          chunkCount: 0
        };
      }
    });
    
    res.json({
      folderId: folder.id,
      folderName: folder.name,
      processedFiles: processedFiles,
      totalFiles: files.length
    });
  } catch (error) {
    console.error('Process folder error:', error);
    res.status(500).json({ error: { message: 'Internal server error' } });
  }
});

export default router;