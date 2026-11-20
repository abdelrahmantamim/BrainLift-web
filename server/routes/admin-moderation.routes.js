import express from 'express';
import { requireAdminAuth } from '../middleware/adminAuth.middleware.js';
import { getSupabase } from '../config/services.config.js';
import logger from '../utils/serverLogger.js';

const router = express.Router();

// Get moderation queue items
router.get('/queue', requireAdminAuth, async (req, res) => {
  try {
    const { status = 'pending', severity, limit = 50, offset = 0 } = req.query;
    const supabase = getSupabase();
    
    let query = supabase
      .from('moderation_queue')
      .select(`
        *,
        user:profiles!user_id(email, full_name)
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    
    if (status !== 'all') {
      query = query.eq('status', status);
    }
    
    if (severity) {
      query = query.eq('severity', severity);
    }
    
    const { data: items, error, count } = await query;
    
    if (error) {
      logger.error('AdminModeration', 'Failed to fetch moderation queue:', error);
      return res.status(500).json({ error: 'Failed to fetch moderation queue' });
    }
    
    res.json({
      items: items || [],
      total: count,
      limit,
      offset
    });
    
  } catch (error) {
    logger.error('AdminModeration', 'Error in get queue:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get moderation statistics
router.get('/stats', requireAdminAuth, async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const supabase = getSupabase();
    
    const { data: stats, error } = await supabase
      .rpc('get_moderation_stats', { p_days: parseInt(days) });
    
    if (error) {
      logger.error('AdminModeration', 'Failed to fetch moderation stats:', error);
      return res.status(500).json({ error: 'Failed to fetch statistics' });
    }
    
    res.json(stats[0] || {
      total_items: 0,
      pending_items: 0,
      flagged_items: 0,
      reviewed_items: 0,
      high_severity: 0,
      medium_severity: 0,
      low_severity: 0
    });
    
  } catch (error) {
    logger.error('AdminModeration', 'Error in get stats:', error);
    res.status(500).json({ error: error.message });
  }
});

// Review a moderation item
router.post('/review/:id', requireAdminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { action, notes, suspendContent } = req.body;
    const reviewerId = req.userId;
    const supabase = getSupabase();
    
    // Validate action
    if (!['approve', 'reject', 'flag'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action' });
    }
    
    // Get the moderation item
    const { data: item, error: fetchError } = await supabase
      .from('moderation_queue')
      .select('*')
      .eq('id', id)
      .single();
      
    if (fetchError || !item) {
      return res.status(404).json({ error: 'Moderation item not found' });
    }
    
    // Update moderation queue item
    const newStatus = action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'flagged';
    
    const { error: updateError } = await supabase
      .from('moderation_queue')
      .update({
        status: newStatus,
        reviewer_id: reviewerId,
        review_notes: notes,
        reviewed_at: new Date().toISOString()
      })
      .eq('id', id);
      
    if (updateError) {
      logger.error('AdminModeration', 'Failed to update moderation item:', updateError);
      return res.status(500).json({ error: 'Failed to update moderation item' });
    }
    
    // Handle content suspension/unsuspension
    if (suspendContent !== undefined) {
      const table = item.content_type === 'quiz' ? 'quizzes' : 'flashcard_decks';
      
      if (suspendContent) {
        // Suspend the content
        await supabase
          .from(table)
          .update({
            is_suspended: true,
            suspension_reason: 'admin_moderation',
            suspension_details: { reviewer: reviewerId, notes, action }
          })
          .eq('id', item.content_id);
          
        // Also suspend any share links
        await supabase
          .from('shareable_links')
          .update({
            is_active: false,
            suspended_reason: 'content_moderation_admin'
          })
          .eq('content_type', item.content_type)
          .eq('content_id', item.content_id);
          
        logger.info('AdminModeration', `Admin suspended ${item.content_type} ${item.content_id}`);
      } else if (action === 'approve') {
        // Unsuspend the content if approving
        await supabase
          .from(table)
          .update({
            is_suspended: false,
            suspension_reason: null,
            suspension_details: null
          })
          .eq('id', item.content_id);
          
        // Reactivate share links
        await supabase
          .from('shareable_links')
          .update({
            is_active: true,
            suspended_reason: null
          })
          .eq('content_type', item.content_type)
          .eq('content_id', item.content_id);
          
        logger.info('AdminModeration', `Admin unsuspended ${item.content_type} ${item.content_id}`);
      }
    }
    
    res.json({
      success: true,
      message: `Content ${action}ed successfully`
    });
    
  } catch (error) {
    logger.error('AdminModeration', 'Error in review item:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get content details for moderation
router.get('/content/:type/:id', requireAdminAuth, async (req, res) => {
  try {
    const { type, id } = req.params;
    const supabase = getSupabase();
    
    // Validate type
    if (!['quiz', 'flashcards'].includes(type)) {
      return res.status(400).json({ error: 'Invalid content type' });
    }
    
    const table = type === 'quiz' ? 'quizzes' : 'flashcard_decks';
    
    // Get content
    const { data: content, error } = await supabase
      .from(table)
      .select('*')
      .eq('id', id)
      .single();
      
    if (error || !content) {
      return res.status(404).json({ error: 'Content not found' });
    }
    
    // If flashcards, also get the cards
    let cards = null;
    if (type === 'flashcards') {
      const { data: flashcards } = await supabase
        .from('flashcards')
        .select('*')
        .eq('deck_id', id)
        .order('created_at');
      cards = flashcards;
    }
    
    res.json({
      content,
      cards
    });
    
  } catch (error) {
    logger.error('AdminModeration', 'Error fetching content:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;