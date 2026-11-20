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
