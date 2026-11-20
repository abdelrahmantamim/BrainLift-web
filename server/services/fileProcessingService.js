import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const fileProcessor = require('./fileProcessor.cjs');

// Intelligent chunking configuration
const CHUNK_CONFIG = {
  minChunkSize: 500,
  maxChunkSize: 2000,
  overlapSize: 100,
  semanticBoundaries: true,
};

export async function processFile(buffer, mimeType, filename) {
  try {
    console.log(`[FileProcessing] Processing ${filename} (${mimeType})`);

    // Use the existing file processor
    const result = await fileProcessor.processFileIntelligent(
      buffer,
      mimeType,
      filename,
      'upload',
      false // verbose logging
    );

    // Ensure we have proper chunks
    if (!result.chunks || result.chunks.length === 0) {
      // If no chunks, create a single chunk from the full text
      const fullText = result.fullText || result.text || '';
      if (fullText) {
        result.chunks = createSemanticChunks(fullText);
      } else {
        throw new Error('No text content extracted from file');
      }
    }

    return {
      fullText: result.fullText || result.text || '',
      chunks: result.chunks,
      metadata: {
        processingEngine: result.processingEngine || 'unknown',
        mimeType,
        filename,
        ...result.metadata,
      },
      structuredData: result.structuredData || null,
    };

  } catch (error) {
    console.error(`[FileProcessing] Error processing ${filename}:`, error);
    throw error;
  }
}

// Create semantic chunks from text
function createSemanticChunks(text) {
  const chunks = [];
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  
  let currentChunk = '';
  let currentIndex = 0;

  for (const sentence of sentences) {
    const trimmedSentence = sentence.trim();
    
    // If adding this sentence would exceed max chunk size, save current chunk
    if (currentChunk && (currentChunk.length + trimmedSentence.length > CHUNK_CONFIG.maxChunkSize)) {
      chunks.push({
        content: currentChunk.trim(),
        metadata: {
          chunkIndex: chunks.length,
          startChar: currentIndex,
          endChar: currentIndex + currentChunk.length,
        },
      });
      
      // Start new chunk with overlap
      const overlap = currentChunk.split(' ').slice(-10).join(' ');
      currentChunk = overlap + ' ' + trimmedSentence;
      currentIndex += currentChunk.length - overlap.length;
    } else {
      currentChunk += (currentChunk ? ' ' : '') + trimmedSentence;
    }
  }

  // Add final chunk
  if (currentChunk.trim()) {
    chunks.push({
      content: currentChunk.trim(),
      metadata: {
        chunkIndex: chunks.length,
        startChar: currentIndex,
        endChar: currentIndex + currentChunk.length,
      },
    });
  }

  // If no chunks created, create a single chunk
  if (chunks.length === 0 && text.trim()) {
    chunks.push({
      content: text.trim(),
      metadata: {
        chunkIndex: 0,
        startChar: 0,
        endChar: text.length,
      },
    });
  }

  return chunks;
}

// Process educational images
export async function processEducationalImage(buffer, filename) {
  try {
    console.log(`[FileProcessing] Processing educational image: ${filename}`);

    // Use advanced image processor if available
    try {
      const { default: advancedImageProcessor } = await import('./advancedImageProcessor.cjs');
      const result = await advancedImageProcessor.processEducationalImage(buffer, filename);
      
      return {
        fullText: result.ocrResult?.text || '',
        contentType: result.contentType?.primary || 'unknown',
        confidence: result.metadata?.confidence || 0,
        structuredData: result.structuredData || null,
        metadata: {
          hasOpenCV: result.metadata?.hasOpenCV || false,
          processingEngine: 'advanced',
          ...result.metadata,
        },
      };
    } catch (error) {
      console.log('[FileProcessing] Advanced image processor not available, using basic OCR');
      // Fall back to basic processing
      const result = await fileProcessor.processFileIntelligent(
        buffer,
        'image/png',
        filename,
        'upload',
        false
      );
      
      return {
        fullText: result.fullText || result.text || '',
        contentType: 'image',
        confidence: 0.7,
        structuredData: result.structuredData || null,
        metadata: {
          processingEngine: 'basic',
        },
      };
    }
  } catch (error) {
    console.error(`[FileProcessing] Error processing image ${filename}:`, error);
    throw error;
  }
}