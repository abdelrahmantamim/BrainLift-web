"""
Fixed-size chunker with overlap for simple splitting
"""

from typing import List, Dict, Any, Optional
import structlog

from .base import BaseChunker
from ..config import settings

logger = structlog.get_logger()


class FixedChunker(BaseChunker):
    """
    Fixed-size chunking with overlap
    - Simple token/character-based splitting
    - Configurable overlap
    - Preserves chunk boundaries at sentence level
    """
    
    async def process(
        self, 
        chunks: List[Dict[str, Any]], 
        max_size: int = 1000,
        language: str = "en",
        **kwargs
    ) -> List[Dict[str, Any]]:
        """Process chunks with fixed-size splitting"""
        
        # Extract all text content
        text_content = []
        metadata_map = {}
        
        for chunk in chunks:
            chunk_type = chunk.get("type", "")
            content = chunk.get("content", "")
            
            # Handle different content types
            if chunk_type in ["heading", "paragraph", "text", "note"]:
                if isinstance(content, str) and content.strip():
                    # Store original chunk metadata
                    start_idx = len(text_content)
                    text_content.append(content)
                    metadata_map[start_idx] = {
                        "original_type": chunk_type,
                        "original_metadata": chunk.get("metadata", {})
                    }
                    
                    # Add spacing between chunks
                    text_content.append("\n\n")
            
            elif chunk_type == "list" and isinstance(content, list):
                # Convert list to text
                list_text = self._list_to_text(content)
                if list_text:
                    start_idx = len(text_content)
                    text_content.append(list_text)
                    metadata_map[start_idx] = {
                        "original_type": chunk_type,
                        "original_metadata": chunk.get("metadata", {})
                    }
                    text_content.append("\n\n")
            
            elif chunk_type in ["table", "image", "code"]:
                # Keep special chunks as-is
                # These will be inserted between text chunks
                metadata_map[len(text_content)] = {
                    "special_chunk": chunk,
                    "preserve": True
                }
                text_content.append(f"[{chunk_type.upper()}]")
                text_content.append("\n\n")
        
        # Join all text
        full_text = "".join(text_content).strip()
        
        if not full_text:
            return chunks  # Return original if no text
        
        # Split into fixed-size chunks
        fixed_chunks = await self._split_fixed_size(
            full_text, 
            max_size, 
            settings.chunk_overlap,
            metadata_map
        )
        
        return fixed_chunks
    
    def _list_to_text(self, items: List[Any]) -> str:
        """Convert list items to text"""
        text_parts = []
        
        for item in items:
            if isinstance(item, dict):
                text = item.get("text", "")
                level = item.get("level", 0)
                indent = "  " * level
                text_parts.append(f"{indent}• {text}")
            elif isinstance(item, str):
                text_parts.append(f"• {item}")
        
        return "\n".join(text_parts)
    
    async def _split_fixed_size(
        self, 
        text: str, 
        max_size: int, 
        overlap: int,
        metadata_map: Dict
    ) -> List[Dict[str, Any]]:
        """Split text into fixed-size chunks with overlap"""
        
        # Simple word-based splitting
        words = text.split()
        chunks = []
        
        if not words:
            return chunks
        
        # Calculate chunk parameters
        chunk_words = max_size // 5  # Rough estimate: 5 chars per word
        overlap_words = overlap // 5
        
        i = 0
        chunk_index = 0
        
        while i < len(words):
            # Get chunk words
            end_idx = min(i + chunk_words, len(words))
            chunk_text = " ".join(words[i:end_idx])
            
            # Try to end at sentence boundary
            if end_idx < len(words):
                # Look for sentence end in last 20% of chunk
                last_part = chunk_text[int(len(chunk_text) * 0.8):]
                sentence_ends = [
                    last_part.rfind('. '),
                    last_part.rfind('! '),
                    last_part.rfind('? '),
                    last_part.rfind('.\n'),
                ]
                
                best_end = max(sentence_ends)
                if best_end > -1:
                    # Adjust chunk to end at sentence
                    cut_point = int(len(chunk_text) * 0.8) + best_end + 1
                    chunk_text = chunk_text[:cut_point].strip()
                    
                    # Adjust end_idx to match
                    remaining_words = chunk_text.split()
                    end_idx = i + len(remaining_words)
            
            # Find metadata for this chunk
            chunk_metadata = self._find_chunk_metadata(
                text.find(words[i]), 
                metadata_map
            )
            
            # Check if this position has a special chunk
            if chunk_metadata and chunk_metadata.get("preserve"):
                # Insert special chunk as-is
                chunks.append(chunk_metadata["special_chunk"])
                i = end_idx
                continue
            
            # Create chunk
            chunk = {
                "type": "text",
                "content": chunk_text.strip(),
                "metadata": {
                    "chunk_index": chunk_index,
                    "chunking_method": "fixed",
                    "word_count": len(chunk_text.split()),
                    **(chunk_metadata or {})
                }
            }
            
            # Add overlap context to next chunk
            if i > 0 and overlap_words > 0:
                overlap_start = max(0, i - overlap_words)
                overlap_text = " ".join(words[overlap_start:i])
                chunk["metadata"]["overlap_context"] = overlap_text
            
            chunks.append(chunk)
            chunk_index += 1
            
            # Move to next chunk position
            if overlap_words > 0 and end_idx < len(words):
                # Start next chunk with overlap
                i = end_idx - overlap_words
            else:
                i = end_idx
        
        return chunks
    
    def _find_chunk_metadata(self, position: int, metadata_map: Dict) -> Optional[Dict]:
        """Find metadata for text at given position"""
        # Find the metadata entry that covers this position
        best_match = None
        best_distance = float('inf')
        
        for map_position, metadata in metadata_map.items():
            if isinstance(map_position, int):
                distance = abs(position - map_position)
                if distance < best_distance:
                    best_distance = distance
                    best_match = metadata
        
        return best_match
    
    async def generate_summary(
        self,
        chunks: List[Dict[str, Any]],
        max_length: int = 500,
        style: str = "concise"
    ) -> Dict[str, Any]:
        """Generate summary from fixed chunks"""
        
        # For fixed chunking, use first and last chunks
        summary_parts = []
        
        # Extract from first few chunks
        text_chunks = [c for c in chunks if c.get("type") in ["text", "paragraph"]]
        
        if text_chunks:
            # First chunk (introduction)
            first_content = text_chunks[0].get("content", "")
            if isinstance(first_content, str):
                # Take first few sentences
                sentences = self._split_sentences(first_content)
                intro = " ".join(sentences[:3])
                if intro:
                    summary_parts.append(intro)
            
            # Middle chunks (sample key content)
            if len(text_chunks) > 4:
                middle_idx = len(text_chunks) // 2
                middle_content = text_chunks[middle_idx].get("content", "")
                if isinstance(middle_content, str):
                    sentences = self._split_sentences(middle_content)
                    middle = " ".join(sentences[:2])
                    if middle:
                        summary_parts.append(middle)
            
            # Last chunk (conclusion)
            if len(text_chunks) > 1:
                last_content = text_chunks[-1].get("content", "")
                if isinstance(last_content, str):
                    sentences = self._split_sentences(last_content)
                    conclusion = " ".join(sentences[:2])
                    if conclusion:
                        summary_parts.append(conclusion)
        
        # Join summary
        summary = " [...] ".join(summary_parts)
        
        # Truncate if needed
        if len(summary) > max_length:
            summary = summary[:max_length-3] + "..."
        
        # Extract basic statistics
        total_words = sum(
            len(c.get("content", "").split()) 
            for c in chunks 
            if isinstance(c.get("content"), str)
        )
        
        return {
            "summary": summary,
            "key_topics": self._extract_key_topics(self._extract_text_for_summary(chunks)),
            "statistics": {
                "total_chunks": len(chunks),
                "text_chunks": len(text_chunks),
                "special_chunks": len(chunks) - len(text_chunks),
                "total_words": total_words,
                "avg_chunk_size": total_words // len(text_chunks) if text_chunks else 0
            },
            "word_count": len(summary.split())
        }