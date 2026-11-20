// Unified Content Extractor
// Ensures consistent content extraction across Chat, Quiz, and Flashcard generation

import { getSupabase } from '../config/services.config.js';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { detectLanguage } = require('./languageDetection.cjs');

export class UnifiedContentExtractor {
  constructor() {
    this.supabase = null;
  }

  /**
   * Get Supabase instance (lazy loading)
   */
  getSupabaseInstance() {
    if (!this.supabase) {
      this.supabase = getSupabase();
    }
    return this.supabase;
  }

  /**
   * Extract content from file chunks in a consistent way
   * @param {string} fileId - The file ID
   * @param {string} userId - The user ID
   * @param {object} options - Extraction options
   * @returns {object} Extracted content with metadata
   */
  async extractFileContent(fileId, userId, options = {}) {
    const {
      includeImages = true,
      includeMetadata = true,
      maxChunks = 10,
      purpose = 'general' // 'chat', 'quiz', 'flashcards'
    } = options;

    try {
      // Get file info
      const { data: file, error: fileError } = await this.getSupabaseInstance()
        .from('files')
        .select('*')
        .eq('id', fileId)
        .eq('user_id', userId)
        .single();

      if (fileError || !file) {
        throw new Error(`File not found: ${fileId}`);
      }

      // Get all chunks
      const { data: chunks, error: chunksError } = await this.getSupabaseInstance()
        .from('file_chunks')
        .select('*')
        .eq('file_id', fileId)
        .order('chunk_index', { ascending: true });

      if (chunksError || !chunks || chunks.length === 0) {
        console.log(`[UnifiedContentExtractor] No chunks found for file: ${fileId}, checking if file needs processing...`);
        
        // Check if file exists and might need processing
        if (file && file.url && !file.processing_status) {
          console.log(`[UnifiedContentExtractor] File ${fileId} exists but has no chunks. It may need processing.`);
          
          // Return a message indicating the file needs processing
          return {
            fileId,
            fileName: file.name,
            fileType: file.type,
            content: [],
            metadata: {},
            chunks: [],
            extractedData: {
              text: `File "${file.name}" is pending processing. Please wait for processing to complete or trigger reprocessing.`,
              images: [],
              tables: [],
              exercises: [],
              language: 'unknown',
              metadata: {}
            }
          };
        }
        
        throw new Error(`No chunks found for file: ${fileId}. File may not be properly processed.`);
      }

      // Process chunks based on type
      const processedContent = this.processChunks(chunks, {
        fileName: file.name,
        fileType: file.type,
        includeImages,
        includeMetadata,
        purpose
      });

      return {
        fileId,
        fileName: file.name,
        fileType: file.type,
        content: processedContent.content,
        metadata: processedContent.metadata,
        chunks: processedContent.chunks,
        extractedData: processedContent.extractedData
      };
    } catch (error) {
      console.error('[UnifiedContentExtractor] Error:', error);
      throw error;
    }
  }

  /**
   * Process chunks to extract content consistently
   */
  processChunks(chunks, options) {
    const result = {
      content: [],
      metadata: {},
      chunks: [],
      extractedData: {
        text: '',
        images: [],
        tables: [],
        exercises: [],
        mathematics: [],
        language: 'unknown'
      }
    };

    // Collect language detections from chunks
    const languageDetections = [];
    const textSamples = [];

    for (const chunk of chunks) {
      const processedChunk = this.processChunk(chunk, options);
      
      if (processedChunk) {
        result.chunks.push(processedChunk);
        
        // Aggregate content
        if (processedChunk.text) {
          result.content.push(processedChunk.text);
          result.extractedData.text += processedChunk.text + '\n\n';
          
          // Collect text samples for language detection (first 3 chunks with substantial text)
          if (textSamples.length < 3 && processedChunk.text.length > 50) {
            textSamples.push(processedChunk.text);
          }
        }
        
        // Aggregate structured data
        if (processedChunk.image) {
          result.extractedData.images.push(processedChunk.image);
        }
        if (processedChunk.tables) {
          result.extractedData.tables.push(...processedChunk.tables);
        }
        if (processedChunk.exercises) {
          result.extractedData.exercises.push(...processedChunk.exercises);
        }
        if (processedChunk.mathematics) {
          result.extractedData.mathematics.push(...processedChunk.mathematics);
        }
        
        // Collect language detections from chunks (e.g., from OCR)
        if (processedChunk.language && processedChunk.language !== 'unknown') {
          languageDetections.push(processedChunk.language);
        }
      }
    }

    // Combine text content
    result.extractedData.text = result.extractedData.text.trim();
    
    // Determine language using multiple strategies
    result.extractedData.language = this.determineLanguage(languageDetections, textSamples);
    
    return result;
  }

  /**
   * Process individual chunk based on type
   */
  processChunk(chunk, options) {
    const { includeImages, includeMetadata, purpose } = options;
    
    // Handle image chunks
    if (chunk.metadata && chunk.metadata.type === 'image') {
      return this.processImageChunk(chunk, includeImages, includeMetadata);
    }
    
    // Handle text chunks
    if (chunk.metadata && chunk.metadata.type === 'text') {
      return {
        type: 'text',
        text: chunk.content,
        metadata: chunk.metadata
      };
    }
    
    // Handle structured data chunks
    if (chunk.metadata && ['table', 'exercise', 'mathematics'].includes(chunk.metadata.type)) {
      return {
        type: chunk.metadata.type,
        text: chunk.content,
        metadata: chunk.metadata,
        [chunk.metadata.type + 's']: [JSON.parse(chunk.content)]
      };
    }
    
    // Default text handling
    return {
      type: 'text',
      text: chunk.content,
      metadata: chunk.metadata || {}
    };
  }

  /**
   * Process image chunks to extract all relevant data
   */
  processImageChunk(chunk, includeImages, includeMetadata) {
    try {
      const imageData = JSON.parse(chunk.content);
      const result = {
        type: 'image',
        text: '',
        image: null,
        tables: [],
        exercises: [],
        mathematics: [],
        language: imageData.ocrData?.language || 'unknown'
      };

      // Extract text content
      if (imageData.ocrData && imageData.ocrData.text) {
        result.text = imageData.ocrData.text;
      } else if (imageData.rawText) {
        result.text = imageData.rawText;
      }

      // Include image data if requested
      if (includeImages && imageData.base64) {
        result.image = {
          base64: imageData.base64,
          mimeType: imageData.mimeType || 'image/jpeg',
          fileName: imageData.fileName
        };
      }

      // Store advanced analysis for later use
      if (imageData.advancedAnalysis) {
        result.advancedAnalysis = imageData.advancedAnalysis;
      }

      // Extract structured data if available
      if (includeMetadata && imageData.advancedAnalysis) {
        const analysis = imageData.advancedAnalysis;
        
        // Include OCR result if available
        if (analysis.ocrResult && analysis.ocrResult.text && !result.text) {
          result.text = analysis.ocrResult.text;
        }
        
        // Include all text from extractedData
        if (analysis.extractedData) {
          const extracted = analysis.extractedData;
          
          if (extracted.table) {
            result.tables.push(extracted.table);
            // Add table text to main text
            if (extracted.table.headers && extracted.table.rows) {
              const tableText = `Table: ${extracted.table.headers.join(' | ')}\n${extracted.table.rows.map(r => r.join(' | ')).join('\n')}`;
              result.text += '\n\n' + tableText;
            }
          }
          
          if (extracted.exercise) {
            result.exercises.push(extracted.exercise);
            // Add exercise text to main text
            const exerciseText = [
              extracted.exercise.questionText,
              extracted.exercise.instructions,
              extracted.exercise.questionNumber ? `Question ${extracted.exercise.questionNumber}` : null
            ].filter(Boolean).join('\n');
            if (exerciseText) {
              result.text += '\n\n' + exerciseText;
            }
          }
          
          if (extracted.mathematics) {
            result.mathematics.push(extracted.mathematics);
            if (extracted.mathematics.text) {
              result.text += '\n\nMathematical content: ' + extracted.mathematics.text;
            }
          }
        }
        
        // Include content type and image analysis metadata
        if (analysis.contentType) {
          result.contentType = analysis.contentType;
        }
        
        if (analysis.imageAnalysis) {
          result.imageAnalysis = analysis.imageAnalysis;
        }
        
        if (analysis.mathContent) {
          result.mathematics.push(analysis.mathContent);
          result.text += '\n\nMathematical content: ' + analysis.mathContent;
        }
      }

      return result;
    } catch (error) {
      console.error('[UnifiedContentExtractor] Error processing image chunk:', error);
      // Fallback to treating as text
      return {
        type: 'text',
        text: chunk.content,
        metadata: chunk.metadata
      };
    }
  }

  /**
   * Build context for AI prompts
   */
  buildAIContext(extractedContent, purpose = 'general') {
    const contexts = {
      chat: this.buildChatContext(extractedContent),
      quiz: this.buildQuizContext(extractedContent),
      flashcards: this.buildFlashcardsContext(extractedContent)
    };

    return contexts[purpose] || contexts.chat;
  }

  buildChatContext(content) {
    let context = `File: ${content.fileName}\n\n`;
    
    if (content.extractedData.text) {
      context += `Content:\n${content.extractedData.text}\n\n`;
    }
    
    if (content.extractedData.tables.length > 0) {
      context += `Tables found: ${content.extractedData.tables.length}\n`;
      content.extractedData.tables.forEach((table, i) => {
        context += `Table ${i + 1}: ${table.headers.join(', ')}\n`;
      });
    }
    
    if (content.extractedData.exercises.length > 0) {
      context += `\nExercises found: ${content.extractedData.exercises.length}\n`;
    }
    
    return context;
  }

  buildQuizContext(content) {
    let context = `Generate quiz questions based on the following content from ${content.fileName}:\n\n`;
    
    // Include all text content with proper formatting
    if (content.extractedData.text) {
      context += `=== MAIN CONTENT ===\n${content.extractedData.text}\n\n`;
    }
    
    // Include metadata for better context
    if (content.extractedData.metadata) {
      const meta = content.extractedData.metadata;
      if (meta.title) context += `Document Title: ${meta.title}\n`;
      if (meta.description) context += `Description: ${meta.description}\n`;
      if (meta.subject) context += `Subject: ${meta.subject}\n`;
      context += '\n';
    }
    
    // Include advanced analysis data if available
    if (content.extractedData.advancedAnalysis) {
      const analysis = content.extractedData.advancedAnalysis;
      
      // Include OCR results
      if (analysis.ocrResult && analysis.ocrResult.text) {
        context += `=== EXTRACTED TEXT FROM IMAGES ===\n${analysis.ocrResult.text}\n\n`;
      }
      
      // Include extracted structured data
      if (analysis.extractedData) {
        if (analysis.extractedData.mathematics) {
          context += `Mathematical Content: ${JSON.stringify(analysis.extractedData.mathematics)}\n\n`;
        }
        if (analysis.extractedData.exercise) {
          context += `Exercise Data: ${JSON.stringify(analysis.extractedData.exercise)}\n\n`;
        }
      }
    }
    
    // Include table data with full content
    if (content.extractedData.tables && content.extractedData.tables.length > 0) {
      context += `=== TABLES ===\n`;
      content.extractedData.tables.forEach((table, i) => {
        context += `Table ${i + 1}: ${table.headers.join(' | ')}\n`;
        if (table.rows) {
          table.rows.forEach(row => {
            context += `${row.join(' | ')}\n`;
          });
        }
        context += '\n';
      });
    }
    
    // Include exercises
    if (content.extractedData.exercises && content.extractedData.exercises.length > 0) {
      context += `=== EXERCISES ===\n`;
      content.extractedData.exercises.forEach((ex, i) => {
        context += `Exercise ${i + 1}: ${ex.question || ex.instruction || ex.text}\n`;
      });
      context += '\n';
    }
    
    // Language hint
    if (content.extractedData.language && content.extractedData.language !== 'unknown') {
      context += `\nIMPORTANT: The source content is in ${content.extractedData.language}. Please consider this when creating questions.\n`;
    }
    
    return context;
  }

  buildFlashcardsContext(content) {
    let context = `Create flashcards from the following content in ${content.fileName}:\n\n`;
    
    // Include all text content
    context += content.extractedData.text;
    
    // Language hint
    if (content.extractedData.language && content.extractedData.language !== 'unknown') {
      context += `\n\nNote: The content appears to be in ${content.extractedData.language}. Please create flashcards in the same language.`;
    }
    
    // Structured data hints
    if (content.extractedData.tables.length > 0) {
      context += '\n\nNote: The content includes tables with data that can be turned into fact-based flashcards.';
    }
    
    if (content.extractedData.mathematics.length > 0) {
      context += '\n\nNote: The content includes mathematical expressions that can be used for problem-solving flashcards.';
    }
    
    return context;
  }

  /**
   * Determine language using multiple detection strategies
   */
  determineLanguage(languageDetections, textSamples) {
    // Strategy 1: If we have consistent OCR language detections, use them
    if (languageDetections.length > 0) {
      const langCounts = {};
      languageDetections.forEach(lang => {
        langCounts[lang] = (langCounts[lang] || 0) + 1;
      });
      
      // Find most common language
      const sortedLangs = Object.entries(langCounts).sort((a, b) => b[1] - a[1]);
      const mostCommonLang = sortedLangs[0][0];
      const confidence = sortedLangs[0][1] / languageDetections.length;
      
      // If we have high confidence (>60%) from OCR, use it
      if (confidence > 0.6) {
        console.log(`[UnifiedContentExtractor] Language detected from OCR: ${mostCommonLang} (${Math.round(confidence * 100)}% confidence)`);
        return mostCommonLang;
      }
    }
    
    // Strategy 2: Detect from text samples (first 1-3 chunks)
    if (textSamples.length > 0) {
      const combinedText = textSamples.join('\n\n');
      const detected = detectLanguage(combinedText);
      
      if (detected.language !== 'unknown' && detected.confidence > 0.5) {
        console.log(`[UnifiedContentExtractor] Language detected from text analysis: ${detected.language} (${Math.round(detected.confidence * 100)}% confidence)`);
        return detected.language;
      }
    }
    
    // Strategy 3: If we have any language detection at all, use the most common one
    if (languageDetections.length > 0) {
      const langCounts = {};
      languageDetections.forEach(lang => {
        langCounts[lang] = (langCounts[lang] || 0) + 1;
      });
      const mostCommonLang = Object.entries(langCounts).sort((a, b) => b[1] - a[1])[0][0];
      console.log(`[UnifiedContentExtractor] Using most common detected language: ${mostCommonLang}`);
      return mostCommonLang;
    }
    
    console.log('[UnifiedContentExtractor] No language detected, defaulting to unknown');
    return 'unknown';
  }
}

export default new UnifiedContentExtractor();