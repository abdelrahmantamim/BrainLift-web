import { validate } from '../middleware/validate.js';
import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { getOpenAI, getSupabase, getGenAI } from '../config/services.config.js';
import { getModelConfig } from '../utils/modelConfig.js';
import { generateAIResponse, generateOpenAIStreamingResponse } from '../services/ai/unifiedAIService.js';
import { checkSubscriptionLimit } from '../middleware/subscriptionLimits.middleware.js';
import { chatStreamErrorEvent, shouldRetryChatStream } from '../utils/chatStreamRecovery.js';
import { getTokenParameter, getTemperature } from '../utils/helpers.js';
import { formatAIResponse, parseTextFormatting } from '../utils/textFormatter.js';
import { sessionCache, cacheKeys } from '../utils/sessionCache.js';
import { saveChatMessagesWithRetry } from '../utils/chatSave.js';
import { userChatLimiter } from '../middleware/rateLimiter.middleware.js';
import { isSimpleGreeting, getCachedGreeting, isSimpleMath, evaluateSimpleMath } from '../utils/greetingCache.js';
// Combined response handler removed - titles are now generated separately
// import { createCombinedSystemPrompt, parseCombinedResponse } from '../utils/combinedResponseHandler.js';
import semanticCache from '../utils/semanticCache.js';
import { getBasePrompt, getMinimalPrompt, getChartAddition } from '../prompts/basePrompt.js';
import { detectChartTypes } from '../prompts/chartSpecifications.js';
import { createRequire } from 'module';
import { sendMessageSchema, processFilesSchema } from '../schemas/chat.schemas.js';

const require = createRequire(import.meta.url);
const fileProcessor = require('../services/fileProcessor.cjs');
const chatResponseEnhancer = require('../services/chatResponseEnhancer.cjs');

const router = express.Router();

// Simple in-memory cache for image analysis results
const imageAnalysisCache = new Map();

// In-memory storage for conversations (fallback)
const userConversations = {};

// Auth middleware is already applied at the server level before this router
// router.use(authMiddleware); // Removed to prevent overriding req.userId

// Chat endpoint with user-specific rate limiting
router.post('/message', userChatLimiter, validate(sendMessageSchema), checkSubscriptionLimit('chat'), async (req, res) => {
  const startTime = Date.now();
  const timings = {};
  
  let isNewSession = false; // Declare here so it's accessible throughout the handler
  
  try {
    const { message, fileContext, conversationId, aiResponseStyle } = req.body;
    isNewSession = !conversationId; // Set the value here
    
    console.log('[Chat] Received message request:', { 
      hasMessage: !!message, 
      hasFileContext: !!fileContext, 
      conversationId,
      userId: req.userId,
      aiResponseStyle: aiResponseStyle || 'not provided'
    });
    
    if (!message) {
      return res.status(400).json({ error: { message: 'Message is required' } });
    }
    
    const supabase = getSupabase();
    const openai = getOpenAI();
    const genAI = getGenAI();
    const modelConfig = getModelConfig();
    
    // Get user ID
    const userId = req.userId;
    if (!userId) return res.status(401).json({ error: { message: 'Unauthorized' } });
    const userIdForConversation = userId;
    
    // We'll use the provided conversationId or let the database generate one
    let convId = conversationId;
    
    console.log('[Chat] Using conversation ID:', convId, 'for user:', userIdForConversation);
    
    // Get conversation history if conversationId exists
    let conversationHistory = [];
    if (conversationId) {
      timings.historyStart = Date.now() - startTime;
      
      // Skip history for invalid conversation IDs
      if (conversationId === 'null' || conversationId === 'undefined') {
        console.log('[Chat] Skipping history fetch for invalid conversationId:', conversationId);
        timings.historySkipped = true;
      } else {
        // Try to use optimized function first
        const { data: previousMessages, error: historyError } = await supabase
          .rpc('get_conversation_messages', {
            p_conversation_id: conversationId,
            p_user_id: userId,
            p_limit: 20
          });
      
      if (!historyError && previousMessages) {
        // Messages are returned in DESC order, reverse for chronological
        conversationHistory = previousMessages.reverse();
        console.log('[Chat] Found', previousMessages.length, 'previous messages in conversation');
      } else {
        // Fallback to original query if function doesn't exist
        console.log('Using fallback conversation history query');
        const { data: fallbackMessages, error: fallbackError } = await supabase
          .from('chat_conversations')
          .select('id, session_id, role, content, created_at')
          .eq('session_id', conversationId)
          .order('created_at', { ascending: false })
          .limit(20);

        if (!fallbackError && fallbackMessages) {
          // Reverse back to chronological order
          conversationHistory = fallbackMessages.reverse();
          console.log('[Chat] Found', conversationHistory.length, 'previous messages in conversation (fallback)');
        }
      }
      }
      timings.historyEnd = Date.now() - startTime;
    }
    
    let contextualMessage = message;
    let fileChunks = [];
    
    // Process file context if provided
    if (fileContext && (fileContext.id || fileContext.files)) {
      console.log('Received fileContext:', JSON.stringify(fileContext, null, 2));
      try {
        // Handle multiple files, folders, or single files
        if (fileContext.type === 'multiple' && fileContext.files) {
          console.log(`Processing multiple files context: ${fileContext.files.length} files`);
          
          const allChunks = [];
          const fileIds = fileContext.files.map(f => f.id);
          
          // Try to use optimized batch query
          const { data: fileChunksData, error: batchError } = await supabase
            .rpc('get_chat_file_chunks', {
              p_file_ids: fileIds,
              p_chunk_limit: 10
            });
          
          if (!batchError && fileChunksData) {
            // Process optimized results
            for (const fileData of fileChunksData) {
              const file = fileContext.files.find(f => f.id === fileData.file_id);
              if (fileData.chunks && Array.isArray(fileData.chunks)) {
                allChunks.push(...fileData.chunks.map(chunk => ({
                  id: `${fileData.file_id}-${chunk.index}`,
                  content: chunk.content,
                  chunk_index: chunk.index,
                  fileName: file?.name || fileData.file_name
                })));
              }
            }
          } else {
            // Fallback to individual queries
            console.log('Using fallback file chunk queries');
            for (const file of fileContext.files) {
              const { data: chunks, error: chunksError } = await supabase
                .from('file_chunks')
                .select('id, content, chunk_index, metadata')
                .eq('file_id', file.id)
                .order('chunk_index', { ascending: true });

              if (!chunksError && chunks && chunks.length > 0) {
                allChunks.push(...chunks.map(c => ({
                  ...c,
                  fileName: file.name
                })));
              }
            }
          }

          if (allChunks.length > 0) {
            console.log(`Found ${allChunks.length} total chunks from ${fileContext.files.length} files`);
            const relevantChunks = fileProcessor.findRelevantChunks(
              allChunks.map(c => ({ id: c.id, content: c.content, metadata: { ...c.metadata, fileName: c.fileName } })),
              message,
              5
            );
            
            if (relevantChunks.length > 0) {
              const chunkContent = relevantChunks.map(c => 
                `[From: ${c.metadata?.fileName || 'Unknown file'}]\n${c.content}`
              ).join('\n\n---\n\n');
              contextualMessage = `[Multiple Files: ${fileContext.files.map(f => f.name).join(', ')}]\n\nRelevant content from the files:\n\n${chunkContent}\n\n---\n\nUser question: ${message}`;
            } else {
              contextualMessage = `[Multiple Files: ${fileContext.files.map(f => f.name).join(', ')}]\n\nI have access to the content from these files, but couldn't find specific sections related to your question. Please ask a more specific question about the materials.\n\nUser question: ${message}`;
            }
          } else {
            contextualMessage = `[Multiple Files: ${fileContext.files.map(f => f.name).join(', ')}]\n\nNote: The files haven't been fully processed yet.\n\nUser question: ${message}`;
          }
        } else if (fileContext.type === 'folder' && fileContext.processedFiles) {
          // Handle folder context
          console.log(`Processing folder context: ${fileContext.name} with ${fileContext.fileCount} files`);
          
          const allChunks = [];
          // Get IDs of processed files
          const processedFileIds = fileContext.processedFiles
            .filter(f => f.status === 'processed' || f.status === 'already_processed')
            .map(f => f.id);
          
          if (processedFileIds.length > 0) {
            // Try to use optimized batch query
            const { data: fileChunksData, error: batchError } = await supabase
              .rpc('get_chat_file_chunks', {
                p_file_ids: processedFileIds,
                p_chunk_limit: 10
              });
            
            if (!batchError && fileChunksData) {
              // Process optimized results
              for (const fileData of fileChunksData) {
                const file = fileContext.processedFiles.find(f => f.id === fileData.file_id);
                if (fileData.chunks && Array.isArray(fileData.chunks)) {
                  allChunks.push(...fileData.chunks.map(chunk => ({
                    id: `${fileData.file_id}-${chunk.index}`,
                    content: chunk.content,
                    chunk_index: chunk.index,
                    fileName: file?.name || fileData.file_name
                  })));
                }
              }
            } else {
              // Fallback to individual queries
              console.log('Using fallback folder chunk queries');
              for (const file of fileContext.processedFiles) {
                if (file.status === 'processed' || file.status === 'already_processed') {
                  const { data: chunks, error: chunksError } = await supabase
                    .from('file_chunks')
                    .select('id, content, chunk_index, metadata')
                    .eq('file_id', file.id)
                    .order('chunk_index', { ascending: true });

                  if (!chunksError && chunks && chunks.length > 0) {
                    allChunks.push(...chunks.map(c => ({
                      ...c,
                      fileName: file.name
                    })));
                  }
                }
              }
            }
          }

          if (allChunks.length > 0) {
            console.log(`Found ${allChunks.length} total chunks from folder ${fileContext.id}`);
            const relevantChunks = fileProcessor.findRelevantChunks(
              allChunks.map(c => ({ id: c.id, content: c.content, metadata: { ...c.metadata, fileName: c.fileName } })),
              message,
              5
            );
            
            if (relevantChunks.length > 0) {
              const chunkContent = relevantChunks.map(c => 
                `[From: ${c.metadata?.fileName || 'Unknown file'}]\n${c.content}`
              ).join('\n\n---\n\n');
              contextualMessage = `[Folder: ${fileContext.name}]\n\nRelevant content from the folder files:\n\n${chunkContent}\n\n---\n\nUser question: ${message}`;
            } else {
              contextualMessage = `[Folder: ${fileContext.name}]\n\nThis folder contains ${fileContext.fileCount} files. I have access to their content, but couldn't find specific sections related to your question. Please ask a more specific question about the materials in this folder.\n\nUser question: ${message}`;
            }
          } else {
            contextualMessage = `[Folder: ${fileContext.name}]\n\nNote: The files in this folder haven't been fully processed yet. The folder contains ${fileContext.fileCount} files.\n\nUser question: ${message}`;
          }
        } else {
          // Regular file processing
          console.log(`[Chat] Looking for chunks for file ${fileContext.id}, user ${userId}`);
          let chunks = [];
          let chunksError = null;
          let actualFileId = fileContext.id;
          
          // First try with the provided file ID
          const result = await supabase
            .from('file_chunks')
            .select('id, content, chunk_index, metadata')
            .eq('file_id', fileContext.id)
            .order('chunk_index', { ascending: true });
          
          chunks = result.data || [];
          chunksError = result.error;
          
          // If no chunks found, try to find another file with same name that has chunks
          if (chunks.length === 0) {
            console.log(`No chunks found for file ${fileContext.id}, looking for alternative files`);
            
            const { data: alternativeFiles } = await supabase
              .from('files')
              .select('id')
              .eq('user_id', userId)
              .eq('name', fileContext.name)
              .neq('id', fileContext.id);
            
            if (alternativeFiles && alternativeFiles.length > 0) {
              for (const altFile of alternativeFiles) {
                const { data: altChunks } = await supabase
                  .from('file_chunks')
                  .select('id, content, chunk_index, metadata')
                  .eq('file_id', altFile.id)
                  .order('chunk_index', { ascending: true });
                
                if (altChunks && altChunks.length > 0) {
                  console.log(`Found ${altChunks.length} chunks in alternative file ${altFile.id}`);
                  chunks = altChunks;
                  actualFileId = altFile.id;
                  break;
                }
              }
            }
          }
          
          if (!chunksError && chunks && chunks.length > 0) {
            console.log(`Using ${chunks.length} chunks from file ${actualFileId}`);
            console.log(`Found ${chunks.length} chunks for file ${fileContext.id}`);
            const relevantChunks = fileProcessor.findRelevantChunks(
              chunks.map(c => ({ id: c.id, content: c.content, metadata: c.metadata })),
              message,
              3
            );
            
            fileChunks = chunks.map(c => ({ 
              id: c.id, 
              content: c.content, 
              metadata: c.metadata 
            }));
            
            if (relevantChunks.length > 0) {
              const chunkContent = relevantChunks.map(c => c.content).join('\n\n---\n\n');
              contextualMessage = `[File: ${fileContext.name}]\n\nRelevant content from the file:\n\n${chunkContent}\n\n---\n\nUser question: ${message}`;
            } else {
              // Check if it's an image
              const firstChunk = chunks[0];
              let isImageFile = false;
              try {
                const parsedContent = JSON.parse(firstChunk.content);
                if (parsedContent.type === 'image') {
                  isImageFile = true;
                }
              } catch (e) {
                // Not JSON, so not an image
              }
              
              if (isImageFile) {
                contextualMessage = `[Image: ${fileContext.name}]\n\nUser question: ${message}`;
              } else {
                contextualMessage = `[File: ${fileContext.name}]\n\nFile content (beginning):\n\n${firstChunk.content.substring(0, 1000)}...\n\n---\n\nUser question: ${message}`;
              }
            }
          } else {
            console.log(`No chunks found for file ${fileContext.id}`);
            // Let's also check if there's any file with this ID
            const { data: fileCheck, error: fileCheckError } = await supabase
              .from('files')
              .select('id, name, uploaded_at')
              .eq('id', fileContext.id)
              .single();
            
            if (fileCheckError || !fileCheck) {
              console.log(`File ${fileContext.id} not found in database!`);
              console.log('File check error:', fileCheckError);
              
              // Let's search for files with similar name
              const decodedName = decodeURIComponent(fileContext.name);
              // Sanitize the filename to prevent SQL injection
              const sanitizedName = decodedName.substring(0, 20)
                .replace(/[%_\\]/g, '\\$&') // Escape SQL wildcards
                .replace(/'/g, "''"); // Escape single quotes
              
              const { data: similarFiles } = await supabase
                .from('files')
                .select('id, name, user_id, uploaded_at')
                .eq('user_id', userId)
                .ilike('name', `%${sanitizedName}%`)
                .order('uploaded_at', { ascending: false })
                .limit(5);
              
              console.log(`Similar files for user ${userId}:`, similarFiles);
            } else {
              console.log(`File exists in DB:`, fileCheck);
              // Check chunk count
              const { count } = await supabase
                .from('file_chunks')
                .select('*', { count: 'exact', head: true })
                .eq('file_id', fileContext.id);
              console.log(`Chunk count for file ${fileContext.id}: ${count}`);
              
              // If no chunks, let's check for files with same name that might have chunks
              if (count === 0) {
                const decodedName = decodeURIComponent(fileContext.name);
                const { data: filesWithSameName } = await supabase
                  .from('files')
                  .select('id, name, uploaded_at')
                  .eq('user_id', userId)
                  .eq('name', fileContext.name) // Exact match with encoded name
                  .order('uploaded_at', { ascending: false });
                
                console.log(`Files with same name for user ${userId}:`, filesWithSameName);
                
                // Check which files have chunks
                if (filesWithSameName && filesWithSameName.length > 0) {
                  for (const file of filesWithSameName) {
                    const { count: fileChunkCount } = await supabase
                      .from('file_chunks')
                      .select('*', { count: 'exact', head: true })
                      .eq('file_id', file.id);
                    console.log(`File ${file.id} (uploaded: ${file.uploaded_at}) has ${fileChunkCount} chunks`);
                  }
                }
              }
            }
            
            contextualMessage = `[File: ${fileContext.name}]\n\nNote: This file hasn't been processed yet.\n\nUser question: ${message}`;
          }
        }
      } catch (error) {
        console.error('Error fetching file chunks:', error);
        contextualMessage = `[File/Folder: ${fileContext.name}]\n\nUser question: ${message}`;
      }
    }

    let response;
    
    // Check if this is a simple greeting we can respond to instantly
    if (!fileContext && !conversationId && isSimpleGreeting(message)) {
      response = getCachedGreeting(message);
      console.log('[Chat] Using cached greeting response');
      timings.cachedResponse = Date.now() - startTime;
    } 
    // Check if this is a simple math expression we can evaluate instantly
    else if (!fileContext && isSimpleMath(message)) {
      response = evaluateSimpleMath(message);
      console.log('[Chat] Using cached math evaluation:', response);
      timings.cachedResponse = Date.now() - startTime;
    } else {
      timings.aiStart = Date.now() - startTime;
      
      // Declare activeModel outside try block so it's accessible in catch
      let activeModel = null;
      
      try {
      // Check if we have image content to process
      let hasImageContent = false;
      let imageMessages = [];
      
      // Check if any chunks contain image data
      if (fileChunks && fileChunks.length > 0) {
        console.log(`Processing ${fileChunks.length} chunks for potential images`);
        
        // Images are now processed with advanced analysis immediately on upload
        // No need for reprocessing
        
        for (const chunk of fileChunks) {
          let isImageChunk = false;
          
          if (chunk.metadata && chunk.metadata.type === 'image') {
            isImageChunk = true;
          } else {
            try {
              const parsedContent = JSON.parse(chunk.content);
              if (parsedContent.type === 'image' && parsedContent.base64) {
                isImageChunk = true;
              }
            } catch (e) {
              // Not JSON image data
            }
          }
          
          if (isImageChunk) {
            try {
              const imageData = JSON.parse(chunk.content);
              console.log(`Found image chunk for file: ${imageData.fileName}`);
              console.log(`Image MIME type: ${imageData.mimeType}`);
              hasImageContent = true;
              
              // Prepare text content with OCR data and advanced analysis
              let textContent = `Analyzing image: ${imageData.fileName}`;
              
              // Include advanced analysis if available
              if (imageData.advancedAnalysis) {
                const analysis = imageData.advancedAnalysis;
                
                if (analysis.contentType) {
                  textContent += `\n\n[Image Content Type: ${analysis.contentType}]`;
                }
                
                if (analysis.exercise) {
                  textContent += `\n\n[Educational Exercise Detected:]`;
                  textContent += `\nQuestion #${analysis.exercise.questionNumber || 'N/A'}`;
                  textContent += `\nType: ${analysis.exercise.problemType || 'general'}`;
                  if (analysis.exercise.questionText) {
                    textContent += `\nQuestion: ${analysis.exercise.questionText}`;
                  }
                  if (analysis.exercise.instructions) {
                    textContent += `\nInstructions: ${analysis.exercise.instructions}`;
                  }
                }
                
                if (analysis.tableData) {
                  textContent += `\n\n[Table Data Extracted:]`;
                  textContent += `\nHeaders: ${analysis.tableData.headers.join(', ')}`;
                  textContent += `\nRows: ${analysis.tableData.rows.length}`;
                  // Include formatted table
                  if (analysis.tableData.formattedText) {
                    textContent += `\n${analysis.tableData.formattedText}`;
                  }
                }
                
                if (analysis.mathContent) {
                  textContent += `\n\n[Mathematical Content:]`;
                  textContent += `\n${analysis.mathContent}`;
                }
                
                if (analysis.chartData) {
                  textContent += `\n\n[Chart Data:]`;
                  textContent += `\nType: ${analysis.chartData.type}`;
                  if (analysis.chartData.data) {
                    textContent += `\nData points: ${JSON.stringify(analysis.chartData.data)}`;
                  }
                }
              }
              
              if (imageData.ocrData && imageData.ocrData.text) {
                textContent += `\n\n[OCR Text Extraction:]`;
                textContent += `\nLanguage: ${imageData.ocrData.language || 'unknown'}`;
                textContent += `\nConfidence: ${imageData.ocrData.confidence || 0}%`;
                textContent += `\nText:\n${imageData.ocrData.text}`;
              } else if (imageData.rawText) {
                textContent += `\n\n[Raw Text:]\n${imageData.rawText}`;
              }
              
              textContent += `\n\nUser question: ${message}`;
              
              imageMessages.push({
                role: "user",
                content: [
                  {
                    type: "text",
                    text: textContent
                  },
                  {
                    type: "image_url",
                    image_url: {
                      url: `data:${imageData.mimeType || 'image/jpeg'};base64,${imageData.base64}`,
                      detail: "low"
                    }
                  }
                ]
              });
            } catch (e) {
              console.error('Error parsing image data:', e);
            }
          }
        }
      }
      
      // Use configured model or fallback to default
      timings.modelConfigLoaded = Date.now() - startTime;
      activeModel = modelConfig.chat || { 
        provider: 'openai', 
        model_name: 'gpt-4.1-nano-2025-04-14',
        api_endpoint: 'https://api.openai.com/v1/chat/completions'
      };
      
      console.log(`Using ${activeModel.provider} model: ${activeModel.model_name} for chat`);
      
      // Use AI response style from request or default to 'detailed'
      const finalAiResponseStyle = aiResponseStyle === 'concise' ? 'simple' : (aiResponseStyle || 'detailed');
      console.log('[Chat] Using AI response style:', finalAiResponseStyle);
      
      let profile = null; // Define profile for language detection
      // Only fetch profile if we need language preferences
      const skipPreferenceFetch = !fileContext && message.length < 50;
      
      if (req.userId && !skipPreferenceFetch) {
        try {
          timings.prefFetchStart = Date.now() - startTime;
          const { data: profileData } = await supabase
            .from('profiles')
            .select('preferences')
            .eq('id', req.userId)
            .single();
          
          profile = profileData; // Assign to outer scope variable
          timings.prefFetchEnd = Date.now() - startTime;
        } catch (error) {
          console.error('Error fetching user preferences for language:', error);
        }
      }
      
      // Detect the language of the user's message
      const detectLanguage = (text) => {
        // Simple language detection based on character patterns
        const arabicPattern = /[\u0600-\u06FF]/;
        const chinesePattern = /[\u4E00-\u9FFF]/;
        const japanesePattern = /[\u3040-\u309F\u30A0-\u30FF]/;
        const koreanPattern = /[\uAC00-\uD7AF]/;
        const cyrillicPattern = /[\u0400-\u04FF]/;
        
        // First check for non-Latin scripts
        if (arabicPattern.test(text)) return 'Arabic';
        if (chinesePattern.test(text)) return 'Chinese';
        if (japanesePattern.test(text)) return 'Japanese';
        if (koreanPattern.test(text)) return 'Korean';
        if (cyrillicPattern.test(text)) return 'Russian';
        
        // For Latin-based languages, count indicators and require multiple matches
        // This prevents false positives from single common words
        
        // Common Spanish words/patterns (excluding words that overlap with English)
        const spanishIndicators = /\b(está|qué|cómo|muéstrame|diagrama|ayuda|necesito|quiero|hacer|crear|para mí|español)\b/i;
        const spanishCount = (text.match(spanishIndicators) || []).length;
        
        // Common French words/patterns (more specific to avoid false positives)
        const frenchIndicators = /\b(avec|comment|montrez-moi|besoin|veux|faire|créer|français|s'il vous plaît)\b/i;
        const frenchCount = (text.match(frenchIndicators) || []).length;
        
        // Common German words/patterns
        const germanIndicators = /\b(der|die|das|und|ist|für|mit|wie|zeig|hilfe|brauche|möchte|machen|erstellen|deutsch)\b/i;
        const germanCount = (text.match(germanIndicators) || []).length;
        
        // Strong English indicators
        const englishIndicators = /\b(the|is|are|have|has|been|was|were|will|would|could|should|create|make|show|help|need|want|please|chart|diagram|process|start|end|check|if|yes|no|then|coffee|beans|water|machine|brew|pour|cups)\b/i;
        const englishCount = (text.match(englishIndicators) || []).length;
        
        // Require at least 2 indicators for non-English languages
        // and ensure English doesn't have more indicators
        if (spanishCount >= 2 && spanishCount > englishCount) return 'Spanish';
        if (frenchCount >= 2 && frenchCount > englishCount) return 'French';
        if (germanCount >= 2 && germanCount > englishCount) return 'German';
        
        // Default to English
        return 'English';
      };
      
      // Check for user's preferred language from profile preferences
      let preferredLanguage = null;
      if (profile?.preferences?.language) {
        preferredLanguage = profile.preferences.language;
        console.log('[Chat] User has language preference:', preferredLanguage);
      }
      
      // Skip language detection for very short messages
      let detectedLanguage = message.length < 10 ? 'English' : detectLanguage(message);
      
      // Log language detection details for debugging
      if (message.length >= 10) {
        console.log('[Chat] Message for language detection:', message.substring(0, 100));
        console.log('[Chat] Detected language:', detectedLanguage);
        
        // Additional check: if the message contains mostly English words about technical topics,
        // override to English regardless of what was detected
        const technicalEnglishPattern = /\b(create|make|chart|diagram|flow|process|start|end|check|if|then|else|yes|no|coffee|beans|water|machine|brew|pour|code|function|variable|array|object|loop|condition)\b/i;
        const technicalMatches = (message.match(technicalEnglishPattern) || []).length;
        
        if (technicalMatches >= 3 && detectedLanguage !== 'English') {
          console.log(`[Chat] Overriding language from ${detectedLanguage} to English due to technical content`);
          detectedLanguage = 'English';
        }
      }
      
      // Use preferred language if set, otherwise use detected language
      const userLanguage = preferredLanguage || detectedLanguage;
      console.log('[Chat] Final language for response:', userLanguage);
      
      // For simple math or very short questions, use a minimal system prompt
      const isSimpleQuery = message.length < 20 && !fileContext && !conversationHistory.length;
      
      // Detect if user is asking about specific chart types for dynamic loading
      const detectedChartTypes = detectChartTypes(contextualMessage || message);
      const chartAdditions = await getChartAddition(detectedChartTypes);
      
      if (detectedChartTypes.length > 0) {
        console.log('[Chat] Detected chart types:', detectedChartTypes);
        console.log('[Chat] Prompt size before chart additions:', getBasePrompt(userLanguage).length, 'chars');
        console.log('[Chat] Prompt size after chart additions:', (getBasePrompt(userLanguage) + chartAdditions).length, 'chars');
      }
      
      // Prepare messages with enhanced multilingual and conversational capabilities
      const responseStyleInstructions = finalAiResponseStyle === 'simple'
        ? `\n\n**Response Style**: Get straight to the point. Use short sentences and everyday words. Avoid jargon and complex vocabulary. Keep responses brief — 2-4 sentences for simple questions, a short paragraph max for complex topics. Use bullet points when listing multiple items. Only elaborate if the user asks for more detail.`
        : `\n\n**Response Style**: You should provide DETAILED and COMPREHENSIVE responses. Include relevant context, examples, and thorough explanations to help the student fully understand the topic. Break down complex concepts into digestible parts. Feel free to use structured formatting with headings, bullet points, and numbered lists when it helps clarity.`;
      
      // Use optimized base prompt
      const baseSystemMessage = getBasePrompt(userLanguage) + responseStyleInstructions + chartAdditions;

      let systemMessage = hasImageContent ? 
        `${baseSystemMessage}

7. **Image Analysis**: When analyzing images, describe what you see clearly and help the student understand the content. If OCR text is provided, use it to give more accurate answers about the image content. Always acknowledge when you're working with extracted text from an image.` :
        `${baseSystemMessage}

7. **File Content Analysis**: When the user provides file content, analyze it carefully and answer questions based on that content. Be concise and clear in your responses. If you're referencing specific parts of a file, quote them when relevant.`;
      
      // Override with minimal prompt for simple queries to improve speed
      if (isSimpleQuery) {
        systemMessage = getMinimalPrompt(userLanguage);
        console.log('[Chat] Using minimal system prompt for simple query');
      }
      
      // Check if this is a new conversation (title will be generated separately)
      const isNewConversation = !conversationId && message.length > 10;
      
      // Initialize response variable
      // Use the outer response variable, don't redeclare
      response = '';
      
      // Handle different providers
      if (activeModel.provider === 'google' && genAI) {
        // Use Google Gemini
        const model = genAI.getGenerativeModel({ model: activeModel.model_name });
        
        let prompt = systemMessage + "\n\n";
        
        // Add conversation history
        if (conversationHistory.length > 0) {
          prompt += "Previous conversation:\n";
          for (const msg of conversationHistory) {
            prompt += `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}\n`;
          }
          prompt += "\n";
        }
        
        if (hasImageContent && imageMessages.length > 0) {
          prompt += imageMessages[0].content[0].text;
          prompt += "\n\n[Note: Image analysis not yet implemented for Gemini]";
        } else {
          prompt += `User: ${contextualMessage}`;
        }
        
        const result = await model.generateContent(prompt);
        response = result.response.text();
        
      } else {
        // Use unified AI service for all other providers (including OpenAI and OpenRouter)
        // Build messages array with conversation history
        const messages = [
          { role: "system", content: systemMessage }
        ];
        
        // Add conversation history
        for (const msg of conversationHistory) {
          messages.push({
            role: msg.role,
            content: msg.content
          });
        }
        
        // Add current message
        if (hasImageContent) {
          messages.push(...imageMessages);
        } else {
          messages.push({ role: "user", content: contextualMessage });
        }
        
        try {
          timings.openAIStart = Date.now() - startTime;
          
          // Check semantic cache first for non-image queries
          if (!hasImageContent && !fileChunks.length) {
            const cachedResponse = semanticCache.get(message, activeModel.model_name, userId, userLanguage, finalAiResponseStyle);
            if (cachedResponse) {
              response = cachedResponse;
              timings.cacheHit = true;
              timings.openAIEnd = Date.now() - startTime;
              console.log('[Chat] Using semantically cached response');
            }
          }
          
          if (!response) {
            // Use unified AI service
            const context = {
              hasImages: hasImageContent,
              hasFiles: fileChunks.length > 0,
              hasCode: contextualMessage.includes('```') || contextualMessage.includes('function') || contextualMessage.includes('class'),
              isSimpleQuery: isSimpleQuery
            };
            
            console.log('[Chat] AI request:', {
              provider: activeModel.provider,
              model: activeModel.model_name,
              messageCount: messages.length,
              systemMessageLength: messages[0].content.length,
              userMessageLength: messages[messages.length - 1].content.length
            });
            
            const aiResponse = await generateAIResponse({
              feature: 'chat',
              messages: messages,
              temperature: getTemperature(activeModel.model_name),
              maxTokens: context.hasImages || context.hasFiles ? 3000 : (context.isSimpleQuery ? 300 : 1200)
            });
            
            timings.openAIEnd = Date.now() - startTime;
            response = aiResponse.content;
            
            // Cache the response for future use
            if (!hasImageContent && !fileChunks.length && response) {
              semanticCache.set(message, activeModel.model_name, userId, response, userLanguage, finalAiResponseStyle);
            }
          }
          
          // Title generation is now non-blocking - done after response is sent
          // See generateTitleAsync below
          
          console.log('[Chat] AI response received:', {
            provider: activeModel.provider,
            model: activeModel.model_name,
            length: response?.length || 0,
            type: typeof response
          });
        } catch (error) {
          console.error(`Failed to use model ${activeModel.model_name}:`, error.message);
          // The unified AI service already handles fallback internally
          throw error;
        }
      }
      
    } catch (error) {
      console.error('AI provider error:', error);
      console.error('Provider details:', {
        provider: activeModel?.provider || 'unknown',
        model: activeModel?.model_name || 'unknown',
        hasOpenAIKey: !!process.env.OPENAI_API_KEY,
        openAIKeyLength: process.env.OPENAI_API_KEY?.length || 0,
        hasGoogleKey: !!process.env.GOOGLE_API_KEY,
        errorMessage: error.message,
        errorResponse: error.response?.data || 'No response data',
        errorStatus: error.response?.status || 'No status'
      });
      
      // Don't use mock response - throw the error to see what's happening
      throw error;
    }
    
    if (!response || !response.trim()) {
      console.error('[Chat] CRITICAL: No valid response generated!', {
        responseValue: response,
        responseType: typeof response,
        isNull: response === null,
        isUndefined: response === undefined,
        isEmpty: response === '',
        isWhitespace: response && !response.trim(),
        modelUsed: activeModel?.model_name || 'unknown'
      });
      
      // Return error instead of mock response
      return res.status(500).json({ 
        error: { 
          message: 'Failed to generate a valid response. Please try again.',
          code: 'INVALID_AI_RESPONSE'
        } 
      });
    }
    
    console.log('[Chat] Final response ready, length:', response?.length || 0);
    timings.aiComplete = Date.now() - startTime;
    } // Close the else block for non-cached responses

    // Save conversation to database
    try {
      timings.dbSaveStart = Date.now() - startTime;
      // Try to find existing session or create new one
      let session;
      
      if (convId) {
        // Try to find existing session
        const { data: existingSession, error: sessionError } = await supabase
          .from('study_sessions')
          .select('id')
          .eq('id', convId)
          .eq('user_id', userIdForConversation)
          .single();
        
        session = existingSession;
      }
      
      if (!session) {
        // Create new study session
        console.log('[Chat] Creating new study session');
        const { data: newSession, error: createError } = await supabase
          .from('study_sessions')
          .insert([{
            user_id: userIdForConversation,
            title: 'New Chat Session',
            subject: 'General',
            created_at: new Date().toISOString()
          }])
          .select('id')
          .single();

        // Update convId with the actual ID from database
        if (newSession) {
          convId = newSession.id;
          session = newSession;
          console.log('[Chat] Created new session with ID:', convId);
        }

        if (createError) {
          console.error('Error creating session:', createError);
          console.error('Full error details:', JSON.stringify(createError, null, 2));
          
          // If we can't create a session, we can't save the conversation
          // Return an error response
          return res.status(500).json({ 
            error: { 
              message: 'Failed to create chat session. Please try again.',
              details: createError.message 
            } 
          });
        } else {
          console.log('[Chat] Successfully created session:', newSession?.id);
        }
      }
      
      // Save messages to chat_conversations table
      const userMessageId = uuidv4();
      const assistantMessageId = uuidv4();
      
      // Ensure we have a valid session ID
      if (!convId) {
        console.error('[Chat] No conversation ID available, cannot save messages');
        console.error('[Chat] Session:', session);
        console.error('[Chat] Initial conversationId:', conversationId);
        // Still return the response to the user
        return res.json({ 
          response: response || finalMessage,
          message: finalMessage,
          conversationId: null,
          messageId: assistantMessageId
        });
      }
      
      console.log('[Chat] Saving messages with:', {
        user_id: userIdForConversation,
        session_id: convId,
        messageCount: 2,
        messageLength: message?.length,
        responseLength: response?.length,
        hasResponse: !!response
      });
      
      const userTimestamp = new Date();
      const assistantTimestamp = new Date(userTimestamp.getTime() + 1000); // 1s later to ensure correct ordering
      const messagesToInsert = [
        {
          id: uuidv4(), // Add explicit ID
          user_id: userIdForConversation,
          session_id: convId,
          message_id: userMessageId,
          role: 'user',
          content: message,
          created_at: userTimestamp.toISOString()
        },
        {
          id: uuidv4(), // Add explicit ID
          user_id: userIdForConversation,
          session_id: convId,
          message_id: assistantMessageId,
          role: 'assistant',
          content: response,
          created_at: assistantTimestamp.toISOString()
        }
      ];
      
      console.log('[Chat] Messages to insert:', JSON.stringify(messagesToInsert, null, 2));
      
      const { error: msgError } = await supabase
        .from('chat_conversations')
        .insert(messagesToInsert);
      
      if (msgError) {
        console.error('Error saving messages:', msgError);
        console.error('Full message error details:', JSON.stringify(msgError, null, 2));
      } else {
        console.log('[Chat] Successfully saved messages for conversation:', convId);
        console.log('[Chat] Messages inserted successfully');
        // Invalidate caches for this conversation
        sessionCache.invalidate(cacheKeys.sessionDetail(convId));
        sessionCache.invalidate(cacheKeys.sessionMessages(convId, 1)); // Invalidate first page
        sessionCache.invalidateUser(userIdForConversation); // Invalidate user's session list
      }
      
      // Auto-generate title for new conversations (async - don't block response)
      // isNewSession is already defined at the top of the handler
      if (isNewSession && message.length > 10 && convId) {
        // Generate title asynchronously after sending response
        setImmediate(async () => {
          try {
            console.log('[Chat] Generating title for new conversation (async)');
            const chatModel = modelConfig.chat || { model_name: 'gpt-4.1-nano-2025-04-14' };
            const titleModel = chatModel.model_name || 'gpt-4.1-nano-2025-04-14';
            const titleTokenParam = getTokenParameter(titleModel, { type: 'title' });
            const titleTemp = getTemperature(titleModel);
            const titleOptions = {
              model: titleModel,
              messages: [
                {
                  role: 'system',
                  content: 'Generate a concise, descriptive title (max 40 characters) for this conversation based on the first message. The title has to be based on whats being asked or the topic of it, dont use broad language. Respond with only the title, no quotes or extra text.'
                },
                {
                  role: 'user',
                  content: message
                }
              ],
              ...titleTokenParam,
            };
            // Only add temperature if model supports it (not GPT-5 or o-series)
            if (titleTemp !== null) {
              titleOptions.temperature = titleTemp;
            }
            // GPT-5 models need reasoning_effort
            if (titleModel.includes('gpt-5')) {
              titleOptions.reasoning_effort = 'low';
            }
            const titleCompletion = await openai.chat.completions.create(titleOptions);
            
            const generatedTitle = titleCompletion.choices[0].message.content.trim();
            console.log('[Chat] Generated title:', generatedTitle);
            
            if (generatedTitle && convId) {
              const { error: updateError } = await supabase
                .from('study_sessions')
                .update({ title: generatedTitle })
                .eq('id', convId);
                
              if (updateError) {
                console.error('Failed to update title:', updateError);
              } else {
                console.log('[Chat] Successfully updated title for session:', convId);
                // Invalidate cache for session and user's session list
                sessionCache.invalidate(cacheKeys.sessionDetail(convId));
                sessionCache.invalidateUser(userIdForConversation);
              }
            }
          } catch (error) {
            console.error('Failed to generate title:', error);
          }
        });
      }
    } catch (dbError) {
      console.error('Database error:', dbError);
      // Fall back to in-memory storage
      if (!userConversations[userIdForConversation]) {
        userConversations[userIdForConversation] = [];
      }
      
      let conversation = userConversations[userIdForConversation].find(c => c.id === convId);
      if (!conversation) {
        conversation = {
          id: convId,
          title: 'New Chat',
          subject: req.body.subject || 'General',
          created_at: new Date().toISOString(),
          messages: []
        };
        userConversations[userIdForConversation].push(conversation);
      }
      
      conversation.messages.push({
        id: 'msg-' + Date.now(),
        role: 'user',
        content: message,
        created_at: new Date().toISOString()
      });
      
      conversation.messages.push({
        id: 'msg-' + (Date.now() + 1),
        role: 'assistant',
        content: response,
        created_at: new Date().toISOString()
      });
    }
    
    // Format the AI response to handle markdown properly
    const formattedResponse = formatAIResponse(response);
    
    // Enhance response with PDF generation options
    const enhancedResponse = chatResponseEnhancer.enhanceResponse(formattedResponse, message, convId);
    
    // Use the cleaned message from enhancer (removes PDF_READY tags)
    const finalMessage = enhancedResponse.message;
    
    // Parse text formatting for the cleaned response
    const formattedParts = parseTextFormatting(finalMessage);
    
    const responseData = {
      message: finalMessage, // Use cleaned message
      response: finalMessage, // Add response field for compatibility
      formattedMessage: formattedParts, // Send parsed formatting info
      conversationId: convId,
      fileContext: fileContext, // Return the file context so frontend knows what files are in use
      actions: enhancedResponse.actions, // Include available actions
      usage: {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0
      }
    };
    
    console.log('[Chat] Sending response:', {
      messageLength: finalMessage?.length || 0,
      messagePreview: finalMessage?.substring(0, 100) + '...',
      conversationId: convId,
      hasActions: enhancedResponse.actions?.length > 0
    });
    
    // Track chat activity
    try {
      const statsModule = await import('./stats.routes.js');
      
      // Get session title for better tracking
      const { data: sessionInfo } = await supabase
        .from('study_sessions')
        .select('title')
        .eq('id', convId)
        .single();
      
      // Calculate approximate chat duration (rough estimate)
      const chatDuration = Math.max(1, Math.round(timings.totalTime / (1000 * 60))); // At least 1 minute
      
      await statsModule.trackUserActivity(supabase, userIdForConversation, {
        sessionType: 'chat',
        contentId: convId,
        contentTitle: sessionInfo?.title || 'AI Chat Session',
        startTime: new Date(startTime).toISOString(),
        endTime: new Date().toISOString(),
        questionsAnswered: 1, // Each message is a question/interaction
        metadata: {
          conversationId: convId,
          messageLength: message?.length || 0,
          responseLength: finalMessage?.length || 0,
          hasFileContext: !!fileContext,
          aiResponseStyle: aiResponseStyle || 'default',
          timings,
          isNewSession
        }
      });
      
      console.log('[Chat] Activity tracked successfully');
    } catch (trackingError) {
      console.error('[Chat] Error tracking activity:', trackingError);
      // Don't fail the request if tracking fails
    }
    
    timings.totalTime = Date.now() - startTime;
    console.log('[Chat] Request timing breakdown:', timings);
    
    res.json(responseData);

  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({
      error: { message: 'Failed to generate response' }
    });
  }
});

// Streaming chat endpoint using Server-Sent Events
router.post('/message/stream', userChatLimiter, validate(sendMessageSchema), checkSubscriptionLimit('chat'), async (req, res) => {
  const startTime = Date.now();
  console.log('[Stream] Request received from user:', req.userId);

  try {
    const { message, fileContext, conversationId, aiResponseStyle } = req.body;
    console.log('[Stream] Message:', message?.substring(0, 50), 'sessionId:', conversationId);

    if (!message) {
      return res.status(400).json({ error: { message: 'Message is required' } });
    }

    // Set up SSE headers with CORS support
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
    // CORS is handled by global middleware - do not override here
    res.flushHeaders();

    const supabase = getSupabase();
    const openai = getOpenAI();
    const modelConfig = getModelConfig();
    const userId = req.userId;
    if (!userId) return res.status(401).json({ error: { message: 'Unauthorized' } });

    let convId = conversationId;
    let isNewSession = !conversationId;

    // Get conversation history if exists (last 10 messages for context)
    let conversationHistory = [];
    if (conversationId && conversationId !== 'null' && conversationId !== 'undefined') {
      const { data: previousMessages, error: historyError } = await supabase
        .rpc('get_conversation_messages', {
          p_conversation_id: conversationId,
          p_user_id: userId,
          p_limit: 10
        });

      if (historyError) {
        console.log('[Stream] Error fetching history:', historyError.message);
      } else if (previousMessages) {
        conversationHistory = previousMessages.reverse();
        console.log('[Stream] Loaded', conversationHistory.length, 'messages from history');
      }
    }

    // Process file context for streaming
    let contextualMessage = message;
    if (fileContext) {
      console.log('[Stream] Processing file context:', JSON.stringify({ id: fileContext.id, name: fileContext.name, type: fileContext.type, hasFiles: !!fileContext.files }));

      if (fileContext.type === 'multiple' && fileContext.files) {
        // Multiple files context
        const fileIds = fileContext.files.map(f => f.id);
        console.log(`[Stream] Processing multiple files context: ${fileIds.length} files`);

        let allChunks = [];
        for (const file of fileContext.files) {
          const { data: fileChunks } = await supabase
            .from('file_chunks')
            .select('id, content, chunk_index, metadata')
            .eq('file_id', file.id)
            .order('chunk_index', { ascending: true })
            .limit(5);

          if (fileChunks && fileChunks.length > 0) {
            allChunks.push(...fileChunks.map(c => ({ ...c, fileName: file.name })));
          }
        }

        if (allChunks.length > 0) {
          const relevantChunks = fileProcessor.findRelevantChunks(
            allChunks.map(c => ({ id: c.id, content: c.content, metadata: c.metadata })),
            message,
            5
          );

          if (relevantChunks.length > 0) {
            const chunkContent = relevantChunks.map(c => c.content).join('\n\n---\n\n');
            contextualMessage = `[Multiple Files: ${fileContext.files.map(f => f.name).join(', ')}]\n\nRelevant content from the files:\n\n${chunkContent}\n\n---\n\nUser question: ${message}`;
          } else {
            // Fallback: include beginning of first chunks from each file
            const fallbackContent = allChunks.slice(0, 3).map(c => c.content.substring(0, 500)).join('\n\n---\n\n');
            contextualMessage = `[Multiple Files: ${fileContext.files.map(f => f.name).join(', ')}]\n\nContent from the files:\n\n${fallbackContent}\n\n---\n\nUser question: ${message}`;
          }
        }
      } else if (fileContext.type === 'folder' && fileContext.processedFiles) {
        // Folder context
        console.log(`[Stream] Processing folder context: ${fileContext.name}`);
        let allChunks = [];
        for (const file of fileContext.processedFiles) {
          if (file.status !== 'processed') continue;
          const { data: fileChunks } = await supabase
            .from('file_chunks')
            .select('id, content, chunk_index, metadata')
            .eq('file_id', file.id)
            .order('chunk_index', { ascending: true })
            .limit(5);

          if (fileChunks && fileChunks.length > 0) {
            allChunks.push(...fileChunks);
          }
        }

        if (allChunks.length > 0) {
          const relevantChunks = fileProcessor.findRelevantChunks(
            allChunks.map(c => ({ id: c.id, content: c.content, metadata: c.metadata })),
            message,
            5
          );

          if (relevantChunks.length > 0) {
            const chunkContent = relevantChunks.map(c => c.content).join('\n\n---\n\n');
            contextualMessage = `[Folder: ${fileContext.name}]\n\nRelevant content:\n\n${chunkContent}\n\n---\n\nUser question: ${message}`;
          } else {
            const fallbackContent = allChunks.slice(0, 3).map(c => c.content.substring(0, 500)).join('\n\n---\n\n');
            contextualMessage = `[Folder: ${fileContext.name}]\n\nContent from folder files:\n\n${fallbackContent}\n\n---\n\nUser question: ${message}`;
          }
        }
      } else if (fileContext.id) {
        // Single file context
        console.log(`[Stream] Processing single file context: ${fileContext.id}`);
        const { data: chunks } = await supabase
          .from('file_chunks')
          .select('id, content, chunk_index, metadata')
          .eq('file_id', fileContext.id)
          .order('chunk_index', { ascending: true });

        if (chunks && chunks.length > 0) {
          console.log(`[Stream] Found ${chunks.length} chunks for file ${fileContext.id}`);
          const relevantChunks = fileProcessor.findRelevantChunks(
            chunks.map(c => ({ id: c.id, content: c.content, metadata: c.metadata })),
            message,
            3
          );

          if (relevantChunks.length > 0) {
            const chunkContent = relevantChunks.map(c => c.content).join('\n\n---\n\n');
            contextualMessage = `[File: ${fileContext.name}]\n\nRelevant content:\n\n${chunkContent}\n\n---\n\nUser question: ${message}`;
          } else {
            // Fallback: include beginning of first chunk so AI has some file context
            const firstChunk = chunks[0];
            contextualMessage = `[File: ${fileContext.name}]\n\nFile content (beginning):\n\n${firstChunk.content.substring(0, 1500)}\n\n---\n\nUser question: ${message}`;
          }
        } else {
          console.log(`[Stream] No chunks found for file ${fileContext.id}, trying alternative files`);
          // Try to find another file with same name that has chunks
          const { data: alternativeFiles } = await supabase
            .from('files')
            .select('id')
            .eq('name', fileContext.name)
            .neq('id', fileContext.id);

          if (alternativeFiles && alternativeFiles.length > 0) {
            for (const altFile of alternativeFiles) {
              const { data: altChunks } = await supabase
                .from('file_chunks')
                .select('id, content, chunk_index, metadata')
                .eq('file_id', altFile.id)
                .order('chunk_index', { ascending: true })
                .limit(10);

              if (altChunks && altChunks.length > 0) {
                console.log(`[Stream] Found ${altChunks.length} chunks in alternative file ${altFile.id}`);
                const chunkContent = altChunks.slice(0, 3).map(c => c.content).join('\n\n---\n\n');
                contextualMessage = `[File: ${fileContext.name}]\n\nFile content:\n\n${chunkContent}\n\n---\n\nUser question: ${message}`;
                break;
              }
            }
          }

          if (contextualMessage === message) {
            // Still no chunks found - tell the AI about the file anyway
            contextualMessage = `[File: ${fileContext.name}]\n\nNote: The file hasn't been fully processed yet. Please let the user know the file content isn't available yet.\n\nUser question: ${message}`;
          }
        }
      }
    }

    // Build messages array
    const activeModel = modelConfig.chat || {
      provider: 'openai',
      model_name: 'gpt-4.1-nano-2025-04-14'
    };

    // Use full base prompt for streaming (same as non-streaming for chart/markdown support)
    const detectedChartTypes = detectChartTypes(contextualMessage || message);
    const chartAdditions = await getChartAddition(detectedChartTypes);

    if (detectedChartTypes.length > 0) {
      console.log('[Stream] Detected chart types:', detectedChartTypes);
    }

    const finalStyle = aiResponseStyle === 'concise' ? 'simple' : (aiResponseStyle || 'detailed');
    const responseStyleInstructions = finalStyle === 'simple'
      ? `\n\n**Response Style**: Get straight to the point. Use short sentences and everyday words. Avoid jargon and complex vocabulary. Keep responses brief — 2-4 sentences for simple questions, a short paragraph max for complex topics. Use bullet points when listing multiple items. Only elaborate if the user asks for more detail.`
      : `\n\n**Response Style**: You should provide DETAILED and COMPREHENSIVE responses. Include relevant context, examples, and thorough explanations to help the student fully understand the topic. Break down complex concepts into digestible parts. Feel free to use structured formatting with headings, bullet points, and numbered lists when it helps clarity.`;

    // Resolve the user's preferred language (used as a fallback hint when the
    // message itself is too short/ambiguous to identify a language).
    let preferredLanguage = 'English';
    try {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('preferences')
        .eq('id', userId)
        .single();
      if (profileData?.preferences?.language) {
        preferredLanguage = profileData.preferences.language;
      }
    } catch (err) {
      console.error('[Stream] Error fetching language preference:', err?.message);
    }

    const systemMessage = getBasePrompt(preferredLanguage) + responseStyleInstructions + chartAdditions;

    const messages = [{ role: "system", content: systemMessage }];

    // Add conversation history
    for (const msg of conversationHistory) {
      messages.push({ role: msg.role, content: msg.content });
    }

    // Add current message
    messages.push({ role: "user", content: contextualMessage });

    // Create or get session
    if (!convId) {
      const { data: newSession, error: createError } = await supabase
        .from('study_sessions')
        .insert([{
          user_id: userId,
          title: 'New Chat Session',
          subject: 'General',
          created_at: new Date().toISOString()
        }])
        .select('id')
        .single();

      if (newSession) {
        convId = newSession.id;
        // Send session ID to client
        res.write(`data: ${JSON.stringify({ type: 'session', conversationId: convId })}\n\n`);
        if (res.flush) res.flush();
      }
    }

    // Stream the response with retry logic for empty responses
    let fullResponse = '';
    const MAX_RETRIES = 2;
    let emittedChunk = false;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      fullResponse = ''; // Reset for each attempt

      try {
        console.log('[Stream] Starting stream attempt', attempt + 1, 'with model:', activeModel.model_name);

        // Only use streaming for OpenAI provider
        if (activeModel.provider === 'openai' || !activeModel.provider) {
          // Use streaming generator
          const streamGenerator = generateOpenAIStreamingResponse({
            model: activeModel.model_name,
            messages,
            temperature: getTemperature(activeModel.model_name),
            maxTokens: 1200
          });

          for await (const chunk of streamGenerator) {
            fullResponse += chunk;
            emittedChunk = true;
            // Send chunk to client
            res.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`);
            // Flush immediately to ensure real-time streaming
            if (res.flush) res.flush();
          }
        } else {
          // For non-OpenAI providers, fall back to regular response
          console.log('[Stream] Non-OpenAI provider, using regular response');
          const aiResponse = await generateAIResponse({
            feature: 'chat',
            messages: messages,
            temperature: getTemperature(activeModel.model_name),
            maxTokens: 1200
          });
          fullResponse = aiResponse.content;
          emittedChunk = Boolean(fullResponse?.trim());
          // Send as a single chunk
          res.write(`data: ${JSON.stringify({ type: 'chunk', content: fullResponse })}\n\n`);
          if (res.flush) res.flush();
        }

        // Check if response is empty and retry if needed
        if (!fullResponse || !fullResponse.trim()) {
          console.warn('[Stream] Empty response on attempt', attempt + 1);
          if (attempt < MAX_RETRIES) {
            console.log('[Stream] Retrying...');
            // Send retry notice to client
            res.write(`data: ${JSON.stringify({ type: 'retry', attempt: attempt + 2 })}\n\n`);
            if (res.flush) res.flush();
            continue; // Try again
          } else {
            console.error('[Stream] All retry attempts failed with empty response, using non-stream fallback');
            try {
              const fallbackResponse = await generateAIResponse({
                feature: 'chat',
                messages,
                temperature: getTemperature(activeModel.model_name),
                maxTokens: 1200
              });

              fullResponse = fallbackResponse.content || '';
              if (fullResponse.trim()) {
                emittedChunk = true;
                res.write(`data: ${JSON.stringify({ type: 'chunk', content: fullResponse })}\n\n`);
                await req.featureUsage?.finalize();
                res.write(`data: ${JSON.stringify({ type: 'done', fullContent: fullResponse, conversationId: convId, isNewSession, fallback: true })}\n\n`);
                if (res.flush) res.flush();
                break;
              }
            } catch (fallbackError) {
              console.error('[Stream] Non-stream fallback failed:', fallbackError.message);
            }

            await req.featureUsage?.release().catch(() => {});
            res.write(`data: ${JSON.stringify({ type: 'error', code: 'CHAT_GENERATION_FAILED', message: 'The response could not be completed. Please try again.' })}\n\n`);
            if (res.flush) res.flush();
            res.end();
            return;
          }
        }

        // Response is valid, send done event and break out of retry loop
        await req.featureUsage?.finalize();
        res.write(`data: ${JSON.stringify({ type: 'done', fullContent: fullResponse, conversationId: convId, isNewSession })}\n\n`);
        if (res.flush) res.flush();
        break; // Success, exit retry loop

      } catch (streamError) {
        console.error('[Stream] Error during streaming attempt', attempt + 1, ':', streamError.message);
        if (shouldRetryChatStream({ attempt, maxRetries: MAX_RETRIES, emittedChunk })) {
          console.log('[Stream] Retrying after error...');
          res.write(`data: ${JSON.stringify({ type: 'retry', attempt: attempt + 2, reason: 'error' })}\n\n`);
          if (res.flush) res.flush();
          continue;
        }
        console.error('[Stream] Streaming failed:', streamError.stack);
        await req.featureUsage?.release().catch(() => {});
        res.write(`data: ${JSON.stringify(chatStreamErrorEvent(emittedChunk))}\n\n`);
        if (res.flush) res.flush();
        res.end();
        return;
      }
    }

    // Save messages to database (async, don't block)
    if (convId && fullResponse) {
      const userMessageId = uuidv4();
      const assistantMessageId = uuidv4();

      const streamUserTimestamp = new Date();
      const streamAssistantTimestamp = new Date(streamUserTimestamp.getTime() + 1000); // 1s later to ensure correct ordering
      const messageRows = [
        {
          id: uuidv4(),
          user_id: userId,
          session_id: convId,
          message_id: userMessageId,
          role: 'user',
          content: message,
          created_at: streamUserTimestamp.toISOString()
        },
        {
          id: uuidv4(),
          user_id: userId,
          session_id: convId,
          message_id: assistantMessageId,
          role: 'assistant',
          content: fullResponse,
          created_at: streamAssistantTimestamp.toISOString()
        }
      ];

      // Deferred, retried save (do not block the response). Cache invalidation
      // only runs on a successful persist.
      setImmediate(async () => {
        try {
          const ok = await saveChatMessagesWithRetry(supabase, messageRows, {
            convId, userId, contentLen: fullResponse.length,
          });
          if (ok) {
            console.log('[Stream] Messages saved for conversation:', convId);
            sessionCache.invalidate(cacheKeys.sessionDetail(convId));
            sessionCache.invalidate(cacheKeys.sessionMessages(convId, 1));
            sessionCache.invalidateUser(userId);
          }
        } catch (err) {
          // The response has already been sent; never let this escape as an
          // unhandled rejection.
          console.error('[Stream] Deferred save crashed for conversation:', convId, err);
        }
      });

      // Generate title for new sessions (async) - capture variables for closure
      if (isNewSession && message.length > 10) {
        const sessionIdForTitle = convId;
        const messageForTitle = message;
        // Use gpt-4.1-nano for title generation - it's fast and reliable
        const modelForTitle = 'gpt-4.1-nano-2025-04-14';

        console.log('[Stream] Scheduling title generation for session:', sessionIdForTitle, 'isNewSession:', isNewSession);

        // Use setTimeout to ensure clean async context
        setTimeout(async () => {
          try {
            console.log('[Stream] Starting title generation with model:', modelForTitle, 'for session:', sessionIdForTitle);
            const openaiClient = getOpenAI();
            const supabaseClient = getSupabase();

            // Check if openaiClient is valid
            if (!openaiClient) {
              console.error('[Stream] OpenAI client not available for title generation');
              return;
            }

            const titleOptions = {
              model: modelForTitle,
              messages: [
                { role: 'system', content: 'Generate a short title (3-6 words) for this chat based on the user message. Just output the title, nothing else.' },
                { role: 'user', content: messageForTitle.substring(0, 200) } // Limit message length
              ],
              max_tokens: 30, // gpt-4.1-nano uses max_tokens, not max_completion_tokens
              temperature: 0.7,
            };

            console.log('[Stream] Calling OpenAI for title with options:', JSON.stringify({ model: titleOptions.model, messageLength: messageForTitle.length }));
            const titleCompletion = await openaiClient.chat.completions.create(titleOptions);
            console.log('[Stream] OpenAI title response:', JSON.stringify(titleCompletion.choices?.[0]));

            const rawTitle = titleCompletion.choices?.[0]?.message?.content || '';
            // Clean up the title: remove quotes, trim whitespace, limit length
            const generatedTitle = rawTitle.trim().replace(/^["']|["']$/g, '').substring(0, 50) || 'New Chat';
            console.log('[Stream] Generated title:', generatedTitle, 'for session:', sessionIdForTitle);

            if (generatedTitle && generatedTitle.length > 0 && generatedTitle !== 'New Chat') {
              const { error: updateError } = await supabaseClient
                .from('study_sessions')
                .update({ title: generatedTitle })
                .eq('id', sessionIdForTitle);

              if (updateError) {
                console.error('[Stream] Failed to update title in DB:', updateError.message);
              } else {
                console.log('[Stream] Title updated successfully');
                // Invalidate cache for this session and user's session list
                sessionCache.invalidate(cacheKeys.sessionDetail(sessionIdForTitle));
                sessionCache.invalidateUser(userId);
              }

              // Verify the update by reading back
              const { data: verifyData } = await supabaseClient
                .from('study_sessions')
                .select('title')
                .eq('id', sessionIdForTitle)
                .single();
              console.log('[Stream] Verification - session title is now:', verifyData?.title);
            } else {
              console.warn('[Stream] Generated title was empty or default, not updating');
            }
          } catch (error) {
            console.error('[Stream] Title generation failed:', error.message);
            console.error('[Stream] Error details:', {
              name: error.name,
              code: error.code,
              status: error.status,
              stack: error.stack?.split('\n').slice(0, 3).join('\n')
            });
          }
        }, 500); // Increased delay to 500ms to ensure DB operations complete
      } else {
        console.log('[Stream] Skipping title generation - isNewSession:', isNewSession, 'messageLength:', message?.length, 'convId:', convId);
      }
    }

    res.end();
    console.log('[Stream] Request completed in', Date.now() - startTime, 'ms');

  } catch (error) {
    console.error('[Stream] Error:', error);
    await req.featureUsage?.release().catch(() => {});
    if (!res.headersSent) {
      res.status(500).json({ error: { message: 'Streaming failed' } });
    } else {
      res.write(`data: ${JSON.stringify({ type: 'error', code: 'CHAT_GENERATION_FAILED', message: 'The response could not be completed. Please try again.' })}\n\n`);
      res.end();
    }
  }
});

// Get chat history - Optimized with caching
router.get('/history', async (req, res) => {
  try {
    const supabase = getSupabase();
    const userId = req.userId;
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    
    console.log('[Chat History] Using userId:', userId, 'Better Auth ID:', req.user?.id, 'UUID:', req.user?.uuid);
    
    if (!userId) {
      return res.json({ conversations: [], totalCount: 0, page, limit });
    }
    
    // Check cache first
    const cacheKey = cacheKeys.userSessions(userId, page, limit);
    const cached = sessionCache.get(cacheKey);
    
    if (cached) {
      console.log(`[Chat History] Cache hit for user ${userId}`);
      return res.json(cached);
    }
    
    console.log(`[Chat History] Cache miss - fetching from DB for user: ${userId}`);
    
    // Use optimized query
    const { data: sessions, error, count } = await supabase
      .rpc('get_user_chat_sessions', {
        p_user_id: userId,
        p_limit: parseInt(limit),
        p_offset: offset
      });
    
    if (error) {
      console.error('Error fetching sessions:', error);
      
      // Fallback if RPC doesn't exist
      if (error.message?.includes('function') || error.message?.includes('does not exist')) {
        return fallbackChatHistory(req, res, userId, page, limit);
      }
      
      return res.status(500).json({ 
        error: { message: 'Failed to fetch chat history' } 
      });
    }
    
    const response = {
      conversations: sessions || [],
      totalCount: count || sessions?.length || 0,
      page: parseInt(page),
      limit: parseInt(limit)
    };
    
    // Cache the response
    sessionCache.set(cacheKey, response);
    
    res.json(response);
    
  } catch (error) {
    console.error('Chat history error:', error);
    res.status(500).json({ error: { message: 'Failed to fetch chat history' } });
  }
});

// Get specific conversation - Optimized with caching and pagination
router.get('/conversation/:conversationId', async (req, res) => {
  const { conversationId } = req.params;
  const { page = 1, limit = 50 } = req.query;
  const offset = (page - 1) * limit;
  
  try {
    const supabase = getSupabase();
    const userId = req.userId;
    
    // Check cache for session details
    const sessionCacheKey = cacheKeys.sessionDetail(conversationId);
    let session = sessionCache.get(sessionCacheKey);
    
    if (!session) {
      // Verify session ownership
      const { data: sessionData, error: sessionError } = await supabase
        .from('study_sessions')
        .select('id, title, created_at')
        .eq('id', conversationId)
        .eq('user_id', userId)
        .single();
      
      if (sessionError || !sessionData) {
        console.error('[Conversation] Not found - conversationId:', conversationId, 'userId:', userId, 'betterAuthId:', req.user?.id, 'error:', sessionError?.message);
        return res.status(404).json({ error: { message: 'Conversation not found' } });
      }
      
      session = sessionData;
      sessionCache.set(sessionCacheKey, session);
    }
    
    // Check cache for messages
    const messagesCacheKey = cacheKeys.sessionMessages(conversationId, page, limit);
    const cachedMessages = sessionCache.get(messagesCacheKey);
    
    if (cachedMessages) {
      console.log(`[Conversation] Cache hit for messages ${conversationId}`);
      return res.json({ 
        conversation: {
          ...session,
          ...cachedMessages
        }
      });
    }
    
    // Get total message count
    const { count: totalMessages } = await supabase
      .from('chat_conversations')
      .select('*', { count: 'exact', head: true })
      .eq('session_id', conversationId);
    
    // Get paginated messages
    const { data: messages, error: msgError } = await supabase
      .from('chat_conversations')
      .select('message_id, role, content, created_at')
      .eq('session_id', conversationId)
      .order('created_at', { ascending: true })
      .range(offset, offset + limit - 1);
    
    if (msgError) {
      console.error('Error fetching messages:', msgError);
      return res.status(500).json({ error: { message: 'Failed to fetch messages' } });
    }
    
    const messageData = {
      messages: messages?.map(msg => ({
        id: msg.message_id,
        role: msg.role,
        content: msg.content,
        created_at: msg.created_at
      })) || [],
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        totalMessages: totalMessages || 0,
        totalPages: Math.ceil((totalMessages || 0) / limit)
      }
    };
    
    // Cache the messages
    sessionCache.set(messagesCacheKey, messageData);
    
    res.json({ 
      conversation: {
        id: session.id,
        title: session.title,
        created_at: session.created_at,
        ...messageData
      }
    });
  } catch (error) {
    console.error('Get conversation error:', error);
    res.status(500).json({ error: { message: 'Failed to fetch conversation' } });
  }
});

// Update conversation title
router.patch('/conversation/:conversationId', async (req, res) => {
  const { conversationId } = req.params;
  const { title } = req.body;
  
  try {
    const supabase = getSupabase();
    const userId = req.userId;
    if (!userId) return res.status(401).json({ error: { message: 'Unauthorized' } });
    
    if (!title || !title.trim()) {
      return res.status(400).json({ error: { message: 'Title is required' } });
    }
    
    const { data, error } = await supabase
      .from('study_sessions')
      .update({ 
        title: title.trim()
      })
      .eq('id', conversationId)
      .eq('user_id', userId)
      .select()
      .single();
    
    if (error) {
      console.error('Error updating conversation title:', error);
      return res.status(500).json({ error: { message: 'Failed to update title' } });
    }
    
    // Invalidate caches
    sessionCache.invalidate(cacheKeys.sessionDetail(conversationId));
    sessionCache.invalidateUser(userId); // Invalidate all user session lists
    
    res.json({ conversation: data });
  } catch (error) {
    console.error('Update conversation error:', error);
    res.status(500).json({ error: { message: 'Failed to update conversation' } });
  }
});

// Delete conversation
router.delete('/conversation/:conversationId', async (req, res) => {
  const { conversationId } = req.params;
  
  try {
    const supabase = getSupabase();
    const userId = req.userId;
    if (!userId) return res.status(401).json({ error: { message: 'Unauthorized' } });

    // Verify ownership BEFORE deleting anything, so a user cannot delete another
    // user's messages by guessing a conversation id.
    const { data: ownedSession, error: ownErr } = await supabase
      .from('study_sessions')
      .select('id')
      .eq('id', conversationId)
      .eq('user_id', userId)
      .single();

    if (ownErr || !ownedSession) {
      return res.status(404).json({ error: { message: 'Conversation not found' } });
    }

    // Delete messages first (due to foreign key constraint), scoped to the owner.
    await supabase
      .from('chat_conversations')
      .delete()
      .eq('session_id', conversationId)
      .eq('user_id', userId);

    // Then delete the session
    const { error } = await supabase
      .from('study_sessions')
      .delete()
      .eq('id', conversationId)
      .eq('user_id', userId);

    if (error) {
      console.error('Error deleting conversation:', error);
    }
    
    // Also delete from in-memory storage
    if (userConversations[userId]) {
      userConversations[userId] = userConversations[userId].filter(c => c.id !== conversationId);
    }
    
    // Invalidate all related caches
    sessionCache.invalidate(cacheKeys.sessionDetail(conversationId));
    sessionCache.invalidate(cacheKeys.sessionSummary(conversationId));
    // Invalidate all pages of messages for this session
    for (let i = 1; i <= 10; i++) {
      sessionCache.invalidate(cacheKeys.sessionMessages(conversationId, i));
    }
    sessionCache.invalidateUser(userId);
    
    res.json({ message: 'Conversation deleted successfully' });
  } catch (error) {
    console.error('Delete conversation error:', error);
    res.status(500).json({ error: { message: 'Failed to delete conversation' } });
  }
});

// Process multiple files for chat context
router.post('/process-files', validate(processFilesSchema), async (req, res) => {
  const { fileIds } = req.body;
  console.log('Processing files for chat context:', fileIds);
  
  try {
    const supabase = getSupabase();
    const userId = req.userId;
    if (!userId) return res.status(401).json({ error: { message: 'Unauthorized' } });
    
    if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0) {
      return res.status(400).json({ error: { message: 'File IDs are required' } });
    }
    
    const processedFiles = [];
    
    for (const fileId of fileIds) {
      // Get file info
      const { data: file, error: fileError } = await supabase
        .from('files')
        .select('id, name, type, size')
        .eq('id', fileId)
        .eq('user_id', userId)
        .single();

      if (!fileError && file) {
        processedFiles.push({
          id: file.id,
          name: file.name,
          type: file.type,
          size: file.size
        });
      }
    }
    
    // Return the file context structure for multiple files
    const fileContext = {
      id: `multiple-${Date.now()}`,
      type: 'multiple',
      files: processedFiles,
      name: processedFiles.map(f => f.name).join(', ')
    };
    
    res.json({ fileContext });
  } catch (error) {
    console.error('Process files error:', error);
    res.status(500).json({ error: { message: 'Failed to process files' } });
  }
});

// Cache statistics endpoint (for monitoring)
router.get('/cache/stats', async (req, res) => {
  res.json({
    cache: sessionCache.getStats()
  });
});

// Fallback implementation for chat history
async function fallbackChatHistory(req, res, userId, page, limit) {
  const supabase = getSupabase();
  
  console.log('[Chat History] Using fallback implementation');
  
  const { data: sessions, error } = await supabase
    .from('study_sessions')
    .select('id, title, subject, created_at, updated_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range((page - 1) * limit, page * limit - 1);
  
  if (error) {
    console.error('Error fetching sessions:', error);
    return res.json({ conversations: [] });
  }
  
  // Batch fetch last messages using a single query
  const sessionIds = sessions.map(s => s.id);
  
  const { data: lastMessages } = await supabase
    .from('chat_conversations')
    .select('session_id, content, created_at')
    .in('session_id', sessionIds)
    .order('created_at', { ascending: false });
  
  // Group messages by session
  const messagesBySession = {};
  const lastMessageBySession = {};
  
  lastMessages?.forEach(msg => {
    if (!lastMessageBySession[msg.session_id]) {
      lastMessageBySession[msg.session_id] = msg;
    }
    messagesBySession[msg.session_id] = (messagesBySession[msg.session_id] || 0) + 1;
  });
  
  const conversations = sessions.map(session => ({
    id: session.id,
    title: session.title,
    created_at: session.created_at,
    updated_at: lastMessageBySession[session.id]?.created_at || session.created_at,
    last_message: lastMessageBySession[session.id]?.content || null,
    message_count: messagesBySession[session.id] || 0,
    subject: session.subject || 'General'
  }));
  
  const response = {
    conversations,
    totalCount: conversations.length,
    page: parseInt(page),
    limit: parseInt(limit)
  };
  
  // Cache the response
  sessionCache.set(cacheKeys.userSessions(userId, page, limit), response);
  
  res.json(response);
}

export default router;
