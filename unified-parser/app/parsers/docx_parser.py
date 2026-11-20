"""
DOCX Parser - Extracts text, tables, lists, headers, and structure from Word documents
"""

import io
from typing import Dict, Any, List, Optional, Optional
import structlog
from docx import Document
from docx.document import Document as DocumentType
from docx.text.paragraph import Paragraph
from docx.table import Table
from docx.oxml.ns import qn

from ..models import ParsedDocument, ParseOptions, DocumentMetadata
from .base import BaseParser

logger = structlog.get_logger()


class DOCXParser(BaseParser):
    """Parser for Microsoft Word documents"""
    
    async def parse(self, file: Any, filename: str, options: Optional[ParseOptions] = None) -> ParsedDocument:
        """Parse DOCX content"""
        options = options or ParseOptions()
        
        # Read file content
        if hasattr(file, 'read'):
            content = file.read()
            if hasattr(file, 'seek'):
                file.seek(0)
        else:
            content = file
            
        # Ensure content is bytes
        if isinstance(content, str):
            content = content.encode('utf-8')
        try:
            doc = Document(io.BytesIO(content))
            parsed_doc = ParsedDocument()
            
            # Extract metadata
            core_props = doc.core_properties
            parsed_doc.metadata = DocumentMetadata(
                title=core_props.title or self._extract_title_from_content(doc),
                author=core_props.author,
                created_date=core_props.created.isoformat() if core_props.created else None,
                modified_date=core_props.modified.isoformat() if core_props.modified else None,
                pages=self._estimate_page_count(doc)
            )
            
            # Process document elements
            current_page = 1
            chunk_id = 0
            current_heading_id = None
            heading_stack = []  # Track heading hierarchy
            
            for element in self._iter_block_items(doc):
                if isinstance(element, Paragraph):
                    chunk = await self._process_paragraph(
                        element, current_page, chunk_id, heading_stack
                    )
                    if chunk:
                        # Update heading tracking
                        if chunk.type == "heading":
                            level = chunk.level or 1
                            # Update heading stack
                            while heading_stack and heading_stack[-1]["level"] >= level:
                                heading_stack.pop()
                            heading_stack.append({
                                "id": chunk.id,
                                "level": level,
                                "text": chunk.content
                            })
                            current_heading_id = chunk.id
                        elif current_heading_id and chunk.type in ["paragraph", "text"]:
                            chunk.parent_id = current_heading_id
                        
                        parsed_doc.chunks.append(chunk)
                        chunk_id += 1
                    
                    # Check for inline images in paragraph
                    image_chunks = await self._extract_paragraph_images(
                        element, current_page, chunk_id
                    )
                    for img_chunk in image_chunks:
                        parsed_doc.chunks.append(img_chunk)
                        parsed_doc.metadata.has_images = True
                        chunk_id += 1
                        
                elif isinstance(element, Table) and options.extract_tables:
                    table_chunk = await self._process_table(
                        element, current_page, chunk_id, current_heading_id
                    )
                    if table_chunk:
                        parsed_doc.chunks.append(table_chunk)
                        parsed_doc.metadata.has_tables = True
                        chunk_id += 1
            
            # Extract text for word count
            all_text = self.extract_text_from_chunks(parsed_doc.chunks)
            parsed_doc.metadata.word_count = self.count_words(all_text)
            
            # Clear chunks and set content - let JS handle chunking
            parsed_doc.chunks = []
            parsed_doc.content = all_text
            
            return parsed_doc
            
        except Exception as e:
            logger.error("docx_parsing_failed", error=str(e))
            raise
    
    def _iter_block_items(self, document: DocumentType):
        """
        Yield each paragraph and table in document order.
        """
        from docx.document import Document
        from docx.oxml.text.paragraph import CT_P
        from docx.oxml.table import CT_Tbl
        from docx.table import Table
        from docx.text.paragraph import Paragraph
        
        for child in document.element.body:
            if isinstance(child, CT_P):
                yield Paragraph(child, document)
            elif isinstance(child, CT_Tbl):
                yield Table(child, document)
    
    async def _process_paragraph(
        self, 
        para: Paragraph, 
        page: int, 
        chunk_id: int,
        heading_stack: List[Dict]
    ) -> Optional[Any]:
        """Process a paragraph element"""
        text = para.text.strip()
        if not text:
            return None
        
        # Detect paragraph type
        style_name = para.style.name if para.style else ""
        
        # Check if it's a heading
        if self._is_heading(para):
            level = self._get_heading_level(para)
            return self.create_chunk(
                chunk_type="heading",
                content=text,
                level=level,
                metadata={
                    "page": page,
                    "style": style_name,
                    "section_path": self._get_section_path(heading_stack, level)
                }
            )
        
        # Check if it's a list item
        if self._is_list_item(para):
            # Group consecutive list items
            return self.create_chunk(
                chunk_type="list_item",
                content={
                    "text": text,
                    "level": self._get_list_level(para),
                    "style": self._get_list_style(para)
                },
                metadata={"page": page}
            )
        
        # Regular paragraph
        return self.create_chunk(
            chunk_type="paragraph",
            content=text,
            metadata={
                "page": page,
                "style": style_name,
                "formatting": self._extract_formatting(para)
            }
        )
    
    async def _process_table(
        self, 
        table: Table, 
        page: int, 
        chunk_id: int,
        parent_heading_id: Optional[str]
    ) -> Optional[Any]:
        """Process a table element"""
        if not table.rows:
            return None
        
        # Extract headers and rows
        headers = []
        rows = []
        
        # First row might be headers
        first_row = table.rows[0]
        is_header = self._is_header_row(first_row)
        
        if is_header:
            headers = [self.clean_text(cell.text) for cell in first_row.cells]
            data_rows = table.rows[1:]
        else:
            # Generate generic headers
            headers = [f"Column {i+1}" for i in range(len(first_row.cells))]
            data_rows = table.rows
        
        # Extract data rows
        for row in data_rows:
            row_data = [self.clean_text(cell.text) for cell in row.cells]
            rows.append(row_data)
        
        # Calculate table summary
        table_summary = self._generate_table_summary(headers, rows)
        
        return self.create_chunk(
            chunk_type="table",
            content={
                "headers": headers,
                "rows": rows,
                "summary": table_summary
            },
            parent_id=parent_heading_id,
            metadata={
                "page": page,
                "row_count": len(rows),
                "column_count": len(headers)
            }
        )
    
    def _is_heading(self, para: Paragraph) -> bool:
        """Check if paragraph is a heading"""
        if para.style and para.style.name:
            style_name = para.style.name.lower()
            return 'heading' in style_name or style_name.startswith('h')
        
        # Check for outline level
        if hasattr(para, '_element'):
            pPr = para._element.get_or_add_pPr()
            outlineLvl = pPr.find(qn('w:outlineLvl'))
            if outlineLvl is not None:
                return True
        
        return False
    
    def _get_heading_level(self, para: Paragraph) -> int:
        """Get heading level (1-6)"""
        if para.style and para.style.name:
            style_name = para.style.name
            # Try to extract number from style name
            if 'Heading' in style_name:
                try:
                    level = int(style_name.split()[-1])
                    return min(max(level, 1), 6)
                except:
                    pass
        
        # Check outline level
        if hasattr(para, '_element'):
            pPr = para._element.get_or_add_pPr()
            outlineLvl = pPr.find(qn('w:outlineLvl'))
            if outlineLvl is not None:
                level = int(outlineLvl.get(qn('w:val'))) + 1
                return min(max(level, 1), 6)
        
        return 1  # Default heading level
    
    def _is_list_item(self, para: Paragraph) -> bool:
        """Check if paragraph is a list item"""
        # Check for numbering
        if hasattr(para, '_element'):
            pPr = para._element.get_or_add_pPr()
            numPr = pPr.find(qn('w:numPr'))
            if numPr is not None:
                return True
        
        # Check style
        if para.style and para.style.name:
            style_name = para.style.name.lower()
            return 'list' in style_name or 'bullet' in style_name
        
        return False
    
    def _get_list_level(self, para: Paragraph) -> int:
        """Get list indentation level"""
        if hasattr(para, '_element'):
            pPr = para._element.get_or_add_pPr()
            numPr = pPr.find(qn('w:numPr'))
            if numPr is not None:
                ilvl = numPr.find(qn('w:ilvl'))
                if ilvl is not None:
                    return int(ilvl.get(qn('w:val')))
        return 0
    
    def _get_list_style(self, para: Paragraph) -> str:
        """Get list style (bullet, number, etc.)"""
        # This is simplified - real implementation would check numFmt
        return "bullet"  # or "number", "letter", etc.
    
    def _extract_formatting(self, para: Paragraph) -> Dict[str, Any]:
        """Extract paragraph formatting information"""
        formatting = {}
        
        # Check alignment
        if para.alignment:
            formatting["alignment"] = str(para.alignment)
        
        # Check for bold, italic (simplified)
        runs = para.runs
        if runs:
            has_bold = any(run.bold for run in runs if run.bold is not None)
            has_italic = any(run.italic for run in runs if run.italic is not None)
            if has_bold:
                formatting["has_bold"] = True
            if has_italic:
                formatting["has_italic"] = True
        
        return formatting
    
    def _is_header_row(self, row) -> bool:
        """Detect if row is likely a header row"""
        # Simple heuristic: check if cells have bold text
        for cell in row.cells:
            for paragraph in cell.paragraphs:
                for run in paragraph.runs:
                    if run.bold:
                        return True
        return False
    
    def _generate_table_summary(self, headers: List[str], rows: List[List[str]]) -> str:
        """Generate a brief summary of table content"""
        if not rows:
            return "Empty table"
        
        summary_parts = []
        
        # Table size
        summary_parts.append(f"{len(rows)} rows × {len(headers)} columns")
        
        # Column names (if meaningful)
        if headers and not all(h.startswith("Column") for h in headers):
            header_preview = ", ".join(headers[:3])
            if len(headers) > 3:
                header_preview += f" (+{len(headers)-3} more)"
            summary_parts.append(f"Columns: {header_preview}")
        
        return ". ".join(summary_parts)
    
    def _extract_title_from_content(self, doc: DocumentType) -> str:
        """Try to extract title from document content"""
        # Look for first heading or large text
        for para in doc.paragraphs[:10]:  # Check first 10 paragraphs
            if self._is_heading(para) or (para.runs and para.runs[0].font.size and para.runs[0].font.size.pt > 14):
                return para.text.strip()
        return "Untitled Document"
    
    def _estimate_page_count(self, doc: DocumentType) -> int:
        """Estimate page count based on content"""
        # Rough estimation: ~250 words per page
        word_count = 0
        for para in doc.paragraphs:
            word_count += len(para.text.split())
        
        pages = max(1, word_count // 250)
        return pages
    
    def _get_section_path(self, heading_stack: List[Dict], current_level: int) -> str:
        """Get hierarchical section path"""
        path_parts = []
        for heading in heading_stack:
            if heading["level"] < current_level:
                path_parts.append(heading["text"])
        return " > ".join(path_parts) if path_parts else ""
    
    async def _extract_paragraph_images(self, paragraph: Paragraph, page: int, start_chunk_id: int) -> List[Any]:
        """Extract images embedded in paragraphs"""
        image_chunks = []
        
        try:
            # Check for inline images
            for run in paragraph.runs:
                if run._element.find('.//a:blip', namespaces={
                    'a': 'http://schemas.openxmlformats.org/drawingml/2006/main'
                }) is not None:
                    # Extract image
                    for rel_id in run._element.xpath('.//a:blip/@r:embed', namespaces={
                        'a': 'http://schemas.openxmlformats.org/drawingml/2006/main',
                        'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
                    }):
                        try:
                            # Get image part
                            image_part = run.part.related_parts[rel_id]
                            image_bytes = image_part.blob
                            
                            # Process image
                            from PIL import Image
                            import io
                            import base64
                            import hashlib
                            
                            img = Image.open(io.BytesIO(image_bytes))
                            
                            # Generate ID
                            image_hash = hashlib.md5(image_bytes).hexdigest()[:8]
                            image_id = f"docx_img_{start_chunk_id}_{image_hash}"
                            
                            # Optimize image
                            max_dimension = 1920
                            if max(img.width, img.height) > max_dimension:
                                img.thumbnail((max_dimension, max_dimension), Image.Resampling.LANCZOS)
                            
                            # Convert to base64
                            output_buffer = io.BytesIO()
                            output_format = 'PNG' if img.format == 'PNG' else 'JPEG'
                            
                            if output_format == 'JPEG' and img.mode in ('RGBA', 'LA'):
                                rgb_img = Image.new('RGB', img.size, (255, 255, 255))
                                rgb_img.paste(img, mask=img.split()[-1] if img.mode == 'RGBA' else None)
                                img = rgb_img
                            
                            img.save(output_buffer, format=output_format, quality=85, optimize=True)
                            processed_bytes = output_buffer.getvalue()
                            
                            base64_str = base64.b64encode(processed_bytes).decode('utf-8')
                            mime_type = f"image/{output_format.lower()}"
                            base64_with_prefix = f"data:{mime_type};base64,{base64_str}"
                            
                            # Get alt text if available
                            alt_text = None
                            descr = run._element.find('.//wp:docPr', namespaces={
                                'wp': 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing'
                            })
                            if descr is not None:
                                alt_text = descr.get('descr') or descr.get('name')
                            
                            # OCR the image
                            ocr_text = await self._ocr_image(img)
                            
                            image_chunks.append(self.create_chunk(
                                chunk_type="image",
                                content={
                                    'id': image_id,
                                    'base64': base64_with_prefix,
                                    'alt_text': alt_text,
                                    'description': alt_text or f"Image in document",
                                    'format': output_format.lower(),
                                    'dimensions': {
                                        'width': img.width,
                                        'height': img.height
                                    },
                                    'ocr_text': ocr_text
                                },
                                metadata={"page": page}
                            ))
                            
                        except Exception as e:
                            logger.warning(f"Failed to extract inline image: {e}")
                            
        except Exception as e:
            logger.debug(f"No inline images found: {e}")
            
        return image_chunks
    
    async def _ocr_image(self, image) -> Optional[str]:
        """Extract text from image using OCR"""
        try:
            import easyocr
            import numpy as np
            
            # Convert PIL image to numpy array
            img_array = np.array(image)
            
            # Initialize reader
            reader = easyocr.Reader(['en'])
            
            # Run OCR
            results = reader.readtext(img_array)
            
            # Extract text
            text_parts = []
            for bbox, text, confidence in results:
                if confidence > 0.5:
                    text_parts.append(text)
            
            return ' '.join(text_parts) if text_parts else None
            
        except Exception as e:
            logger.debug(f"OCR failed: {e}")
            return None