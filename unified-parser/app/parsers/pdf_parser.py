"""
PDF Parser - Extracts text, tables, and images with OCR fallback for scanned documents
"""

import io
from typing import Dict, Any, List, Optional, Optional, Tuple
import structlog
import pdfplumber
import PyPDF2
from PIL import Image
import numpy as np

from ..models import ParsedDocument, ParseOptions, DocumentMetadata
from .base import BaseParser

logger = structlog.get_logger()


class PDFParser(BaseParser):
    """Parser for PDF documents with OCR capabilities"""
    
    def __init__(self):
        super().__init__()
        self.ocr_available = self._check_ocr_availability()
    
    def _check_ocr_availability(self) -> bool:
        """Check if OCR libraries are available"""
        try:
            import easyocr
            return True
        except ImportError:
            logger.warning("OCR not available - install easyocr for scanned PDF support")
            return False
    
    async def parse(self, file: Any, filename: str, options: Optional[ParseOptions] = None) -> ParsedDocument:
        """Parse PDF content"""
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
            # Try text extraction first
            doc = await self._parse_with_pdfplumber(content, options)
            
            # Check if OCR is needed (very little text extracted)
            total_text = self.extract_text_from_chunks(doc.chunks)
            if options.enable_ocr and self.ocr_available and len(total_text) < 100:
                logger.info("pdf_appears_scanned", attempting_ocr=True)
                doc = await self._parse_with_ocr(content, options)
            
            # Clear chunks - let JS handle chunking
            doc.chunks = []
            doc.content = total_text  # Ensure content is set
            
            return doc
            
        except Exception as e:
            logger.error("pdf_parsing_failed", error=str(e))
            raise
    
    async def _parse_with_pdfplumber(self, content: bytes, options: ParseOptions) -> ParsedDocument:
        """Parse PDF using pdfplumber for text and table extraction"""
        doc = ParsedDocument()
        
        with pdfplumber.open(io.BytesIO(content)) as pdf:
            # Extract metadata
            metadata = pdf.metadata or {}
            doc.metadata = DocumentMetadata(
                title=self._clean_metadata_value(metadata.get('/Title', 'Untitled PDF')),
                author=self._clean_metadata_value(metadata.get('/Author')),
                created_date=self._parse_pdf_date(metadata.get('/CreationDate')),
                modified_date=self._parse_pdf_date(metadata.get('/ModDate')),
                pages=len(pdf.pages)
            )
            
            # Process pages
            current_heading_id = None
            chunk_id = 0
            
            for page_num, page in enumerate(pdf.pages, 1):
                # Extract text with structure
                page_chunks = await self._extract_page_content(
                    page, page_num, options, chunk_id
                )
                
                # Update chunk IDs and track headings
                for chunk in page_chunks:
                    if chunk.type == "heading":
                        current_heading_id = chunk.id
                    elif current_heading_id and chunk.type in ["paragraph", "text"]:
                        chunk.parent_id = current_heading_id
                    
                    doc.chunks.append(chunk)
                    chunk_id += 1
                
                # Extract tables if requested
                if options.extract_tables:
                    try:
                        tables = page.extract_tables()
                        if tables:
                            table_chunks = await self._extract_tables(
                                tables, page_num, chunk_id, current_heading_id
                            )
                            doc.chunks.extend(table_chunks)
                            doc.metadata.has_tables = True
                            chunk_id += len(table_chunks)
                    except Exception as e:
                        logger.debug(f"Table extraction failed for page {page_num}: {e}")
                
                # Extract images from page
                if options.extract_tables:  # Using same flag for images
                    image_chunks = await self._extract_page_images(
                        page, page_num, chunk_id
                    )
                    if image_chunks:
                        doc.chunks.extend(image_chunks)
                        doc.metadata.has_images = True
                        chunk_id += len(image_chunks)
            
            # Calculate word count
            all_text = self.extract_text_from_chunks(doc.chunks)
            doc.metadata.word_count = self.count_words(all_text)
            
        return doc
    
    async def _extract_page_content(
        self, 
        page, 
        page_num: int, 
        options: ParseOptions,
        start_chunk_id: int
    ) -> List[Any]:
        """Extract structured content from a PDF page"""
        chunks = []
        
        # Extract text with positional information
        chars = page.chars
        if not chars:
            # No text found, might be scanned
            return chunks
        
        # Group characters into lines and detect structure
        lines = self._group_chars_into_lines(chars)
        
        # Analyze lines for structure (headings, paragraphs, etc.)
        current_paragraph = []
        current_font_size = None
        avg_font_size = self._calculate_avg_font_size(chars)
        
        for line in lines:
            line_text = line['text'].strip()
            if not line_text:
                continue
            
            line_font_size = line['font_size']
            is_heading = self._is_likely_heading(line, avg_font_size)
            
            # Check if we should start a new chunk
            if is_heading:
                # Save current paragraph if any
                if current_paragraph:
                    para_text = ' '.join(current_paragraph)
                    chunks.append(self.create_chunk(
                        chunk_type="paragraph",
                        content=para_text,
                        metadata={"page": page_num}
                    ))
                    current_paragraph = []
                
                # Add heading
                level = self._estimate_heading_level(line_font_size, avg_font_size)
                chunks.append(self.create_chunk(
                    chunk_type="heading",
                    content=line_text,
                    level=level,
                    metadata={
                        "page": page_num,
                        "font_size": line_font_size
                    }
                ))
            else:
                # Check if this starts a new paragraph
                if current_font_size and abs(line_font_size - current_font_size) > 1:
                    # Font size change, might be new paragraph
                    if current_paragraph:
                        para_text = ' '.join(current_paragraph)
                        chunks.append(self.create_chunk(
                            chunk_type="paragraph",
                            content=para_text,
                            metadata={"page": page_num}
                        ))
                        current_paragraph = []
                
                current_paragraph.append(line_text)
                current_font_size = line_font_size
        
        # Don't forget last paragraph
        if current_paragraph:
            para_text = ' '.join(current_paragraph)
            chunks.append(self.create_chunk(
                chunk_type="paragraph",
                content=para_text,
                metadata={"page": page_num}
            ))
        
        return chunks
    
    async def _extract_tables(
        self, 
        tables: List, 
        page_num: int, 
        start_chunk_id: int,
        parent_heading_id: Optional[str]
    ) -> List[Any]:
        """Extract tables from PDF page"""
        table_chunks = []
        
        for table_idx, table in enumerate(tables):
            # Extract table data
            rows = table.extract()
            if not rows:
                continue
            
            # Clean and process table
            cleaned_table = self._clean_table_data(rows)
            if not cleaned_table['rows']:
                continue
            
            # Generate table summary
            summary = self._generate_table_summary(
                cleaned_table['headers'], 
                cleaned_table['rows']
            )
            
            table_chunks.append(self.create_chunk(
                chunk_type="table",
                content={
                    "headers": cleaned_table['headers'],
                    "rows": cleaned_table['rows'],
                    "summary": summary
                },
                parent_id=parent_heading_id,
                metadata={
                    "page": page_num,
                    "table_index": table_idx,
                    "row_count": len(cleaned_table['rows']),
                    "column_count": len(cleaned_table['headers'])
                }
            ))
        
        return table_chunks
    
    async def _parse_with_ocr(self, content: bytes, options: ParseOptions) -> ParsedDocument:
        """Parse scanned PDF using OCR"""
        import easyocr
        import fitz  # PyMuPDF for image extraction
        
        doc = ParsedDocument()
        reader = easyocr.Reader(['en'])  # Initialize with English
        
        # Open PDF with PyMuPDF
        pdf_document = fitz.open(stream=content, filetype="pdf")
        
        # Set metadata
        doc.metadata = DocumentMetadata(
            title="Scanned Document",
            pages=len(pdf_document),
            has_images=True
        )
        
        chunk_id = 0
        
        # Process each page
        for page_num in range(len(pdf_document)):
            page = pdf_document[page_num]
            
            # Convert page to image
            mat = fitz.Matrix(2, 2)  # 2x zoom for better OCR
            pix = page.get_pixmap(matrix=mat)
            img_data = pix.tobytes("png")
            
            # Convert to numpy array for EasyOCR
            image = Image.open(io.BytesIO(img_data))
            img_array = np.array(image)
            
            # Preprocess image if needed
            if options.enable_ocr:
                img_array = await self._preprocess_image_for_ocr(img_array)
            
            # Run OCR
            results = reader.readtext(img_array)
            
            # Group OCR results into paragraphs
            page_chunks = self._group_ocr_results(results, page_num + 1)
            
            for chunk in page_chunks:
                doc.chunks.append(chunk)
                chunk_id += 1
        
        # Calculate word count
        all_text = self.extract_text_from_chunks(doc.chunks)
        doc.metadata.word_count = self.count_words(all_text)
        
        pdf_document.close()
        return doc
    
    async def _preprocess_image_for_ocr(self, image: np.ndarray) -> np.ndarray:
        """Preprocess image to improve OCR accuracy"""
        import cv2
        
        # Convert to grayscale if needed
        if len(image.shape) == 3:
            gray = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY)
        else:
            gray = image
        
        # Denoise
        denoised = cv2.fastNlMeansDenoising(gray)
        
        # Apply threshold to get binary image
        _, binary = cv2.threshold(denoised, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        
        # Deskew if needed (simplified - full implementation would detect skew angle)
        # This is a placeholder for deskewing logic
        
        return binary
    
    def _group_chars_into_lines(self, chars: List[Dict]) -> List[Dict]:
        """Group characters into lines based on position"""
        if not chars:
            return []
        
        # Sort by vertical position (top)
        sorted_chars = sorted(chars, key=lambda x: (x['top'], x['x0']))
        
        lines = []
        current_line = []
        current_top = None
        line_tolerance = 2  # pixels
        
        for char in sorted_chars:
            if current_top is None or abs(char['top'] - current_top) <= line_tolerance:
                current_line.append(char)
                if current_top is None:
                    current_top = char['top']
            else:
                # New line
                if current_line:
                    lines.append(self._create_line_from_chars(current_line))
                current_line = [char]
                current_top = char['top']
        
        # Don't forget last line
        if current_line:
            lines.append(self._create_line_from_chars(current_line))
        
        return lines
    
    def _create_line_from_chars(self, chars: List[Dict]) -> Dict:
        """Create a line object from characters"""
        text = ''.join(char.get('text', '') for char in chars)
        font_sizes = [char.get('size', 0) for char in chars if char.get('size')]
        avg_font_size = sum(font_sizes) / len(font_sizes) if font_sizes else 12
        
        return {
            'text': text,
            'font_size': avg_font_size,
            'top': chars[0]['top'],
            'bottom': chars[0].get('bottom', chars[0]['top'] + avg_font_size),
            'is_bold': any(char.get('fontname', '').lower().endswith('bold') for char in chars)
        }
    
    def _calculate_avg_font_size(self, chars: List[Dict]) -> float:
        """Calculate average font size across all characters"""
        font_sizes = [char.get('size', 0) for char in chars if char.get('size')]
        return sum(font_sizes) / len(font_sizes) if font_sizes else 12
    
    def _is_likely_heading(self, line: Dict, avg_font_size: float) -> bool:
        """Determine if a line is likely a heading"""
        # Check font size
        if line['font_size'] > avg_font_size * 1.2:
            return True
        
        # Check if bold
        if line.get('is_bold'):
            return True
        
        # Check text patterns (simplified)
        text = line['text'].strip()
        if text and len(text) < 100 and text[0].isupper():
            # Short line starting with capital
            if text.endswith(':') or text.isupper():
                return True
        
        return False
    
    def _estimate_heading_level(self, font_size: float, avg_font_size: float) -> int:
        """Estimate heading level based on font size"""
        ratio = font_size / avg_font_size
        
        if ratio >= 2.0:
            return 1
        elif ratio >= 1.5:
            return 2
        elif ratio >= 1.3:
            return 3
        else:
            return 4
    
    def _clean_table_data(self, rows: List[List]) -> Dict[str, List]:
        """Clean and structure table data"""
        if not rows:
            return {'headers': [], 'rows': []}
        
        # Clean all cells
        cleaned_rows = []
        for row in rows:
            cleaned_row = [
                self.clean_text(str(cell)) if cell is not None else ""
                for cell in row
            ]
            # Skip empty rows
            if any(cell for cell in cleaned_row):
                cleaned_rows.append(cleaned_row)
        
        if not cleaned_rows:
            return {'headers': [], 'rows': []}
        
        # First row as headers
        headers = cleaned_rows[0]
        data_rows = cleaned_rows[1:] if len(cleaned_rows) > 1 else []
        
        return {
            'headers': headers,
            'rows': data_rows
        }
    
    def _group_ocr_results(self, results: List, page_num: int) -> List[Any]:
        """Group OCR results into meaningful chunks"""
        chunks = []
        
        if not results:
            return chunks
        
        # Sort by vertical position
        sorted_results = sorted(results, key=lambda x: x[0][0][1])  # y-coordinate
        
        # Group into paragraphs based on proximity
        current_paragraph = []
        last_bottom = None
        line_gap_threshold = 30  # pixels
        
        for bbox, text, confidence in sorted_results:
            top_y = bbox[0][1]
            bottom_y = bbox[2][1]
            
            # Check if this should start a new paragraph
            if last_bottom is not None and (top_y - last_bottom) > line_gap_threshold:
                if current_paragraph:
                    para_text = ' '.join(current_paragraph)
                    chunks.append(self.create_chunk(
                        chunk_type="paragraph",
                        content=para_text,
                        metadata={
                            "page": page_num,
                            "source": "ocr",
                            "avg_confidence": 0.9  # Simplified
                        }
                    ))
                    current_paragraph = []
            
            current_paragraph.append(text)
            last_bottom = bottom_y
        
        # Don't forget last paragraph
        if current_paragraph:
            para_text = ' '.join(current_paragraph)
            chunks.append(self.create_chunk(
                chunk_type="paragraph",
                content=para_text,
                metadata={
                    "page": page_num,
                    "source": "ocr",
                    "avg_confidence": 0.9
                }
            ))
        
        return chunks
    
    def _clean_metadata_value(self, value: Any) -> Optional[str]:
        """Clean PDF metadata values"""
        if not value:
            return None
        
        # Handle bytes
        if isinstance(value, bytes):
            try:
                value = value.decode('utf-8')
            except:
                value = value.decode('latin-1', errors='ignore')
        
        # Convert to string and clean
        value = str(value).strip()
        
        # Remove PDF specific prefixes
        if value.startswith('D:'):
            value = value[2:]
        
        return value if value else None
    
    def _parse_pdf_date(self, date_str: Any) -> Optional[str]:
        """Parse PDF date format (D:YYYYMMDDHHmmSS)"""
        if not date_str:
            return None
        
        date_str = self._clean_metadata_value(date_str)
        if not date_str:
            return None
        
        # Simple parsing - full implementation would handle timezone
        try:
            if date_str.startswith('D:'):
                date_str = date_str[2:]
            
            # Extract components
            year = date_str[0:4]
            month = date_str[4:6] if len(date_str) > 4 else '01'
            day = date_str[6:8] if len(date_str) > 6 else '01'
            
            return f"{year}-{month}-{day}"
        except:
            return None
    
    def _generate_table_summary(self, headers: List[str], rows: List[List[str]]) -> str:
        """Generate summary of table content"""
        if not rows:
            return "Empty table"
        
        summary_parts = []
        
        # Table dimensions
        summary_parts.append(f"{len(rows)} rows × {len(headers)} columns")
        
        # Header preview
        if headers and any(h for h in headers):
            header_preview = ", ".join(h for h in headers[:3] if h)
            if len(headers) > 3:
                header_preview += f" (+{len(headers)-3} more)"
            summary_parts.append(f"Headers: {header_preview}")
        
        return ". ".join(summary_parts)
    
    async def _extract_page_images(self, page, page_num: int, start_chunk_id: int) -> List[Any]:
        """Extract images from PDF page"""
        image_chunks = []
        
        try:
            # Get page as image for visual elements
            import fitz  # PyMuPDF
            
            # Convert pdfplumber page number to PyMuPDF
            pdf_document = fitz.open(stream=page.pdf.stream.read(), filetype="pdf")
            fitz_page = pdf_document[page_num - 1]
            
            # Extract images
            image_list = fitz_page.get_images(full=True)
            
            for img_idx, img in enumerate(image_list):
                try:
                    # Get image data
                    xref = img[0]
                    base_image = pdf_document.extract_image(xref)
                    image_bytes = base_image["image"]
                    
                    # Process image
                    from PIL import Image
                    import io
                    import base64
                    import hashlib
                    
                    pil_image = Image.open(io.BytesIO(image_bytes))
                    
                    # Generate ID
                    image_hash = hashlib.md5(image_bytes).hexdigest()[:8]
                    image_id = f"pdf_img_{page_num}_{img_idx}_{image_hash}"
                    
                    # Optimize image
                    max_dimension = 1920
                    if max(pil_image.width, pil_image.height) > max_dimension:
                        pil_image.thumbnail((max_dimension, max_dimension), Image.Resampling.LANCZOS)
                    
                    # Convert to base64
                    output_buffer = io.BytesIO()
                    output_format = 'JPEG' if base_image["ext"] != 'png' else 'PNG'
                    
                    if output_format == 'JPEG' and pil_image.mode in ('RGBA', 'LA'):
                        rgb_img = Image.new('RGB', pil_image.size, (255, 255, 255))
                        rgb_img.paste(pil_image, mask=pil_image.split()[-1] if pil_image.mode == 'RGBA' else None)
                        pil_image = rgb_img
                    
                    pil_image.save(output_buffer, format=output_format, quality=85, optimize=True)
                    processed_bytes = output_buffer.getvalue()
                    
                    base64_str = base64.b64encode(processed_bytes).decode('utf-8')
                    mime_type = f"image/{output_format.lower()}"
                    base64_with_prefix = f"data:{mime_type};base64,{base64_str}"
                    
                    # Try OCR on image
                    ocr_text = await self._ocr_image(pil_image)
                    
                    image_chunks.append(self.create_chunk(
                        chunk_type="image",
                        content={
                            'id': image_id,
                            'base64': base64_with_prefix,
                            'description': f"Image on page {page_num}",
                            'format': output_format.lower(),
                            'dimensions': {
                                'width': pil_image.width,
                                'height': pil_image.height
                            },
                            'ocr_text': ocr_text
                        },
                        metadata={
                            "page": page_num,
                            "image_index": img_idx
                        }
                    ))
                    
                except Exception as e:
                    logger.warning(f"Failed to extract image {img_idx} from page {page_num}: {e}")
            
            pdf_document.close()
            
        except Exception as e:
            logger.debug(f"Image extraction not available for page {page_num}: {e}")
        
        return image_chunks
    
    async def _ocr_image(self, image) -> Optional[str]:
        """Extract text from image using OCR"""
        try:
            import easyocr
            import numpy as np
            
            # Convert PIL image to numpy array
            img_array = np.array(image)
            
            # Initialize reader (should be cached in production)
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