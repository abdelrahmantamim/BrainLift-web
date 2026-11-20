"""
PDF Parser - Extract structured content from PDF files with OCR fallback
"""

import io
from typing import Dict, List, Any, Optional
import pdfplumber
import fitz  # PyMuPDF
import cv2
import numpy as np
from PIL import Image
import easyocr

class PDFParser:
    def __init__(self):
        self.ocr_reader = None  # Lazy load OCR
        
    async def parse(self, content: bytes, options: Any) -> Dict[str, Any]:
        """Parse PDF content with text extraction and OCR fallback"""
        chunks = []
        metadata = {}
        chunk_id = 0
        
        # Try pdfplumber first for better table extraction
        try:
            with pdfplumber.open(io.BytesIO(content)) as pdf:
                metadata = self._extract_metadata_pdfplumber(pdf)
                
                for page_num, page in enumerate(pdf.pages):
                    # Extract text
                    text = page.extract_text()
                    
                    if text and len(text.strip()) > 10:
                        # Parse structured text
                        page_chunks = self._parse_page_text(text, page_num + 1, chunk_id)
                        chunks.extend(page_chunks)
                        chunk_id += len(page_chunks)
                    
                    # Extract tables
                    if options.extract_tables:
                        tables = page.extract_tables()
                        for table in tables:
                            if table and self._is_valid_table(table):
                                chunk = self._parse_table(table, chunk_id, page_num + 1)
                                chunks.append(chunk)
                                chunk_id += 1
        except Exception as e:
            print(f"pdfplumber parsing error: {e}")
        
        # If no content extracted and OCR is enabled, use PyMuPDF with OCR
        if len(chunks) == 0 and options.ocr_enabled:
            chunks, metadata = await self._parse_with_ocr(content, options)
        
        return {
            'metadata': metadata,
            'chunks': chunks
        }
    
    def _extract_metadata_pdfplumber(self, pdf) -> Dict[str, Any]:
        """Extract PDF metadata using pdfplumber"""
        meta = pdf.metadata
        return {
            'title': meta.get('Title', 'Untitled'),
            'author': meta.get('Author', 'Unknown'),
            'subject': meta.get('Subject'),
            'creator': meta.get('Creator'),
            'producer': meta.get('Producer'),
            'creation_date': str(meta.get('CreationDate')) if meta.get('CreationDate') else None,
            'pages': len(pdf.pages),
        }
    
    def _parse_page_text(self, text: str, page_num: int, start_chunk_id: int) -> List[Dict]:
        """Parse text from a page into structured chunks"""
        chunks = []
        lines = text.split('\n')
        current_chunk_id = start_chunk_id
        
        current_paragraph = []
        
        for line in lines:
            line = line.strip()
            if not line:
                # End of paragraph
                if current_paragraph:
                    chunks.append({
                        'id': f'chunk_{current_chunk_id}',
                        'type': 'paragraph',
                        'content': ' '.join(current_paragraph),
                        'metadata': {
                            'page': page_num
                        }
                    })
                    current_chunk_id += 1
                    current_paragraph = []
            else:
                # Detect headings (simple heuristic)
                if self._is_heading(line):
                    # Save current paragraph first
                    if current_paragraph:
                        chunks.append({
                            'id': f'chunk_{current_chunk_id}',
                            'type': 'paragraph',
                            'content': ' '.join(current_paragraph),
                            'metadata': {'page': page_num}
                        })
                        current_chunk_id += 1
                        current_paragraph = []
                    
                    # Add heading
                    chunks.append({
                        'id': f'chunk_{current_chunk_id}',
                        'type': 'heading',
                        'level': self._get_heading_level(line),
                        'content': line,
                        'metadata': {'page': page_num}
                    })
                    current_chunk_id += 1
                else:
                    current_paragraph.append(line)
        
        # Don't forget last paragraph
        if current_paragraph:
            chunks.append({
                'id': f'chunk_{current_chunk_id}',
                'type': 'paragraph',
                'content': ' '.join(current_paragraph),
                'metadata': {'page': page_num}
            })
        
        return chunks
    
    def _is_heading(self, text: str) -> bool:
        """Simple heuristic to detect headings"""
        # All caps and short
        if text.isupper() and len(text) < 100:
            return True
        # Numbered headings
        if text.strip()[:3] in ['1. ', '2. ', '3. ', '4. ', '5. ']:
            return True
        # Common heading patterns
        if text.strip().endswith(':') and len(text) < 100:
            return True
        return False
    
    def _get_heading_level(self, text: str) -> int:
        """Estimate heading level"""
        if text.strip()[:2] in ['1.', '2.', '3.']:
            return 1
        elif text.strip()[:4] in ['1.1.', '1.2.', '2.1.']:
            return 2
        elif text.isupper():
            return 1
        return 2
    
    def _parse_table(self, table_data: List[List], chunk_id: int, page_num: int) -> Dict:
        """Parse table data into structured format"""
        headers = []
        rows = []
        
        if len(table_data) > 0:
            # First row as headers
            headers = [str(cell) if cell else '' for cell in table_data[0]]
            # Rest as data
            rows = [[str(cell) if cell else '' for cell in row] for row in table_data[1:]]
        
        return {
            'id': f'chunk_{chunk_id}',
            'type': 'table',
            'content': {
                'headers': headers,
                'rows': rows
            },
            'metadata': {
                'page': page_num,
                'rows_count': len(table_data),
                'cols_count': len(table_data[0]) if table_data else 0
            }
        }
    
    def _is_valid_table(self, table: List[List]) -> bool:
        """Check if extracted table is valid"""
        if not table or len(table) < 2:
            return False
        # Check if all rows have same number of columns
        col_count = len(table[0])
        return all(len(row) == col_count for row in table)
    
    async def _parse_with_ocr(self, content: bytes, options: Any) -> tuple[List[Dict], Dict]:
        """Parse PDF using OCR for scanned documents"""
        if not self.ocr_reader:
            self.ocr_reader = easyocr.Reader(['en', 'ar'])  # Add more languages as needed
        
        chunks = []
        chunk_id = 0
        
        # Open with PyMuPDF
        pdf = fitz.open(stream=content, filetype="pdf")
        metadata = {
            'title': pdf.metadata.get('title', 'Untitled'),
            'author': pdf.metadata.get('author', 'Unknown'),
            'pages': pdf.page_count,
            'is_scanned': True
        }
        
        for page_num in range(pdf.page_count):
            page = pdf[page_num]
            
            # Convert page to image
            mat = fitz.Matrix(2, 2)  # 2x zoom for better OCR
            pix = page.get_pixmap(matrix=mat)
            img_data = pix.tobytes("png")
            
            # Convert to numpy array for OCR
            nparr = np.frombuffer(img_data, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            
            # Preprocess image
            img = self._preprocess_image(img)
            
            # Perform OCR
            result = self.ocr_reader.readtext(img)
            
            # Group text by regions
            page_text = []
            for (bbox, text, prob) in result:
                if prob > 0.5:  # Confidence threshold
                    page_text.append(text)
            
            if page_text:
                # Join and parse as regular text
                full_text = '\n'.join(page_text)
                page_chunks = self._parse_page_text(full_text, page_num + 1, chunk_id)
                chunks.extend(page_chunks)
                chunk_id += len(page_chunks)
        
        pdf.close()
        return chunks, metadata
    
    def _preprocess_image(self, img: np.ndarray) -> np.ndarray:
        """Preprocess image for better OCR results"""
        # Convert to grayscale
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        
        # Apply thresholding to get binary image
        _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        
        # Denoise
        denoised = cv2.fastNlMeansDenoising(thresh)
        
        # Deskew if needed (simplified)
        coords = np.column_stack(np.where(denoised > 0))
        if len(coords) > 0:
            angle = cv2.minAreaRect(coords)[-1]
            if angle < -45:
                angle = 90 + angle
            if abs(angle) > 0.5:
                (h, w) = denoised.shape[:2]
                center = (w // 2, h // 2)
                M = cv2.getRotationMatrix2D(center, angle, 1.0)
                denoised = cv2.warpAffine(denoised, M, (w, h), 
                                         flags=cv2.INTER_CUBIC,
                                         borderMode=cv2.BORDER_REPLICATE)
        
        return denoised