#!/bin/bash

echo "Fixing dependency conflicts and ensuring OCR functionality"
echo "========================================================="

# Activate virtual environment
source venv/bin/activate

# Fix httpx version conflict
echo "1. Fixing httpx version conflict..."
pip install httpx==0.24.1  # Compatible with supabase 2.0.3

# Install python-magic properly for macOS
echo -e "\n2. Installing python-magic for macOS..."
# First try to install libmagic via homebrew
if command -v brew &> /dev/null; then
    echo "Installing libmagic via Homebrew..."
    brew install libmagic
fi
# Then install python-magic
pip install python-magic==0.4.27

# Verify and install EasyOCR with all dependencies
echo -e "\n3. Ensuring EasyOCR is properly installed..."
pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu  # CPU version for compatibility
pip install easyocr==1.7.0

# Test OCR functionality
echo -e "\n4. Testing OCR functionality..."
python -c "
import easyocr
print('✓ EasyOCR import successful')
reader = easyocr.Reader(['en'], gpu=False)
print('✓ EasyOCR reader initialized successfully')
" || echo "✗ EasyOCR initialization failed"

# Verify all critical imports work together
echo -e "\n5. Testing all imports together..."
python -c "
import sys
print(f'Python: {sys.version.split()[0]}')

# Core imports
import fastapi
import uvicorn
print('✓ Web framework imports OK')

# Document parsing
import docx
import pptx
import pdfplumber
import PyPDF2
print('✓ Document parsing imports OK')

# Image and OCR
import numpy
import cv2
import PIL
import easyocr
print('✓ Image/OCR imports OK')

# Database and utilities
import supabase
import httpx
print(f'✓ httpx version: {httpx.__version__}')
print('✓ Database imports OK')

# NLP
import nltk
import langdetect
print('✓ NLP imports OK')

print('\\n✅ All imports successful!')
"

# Create a test script for OCR
echo -e "\n6. Creating OCR test script..."
cat > test_ocr.py << 'EOF'
"""Test OCR functionality"""
import asyncio
from io import BytesIO
from PIL import Image, ImageDraw, ImageFont
import numpy as np
import easyocr

async def test_ocr():
    print("Testing OCR functionality...")
    
    # Create a test image with text
    img = Image.new('RGB', (400, 100), color='white')
    draw = ImageDraw.Draw(img)
    
    # Use default font
    draw.text((50, 30), "Test OCR Text", fill='black')
    
    # Convert to numpy array
    img_array = np.array(img)
    
    # Initialize EasyOCR
    print("Initializing EasyOCR reader...")
    reader = easyocr.Reader(['en'], gpu=False)
    
    # Perform OCR
    print("Performing OCR...")
    result = reader.readtext(img_array)
    
    if result:
        print("✓ OCR successful!")
        print(f"Detected text: {[item[1] for item in result]}")
    else:
        print("✗ OCR failed - no text detected")
    
    return result

if __name__ == "__main__":
    asyncio.run(test_ocr())
EOF

echo -e "\n7. Running OCR test..."
python test_ocr.py

echo -e "\n=================================="
echo "Setup verification complete!"
echo "=================================="

# Show final package versions
echo -e "\nInstalled package versions:"
pip list | grep -E "(numpy|opencv|easyocr|torch|supabase|httpx|fastapi)"

echo -e "\nIf all tests passed, you can now run:"
echo "  source venv/bin/activate"
echo "  ./start.sh"