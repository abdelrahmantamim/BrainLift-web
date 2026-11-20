// Pre-initialize OCR pool at server startup
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

export async function initializeOcrPool() {
  try {
    console.log('[Server] Pre-initializing OCR pool...');
    const sharedOcrPool = require('../services/sharedOcrPool.cjs');
    await sharedOcrPool.initialize();
    console.log('[Server] OCR pool initialized successfully');
  } catch (error) {
    console.error('[Server] Failed to initialize OCR pool:', error);
    // Don't fail server startup if OCR initialization fails
  }
}