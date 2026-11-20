"""
Smart Chunker - Semantic text splitting with structure preservation
"""

from typing import List, Dict, Any, Optional
import tiktoken
import re

class SmartChunker:
    def __init__(self, model: str = "gpt-4"):
        self.encoding = tiktoken.encoding_for_model(model)
        self.separators = [
            "\n\n",  # Double newline (paragraph break)
            "\n",    # Single newline
            ". ",    # Sentence end
            "؟ ",    # Arabic question mark
            "。",    # Chinese period
            "! ",    # Exclamation
            "? ",    # Question mark
            "; ",    # Semicolon
            ", ",    # Comma
            " ",     # Space
            "",      # Character
        ]
    
    def chunk(
        self, 
        chunks: List[Dict], 
        max_size: int = 1000,
        overlap: int = 100,
        preserve_structure: bool = True
    ) -> List[Dict]:
        """
        Smart chunking that preserves document structure
        
        Args:
            chunks: List of parsed chunks from document
            max_size: Maximum tokens per chunk
            overlap: Token overlap between chunks
            preserve_structure: Keep headings with their content
        """
        if not chunks:
            return []
        
        if preserve_structure:
            return self._chunk_with_structure(chunks, max_size, overlap)
        else:
            return self._chunk_flat(chunks, max_size, overlap)
    
    def _chunk_with_structure(
        self, 
        chunks: List[Dict], 
        max_size: int,
        overlap: int
    ) -> List[Dict]:
        """Chunk while preserving document hierarchy"""
        result = []
        current_section = None
        section_content = []
        section_tokens = 0
        
        for chunk in chunks:
            chunk_tokens = self._count_tokens(chunk.get('content', ''))
            
            # Handle headings
            if chunk['type'] == 'heading':
                # Save current section if exists
                if current_section and section_content:
                    result.extend(self._finalize_section(
                        current_section, section_content, max_size
                    ))
                
                # Start new section
                current_section = chunk
                section_content = []
                section_tokens = chunk_tokens
                
            # Handle tables (keep intact)
            elif chunk['type'] == 'table':
                # Tables are kept as single chunks
                table_chunk = chunk.copy()
                if current_section:
                    table_chunk['section'] = current_section['content']
                    table_chunk['section_id'] = current_section['id']
                result.append(table_chunk)
                
            # Handle regular content
            else:
                # Check if adding this would exceed limit
                if section_tokens + chunk_tokens > max_size and section_content:
                    # Save current content
                    result.extend(self._finalize_section(
                        current_section, section_content, max_size
                    ))
                    section_content = [chunk]
                    section_tokens = chunk_tokens
                else:
                    section_content.append(chunk)
                    section_tokens += chunk_tokens
        
        # Don't forget last section
        if section_content:
            result.extend(self._finalize_section(
                current_section, section_content, max_size
            ))
        
        return result
    
    def _finalize_section(
        self,
        heading: Optional[Dict],
        content: List[Dict],
        max_size: int
    ) -> List[Dict]:
        """Finalize a section, splitting if needed"""
        if not content:
            return []
        
        # Combine content
        combined_text = []
        if heading:
            combined_text.append(f"## {heading['content']}\n")
        
        for chunk in content:
            if chunk['type'] == 'paragraph':
                combined_text.append(chunk['content'])
            elif chunk['type'] == 'list':
                for item in chunk.get('content', []):
                    combined_text.append(f"- {item.get('text', '')}")
        
        full_text = '\n\n'.join(combined_text)
        
        # Split if too long
        if self._count_tokens(full_text) <= max_size:
            return [{
                'id': f"section_{heading['id'] if heading else 'root'}",
                'type': 'section',
                'content': full_text,
                'metadata': {
                    'heading': heading['content'] if heading else None,
                    'heading_level': heading.get('level') if heading else None,
                    'chunks_count': len(content) + (1 if heading else 0)
                }
            }]
        else:
            # Need to split further
            return self._split_text(full_text, max_size, metadata={
                'heading': heading['content'] if heading else None
            })
    
    def _chunk_flat(
        self, 
        chunks: List[Dict], 
        max_size: int,
        overlap: int
    ) -> List[Dict]:
        """Simple flat chunking without structure preservation"""
        # Combine all text
        all_text = []
        for chunk in chunks:
            if chunk['type'] in ['paragraph', 'heading']:
                all_text.append(chunk['content'])
            elif chunk['type'] == 'list':
                for item in chunk.get('content', []):
                    all_text.append(item.get('text', ''))
        
        full_text = '\n\n'.join(all_text)
        return self._split_text(full_text, max_size, overlap)
    
    def _split_text(
        self,
        text: str,
        max_size: int,
        overlap: int = 100,
        metadata: Dict = None
    ) -> List[Dict]:
        """Split text into chunks using separators"""
        chunks = []
        current_chunk = ""
        current_tokens = 0
        chunk_id = 0
        
        # Try each separator
        for separator in self.separators:
            if separator:
                parts = text.split(separator)
            else:
                parts = list(text)
            
            temp_chunks = []
            temp_chunk = ""
            temp_tokens = 0
            
            for part in parts:
                part_tokens = self._count_tokens(part)
                
                if temp_tokens + part_tokens <= max_size:
                    temp_chunk += part + separator
                    temp_tokens += part_tokens
                else:
                    if temp_chunk:
                        temp_chunks.append(temp_chunk.strip())
                    temp_chunk = part + separator
                    temp_tokens = part_tokens
            
            if temp_chunk:
                temp_chunks.append(temp_chunk.strip())
            
            # Check if this separator gives good results
            if all(self._count_tokens(c) <= max_size for c in temp_chunks):
                # Good split found
                for i, chunk_text in enumerate(temp_chunks):
                    chunk_dict = {
                        'id': f'chunk_{chunk_id}',
                        'type': 'text',
                        'content': chunk_text,
                        'metadata': {
                            'chunk_index': i,
                            'total_chunks': len(temp_chunks),
                            **(metadata or {})
                        }
                    }
                    
                    # Add overlap context
                    if i > 0 and overlap > 0:
                        overlap_text = temp_chunks[i-1][-overlap:]
                        chunk_dict['metadata']['overlap_previous'] = overlap_text
                    
                    chunks.append(chunk_dict)
                    chunk_id += 1
                
                return chunks
        
        # If no good split found, force split by tokens
        return self._force_split_by_tokens(text, max_size, metadata)
    
    def _force_split_by_tokens(
        self,
        text: str,
        max_size: int,
        metadata: Dict = None
    ) -> List[Dict]:
        """Force split by token count when separators don't work"""
        tokens = self.encoding.encode(text)
        chunks = []
        
        for i in range(0, len(tokens), max_size):
            chunk_tokens = tokens[i:i + max_size]
            chunk_text = self.encoding.decode(chunk_tokens)
            
            chunks.append({
                'id': f'chunk_{i // max_size}',
                'type': 'text',
                'content': chunk_text,
                'metadata': {
                    'force_split': True,
                    'chunk_index': i // max_size,
                    **(metadata or {})
                }
            })
        
        return chunks
    
    def _count_tokens(self, text: str) -> int:
        """Count tokens in text"""
        if isinstance(text, dict):
            # Handle table content
            text = str(text)
        return len(self.encoding.encode(str(text)))