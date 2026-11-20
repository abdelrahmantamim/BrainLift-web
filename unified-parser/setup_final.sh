#!/bin/bash

echo "Setting up Unified Parser with Python 3.11"
echo "=========================================="

# Check if Python 3.11 is available
if ! command -v python3.11 &> /dev/null; then
    echo "Python 3.11 not found. Installing with Homebrew..."
    brew install python@3.11
fi

# Remove old venv
if [ -d "venv" ]; then
    echo "Removing old virtual environment..."
    rm -rf venv
fi

# Create new venv with Python 3.11
echo "Creating virtual environment with Python 3.11..."
python3.11 -m venv venv
source venv/bin/activate

# Verify Python version
echo "Python version:"
python --version

# Upgrade pip
echo -e "\nUpgrading pip..."
pip install --upgrade pip setuptools wheel

# Install dependencies in correct order
echo -e "\n1. Installing core dependencies..."
pip install fastapi==0.104.1
pip install uvicorn[standard]==0.24.0
pip install python-multipart==0.0.6
pip install pydantic==2.5.0
pip install pydantic-settings==2.0.3

# Install document parsing
echo -e "\n2. Installing document parsing libraries..."
pip install python-docx==1.1.0
pip install python-pptx==0.6.23
pip install pdfplumber==0.10.3
pip install PyPDF2==3.0.1
pip install openpyxl==3.1.2

# Install utilities
echo -e "\n3. Installing utilities..."
pip install httpx==0.25.2
pip install aiofiles==23.2.1
pip install structlog==23.2.0
pip install python-dotenv==1.0.0
pip install chardet==5.2.0
pip install beautifulsoup4==4.12.2
pip install lxml==4.9.3

# Install image processing
echo -e "\n4. Installing image processing..."
pip install Pillow==10.1.0
pip install numpy==1.26.4
pip install opencv-python-headless==4.8.1.78

# Install OCR
echo -e "\n5. Installing OCR..."
pip install easyocr==1.7.0

# Install Supabase
echo -e "\n6. Installing Supabase..."
pip install supabase==2.0.3

# Install Redis
echo -e "\n7. Installing Redis client..."
pip install redis==5.0.1

# Test imports
echo -e "\n8. Testing imports..."
python -c "
print('Testing imports...')
try:
    import fastapi
    print('✓ FastAPI imported')
    import pydantic
    print(f'✓ Pydantic {pydantic.__version__} imported')
    import numpy
    print(f'✓ NumPy {numpy.__version__} imported')
    import cv2
    print('✓ OpenCV imported')
    import easyocr
    print('✓ EasyOCR imported')
    import supabase
    print('✓ Supabase imported')
    print('\\n✅ All core imports successful!')
except Exception as e:
    print(f'✗ Import error: {e}')
"

# Create a simple test to ensure OCR patch works
echo -e "\n9. Applying OCR patch and testing..."
python -c "
# Apply OCR patch
from app.utils.ocr_patch import patch_easyocr_utils
patch_easyocr_utils()

# Test app import
from app.main import app
print('✓ App imported successfully with OCR patch')
"

# Start the service
echo -e "\n10. Starting the service..."
uvicorn app.main:app --host 0.0.0.0 --port 8002 --reload &
SERVER_PID=$!

echo -e "\n11. Waiting for service to start..."
sleep 5

echo -e "\n12. Testing the service..."
echo "Health check:"
curl -s http://localhost:8002/health | python -m json.tool

echo -e "\nRoot endpoint:"
curl -s http://localhost:8002/ | python -m json.tool

echo -e "\n13. Service is running successfully!"
echo "PID: $SERVER_PID"
echo "API docs: http://localhost:8002/docs"

# Keep running for a few seconds
sleep 5

echo -e "\n14. Stopping the service..."
kill $SERVER_PID 2>/dev/null || true

echo -e "\n✅ Setup and test complete!"
echo ""
echo "To run the service:"
echo "  source venv/bin/activate"
echo "  uvicorn app.main:app --host 0.0.0.0 --port 8002 --reload"