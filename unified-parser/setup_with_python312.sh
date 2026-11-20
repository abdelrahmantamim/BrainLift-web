#!/bin/bash

echo "Setting up Unified Parser with Python 3.12"
echo "=========================================="

# Check if Python 3.12 is installed
if command -v python3.12 &> /dev/null; then
    echo "✓ Python 3.12 found"
else
    echo "Python 3.12 not found. Installing with Homebrew..."
    brew install python@3.12
fi

# Remove existing venv if it exists
if [ -d "venv" ]; then
    echo "Removing existing virtual environment..."
    rm -rf venv
fi

# Create new virtual environment with Python 3.12
echo "Creating virtual environment with Python 3.12..."
python3.12 -m venv venv

# Activate virtual environment
echo "Activating virtual environment..."
source venv/bin/activate

# Upgrade pip
echo "Upgrading pip..."
pip install --upgrade pip setuptools wheel

# Install dependencies in order
echo -e "\n1. Installing core dependencies..."
pip install fastapi==0.104.1
pip install uvicorn[standard]==0.24.0
pip install python-multipart==0.0.6
pip install pydantic==2.5.0
pip install pydantic-settings==2.0.3

echo -e "\n2. Installing NumPy first (to avoid version conflicts)..."
pip install numpy==1.24.3

echo -e "\n3. Installing document parsing libraries..."
pip install python-docx==1.1.0
pip install python-pptx==0.6.23
pip install pdfplumber==0.10.3
pip install openpyxl==3.1.2
pip install PyPDF2==3.0.1

echo -e "\n4. Installing image processing libraries..."
pip install Pillow==10.1.0
pip install opencv-python-headless==4.8.1.78

echo -e "\n5. Installing OCR libraries..."
pip install easyocr==1.7.0

echo -e "\n6. Installing NLP libraries..."
pip install spacy==3.7.2
pip install langdetect==1.0.9
pip install tiktoken==0.5.1
pip install nltk==3.8.1

echo -e "\n7. Downloading spaCy model..."
python -m spacy download en_core_web_sm

echo -e "\n8. Installing database and utilities..."
pip install supabase==2.0.3
pip install redis==5.0.1
pip install python-magic==0.4.27
pip install chardet==5.2.0
pip install beautifulsoup4==4.12.2
pip install lxml==4.9.3
pip install httpx==0.25.2
pip install aiofiles==23.2.1
pip install structlog==23.2.0

echo -e "\n9. Installing testing dependencies..."
pip install pytest==7.4.3
pip install pytest-asyncio==0.21.1
pip install pytest-cov==4.1.0

echo -e "\n=================================="
echo "Verifying installation..."
echo "=================================="

python -c "import fastapi; print('✓ FastAPI installed')"
python -c "import uvicorn; print('✓ Uvicorn installed')"
python -c "import numpy; print(f'✓ NumPy {numpy.__version__} installed')"
python -c "import cv2; print(f'✓ OpenCV {cv2.__version__} installed')"
python -c "import easyocr; print('✓ EasyOCR installed')"
python -c "import spacy; print(f'✓ spaCy {spacy.__version__} installed')"
python -c "import pptx; print('✓ python-pptx installed')"
python -c "import docx; print('✓ python-docx installed')"
python -c "import pdfplumber; print('✓ pdfplumber installed')"
python -c "import supabase; print('✓ Supabase installed')"

echo -e "\n=================================="
echo "Setup complete!"
echo "=================================="
echo ""
echo "To start the service:"
echo "  source venv/bin/activate"
echo "  ./start.sh"
echo ""
echo "Or run tests first:"
echo "  source venv/bin/activate"
echo "  ./run_tests.sh"