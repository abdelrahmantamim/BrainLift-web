"""
Language detection utilities
"""

from typing import List, Dict, Optional
import structlog

logger = structlog.get_logger()


class LanguageDetector:
    """Language detection for documents"""
    
    def __init__(self):
        self.detector = None
        self._initialize_detector()
    
    def _initialize_detector(self):
        """Initialize language detection library"""
        try:
            import langdetect
            self.detector = langdetect
            # Set deterministic seed for consistent results
            langdetect.DetectorFactory.seed = 0
        except ImportError:
            logger.warning("langdetect not available - install langdetect for language detection")
    
    def detect_language(self, text: str) -> str:
        """Detect primary language of text"""
        if not self.detector or not text or len(text) < 20:
            return "en"  # Default to English
        
        try:
            # Detect language
            lang = self.detector.detect(text)
            
            # Map to our supported languages
            lang_map = {
                'en': 'en',
                'es': 'es',
                'fr': 'fr',
                'de': 'de',
                'it': 'it',
                'pt': 'pt',
                'nl': 'nl',
                'pl': 'pl',
                'ru': 'ru',
                'ja': 'ja',
                'zh-cn': 'zh',
                'zh-tw': 'zh',
                'ar': 'ar',
                'hi': 'hi',
                'ko': 'ko'
            }
            
            return lang_map.get(lang, 'en')
            
        except Exception as e:
            logger.debug("language_detection_failed", error=str(e))
            return "en"
    
    def detect_languages(self, text: str, top_n: int = 3) -> List[Dict[str, float]]:
        """Detect multiple possible languages with probabilities"""
        if not self.detector or not text:
            return [{"language": "en", "probability": 1.0}]
        
        try:
            # Get language probabilities
            langs = self.detector.detect_langs(text)
            
            # Convert to our format
            results = []
            for lang_prob in langs[:top_n]:
                results.append({
                    "language": lang_prob.lang,
                    "probability": lang_prob.prob
                })
            
            return results
            
        except Exception:
            return [{"language": "en", "probability": 1.0}]
    
    def is_mixed_language(self, text: str, threshold: float = 0.8) -> bool:
        """Check if text contains multiple languages"""
        if not self.detector or not text:
            return False
        
        try:
            # Get top languages
            langs = self.detect_languages(text, top_n=2)
            
            # Check if no single language dominates
            if len(langs) > 1 and langs[0]["probability"] < threshold:
                return True
            
            return False
            
        except Exception:
            return False
    
    def detect_by_chunks(self, chunks: List[str]) -> Dict[str, int]:
        """Detect languages across multiple text chunks"""
        if not chunks:
            return {"en": 1}
        
        language_counts = {}
        
        for chunk in chunks:
            if chunk and len(chunk) > 20:
                lang = self.detect_language(chunk)
                language_counts[lang] = language_counts.get(lang, 0) + 1
        
        return language_counts
    
    def get_primary_language(self, language_counts: Dict[str, int]) -> str:
        """Get the most common language from counts"""
        if not language_counts:
            return "en"
        
        # Sort by count
        sorted_langs = sorted(
            language_counts.items(), 
            key=lambda x: x[1], 
            reverse=True
        )
        
        return sorted_langs[0][0]