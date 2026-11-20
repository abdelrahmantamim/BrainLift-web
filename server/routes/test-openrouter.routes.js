import express from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { generateAIResponse, testModel } from '../services/ai/unifiedAIService.js';
import logger from '../utils/serverLogger.js';

const router = express.Router();

// Test OpenRouter model
router.post('/test-openrouter', requireAuth, async (req, res) => {
  try {
    const { message = 'Hello! Please respond with a brief greeting to confirm you are working.' } = req.body;
    
    logger.info('Testing OpenRouter model');
    
    // Test with OpenRouter model
    const openRouterResponse = await testModel({
      provider: 'openrouter',
      modelName: 'openai/gpt-oss-120b',
      testPrompt: message
    });
    
    // Test fallback to gpt-4.1-nano
    const fallbackResponse = await testModel({
      provider: 'openai',
      modelName: 'gpt-4.1-nano',
      testPrompt: message
    });
    
    res.json({
      success: true,
      tests: {
        openRouter: openRouterResponse,
        fallback: fallbackResponse
      },
      message: 'Model tests completed'
    });
  } catch (error) {
    logger.error('OpenRouter test error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Test model switching
router.post('/test-model-switch', requireAuth, async (req, res) => {
  try {
    const { feature = 'chat', message = 'What is 2+2?' } = req.body;
    
    logger.info(`Testing model switching for ${feature}`);
    
    const messages = [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: message }
    ];
    
    // Test with configured model for the feature
    let configuredResponse;
    try {
      configuredResponse = await generateAIResponse({
        feature,
        messages,
        temperature: 0.7,
        maxTokens: 100
      });
    } catch (error) {
      configuredResponse = { error: error.message };
    }
    
    // Force test with OpenRouter
    let openRouterResponse;
    try {
      openRouterResponse = await generateAIResponse({
        feature,
        messages,
        temperature: 0.7,
        maxTokens: 100,
        overrideModel: {
          provider: 'openrouter',
          model_name: 'openai/gpt-oss-120b',
          display_name: 'GPT-OSS 120B (OpenRouter)',
          max_tokens: 100,
          temperature: 0.7
        }
      });
    } catch (error) {
      openRouterResponse = { error: error.message };
    }
    
    res.json({
      success: true,
      feature,
      configuredModel: configuredResponse,
      openRouterTest: openRouterResponse
    });
  } catch (error) {
    logger.error('Model switch test error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;