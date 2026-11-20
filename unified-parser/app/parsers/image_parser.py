"""
Image Parser - Extracts text from images using OCR with preprocessing
"""

import io
import json
import base64
from typing import Dict, Any, List, Optional, Tuple
import structlog
from PIL import Image
import numpy as np

# Apply EasyOCR patch before importing
try:
    from ..utils.ocr_patch import patch_easyocr_utils
    patch_easyocr_utils()
except ImportError:
    pass

from ..models import ParsedDocument, ParseOptions, DocumentMetadata, Chunk, ChunkMetadata
from .base import BaseParser

logger = structlog.get_logger()


class ImageParser(BaseParser):
    """Parser for image files with OCR"""
    
    def __init__(self):
        super().__init__()
        self.ocr_available = self._check_ocr_availability()
        self.reader = None
    
    def _check_ocr_availability(self) -> bool:
        """Check if OCR libraries are available"""
        try:
            import easyocr
            import cv2
            return True
        except ImportError:
            logger.warning("OCR libraries not available")
            return False
    
    def _initialize_reader(self, languages: List[str] = None):
        """Initialize OCR reader lazily"""
        if self.reader is None and self.ocr_available:
            try:
                import easyocr
                languages = languages or ['en']
                self.reader = easyocr.Reader(languages, gpu=False)
                logger.info(f"Initialized OCR reader with languages: {languages}")
            except Exception as e:
                logger.error(f"Failed to initialize OCR reader: {e}")
                self.ocr_available = False
    
    async def parse(
        self, 
        file: Any, 
        filename: str,
        options: Optional[ParseOptions] = None
    ) -> ParsedDocument:
        """Parse image file and extract text using OCR"""
        options = options or ParseOptions()
        
        try:
            # Load image
            if hasattr(file, 'read'):
                file_content = file.read()
                if hasattr(file, 'seek'):
                    file.seek(0)
            else:
                file_content = file
            
            image = Image.open(io.BytesIO(file_content))
            
            # Convert to RGB if necessary
            if image.mode != 'RGB':
                image = image.convert('RGB')
            
            # Get image metadata
            metadata = DocumentMetadata(
                title=filename,
                author="",
                created_date=None,
                modified_date=None,
                page_count=1,
                word_count=0,
                language=options.language or "en"
            )
            
            chunks = []
            content = ""  # Initialize content variable
            
            # Perform OCR if available
            if self.ocr_available and options.enable_ocr:
                self._initialize_reader([options.language or 'en'])
                
                if self.reader:
                    # Convert to numpy array for OCR
                    img_array = np.array(image)
                    
                    # Preprocess image
                    processed_img = await self._preprocess_image(img_array)
                    
                    # Perform OCR
                    try:
                        results = self.reader.readtext(processed_img)
                        
                        # Extract text from results
                        text_blocks = []
                        for bbox, text, confidence in results:
                            if confidence > 0.5:  # Confidence threshold
                                text_blocks.append(text)
                        
                        if text_blocks:
                            content = '\n'.join(text_blocks)
                            chunks.append(Chunk(
                                id=f"{filename}_chunk_0",
                                type="text",
                                content=content,
                                metadata=ChunkMetadata(
                                    page=1,
                                    confidence=0.9
                                )
                            ))
                            
                            # Update word count
                            metadata.word_count = len(content.split())
                    except Exception as e:
                        logger.error(f"OCR processing failed: {e}")
            
            # Always include the image data for chat context
            img_buffer = io.BytesIO()
            image.save(img_buffer, format='JPEG', quality=85)
            img_data = img_buffer.getvalue()
            base64_data = base64.b64encode(img_data).decode('utf-8')
            
            # Get image dimensions
            width, height = image.size
            
            # Create image chunk in the format expected by chat
            image_content = {
                "type": "image",
                "fileName": filename,
                "mimeType": "image/jpeg",
                "base64": base64_data,
                "hasOCR": bool(content),
                "ocrData": {
                    "text": content,
                    "language": metadata.language,
                    "confidence": 90
                } if content else None,
                "dimensions": {
                    "width": width,
                    "height": height
                },
                "optimized": True
            }
            
            chunks.append(Chunk(
                id=f"{filename}_image",
                type="text",  # Use text type so it gets processed
                content=json.dumps(image_content),
                metadata=ChunkMetadata(
                    page=1,
                    type="image",
                    has_image=True,
                    image_id=filename,
                    image_format="jpeg"
                )
            ))
            
            return ParsedDocument(
                content=chunks[0].content if chunks else "",
                chunks=chunks,
                metadata=metadata,
                images=[{
                    'name': filename,
                    'data': f"data:image/png;base64,{self._encode_base64(img_data)}"
                }]
            )
            
        except Exception as e:
            logger.error(f"Error parsing image {filename}: {str(e)}")
            raise
    
    async def _preprocess_image(self, image: np.ndarray) -> np.ndarray:
        """Preprocess image for better OCR results"""
        try:
            import cv2
            
            # Convert to grayscale
            gray = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY)
            
            # Apply threshold to get binary image
            _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
            
            # Denoise
            denoised = cv2.fastNlMeansDenoising(binary)
            
            return denoised
        except Exception as e:
            logger.warning(f"Image preprocessing failed: {e}")
            return image
    
    def _encode_base64(self, data: bytes) -> str:
        """Encode bytes to base64 string"""
        import base64
        return base64.b64encode(data).decode('utf-8')
