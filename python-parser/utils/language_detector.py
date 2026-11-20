"""
Language Detection Utility
"""

from typing import Optional, Dict
import langdetect
from langdetect import detect_langs, LangDetectException
import franc

# Language code mappings
LANGUAGE_NAMES = {
    'en': 'English',
    'es': 'Spanish', 
    'fr': 'French',
    'de': 'German',
    'it': 'Italian',
    'pt': 'Portuguese',
    'ru': 'Russian',
    'ja': 'Japanese',
    'ko': 'Korean',
    'zh-cn': 'Chinese (Simplified)',
    'zh-tw': 'Chinese (Traditional)',
    'ar': 'Arabic',
    'hi': 'Hindi',
    'bn': 'Bengali',
    'ur': 'Urdu',
    'vi': 'Vietnamese',
    'tr': 'Turkish',
    'pl': 'Polish',
    'nl': 'Dutch',
    'sv': 'Swedish',
    'da': 'Danish',
    'no': 'Norwegian',
    'fi': 'Finnish',
    'el': 'Greek',
    'th': 'Thai',
    'id': 'Indonesian',
    'ms': 'Malay',
    'fil': 'Filipino',
}

def detect_language(text: str, fallback: str = 'en') -> str:
    """
    Detect language of text using multiple libraries for accuracy
    
    Args:
        text: Text to analyze
        fallback: Language code to use if detection fails
        
    Returns:
        ISO 639-1 language code
    """
    if not text or len(text.strip()) < 10:
        return fallback
    
    try:
        # Try langdetect first (more accurate for longer text)
        detected = langdetect.detect(text)
        
        # Validate detection with confidence
        langs = detect_langs(text)
        if langs and langs[0].prob > 0.8:
            return detected
        
        # If low confidence, try franc as fallback
        franc_result = franc.detect(text)
        if franc_result and franc_result != 'und':
            # Convert franc's ISO 639-3 to ISO 639-1
            lang_map = {
                'eng': 'en',
                'spa': 'es',
                'fra': 'fr',
                'deu': 'de',
                'ita': 'it',
                'por': 'pt',
                'rus': 'ru',
                'jpn': 'ja',
                'kor': 'ko',
                'cmn': 'zh-cn',
                'ara': 'ar',
                'hin': 'hi',
                'ben': 'bn',
                'urd': 'ur',
                'vie': 'vi',
                'tur': 'tr',
                'pol': 'pl',
                'nld': 'nl',
                'swe': 'sv',
                'dan': 'da',
                'nor': 'no',
                'fin': 'fi',
                'ell': 'el',
                'heb': 'he',
                'tha': 'th',
                'ind': 'id',
                'msa': 'ms',
                'fil': 'fil',
            }
            
            if franc_result in lang_map:
                return lang_map[franc_result]
        
        return detected
        
    except LangDetectException:
        return fallback
    except Exception as e:
        print(f"Language detection error: {e}")
        return fallback

def detect_mixed_languages(text: str) -> Dict[str, float]:
    """
    Detect multiple languages in text with probabilities
    
    Returns:
        Dictionary of language codes and their probabilities
    """
    try:
        langs = detect_langs(text)
        return {lang.lang: lang.prob for lang in langs}
    except:
        return {'en': 1.0}

def get_language_name(code: str) -> str:
    """Get human-readable language name from code"""
    return LANGUAGE_NAMES.get(code, code.upper())

def is_rtl_language(code: str) -> bool:
    """Check if language is right-to-left"""
    rtl_languages = ['ar', 'he', 'fa', 'ur']
    return code in rtl_languages