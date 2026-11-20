"""
PPTX Parser - Fast, simple extraction like the original service
"""

import io
import zipfile
import xml.etree.ElementTree as ET
from typing import Dict, Any, List, Optional
import structlog
import json

from ..models import ParsedDocument, ParseOptions, DocumentMetadata
from .base import BaseParser

logger = structlog.get_logger()


class PPTXParser(BaseParser):
    """PPTX parser that mimics the original service functionality"""
    
    async def parse(self, file: Any, filename: str, options: Optional[ParseOptions] = None) -> ParsedDocument:
        """Parse PPTX content"""
        options = options or ParseOptions()
        
        # Read file content
        if hasattr(file, 'read'):
            content = file.read()
            if hasattr(file, 'seek'):
                file.seek(0)
        else:
            content = file
            
        # Extract content
        extraction_result = self._extract_pptx_content(content, filename)
        
        # Create document with extracted content
        doc = ParsedDocument()
        doc.content = extraction_result['extracted_text']
        doc.metadata = DocumentMetadata(
            title=extraction_result['metadata'].get('presentation_title', filename),
            author=extraction_result['metadata'].get('author'),
            pages=extraction_result['metadata'].get('total_slides', 0),
            word_count=len(extraction_result['extracted_text'].split()),
            has_images=extraction_result['metadata'].get('has_images', False),
            has_tables=extraction_result['metadata'].get('has_tables', False)
        )
        
        # Create chunks in the same format as the original service
        doc.chunks = self._format_for_chunks(extraction_result)
        
        return doc
    
    def _extract_pptx_content(self, content: bytes, filename: str) -> Dict[str, Any]:
        """Extract content from PPTX file matching original service format"""
        result = {
            'status': 'success',
            'extracted_text': '',
            'slides': [],
            'metadata': {
                'presentation_title': filename,
                'author': 'Unknown',
                'total_slides': 0,
                'has_images': False,
                'has_tables': False,
                'has_notes': False,
                'total_images': 0,
                'total_tables': 0
            }
        }
        
        all_text_parts = []
        
        try:
            with zipfile.ZipFile(io.BytesIO(content)) as zf:
                # Get core properties for metadata
                if 'docProps/core.xml' in zf.namelist():
                    try:
                        core_xml = zf.read('docProps/core.xml')
                        core_root = ET.fromstring(core_xml)
                        
                        # Extract title
                        title_elem = core_root.find('.//{http://purl.org/dc/elements/1.1/}title')
                        if title_elem is not None and title_elem.text:
                            result['metadata']['presentation_title'] = title_elem.text
                        
                        # Extract author
                        creator_elem = core_root.find('.//{http://purl.org/dc/elements/1.1/}creator')
                        if creator_elem is not None and creator_elem.text:
                            result['metadata']['author'] = creator_elem.text
                    except:
                        pass
                
                # Get slide list
                slide_files = sorted([f for f in zf.namelist() if f.startswith('ppt/slides/slide') and f.endswith('.xml')])
                result['metadata']['total_slides'] = len(slide_files)
                
                # Process each slide
                for slide_idx, slide_file in enumerate(slide_files):
                    slide_num = slide_idx + 1
                    slide_data = {
                        'slide_number': slide_num,
                        'title': '',
                        'content': [],
                        'notes': '',
                        'images': [],
                        'tables': []
                    }
                    
                    # Extract slide content
                    try:
                        slide_xml = zf.read(slide_file)
                        slide_root = ET.fromstring(slide_xml)
                        
                        # Extract all text
                        slide_texts = []
                        for text_elem in slide_root.iter():
                            if text_elem.tag.endswith('}t'):
                                text = text_elem.text
                                if text and text.strip():
                                    slide_texts.append(text.strip())
                        
                        if slide_texts:
                            # First text is often the title
                            slide_data['title'] = slide_texts[0]
                            slide_data['content'] = slide_texts
                            all_text_parts.extend(slide_texts)
                        
                        # Count images
                        for elem in slide_root.iter():
                            if elem.tag.endswith('}pic'):
                                result['metadata']['has_images'] = True
                                result['metadata']['total_images'] += 1
                                slide_data['images'].append({
                                    'index': result['metadata']['total_images']
                                })
                        
                        # Count tables
                        for elem in slide_root.iter():
                            if elem.tag.endswith('}tbl'):
                                result['metadata']['has_tables'] = True
                                result['metadata']['total_tables'] += 1
                                slide_data['tables'].append([])
                    
                    except Exception as e:
                        logger.warning(f"Error processing slide {slide_num}: {e}")
                    
                    # Extract notes
                    notes_file = f'ppt/notesSlides/notesSlide{slide_num}.xml'
                    if notes_file in zf.namelist():
                        try:
                            notes_xml = zf.read(notes_file)
                            notes_root = ET.fromstring(notes_xml)
                            
                            notes_texts = []
                            for text_elem in notes_root.iter():
                                if text_elem.tag.endswith('}t'):
                                    text = text_elem.text
                                    if text and text.strip():
                                        notes_texts.append(text.strip())
                            
                            if notes_texts:
                                slide_data['notes'] = ' '.join(notes_texts)
                                result['metadata']['has_notes'] = True
                        except:
                            pass
                    
                    result['slides'].append(slide_data)
                
                # Join all text
                result['extracted_text'] = '\n\n'.join(all_text_parts)
                
        except Exception as e:
            logger.error(f"Error extracting PPTX content: {e}")
            result['status'] = 'error'
            result['extracted_text'] = f"Error processing PowerPoint file: {str(e)}"
        
        return result
    
    def _format_for_chunks(self, extracted_data: Dict[str, Any]) -> List[Any]:
        """Format extracted content for chunks like the original service"""
        chunks = []
        
        # Create chunks for each slide
        for slide in extracted_data['slides']:
            slide_content = {
                'slideNumber': slide['slide_number'],
                'title': slide['title'],
                'content': slide['content'],
                'notes': slide['notes'],
                'images': slide['images'],
                'layout': 'default'
            }
            
            chunks.append({
                'content': json.dumps(slide_content),
                'metadata': {
                    'type': 'pptx_slide',
                    'slideNumber': slide['slide_number'],
                    'hasImages': len(slide['images']) > 0,
                    'hasNotes': bool(slide['notes']),
                    'hasTables': len(slide['tables']) > 0
                }
            })
        
        # Add a summary chunk with all text
        if extracted_data['extracted_text']:
            chunks.append({
                'content': extracted_data['extracted_text'],
                'metadata': {
                    'type': 'pptx_full_text',
                    'totalSlides': extracted_data['metadata']['total_slides'],
                    'presentationTitle': extracted_data['metadata']['presentation_title'],
                    'author': extracted_data['metadata']['author']
                }
            })
        
        return chunks