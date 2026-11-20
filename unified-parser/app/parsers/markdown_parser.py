"""
Markdown Parser - Parses markdown files with structure preservation
"""

import re
from typing import Dict, Any, List, Optional, Tuple
import structlog
import markdown
from markdown.extensions import codehilite, tables, toc, fenced_code, nl2br
from bs4 import BeautifulSoup

from ..models import ParsedDocument, ParseOptions, DocumentMetadata, Chunk, ChunkMetadata
from .base import BaseParser

logger = structlog.get_logger()


class MarkdownParser(BaseParser):
    """Parser for Markdown files with structure preservation"""
    
    def __init__(self):
        super().__init__()
        # Initialize markdown processor with extensions
        self.md = markdown.Markdown(extensions=[
            'markdown.extensions.tables',
            'markdown.extensions.fenced_code',
            'markdown.extensions.codehilite',
            'markdown.extensions.nl2br',
            'markdown.extensions.toc',
            'markdown.extensions.meta',
            'markdown.extensions.attr_list',
            'markdown.extensions.footnotes',
            'markdown.extensions.def_list',
        ])
    
    async def parse(
        self, 
        file: Any, 
        filename: str, 
        options: Optional[ParseOptions] = None
    ) -> ParsedDocument:
        """Parse markdown file"""
        options = options or ParseOptions()
        
        try:
            # Read file content
            if hasattr(file, 'read'):
                content = file.read()
                if hasattr(file, 'seek'):
                    file.seek(0)
            else:
                content = file
            
            # Decode content
            if isinstance(content, bytes):
                text = content.decode('utf-8', errors='ignore')
            else:
                text = content
            
            # Parse markdown structure
            chunks = []
            
            # Extract raw structure first
            lines = text.split('\n')
            current_section = []
            current_level = 0
            chunk_id = 0
            
            # Extract metadata from frontmatter if present
            metadata = self._extract_frontmatter(lines)
            
            # Process line by line for structure
            i = 0
            while i < len(lines):
                line = lines[i]
                
                # Check for headers
                header_match = re.match(r'^(#{1,6})\s+(.+)$', line)
                if header_match:
                    # Save current section if exists
                    if current_section:
                        content_text = '\n'.join(current_section).strip()
                        if content_text:
                            chunks.append(Chunk(
                                id=f"{filename}_chunk_{chunk_id}",
                                type="paragraph",
                                level=current_level,
                                content=content_text,
                                metadata=ChunkMetadata(
                                    page=1,
                                    section=f"Level {current_level}"
                                )
                            ))
                            chunk_id += 1
                    
                    # Create header chunk
                    level = len(header_match.group(1))
                    header_text = header_match.group(2)
                    chunks.append(Chunk(
                        id=f"{filename}_chunk_{chunk_id}",
                        type="heading",
                        level=level,
                        content=header_text,
                        metadata=ChunkMetadata(
                            page=1,
                            section=f"Heading {level}"
                        )
                    ))
                    chunk_id += 1
                    current_section = []
                    current_level = level
                
                # Check for code blocks
                elif line.strip().startswith('```'):
                    # Extract code block
                    code_lines = [line]
                    i += 1
                    while i < len(lines) and not lines[i].strip().startswith('```'):
                        code_lines.append(lines[i])
                        i += 1
                    if i < len(lines):
                        code_lines.append(lines[i])
                    
                    # Extract language if specified
                    lang_match = re.match(r'^```(\w+)', code_lines[0])
                    language = lang_match.group(1) if lang_match else 'text'
                    
                    # Create code chunk
                    code_content = '\n'.join(code_lines[1:-1])
                    chunks.append(Chunk(
                        id=f"{filename}_chunk_{chunk_id}",
                        type="code",
                        content=code_content,
                        metadata=ChunkMetadata(
                            page=1,
                            section="Code Block",
                            language=language
                        )
                    ))
                    chunk_id += 1
                
                # Check for tables
                elif '|' in line and i + 1 < len(lines) and re.match(r'^[\s\-:|]+$', lines[i + 1]):
                    # Extract table
                    table_lines = [line]
                    i += 1
                    while i < len(lines) and '|' in lines[i]:
                        table_lines.append(lines[i])
                        i += 1
                    i -= 1  # Back up one
                    
                    # Parse table
                    table_data = self._parse_markdown_table(table_lines)
                    if table_data:
                        chunks.append(Chunk(
                            id=f"{filename}_chunk_{chunk_id}",
                            type="table",
                            content=table_data,
                            metadata=ChunkMetadata(
                                page=1,
                                section="Table",
                                has_table=True,
                                table_rows=len(table_data['rows']),
                                table_cols=len(table_data['headers']) if table_data['headers'] else 0
                            )
                        ))
                        chunk_id += 1
                
                # Check for lists
                elif re.match(r'^[\s]*[-*+]\s+', line) or re.match(r'^[\s]*\d+\.\s+', line):
                    # Extract list
                    list_lines = [line]
                    i += 1
                    while i < len(lines) and (
                        re.match(r'^[\s]*[-*+]\s+', lines[i]) or 
                        re.match(r'^[\s]*\d+\.\s+', lines[i]) or
                        (lines[i].strip() and not lines[i].startswith('#'))
                    ):
                        list_lines.append(lines[i])
                        i += 1
                    i -= 1  # Back up one
                    
                    # Create list chunk
                    list_content = '\n'.join(list_lines)
                    chunks.append(Chunk(
                        id=f"{filename}_chunk_{chunk_id}",
                        type="list",
                        content=list_content,
                        metadata=ChunkMetadata(
                            page=1,
                            section="List",
                            list_type="unordered" if line.strip().startswith(('-', '*', '+')) else "ordered"
                        )
                    ))
                    chunk_id += 1
                
                # Check for images
                elif re.search(r'!\[([^\]]*)\]\(([^)]+)\)', line):
                    # Extract image references
                    img_matches = re.finditer(r'!\[([^\]]*)\]\(([^)]+)\)', line)
                    for match in img_matches:
                        alt_text = match.group(1)
                        img_url = match.group(2)
                        chunks.append(Chunk(
                            id=f"{filename}_chunk_{chunk_id}",
                            type="image",
                            content=f"[Image: {alt_text or img_url}]",
                            metadata=ChunkMetadata(
                                page=1,
                                section="Image",
                                has_image=True,
                                image_id=f"img_{chunk_id}"
                            )
                        ))
                        chunk_id += 1
                    
                    # Add the line to current section too
                    current_section.append(line)
                
                else:
                    # Regular content
                    current_section.append(line)
                
                i += 1
            
            # Don't forget the last section
            if current_section:
                content_text = '\n'.join(current_section).strip()
                if content_text:
                    chunks.append(Chunk(
                        id=f"{filename}_chunk_{chunk_id}",
                        type="paragraph",
                        level=current_level,
                        content=content_text,
                        metadata=ChunkMetadata(
                            page=1,
                            section=f"Level {current_level}"
                        )
                    ))
            
            # Calculate word count
            word_count = len(text.split())
            
            # Extract tables for separate table list
            tables = [chunk.content for chunk in chunks if chunk.type == "table"]
            
            # Create document metadata
            doc_metadata = DocumentMetadata(
                title=metadata.get('title', filename),
                author=metadata.get('author'),
                created_date=metadata.get('date'),
                page_count=1,
                word_count=word_count,
                has_tables=len(tables) > 0,
                table_count=len(tables)
            )
            
            return ParsedDocument(
                content=text,
                chunks=chunks,
                metadata=doc_metadata,
                tables=tables
            )
            
        except Exception as e:
            logger.error(f"Error parsing markdown {filename}: {str(e)}")
            raise
    
    def _extract_frontmatter(self, lines: List[str]) -> Dict[str, Any]:
        """Extract YAML frontmatter if present"""
        metadata = {}
        
        if lines and lines[0].strip() == '---':
            # Find end of frontmatter
            end_idx = 1
            while end_idx < len(lines) and lines[end_idx].strip() != '---':
                end_idx += 1
            
            if end_idx < len(lines):
                # Parse frontmatter
                for i in range(1, end_idx):
                    match = re.match(r'^(\w+):\s*(.+)$', lines[i])
                    if match:
                        key = match.group(1).lower()
                        value = match.group(2).strip()
                        # Remove quotes if present
                        if value.startswith('"') and value.endswith('"'):
                            value = value[1:-1]
                        metadata[key] = value
        
        return metadata
    
    def _parse_markdown_table(self, lines: List[str]) -> Optional[Dict[str, Any]]:
        """Parse markdown table into structured format"""
        if len(lines) < 2:
            return None
        
        try:
            # Extract headers
            headers = [cell.strip() for cell in lines[0].split('|') if cell.strip()]
            
            # Skip separator line
            rows = []
            for i in range(2, len(lines)):
                cells = [cell.strip() for cell in lines[i].split('|') if cell.strip()]
                if cells:
                    rows.append(cells)
            
            return {
                'headers': headers,
                'rows': rows,
                'has_header': True
            }
        except:
            return None