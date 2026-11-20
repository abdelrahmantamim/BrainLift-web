const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const fs = require('fs').promises;
const sharp = require('sharp');
const ocrService = require('./ocrService.cjs');
const fastOcrService = require('./fastOcrService.cjs');
const advancedImageProcessor = require('./advancedImageProcessor.cjs');
const smartImageRouter = require('./smartImageRouter.cjs');
const sharedOcrPool = require('./sharedOcrPool.cjs');
const unifiedParserClient = require('./unifiedParserClient.cjs');
const markitdownService = require('./markitdownService.cjs');

class FileProcessor {
  constructor() {
    this.chunkSize = 4000; // characters per chunk (increased for better context)
    this.overlapSize = 400; // overlap between chunks for context
    this.imageConfig = {
      maxSizeBytes: 20 * 1024 * 1024, // 20MB limit
      defaultDetail: 'low', // Default to low for cost optimization
      maxDimensionLow: 512, // Max dimension for low detail
      maxDimensionHigh: 2048, // Max dimension for high detail
      jpegQuality: 85, // JPEG quality for compression
    };
  }

  async processWithMarkItDown(buffer, mimeType, fileName) {
    try {
      console.log('[FileProcessor] Attempting to use MarkItDown for:', fileName);
      
      // Check if MarkItDown is available
      const isAvailable = await markitdownService.checkHealth();
      if (!isAvailable) {
        console.log('[FileProcessor] MarkItDown not available');
        return null;
      }
      
      // Convert to markdown
      const markdownResult = await markitdownService.convertToMarkdown(buffer, fileName, mimeType);
      
      console.log('[FileProcessor] MarkItDown conversion successful:', {
        contentLength: markdownResult.content?.length,
        hasMetadata: !!markdownResult.metadata
      });
      
      // Create structured chunks that respect markdown structure
      const chunks = markitdownService.createStructuredChunks(
        markdownResult.content, 
        fileName,
        {
          maxChunkSize: this.chunkSize,
          overlapSize: this.overlapSize,
          respectStructure: true
        }
      );
      
      return {
        chunks,
        totalChunks: chunks.length,
        totalCharacters: markdownResult.content.length,
        metadata: {
          ...markdownResult.metadata,
          format: 'markdown',
          processor: 'markitdown'
        }
      };
    } catch (error) {
      console.error('[FileProcessor] MarkItDown error:', error.message);
      return null;
    }
  }

  async processWithUnifiedParser(buffer, mimeType, fileName) {
    try {
      console.log('[FileProcessor] Attempting to use unified parser for:', fileName);
      
      // Check if unified parser is available
      const health = await unifiedParserClient.checkHealth();
      if (!health || health.status !== 'healthy') {
        console.log('[FileProcessor] Unified parser not available');
        return null;
      }
      
      // Parse the file
      const parseResult = await unifiedParserClient.parseFile(buffer, fileName, mimeType, {
        enable_ocr: true,
        extract_images: true,
        chunk_size: this.chunkSize
      });
      
      console.log('[FileProcessor] Unified parser successful:', {
        chunks: parseResult.chunks?.length,
        content_length: parseResult.content?.length
      });
      
      // Check if parser returned chunks (for PPTX) or just content
      if (parseResult.chunks && parseResult.chunks.length > 0) {
        // Parser provided chunks - use them directly
        const chunks = parseResult.chunks.map((chunk, index) => ({
          id: chunk.id || `chunk_${index}`,
          content: typeof chunk.content === 'string' ? chunk.content : JSON.stringify(chunk.content),
          metadata: {
            fileName,
            chunkIndex: index,
            ...chunk.metadata
          }
        }));
        
        return {
          chunks,
          totalChunks: chunks.length,
          totalCharacters: parseResult.content?.length || chunks.reduce((sum, c) => sum + c.content.length, 0),
          metadata: parseResult.metadata
        };
      } else {
        // Parser returned just content - chunk it ourselves
        const content = parseResult.content || '';
        const chunks = this.createChunks(content, fileName);
        
        return {
          chunks,
          totalChunks: chunks.length,
          totalCharacters: content.length,
          metadata: parseResult.metadata
        };
      }
    } catch (error) {
      console.error('[FileProcessor] Unified parser error:', error.message);
      return null;
    }
  }

  async processFile(buffer, mimeType, fileName) {
    let text = '';
    
    try {
      if (mimeType.includes('pdf')) {
        text = await this.processPDF(buffer);
      } else if (mimeType.includes('word') || mimeType.includes('docx') || 
                 (mimeType.includes('officedocument') && mimeType.includes('wordprocessingml'))) {
        text = await this.processWord(buffer);
      } else if (mimeType.includes('powerpoint') || mimeType.includes('presentation') || 
                 mimeType.includes('pptx') || 
                 (mimeType.includes('officedocument') && mimeType.includes('presentationml'))) {
        // Use PPTX extraction service if available
        try {
          const pptxService = require('./pptxExtractionService.cjs');
          const health = await pptxService.healthCheck();
          
          if (health && health.status === 'healthy') {
            console.log('[FileProcessor] Using PPTX extraction service for:', fileName);
            const extractedData = await pptxService.extractPPTX(buffer);
            
            // Convert to chunks format
            const serviceChunks = pptxService.formatForChunks(extractedData);
            
            return {
              chunks: serviceChunks,
              totalChunks: serviceChunks.length,
              totalCharacters: extractedData.extracted_text.length,
              metadata: {
                presentationTitle: extractedData.metadata.presentation_title,
                totalSlides: extractedData.metadata.total_slides,
                author: extractedData.metadata.author
              }
            };
          } else {
            console.log('[FileProcessor] PPTX service not available, using fallback');
            text = `[PowerPoint Presentation: ${fileName}]\n\nPowerPoint file processing service is temporarily unavailable. The file has been uploaded successfully but text extraction is limited.`;
          }
        } catch (error) {
          console.error('[FileProcessor] PPTX extraction failed:', error);
          // Fallback to placeholder text
          text = `[PowerPoint Presentation: ${fileName}]\n\nPowerPoint file processing encountered an error: ${error.message}. The file has been uploaded successfully but text extraction is limited.`;
        }
      } else if (mimeType.includes('text') || mimeType.includes('plain')) {
        text = buffer.toString('utf-8');
      } else if (mimeType.includes('image')) {
        // Process image with OCR and AI analysis
        const processedImage = await this.processImageWithOCR(buffer, mimeType, fileName);
        
        return {
          chunks: [{
            content: JSON.stringify(processedImage),
            metadata: { 
              type: 'image', 
              fileName, 
              mimeType,
              optimized: processedImage.optimized,
              dimensions: processedImage.dimensions,
              hasOCR: processedImage.hasOCR,
              language: processedImage.ocrData?.language
            }
          }],
          totalChunks: 1,
          totalCharacters: processedImage.base64.length + (processedImage.ocrData?.text?.length || 0)
        };
      } else {
        throw new Error(`Unsupported file type: ${mimeType}`);
      }

      // Split text into chunks
      const chunks = this.createChunks(text, fileName);
      
      return {
        chunks,
        totalChunks: chunks.length,
        totalCharacters: text.length
      };
    } catch (error) {
      console.error('File processing error:', error);
      throw error;
    }
  }

  async processPDF(buffer) {
    try {
      const data = await pdfParse(buffer);
      return data.text;
    } catch (error) {
      console.error('PDF parsing error:', error);
      throw new Error('Failed to parse PDF file');
    }
  }

  async processWord(buffer) {
    try {
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    } catch (error) {
      console.error('Word parsing error:', error);
      throw new Error('Failed to parse Word document');
    }
  }

  async processImageForAI(buffer, mimeType, fileName) {
    try {
      // Get image metadata
      const metadata = await sharp(buffer).metadata();
      
      // Calculate if resizing is needed
      const maxDimension = 512; // For low detail mode
      const needsResize = metadata.width > maxDimension || metadata.height > maxDimension;
      
      let processedBuffer = buffer;
      let optimized = false;
      
      if (needsResize) {
        // Resize image to max 512x512 for cost optimization
        processedBuffer = await sharp(buffer)
          .resize(maxDimension, maxDimension, {
            fit: 'inside',
            withoutEnlargement: true
          })
          .jpeg({ quality: 80 }) // Convert to JPEG for smaller size
          .toBuffer();
        optimized = true;
      }
      
      const base64Image = processedBuffer.toString('base64');
      
      const result = {
        type: 'image',
        fileName,
        mimeType: optimized ? 'image/jpeg' : mimeType,
        base64: base64Image,
        originalSize: buffer.length,
        processedSize: processedBuffer.length,
        optimized,
        dimensions: {
          original: { width: metadata.width, height: metadata.height },
          processed: optimized ? { width: Math.min(metadata.width, maxDimension), height: Math.min(metadata.height, maxDimension) } : { width: metadata.width, height: metadata.height }
        },
        costSavings: optimized ? `${Math.round((1 - processedBuffer.length / buffer.length) * 100)}%` : '0%'
      };
      
      if (optimized) {
        console.log(`Image optimized: ${fileName} - Original: ${buffer.length} bytes, Processed: ${processedBuffer.length} bytes (${result.costSavings} reduction)`);
      }
      
      return result;
    } catch (error) {
      console.error('Image processing error:', error);
      // Fallback to original if processing fails
      const base64Image = buffer.toString('base64');
      return {
        type: 'image',
        fileName,
        mimeType,
        base64: base64Image,
        originalSize: buffer.length,
        processedSize: buffer.length,
        optimized: false,
        dimensions: { original: { width: 0, height: 0 }, processed: { width: 0, height: 0 } },
        costSavings: '0%'
      };
    }
  }

  createChunks(text, fileName) {
    const chunks = [];
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    
    let currentChunk = '';
    let chunkIndex = 0;
    
    for (const sentence of sentences) {
      if (currentChunk.length + sentence.length > this.chunkSize && currentChunk.length > 0) {
        // Save current chunk
        chunks.push({
          id: `chunk_${chunkIndex}`,
          content: currentChunk.trim(),
          metadata: {
            fileName,
            chunkIndex,
            startChar: Math.max(0, (chunkIndex * this.chunkSize) - (chunkIndex * this.overlapSize)),
            endChar: Math.min(text.length, ((chunkIndex + 1) * this.chunkSize) - (chunkIndex * this.overlapSize))
          }
        });
        
        // Start new chunk with overlap
        const words = currentChunk.split(' ');
        const overlapWords = words.slice(-Math.floor(words.length * 0.2)); // 20% overlap
        currentChunk = overlapWords.join(' ') + ' ' + sentence;
        chunkIndex++;
      } else {
        currentChunk += sentence + ' ';
      }
    }
    
    // Don't forget the last chunk
    if (currentChunk.trim().length > 0) {
      chunks.push({
        id: `chunk_${chunkIndex}`,
        content: currentChunk.trim(),
        metadata: {
          fileName,
          chunkIndex,
          startChar: Math.max(0, (chunkIndex * this.chunkSize) - (chunkIndex * this.overlapSize)),
          endChar: text.length
        }
      });
    }
    
    return chunks;
  }

  // Process image with OCR and AI analysis
  async processImageWithOCR(buffer, mimeType, fileName) {
    try {
      // First, process the image for AI analysis
      const aiProcessedImage = await this.processImageForAI(buffer, mimeType, fileName);
      
      // Then, perform OCR to extract text
      let ocrData = null;
      try {
        console.log(`[FileProcessor] Performing shared OCR on ${fileName}...`);
        // Use shared OCR pool for better performance and consistency
        ocrData = await sharedOcrPool.extractText(buffer);
        console.log(`[FileProcessor] OCR completed in ${ocrData.duration}ms. Extracted ${ocrData.text.length} characters`);
      } catch (ocrError) {
        console.error(`[FileProcessor] OCR failed for ${fileName}:`, ocrError);
        // OCR failure is not critical - we still have the image for AI analysis
      }
      
      // Combine AI processing and OCR results
      return {
        ...aiProcessedImage,
        hasOCR: !!ocrData,
        ocrData: ocrData ? {
          text: ocrData.text,
          confidence: ocrData.confidence,
          duration: ocrData.duration
        } : null
      };
    } catch (error) {
      console.error('Image processing with OCR error:', error);
      throw error;
    }
  }

  // Process image for AI analysis with optimization
  async processImageForAI(buffer, mimeType, fileName) {
    try {
      // Validate image size
      if (buffer.length > this.imageConfig.maxSizeBytes) {
        throw new Error(`Image file ${fileName} exceeds maximum size of 20MB`);
      }

      // Get image metadata
      const image = sharp(buffer);
      const metadata = await image.metadata();
      
      // Determine optimal processing based on image dimensions
      const { width, height } = metadata;
      const maxDimension = Math.max(width, height);
      const detail = this.imageConfig.defaultDetail;
      const targetMaxDimension = detail === 'low' 
        ? this.imageConfig.maxDimensionLow 
        : this.imageConfig.maxDimensionHigh;
      
      let processedBuffer = buffer;
      let optimized = false;
      let finalDimensions = { width, height };
      
      // Resize if needed for cost optimization
      if (maxDimension > targetMaxDimension) {
        try {
          const resizeOptions = width > height
            ? { width: targetMaxDimension }
            : { height: targetMaxDimension };
          
          processedBuffer = await sharp(buffer)
            .resize(resizeOptions)
            .jpeg({ quality: this.imageConfig.jpegQuality })
            .toBuffer();
          
          optimized = true;
          
          // Get new dimensions
          const newMetadata = await sharp(processedBuffer).metadata();
          finalDimensions = { width: newMetadata.width, height: newMetadata.height };
        } catch (resizeError) {
          console.warn(`[FileProcessor] Failed to resize image ${fileName}:`, resizeError.message);
          // If resize fails (e.g., image too small), use original
          processedBuffer = buffer;
          optimized = false;
        }
      }
      
      // Convert to base64
      const base64 = processedBuffer.toString('base64');
      
      return {
        type: 'image',
        fileName,
        mimeType,
        base64,
        size: processedBuffer.length,
        originalSize: buffer.length,
        optimized,
        dimensions: finalDimensions,
        detail,
        compressionRatio: optimized ? (processedBuffer.length / buffer.length).toFixed(2) : 1
      };
    } catch (error) {
      console.error('Image processing error:', error);
      throw error;
    }
  }

  // Search through chunks for relevant content
  findRelevantChunks(chunks, query, maxChunks = 3) {
    const queryLower = query.toLowerCase();
    const queryWords = queryLower.split(' ').filter(w => w.length > 2);
    
    // Score each chunk based on relevance
    const scoredChunks = chunks.map(chunk => {
      // Skip image chunks for text search
      if (chunk.metadata && chunk.metadata.type === 'image') {
        return { ...chunk, score: 0 };
      }
      
      const contentLower = chunk.content.toLowerCase();
      let score = 0;
      
      // Exact phrase match
      if (contentLower.includes(queryLower)) {
        score += 10;
      }
      
      // Individual word matches
      queryWords.forEach(word => {
        const matches = (contentLower.match(new RegExp(word, 'g')) || []).length;
        score += matches * 2;
      });
      
      return { ...chunk, score };
    });
    
    // Sort by score and return top chunks
    return scoredChunks
      .sort((a, b) => b.score - a.score)
      .filter(chunk => chunk.score > 0)
      .slice(0, maxChunks)
      .map(({ score, ...chunk }) => chunk);
  }

  // Enhanced image processing with educational content analysis
  async processEducationalImageWithAnalysis(buffer, mimeType, fileName) {
    try {
      console.log(`[FileProcessor] Processing educational image ${fileName} with advanced analysis...`);
      
      // Use the advanced image processor for comprehensive analysis
      const advancedResult = await advancedImageProcessor.processEducationalImage(buffer, fileName);
      
      // Also get the basic AI processing for compatibility
      const basicResult = await this.processImageForAI(buffer, mimeType, fileName);
      
      // Combine results
      return {
        ...basicResult,
        advancedAnalysis: advancedResult,
        processingType: 'advanced_educational',
        structuredData: this.formatStructuredDataForAI(advancedResult)
      };
    } catch (error) {
      console.error(`[FileProcessor] Advanced educational processing failed for ${fileName}, falling back to basic processing:`, error);
      // Fallback to basic processing
      return await this.processImageWithOCR(buffer, mimeType, fileName);
    }
  }

  // Format the structured data in a way that's easy for AI to understand
  formatStructuredDataForAI(advancedResult) {
    const { contentType, extractedData, ocrResult } = advancedResult;
    
    let formattedData = {
      contentType: contentType.primary,
      confidence: advancedResult.metadata.confidence,
      rawText: ocrResult.text || ''
    };

    // Format based on content type
    switch (contentType.primary) {
      case 'exercise':
        if (extractedData.exercise) {
          formattedData.exercise = {
            questionNumber: extractedData.exercise.questionNumber,
            questionText: extractedData.exercise.questionText,
            instructions: extractedData.exercise.instructions,
            problemType: extractedData.exercise.problemType,
            hasTableData: !!extractedData.exercise.tableData
          };
          
          if (extractedData.exercise.tableData) {
            formattedData.tableData = extractedData.exercise.tableData;
          }
        }
        break;
        
      case 'table':
        if (extractedData.table) {
          formattedData.tableData = extractedData.table;
          // Create a text representation for the AI
          formattedData.tableText = this.tableToText(extractedData.table);
        }
        break;
        
      case 'mathematics':
        if (extractedData.mathematics) {
          formattedData.mathematics = extractedData.mathematics;
        }
        break;
    }

    // Add chart data if detected
    if (extractedData.pieChart) {
      formattedData.chartData = {
        type: 'pie',
        data: extractedData.pieChart.data
      };
    }
    
    if (extractedData.barChart) {
      formattedData.chartData = {
        type: 'bar',
        data: extractedData.barChart.data
      };
    }

    return formattedData;
  }

  // Convert table data to readable text format
  tableToText(tableData) {
    if (!tableData.headers || !tableData.rows) return '';
    
    let text = `Table with ${tableData.headers.length} columns and ${tableData.rows.length} rows:\n`;
    text += `Headers: ${tableData.headers.join(' | ')}\n`;
    
    tableData.rows.forEach((row, index) => {
      text += `Row ${index + 1}: ${row.join(' | ')}\n`;
    });
    
    return text;
  }

  // Enhanced file processing that automatically chooses the best approach
  async processFileIntelligent(buffer, mimeType, fileName, requester = 'upload', needsVisual = false, languageHint = null) {
    try {
      console.log(`[FileProcessor] Starting intelligent processing for ${fileName} (requester: ${requester})`);
      
      const startTime = Date.now();
      
      // Check if it's an image - process with advanced image processing
      if (mimeType.startsWith('image/')) {
        console.log(`[FileProcessor] Detected image file, using advanced image processing`);
        
        // Auto-detect if we might need advanced OCR for non-Latin scripts
        const filenameLower = fileName.toLowerCase();
        const mightBeNonLatin = 
            filenameLower.includes('arabic') || 
            filenameLower.includes('arab') ||
            filenameLower.includes('عرب') || // Arabic word for Arabic
            filenameLower.includes('chinese') ||
            filenameLower.includes('japanese') ||
            filenameLower.includes('korean') ||
            filenameLower.includes('hindi') ||
            filenameLower.includes('hebrew') ||
            filenameLower.includes('thai') ||
            filenameLower.includes('persian') ||
            filenameLower.includes('farsi') ||
            filenameLower.includes('urdu');
            
        let needsAdvanced = needsVisual; // Default to needsVisual parameter
        
        if (mightBeNonLatin && requester === 'upload') {
            console.log('[FileProcessor] Filename suggests non-Latin content, forcing advanced processing for better language detection');
            needsAdvanced = true;
        }
        
        const context = {
          requester,
          needsVisual,
          needsAdvanced, // Pass this to the router
          priority: this.getPriorityForRequester(requester),
          languageHint // Pass language hint to router
        };
        
        const routingResult = await smartImageRouter.processImage(buffer, fileName, context);
        
        const processingTime = Date.now() - startTime;
        console.log(`[FileProcessor] Smart image processing completed in ${processingTime}ms (${routingResult.type})`);
        
        return {
          ...routingResult.result,
          processingTime,
          routingType: routingResult.type,
          routingConfidence: routingResult.confidence
        };
      }
      
      // For non-images, try MarkItDown first if supported
      if (markitdownService.isSupported(mimeType, fileName)) {
        try {
          const markdownResult = await this.processWithMarkItDown(buffer, mimeType, fileName);
          if (markdownResult && markdownResult.totalCharacters > 100) {
            const processingTime = Date.now() - startTime;
            console.log(`[FileProcessor] MarkItDown completed in ${processingTime}ms`);
            return markdownResult;
          }
        } catch (markitdownError) {
          console.log(`[FileProcessor] MarkItDown failed: ${markitdownError.message}, trying unified parser`);
        }
      }
      
      // Try unified parser as fallback
      const unifiedResult = await this.processWithUnifiedParser(buffer, mimeType, fileName);
      
      // Check if unified parser returned meaningful content
      if (unifiedResult && unifiedResult.totalCharacters > 100) {
        const processingTime = Date.now() - startTime;
        console.log(`[FileProcessor] Unified parser completed in ${processingTime}ms`);
        return unifiedResult;
      } else if (unifiedResult) {
        console.log(`[FileProcessor] Unified parser returned minimal content (${unifiedResult.totalCharacters} chars), falling back to direct processing`);
      }
      
      // For non-images, use existing processing
      return await this.processFile(buffer, mimeType, fileName);
    } catch (error) {
      console.error(`[FileProcessor] Intelligent processing failed for ${fileName}:`, error);
      // Fallback to basic processing
      return await this.processFile(buffer, mimeType, fileName);
    }
  }

  /**
   * Get processing priority based on requester context
   */
  getPriorityForRequester(requester) {
    switch (requester) {
      case 'chat':
        return 'normal'; // Chat needs good balance of speed and accuracy
      case 'quiz':
      case 'flashcards':
        return 'normal'; // Educational features need structured data when available
      case 'upload':
        return 'thorough'; // File uploads can take more time for better results
      default:
        return 'normal';
    }
  }
}

module.exports = new FileProcessor();