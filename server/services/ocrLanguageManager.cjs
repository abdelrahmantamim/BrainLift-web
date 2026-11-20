// OCR Language Manager - Handles dynamic language loading for Tesseract
const Tesseract = require('tesseract.js');

class OCRLanguageManager {
  constructor() {
    // Map of language codes from franc to Tesseract language codes
    this.languageMap = {
      // Most common languages
      'eng': 'eng', // English
      'english': 'eng', // English alternate
      'ara': 'ara', // Arabic
      'arabic': 'ara', // Arabic alternate
      'spa': 'spa', // Spanish
      'spanish': 'spa', // Spanish alternate
      'fra': 'fra', // French
      'deu': 'deu', // German
      'ita': 'ita', // Italian
      'por': 'por', // Portuguese
      'rus': 'rus', // Russian
      'jpn': 'jpn', // Japanese
      'kor': 'kor', // Korean
      'cmn': 'chi_sim', // Chinese Simplified
      'zho': 'chi_sim', // Chinese
      'hin': 'hin', // Hindi
      'ben': 'ben', // Bengali
      'urd': 'urd', // Urdu
      'ind': 'ind', // Indonesian
      'tur': 'tur', // Turkish
      'vie': 'vie', // Vietnamese
      'tha': 'tha', // Thai
      'pol': 'pol', // Polish
      'ukr': 'ukr', // Ukrainian
      'nld': 'nld', // Dutch
      'ron': 'ron', // Romanian
      'ell': 'ell', // Greek
      'ces': 'ces', // Czech
      'hun': 'hun', // Hungarian
      'swe': 'swe', // Swedish
      'fin': 'fin', // Finnish
      'dan': 'dan', // Danish
      'nor': 'nor', // Norwegian
      'heb': 'heb', // Hebrew
      'fas': 'fas', // Persian/Farsi
      'afr': 'afr', // Afrikaans
      'swa': 'swa', // Swahili
      'tgl': 'tgl', // Tagalog/Filipino
      'msa': 'msa', // Malay
      'lat': 'lat', // Latin
      // Add more as needed
    };

    // Keep track of loaded languages per worker
    this.loadedLanguages = new Map(); // workerId -> Set of languages
    
    // Cache of available languages
    this.availableLanguages = null;
  }

  // Get Tesseract language code from detected language
  getTesseractLanguage(detectedLang) {
    if (!detectedLang || detectedLang === 'unknown' || detectedLang === 'und') {
      return 'eng'; // Default to English
    }
    
    // Check if we have a mapping
    const tesseractLang = this.languageMap[detectedLang];
    if (tesseractLang) {
      return tesseractLang;
    }
    
    // If no mapping found, default to English
    console.log(`[OCRLanguageManager] No Tesseract mapping for language: ${detectedLang}, using English`);
    return 'eng';
  }

  // Get list of available Tesseract languages
  async getAvailableLanguages() {
    if (this.availableLanguages) {
      return this.availableLanguages;
    }

    try {
      // This would ideally check which language files are available
      // For now, return commonly available languages
      this.availableLanguages = [
        'eng', 'ara', 'spa', 'fra', 'deu', 'ita', 'por', 'rus',
        'jpn', 'kor', 'chi_sim', 'hin', 'ben', 'urd', 'ind', 'tur',
        'vie', 'tha', 'pol', 'ukr', 'nld', 'ron', 'ell', 'ces',
        'hun', 'swe', 'fin', 'dan', 'nor', 'heb', 'fas'
      ];
      
      return this.availableLanguages;
    } catch (error) {
      console.error('[OCRLanguageManager] Error getting available languages:', error);
      return ['eng']; // Fallback to English only
    }
  }

  // Check if a language is supported
  async isLanguageSupported(tesseractLang) {
    const available = await this.getAvailableLanguages();
    return available.includes(tesseractLang);
  }

  // Get the best language combination for a worker
  async getBestLanguages(detectedLangs, maxLanguages = 3) {
    const languages = new Set(['eng']); // Always include English
    
    // Add detected languages if supported
    for (const lang of detectedLangs) {
      const tesseractLang = this.getTesseractLanguage(lang);
      if (await this.isLanguageSupported(tesseractLang)) {
        languages.add(tesseractLang);
      }
      
      if (languages.size >= maxLanguages) {
        break;
      }
    }
    
    return Array.from(languages);
  }

  // Check if a worker has the required languages
  hasLanguages(workerId, requiredLanguages) {
    const loaded = this.loadedLanguages.get(workerId);
    if (!loaded) return false;
    
    return requiredLanguages.every(lang => loaded.has(lang));
  }

  // Record that a worker has loaded certain languages
  recordLoadedLanguages(workerId, languages) {
    if (!this.loadedLanguages.has(workerId)) {
      this.loadedLanguages.set(workerId, new Set());
    }
    
    const loaded = this.loadedLanguages.get(workerId);
    languages.forEach(lang => loaded.add(lang));
  }

  // Clear loaded languages for a worker
  clearWorkerLanguages(workerId) {
    this.loadedLanguages.delete(workerId);
  }

  // Get language statistics
  getStats() {
    const stats = {
      totalMappings: Object.keys(this.languageMap).length,
      workersWithLanguages: this.loadedLanguages.size,
      languagesByWorker: {}
    };
    
    this.loadedLanguages.forEach((langs, workerId) => {
      stats.languagesByWorker[workerId] = Array.from(langs);
    });
    
    return stats;
  }
}

// Export singleton instance
module.exports = new OCRLanguageManager();