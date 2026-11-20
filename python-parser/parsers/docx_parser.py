"""
DOCX Parser - Extract structured content from Word documents
"""

import io
from typing import Dict, List, Any
from docx import Document
from docx.table import Table
from docx.text.paragraph import Paragraph
from docx.enum.style import WD_STYLE_TYPE

class DocxParser:
    def __init__(self):
        self.heading_levels = {
            'Heading 1': 1,
            'Heading 2': 2,
            'Heading 3': 3,
            'Heading 4': 4,
            'Heading 5': 5,
            'Heading 6': 6,
        }
    
    async def parse(self, content: bytes, options: Any) -> Dict[str, Any]:
        """Parse DOCX content and extract structured data"""
        doc = Document(io.BytesIO(content))
        
        metadata = self._extract_metadata(doc)
        chunks = []
        current_heading = None
        chunk_id = 0
        
        for element in self._iter_block_items(doc):
            if isinstance(element, Paragraph):
                chunk = self._parse_paragraph(element, chunk_id, current_heading)
                if chunk:
                    chunks.append(chunk)
                    if chunk['type'] == 'heading':
                        current_heading = chunk
                    chunk_id += 1
            
            elif isinstance(element, Table) and options.extract_tables:
                chunk = self._parse_table(element, chunk_id, current_heading)
                if chunk:
                    chunks.append(chunk)
                    chunk_id += 1
        
        # Extract lists
        chunks = self._identify_lists(chunks)
        
        return {
            'metadata': metadata,
            'chunks': chunks
        }
    
    def _extract_metadata(self, doc: Document) -> Dict[str, Any]:
        """Extract document metadata"""
        core_properties = doc.core_properties
        
        return {
            'title': core_properties.title or 'Untitled',
            'author': core_properties.author or 'Unknown',
            'subject': core_properties.subject,
            'keywords': core_properties.keywords,
            'created': core_properties.created.isoformat() if core_properties.created else None,
            'modified': core_properties.modified.isoformat() if core_properties.modified else None,
            'pages': len(doc.sections),
        }
    
    def _iter_block_items(self, parent):
        """Iterate through document elements in order"""
        from docx.document import Document
        from docx.oxml.table import CT_Tbl
        from docx.oxml.text.paragraph import CT_P
        from docx.table import _Cell, Table
        from docx.text.paragraph import Paragraph
        
        if isinstance(parent, Document):
            parent_elm = parent.element.body
        elif isinstance(parent, _Cell):
            parent_elm = parent._tc
        else:
            raise ValueError("Invalid parent type")
        
        for child in parent_elm.iterchildren():
            if isinstance(child, CT_P):
                yield Paragraph(child, parent)
            elif isinstance(child, CT_Tbl):
                yield Table(child, parent)
    
    def _parse_paragraph(self, para: Paragraph, chunk_id: int, parent: Any) -> Dict[str, Any]:
        """Parse a paragraph and identify its type"""
        text = para.text.strip()
        if not text:
            return None
        
        # Check if it's a heading
        if para.style.name in self.heading_levels:
            return {
                'id': f'chunk_{chunk_id}',
                'type': 'heading',
                'level': self.heading_levels[para.style.name],
                'content': text,
                'metadata': {
                    'style': para.style.name,
                    'bold': self._is_bold(para),
                    'italic': self._is_italic(para),
                },
                'parent': parent['id'] if parent and parent.get('level', 0) < self.heading_levels[para.style.name] else None
            }
        
        # Check if it's a list item
        if self._is_list_item(para):
            return {
                'id': f'chunk_{chunk_id}',
                'type': 'list_item',
                'content': text,
                'metadata': {
                    'list_type': 'bullet' if para.style.name.startswith('List Bullet') else 'numbered',
                    'level': self._get_list_level(para),
                },
                'parent': parent['id'] if parent else None
            }
        
        # Regular paragraph
        return {
            'id': f'chunk_{chunk_id}',
            'type': 'paragraph',
            'content': text,
            'metadata': {
                'style': para.style.name,
                'alignment': str(para.alignment),
                'bold': self._is_bold(para),
                'italic': self._is_italic(para),
            },
            'parent': parent['id'] if parent else None
        }
    
    def _parse_table(self, table: Table, chunk_id: int, parent: Any) -> Dict[str, Any]:
        """Parse a table into structured data"""
        headers = []
        rows = []
        
        # Extract headers (assuming first row)
        if len(table.rows) > 0:
            headers = [cell.text.strip() for cell in table.rows[0].cells]
        
        # Extract data rows
        for i, row in enumerate(table.rows[1:]):
            row_data = [cell.text.strip() for cell in row.cells]
            rows.append(row_data)
        
        return {
            'id': f'chunk_{chunk_id}',
            'type': 'table',
            'content': {
                'headers': headers,
                'rows': rows
            },
            'metadata': {
                'rows_count': len(table.rows),
                'cols_count': len(table.columns),
            },
            'parent': parent['id'] if parent else None
        }
    
    def _is_bold(self, para: Paragraph) -> bool:
        """Check if paragraph is bold"""
        if para.runs:
            return any(run.bold for run in para.runs)
        return False
    
    def _is_italic(self, para: Paragraph) -> bool:
        """Check if paragraph is italic"""
        if para.runs:
            return any(run.italic for run in para.runs)
        return False
    
    def _is_list_item(self, para: Paragraph) -> bool:
        """Check if paragraph is a list item"""
        style_name = para.style.name
        return (
            style_name.startswith('List') or 
            style_name.endswith('List') or
            'Bullet' in style_name or
            'Number' in style_name
        )
    
    def _get_list_level(self, para: Paragraph) -> int:
        """Get list indentation level"""
        # This is simplified - real implementation would check XML
        if 'List 2' in para.style.name or 'Level 2' in para.style.name:
            return 2
        elif 'List 3' in para.style.name or 'Level 3' in para.style.name:
            return 3
        return 1
    
    def _identify_lists(self, chunks: List[Dict]) -> List[Dict]:
        """Group consecutive list items into lists"""
        result = []
        current_list = None
        
        for chunk in chunks:
            if chunk['type'] == 'list_item':
                if current_list is None:
                    current_list = {
                        'id': f"list_{len(result)}",
                        'type': 'list',
                        'content': [],
                        'metadata': {
                            'list_type': chunk['metadata']['list_type']
                        },
                        'parent': chunk['parent']
                    }
                current_list['content'].append({
                    'text': chunk['content'],
                    'level': chunk['metadata']['level']
                })
            else:
                if current_list:
                    result.append(current_list)
                    current_list = None
                result.append(chunk)
        
        if current_list:
            result.append(current_list)
        
        return result