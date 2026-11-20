"""
Text processing utilities
"""

import re
from typing import List, Tuple, Optional
import unicodedata


class TextProcessor:
    """Text processing and cleaning utilities"""
    
    @staticmethod
    def clean_text(text: str) -> str:
        """Clean and normalize text"""
        if not text:
            return ""
        
        # Normalize unicode
        text = unicodedata.normalize('NFKC', text)
        
        # Remove zero-width characters
        text = text.replace('\u200b', '').replace('\u200c', '').replace('\u200d', '')
        text = text.replace('\ufeff', '')  # Remove BOM
        
        # Normalize whitespace
        text = re.sub(r'\s+', ' ', text)
        
        # Remove control characters
        text = ''.join(char for char in text if ord(char) >= 32 or char in '\n\t')
        
        return text.strip()
    
    @staticmethod
    def extract_sentences(text: str) -> List[str]:
        """Extract sentences from text"""
        if not text:
            return []
        
        # Simple sentence splitting
        # This is a basic implementation - for production use nltk or spacy
        sentences = re.split(r'(?<=[.!?])\s+', text)
        
        # Filter and clean
        cleaned_sentences = []
        for sent in sentences:
            sent = sent.strip()
            if sent and len(sent) > 10:  # Minimum sentence length
                cleaned_sentences.append(sent)
        
        return cleaned_sentences
    
    @staticmethod
    def extract_keywords(text: str, max_keywords: int = 10) -> List[str]:
        """Extract keywords from text (simple implementation)"""
        if not text:
            return []
        
        # Convert to lowercase
        text_lower = text.lower()
        
        # Remove punctuation
        text_clean = re.sub(r'[^\w\s]', ' ', text_lower)
        
        # Split into words
        words = text_clean.split()
        
        # Filter stop words (basic list)
        stop_words = {
            'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
            'of', 'with', 'by', 'from', 'up', 'about', 'into', 'through', 'during',
            'before', 'after', 'above', 'below', 'between', 'under', 'again',
            'further', 'then', 'once', 'is', 'are', 'was', 'were', 'been', 'be',
            'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should',
            'could', 'may', 'might', 'must', 'shall', 'can', 'need', 'ought'
        }
        
        # Count word frequencies
        word_freq = {}
        for word in words:
            if len(word) > 3 and word not in stop_words:
                word_freq[word] = word_freq.get(word, 0) + 1
        
        # Sort by frequency
        sorted_words = sorted(word_freq.items(), key=lambda x: x[1], reverse=True)
        
        # Return top keywords
        return [word for word, freq in sorted_words[:max_keywords]]
    
    @staticmethod
    def truncate_text(text: str, max_length: int, add_ellipsis: bool = True) -> str:
        """Truncate text to maximum length"""
        if not text or len(text) <= max_length:
            return text
        
        if add_ellipsis:
            return text[:max_length-3] + "..."
        else:
            return text[:max_length]
    
    @staticmethod
    def remove_extra_whitespace(text: str) -> str:
        """Remove extra whitespace while preserving paragraph breaks"""
        if not text:
            return ""
        
        # Normalize line breaks
        text = text.replace('\r\n', '\n').replace('\r', '\n')
        
        # Replace multiple spaces with single space
        text = re.sub(r' +', ' ', text)
        
        # Replace multiple newlines with double newline
        text = re.sub(r'\n{3,}', '\n\n', text)
        
        # Clean up space around newlines
        text = re.sub(r' *\n *', '\n', text)
        
        return text.strip()
    
    @staticmethod
    def extract_urls(text: str) -> List[str]:
        """Extract URLs from text"""
        if not text:
            return []
        
        # Simple URL pattern
        url_pattern = r'https?://[^\s<>"{}|\\^`\[\]]+'
        urls = re.findall(url_pattern, text)
        
        return urls
    
    @staticmethod
    def extract_emails(text: str) -> List[str]:
        """Extract email addresses from text"""
        if not text:
            return []
        
        # Simple email pattern
        email_pattern = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
        emails = re.findall(email_pattern, text)
        
        return emails
    
    @staticmethod
    def calculate_reading_time(text: str, wpm: int = 200) -> int:
        """Calculate reading time in minutes"""
        if not text:
            return 0
        
        word_count = len(text.split())
        minutes = word_count / wpm
        
        # Round up to nearest minute
        return max(1, round(minutes))
    
    @staticmethod
    def extract_numbers(text: str) -> List[Tuple[str, float]]:
        """Extract numbers from text with context"""
        if not text:
            return []
        
        # Pattern for numbers (including decimals and commas)
        number_pattern = r'(\b\w+\s+)?(\d{1,3}(?:,\d{3})*(?:\.\d+)?)\s*(\w+\b)?'
        matches = re.findall(number_pattern, text)
        
        results = []
        for before, number, after in matches:
            # Clean number
            clean_number = number.replace(',', '')
            try:
                value = float(clean_number)
                context = f"{before.strip()} {number} {after.strip()}".strip()
                results.append((context, value))
            except ValueError:
                continue
        
        return results