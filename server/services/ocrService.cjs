const Tesseract = require('tesseract.js');
const sharp = require('sharp');

class OCRService {
  constructor() {
    this.worker = null;
    this.isInitialized = false;
    this.initPromise = null;
  }

  async initialize() {
    if (this.isInitialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this._createWorker();
    await this.initPromise;
    this.isInitialized = true;
  }

  async _createWorker() {
    try {
      console.log('[OCR] Initializing Tesseract worker...');
      // Start with English only for speed, add languages on demand
      this.worker = await Tesseract.createWorker('eng');
      console.log('[OCR] Tesseract worker initialized with English');
    } catch (error) {
      console.error('[OCR] Failed to initialize worker:', error);
      throw error;
    }
  }

  async preprocessImage(buffer) {
    try {
      // Minimal preprocessing for speed
      const metadata = await sharp(buffer).metadata();
      
      // Only process if necessary
      if (metadata.width > 3000 || metadata.height > 3000) {
        // Resize large images
        const processedBuffer = await sharp(buffer)
          .resize(2048, 2048, {
            fit: 'inside',
            withoutEnlargement: true
          })
          .toBuffer();
        return processedBuffer;
      } else if (metadata.width < 500 || metadata.height < 500) {
        // Only upscale very small images
        const processedBuffer = await sharp(buffer)
          .resize(1024, 1024, {
            fit: 'inside',
            withoutEnlargement: false
          })
          .toBuffer();
        return processedBuffer;
      }
      
      // Return original for medium-sized images
      return buffer;
    } catch (error) {
      console.error('[OCR] Image preprocessing failed:', error);
      return buffer;
    }
  }

  async extractText(imageBuffer, options = {}) {
    try {
      await this.initialize();

      // Preprocess image for better OCR results
      const processedBuffer = await this.preprocessImage(imageBuffer);

      console.log('[OCR] Starting text extraction...');
      const { data } = await this.worker.recognize(processedBuffer);
      
      // Extract language detection info
      const detectedLanguage = this.detectLanguage(data.text);
      
      const result = {
        text: data.text,
        confidence: data.confidence,
        language: detectedLanguage,
        words: data.words ? data.words.map(w => ({
          text: w.text,
          confidence: w.confidence,
          bbox: w.bbox
        })) : [],
        lines: data.lines ? data.lines.map(l => ({
          text: l.text,
          confidence: l.confidence,
          bbox: l.bbox
        })) : []
      };

      console.log(`[OCR] Extraction complete. Confidence: ${data.confidence}%, Language: ${detectedLanguage}`);
      
      return result;
    } catch (error) {
      console.error('[OCR] Text extraction failed:', error);
      throw new Error(`OCR failed: ${error.message}`);
    }
  }

  detectLanguage(text) {
    // Simple language detection based on character sets
    const patterns = {
      arabic: /[\u0600-\u06FF]/,
      chinese: /[\u4E00-\u9FFF]/,
      japanese: /[\u3040-\u309F\u30A0-\u30FF]/,
      korean: /[\uAC00-\uD7AF]/,
      cyrillic: /[\u0400-\u04FF]/,
      german: /[äöüÄÖÜß]/,
      french: /[àâçèéêëîïôùûüÿæœÀÂÇÈÉÊËÎÏÔÙÛÜŸÆŒ]/,
      spanish: /[áéíóúñüÁÉÍÓÚÑÜ]/,
      portuguese: /[àáâãçéêíóôõúÀÁÂÃÇÉÊÍÓÔÕÚ]/
    };

    const textSample = text.slice(0, 500); // Check first 500 chars
    
    for (const [lang, pattern] of Object.entries(patterns)) {
      if (pattern.test(textSample)) {
        return lang;
      }
    }
    
    return 'english'; // Default
  }

  async terminate() {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
      this.isInitialized = false;
      this.initPromise = null;
      console.log('[OCR] Worker terminated');
    }
  }
}

// Create singleton instance
const ocrService = new OCRService();

// Cleanup on process exit
process.on('exit', () => {
  ocrService.terminate();
});

process.on('SIGINT', () => {
  ocrService.terminate();
  process.exit();
});

module.exports = ocrService;