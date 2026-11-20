const sharedOcrPool = require('./sharedOcrPool.cjs');
const advancedImageProcessor = require('./advancedImageProcessor.cjs');
const sharp = require('sharp');

class SmartImageRouter {
  constructor() {
    this.processingStats = {
      fastOcrRequests: 0,
      advancedRequests: 0,
      totalSaved: 0
    };
  }

  /**
   * Smart routing decision based on context and requirements
   * @param {Buffer} imageBuffer - Image buffer
   * @param {string} fileName - File name
   * @param {Object} context - Processing context
   * @returns {Object} Processing result
   */
  async processImage(imageBuffer, fileName, context = {}) {
    const { 
      requester = 'unknown', // 'chat', 'quiz', 'flashcards', 'upload'
      needsAdvanced = null,  // Force advanced processing
      needsVisual = false,   // Needs image for AI visual analysis
      priority = 'normal',   // 'fast', 'normal', 'thorough'
      languageHint = null    // User-provided language hint
    } = context;

    // Store requester for quick analysis skip
    this.currentRequester = requester;

    console.log(`[SmartImageRouter] Processing ${fileName} for ${requester} (priority: ${priority})`);

    try {
      // Quick image analysis to determine content type
      const quickAnalysis = await this.quickContentAnalysis(imageBuffer);
      
      // Decision matrix for processing type
      console.log(`[SmartImageRouter] Decision params:`, {
        requester,
        needsAdvanced,
        priority,
        hasEducationalKeywords: quickAnalysis.hasEducationalKeywords,
        confidence: quickAnalysis.confidence
      });
      
      const shouldUseAdvanced = this.shouldUseAdvancedProcessing(
        quickAnalysis, 
        requester, 
        needsAdvanced, 
        priority
      );
      
      console.log(`[SmartImageRouter] shouldUseAdvanced: ${shouldUseAdvanced}`);

      if (shouldUseAdvanced) {
        console.log(`[SmartImageRouter] Using advanced processing for ${fileName} (reason: ${this.getAdvancedReason(quickAnalysis, requester)})`);
        this.processingStats.advancedRequests++;
        
        // Use advanced processor with OpenCV.js + structured extraction
        const result = await advancedImageProcessor.processEducationalImage(imageBuffer, fileName, languageHint);
        
        return {
          type: 'advanced',
          processingTime: result.metadata?.processingTime || 0,
          result: await this.formatAdvancedResult(result, imageBuffer, fileName),
          confidence: result.metadata?.confidence || 0,
          hasStructuredData: !!result.extractedData
        };
      } else {
        console.log(`[SmartImageRouter] Using fast OCR for ${fileName} (reason: ${this.getFastReason(quickAnalysis, requester)})`);
        this.processingStats.fastOcrRequests++;
        
        // Use shared OCR pool for fast text extraction
        // First, do a quick scan to detect if we might have Arabic content
        // Arabic images often get misdetected as Spanish when using English-only OCR
        let initialLanguages = ['eng'];
        
        // If the file name or other hints suggest Arabic, start with Arabic support
        const fileNameLower = fileName.toLowerCase();
        if (fileNameLower.includes('arabic') || fileNameLower.includes('عربي') || 
            fileNameLower.includes('arab') || fileNameLower.includes('ar_')) {
          console.log('[SmartImageRouter] Filename suggests Arabic content, including Arabic in initial OCR');
          initialLanguages = ['ara', 'eng'];
        }
        
        // GPT Vision handles all languages in a single pass — no need for multi-pass
        let ocrResult = await sharedOcrPool.extractText(imageBuffer, {
          languages: initialLanguages
        });
        
        return {
          type: 'fast',
          processingTime: ocrResult.duration,
          result: await this.formatFastResult(ocrResult, imageBuffer, fileName),
          confidence: ocrResult.confidence,
          hasStructuredData: false
        };
      }
    } catch (error) {
      console.error(`[SmartImageRouter] Processing failed for ${fileName}:`, error);
      
      // Return a fallback result instead of throwing
      return {
        type: 'fallback',
        processingTime: Date.now() - (this._startTime || Date.now()),
        result: {
          type: 'image',
          fileName,
          processingType: 'fallback',
          contentType: 'unknown',
          confidence: 0,
          rawText: '',
          ocrData: {
            text: '',
            confidence: 0,
            language: 'unknown',
            error: error.message
          },
          hasStructuredData: false,
          hasOpenCV: false,
          base64: imageBuffer.toString('base64'),
          mimeType: 'image/jpeg',
          chunks: [{
            id: `${fileName}_fallback`,
            content: `Failed to process image: ${error.message}`,
            metadata: {
              type: 'error',
              source: 'fallback',
              error: error.message
            }
          }]
        },
        confidence: 0,
        hasStructuredData: false,
        error: error.message
      };
    }
  }

  /**
   * Quick analysis to determine if image has educational content
   */
  async quickContentAnalysis(imageBuffer) {
    try {
      const metadata = await sharp(imageBuffer).metadata();
      const aspectRatio = metadata.width / metadata.height;
      
      // Skip quick analysis for uploads - we'll use advanced anyway
      // This avoids doing OCR twice
      if (this.currentRequester === 'upload') {
        console.log('[SmartImageRouter] Skipping quick analysis for upload');
        return {
          aspectRatio,
          textLength: 0,
          confidence: 0,
          hasEducationalKeywords: false,
          hasTableStructure: false,
          hasMathematical: false,
          hasMathContent: false,
          hasComplexLayout: false,
          hasDiagrams: false,
          isLikelyEducational: false,
          sampleText: ''
        };
      }
      
      // Quick OCR sample to detect content type
      const sampleResult = await sharedOcrPool.extractText(imageBuffer);
      const text = sampleResult.text.toLowerCase();
      
      const hasEducationalKeywords = [
        'question', 'problem', 'exercise', 'calculate', 'draw', 'chart', 'graph',
        'table', 'frequency', 'data', 'solve', 'answer', 'step', 'formula',
        'equation', 'theorem', 'proof', 'example', 'chapter', 'section'
      ].some(keyword => text.includes(keyword));
      
      const hasTableStructure = /\|\s*\w+\s*\|/.test(text) || 
        /\b\w+\s+\d+\s+\w+\s+\d+\b/.test(text);
      
      const hasMathematical = /\d+\s*[+\-*/=]\s*\d+/.test(text) ||
        /[xyz]\s*[+\-*/=]/.test(text) ||
        /\b(sin|cos|tan|log|sqrt)\b/i.test(text);

      return {
        aspectRatio,
        textLength: text.length,
        confidence: sampleResult.confidence,
        hasEducationalKeywords,
        hasTableStructure,
        hasMathematical,
        hasMathContent: hasMathematical,
        hasComplexLayout: hasTableStructure || hasMathematical,
        hasDiagrams: false,
        isLikelyEducational: hasEducationalKeywords || hasTableStructure || hasMathematical,
        sampleText: text.substring(0, 500) // Store sample for language detection
      };
    } catch (error) {
      console.error('Quick analysis failed:', error);
      return { isLikelyEducational: false, confidence: 0 };
    }
  }



  /**
   * Decision logic for processing type
   */
  shouldUseAdvancedProcessing(analysis, requester, needsAdvanced, priority) {
    // Force advanced if explicitly requested
    if (needsAdvanced === true) return true;
    if (needsAdvanced === false) return false;

    // Fast priority always uses fast OCR
    if (priority === 'fast') return false;

    // ALWAYS use advanced OCR for uploads to ensure best quality and language detection
    if (requester === 'upload') {
      console.log('[SmartImageRouter] Using advanced OCR for upload to ensure accurate language detection');
      return true;
    }

    // For chat/quiz/flashcard generation, use advanced
    if (['chat', 'quiz', 'flashcards'].includes(requester)) {
      return true;
    }

    // Default to fast OCR
    return false;
  }

  /**
   * Format advanced processing result
   */
  async formatAdvancedResult(advancedResult, imageBuffer, fileName) {
    const { contentType, extractedData, ocrResult, imageAnalysis, metadata } = advancedResult;
    
    let formattedResult = {
      type: 'image',
      fileName,
      processingType: 'advanced_educational',
      
      // Core data
      contentType: contentType.primary,
      confidence: metadata.confidence,
      rawText: ocrResult.text || '',
      
      // Advanced features
      hasStructuredData: !!extractedData,
      hasOpenCV: metadata.hasOpenCV,
      
      // OCR details
      hasOCR: !!(ocrResult.text && ocrResult.text.length > 0),
      ocrData: {
        text: ocrResult.text,
        confidence: ocrResult.confidence,
        language: await this.detectLanguage(ocrResult.text)
      }
    };

    // Add structured data based on content type
    if (extractedData) {
      switch (contentType.primary) {
        case 'exercise':
          if (extractedData.exercise) {
            formattedResult.exercise = extractedData.exercise;
            if (extractedData.exercise.tableData) {
              formattedResult.tableData = extractedData.exercise.tableData;
              formattedResult.tableText = this.tableToText(extractedData.exercise.tableData);
            }
          }
          break;
          
        case 'table':
          if (extractedData.table) {
            formattedResult.tableData = extractedData.table;
            formattedResult.tableText = this.tableToText(extractedData.table);
          }
          break;
          
        case 'mathematics':
          if (extractedData.mathematics) {
            formattedResult.mathematics = extractedData.mathematics;
          }
          break;
      }

      // Add chart data if detected
      if (extractedData.pieChart) {
        formattedResult.chartData = { type: 'pie', data: extractedData.pieChart.data };
      }
      if (extractedData.barChart) {
        formattedResult.chartData = { type: 'bar', data: extractedData.barChart.data };
      }
    }

    // Add advanced analysis structure expected by chat
    formattedResult.advancedAnalysis = {
      contentType: contentType.primary,
      exercise: extractedData?.exercise || null,
      tableData: formattedResult.tableData || null,
      mathContent: extractedData?.mathematics?.expressions?.join('\n') || null,
      chartData: formattedResult.chartData || null
    };
    
    // Add image data if needed for visual analysis
    if (imageBuffer) {
      formattedResult.base64 = imageBuffer.toString('base64');
      formattedResult.mimeType = 'image/jpeg';
    }

    // Create chunks for proper content extraction
    const chunks = [];
    
    // Add main text content as first chunk
    if (ocrResult.text) {
      chunks.push({
        id: `${fileName}_text`,
        content: ocrResult.text,
        metadata: {
          type: 'text',
          source: 'ocr',
          confidence: ocrResult.confidence
        }
      });
    }
    
    // Add structured content as additional chunks
    if (formattedResult.tableText) {
      chunks.push({
        id: `${fileName}_table`,
        content: formattedResult.tableText,
        metadata: {
          type: 'table',
          source: 'structured_extraction'
        }
      });
    }
    
    if (extractedData?.exercise?.questionText) {
      chunks.push({
        id: `${fileName}_exercise`,
        content: `Exercise: ${extractedData.exercise.questionText}\n${extractedData.exercise.instructions || ''}`,
        metadata: {
          type: 'exercise',
          source: 'structured_extraction'
        }
      });
    }
    
    if (extractedData?.mathematics?.expressions?.length > 0) {
      chunks.push({
        id: `${fileName}_math`,
        content: `Mathematical expressions:\n${extractedData.mathematics.expressions.join('\n')}`,
        metadata: {
          type: 'mathematics',
          source: 'structured_extraction'
        }
      });
    }
    
    // Create a copy of formattedResult without chunks to avoid circular reference
    const imageChunkData = { ...formattedResult };
    delete imageChunkData.chunks; // Remove chunks property to avoid circular reference
    // Keep base64 for chat functionality
    
    // Add image chunk with all data for chat
    chunks.push({
      id: `${fileName}_image`,
      content: JSON.stringify(imageChunkData),
      metadata: {
        type: 'image',
        has_image: true,
        image_id: fileName
      }
    });
    
    formattedResult.chunks = chunks;

    return formattedResult;
  }

  /**
   * Format fast OCR result
   */
  async formatFastResult(ocrResult, imageBuffer, fileName) {
    let formattedResult = {
      type: 'image',
      fileName,
      processingType: 'fast_ocr',
      
      // Core data
      contentType: 'unknown',
      confidence: ocrResult.confidence,
      rawText: ocrResult.text || '',
      
      // OCR details
      hasOCR: !!(ocrResult.text && ocrResult.text.length > 0),
      ocrData: {
        text: ocrResult.text,
        confidence: ocrResult.confidence,
        language: await this.detectLanguage(ocrResult.text)
      },

      // Fast processing flags
      hasStructuredData: false,
      hasOpenCV: false
    };

    // Add image data if needed for visual analysis
    if (imageBuffer) {
      formattedResult.base64 = imageBuffer.toString('base64');
      formattedResult.mimeType = 'image/jpeg';
    }

    // Create chunks for consistency with advanced processing
    const chunks = [];
    
    // Add text chunk if we have OCR text
    if (ocrResult.text) {
      chunks.push({
        id: `${fileName}_text`,
        content: ocrResult.text,
        metadata: {
          type: 'text',
          source: 'fast_ocr',
          confidence: ocrResult.confidence
        }
      });
    }
    
    // Add image chunk with base64 for chat functionality
    const imageChunkData = {
      type: 'image',
      fileName,
      processingType: 'fast_ocr',
      contentType: 'unknown',
      confidence: ocrResult.confidence,
      ocrData: formattedResult.ocrData,
      base64: formattedResult.base64,
      mimeType: formattedResult.mimeType
    };
    
    chunks.push({
      id: `${fileName}_image`,
      content: JSON.stringify(imageChunkData),
      metadata: {
        type: 'image',
        has_image: true,
        image_id: fileName
      }
    });
    
    formattedResult.chunks = chunks;

    return formattedResult;
  }

  /**
   * Use CLD3 for accurate language detection
   */
  async detectLanguage(text) {
    if (!text) return 'unknown';
    
    try {
      const { detectLanguage } = require('../utils/languageDetection.cjs');
      const result = await detectLanguage(text);
      return result.code || 'en';
    } catch (error) {
      console.error('Language detection failed:', error);
      return 'en'; // Default to English
    }
  }

  /**
   * Convert table data to text
   */
  tableToText(tableData) {
    if (!tableData.headers || !tableData.rows) return '';
    
    let text = `Table with ${tableData.headers.length} columns and ${tableData.rows.length} rows:\n`;
    text += `Headers: ${tableData.headers.join(' | ')}\n`;
    
    tableData.rows.forEach((row, index) => {
      text += `Row ${index + 1}: ${row.join(' | ')}\n`;
    });
    
    return text;
  }

  /**
   * Get processing statistics
   */
  getStats() {
    const total = this.processingStats.fastOcrRequests + this.processingStats.advancedRequests;
    return {
      ...this.processingStats,
      total,
      fastOcrPercentage: total > 0 ? Math.round((this.processingStats.fastOcrRequests / total) * 100) : 0,
      advancedPercentage: total > 0 ? Math.round((this.processingStats.advancedRequests / total) * 100) : 0
    };
  }

  /**
   * Get reason for using advanced processing
   */
  getAdvancedReason(analysis, requester) {
    if (requester === 'chat') return 'chat_visual_analysis';
    if (analysis.isLikelyEducational && analysis.hasTableStructure && analysis.hasMathematical) return 'complex_educational_content';
    if (analysis.isLikelyEducational) return 'educational_content';
    if (analysis.confidence < 70) return 'low_ocr_confidence';
    return 'fallback';
  }

  /**
   * Get reason for using fast processing
   */
  getFastReason(analysis, requester) {
    if (requester === 'upload' && !analysis.isLikelyEducational) return 'upload_non_educational';
    if (!analysis.isLikelyEducational) return 'non_educational';
    return 'default_fast';
  }
}

module.exports = new SmartImageRouter(); 