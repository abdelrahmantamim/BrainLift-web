import express from 'express';
import logger from '../utils/serverLogger.js';
import { generateChatResponse } from '../services/ai/chatService.js';
import { generateQuiz } from '../services/ai/quizService.js';
import { generateFlashcards } from '../services/ai/flashcardService.js';
import { generateEmbedding, generateEmbeddings } from '../services/ai/embeddingService.js';
import { renderChart, createThumbnail } from '../services/chartRenderingService.js';
import { rateLimitAPI } from '../middleware/apiAuth.middleware.js';

const router = express.Router();

// Chat completion endpoint
router.post('/chat/complete', rateLimitAPI(50, 60000), async (req, res) => {
  try {
    const { messages, context, model, temperature, maxTokens } = req.body;
    
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: { message: 'Messages array is required' } });
    }
    
    logger.info('AI', `Chat completion request with ${messages.length} messages`);
    
    const response = await generateChatResponse({
      messages,
      context,
      model: model || 'gpt-4',
      temperature: temperature || 0.7,
      maxTokens: maxTokens || 2000
    });
    
    res.json({
      success: true,
      response
    });
  } catch (error) {
    logger.error('AI', 'Chat completion error:', error);
    res.status(500).json({
      error: { message: 'Failed to generate response', detail: error.message }
    });
  }
});

// Quiz generation endpoint
router.post('/quiz/generate', rateLimitAPI(20, 60000), async (req, res) => {
  try {
    const { 
      topic, 
      content, 
      difficulty, 
      questionCount, 
      questionTypes,
      model 
    } = req.body;
    
    if (!topic && !content) {
      return res.status(400).json({ error: { message: 'Topic or content is required' } });
    }
    
    logger.info('AI', `Quiz generation request: ${questionCount || 10} questions on ${topic || 'content'}`);
    
    const quiz = await generateQuiz({
      topic,
      content,
      difficulty: difficulty || 'medium',
      questionCount: questionCount || 10,
      questionTypes: questionTypes || ['multiple_choice'],
      model: model || 'gpt-4'
    });
    
    res.json({
      success: true,
      quiz
    });
  } catch (error) {
    logger.error('AI', 'Quiz generation error:', error);
    res.status(500).json({
      error: { message: 'Failed to generate quiz', detail: error.message }
    });
  }
});

// Flashcard generation endpoint
router.post('/flashcards/generate', rateLimitAPI(20, 60000), async (req, res) => {
  try {
    const { 
      content, 
      topic,
      cardCount, 
      difficulty,
      model 
    } = req.body;
    
    if (!content && !topic) {
      return res.status(400).json({ error: { message: 'Content or topic is required' } });
    }
    
    logger.info('AI', `Flashcard generation request: ${cardCount || 10} cards`);
    
    const flashcards = await generateFlashcards({
      content,
      topic,
      cardCount: cardCount || 10,
      difficulty: difficulty || 'medium',
      model: model || 'gpt-3.5-turbo'
    });
    
    res.json({
      success: true,
      flashcards
    });
  } catch (error) {
    logger.error('AI', 'Flashcard generation error:', error);
    res.status(500).json({
      error: { message: 'Failed to generate flashcards', detail: error.message }
    });
  }
});

// Embedding generation endpoint
router.post('/embedding', rateLimitAPI(100, 60000), async (req, res) => {
  try {
    const { text, texts } = req.body;
    
    if (!text && !texts) {
      return res.status(400).json({ error: { message: 'Either text or texts array is required' } });
    }
    
    if (texts && Array.isArray(texts)) {
      logger.info('AI', `Generating embeddings for ${texts.length} texts`);
      const embeddings = await generateEmbeddings(texts);
      
      res.json({
        success: true,
        embeddings
      });
    } else {
      logger.info('AI', `Generating embedding for single text`);
      const embedding = await generateEmbedding(text);
      
      res.json({
        success: true,
        embedding
      });
    }
  } catch (error) {
    logger.error('AI', 'Embedding generation error:', error);
    res.status(500).json({
      error: { message: 'Failed to generate embedding', detail: error.message }
    });
  }
});

// Chart rendering endpoint
router.post('/chart/render', rateLimitAPI(20, 60000), async (req, res) => {
  try {
    const { chartSpec, generateThumbnail = true } = req.body;
    
    if (!chartSpec || !chartSpec.type || !chartSpec.data) {
      return res.status(400).json({
        error: { message: 'Invalid chart specification. Required: type, data' }
      });
    }
    
    logger.info('AI', `Rendering ${chartSpec.type} chart`);
    
    // Render the full chart
    const fullChart = await renderChart(chartSpec);
    
    // Generate thumbnail if requested
    let thumbnail = null;
    if (generateThumbnail) {
      thumbnail = await createThumbnail(fullChart.buffer);
    }
    
    res.json({
      success: true,
      chart: {
        image: fullChart.buffer.toString('base64'),
        mimeType: fullChart.mimeType,
        width: fullChart.width,
        height: fullChart.height
      },
      thumbnail: thumbnail ? {
        image: thumbnail.buffer.toString('base64'),
        width: thumbnail.width,
        height: thumbnail.height
      } : null
    });
    
  } catch (error) {
    logger.error('AI', 'Chart rendering error:', error);
    res.status(500).json({
      error: { message: 'Failed to render chart', detail: error.message }
    });
  }
});

// Model availability check
router.get('/models', async (req, res) => {
  try {
    const models = {
      chat: [
        { id: 'gpt-4', name: 'GPT-4', provider: 'openai' },
        { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', provider: 'openai' },
        { id: 'claude-3-opus', name: 'Claude 3 Opus', provider: 'anthropic' },
        { id: 'claude-3-sonnet', name: 'Claude 3 Sonnet', provider: 'anthropic' },
        { id: 'gemini-pro', name: 'Gemini Pro', provider: 'google' }
      ],
      quiz: [
        { id: 'gpt-4', name: 'GPT-4', provider: 'openai' },
        { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', provider: 'openai' }
      ],
      flashcards: [
        { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', provider: 'openai' }
      ]
    };
    
    res.json({ models });
  } catch (error) {
    logger.error('AI', 'Models endpoint error:', error);
    res.status(500).json({ error: { message: 'Failed to get models' } });
  }
});

export default router;