const axios = require('axios');
const FormData = require('form-data');

// Simple logger wrapper
const logger = {
  info: (...args) => console.log('[UnifiedParser]', ...args),
  error: (...args) => console.error('[UnifiedParser]', ...args),
  warn: (...args) => console.warn('[UnifiedParser]', ...args)
};

class UnifiedParserClient {
  constructor() {
    this.baseURL = process.env.UNIFIED_PARSER_URL;
    if (!this.baseURL) {
      logger.warn('UNIFIED_PARSER_URL is not set — parser features will be unavailable');
    }
    this.apiKey = process.env.UNIFIED_PARSER_API_KEY;
    this.timeout = 120000; // 120 seconds for large files
    
    // Create axios instance
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: this.timeout,
      maxBodyLength: Infinity,
      maxContentLength: Infinity
    });
    
    // Add request/response interceptors for logging
    this.client.interceptors.request.use(
      (config) => {
        logger.info('Request', {
          method: config.method,
          url: config.url,
          hasFile: !!config.data
        });
        return config;
      },
      (error) => {
        logger.error('Request error', error);
        return Promise.reject(error);
      }
    );
    
    this.client.interceptors.response.use(
      (response) => {
        logger.info('Response', {
          status: response.status,
          url: response.config.url
        });
        return response;
      },
      (error) => {
        logger.error('Response error', {
          status: error.response?.status,
          message: error.response?.data?.detail || error.message
        });
        return Promise.reject(error);
      }
    );
  }
  
  async checkHealth() {
    try {
      const response = await this.client.get('/health');
      return response.data;
    } catch (error) {
      logger.error('Health check failed:', error);
      return null;
    }
  }
  
  async parseFile(buffer, fileName, mimeType, options = {}) {
    try {
      // Create form data
      const formData = new FormData();
      formData.append('file', buffer, {
        filename: fileName,
        contentType: mimeType
      });
      
      // Add options as query parameters
      const params = new URLSearchParams();
      if (options.extract_images !== undefined) params.append('extract_images', options.extract_images);
      if (options.enable_ocr !== undefined) params.append('enable_ocr', options.enable_ocr);
      if (options.chunk_size) params.append('chunk_size', options.chunk_size);
      if (options.language) params.append('language', options.language);
      
      const response = await this.client.post('/parse', formData, {
        headers: {
          ...formData.getHeaders(),
          'Authorization': `Bearer ${this.apiKey}`
        },
        params
      });
      
      return response.data;
    } catch (error) {
      if (error.response?.status === 401) {
        throw new Error('Invalid API key for unified parser service');
      } else if (error.response?.status === 400) {
        throw new Error(`Parser error: ${error.response.data.detail || 'Invalid file'}`);
      } else if (error.response?.status === 415) {
        throw new Error(`Unsupported file type: ${mimeType}`);
      } else {
        throw new Error(`Parser service error: ${error.message}`);
      }
    }
  }
  
  async getSupportedFormats() {
    try {
      const response = await this.client.get('/supported-formats', {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });
      return response.data;
    } catch (error) {
      logger.error('Failed to get supported formats:', error);
      return null;
    }
  }
}

// Export singleton instance
module.exports = new UnifiedParserClient();