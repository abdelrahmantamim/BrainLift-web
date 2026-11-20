"""
PPTX Parser - Extract structured content from PowerPoint presentations
"""

import io
from typing import Dict, List, Any, Optional
from pptx import Presentation
from pptx.enum.shapes import MSO_SHAPE_TYPE
import base64

class PptxParser:
    def __init__(self):
        self.slide_number = 0
        
    async def parse(self, content: bytes, options: Any) -> Dict[str, Any]:
        """Parse PPTX content and extract structured data"""
        prs = Presentation(io.BytesIO(content))
        
        metadata = self._extract_metadata(prs)
        chunks = []
        chunk_id = 0
        
        for slide_idx, slide in enumerate(prs.slides):
            slide_chunks = self._parse_slide(slide, slide_idx + 1, chunk_id, options)
            chunks.extend(slide_chunks)
            chunk_id += len(slide_chunks)
        
        return {
            'metadata': metadata,
            'chunks': chunks
        }
    
    def _extract_metadata(self, prs: Presentation) -> Dict[str, Any]:
        """Extract presentation metadata"""
        core_props = prs.core_properties
        
        return {
            'title': core_props.title or 'Untitled Presentation',
            'author': core_props.author or 'Unknown',
            'subject': core_props.subject,
            'keywords': core_props.keywords,
            'created': core_props.created.isoformat() if core_props.created else None,
            'modified': core_props.modified.isoformat() if core_props.modified else None,
            'slides_count': len(prs.slides),
            'slide_width': prs.slide_width,
            'slide_height': prs.slide_height,
        }
    
    def _parse_slide(self, slide, slide_num: int, start_chunk_id: int, options: Any) -> List[Dict]:
        """Parse a single slide into chunks"""
        chunks = []
        current_chunk_id = start_chunk_id
        
        # Extract slide title
        title = self._get_slide_title(slide)
        if title:
            chunks.append({
                'id': f'chunk_{current_chunk_id}',
                'type': 'heading',
                'level': 1,
                'content': title,
                'metadata': {
                    'slide_number': slide_num,
                    'is_title_slide': self._is_title_slide(slide)
                }
            })
            current_chunk_id += 1
        
        # Extract text from shapes
        for shape in slide.shapes:
            if shape.has_text_frame:
                text_chunks = self._parse_text_frame(shape.text_frame, current_chunk_id, slide_num)
                chunks.extend(text_chunks)
                current_chunk_id += len(text_chunks)
            
            elif shape.has_table and options.extract_tables:
                table_chunk = self._parse_table(shape.table, current_chunk_id, slide_num)
                if table_chunk:
                    chunks.append(table_chunk)
                    current_chunk_id += 1
            
            elif shape.shape_type == MSO_SHAPE_TYPE.PICTURE:
                # Note: Image extraction could be added here
                chunks.append({
                    'id': f'chunk_{current_chunk_id}',
                    'type': 'image',
                    'content': '[Image placeholder]',
                    'metadata': {
                        'slide_number': slide_num,
                        'has_image': True,
                        'image_name': shape.name
                    }
                })
                current_chunk_id += 1
        
        # Extract speaker notes
        if slide.has_notes_slide:
            notes = self._extract_notes(slide.notes_slide)
            if notes:
                chunks.append({
                    'id': f'chunk_{current_chunk_id}',
                    'type': 'note',
                    'content': notes,
                    'metadata': {
                        'slide_number': slide_num,
                        'is_speaker_note': True
                    }
                })
                current_chunk_id += 1
        
        return chunks
    
    def _get_slide_title(self, slide) -> Optional[str]:
        """Extract slide title if exists"""
        if slide.shapes.title:
            return slide.shapes.title.text.strip()
        
        # Look for title placeholder
        for shape in slide.placeholders:
            if shape.placeholder_format.type == 1:  # Title placeholder
                if shape.has_text_frame and shape.text:
                    return shape.text.strip()
        
        return None
    
    def _is_title_slide(self, slide) -> bool:
        """Check if slide is a title slide"""
        # Simple heuristic: fewer shapes, has title and subtitle
        if len(slide.shapes) <= 3:
            has_title = False
            has_subtitle = False
            
            for shape in slide.placeholders:
                if shape.placeholder_format.type == 1:  # Title
                    has_title = True
                elif shape.placeholder_format.type == 2:  # Subtitle
                    has_subtitle = True
            
            return has_title and has_subtitle
        
        return False
    
    def _parse_text_frame(self, text_frame, start_chunk_id: int, slide_num: int) -> List[Dict]:
        """Parse text frame into chunks"""
        chunks = []
        current_chunk_id = start_chunk_id
        
        for paragraph in text_frame.paragraphs:
            text = paragraph.text.strip()
            if not text:
                continue
            
            # Determine if it's a list item
            if paragraph.level > 0 or self._is_bullet_paragraph(paragraph):
                chunks.append({
                    'id': f'chunk_{current_chunk_id}',
                    'type': 'list_item',
                    'content': text,
                    'metadata': {
                        'slide_number': slide_num,
                        'level': paragraph.level,
                        'is_bullet': True
                    }
                })
            else:
                chunks.append({
                    'id': f'chunk_{current_chunk_id}',
                    'type': 'paragraph',
                    'content': text,
                    'metadata': {
                        'slide_number': slide_num,
                        'font_size': self._get_font_size(paragraph),
                        'is_bold': self._is_bold(paragraph),
                        'is_italic': self._is_italic(paragraph)
                    }
                })
            
            current_chunk_id += 1
        
        # Group consecutive list items
        return self._group_list_items(chunks)
    
    def _parse_table(self, table, chunk_id: int, slide_num: int) -> Optional[Dict]:
        """Parse table into structured data"""
        if not table.rows:
            return None
        
        headers = []
        rows = []
        
        # First row as headers
        if len(table.rows) > 0:
            headers = [cell.text.strip() for cell in table.rows[0].cells]
        
        # Data rows
        for row in table.rows[1:]:
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
                'slide_number': slide_num,
                'rows_count': len(table.rows),
                'cols_count': len(table.columns)
            }
        }
    
    def _extract_notes(self, notes_slide) -> Optional[str]:
        """Extract speaker notes from slide"""
        notes_text = []
        
        for shape in notes_slide.notes_text_frame.paragraphs:
            text = shape.text.strip()
            if text:
                notes_text.append(text)
        
        return '\n'.join(notes_text) if notes_text else None
    
    def _is_bullet_paragraph(self, paragraph) -> bool:
        """Check if paragraph has bullet formatting"""
        # This is a simplified check
        return paragraph.level > 0 or (
            hasattr(paragraph, '_element') and 
            paragraph._element.pPr is not None and
            paragraph._element.pPr.buChar is not None
        )
    
    def _get_font_size(self, paragraph) -> Optional[int]:
        """Get font size from paragraph"""
        try:
            if paragraph.runs and paragraph.runs[0].font.size:
                return paragraph.runs[0].font.size.pt
        except:
            pass
        return None
    
    def _is_bold(self, paragraph) -> bool:
        """Check if paragraph is bold"""
        try:
            if paragraph.runs:
                return any(run.font.bold for run in paragraph.runs if run.font.bold is not None)
        except:
            pass
        return False
    
    def _is_italic(self, paragraph) -> bool:
        """Check if paragraph is italic"""
        try:
            if paragraph.runs:
                return any(run.font.italic for run in paragraph.runs if run.font.italic is not None)
        except:
            pass
        return False
    
    def _group_list_items(self, chunks: List[Dict]) -> List[Dict]:
        """Group consecutive list items"""
        if not chunks:
            return chunks
        
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
                            'slide_number': chunk['metadata']['slide_number'],
                            'list_type': 'bullet'
                        }
                    }
                current_list['content'].append({
                    'text': chunk['content'],
                    'level': chunk['metadata'].get('level', 0)
                })
            else:
                if current_list:
                    result.append(current_list)
                    current_list = None
                result.append(chunk)
        
        if current_list:
            result.append(current_list)
        
        return result