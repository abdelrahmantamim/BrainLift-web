// Try to load cld3-asm, but provide fallback
let cld3 = null;
let cld3Instance = null;

try {
  const cld3Module = await import('cld3-asm');
  // Check if it's a function that needs to be called
  if (typeof cld3Module.default === 'function') {
    cld3 = cld3Module.default;
  } else if (typeof cld3Module === 'function') {
    cld3 = cld3Module;
  } else {
    // If it's already an instance, use it directly
    cld3 = cld3Module.default || cld3Module;
  }
} catch (error) {
  console.warn('cld3-asm not available, using fallback language detection');
}

async function initializeCLD3() {
  if (!cld3) return null;
  
  if (!cld3Instance) {
    try {
      // Check if cld3 is already an instance or needs to be initialized
      if (typeof cld3 === 'function') {
        cld3Instance = await cld3();
      } else if (cld3.findLanguage && typeof cld3.findLanguage === 'function') {
        // It's already an instance
        cld3Instance = cld3;
      } else {
        console.warn('CLD3 module has unexpected structure, using fallback');
        cld3Instance = null;
      }
    } catch (error) {
      console.error('Failed to initialize CLD3:', error);
      cld3Instance = null;
    }
  }
  return cld3Instance;
}

// Map language codes to names for consistency
const languageMap = {
  en: { name: 'English', code: 'en' },
  es: { name: 'Spanish', code: 'es' },
  fr: { name: 'French', code: 'fr' },
  de: { name: 'German', code: 'de' },
  it: { name: 'Italian', code: 'it' },
  pt: { name: 'Portuguese', code: 'pt' },
  ru: { name: 'Russian', code: 'ru' },
  ja: { name: 'Japanese', code: 'ja' },
  ko: { name: 'Korean', code: 'ko' },
  zh: { name: 'Chinese', code: 'zh' },
  'zh-CN': { name: 'Chinese (Simplified)', code: 'zh' },
  'zh-TW': { name: 'Chinese (Traditional)', code: 'zh' },
  ar: { name: 'Arabic', code: 'ar' },
  hi: { name: 'Hindi', code: 'hi' },
  bn: { name: 'Bengali', code: 'bn' },
  ur: { name: 'Urdu', code: 'ur' },
  vi: { name: 'Vietnamese', code: 'vi' },
  tr: { name: 'Turkish', code: 'tr' },
  pl: { name: 'Polish', code: 'pl' },
  nl: { name: 'Dutch', code: 'nl' },
  sv: { name: 'Swedish', code: 'sv' },
  da: { name: 'Danish', code: 'da' },
  no: { name: 'Norwegian', code: 'no' },
  fi: { name: 'Finnish', code: 'fi' },
  el: { name: 'Greek', code: 'el' },
  th: { name: 'Thai', code: 'th' },
  id: { name: 'Indonesian', code: 'id' },
  ms: { name: 'Malay', code: 'ms' },
  fil: { name: 'Filipino', code: 'fil' },
  cs: { name: 'Czech', code: 'cs' },
  hu: { name: 'Hungarian', code: 'hu' },
  ro: { name: 'Romanian', code: 'ro' },
  bg: { name: 'Bulgarian', code: 'bg' },
  hr: { name: 'Croatian', code: 'hr' },
  sk: { name: 'Slovak', code: 'sk' },
  sl: { name: 'Slovenian', code: 'sl' },
  lt: { name: 'Lithuanian', code: 'lt' },
  lv: { name: 'Latvian', code: 'lv' },
  et: { name: 'Estonian', code: 'et' },
  uk: { name: 'Ukrainian', code: 'uk' },
  sr: { name: 'Serbian', code: 'sr' },
  ca: { name: 'Catalan', code: 'ca' },
};

async function detectLanguage(text) {
  // Default to English if text is empty
  if (!text || text.trim().length === 0) {
    return { code: 'en', name: 'English', confidence: 0.5 };
  }

  try {
    // Initialize CLD3 if needed
    const detector = await initializeCLD3();
    
    if (detector) {
      // CLD3 can handle short text much better than franc
      const result = detector.findLanguage(text);
      
      // CLD3 returns language code and probability
      if (result && result.language && result.language !== 'und') {
        const langInfo = languageMap[result.language];
        
        if (langInfo) {
          return {
            code: langInfo.code,
            name: langInfo.name,
            confidence: result.probability || 0.9,
            isReliable: result.isReliable
          };
        }
        
        // Return the detected language even if not in our map
        return {
          code: result.language,
          name: result.language.toUpperCase(),
          confidence: result.probability || 0.8,
          isReliable: result.isReliable
        };
      }
    }
  } catch (error) {
    console.error('Language detection error:', error);
  }

  // Enhanced fallback detection for Arabic
  const arabicPattern = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/;
  if (arabicPattern.test(text)) {
    return { code: 'ar', name: 'Arabic', confidence: 0.8 };
  }

  // Check for other scripts
  const scripts = {
    'zh': /[\u4E00-\u9FFF\u3400-\u4DBF]/,
    'ja': /[\u3040-\u309F\u30A0-\u30FF]/,
    'ko': /[\uAC00-\uD7AF\u1100-\u11FF]/,
    'hi': /[\u0900-\u097F]/,
    'ru': /[\u0400-\u04FF]/,
    'el': /[\u0370-\u03FF]/,
    'th': /[\u0E00-\u0E7F]/,
  };

  for (const [code, pattern] of Object.entries(scripts)) {
    if (pattern.test(text)) {
      const langInfo = languageMap[code];
      if (langInfo) {
        return {
          code: langInfo.code,
          name: langInfo.name,
          confidence: 0.7
        };
      }
    }
  }

  // More sophisticated fallback - check for common English patterns
  const englishPatterns = [
    /\b(the|is|are|was|were|have|has|had|will|would|could|should|can|may|might)\b/i,
    /\b(and|or|but|if|then|else|when|where|what|who|why|how)\b/i,
    /\b(this|that|these|those|here|there)\b/i
  ];
  
  let englishMatches = 0;
  for (const pattern of englishPatterns) {
    if (pattern.test(text)) {
      englishMatches++;
    }
  }
  
  // If we have strong English indicators, return higher confidence
  if (englishMatches >= 3) {
    return { code: 'en', name: 'English', confidence: 0.7 };
  }
  
  // Default fallback
  return { code: 'en', name: 'English', confidence: 0.5 };
}

// Special handling for common single words (kept for backward compatibility)
const commonWords = {
  'science': 'en',
  'ciencia': 'es',
  'wissenschaft': 'de',
  'sciences': 'fr',
  'scienza': 'it',
  'ciência': 'pt',
  'наука': 'ru',
  '科学': 'zh',
  'विज्ञान': 'hi',
  'علم': 'ar',
  'رياضة': 'ar',
  'رياضيات': 'ar',
  'تاريخ': 'ar',
  'جغرافيا': 'ar',
  'فيزياء': 'ar',
  'كيمياء': 'ar',
  'أحياء': 'ar',
  'لغة': 'ar',
  'sports': 'en',
  'deporte': 'es',
  'sport': 'de',
  'esporte': 'pt',
  'спорт': 'ru',
  '体育': 'zh',
  'खेल': 'hi',
};

// Enhanced detection with context
async function detectLanguageWithContext(mainText, additionalContext = '') {
  const combinedText = `${mainText} ${additionalContext}`.trim();
  
  // Check if it's a single word we recognize
  const lowerText = mainText.toLowerCase().trim();
  if (commonWords[lowerText]) {
    const langCode = commonWords[lowerText];
    const langInfo = languageMap[langCode];
    if (langInfo) {
      return {
        code: langInfo.code,
        name: langInfo.name,
        confidence: 0.95,
      };
    }
  }
  
  // Use CLD3 for detection
  return await detectLanguage(combinedText);
}

// Detect language from multiple chunks
async function detectLanguageFromChunks(chunks) {
  if (!chunks || chunks.length === 0) {
    return { code: 'en', name: 'English', confidence: 0.5 };
  }
  
  // If we have 2 or more chunks, take two random chunks
  let selectedChunks = [];
  if (chunks.length >= 2) {
    // Get two random indices
    const indices = new Set();
    while (indices.size < 2) {
      indices.add(Math.floor(Math.random() * chunks.length));
    }
    selectedChunks = Array.from(indices).map(i => chunks[i]);
  } else {
    // Use all available chunks if less than 2
    selectedChunks = chunks;
  }
  
  // Combine the selected chunks and detect language
  const combinedText = selectedChunks.join(' ');
  const detection = await detectLanguage(combinedText);
  
  console.log('[Language Detection] Using chunks:', selectedChunks.length, 'of', chunks.length);
  console.log('[Language Detection] Detected:', detection.name, 'with confidence:', detection.confidence);
  
  return detection;
}

// Export both sync and async versions
export {
  detectLanguage,
  detectLanguageWithContext,
  detectLanguageFromChunks,
  languageMap,
  commonWords,
};