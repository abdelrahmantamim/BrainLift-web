const Tesseract = require('tesseract.js');
const sharp = require('sharp');

class FastOCRService {
  constructor() {
    this.worker = null;
    this.scheduler = null;
    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized) return;

    try {
      console.log('[FastOCR] Initializing worker pool...');
      
      // Create a scheduler for managing multiple workers
      this.scheduler = Tesseract.createScheduler();
      
      // Create 2 workers for parallel processing
      const workerCount = 2;
      const workers = [];
      
      for (let i = 0; i < workerCount; i++) {
        const worker = await Tesseract.createWorker('eng');
        
        // Set recognition parameters for speed (using string values for compatibility)
        await worker.setParameters({
          tessedit_ocr_engine_mode: '1', // LSTM_ONLY
          tessedit_pageseg_mode: '3', // AUTO
        });
        
        workers.push(worker);
        this.scheduler.addWorker(worker);
      }
      
      this.isInitialized = true;
      console.log(`[FastOCR] Initialized with ${workerCount} workers`);
    } catch (error) {
      console.error('[FastOCR] Initialization failed:', error);
      throw error;
    }
  }

  async quickPreprocess(buffer) {
    try {
      const metadata = await sharp(buffer).metadata();
      
      // Only resize if really necessary
      if (metadata.width > 4000 || metadata.height > 4000) {
        return sharp(buffer)
          .resize(2048, 2048, { fit: 'inside' })
          .toBuffer();
      }
      
      return buffer;
    } catch (error) {
      return buffer;
    }
  }

  async extractText(imageBuffer) {
    try {
      await this.initialize();
      
      const processedBuffer = await this.quickPreprocess(imageBuffer);
      
      const startTime = Date.now();
      console.log('[FastOCR] Starting text extraction...');
      
      // Use scheduler for load balancing
      const { data } = await this.scheduler.addJob('recognize', processedBuffer);
      
      const duration = Date.now() - startTime;
      console.log(`[FastOCR] Extraction complete in ${duration}ms`);
      
      return {
        text: data.text,
        confidence: data.confidence,
        duration: duration
      };
    } catch (error) {
      console.error('[FastOCR] Text extraction failed:', error);
      throw error;
    }
  }

  async terminate() {
    if (this.scheduler) {
      await this.scheduler.terminate();
      this.scheduler = null;
      this.isInitialized = false;
    }
  }
}

// Export singleton instance
module.exports = new FastOCRService();