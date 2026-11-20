import OpenAI from 'openai';
import logger from '../../utils/serverLogger.js';
import { getModelConfig } from '../../utils/modelConfig.js';
import { getOpenAI, getGenAI } from '../../config/services.config.js';

// OpenRouter client (singleton)
let openRouterClient = null;

function getOpenRouterClient() {
  if (!openRouterClient) {
    openRouterClient = new OpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: process.env.OPEN_ROUTER_API,
      defaultHeaders: {
        "HTTP-Referer": process.env.FRONTEND_URL || "https://getbrainlift.app",
        "X-Title": "BrainLift AI Tutoring",
      },
    });
  }
  return openRouterClient;
}

// Fallback model configuration
const FALLBACK_MODEL = {
  provider: 'openai',
  model_name: 'gpt-4.1-nano',
  model_id: 'gpt-4.1-nano', // For compatibility
  display_name: 'GPT-4.1 Nano (Fallback)',
  max_tokens: 4096,
  temperature: 0.7
};

function extractTextFromContent(content) {
  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map(part => {
        if (typeof part === 'string') return part;
        if (!part || typeof part !== 'object') return '';
        if (typeof part.text === 'string') return part.text;
        if (typeof part.content === 'string') return part.content;
        return '';
      })
      .join('');
  }

  if (content && typeof content === 'object') {
    if (typeof content.text === 'string') return content.text;
    if (typeof content.content === 'string') return content.content;
  }

  return '';
}

function extractTextFromChatCompletion(completion) {
  const choice = completion?.choices?.[0];
  if (!choice) return '';

  const messageContent = extractTextFromContent(choice.message?.content);
  if (messageContent) return messageContent;

  const deltaContent = extractTextFromContent(choice.delta?.content);
  if (deltaContent) return deltaContent;

  if (typeof choice.delta?.text === 'string') return choice.delta.text;
  if (typeof choice.text === 'string') return choice.text;
  if (typeof completion?.output_text === 'string') return completion.output_text;

  return '';
}

function extractTextFromStreamChunk(chunk) {
  const choice = chunk?.choices?.[0];
  if (!choice) return '';

  const deltaContent = extractTextFromContent(choice.delta?.content);
  if (deltaContent) return deltaContent;

  if (typeof choice.delta?.text === 'string') return choice.delta.text;
  if (typeof choice.text === 'string') return choice.text;
  if (typeof chunk?.output_text === 'string') return chunk.output_text;

  return '';
}

/**
 * Unified AI service that supports multiple providers
 * @param {Object} options - Configuration options
 * @param {string} options.feature - The feature requesting AI (chat, quiz, files)
 * @param {Array} options.messages - Messages array for chat completion
 * @param {number} options.temperature - Temperature for generation
 * @param {number} options.maxTokens - Maximum tokens to generate
 * @param {Object} options.overrideModel - Optional model override
 * @param {boolean} options.jsonMode - Whether to use JSON response format
 * @returns {Promise<Object>} - AI response with content, model info, and usage
 */
export async function generateAIResponse({
  feature = 'chat',
  messages,
  temperature,
  maxTokens,
  overrideModel = null,
  jsonMode = false,
  retryCount = 0
}) {
  try {
    // Get model configuration
    const modelConfig = getModelConfig();
    
    // Map flashcards to use the same model as quiz (testing model)
    const mappedFeature = feature === 'flashcards' ? 'quiz' : feature;
    const model = overrideModel || modelConfig[mappedFeature] || FALLBACK_MODEL;
    
    // Ensure model has model_id for compatibility
    if (!model.model_id && model.model_name) {
      model.model_id = model.model_name;
    }
    
    // Use provided values or model defaults
    const finalTemperature = temperature ?? parseFloat(model.temperature) ?? 0.7;
    const finalMaxTokens = maxTokens ?? model.max_tokens ?? 4096;
    
    logger.info('UnifiedAI', `Generating response for ${feature} using ${model.provider}/${model.model_name}`);
    
    let response;
    
    switch (model.provider) {
      case 'openai':
        response = await generateOpenAIResponse({
          model: model.model_name,
          messages,
          temperature: finalTemperature,
          maxTokens: finalMaxTokens,
          jsonMode
        });
        break;
        
      case 'openrouter':
        response = await generateOpenRouterResponse({
          model: model.model_name,
          messages,
          temperature: finalTemperature,
          maxTokens: finalMaxTokens,
          jsonMode
        });
        break;
        
      case 'google':
        response = await generateGoogleResponse({
          model: model.model_name,
          messages,
          temperature: finalTemperature,
          maxTokens: finalMaxTokens,
          jsonMode
        });
        break;
        
      default:
        throw new Error(`Unsupported provider: ${model.provider}`);
    }
    
    return {
      ...response,
      provider: model.provider,
      model: model.model_name,
      modelDisplayName: model.display_name
    };
    
  } catch (error) {
    logger.error('UnifiedAI', `Generation error: ${error.message}`);
    
    // If this is the first attempt and we're not already using the fallback
    if (retryCount === 0 && (!overrideModel || overrideModel.model_name !== FALLBACK_MODEL.model_name)) {
      logger.info('UnifiedAI', 'Retrying with fallback model...');
      return generateAIResponse({
        feature,
        messages,
        temperature,
        maxTokens,
        overrideModel: FALLBACK_MODEL,
        jsonMode,
        retryCount: retryCount + 1
      });
    }
    
    throw error;
  }
}

/**
 * Check if a model should use the Responses API (GPT-5 models)
 */
function isResponsesAPIModel(model) {
  return model.includes('gpt-5');
}

/**
 * Generate response using OpenAI Responses API (for GPT-5 models)
 */
async function generateOpenAIResponsesAPIResponse({ model, messages, maxTokens, jsonMode = false }) {
  const openai = getOpenAI();

  // Extract system/instructions from messages
  const systemMsg = messages.find(m => m.role === 'system');
  const inputMessages = messages.filter(m => m.role !== 'system');

  const responseOptions = {
    model,
    input: inputMessages.map(m => ({ role: m.role, content: m.content })),
    max_output_tokens: maxTokens,
    reasoning: { effort: 'low' },
  };

  if (systemMsg) {
    responseOptions.instructions = systemMsg.content;
  }

  if (jsonMode) {
    responseOptions.text = { format: { type: 'json_object' } };
  }

  logger.info('OpenAI Responses API', `Request with model: ${model}, max_output_tokens: ${maxTokens}`);

  const response = await openai.responses.create(responseOptions);
  const content = response.output_text || '';

  if (!content || !content.trim()) {
    throw new Error(`OpenAI Responses API returned empty content for model: ${model}`);
  }

  return {
    content,
    usage: response.usage,
    finishReason: response.status
  };
}

/**
 * Generate response using OpenAI Chat Completions API
 */
async function generateOpenAIResponse({ model, messages, temperature, maxTokens, jsonMode = false }) {
  // Route GPT-5 models to Responses API
  if (isResponsesAPIModel(model)) {
    return generateOpenAIResponsesAPIResponse({ model, messages, maxTokens, jsonMode });
  }

  const openai = getOpenAI();

  const completionOptions = {
    model,
    messages,
  };

  // Handle model-specific parameters
  // o-series models use max_completion_tokens and don't support custom temperature
  if (model.includes('o1') || model.includes('o3') || model.includes('o4')) {
    completionOptions.max_completion_tokens = maxTokens;
  } else {
    // Legacy models (GPT-4, GPT-4.1, etc.)
    completionOptions.max_tokens = maxTokens;
    completionOptions.temperature = temperature;
  }

  // Add JSON mode if requested
  if (jsonMode) {
    completionOptions.response_format = { type: 'json_object' };
  }

  const completion = await openai.chat.completions.create(completionOptions);
  const content = extractTextFromChatCompletion(completion);

  if (!content || !content.trim()) {
    throw new Error(`OpenAI returned empty content for model: ${model}`);
  }

  return {
    content,
    usage: completion.usage,
    finishReason: completion.choices[0].finish_reason
  };
}

/**
 * Generate streaming response using OpenAI Responses API (for GPT-5 models)
 * Returns an async generator that yields content chunks
 */
async function* generateOpenAIResponsesAPIStreamingResponse({ model, messages, maxTokens }) {
  const openai = getOpenAI();

  // Extract system/instructions from messages
  const systemMsg = messages.find(m => m.role === 'system');
  const inputMessages = messages.filter(m => m.role !== 'system');

  const responseOptions = {
    model,
    input: inputMessages.map(m => ({ role: m.role, content: m.content })),
    max_output_tokens: maxTokens,
    reasoning: { effort: 'low' },
    stream: true,
  };

  if (systemMsg) {
    responseOptions.instructions = systemMsg.content;
  }

  logger.info('OpenAI Responses Streaming', `Starting stream with model: ${model}, max_output_tokens: ${maxTokens}`);

  const stream = await openai.responses.create(responseOptions);
  let producedContent = false;

  for await (const event of stream) {
    // Responses API streaming events have different structure
    if (event.type === 'response.output_text.delta') {
      const content = event.delta;
      if (content) {
        producedContent = true;
        yield content;
      }
    }
  }

  if (!producedContent) {
    throw new Error(`OpenAI Responses API stream returned no content for model: ${model}`);
  }
}

/**
 * Generate streaming response using OpenAI
 * Returns an async generator that yields content chunks
 */
export async function* generateOpenAIStreamingResponse({ model, messages, temperature, maxTokens }) {
  // Route GPT-5 models to Responses API streaming
  if (isResponsesAPIModel(model)) {
    yield* generateOpenAIResponsesAPIStreamingResponse({ model, messages, maxTokens });
    return;
  }

  const openai = getOpenAI();

  const completionOptions = {
    model,
    messages,
    stream: true,
    stream_options: { include_usage: true },
  };

  // Handle model-specific parameters
  // o-series models use max_completion_tokens and don't support custom temperature
  if (model.includes('o1') || model.includes('o3') || model.includes('o4')) {
    completionOptions.max_completion_tokens = maxTokens;
  } else {
    // Legacy models (GPT-4, GPT-4.1, etc.)
    completionOptions.max_tokens = maxTokens;
    completionOptions.temperature = temperature;
  }

  logger.info('OpenAI Streaming', `Starting stream with model: ${model}, options: ${JSON.stringify(completionOptions)}`);

  const stream = await openai.chat.completions.create(completionOptions);
  let producedContent = false;

  for await (const chunk of stream) {
    const content = extractTextFromStreamChunk(chunk);
    if (content) {
      producedContent = true;
      yield content;
    }
  }

  if (!producedContent) {
    throw new Error(`OpenAI stream returned no content for model: ${model}`);
  }
}

/**
 * Generate response using OpenRouter
 */
async function generateOpenRouterResponse({ model, messages, temperature, maxTokens, jsonMode = false }) {
  const openRouter = getOpenRouterClient();
  
  // Add :nitro suffix to the model name for OpenRouter models
  const modelWithNitro = model.includes(':') ? model : `${model}:nitro`;
  
  logger.info('OpenRouter', `Using model: ${modelWithNitro} with effort: low`);
  
  const completionOptions = {
    model: modelWithNitro,
    messages,
    temperature,
    max_tokens: maxTokens,
    // Add effort parameter for OpenRouter optimization
    effort: 'low'
  };
  
  // Add JSON mode if requested
  if (jsonMode) {
    completionOptions.response_format = { type: 'json_object' };
  }
  
  const completion = await openRouter.chat.completions.create(completionOptions);
  
  return {
    content: completion.choices[0].message.content,
    usage: completion.usage,
    finishReason: completion.choices[0].finish_reason
  };
}

/**
 * Generate response using Google Gemini
 */
async function generateGoogleResponse({ model, messages, temperature, maxTokens, jsonMode = false }) {
  const genAI = getGenAI();
  const geminiModel = genAI.getGenerativeModel({ model });
  
  // Convert messages to Gemini format
  const systemMessage = messages.find(m => m.role === 'system');
  const userMessages = messages.filter(m => m.role !== 'system');
  
  // Combine system message with user messages
  let prompt = '';
  if (systemMessage) {
    let systemContent = systemMessage.content;
    // Add JSON instruction if needed
    if (jsonMode) {
      systemContent += '\n\nIMPORTANT: You MUST respond with valid JSON format only.';
    }
    prompt = `System: ${systemContent}\n\n`;
  }
  
  // Add conversation history
  userMessages.forEach(msg => {
    if (msg.role === 'user') {
      prompt += `User: ${msg.content}\n\n`;
    } else if (msg.role === 'assistant') {
      prompt += `Assistant: ${msg.content}\n\n`;
    }
  });
  
  const result = await geminiModel.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature,
      maxOutputTokens: maxTokens,
    },
  });
  
  const response = await result.response;
  
  return {
    content: response.text(),
    usage: {
      // Gemini doesn't provide token counts in the same way
      prompt_tokens: null,
      completion_tokens: null,
      total_tokens: null
    },
    finishReason: response.candidates[0]?.finishReason || 'stop'
  };
}

/**
 * Test a specific model
 */
export async function testModel({ provider, modelName, testPrompt = 'Hello, please respond with "Test successful".' }) {
  try {
    const response = await generateAIResponse({
      feature: 'test',
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: testPrompt }
      ],
      temperature: 0.7,
      maxTokens: 100,
      overrideModel: {
        provider,
        model_name: modelName,
        display_name: `${provider}/${modelName}`,
        max_tokens: 100,
        temperature: 0.7
      }
    });
    
    return {
      success: true,
      response: response.content,
      provider,
      modelName
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      provider,
      modelName
    };
  }
}

export default {
  generateAIResponse,
  generateOpenAIStreamingResponse,
  testModel
};