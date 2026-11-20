const sharp = require('sharp');

class SharedOcrPool {
  constructor() {
    this.openai = null;
    this.isInitialized = false;
    this.initPromise = null;
    this.model = null; // Loaded from DB config
    this.getModelConfig = null;
  }

  async initialize() {
    if (this.isInitialized) {
      return;
    }

    if (this.initPromise) {
      return await this.initPromise;
    }

    this.initPromise = this._doInitialize();
    try {
      await this.initPromise;
    } finally {
      this.initPromise = null;
    }
  }

  async _doInitialize() {
    try {
      console.log('[SharedOcrPool] Initializing with GPT Vision OCR...');

      // Dynamic import for ESM modules
      const { getOpenAI } = await import('../config/services.config.js');
      const { getModelConfig } = await import('../utils/modelConfig.js');
      this.openai = getOpenAI();
      this.getModelConfig = getModelConfig;

      if (!this.openai) {
        throw new Error('OpenAI client not initialized');
      }

      // Get model from DB config (files feature), fallback to default
      const config = this.getModelConfig();
      this.model = config.files?.model_name || 'gpt-5.4-nano';

      this.isInitialized = true;
      console.log(`[SharedOcrPool] Initialized with GPT Vision (${this.model})`);
    } catch (error) {
      console.error('[SharedOcrPool] Initialization failed:', error);
      this.isInitialized = false;
      throw error;
    }
  }

  async preprocessImageForOCR(imageBuffer) {
    try {
      const metadata = await sharp(imageBuffer).metadata();

      // Convert to JPEG for consistent format and smaller payload
      let pipeline = sharp(imageBuffer);

      // Upscale very small images
      if (metadata.width < 200 || metadata.height < 200) {
        const scale = Math.max(200 / metadata.width, 200 / metadata.height, 2);
        pipeline = pipeline.resize(
          Math.round(metadata.width * scale),
          Math.round(metadata.height * scale),
          { kernel: sharp.kernel.lanczos3, fit: 'fill' }
        );
      }

      // Convert to JPEG, keep quality high for OCR accuracy
      return await pipeline.jpeg({ quality: 90 }).toBuffer();
    } catch (error) {
      console.error('[SharedOcrPool] Image preprocessing failed:', error);
      return imageBuffer;
    }
  }

  async extractText(imageBuffer, options = {}) {
    await this.initialize();

    const startTime = Date.now();

    try {
      // Refresh model from DB config in case it changed
      if (this.getModelConfig) {
        const config = this.getModelConfig();
        this.model = config.files?.model_name || this.model;
      }

      // Preprocess image
      const processedBuffer = await this.preprocessImageForOCR(imageBuffer);
      const base64Image = processedBuffer.toString('base64');

      // Build the prompt — include language hint if available
      let prompt = 'Extract ALL text from this image. Return ONLY the extracted text, nothing else. Preserve the original language — do not translate. If the text is handwritten, do your best to read it accurately. If there are multiple columns or sections, read them in logical order.';

      if (options.languages && options.languages.length > 0) {
        const langNames = options.languages.filter(l => l !== 'eng').join(', ');
        if (langNames) {
          prompt += ` The text may be in these languages: ${langNames}. Preserve the original language.`;
        }
      }

      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${base64Image}`,
                  detail: 'high'
                }
              }
            ]
          }
        ],
        max_completion_tokens: 4096,
      });

      const text = response.choices?.[0]?.message?.content?.trim() || '';
      const duration = Date.now() - startTime;

      if (!text) {
        console.warn(`[SharedOcrPool] GPT Vision returned empty text. Model: ${this.model}, Response choices: ${JSON.stringify(response.choices?.length)}, finish_reason: ${response.choices?.[0]?.finish_reason}`);
      }

      // Detect language from extracted text
      let detectedLanguage = 'unknown';
      if (text && text.length > 20) {
        try {
          const { detectLanguage } = require('../utils/languageDetection.cjs');
          const langResult = detectLanguage(text);
          detectedLanguage = langResult.language;
        } catch (error) {
          console.warn('[SharedOcrPool] Language detection failed:', error.message);
        }
      }

      console.log(`[SharedOcrPool] GPT Vision OCR completed in ${duration}ms, extracted ${text.length} chars, language: ${detectedLanguage}`);

      return {
        text,
        confidence: text.length > 0 ? 0.95 : 0, // GPT Vision is high confidence when it returns text
        words: [],
        lines: [],
        paragraphs: [],
        duration,
        detectedLanguage
      };
    } catch (error) {
      console.error('[SharedOcrPool] GPT Vision OCR failed:', error.message);
      console.error('[SharedOcrPool] Model used:', this.model);
      console.error('[SharedOcrPool] Error details:', JSON.stringify({ status: error.status, code: error.code, type: error.type }, null, 2));
      return {
        text: '',
        confidence: 0,
        words: [],
        lines: [],
        paragraphs: [],
        duration: Date.now() - startTime,
        error: error.message,
        detectedLanguage: 'unknown'
      };
    }
  }

  async ensureLanguageSupport(/* languages */) {
    // No-op — GPT Vision handles all languages natively
    return;
  }

  async terminate() {
    this.openai = null;
    this.isInitialized = false;
    console.log('[SharedOcrPool] Terminated GPT Vision OCR pool');
  }

  getStatus() {
    return {
      isInitialized: this.isInitialized,
      workerCount: 0,
      activeJobs: 0,
      engine: 'gpt-vision'
    };
  }
}

// Export singleton instance
module.exports = new SharedOcrPool();
