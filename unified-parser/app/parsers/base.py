"""
Base parser class for all file parsers
"""

from abc import ABC, abstractmethod
from typing import Dict, Any, List
import structlog

from ..models import ParsedDocument, ParseOptions, Chunk


logger = structlog.get_logger()


class BaseParser(ABC):
    """Abstract base class for file parsers"""
    
    def __init__(self):
        self.logger = logger.bind(parser=self.__class__.__name__)
    
    @abstractmethod
    async def parse(self, content: bytes, options: ParseOptions) -> ParsedDocument:
        """
        Parse file content and return structured data
        
        Args:
            content: Raw file content
            options: Parsing options
            
        Returns:
            ParsedDocument with chunks and metadata
        """
        pass
    
    def create_chunk(
        self,
        chunk_type: str,
        content: Any,
        chunk_id: str = None,
        level: int = None,
        parent_id: str = None,
        metadata: Dict[str, Any] = None
    ) -> Chunk:
        """Helper method to create a chunk"""
        chunk = Chunk(
            type=chunk_type,
            content=content,
            level=level,
            parent_id=parent_id
        )
        
        if chunk_id:
            chunk.id = chunk_id
            
        if metadata:
            for key, value in metadata.items():
                if hasattr(chunk.metadata, key):
                    setattr(chunk.metadata, key, value)
        
        return chunk
    
    def extract_text_from_chunks(self, chunks: List[Chunk]) -> str:
        """Extract plain text from chunks for language detection"""
        text_parts = []
        
        for chunk in chunks:
            if chunk.type in ["heading", "paragraph", "text", "note"]:
                if isinstance(chunk.content, str):
                    text_parts.append(chunk.content)
            elif chunk.type == "list" and isinstance(chunk.content, list):
                for item in chunk.content:
                    if isinstance(item, dict) and "text" in item:
                        text_parts.append(item["text"])
                    elif isinstance(item, str):
                        text_parts.append(item)
        
        return " ".join(text_parts)
    
    def count_words(self, text: str) -> int:
        """Count words in text"""
        return len(text.split())
    
    def clean_text(self, text: str) -> str:
        """Clean and normalize text"""
        if not text:
            return ""
        
        # Remove excessive whitespace
        text = " ".join(text.split())
        
        # Remove zero-width characters
        text = text.replace("\u200b", "").replace("\u200c", "").replace("\u200d", "")
        
        return text.strip()