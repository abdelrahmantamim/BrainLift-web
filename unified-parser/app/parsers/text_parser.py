"""
Text Parser - Parses plain text files with structure detection
"""

import re
from typing import Dict, Any, List, Optional
import structlog

from ..models import ParsedDocument, ParseOptions, DocumentMetadata, Chunk, ChunkMetadata
from .base import BaseParser

logger = structlog.get_logger()


class TextParser(BaseParser):
    """Parser for plain text files"""
    
    async def parse(self, file: Any, filename: str, options: Optional[ParseOptions] = None) -> ParsedDocument:
        """Parse text content"""
        options = options or ParseOptions()
        
        try:
            # Read file content
            if hasattr(file, 'read'):
                content = file.read()
                if hasattr(file, 'seek'):
                    file.seek(0)
            else:
                content = file
            
            # Decode text
            text = self._decode_text(content)
            
            # Create document
            doc = ParsedDocument()
            doc.content = text  # Set the content
            
            # Extract metadata
            lines = text.strip().split('\n')
            doc.metadata = DocumentMetadata(
                title=self._extract_title(lines),
                word_count=self.count_words(text),
                pages=max(1, len(lines) // 50)  # Rough estimate
            )
            
            # Process content into chunks
            chunks = await self._process_text_structure(lines)
            doc.chunks = chunks
            
            return doc
            
        except Exception as e:
            logger.error("text_parsing_failed", error=str(e))
            raise
    
    def _decode_text(self, content: Any) -> str:
        """Decode text with encoding detection"""
        # If already a string, return it
        if isinstance(content, str):
            return content
            
        # Try common encodings for bytes
        encodings = ['utf-8', 'utf-16', 'latin-1', 'windows-1252']
        
        for encoding in encodings:
            try:
                return content.decode(encoding)
            except UnicodeDecodeError:
                continue
        
        # Fallback with error handling
        return content.decode('utf-8', errors='replace')
    
    def _extract_title(self, lines: List[str]) -> str:
        """Extract title from text"""
        # Look for title patterns in first few lines
        for i, line in enumerate(lines[:5]):
            line = line.strip()
            if line and len(line) < 100:
                # Check if it looks like a title
                if line.isupper() or line.endswith(':') or i == 0:
                    return line
        
        return "Untitled Document"
    
    async def _process_text_structure(self, lines: List[str]) -> List[Any]:
        """Process text lines into structured chunks"""
        chunks = []
        current_section = None
        current_paragraph = []
        
        i = 0
        while i < len(lines):
            line = lines[i]
            stripped = line.strip()
            
            # Skip empty lines between paragraphs
            if not stripped:
                if current_paragraph:
                    # End current paragraph
                    para_text = '\n'.join(current_paragraph)
                    chunks.append(self.create_chunk(
                        chunk_type="paragraph",
                        content=para_text.strip(),
                        parent_id=current_section
                    ))
                    current_paragraph = []
                i += 1
                continue
            
            # Check for various structure patterns
            
            # Markdown-style headers
            if stripped.startswith('#'):
                # Save current paragraph
                if current_paragraph:
                    para_text = '\n'.join(current_paragraph)
                    chunks.append(self.create_chunk(
                        chunk_type="paragraph",
                        content=para_text.strip(),
                        parent_id=current_section
                    ))
                    current_paragraph = []
                
                # Process header
                level = len(stripped) - len(stripped.lstrip('#'))
                header_text = stripped.lstrip('#').strip()
                header_chunk = self.create_chunk(
                    chunk_type="heading",
                    content=header_text,
                    level=min(level, 6)
                )
                chunks.append(header_chunk)
                current_section = header_chunk.id
                i += 1
                continue
            
            # Underlined headers (Markdown alternative syntax)
            if i + 1 < len(lines):
                next_line = lines[i + 1].strip()
                if next_line and all(c == '=' for c in next_line):
                    # Level 1 header
                    if current_paragraph:
                        para_text = '\n'.join(current_paragraph)
                        chunks.append(self.create_chunk(
                            chunk_type="paragraph",
                            content=para_text.strip(),
                            parent_id=current_section
                        ))
                        current_paragraph = []
                    
                    header_chunk = self.create_chunk(
                        chunk_type="heading",
                        content=stripped,
                        level=1
                    )
                    chunks.append(header_chunk)
                    current_section = header_chunk.id
                    i += 2
                    continue
                elif next_line and all(c == '-' for c in next_line) and len(next_line) >= 3:
                    # Level 2 header
                    if current_paragraph:
                        para_text = '\n'.join(current_paragraph)
                        chunks.append(self.create_chunk(
                            chunk_type="paragraph",
                            content=para_text.strip(),
                            parent_id=current_section
                        ))
                        current_paragraph = []
                    
                    header_chunk = self.create_chunk(
                        chunk_type="heading",
                        content=stripped,
                        level=2
                    )
                    chunks.append(header_chunk)
                    current_section = header_chunk.id
                    i += 2
                    continue
            
            # Check for list items
            list_match = re.match(r'^(\s*)([-*+•]|\d+\.)\s+(.+)$', line)
            if list_match:
                # Process any pending paragraph
                if current_paragraph:
                    para_text = '\n'.join(current_paragraph)
                    chunks.append(self.create_chunk(
                        chunk_type="paragraph",
                        content=para_text.strip(),
                        parent_id=current_section
                    ))
                    current_paragraph = []
                
                # Collect consecutive list items
                list_items = []
                while i < len(lines):
                    line = lines[i]
                    list_match = re.match(r'^(\s*)([-*+•]|\d+\.)\s+(.+)$', line)
                    if list_match:
                        indent = len(list_match.group(1))
                        marker = list_match.group(2)
                        text = list_match.group(3)
                        
                        list_items.append({
                            'text': text,
                            'level': indent // 2,  # Rough level calculation
                            'marker': marker
                        })
                        i += 1
                    else:
                        break
                
                # Create list chunk
                if list_items:
                    chunks.append(self.create_chunk(
                        chunk_type="list",
                        content=list_items,
                        parent_id=current_section,
                        metadata={
                            'list_type': 'ordered' if list_items[0]['marker'][0].isdigit() else 'unordered'
                        }
                    ))
                continue
            
            # Check for code blocks
            if stripped.startswith('```'):
                # Save current paragraph
                if current_paragraph:
                    para_text = '\n'.join(current_paragraph)
                    chunks.append(self.create_chunk(
                        chunk_type="paragraph",
                        content=para_text.strip(),
                        parent_id=current_section
                    ))
                    current_paragraph = []
                
                # Extract code block
                code_lines = []
                language = stripped[3:].strip() or None
                i += 1
                
                while i < len(lines) and not lines[i].strip().startswith('```'):
                    code_lines.append(lines[i])
                    i += 1
                
                if code_lines:
                    chunks.append(self.create_chunk(
                        chunk_type="code",
                        content='\n'.join(code_lines),
                        parent_id=current_section,
                        metadata={'language': language}
                    ))
                
                i += 1  # Skip closing ```
                continue
            
            # Check for quoted text
            if stripped.startswith('>'):
                # Save current paragraph
                if current_paragraph:
                    para_text = '\n'.join(current_paragraph)
                    chunks.append(self.create_chunk(
                        chunk_type="paragraph",
                        content=para_text.strip(),
                        parent_id=current_section
                    ))
                    current_paragraph = []
                
                # Collect quote lines
                quote_lines = []
                while i < len(lines) and lines[i].strip().startswith('>'):
                    quote_text = lines[i].strip().lstrip('>').strip()
                    quote_lines.append(quote_text)
                    i += 1
                
                if quote_lines:
                    chunks.append(self.create_chunk(
                        chunk_type="quote",
                        content=' '.join(quote_lines),
                        parent_id=current_section
                    ))
                continue
            
            # Check for all-caps lines (potential headers)
            if stripped.isupper() and len(stripped) > 5 and len(stripped) < 80:
                # Might be a header
                if current_paragraph:
                    para_text = '\n'.join(current_paragraph)
                    chunks.append(self.create_chunk(
                        chunk_type="paragraph",
                        content=para_text.strip(),
                        parent_id=current_section
                    ))
                    current_paragraph = []
                
                header_chunk = self.create_chunk(
                    chunk_type="heading",
                    content=stripped,
                    level=3
                )
                chunks.append(header_chunk)
                current_section = header_chunk.id
                i += 1
                continue
            
            # Regular paragraph line
            current_paragraph.append(line)
            i += 1
        
        # Don't forget last paragraph
        if current_paragraph:
            para_text = '\n'.join(current_paragraph)
            chunks.append(self.create_chunk(
                chunk_type="paragraph",
                content=para_text.strip(),
                parent_id=current_section
            ))
        
        # Post-process to merge small consecutive paragraphs
        chunks = self._merge_small_paragraphs(chunks)
        
        return chunks
    
    def _merge_small_paragraphs(self, chunks: List[Any]) -> List[Any]:
        """Merge small consecutive paragraphs"""
        merged = []
        i = 0
        
        while i < len(chunks):
            chunk = chunks[i]
            
            # Only merge paragraphs
            if chunk.type != "paragraph":
                merged.append(chunk)
                i += 1
                continue
            
            # Collect consecutive small paragraphs with same parent
            combined_content = [chunk.content]
            parent_id = chunk.parent_id
            j = i + 1
            
            while j < len(chunks):
                next_chunk = chunks[j]
                if (next_chunk.type == "paragraph" and 
                    next_chunk.parent_id == parent_id and
                    len(next_chunk.content) < 200):
                    combined_content.append(next_chunk.content)
                    j += 1
                else:
                    break
            
            # Create merged chunk
            if len(combined_content) > 1:
                merged_text = '\n\n'.join(combined_content)
                merged_chunk = self.create_chunk(
                    chunk_type="paragraph",
                    content=merged_text,
                    parent_id=parent_id
                )
                merged.append(merged_chunk)
                i = j
            else:
                merged.append(chunk)
                i += 1
        
        return merged