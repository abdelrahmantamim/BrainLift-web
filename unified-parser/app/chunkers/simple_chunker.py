"""
Simple text chunker that doesn't require spacy
"""

from typing import List, Dict, Any
import re
import structlog

from ..models import Chunk
from .base import BaseChunker

logger = structlog.get_logger()


class SimpleChunker(BaseChunker):
    """Simple text chunker using basic sentence splitting"""
    
    def __init__(self, chunk_size: int = 1000, chunk_overlap: int = 200):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
    
    def chunk(self, text: str, metadata: Dict[str, Any] = None) -> List[Chunk]:
        """Split text into chunks based on sentences and size"""
        if not text or not text.strip():
            return []
        
        # Simple sentence splitting
        sentences = self._split_sentences(text)
        
        chunks = []
        current_chunk = []
        current_size = 0
        chunk_id = 0
        
        for sentence in sentences:
            sentence_size = len(sentence)
            
            # If adding this sentence would exceed chunk size
            if current_size + sentence_size > self.chunk_size and current_chunk:
                # Create chunk
                chunk_text = ' '.join(current_chunk)
                chunks.append(Chunk(
                    id=f"chunk_{chunk_id}",
                    content=chunk_text,
                    metadata={
                        **(metadata or {}),
                        "chunk_index": chunk_id,
                        "chunk_size": len(chunk_text)
                    }
                ))
                
                # Handle overlap
                if self.chunk_overlap > 0:
                    # Keep last few sentences for overlap
                    overlap_text = ' '.join(current_chunk[-3:])
                    if len(overlap_text) > self.chunk_overlap:
                        current_chunk = current_chunk[-2:]
                    else:
                        current_chunk = current_chunk[-3:]
                    current_size = sum(len(s) for s in current_chunk)
                else:
                    current_chunk = []
                    current_size = 0
                
                chunk_id += 1
            
            current_chunk.append(sentence)
            current_size += sentence_size
        
        # Don't forget the last chunk
        if current_chunk:
            chunk_text = ' '.join(current_chunk)
            chunks.append(Chunk(
                id=f"chunk_{chunk_id}",
                content=chunk_text,
                metadata={
                    **(metadata or {}),
                    "chunk_index": chunk_id,
                    "chunk_size": len(chunk_text)
                }
            ))
        
        return chunks
    
    def _split_sentences(self, text: str) -> List[str]:
        """Simple sentence splitting"""
        # Split on common sentence endings
        sentence_endings = r'[.!?]+[\s]+'
        sentences = re.split(sentence_endings, text)
        
        # Clean up and filter
        sentences = [s.strip() for s in sentences if s.strip()]
        
        # Handle case where text doesn't end with punctuation
        if text and not re.search(r'[.!?]\s*$', text):
            # Last part might not be captured
            last_part = text.split(sentences[-1])[-1].strip() if sentences else text.strip()
            if last_part and last_part not in sentences:
                sentences.append(last_part)
        
        return sentences