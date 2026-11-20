#!/bin/bash

echo "Fixing OCR with latest Pillow version"
echo "====================================="

# Activate virtual environment
source venv/bin/activate

# Reinstall latest Pillow
echo "1. Installing latest Pillow..."
pip install Pillow==10.1.0

# Create a monkey patch for EasyOCR
echo -e "\n2. Creating EasyOCR compatibility patch..."
cat > app/utils/ocr_patch.py << 'EOF'
"""
Compatibility patch for EasyOCR with Pillow 10+
"""
import cv2
from PIL import Image

# Monkey patch cv2 interpolation constants if using PIL constants
def patch_easyocr_utils():
    """Apply compatibility patches for EasyOCR"""
    try:
        import easyocr.utils as utils
        
        # Replace the problematic function
        original_compute_ratio_and_resize = utils.compute_ratio_and_resize
        
        def compute_ratio_and_resize(img, width, height, model_height):
            """Patched version using cv2.INTER_LANCZOS4 instead of Image.ANTIALIAS"""
            ratio = width / height
            if ratio < 1.0:
                ratio = 1.0 / ratio
            resize_h = int(model_height * ratio)
            if resize_h > 10000:
                resize_h = 10000
            img = cv2.resize(img, (resize_h, model_height), interpolation=cv2.INTER_LANCZOS4)
            return img, ratio
        
        utils.compute_ratio_and_resize = compute_ratio_and_resize
        print("✓ Applied EasyOCR compatibility patch")
        return True
    except Exception as e:
        print(f"✗ Failed to apply patch: {e}")
        return False

# Apply patch on import
patch_easyocr_utils()
EOF

# Update the image parser to use the patch
echo -e "\n3. Updating image parser imports..."
cat > app/parsers/image_parser_patched.py << 'EOF'
"""
Image Parser - Extracts text from images using OCR with preprocessing
"""

import io
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

from ..models import ParsedDocument, ParseOptions, DocumentMetadata
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
                            chunks.append({
                                'id': f"{filename}_chunk_0",
                                'content': content,
                                'metadata': {
                                    'page': 1,
                                    'type': 'text',
                                    'ocr_confidence': 'high'
                                }
                            })
                            
                            # Update word count
                            metadata.word_count = len(content.split())
                    except Exception as e:
                        logger.error(f"OCR processing failed: {e}")
            
            # Always include the image data for context
            img_buffer = io.BytesIO()
            image.save(img_buffer, format='PNG')
            img_data = img_buffer.getvalue()
            
            chunks.append({
                'id': f"{filename}_image",
                'content': f"[Image: {filename}]",
                'metadata': {
                    'page': 1,
                    'type': 'image',
                    'image_data': f"data:image/png;base64,{self._encode_base64(img_data)}",
                    'width': image.width,
                    'height': image.height
                }
            })
            
            return ParsedDocument(
                content=chunks[0]['content'] if chunks else "",
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
EOF

# Copy the patched version over the original
cp app/parsers/image_parser_patched.py app/parsers/image_parser.py

# Test the fix
echo -e "\n4. Testing OCR with patched version..."
python -c "
# Apply patch
from app.utils.ocr_patch import patch_easyocr_utils
patch_easyocr_utils()

# Now test
import asyncio
from io import BytesIO
from PIL import Image, ImageDraw
import numpy as np
import easyocr

async def test():
    # Create test image
    img = Image.new('RGB', (400, 100), 'white')
    draw = ImageDraw.Draw(img)
    draw.text((50, 30), 'Test OCR Text', fill='black')
    
    # Initialize reader
    reader = easyocr.Reader(['en'], gpu=False)
    
    # Test OCR
    result = reader.readtext(np.array(img))
    
    if result:
        print('✓ OCR test successful!')
        print(f'Detected: {[item[1] for item in result]}')
    else:
        print('✗ No text detected')

asyncio.run(test())
"

echo -e "\n=================================="
echo "OCR fix complete!"
echo "=================================="

# Clean up temporary files
rm -f app/parsers/image_parser_patched.py

echo -e "\nYou can now start the service with:"
echo "  source venv/bin/activate"
echo "  ./start.sh"