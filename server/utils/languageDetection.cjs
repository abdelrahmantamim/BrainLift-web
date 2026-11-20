// Language detection utilities - CommonJS version with dynamic import
let franc;

// Initialize franc asynchronously
(async () => {
  const francModule = await import('franc-min');
  franc = francModule.franc;
})();

// Simple language detection using franc
function detectLanguage(text) {
  if (!text || typeof text !== 'string' || text.trim().length < 10) {
    return {
      language: 'unknown',
      confidence: 0,
      method: 'insufficient_text'
    };
  }

  // If franc hasn't loaded yet, return unknown
  if (!franc) {
    return {
      language: 'unknown',
      confidence: 0,
      method: 'loading'
    };
  }

  try {
    // Use franc for language detection
    const detectedLang = franc(text);
    
    // Map franc language codes to common names
    const languageMap = {
      'eng': 'english',
      'ara': 'arabic',
      'arb': 'arabic', // Modern Standard Arabic
      'fra': 'french',
      'spa': 'spanish',
      'deu': 'german',
      'ita': 'italian',
      'por': 'portuguese',
      'rus': 'russian',
      'jpn': 'japanese',
      'kor': 'korean',
      'cmn': 'chinese',
      'zho': 'chinese',
      'hin': 'hindi',
      'urd': 'urdu',
      'fas': 'persian',
      'heb': 'hebrew',
      'tur': 'turkish',
      'und': 'unknown'
    };

    const language = languageMap[detectedLang] || 'unknown';
    const confidence = detectedLang === 'und' ? 0 : 0.7; // franc doesn't provide confidence scores

    return {
      language,
      confidence,
      method: 'franc'
    };
  } catch (error) {
    console.error('Language detection error:', error);
    return {
      language: 'unknown',
      confidence: 0,
      method: 'error'
    };
  }
}

module.exports = {
  detectLanguage
};