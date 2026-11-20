"""
Base chunker class for all chunking strategies
"""

from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional
import structlog

logger = structlog.get_logger()


class BaseChunker(ABC):
    """Abstract base class for chunking strategies"""
    
    def __init__(self):
        self.logger = logger.bind(chunker=self.__class__.__name__)
    
    @abstractmethod
    async def process(
        self, 
        chunks: List[Dict[str, Any]], 
        max_size: int = 1000,
        language: str = "en",
        **kwargs
    ) -> List[Dict[str, Any]]:
        """
        Process and enhance chunks using specific strategy
        
        Args:
            chunks: List of parsed chunks
            max_size: Maximum chunk size in tokens
            language: Language code for NLP processing
            
        Returns:
            Enhanced list of chunks
        """
        pass
    
    async def generate_summary(
        self,
        chunks: List[Dict[str, Any]],
        max_length: int = 500,
        style: str = "informative"
    ) -> Dict[str, Any]:
        """
        Generate summary from chunks
        
        Args:
            chunks: Document chunks
            max_length: Maximum summary length
            style: Summary style (informative, concise, detailed)
            
        Returns:
            Summary data with key topics
        """
        # Default implementation - can be overridden
        text = self._extract_text_for_summary(chunks)
        
        # Simple extractive summary
        sentences = self._split_sentences(text)
        summary = self._create_extractive_summary(sentences, max_length)
        
        # Extract key topics (simplified)
        key_topics = self._extract_key_topics(text)
        
        return {
            "summary": summary,
            "key_topics": key_topics,
            "word_count": len(summary.split())
        }
    
    def _extract_text_for_summary(self, chunks: List[Dict[str, Any]]) -> str:
        """Extract text content for summarization"""
        text_parts = []
        
        for chunk in chunks:
            content = chunk.get("content", "")
            chunk_type = chunk.get("type", "")
            
            if chunk_type in ["heading", "paragraph", "text"]:
                if isinstance(content, str):
                    # Weight headings more
                    if chunk_type == "heading":
                        text_parts.append(content)
                        text_parts.append(content)  # Duplicate for importance
                    else:
                        text_parts.append(content)
            elif chunk_type == "list" and isinstance(content, list):
                for item in content:
                    if isinstance(item, dict) and "text" in item:
                        text_parts.append(item["text"])
                    elif isinstance(item, str):
                        text_parts.append(item)
        
        return " ".join(text_parts)
    
    def _split_sentences(self, text: str) -> List[str]:
        """Simple sentence splitting"""
        # This is a simplified version - real implementation would use NLP
        import re
        
        # Handle common sentence endings
        sentences = re.split(r'(?<=[.!?])\s+', text)
        
        # Filter out very short sentences
        return [s.strip() for s in sentences if len(s.strip()) > 20]
    
    def _create_extractive_summary(self, sentences: List[str], max_length: int) -> str:
        """Create extractive summary by selecting important sentences"""
        if not sentences:
            return ""
        
        # Simple scoring based on position and length
        scored_sentences = []
        for i, sentence in enumerate(sentences):
            # Favor early sentences and longer ones
            position_score = 1.0 - (i / len(sentences))
            length_score = min(len(sentence) / 100, 1.0)
            score = position_score * 0.7 + length_score * 0.3
            
            scored_sentences.append((score, sentence))
        
        # Sort by score and select top sentences
        scored_sentences.sort(key=lambda x: x[0], reverse=True)
        
        summary_sentences = []
        current_length = 0
        
        for score, sentence in scored_sentences:
            if current_length + len(sentence) <= max_length:
                summary_sentences.append(sentence)
                current_length += len(sentence) + 1  # +1 for space
            else:
                break
        
        return " ".join(summary_sentences)
    
    def _extract_key_topics(self, text: str) -> List[str]:
        """Extract key topics from text"""
        # Simplified topic extraction
        import re
        from collections import Counter
        
        # Extract capitalized phrases (potential topics)
        pattern = r'\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b'
        capitalized_phrases = re.findall(pattern, text)
        
        # Count occurrences
        topic_counts = Counter(capitalized_phrases)
        
        # Filter common words and return top topics
        common_words = {'The', 'This', 'That', 'These', 'Those', 'In', 'On', 'At', 'To', 'From'}
        topics = [
            topic for topic, count in topic_counts.most_common(10)
            if topic not in common_words and count > 1
        ]
        
        return topics[:5]  # Return top 5 topics