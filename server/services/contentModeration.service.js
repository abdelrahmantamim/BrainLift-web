import { getSupabase } from '../config/services.config.js';
import logger from '../utils/serverLogger.js';
import DOMPurify from 'isomorphic-dompurify';

// List of inappropriate words/phrases to filter
// In production, this would be a more comprehensive list or use an AI service
const INAPPROPRIATE_PATTERNS = [
  // Profanity and offensive language
  /\b(fuck|shit|damn|hell|ass|bitch|cunt|dick|pussy|cock|bastard)\b/gi,
  // Hate speech and slurs (partial list - would be more comprehensive in production)
  /\b(nigger|nigga|faggot|retard|spic|chink|kike|wetback)\b/gi,
  // Violence and threats
  /\b(kill|murder|rape|assault|bomb|terrorist|suicide)\s+(you|me|them|everyone|people)\b/gi,
  // Sexual content
  /\b(sex|porn|nude|naked|penis|vagina|masturbat|orgasm)\b/gi,
  // Drug references
  /\b(cocaine|heroin|meth|crack|weed|marijuana|drugs)\b/gi,
  // Spam patterns
  /\b(click here|buy now|limited offer|act now|viagra|cialis|casino|lottery)\b/gi,
  // Contact info patterns (to prevent doxxing)
  /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, // Phone numbers
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, // Emails
];

// Content categories for moderation
const CONTENT_CATEGORIES = {
  CLEAN: 'clean',
  SUSPICIOUS: 'suspicious',
  INAPPROPRIATE: 'inappropriate',
  SPAM: 'spam',
  PERSONAL_INFO: 'personal_info'
};

class ContentModerationService {
  constructor() {
    this.supabase = null; // Initialize lazily
    this.moderationQueue = [];
    this.processingInterval = null;
  }

  // Lazy initialization of Supabase
  getSupabaseClient() {
    if (!this.supabase) {
      try {
        this.supabase = getSupabase();
      } catch (error) {
        logger.error('ContentModeration', 'Failed to initialize Supabase:', error);
      }
    }
    return this.supabase;
  }

  /**
   * Scan text content for inappropriate material
   */
  scanText(text) {
    if (!text) return { category: CONTENT_CATEGORIES.CLEAN, issues: [] };

    // Sanitize HTML to prevent XSS
    const cleanText = DOMPurify.sanitize(text, { ALLOWED_TAGS: [] });
    
    const issues = [];
    let category = CONTENT_CATEGORIES.CLEAN;

    // Check against inappropriate patterns
    for (const pattern of INAPPROPRIATE_PATTERNS) {
      if (pattern.test(cleanText)) {
        issues.push({
          type: 'pattern_match',
          pattern: pattern.source,
          matches: cleanText.match(pattern)
        });
        category = CONTENT_CATEGORIES.INAPPROPRIATE;
      }
    }

    // Check for personal information
    const phonePattern = /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g;
    const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    
    if (phonePattern.test(cleanText) || emailPattern.test(cleanText)) {
      issues.push({ type: 'personal_info', message: 'Contains personal information' });
      if (category === CONTENT_CATEGORIES.CLEAN) {
        category = CONTENT_CATEGORIES.PERSONAL_INFO;
      }
    }

    // Check for spam patterns
    const spamScore = this.calculateSpamScore(cleanText);
    if (spamScore > 0.7) {
      issues.push({ type: 'spam', score: spamScore });
      if (category === CONTENT_CATEGORIES.CLEAN) {
        category = CONTENT_CATEGORIES.SPAM;
      }
    }

    // If we found some issues but not clearly inappropriate, mark as suspicious
    if (issues.length > 0 && category === CONTENT_CATEGORIES.CLEAN) {
      category = CONTENT_CATEGORIES.SUSPICIOUS;
    }

    return { category, issues, cleanText };
  }

  /**
   * Calculate spam score based on various factors
   */
  calculateSpamScore(text) {
    let score = 0;
    
    // Excessive capitalization
    const capsRatio = (text.match(/[A-Z]/g) || []).length / text.length;
    if (capsRatio > 0.5) score += 0.3;
    
    // Excessive punctuation
    const punctRatio = (text.match(/[!?]{2,}/g) || []).length / text.length;
    if (punctRatio > 0.1) score += 0.2;
    
    // Repetitive content
    const words = text.toLowerCase().split(/\s+/);
    const uniqueWords = new Set(words);
    if (words.length > 10 && uniqueWords.size / words.length < 0.5) {
      score += 0.3;
    }
    
    // URL detection
    const urlPattern = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b/g;
    const urlCount = (text.match(urlPattern) || []).length;
    if (urlCount > 2) score += 0.2;
    
    return Math.min(score, 1);
  }

  /**
   * Scan quiz content
   */
  async scanQuiz(quiz) {
    const results = {
      overall: CONTENT_CATEGORIES.CLEAN,
      issues: [],
      details: {}
    };

    // Scan title
    const titleScan = this.scanText(quiz.title);
    results.details.title = titleScan;
    if (titleScan.category !== CONTENT_CATEGORIES.CLEAN) {
      results.overall = titleScan.category;
      results.issues.push({ field: 'title', ...titleScan });
    }

    // Scan description
    if (quiz.description) {
      const descScan = this.scanText(quiz.description);
      results.details.description = descScan;
      if (descScan.category !== CONTENT_CATEGORIES.CLEAN) {
        results.overall = descScan.category;
        results.issues.push({ field: 'description', ...descScan });
      }
    }

    // Scan questions
    if (quiz.questions && Array.isArray(quiz.questions)) {
      for (let i = 0; i < quiz.questions.length; i++) {
        const question = quiz.questions[i];
        
        // Scan question text
        const questionScan = this.scanText(question.question);
        if (questionScan.category !== CONTENT_CATEGORIES.CLEAN) {
          results.overall = questionScan.category;
          results.issues.push({ 
            field: `question_${i}`, 
            question: question.question,
            ...questionScan 
          });
        }

        // Scan options
        if (question.options) {
          for (let j = 0; j < question.options.length; j++) {
            const optionScan = this.scanText(question.options[j]);
            if (optionScan.category !== CONTENT_CATEGORIES.CLEAN) {
              results.overall = optionScan.category;
              results.issues.push({ 
                field: `question_${i}_option_${j}`,
                option: question.options[j],
                ...optionScan 
              });
            }
          }
        }
      }
    }

    return results;
  }

  /**
   * Scan flashcard deck content
   */
  async scanFlashcardDeck(deck, cards) {
    const results = {
      overall: CONTENT_CATEGORIES.CLEAN,
      issues: [],
      details: {}
    };

    // Scan deck name
    const nameScan = this.scanText(deck.name);
    results.details.name = nameScan;
    if (nameScan.category !== CONTENT_CATEGORIES.CLEAN) {
      results.overall = nameScan.category;
      results.issues.push({ field: 'name', ...nameScan });
    }

    // Scan deck description
    if (deck.description) {
      const descScan = this.scanText(deck.description);
      results.details.description = descScan;
      if (descScan.category !== CONTENT_CATEGORIES.CLEAN) {
        results.overall = descScan.category;
        results.issues.push({ field: 'description', ...descScan });
      }
    }

    // Scan cards
    if (cards && Array.isArray(cards)) {
      for (let i = 0; i < cards.length; i++) {
        const card = cards[i];
        
        // Scan front
        const frontScan = this.scanText(card.front);
        if (frontScan.category !== CONTENT_CATEGORIES.CLEAN) {
          results.overall = frontScan.category;
          results.issues.push({ 
            field: `card_${i}_front`,
            content: card.front,
            ...frontScan 
          });
        }

        // Scan back
        const backScan = this.scanText(card.back);
        if (backScan.category !== CONTENT_CATEGORIES.CLEAN) {
          results.overall = backScan.category;
          results.issues.push({ 
            field: `card_${i}_back`,
            content: card.back,
            ...backScan 
          });
        }
      }
    }

    return results;
  }

  /**
   * Add content to moderation queue
   */
  async addToModerationQueue(contentType, contentId, userId, scanResults) {
    try {
      const supabase = this.getSupabaseClient();
      if (!supabase) return false;
      
      const { error } = await supabase
        .from('moderation_queue')
        .insert({
          content_type: contentType,
          content_id: contentId,
          user_id: userId,
          scan_results: scanResults,
          status: scanResults.overall === CONTENT_CATEGORIES.INAPPROPRIATE ? 'flagged' : 'pending',
          severity: this.calculateSeverity(scanResults)
        });

      if (error) {
        logger.error('ContentModeration', 'Failed to add to moderation queue:', error);
        return false;
      }

      // If content is clearly inappropriate, auto-suspend
      if (scanResults.overall === CONTENT_CATEGORIES.INAPPROPRIATE) {
        await this.autoSuspendContent(contentType, contentId, scanResults);
      }

      return true;
    } catch (error) {
      logger.error('ContentModeration', 'Error in addToModerationQueue:', error);
      return false;
    }
  }

  /**
   * Calculate severity score
   */
  calculateSeverity(scanResults) {
    if (scanResults.overall === CONTENT_CATEGORIES.INAPPROPRIATE) return 'high';
    if (scanResults.overall === CONTENT_CATEGORIES.PERSONAL_INFO) return 'high';
    if (scanResults.overall === CONTENT_CATEGORIES.SPAM) return 'medium';
    if (scanResults.overall === CONTENT_CATEGORIES.SUSPICIOUS) return 'low';
    return 'none';
  }

  /**
   * Auto-suspend clearly inappropriate content
   */
  async autoSuspendContent(contentType, contentId, scanResults) {
    try {
      const supabase = this.getSupabaseClient();
      if (!supabase) return;
      
      const table = contentType === 'quiz' ? 'quizzes' : 'flashcard_decks';
      
      const { error } = await supabase
        .from(table)
        .update({ 
          is_suspended: true,
          suspension_reason: 'auto_moderation',
          suspension_details: scanResults
        })
        .eq('id', contentId);

      if (!error) {
        logger.info('ContentModeration', `Auto-suspended ${contentType} ${contentId} for inappropriate content`);
        
        // Also suspend any share links
        await supabase
          .from('shareable_links')
          .update({
            is_active: false,
            suspended_reason: 'content_auto_moderation'
          })
          .eq('content_type', contentType)
          .eq('content_id', contentId);
      }
    } catch (error) {
      logger.error('ContentModeration', 'Error in autoSuspendContent:', error);
    }
  }

  /**
   * Process moderation queue
   */
  async processModerationQueue() {
    try {
      const supabase = this.getSupabaseClient();
      if (!supabase) return;
      
      // Get pending items from queue
      const { data: items, error } = await supabase
        .from('moderation_queue')
        .select('id, content_type, content_id, user_id, scan_results, status, severity')
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(10);

      if (error || !items || items.length === 0) return;

      for (const item of items) {
        // Here you could integrate with external moderation APIs
        // For now, we'll just log and update status
        logger.info('ContentModeration', `Processing moderation item ${item.id}`);
        
        // Update status to reviewed
        await supabase
          .from('moderation_queue')
          .update({ 
            status: 'reviewed',
            reviewed_at: new Date().toISOString()
          })
          .eq('id', item.id);
      }
    } catch (error) {
      logger.error('ContentModeration', 'Error processing moderation queue:', error);
    }
  }

  /**
   * Start processing moderation queue
   */
  startProcessing() {
    // Process queue every 5 minutes (reduced from 30s to save Supabase egress)
    this.processingInterval = setInterval(() => {
      this.processModerationQueue();
    }, 5 * 60 * 1000);
    
    // Process immediately
    this.processModerationQueue();
  }

  /**
   * Stop processing moderation queue
   */
  stopProcessing() {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
  }
}

// Create singleton instance
const contentModerationService = new ContentModerationService();

// NOTE: Auto-start disabled to save Supabase egress.
// No real moderation queue exists yet (app is pre-launch).
// Re-enable when the app has real user-generated content to moderate.
// To start manually: contentModerationService.startProcessing()
// setTimeout(() => {
//   contentModerationService.startProcessing();
//   logger.info('ContentModeration', 'Started moderation queue processing');
// }, 5000);

export default contentModerationService;