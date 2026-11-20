import express from 'express';
import { authMiddleware, requireAuth } from '../middleware/auth.middleware.js';
import { requireSessionAdmin } from '../middleware/adminAuth.middleware.js';
import { requirePaidWeb } from '../middleware/requirePaidWeb.middleware.js';
import { syncUserToSupabase } from '../middleware/syncUser.middleware.js';
import { getSupabase } from '../config/services.config.js';
import { body, query, validationResult } from 'express-validator';
import { createRequire } from 'module';
import { invalidateCache } from '../middleware/cache.middleware.js';
import { shareCreationLimiter, shareAccessLimiter } from '../middleware/rateLimiter.middleware.js';
import { recipientRateLimitMiddleware } from '../middleware/recipientRateLimit.middleware.js';
import { withCircuitBreaker } from '../services/circuitBreaker.service.js';

const require = createRequire(import.meta.url);
const pushNotificationService = require('../services/pushNotification.service.cjs');
const router = express.Router();

// Create a shareable link - Rate limited to prevent spam
router.post('/create', requireAuth, shareCreationLimiter, syncUserToSupabase, requirePaidWeb, async (req, res) => {
  try {
    let {
      contentType,
      contentId,
      title,
      description,
      thumbnail,
      metadata,
      settings
    } = req.body;
    
    const userId = req.userId;
    const supabase = getSupabase();
    
    console.log('[Share] Creating share link', { contentType, contentId, userId });
    
    // Validate content exists and belongs to user
    let contentExists = false;
    
    // Allow temporary/demo content for testing (contentId starting with "temp_")
    if (contentId && contentId.startsWith('temp_')) {
      contentExists = true;
      console.log('[Share] Creating share link for temporary content');
    } else if (contentType === 'quiz') {
      const { data: quiz, error } = await supabase
        .from('quizzes')
        .select('id, user_id')
        .eq('id', contentId)
        .eq('user_id', userId)
        .single();
      
      contentExists = !error && quiz;
    } else if (contentType === 'flashcards') {
      console.log('[Share] Checking flashcard deck', { 
        contentId, 
        userId,
        contentIdType: typeof contentId,
        userIdType: typeof userId 
      });
      
      // Use service role to bypass RLS
      const { data: deck, error } = await supabase
        .from('flashcard_decks')
        .select('id, user_id')
        .eq('id', contentId)
        .single();
      
      if (error) {
        console.log('[Share] Flashcard deck not found:', error);
        contentExists = false;
      } else if (deck) {
        console.log('[Share] Flashcard deck found:', { 
          deckId: deck.id, 
          deckUserId: deck.user_id, 
          requestUserId: userId,
          userMatch: deck.user_id === userId 
        });
        
        // Verify ownership (ensure both are strings for comparison)
        const deckUserId = String(deck.user_id).toLowerCase();
        const requestUserId = String(userId).toLowerCase();
        
        if (deckUserId !== requestUserId) {
          console.log('[Share] User does not own this flashcard deck');
          contentExists = false;
        } else {
          contentExists = true;
        }
      }
    } else if (contentType === 'message') {
      // contentId is the session/conversation ID
      const { data: session, error: sessionError } = await supabase
        .from('study_sessions')
        .select('id, user_id, title')
        .eq('id', contentId)
        .eq('user_id', userId)
        .single();

      if (!sessionError && session) {
        contentExists = true;

        // Fetch all messages in the conversation
        const { data: messages } = await supabase
          .from('chat_conversations')
          .select('message_id, role, content, created_at')
          .eq('session_id', contentId)
          .order('created_at', { ascending: true });

        // Store conversation in metadata for the share page
        metadata = {
          ...metadata,
          conversationTitle: session.title,
          messages: (messages || []).map(m => ({
            role: m.role,
            content: m.content,
            timestamp: m.created_at,
          })),
        };

        // Use conversation title as the share title
        if (!title) {
          title = session.title || 'AI Chat Conversation';
        }
      }

      if (!contentExists) {
        console.log('[Share] Conversation not found or not owned by user');
      }
    } else if (contentType === 'content') {
      // Generic content sharing (e.g., selected text) — no DB validation needed
      contentExists = true;
    }

    if (!contentExists) {
      console.log('[Share] Content validation failed', { contentId, contentType, userId });
      return res.status(404).json({
        error: { message: 'Content not found or access denied' }
      });
    }
    
    // Generate unique share ID using the database function with circuit breaker
    const generateShareId = withCircuitBreaker('sharing', async () => {
      const { data, error } = await supabase.rpc('generate_share_id');
      if (error) throw error;
      return data;
    });
    
    let shareId;
    try {
      shareId = await generateShareId();
    } catch (error) {
      console.error('[Share] Failed to generate share ID:', error);
      if (error.code === 'CIRCUIT_OPEN') {
        return res.status(503).json({
          error: { message: 'Share service temporarily unavailable. Please try again later.' }
        });
      }
      return res.status(500).json({
        error: { message: 'Failed to generate share ID' }
      });
    }
    
    // Calculate expiry if provided
    let expiresAt = null;
    if (settings?.expiresIn) {
      const expiryDate = new Date();
      expiryDate.setHours(expiryDate.getHours() + settings.expiresIn);
      expiresAt = expiryDate.toISOString();
    }
    
    // Create share link with circuit breaker
    const createShareLink = withCircuitBreaker('sharing', async () => {
      const { data, error } = await supabase
        .from('shareable_links')
        .insert({
          share_id: shareId,
          user_id: userId,
          content_type: contentType,
          content_id: contentId,
          title: title || 'Untitled',
          description: description || '',
          thumbnail_url: thumbnail || null,
          metadata: metadata || {},
          settings: {
            requiresAuth: settings?.requiresAuth || false,
            expiresIn: settings?.expiresIn || null,
            maxImports: settings?.maxImports || null
          },
          expires_at: expiresAt
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    });
    
    let shareLink;
    try {
      shareLink = await createShareLink();
    } catch (error) {
      console.error('[Share] Failed to create share link:', error);
      if (error.code === 'CIRCUIT_OPEN') {
        return res.status(503).json({
          error: { message: 'Share service temporarily unavailable. Please try again later.' }
        });
      }
      return res.status(500).json({
        error: { message: 'Failed to create share link' }
      });
    }
    
    // Canonical URLs — computed once here so web and mobile clients both
    // distribute the same links instead of each hardcoding their own shapes.
    const webAppUrl = process.env.WEB_APP_URL || 'https://getbrainlift.app';
    const apiPublicUrl = process.env.API_PUBLIC_URL || 'https://app.getbrainlift.app';
    const shareUrl = `${webAppUrl}/share/${contentType}/${shareLink.share_id}`;
    const previewUrl = `${webAppUrl}/share/preview/${contentType}/${shareLink.share_id}`;
    const deepLink = `brainlift://share/${contentType}/${shareLink.share_id}`;
    const qrCodeUrl = `${apiPublicUrl}/api/qr/${shareLink.share_id}/branded`;

    res.json({
      success: true,
      shareId: shareLink.share_id,
      shareLink,
      shareUrl,
      previewUrl,
      deepLink,
      qrCodeUrl
    });
  } catch (error) {
    console.error('[Share] Create error:', error);
    res.status(500).json({
      error: { message: 'Internal server error' }
    });
  }
});

// Test endpoint for creating share links (development only)
// SECURITY: Protected with auth even in development to prevent abuse
if (process.env.NODE_ENV !== 'production') {
  router.post('/test-create', requireAuth, async (req, res) => {
    try {
      const {
        contentType = 'quiz',
        title = 'Test Content',
        description = 'This is a test share for Expo Go testing',
        metadata = { questionCount: 10, difficulty: 'Medium' }
      } = req.body;
      
      const supabase = getSupabase();
      
      // Generate share ID
      const { data: shareIdResult, error: shareIdError } = await supabase
        .rpc('generate_share_id');
      
      if (shareIdError) {
        console.error('[Share] Failed to generate test share ID:', shareIdError);
        return res.status(500).json({
          error: { message: 'Failed to generate share ID' }
        });
      }
      
      const shareId = shareIdResult;
      const testUserId = '00000000-0000-0000-0000-000000000000'; // Dummy user ID for testing
      
      // Create test share link
      const { data: shareLink, error: createError } = await supabase
        .from('shareable_links')
        .insert({
          share_id: shareId,
          user_id: testUserId,
          content_type: contentType,
          content_id: `temp_test_${Date.now()}`,
          title,
          description,
          metadata,
          settings: {
            requiresAuth: false,
            expiresIn: 24,
            maxImports: 100
          }
        })
        .select()
        .single();
      
      if (createError) {
        console.error('[Share] Failed to create test share link:', createError);
        return res.status(500).json({
          error: { message: 'Failed to create test share link' }
        });
      }
      
      const baseUrl = process.env.APP_URL || `http://localhost:${process.env.PORT || 5001}`;
      
      res.json({
        success: true,
        shareId: shareLink.share_id,
        shortUrl: `${baseUrl}/${shareLink.share_id}`,
        testUrl: `http://YOUR_LOCAL_IP:5001/${shareLink.share_id}`,
        message: 'Test share link created! Replace YOUR_LOCAL_IP with your actual IP address.'
      });
    } catch (error) {
      console.error('[Share] Test create error:', error);
      res.status(500).json({
        error: { message: 'Internal server error' }
      });
    }
  });
}

// Track share events
router.post('/track', async (req, res) => {
  try {
    const { shareId, eventType, metadata, platform } = req.body;
    const userId = req.userId; // May be null for anonymous views
    const supabase = getSupabase();

    // Validate eventType against allowlist
    const ALLOWED_EVENT_TYPES = ['view', 'click', 'import', 'share', 'copy_link', 'preview'];
    if (!eventType || !ALLOWED_EVENT_TYPES.includes(eventType)) {
      return res.status(400).json({
        error: { message: 'Invalid event type' }
      });
    }

    console.log('[Share] Tracking event', { shareId, eventType, userId });
    
    // Verify share exists and is active
    const { data: shareLink, error: shareError } = await supabase
      .from('shareable_links')
      .select('id, is_active, expires_at')
      .eq('share_id', shareId)
      .single();
    
    if (shareError || !shareLink || !shareLink.is_active) {
      return res.status(404).json({
        error: { message: 'Share link not found or inactive' }
      });
    }
    
    // Check if expired
    if (shareLink.expires_at && new Date(shareLink.expires_at) < new Date()) {
      return res.status(410).json({
        error: { message: 'Share link has expired' }
      });
    }
    
    // Get device info from headers
    const deviceInfo = {
      platform: platform || 'unknown',
      userAgent: req.headers['user-agent'] || 'unknown',
      ...metadata
    };
    
    // Create event record
    const { error: eventError } = await supabase
      .from('share_events')
      .insert({
        share_id: shareId,
        event_type: eventType,
        user_id: userId,
        session_id: req.sessionID || `anon-${Date.now()}`,
        device_info: deviceInfo,
        referrer: req.headers.referer || null,
        ip_address: req.ip,
        user_agent: req.headers['user-agent']
      });
    
    if (eventError) {
      console.error('[Share] Failed to track event:', eventError);
    }
    
    // Update counters for specific events
    if (eventType === 'view') {
      await supabase.rpc('increment_share_view', { p_share_id: shareId });
    } else if (eventType === 'import') {
      await supabase.rpc('increment_share_import', { p_share_id: shareId });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('[Share] Track error:', error);
    res.status(500).json({
      error: { message: 'Failed to track event' }
    });
  }
});

// Import shared content - Rate limited to prevent abuse
router.post('/import', requireAuth, shareAccessLimiter, syncUserToSupabase, requirePaidWeb, async (req, res) => {
  try {
    const { shareId } = req.body;
    const userId = req.userId;
    const supabase = getSupabase();
    
    console.log('[Share] Importing content', { shareId, userId });
    
    // Get share details
    const { data: shareLink, error: shareError } = await supabase
      .from('shareable_links')
      .select('*')
      .eq('share_id', shareId)
      .single();
    
    if (shareError || !shareLink || !shareLink.is_active) {
      return res.status(404).json({
        error: { message: 'Share link not found or inactive' }
      });
    }
    
    // Check if expired
    if (shareLink.expires_at && new Date(shareLink.expires_at) < new Date()) {
      return res.status(410).json({
        error: { message: 'Share link has expired' }
      });
    }
    
    // Check if max imports reached
    if (shareLink.settings.maxImports && shareLink.import_count >= shareLink.settings.maxImports) {
      return res.status(429).json({
        error: { message: 'Maximum imports reached for this share link' }
      });
    }
    
    // Check if auth required
    if (shareLink.settings.requiresAuth && !userId) {
      return res.status(401).json({
        error: { message: 'Authentication required to import this content' }
      });
    }
    
    // Check if already imported
    const { data: existingImport } = await supabase
      .from('imported_content')
      .select('imported_content_id')
      .eq('user_id', userId)
      .eq('original_content_id', shareLink.content_id)
      .single();
    
    if (existingImport) {
      return res.status(409).json({
        error: { message: 'Content already imported' },
        existingContentId: existingImport.imported_content_id,
        contentType: shareLink.content_type
      });
    }
    
    // Import the content based on type
    let importedContentId;
    
    if (shareLink.content_type === 'quiz') {
      importedContentId = await importQuiz(shareLink.content_id, userId, supabase);
    } else if (shareLink.content_type === 'flashcards') {
      importedContentId = await importFlashcards(shareLink.content_id, userId, supabase);
    } else if (shareLink.content_type === 'message') {
      importedContentId = await importConversation(shareLink, userId, supabase);
    }
    
    // Record the import
    await supabase
      .from('imported_content')
      .insert({
        user_id: userId,
        share_id: shareId,
        content_type: shareLink.content_type,
        original_content_id: shareLink.content_id,
        imported_content_id: importedContentId
      });
    
    // Track import event
    await supabase.rpc('increment_share_import', { p_share_id: shareId });
    
    // Invalidate cache for the user
    await invalidateContentCache(shareLink.content_type, userId, req, res);
    
    res.json({
      success: true,
      importedContentId,
      contentType: shareLink.content_type,
      message: `Successfully imported ${shareLink.content_type}`
    });
  } catch (error) {
    console.error('[Share] Import error:', error);
    res.status(500).json({
      error: { message: 'Failed to import content' }
    });
  }
});

// Import by content ID (manual import)
router.post('/import-by-id', requireAuth, syncUserToSupabase, requirePaidWeb, async (req, res) => {
  try {
    const { contentId, contentType } = req.body;
    const userId = req.userId;
    const supabase = getSupabase();
    
    console.log('[Share] Manual import by ID', { 
      contentId, 
      contentType, 
      userId,
      contentIdLength: contentId.length,
      isAlphanumeric: /^[a-zA-Z0-9]+$/.test(contentId)
    });
    
    // Validate input
    if (!contentId || !contentType) {
      return res.status(400).json({
        error: { message: 'Content ID and type are required' }
      });
    }
    
    if (!['quiz', 'flashcards'].includes(contentType)) {
      return res.status(400).json({
        error: { message: 'Invalid content type. Must be "quiz" or "flashcards"' }
      });
    }
    
    // First check if this is a share ID
    let actualContentId = contentId;
    let shareLink = null;
    
    // Check if this looks like a share ID (10 character alphanumeric)
    if (contentId.length === 10 && /^[a-zA-Z0-9]+$/.test(contentId)) {
      const { data: link } = await supabase
        .from('shareable_links')
        .select('*')
        .eq('share_id', contentId)
        .eq('is_active', true)
        .single();
      
      if (link) {
        shareLink = link;
        actualContentId = link.content_id;
        console.log('[Share] Found share link', { 
          shareId: contentId, 
          actualContentId,
          linkContentType: link.content_type,
          requestedContentType: contentType
        });
        
        // Verify content type matches
        if (link.content_type !== contentType) {
          return res.status(400).json({
            error: { message: `This is a ${link.content_type} share ID, not a ${contentType}` }
          });
        }
      } else {
        console.log('[Share] No share link found for ID:', contentId);
      }
    } else {
      console.log('[Share] Not a share ID format, treating as direct content ID');
    }
    
    // Check if content exists and is shareable
    let contentExists = false;
    let originalUserId;
    
    if (contentType === 'quiz') {
      const { data: quiz, error: quizError } = await supabase
        .from('quizzes')
        .select('id, user_id')
        .eq('id', actualContentId)
        .single();
      
      console.log('[Share] Quiz lookup result:', { 
        actualContentId, 
        found: !!quiz,
        quizId: quiz?.id,
        quizUserId: quiz?.user_id,
        error: quizError?.message
      });
      
      if (quiz && !quizError) {
        contentExists = true;
        originalUserId = quiz.user_id;
        
        // Check if quiz belongs to user or has a share link
        if (quiz.user_id !== userId) {
          // If we didn't already find a share link, check if there's one
          if (!shareLink) {
            const { data: link } = await supabase
              .from('shareable_links')
              .select('id')
              .eq('content_id', actualContentId)
              .eq('content_type', 'quiz')
              .eq('is_active', true)
              .single();
            
            if (!link) {
              return res.status(403).json({
                error: { message: 'This quiz is not publicly available' }
              });
            }
          }
        }
      }
    } else if (contentType === 'flashcards') {
      const { data: deck, error: deckError } = await supabase
        .from('flashcard_decks')
        .select('id, user_id')
        .eq('id', actualContentId)
        .single();
      
      if (deck && !deckError) {
        contentExists = true;
        originalUserId = deck.user_id;
        
        // Check if deck belongs to user or has a share link
        if (deck.user_id !== userId) {
          // If we didn't already find a share link, check if there's one
          if (!shareLink) {
            const { data: link } = await supabase
              .from('shareable_links')
              .select('id')
              .eq('content_id', actualContentId)
              .eq('content_type', 'flashcards')
              .eq('is_active', true)
              .single();
            
            if (!link) {
              return res.status(403).json({
                error: { message: 'This flashcard deck is not publicly available' }
              });
            }
          }
        }
      }
    }
    
    if (!contentExists) {
      return res.status(404).json({
        error: { message: `${contentType === 'quiz' ? 'Quiz' : 'Flashcard deck'} not found` }
      });
    }
    
    // Don't allow importing your own content
    if (originalUserId === userId) {
      return res.status(400).json({
        error: { message: 'You cannot import your own content' }
      });
    }
    
    // Check if already imported
    const { data: existingImport } = await supabase
      .from('imported_content')
      .select('imported_content_id')
      .eq('user_id', userId)
      .eq('original_content_id', actualContentId)
      .eq('content_type', contentType)
      .single();
    
    if (existingImport) {
      return res.status(409).json({
        error: { message: 'Content already imported' },
        existingContentId: existingImport.imported_content_id,
        contentType: contentType,
        alreadyImported: true
      });
    }
    
    // Import the content
    let importedContentId;
    
    if (contentType === 'quiz') {
      importedContentId = await importQuiz(actualContentId, userId, supabase);
    } else if (contentType === 'flashcards') {
      importedContentId = await importFlashcards(actualContentId, userId, supabase);
    }
    
    // Record the import (with share_id if available)
    await supabase
      .from('imported_content')
      .insert({
        user_id: userId,
        share_id: shareLink ? shareLink.id : null,
        content_type: contentType,
        original_content_id: actualContentId,
        imported_content_id: importedContentId
      });
    
    // If this was imported via share link, track it
    if (shareLink) {
      // Update share link stats
      await supabase
        .from('shareable_links')
        .update({ 
          import_count: shareLink.import_count + 1,
          last_imported_at: new Date().toISOString()
        })
        .eq('id', shareLink.id);
      
      // Track the import in import_tracking for notifications
      await supabase
        .from('import_tracking')
        .insert({
          share_id: shareLink.share_id,
          share_type: contentType,
          imported_by: userId,
          sender_id: shareLink.user_id
        });
    }
    
    // Invalidate cache for the user
    await invalidateContentCache(contentType, userId, req, res);
    
    res.json({
      success: true,
      importedContentId,
      contentType: contentType,
      message: `Successfully imported ${contentType}`
    });
  } catch (error) {
    console.error('[Share] Manual import error:', error);
    res.status(500).json({
      error: { message: 'Failed to import content' }
    });
  }
});

// Get share preview data for countdown page - Rate limited to prevent scraping
router.get('/preview/:type/:shareId', shareAccessLimiter, async (req, res) => {
  try {
    const { type, shareId } = req.params;
    const supabase = getSupabase();
    
    console.log('[Share] Fetching preview data', { type, shareId });
    
    // Get share link details with user info
    const { data: shareLink, error: shareError } = await supabase
      .from('shareable_links')
      .select(`
        *,
        profiles:user_id (
          full_name,
          avatar_url
        )
      `)
      .eq('share_id', shareId)
      .eq('content_type', type)
      .single();
    
    if (shareError || !shareLink || !shareLink.is_active) {
      return res.status(404).json({
        error: { message: 'Share link not found or inactive' }
      });
    }
    
    // Check if expired
    if (shareLink.expires_at && new Date(shareLink.expires_at) < new Date()) {
      return res.status(410).json({
        error: { message: 'Share link has expired' }
      });
    }
    
    // Track preview event
    try {
      await supabase
        .from('share_events')
        .insert({
          share_id: shareId,
          event_type: 'preview',
          user_id: null,
          session_id: `anon-${Date.now()}`,
          device_info: { userAgent: req.headers['user-agent'] },
          referrer: req.headers.referer || null,
          ip_address: req.ip,
          user_agent: req.headers['user-agent']
        });
    } catch (trackError) {
      console.error('[Share] Failed to track preview event:', trackError);
    }
    
    // Return preview data
    res.json({
      id: shareLink.share_id,
      type: shareLink.content_type,
      title: shareLink.title,
      sharedBy: {
        username: shareLink.profiles?.full_name || 'BrainLift User',
        avatarUrl: shareLink.profiles?.avatar_url
      },
      itemCount: shareLink.metadata?.questionCount || shareLink.metadata?.cardCount || 0,
      difficulty: shareLink.metadata?.difficulty,
      timeLimit: shareLink.metadata?.timeLimit,
      category: shareLink.metadata?.category,
      description: shareLink.description,
      createdAt: shareLink.created_at
    });
  } catch (error) {
    console.error('[Share] Get preview data error:', error);
    res.status(500).json({
      error: { message: 'Failed to fetch preview data' }
    });
  }
});

// Get share link data (public endpoint for previews)
router.get('/:shareId', async (req, res) => {
  try {
    const { shareId } = req.params;
    const supabase = getSupabase();
    
    console.log('[Share] Fetching share data', { shareId });
    
    // Get share link details
    const { data: shareLink, error: shareError } = await supabase
      .from('shareable_links')
      .select('*')
      .eq('share_id', shareId)
      .single();

    if (shareError || !shareLink || !shareLink.is_active) {
      return res.status(404).json({
        error: { message: 'Share link not found or inactive' }
      });
    }

    // Get creator profile separately
    let creatorName = 'BrainLift User';
    let creatorAvatar = null;
    if (shareLink.user_id) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, avatar_url')
        .eq('id', shareLink.user_id)
        .single();
      if (profile) {
        creatorName = profile.full_name || creatorName;
        creatorAvatar = profile.avatar_url;
      }
    }
    
    // Check if expired
    if (shareLink.expires_at && new Date(shareLink.expires_at) < new Date()) {
      return res.status(410).json({
        error: { message: 'Share link has expired' }
      });
    }
    
    // Track view event
    try {
      await supabase
        .from('share_events')
        .insert({
          share_id: shareId,
          event_type: 'preview',
          user_id: null,
          session_id: `anon-${Date.now()}`,
          device_info: { userAgent: req.headers['user-agent'] },
          referrer: req.headers.referer || null,
          ip_address: req.ip,
          user_agent: req.headers['user-agent']
        });
    } catch (trackError) {
      console.error('[Share] Failed to track preview event:', trackError);
    }
    
    // Return share data for preview
    res.json({
      shareId: shareLink.share_id,
      title: shareLink.title,
      description: shareLink.description,
      contentType: shareLink.content_type,
      metadata: shareLink.metadata,
      settings: shareLink.settings,
      creatorName,
      creatorAvatar,
      thumbnail: shareLink.thumbnail_url,
      createdAt: shareLink.created_at,
      viewCount: shareLink.view_count,
      importCount: shareLink.import_count
    });
  } catch (error) {
    console.error('[Share] Get share data error:', error);
    res.status(500).json({
      error: { message: 'Failed to fetch share data' }
    });
  }
});

// Get all shares for current user
router.get('/my-shares', requireAuth, syncUserToSupabase, requirePaidWeb, async (req, res) => {
  try {
    const userId = req.userId;
    const supabase = getSupabase();
    
    console.log('[Share] Fetching user shares', { userId });
    
    const { data: shares, error } = await supabase
      .from('shareable_links')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('[Share] Failed to fetch user shares:', error);
      return res.status(500).json({
        error: { message: 'Failed to fetch shares' }
      });
    }
    
    // Format shares with calculated stats
    const formattedShares = shares.map(share => ({
      shareId: share.share_id,
      title: share.title,
      contentType: share.content_type,
      createdAt: share.created_at,
      viewCount: share.view_count,
      importCount: share.import_count,
      isActive: share.is_active,
      expiresAt: share.expires_at,
      // Calculate additional stats
      uniqueViews: Math.floor(share.view_count * 0.7), // Approximate for now
      conversionRate: share.view_count > 0 
        ? Math.round((share.import_count / share.view_count) * 100) 
        : 0
    }));
    
    res.json({ shares: formattedShares });
  } catch (error) {
    console.error('[Share] My shares error:', error);
    res.status(500).json({
      error: { message: 'Failed to fetch shares' }
    });
  }
});

// Get daily statistics for a share
router.get('/:shareId/stats/daily', requireAuth, syncUserToSupabase, async (req, res) => {
  try {
    const { shareId } = req.params;
    const { range = '7d' } = req.query;
    const userId = req.userId;
    const supabase = getSupabase();
    
    // Verify ownership
    const { data: shareLink, error: shareError } = await supabase
      .from('shareable_links')
      .select('user_id')
      .eq('share_id', shareId)
      .single();
    
    if (shareError || !shareLink || shareLink.user_id !== userId) {
      return res.status(404).json({
        error: { message: 'Share link not found or access denied' }
      });
    }
    
    // Calculate date range
    let startDate = new Date();
    if (range === '7d') {
      startDate.setDate(startDate.getDate() - 7);
    } else if (range === '30d') {
      startDate.setDate(startDate.getDate() - 30);
    } else {
      startDate.setFullYear(startDate.getFullYear() - 1); // Last year for 'all'
    }
    
    // Get daily stats (simulated for now - in production, aggregate from events)
    const dailyStats = [];
    const currentDate = new Date();
    
    for (let d = new Date(startDate); d <= currentDate; d.setDate(d.getDate() + 1)) {
      dailyStats.push({
        date: d.toISOString().split('T')[0],
        views: Math.floor(Math.random() * 50) + 10,
        imports: Math.floor(Math.random() * 10) + 1,
      });
    }
    
    res.json({ stats: dailyStats });
  } catch (error) {
    console.error('[Share] Daily stats error:', error);
    res.status(500).json({
      error: { message: 'Failed to get daily statistics' }
    });
  }
});

// Get recent events for a share
router.get('/:shareId/events', requireAuth, syncUserToSupabase, async (req, res) => {
  try {
    const { shareId } = req.params;
    const { limit = 10 } = req.query;
    const userId = req.userId;
    const supabase = getSupabase();
    
    // Verify ownership
    const { data: shareLink, error: shareError } = await supabase
      .from('shareable_links')
      .select('user_id')
      .eq('share_id', shareId)
      .single();
    
    if (shareError || !shareLink || shareLink.user_id !== userId) {
      return res.status(404).json({
        error: { message: 'Share link not found or access denied' }
      });
    }
    
    // Get recent events
    const { data: events, error: eventsError } = await supabase
      .from('share_events')
      .select('event_type, created_at, device_info')
      .eq('share_id', shareId)
      .order('created_at', { ascending: false })
      .limit(parseInt(limit));
    
    if (eventsError) {
      console.error('[Share] Failed to get events:', eventsError);
      return res.status(500).json({
        error: { message: 'Failed to get share events' }
      });
    }
    
    // Format events
    const formattedEvents = events.map(event => ({
      eventType: event.event_type,
      createdAt: event.created_at,
      deviceInfo: event.device_info || {}
    }));
    
    res.json({ events: formattedEvents });
  } catch (error) {
    console.error('[Share] Events error:', error);
    res.status(500).json({
      error: { message: 'Failed to get events' }
    });
  }
});

// Get share statistics
router.get('/:shareId/stats', requireAuth, syncUserToSupabase, async (req, res) => {
  try {
    const { shareId } = req.params;
    const userId = req.userId;
    const supabase = getSupabase();
    
    // Verify ownership
    const { data: shareLink, error: shareError } = await supabase
      .from('shareable_links')
      .select('user_id')
      .eq('share_id', shareId)
      .single();
    
    if (shareError || !shareLink || shareLink.user_id !== userId) {
      return res.status(404).json({
        error: { message: 'Share link not found or access denied' }
      });
    }
    
    // Get analytics
    const { data: analytics, error: analyticsError } = await supabase
      .from('share_analytics')
      .select('*')
      .eq('share_id', shareId)
      .single();
    
    if (analyticsError) {
      console.error('[Share] Failed to get analytics:', analyticsError);
      return res.status(500).json({
        error: { message: 'Failed to get share statistics' }
      });
    }
    
    // Get top referrers
    const { data: referrers } = await supabase
      .from('share_events')
      .select('referrer, count')
      .eq('share_id', shareId)
      .not('referrer', 'is', null)
      .order('count', { ascending: false })
      .limit(5);
    
    res.json({
      viewCount: analytics.view_count,
      uniqueViews: analytics.unique_views,
      importCount: analytics.import_count,
      conversionRate: analytics.conversion_rate,
      topReferrers: referrers?.map(r => r.referrer) || []
    });
  } catch (error) {
    console.error('[Share] Stats error:', error);
    res.status(500).json({
      error: { message: 'Failed to get statistics' }
    });
  }
});

// Check if content was imported
router.get('/check-import', requireAuth, syncUserToSupabase, async (req, res) => {
  try {
    const { contentId, contentType } = req.query;
    const userId = req.userId;
    const supabase = getSupabase();
    
    const { data: importRecord } = await supabase
      .from('imported_content')
      .select('imported_content_id')
      .eq('user_id', userId)
      .eq('original_content_id', contentId)
      .eq('content_type', contentType)
      .single();
    
    res.json({
      imported: !!importRecord,
      importedContentId: importRecord?.imported_content_id
    });
  } catch (error) {
    console.error('[Share] Check import error:', error);
    res.status(500).json({
      error: { message: 'Failed to check import status' }
    });
  }
});

// Helper functions

async function invalidateContentCache(contentType, userId, req, res) {
  // Use the correct cache pattern that matches the middleware's replacement logic
  const cachePattern = contentType === 'quiz' ? 'quiz:userId:*' : 'flashcards:userId:*';
  
  // Manually set the userId on the request object for the middleware
  const originalUserId = req.userId;
  req.userId = userId;
  
  await invalidateCache([cachePattern])(req, res, () => {});
  
  // Restore original userId
  req.userId = originalUserId;
  
  console.log(`[Share] Invalidated cache for ${contentType} user ${userId}`);
}

async function importQuiz(originalQuizId, userId, supabase) {
  console.log('[importQuiz] Starting import:', { originalQuizId, userId });
  
  // Handle temporary quiz imports for testing
  if (originalQuizId.startsWith('temp_')) {
    console.log('[Share] Importing temporary quiz for testing');
    
    // Create a sample quiz for testing
    const { data: newQuiz, error: createError } = await supabase
      .from('quizzes')
      .insert({
        user_id: userId,
        title: 'Imported Test Quiz',
        description: 'This is a test quiz imported via share link',
        source_type: 'imported',
        source_data: {
          originalQuizId,
          importedAt: new Date().toISOString(),
          isTest: true
        },
        is_public: false
      })
      .select()
      .single();
    
    if (createError) throw new Error('Failed to create test quiz');
    
    // Add sample questions (stored in the questions JSON column)
    const sampleQuestions = [
      {
        question: 'What is 2 + 2?',
        options: ['3', '4', '5', '6'],
        correct_answer: 1,
        explanation: 'Basic addition: 2 + 2 = 4'
      },
      {
        question: 'What is the capital of France?',
        options: ['London', 'Berlin', 'Paris', 'Madrid'],
        correct_answer: 2,
        explanation: 'Paris is the capital city of France'
      }
    ];
    
    // Update the quiz with questions
    const { error: updateError } = await supabase
      .from('quizzes')
      .update({
        questions: sampleQuestions,
        question_count: sampleQuestions.length
      })
      .eq('id', newQuiz.id);
    
    if (updateError) {
      console.error('[Share] Failed to update quiz with questions:', updateError);
      throw new Error('Failed to add questions to quiz');
    }
    
    return newQuiz.id;
  }
  
  // Get original quiz
  const { data: originalQuiz, error: quizError } = await supabase
    .from('quizzes')
    .select('*')
    .eq('id', originalQuizId)
    .single();
  
  if (quizError || !originalQuiz) {
    console.error('[Share] Failed to fetch original quiz:', quizError);
    throw new Error('Failed to fetch original quiz');
  }
  
  // Create new quiz with questions copied
  const { data: newQuiz, error: createError } = await supabase
    .from('quizzes')
    .insert({
      user_id: userId,
      title: `${originalQuiz.title} (Imported)`,
      description: originalQuiz.description,
      source_type: 'imported',
      source_data: {
        ...(originalQuiz.source_data || {}),
        originalQuizId,
        importedAt: new Date().toISOString()
      },
      questions: originalQuiz.questions || [], // Copy questions directly
      question_count: originalQuiz.question_count || (originalQuiz.questions ? originalQuiz.questions.length : 0)
    })
    .select()
    .single();
  
  if (createError) {
    console.error('[Share] Failed to create quiz:', createError);
    throw new Error('Failed to create quiz');
  }
  
  console.log('[importQuiz] Successfully created imported quiz:', {
    newQuizId: newQuiz.id,
    userId: userId,
    title: newQuiz.title,
    source_type: newQuiz.source_type
  });
  
  // Verify the quiz was created
  const { data: verifyQuiz } = await supabase
    .from('quizzes')
    .select('id, user_id, title')
    .eq('id', newQuiz.id)
    .single();
    
  console.log('[importQuiz] Verification check:', verifyQuiz);
  
  return newQuiz.id;
}

async function importFlashcards(originalDeckId, userId, supabase) {
  // Get original deck
  const { data: originalDeck, error: deckError } = await supabase
    .from('flashcard_decks')
    .select('*')
    .eq('id', originalDeckId)
    .single();
  
  if (deckError || !originalDeck) {
    console.error('[Share] Failed to fetch original deck:', deckError);
    throw new Error('Failed to fetch original deck');
  }
  
  // Get original flashcards
  const { data: originalCards, error: cardsError } = await supabase
    .from('flashcards')
    .select('*')
    .eq('deck_id', originalDeckId);
  
  if (cardsError) {
    console.error('[Share] Failed to fetch flashcards:', cardsError);
    throw new Error('Failed to fetch flashcards');
  }
  
  // Create new deck
  const { data: newDeck, error: createError } = await supabase
    .from('flashcard_decks')
    .insert({
      user_id: userId,
      file_id: originalDeck.file_id,
      name: `${originalDeck.name} (Imported)`,
      file_name: originalDeck.file_name
    })
    .select()
    .single();
  
  if (createError) {
    console.error('[Share] Failed to create deck:', createError);
    throw new Error('Failed to create deck');
  }
  
  // Copy flashcards if any exist
  if (originalCards && originalCards.length > 0) {
    const newCards = originalCards.map(card => ({
      deck_id: newDeck.id,
      question: card.question,
      answer: card.answer,
      citation: card.citation || 'Imported',
      ease_factor: card.ease_factor || 2.5,
      interval: 1,
      repetitions: 0,
      next_due: new Date().toISOString()
    }));
    
    const { error: insertError } = await supabase
      .from('flashcards')
      .insert(newCards);
    
    if (insertError) {
      console.error('[Share] Failed to copy flashcards:', insertError);
      // Don't throw here - deck was created successfully
    }
  }
  
  return newDeck.id;
}

async function importConversation(shareLink, userId, supabase) {
  const messages = shareLink.metadata?.messages || [];
  const title = shareLink.metadata?.conversationTitle || shareLink.title || 'Imported Chat';

  if (messages.length === 0) {
    throw new Error('No messages to import');
  }

  // Create a new study session (conversation) for the importing user
  const { data: newSession, error: sessionError } = await supabase
    .from('study_sessions')
    .insert({
      user_id: userId,
      title: `${title} (Imported)`,
      subject: 'Imported Chat',
    })
    .select()
    .single();

  if (sessionError || !newSession) {
    console.error('[Share] Failed to create conversation:', sessionError);
    throw new Error('Failed to create conversation');
  }

  // Insert all messages into the new conversation
  const newMessages = messages.map((msg) => ({
    session_id: newSession.id,
    user_id: userId,
    message_id: crypto.randomUUID(),
    role: msg.role,
    content: msg.content,
    created_at: msg.timestamp || new Date().toISOString(),
  }));

  const { error: insertError } = await supabase
    .from('chat_conversations')
    .insert(newMessages);

  if (insertError) {
    console.error('[Share] Failed to import messages:', insertError);
    // Don't throw - session was created
  }

  return newSession.id;
}

// Send share to friend via email
router.post('/send-to-friend',
  requireAuth,
  syncUserToSupabase,
  requirePaidWeb,
  [
    body('shareId').notEmpty().custom((value) => {
      // Accept either UUID or 10-character share ID
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
      const isShareId = /^[a-zA-Z0-9]{10}$/.test(value);
      return isUUID || isShareId;
    }).withMessage('Invalid share ID format'),
    body('shareType').isIn(['quiz', 'flashcard', 'flashcards']),
    body('recipientEmail').isEmail().normalizeEmail(),
    body('title').notEmpty()
  ],
  recipientRateLimitMiddleware,  // Add global recipient rate limiting
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { shareId, shareType, recipientEmail, title } = req.body;
      const senderId = req.userId;
      const senderName = req.user?.full_name || req.user?.email || 'BrainLift User';
      const supabase = getSupabase();

      // Skip block check for now - can be implemented later if needed

      // Per-sender rate limiting removed in favor of global recipient rate limiting
      // The recipientRateLimitMiddleware now handles notification bombing prevention
      // by limiting total notifications a recipient can receive across all senders
      
      // Old per-sender check kept for reference but commented out:
      /*
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { data: recentShares, count } = await supabase
        .from('share_tracking')
        .select('*', { count: 'exact' })
        .eq('sender_id', senderId)
        .eq('recipient_email', recipientEmail)
        .gte('shared_at', oneHourAgo);

      const hourlyLimit = 5;
      const isAllowed = !count || count < hourlyLimit;
      
      if (!isAllowed) {
        return res.status(429).json({
          success: false,
          reason: 'rate_limit',
          message: `You've shared too many items with this user recently. Please try again later. (Limit: ${hourlyLimit} per hour)`
        });
      }
      */

      // Track the share
      await supabase
        .from('share_tracking')
        .insert({
          sender_id: senderId,
          recipient_email: recipientEmail,
          share_id: shareId,
          share_type: shareType
        });

      // Initialize variables at the outer scope
      let importedContentId;
      let alreadyImported = false;

      // Get recipient user
      const { data: recipient } = await supabase
        .from('profiles')
        .select('id, email')
        .eq('email', recipientEmail)
        .single();

      if (recipient) {
        // Get the shareable link details to get the content ID
        const { data: shareLink, error: shareLinkError } = await supabase
          .from('shareable_links')
          .select('*')
          .eq('share_id', shareId)
          .single();

        if (shareLinkError || !shareLink) {
          console.error('[Share] Failed to get share link details:', shareLinkError);
          return res.status(404).json({
            success: false,
            error: 'Share link not found'
          });
        }

        // Normalize shareType to match content_type format
        const normalizedShareType = shareType === 'flashcard' ? 'flashcards' : shareType;

        // Check if the recipient has already imported this content
        const { data: existingImport } = await supabase
          .from('imported_content')
          .select('imported_content_id')
          .eq('user_id', recipient.id)
          .eq('original_content_id', shareLink.content_id)
          .eq('content_type', normalizedShareType)
          .single();

        if (existingImport) {
          // Content already imported, use existing import
          importedContentId = existingImport.imported_content_id;
          alreadyImported = true;
          console.log('[Share] Content already imported by recipient:', importedContentId);
          
          // Still invalidate cache to ensure UI refreshes
          await invalidateContentCache(normalizedShareType, recipient.id, req, res);
        } else {
          // Auto-import the content for the recipient
          try {
            console.log('[Share] Auto-importing content for recipient:', {
              contentId: shareLink.content_id,
              contentType: normalizedShareType,
              recipientId: recipient.id
            });

            if (normalizedShareType === 'quiz') {
              console.log('[Share] Importing quiz for recipient...');
              importedContentId = await importQuiz(shareLink.content_id, recipient.id, supabase);
              console.log('[Share] Quiz imported successfully with ID:', importedContentId);
            } else if (normalizedShareType === 'flashcards') {
              console.log('[Share] Importing flashcards for recipient...');
              importedContentId = await importFlashcards(shareLink.content_id, recipient.id, supabase);
              console.log('[Share] Flashcards imported successfully with ID:', importedContentId);
            }

            // Record the import
            await supabase
              .from('imported_content')
              .insert({
                user_id: recipient.id,
                share_id: shareId,
                content_type: normalizedShareType,
                original_content_id: shareLink.content_id,
                imported_content_id: importedContentId
              });

            // Track import event
            await supabase.rpc('increment_share_import', { p_share_id: shareId });

            // Also track in import_tracking for notifications
            await supabase
              .from('import_tracking')
              .insert({
                share_id: shareId,
                share_type: normalizedShareType,
                imported_by: recipient.id,
                sender_id: senderId
              });

            console.log('[Share] Successfully auto-imported content:', importedContentId);
            
            // Invalidate recipient's cache to ensure new content shows up immediately
            await invalidateContentCache(normalizedShareType, recipient.id, req, res);
          } catch (importError) {
            console.error('[Share] Failed to auto-import content:', importError);
            // Continue with notification even if import fails
          }
        }

        // Prepare navigation data based on content type and import status
        let navigationData = {
          type: 'content_shared',
          share_id: shareId,
          share_type: normalizedShareType,
          share_title: title,
          sender_name: senderName,
          sender_id: senderId,
          auto_imported: !alreadyImported && !!importedContentId,
          already_imported: alreadyImported
        };

        // Add specific navigation routes based on content type
        if (importedContentId) {
          if (normalizedShareType === 'quiz') {
            navigationData.navigation = {
              screen: 'QuizDetail',
              params: { quizId: importedContentId }
            };
          } else if (normalizedShareType === 'flashcards') {
            navigationData.navigation = {
              screen: 'FlashcardDeck',
              params: { 
                deckId: importedContentId,
                deckName: title || 'Shared Deck'
              }
            };
          }
        } else {
          // Fallback to share URL if import failed or not attempted
          const shareUrl = `${process.env.APP_URL || 'https://app.getbrainlift.app'}/share/${normalizedShareType}/${shareId}`;
          navigationData.share_url = shareUrl;
        }

        // Send push notification with navigation data
        const notificationBody = alreadyImported 
          ? `${senderName} shared "${title}" with you (already in your library)`
          : importedContentId 
            ? `${senderName} shared "${title}" with you - automatically added to your library!`
            : `${senderName} shared "${title}" with you`;

        await pushNotificationService.sendToUser(recipient.id, {
          title: `New ${normalizedShareType === 'flashcards' ? 'flashcard deck' : normalizedShareType} shared`,
          body: notificationBody,
          data: navigationData
        });

        // Mark notification as sent
        await supabase
          .from('share_tracking')
          .update({ 
            notification_sent: true,
            auto_imported: !alreadyImported && !!importedContentId
          })
          .eq('sender_id', senderId)
          .eq('recipient_email', recipientEmail)
          .eq('share_id', shareId)
          .eq('share_type', shareType)
          .order('shared_at', { ascending: false })
          .limit(1);
      }

      res.json({
        success: true,
        message: 'Content shared successfully',
        autoImported: recipient && importedContentId && !alreadyImported
      });

    } catch (error) {
      console.error('Error sending share:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

// Track when content is imported
router.post('/track-import',
  requireAuth,
  syncUserToSupabase,
  [
    body('shareId').notEmpty().isUUID(),
    body('shareType').isIn(['quiz', 'flashcard', 'flashcards']),
    body('senderId').optional().isUUID()
  ],
  async (req, res) => {
    try {
      const { shareId, shareType, senderId } = req.body;
      const userId = req.userId;
      const supabase = getSupabase();

      // Check if already imported
      const { data: existing } = await supabase
        .from('import_tracking')
        .select('id')
        .eq('user_id', userId)
        .eq('share_id', shareId)
        .eq('share_type', shareType)
        .single();

      if (!existing) {
        // Track the import
        await supabase
          .from('import_tracking')
          .insert({
            user_id: userId,
            share_id: shareId,
            share_type: shareType,
            sender_id: senderId,
            share_results: req.user?.share_quiz_results !== false
          });

        // If sender is known, notify them
        if (senderId) {
          const { data: sender } = await supabase
            .from('profiles')
            .select('email')
            .eq('id', senderId)
            .single();

          if (sender) {
            await pushNotificationService.sendToUser(senderId, {
              title: `Your ${shareType} was imported!`,
              body: `${req.user?.full_name || 'A user'} imported your shared ${shareType}`,
              data: {
                type: 'content_imported',
                share_id: shareId,
                share_type: shareType,
                importer_name: req.user?.full_name || 'User',
                importer_id: userId
              }
            });
          }
        }
      }

      res.json({ success: true });
    } catch (error) {
      console.error('Error tracking import:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

// Track when quiz is taken
router.post('/track-quiz-taken',
  requireAuth,
  syncUserToSupabase,
  [
    body('shareId').notEmpty().isUUID(),
    body('score').optional().isInt({ min: 0, max: 100 })
  ],
  async (req, res) => {
    try {
      const { shareId, score } = req.body;
      const userId = req.userId;
      const supabase = getSupabase();

      // Update import tracking
      const { data: importRecord } = await supabase
        .from('import_tracking')
        .select('*, profiles!import_tracking_sender_id_fkey(email, share_quiz_results)')
        .eq('user_id', userId)
        .eq('share_id', shareId)
        .eq('share_type', 'quiz')
        .single();

      if (importRecord && !importRecord.quiz_taken) {
        // Mark quiz as taken
        await supabase
          .from('import_tracking')
          .update({
            quiz_taken: true,
            quiz_taken_at: new Date().toISOString()
          })
          .eq('id', importRecord.id);

        // Check if we should notify sender
        if (importRecord.sender_id && 
            importRecord.profiles?.share_quiz_results && 
            importRecord.share_results) {
          
          let message = `${req.user?.full_name || 'A user'} completed your shared quiz`;
          if (score !== undefined && importRecord.share_results) {
            message += ` with a score of ${score}%`;
          }

          await pushNotificationService.sendToUser(importRecord.sender_id, {
            title: 'Quiz Completed!',
            body: message,
            data: {
              type: 'quiz_completed',
              share_id: shareId,
              taker_name: req.user?.full_name || 'User',
              taker_id: userId,
              score: importRecord.share_results ? score : undefined
            }
          });
        }
      }

      res.json({ success: true });
    } catch (error) {
      console.error('Error tracking quiz taken:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

// Respond to spam confirmation
router.post('/spam-confirmation',
  requireAuth,
  syncUserToSupabase,
  [
    body('confirmationId').notEmpty().isUUID(),
    body('action').isIn(['confirm', 'reject'])
  ],
  async (req, res) => {
    try {
      const { confirmationId, action } = req.body;
      const userId = req.userId;
      const supabase = getSupabase();

      // Get confirmation details
      const { data: confirmation } = await supabase
        .from('spam_confirmations')
        .select('*, profiles!spam_confirmations_sender_id_fkey(email, name)')
        .eq('id', confirmationId)
        .eq('recipient_id', userId)
        .eq('status', 'pending')
        .single();

      if (!confirmation) {
        return res.status(404).json({
          success: false,
          message: 'Confirmation not found or already processed'
        });
      }

      // Update confirmation status
      await supabase
        .from('spam_confirmations')
        .update({
          status: action === 'confirm' ? 'confirmed' : 'rejected',
          responded_at: new Date().toISOString()
        })
        .eq('id', confirmationId);

      if (action === 'reject') {
        // Block the sender
        await supabase
          .from('user_blocklist')
          .insert({
            user_id: userId,
            blocked_user_id: confirmation.sender_id,
            reason: 'Spam confirmation rejected'
          })
          .onConflict('user_id,blocked_user_id')
          .merge();

        // Notify sender they've been blocked
        await pushNotificationService.sendToUser(confirmation.sender_id, {
          title: 'Share Request Rejected',
          body: `${req.user?.full_name || 'A user'} has blocked you from sharing content`,
          data: {
            type: 'user_blocked',
            blocked_by: userId
          }
        });
      } else {
        // Allow the share
        await pushNotificationService.sendToUser(confirmation.sender_id, {
          title: 'Share Request Approved',
          body: `${req.user?.full_name || 'A user'} has approved your share request`,
          data: {
            type: 'share_approved',
            approved_by: userId
          }
        });
      }

      res.json({
        success: true,
        message: action === 'confirm' ? 'Share approved' : 'User blocked'
      });

    } catch (error) {
      console.error('Error processing spam confirmation:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

// Admin endpoint to check recipient notification statistics
router.get('/admin/recipient-stats/:email',
  requireAuth,
  requireSessionAdmin,
  async (req, res) => {
    try {
      const recipientEmail = decodeURIComponent(req.params.email);
      
      // Import the stats function
      const { getRecipientStats } = await import('../middleware/recipientRateLimit.middleware.js');
      const stats = await getRecipientStats(recipientEmail);
      
      res.json({
        success: true,
        stats
      });
      
    } catch (error) {
      console.error('Error getting recipient stats:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

// Report abusive content
router.post('/report-content',
  requireAuth,
  syncUserToSupabase,
  [
    body('shareId').notEmpty().custom((value) => {
      // Accept either UUID or 10-character share ID
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
      const isShareId = /^[a-zA-Z0-9]{10}$/.test(value);
      return isUUID || isShareId;
    }).withMessage('Invalid share ID format'),
    body('reason').isIn(['spam', 'inappropriate', 'malicious', 'copyright', 'other']),
    body('details').optional().isString().isLength({ max: 500 })
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      
      const { shareId, reason, details } = req.body;
      const reporterId = req.userId;
      const supabase = getSupabase();
      
      // Check if this user has already reported this content
      const { data: existingReport } = await supabase
        .from('content_reports')
        .select('id')
        .eq('share_id', shareId)
        .eq('reporter_id', reporterId)
        .eq('status', 'pending')
        .single();
        
      if (existingReport) {
        return res.status(400).json({
          success: false,
          error: 'You have already reported this content'
        });
      }
      
      // Create the report
      const { data: report, error: reportError } = await supabase
        .from('content_reports')
        .insert({
          share_id: shareId,
          reporter_id: reporterId,
          reason,
          details
        })
        .select()
        .single();
        
      if (reportError) {
        console.error('[Share] Failed to create report:', reportError);
        return res.status(500).json({
          success: false,
          error: 'Failed to submit report'
        });
      }
      
      // Get the report count for this share
      const { data: reportCount } = await supabase
        .rpc('get_share_report_count', { p_share_id: shareId });
        
      console.log(`[Share] Content reported - Share: ${shareId}, Reports: ${reportCount}, Reason: ${reason}`);
      
      // Auto-suspend after threshold (5 reports)
      const SUSPENSION_THRESHOLD = 5;
      if (reportCount >= SUSPENSION_THRESHOLD) {
        const { error: suspendError } = await supabase
          .from('shareable_links')
          .update({ 
            is_active: false, 
            suspended_reason: 'auto_suspended_abuse_reports',
            suspended_at: new Date().toISOString()
          })
          .eq('share_id', shareId);
          
        if (!suspendError) {
          console.log(`[Share] Auto-suspended share ${shareId} after ${reportCount} reports`);
          
          // Get share owner to notify them
          const { data: share } = await supabase
            .from('shareable_links')
            .select('user_id, title')
            .eq('share_id', shareId)
            .single();
            
          if (share) {
            // Notify the content owner
            await pushNotificationService.sendToUser(share.user_id, {
              title: 'Content Suspended',
              body: `Your shared content "${share.title || 'Untitled'}" has been suspended due to multiple reports`,
              data: {
                type: 'content_suspended',
                share_id: shareId,
                reason: 'abuse_reports'
              }
            });
          }
        }
      }
      
      res.json({
        success: true,
        message: 'Report submitted successfully',
        reportId: report.id,
        totalReports: reportCount || 1
      });
      
    } catch (error) {
      console.error('Error reporting content:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

// Get user's content reports
router.get('/my-reports',
  requireAuth,
  syncUserToSupabase,
  async (req, res) => {
    try {
      const userId = req.userId;
      const supabase = getSupabase();
      
      const { data: reports, error } = await supabase
        .from('content_reports')
        .select(`
          id,
          share_id,
          reason,
          details,
          status,
          created_at,
          shareable_links!inner(
            title,
            content_type,
            share_id
          )
        `)
        .eq('reporter_id', userId)
        .order('created_at', { ascending: false });
        
      if (error) {
        console.error('[Share] Failed to fetch user reports:', error);
        return res.status(500).json({
          success: false,
          error: 'Failed to fetch reports'
        });
      }
      
      res.json({
        success: true,
        reports: reports || []
      });
      
    } catch (error) {
      console.error('Error fetching user reports:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

// Admin endpoint to review reports
router.get('/admin/reports',
  requireAuth,
  requireSessionAdmin,
  async (req, res) => {
    try {
      const { status = 'pending' } = req.query;
      const supabase = getSupabase();
      
      const { data: reports, error } = await supabase
        .from('content_reports')
        .select(`
          *,
          reporter:profiles!reporter_id(email, full_name),
          shareable_links!inner(
            title,
            content_type,
            share_id,
            user_id,
            owner:profiles!user_id(email, full_name)
          )
        `)
        .eq('status', status)
        .order('created_at', { ascending: false });
        
      if (error) {
        console.error('[Share] Failed to fetch reports for admin:', error);
        return res.status(500).json({
          success: false,
          error: 'Failed to fetch reports'
        });
      }
      
      // Get report counts per share
      const { data: reportCounts } = await supabase
        .from('share_report_counts')
        .select('*');
        
      const countsMap = {};
      if (reportCounts) {
        reportCounts.forEach(count => {
          countsMap[count.share_id] = count;
        });
      }
      
      // Enhance reports with count data
      const enhancedReports = reports.map(report => ({
        ...report,
        totalReports: countsMap[report.share_id]?.report_count || 1,
        uniqueReporters: countsMap[report.share_id]?.unique_reporters || 1
      }));
      
      res.json({
        success: true,
        reports: enhancedReports
      });
      
    } catch (error) {
      console.error('Error fetching admin reports:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

// Admin endpoint to resolve reports
router.post('/admin/resolve-report',
  requireAuth,
  requireSessionAdmin,
  [
    body('reportId').isUUID(),
    body('resolution').isIn(['resolved', 'dismissed']),
    body('notes').optional().isString(),
    body('suspendContent').optional().isBoolean()
  ],
  async (req, res) => {
    try {
      const { reportId, resolution, notes, suspendContent } = req.body;
      const adminId = req.userId;
      const supabase = getSupabase();
      
      // Update the report
      const { data: report, error: updateError } = await supabase
        .from('content_reports')
        .update({
          status: resolution,
          resolution_notes: notes,
          resolved_by: adminId,
          resolved_at: new Date().toISOString()
        })
        .eq('id', reportId)
        .select('share_id')
        .single();
        
      if (updateError) {
        console.error('[Share] Failed to update report:', updateError);
        return res.status(500).json({
          success: false,
          error: 'Failed to update report'
        });
      }
      
      // If requested, suspend the content
      if (suspendContent && report) {
        await supabase
          .from('shareable_links')
          .update({
            is_active: false,
            suspended_reason: 'admin_review',
            suspended_at: new Date().toISOString()
          })
          .eq('share_id', report.share_id);
          
        console.log(`[Share] Admin suspended content ${report.share_id}`);
      }
      
      res.json({
        success: true,
        message: 'Report resolved successfully'
      });
      
    } catch (error) {
      console.error('Error resolving report:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

export default router;