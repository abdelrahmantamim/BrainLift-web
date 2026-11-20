"""
HTML Parser - Parses HTML files with structure preservation
"""

import re
from typing import Dict, Any, List, Optional
import structlog
from bs4 import BeautifulSoup, NavigableString

from ..models import ParsedDocument, ParseOptions, DocumentMetadata, Chunk, ChunkMetadata
from .base import BaseParser

logger = structlog.get_logger()


class HTMLParser(BaseParser):
    """Parser for HTML files"""
    
    async def parse(
        self, 
        file: Any, 
        filename: str, 
        options: Optional[ParseOptions] = None
    ) -> ParsedDocument:
        """Parse HTML file"""
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
                html_text = content.decode('utf-8', errors='ignore')
            else:
                html_text = content
            
            # Parse HTML
            soup = BeautifulSoup(html_text, 'html.parser')
            
            # Extract metadata
            metadata = self._extract_metadata(soup)
            
            # Remove script and style elements
            for script in soup(["script", "style"]):
                script.decompose()
            
            # Extract text content
            text_content = soup.get_text(separator='\n', strip=True)
            
            # Create chunks from structure
            chunks = []
            chunk_id = 0
            
            # Extract title
            title = soup.find('title')
            if title:
                chunks.append(Chunk(
                    id=f"{filename}_chunk_{chunk_id}",
                    type="heading",
                    level=1,
                    content=title.get_text(strip=True),
                    metadata=ChunkMetadata(
                        page=1,
                        section="Title"
                    )
                ))
                chunk_id += 1
            
            # Process body content
            body = soup.find('body') or soup
            
            # Extract headings
            for i in range(1, 7):
                for heading in body.find_all(f'h{i}'):
                    chunks.append(Chunk(
                        id=f"{filename}_chunk_{chunk_id}",
                        type="heading",
                        level=i,
                        content=heading.get_text(strip=True),
                        metadata=ChunkMetadata(
                            page=1,
                            section=f"Heading {i}"
                        )
                    ))
                    chunk_id += 1
            
            # Extract paragraphs
            for para in body.find_all('p'):
                text = para.get_text(strip=True)
                if text:
                    chunks.append(Chunk(
                        id=f"{filename}_chunk_{chunk_id}",
                        type="paragraph",
                        content=text,
                        metadata=ChunkMetadata(
                            page=1,
                            section="Paragraph"
                        )
                    ))
                    chunk_id += 1
            
            # Extract lists
            for list_elem in body.find_all(['ul', 'ol']):
                list_items = []
                for li in list_elem.find_all('li'):
                    list_items.append(li.get_text(strip=True))
                
                if list_items:
                    chunks.append(Chunk(
                        id=f"{filename}_chunk_{chunk_id}",
                        type="list",
                        content='\n'.join(f"• {item}" for item in list_items),
                        metadata=ChunkMetadata(
                            page=1,
                            section="List",
                            list_type="ordered" if list_elem.name == 'ol' else "unordered"
                        )
                    ))
                    chunk_id += 1
            
            # Extract tables
            tables = []
            for table in body.find_all('table'):
                table_data = self._parse_html_table(table)
                if table_data:
                    tables.append(table_data)
                    chunks.append(Chunk(
                        id=f"{filename}_chunk_{chunk_id}",
                        type="table",
                        content=table_data,
                        metadata=ChunkMetadata(
                            page=1,
                            section="Table",
                            has_table=True,
                            table_rows=len(table_data.get('rows', [])),
                            table_cols=len(table_data.get('headers', []))
                        )
                    ))
                    chunk_id += 1
            
            # Extract images
            images = []
            if options.extract_images:
                for img in body.find_all('img'):
                    img_info = {
                        'src': img.get('src', ''),
                        'alt': img.get('alt', ''),
                        'title': img.get('title', '')
                    }
                    images.append(img_info)
                    
                    chunks.append(Chunk(
                        id=f"{filename}_chunk_{chunk_id}",
                        type="image",
                        content=f"[Image: {img_info['alt'] or img_info['src']}]",
                        metadata=ChunkMetadata(
                            page=1,
                            section="Image",
                            has_image=True,
                            image_id=f"img_{chunk_id}"
                        )
                    ))
                    chunk_id += 1
            
            # Extract code blocks
            for code in body.find_all(['code', 'pre']):
                code_text = code.get_text(strip=True)
                if code_text:
                    chunks.append(Chunk(
                        id=f"{filename}_chunk_{chunk_id}",
                        type="code",
                        content=code_text,
                        metadata=ChunkMetadata(
                            page=1,
                            section="Code",
                            language=code.get('class', [''])[0] if code.get('class') else 'text'
                        )
                    ))
                    chunk_id += 1
            
            # Create document metadata
            doc_metadata = DocumentMetadata(
                title=metadata.get('title', filename),
                author=metadata.get('author'),
                subject=metadata.get('description'),
                keywords=metadata.get('keywords'),
                page_count=1,
                word_count=len(text_content.split()),
                has_tables=len(tables) > 0,
                table_count=len(tables),
                has_images=len(images) > 0,
                image_count=len(images)
            )
            
            return ParsedDocument(
                content=text_content,
                chunks=chunks,
                metadata=doc_metadata,
                tables=tables,
                images=images
            )
            
        except Exception as e:
            logger.error(f"Error parsing HTML {filename}: {str(e)}")
            raise
    
    def _extract_metadata(self, soup: BeautifulSoup) -> Dict[str, str]:
        """Extract metadata from HTML head"""
        metadata = {}
        
        # Title
        title = soup.find('title')
        if title:
            metadata['title'] = title.get_text(strip=True)
        
        # Meta tags
        for meta in soup.find_all('meta'):
            name = meta.get('name', '').lower()
            content = meta.get('content', '')
            
            if name in ['author', 'description', 'keywords']:
                metadata[name] = content
            elif meta.get('property') == 'og:title':
                metadata['og_title'] = content
            elif meta.get('property') == 'og:description':
                metadata['og_description'] = content
        
        return metadata
    
    def _parse_html_table(self, table) -> Optional[Dict[str, Any]]:
        """Parse HTML table into structured format"""
        try:
            headers = []
            rows = []
            
            # Try to find headers in thead
            thead = table.find('thead')
            if thead:
                header_row = thead.find('tr')
                if header_row:
                    headers = [th.get_text(strip=True) for th in header_row.find_all(['th', 'td'])]
            
            # If no thead, check if first row has th elements
            if not headers:
                first_row = table.find('tr')
                if first_row and first_row.find('th'):
                    headers = [th.get_text(strip=True) for th in first_row.find_all(['th', 'td'])]
            
            # Get all rows
            tbody = table.find('tbody') or table
            for tr in tbody.find_all('tr'):
                # Skip header row if already processed
                if headers and tr.find('th'):
                    continue
                
                row = [td.get_text(strip=True) for td in tr.find_all(['td', 'th'])]
                if row:
                    rows.append(row)
            
            # Generate headers if not found
            if not headers and rows:
                headers = [f"Column {i+1}" for i in range(len(rows[0]))]
            
            return {
                'headers': headers,
                'rows': rows,
                'has_header': bool(headers)
            }
        except Exception as e:
            logger.warning(f"Failed to parse table: {e}")
            return None