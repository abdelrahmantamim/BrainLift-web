import express from 'express';
import { authMiddleware, requireAuth } from '../middleware/auth.middleware.js';
import { getSupabase } from '../config/services.config.js';
import { v4 as uuidv4 } from 'uuid';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
// Use safe PDF generator to avoid library conflicts
const pdfGenerator = require('../services/pdfGeneratorSafe.cjs');
// Other generators available if needed:
// const pdfGeneratorEnhanced = require('../services/pdfGeneratorEnhanced.js'); // Uses canvas (conflicts with sharp)
// const pdfGeneratorBasic = require('../services/pdfGenerator.js'); // Text-only charts

const router = express.Router();

/**
 * Generate PDF from AI chat response
 * POST /api/pdf/generate-from-chat
 */
router.post('/generate-from-chat', authMiddleware, async (req, res) => {
  try {
    const { content, type = 'summary' } = req.body;
    const userId = req.userId;

    if (!content) {
      return res.status(400).json({ error: { message: 'Content is required' } });
    }

    let pdfBuffer;
    let filename;

    // Generate PDF based on type
    switch (type) {
      case 'summary':
        // Handle both string and object content
        const summaryContent = typeof content === 'string' ? content : content.text || JSON.stringify(content);
        pdfBuffer = await pdfGenerator.generateFromAIResponse({
          title: content.title || 'AI Summary',
          text: summaryContent
        });
        filename = `ai-summary-${Date.now()}.pdf`;
        break;

      case 'study-guide':
        pdfBuffer = await pdfGenerator.generateStudyGuide(content);
        filename = `study-guide-${Date.now()}.pdf`;
        break;

      case 'quiz': {
        const quizContent = typeof content === 'string' ? JSON.parse(content) : content;
        pdfBuffer = await pdfGenerator.generateQuizPDF(quizContent);
        filename = `quiz-${quizContent.title?.replace(/\s+/g, '-') || Date.now()}.pdf`;
        break;
      }

      case 'flashcards': {
        const flashcardsContent = typeof content === 'string' ? JSON.parse(content) : content;
        pdfBuffer = await pdfGenerator.generateFlashcardsPDF(flashcardsContent);
        filename = `flashcards-${flashcardsContent.title?.replace(/\s+/g, '-') || Date.now()}.pdf`;
        break;
      }

      case 'conversation': {
        const convoContent = typeof content === 'string' ? JSON.parse(content) : content;
        pdfBuffer = await pdfGenerator.generateConversationPDF(convoContent);
        filename = `${convoContent.title?.replace(/\s+/g, '-').toLowerCase() || 'chat'}-${Date.now()}.pdf`;
        break;
      }

      default:
        pdfBuffer = await pdfGenerator.generateFromAIResponse({
          title: 'AI Generated Content',
          text: JSON.stringify(content)
        });
        filename = `ai-content-${Date.now()}.pdf`;
    }

    // Store metadata in database
    const supabase = getSupabase();
    const { error: dbError } = await supabase
      .from('generated_pdfs')
      .insert({
        id: uuidv4(),
        user_id: userId,
        filename,
        type,
        size: pdfBuffer.length,
        metadata: {
          title: content.title,
          generatedAt: new Date().toISOString()
        }
      });

    if (dbError) {
      console.error('Database error storing PDF metadata:', dbError);
    }

    // Send PDF as response
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('PDF generation error:', error);
    res.status(500).json({
      error: { message: 'Failed to generate PDF', detail: error.message }
    });
  }
});

/**
 * Generate PDF from chat conversation
 * POST /api/pdf/generate-from-conversation
 */
router.post('/generate-from-conversation', authMiddleware, async (req, res) => {
  try {
    const { conversationId, includeSystemMessages = false } = req.body;
    const userId = req.userId;

    if (!conversationId) {
      return res.status(400).json({ error: { message: 'Conversation ID is required' } });
    }

    // Fetch conversation messages
    const supabase = getSupabase();
    const { data: messages, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error('Failed to fetch conversation messages');
    }

    // Filter messages if needed
    const filteredMessages = includeSystemMessages 
      ? messages 
      : messages.filter(msg => msg.role !== 'system');

    // Get conversation metadata
    const { data: conversation } = await supabase
      .from('chat_conversations')
      .select('*')
      .eq('id', conversationId)
      .eq('user_id', userId)
      .single();

    // Generate PDF
    const pdfBuffer = await pdfGenerator.generateChatSummary(filteredMessages, {
      conversationTitle: conversation?.title || 'Chat Conversation',
      conversationId,
      totalMessages: filteredMessages.length
    });

    const filename = `chat-summary-${conversationId.substring(0, 8)}-${Date.now()}.pdf`;

    // Send PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('PDF generation from conversation error:', error);
    res.status(500).json({
      error: { message: 'Failed to generate PDF from conversation', detail: error.message }
    });
  }
});

/**
 * Generate PDF from formatted content
 * POST /api/pdf/generate-formatted
 */
router.post('/generate-formatted', authMiddleware, async (req, res) => {
  try {
    const { sections, title, metadata } = req.body;

    if (!sections || !Array.isArray(sections)) {
      return res.status(400).json({ error: { message: 'Sections array is required' } });
    }

    const content = {
      title: title || 'Generated Document',
      metadata: {
        ...metadata,
        generatedAt: new Date().toLocaleDateString()
      },
      sections
    };

    const pdfBuffer = await pdfGenerator.generateFromAIResponse(content);
    const filename = `${title?.toLowerCase().replace(/\s+/g, '-') || 'document'}-${Date.now()}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('PDF generation error:', error);
    res.status(500).json({
      error: { message: 'Failed to generate PDF', detail: error.message }
    });
  }
});

/**
 * Generate PDF from specific message
 * POST /api/pdf/generate-from-message
 */
router.post('/generate-from-message', requireAuth, async (req, res) => {
  try {
    const { messageContent, messageId, conversationId, contentType, topic, svgCharts } = req.body;
    const userId = req.userId;

    if (!conversationId) {
      return res.status(400).json({ error: { message: 'Conversation ID is required' } });
    }

    console.log('[PDF] Generating PDF from message:', {
      messageId,
      conversationId,
      contentType,
      topic,
      hasCharts: svgCharts?.length > 0
    });

    // Get the conversation history to find the actual content
    const supabase = getSupabase();
    const { data: messages, error: messagesError } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('session_id', conversationId)
      .order('created_at', { ascending: true });

    if (messagesError) {
      console.error('[PDF] Error fetching messages:', messagesError);
      return res.status(500).json({ error: { message: 'Failed to fetch conversation history' } });
    }

    // Find relevant content from the conversation
    let content = messageContent;
    const sections = [];
    const charts = [];
    
    // Look for substantial content in recent messages
    if (messages && messages.length > 0) {
      // Strategy: Collect all relevant content from the conversation
      const relevantContent = [];
      
      // Check the last few messages for actual content
      for (let i = Math.max(0, messages.length - 10); i < messages.length; i++) {
        const msg = messages[i];
        if (msg.role === 'assistant' && msg.content) {
          // Check if this message has charts or substantial content
          const hasCharts = msg.content.includes('```json') && msg.content.includes('"type":');
          const hasSubstantialContent = msg.content.length > 200;
          const isNotPDFMessage = !msg.content.includes("I'll prepare a PDF") && !msg.content.includes("I will prepare a PDF");
          
          if ((hasCharts || hasSubstantialContent) && isNotPDFMessage) {
            relevantContent.push(msg.content);
            console.log('[PDF] Found relevant content at index:', i, 'Length:', msg.content.length);
          }
        }
      }
      
      // Use the most recent substantial content, or combine if multiple relevant pieces
      if (relevantContent.length > 0) {
        // If there's only one piece of content, use it
        if (relevantContent.length === 1) {
          content = relevantContent[0];
        } else {
          // Combine multiple pieces of content
          content = relevantContent.join('\n\n---\n\n');
        }
        console.log('[PDF] Using', relevantContent.length, 'pieces of content for PDF');
      }
    }
    
    // Extract charts from message content
    const chartMatches = content.match(/```json\s*([\s\S]*?)```/g);
    if (chartMatches) {
      for (const match of chartMatches) {
        try {
          const jsonStr = match.replace(/```json\s*/, '').replace(/```$/, '').trim();
          const jsonData = JSON.parse(jsonStr);
          if (jsonData.type && ['pie', 'bar', 'line', 'flow', 'mindmap', 'tree'].includes(jsonData.type)) {
            charts.push(jsonData);
          }
        } catch (e) {
          // Not a valid chart
        }
      }
    }

    // Extract text content (remove JSON blocks)
    let textContent = content.replace(/```json[\s\S]*?```/g, '');
    
    // Clean AI commentary about charts if charts were found
    if (chartMatches && chartMatches.length > 0) {
      textContent = cleanChartCommentary(textContent);
    }
    
    // Clean PDF-related comments
    textContent = textContent
      .replace(/\[PDF_READY:.*?\]/g, '')
      .replace(/I'll prepare a PDF.*?\./gi, '')
      .trim();

    // Parse content based on type
    if (contentType === 'quiz') {
      // Extract quiz questions and answers
      const questionPattern = /\d+\.\s+([^\n]+)\n((?:[A-D]\.\s+[^\n]+\n?)+)(?:Correct Answer:\s*([A-D])[^\n]*)?(?:\nExplanation:\s*([^\n]+))?/g;
      const questions = [];
      let match;
      
      while ((match = questionPattern.exec(textContent)) !== null) {
        questions.push({
          question: match[1],
          options: match[2].trim().split('\n').map(opt => opt.trim()),
          correctAnswer: match[3] || '',
          explanation: match[4] || ''
        });
      }
      
      if (questions.length > 0) {
        sections.push({
          title: 'Quiz Questions',
          content: textContent
        });
      }
    } else if (contentType === 'flashcards' || textContent.includes('Flashcard')) {
      // Extract flashcard content
      sections.push({
        title: topic || 'Flashcards',
        content: textContent
      });
    } else if (contentType === 'study-guide') {
      // Extract study guide sections
      const lines = textContent.split('\n');
      let currentSection = null;
      
      for (const line of lines) {
        if (line.match(/^#{1,3}\s+/)) {
          // New section
          if (currentSection) {
            sections.push(currentSection);
          }
          currentSection = {
            title: line.replace(/^#{1,3}\s+/, ''),
            content: ''
          };
        } else if (currentSection) {
          currentSection.content += line + '\n';
        } else {
          // Create default section
          if (!sections.length) {
            sections.push({
              title: topic || 'Study Guide',
              content: line + '\n'
            });
          } else {
            sections[sections.length - 1].content += line + '\n';
          }
        }
      }
      
      if (currentSection) {
        sections.push(currentSection);
      }
    } else {
      // Default content extraction
      sections.push({
        title: topic || 'Content',
        content: textContent
      });
    }

    // Determine the best title for the PDF
    let pdfTitle = topic || 'Conversation Summary';
    
    // If we have a flowchart, use that as the title
    if (charts.length > 0 && charts[0].type === 'flow' && charts[0].title) {
      pdfTitle = charts[0].title;
    } else if (contentType === 'quiz' && textContent.includes('Quiz')) {
      pdfTitle = 'Quiz Questions';
    } else if (contentType === 'flashcards') {
      pdfTitle = 'Flashcards';
    } else if (sections.length > 0 && sections[0].title && sections[0].title !== 'Content') {
      pdfTitle = sections[0].title;
    }

    // Generate PDF with extracted content
    const pdfContent = {
      title: pdfTitle,
      sections: sections.length > 0 ? sections : [{
        title: 'Content',
        content: 'No content available for PDF generation.'
      }],
      charts: charts,
      svgCharts: svgCharts || []
    };

    console.log('[PDF] Generating with:', {
      title: pdfContent.title,
      sectionsCount: pdfContent.sections.length,
      chartsCount: pdfContent.charts.length
    });

    try {
      const pdfBuffer = await pdfGenerator.generateFromAIResponse(pdfContent);
      // Create a clean filename from the title
      const cleanTitle = pdfTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const filename = `${cleanTitle}-${Date.now()}.pdf`;

      // Send PDF
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      res.send(pdfBuffer);
    } catch (pdfError) {
      console.error('[PDF] Error generating PDF document:', pdfError);
      return res.status(500).json({
        error: { message: 'Failed to generate PDF document', detail: pdfError.message }
      });
    }
  } catch (error) {
    console.error('[PDF] Unexpected error in generate-from-message:', error);
    res.status(500).json({
      error: { message: 'Failed to process PDF request', detail: error.message }
    });
  }
});

/**
 * Generate test PDF to verify service is working
 * GET /api/pdf/test
 */
router.get('/test', authMiddleware, async (req, res) => {
  try {
    const testContent = {
      title: 'Test PDF Generation',
      metadata: {
        'Generated By': 'AI Tutor App',
        'Test Date': new Date().toLocaleDateString()
      },
      sections: [
        {
          title: 'Introduction',
          content: 'This is a test PDF to verify the generation service is working correctly.'
        },
        {
          title: 'Features',
          bullets: [
            'PDF generation from AI responses',
            'Custom formatting support',
            'Multiple content types',
            'Automatic metadata inclusion'
          ]
        },
        {
          title: 'Code Example',
          code: `// Example API call
const response = await fetch('/api/pdf/generate-from-chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ content: aiResponse })
});`
        }
      ]
    };

    const pdfBuffer = await pdfGenerator.generateFromAIResponse(testContent);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="test.pdf"');
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Test PDF generation error:', error);
    res.status(500).json({
      error: { message: 'Failed to generate test PDF', detail: error.message }
    });
  }
});

// Helper function to generate title from content
function generateTitleFromContent(content, contentType) {
  const firstLine = content.split('\n')[0].substring(0, 100);
  
  switch (contentType) {
    case 'quiz':
      return 'Quiz: ' + (firstLine || 'Generated Quiz');
    case 'study-guide':
      return 'Study Guide: ' + (firstLine || 'Study Materials');
    case 'chart-report':
      return 'Chart Report: ' + (firstLine || 'Data Visualization');
    default:
      return firstLine || 'AI Generated Content';
  }
}

// Helper function to clean AI commentary about charts
function cleanChartCommentary(text) {
  const patterns = [
    // Chart creation phrases
    /I'll\s+(?:create|generate|prepare|make|draw|show).*?(?:chart|graph|diagram|visualization).*?[.!]/gi,
    /Let\s+me\s+(?:create|generate|prepare|make|draw|show).*?(?:chart|graph|diagram|visualization).*?[.!]/gi,
    /Here's\s+(?:the|a|an)?.*?(?:chart|graph|diagram|visualization).*?[:.-]/gi,
    /Here\s+is\s+(?:the|a|an)?.*?(?:chart|graph|diagram|visualization).*?[:.-]/gi,
    
    // JSON/data references
    /Here's\s+the\s+JSON\s+data.*?[.!]/gi,
    /Here\s+is\s+the\s+JSON\s+data.*?[.!]/gi,
    /Here's\s+the\s+data.*?[:.-]/gi,
    
    // Questions about charts
    /Would\s+you\s+like.*?(?:chart|graph|diagram|visualization).*?\?/gi,
    /Do\s+you\s+want.*?(?:chart|graph|diagram|visualization).*?\?/gi,
    
    // Chart descriptions
    /The\s+(?:chart|graph|diagram)\s+(?:shows|displays|represents|illustrates).*?[:.-]/gi,
    /This\s+(?:chart|graph|diagram)\s+(?:shows|displays|represents|illustrates).*?[:.-]/gi,
    
    // Based on/according to
    /Based\s+on\s+(?:the|your)\s+data.*?[:.-]/gi,
    /According\s+to\s+(?:the|your)\s+data.*?[:.-]/gi,
    
    // Visual representation
    /Here\s+is\s+(?:the|a|an)?\s*visual\s+representation.*?[:.-]/gi,
    /I've\s+(?:created|generated|prepared|made).*?(?:chart|graph|diagram|visualization).*?[.!]/gi,
    
    // PDF related
    /I'll\s+prepare\s+a\s+PDF.*?[.!]/gi,
    /\[PDF_READY:.*?\]/gi
  ];
  
  let cleaned = text;
  patterns.forEach(pattern => {
    cleaned = cleaned.replace(pattern, '');
  });
  
  // Clean up resulting whitespace
  cleaned = cleaned
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .join('\n')
    .replace(/\n{3,}/g, '\n\n');
  
  return cleaned.trim();
}

export default router;