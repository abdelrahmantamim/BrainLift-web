#!/bin/bash

echo "Installing dependencies for Unified Parser Service"
echo "================================================="

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
echo "Activating virtual environment..."
source venv/bin/activate

# Upgrade pip
echo "Upgrading pip..."
pip install --upgrade pip

# Install core dependencies first
echo -e "\n1. Installing core dependencies..."
pip install fastapi==0.104.1
pip install uvicorn[standard]==0.24.0
pip install python-multipart==0.0.6
pip install pydantic==2.5.0
pip install pydantic-settings==2.0.3

# Install document parsing libraries
echo -e "\n2. Installing document parsing libraries..."
pip install python-docx==1.1.0
pip install python-pptx==0.6.23
pip install pdfplumber==0.10.3
pip install openpyxl==3.1.2

# Install OCR dependencies (these might be problematic)
echo -e "\n3. Installing OCR and image processing libraries..."
# Try installing numpy first as it's a dependency for many packages
pip install numpy==1.24.3

# Install OpenCV without building from source
echo "Installing OpenCV (this may take a while)..."
pip install opencv-python-headless==4.8.1.78

# Install Pillow
echo "Installing Pillow..."
pip install Pillow==10.1.0

# Install EasyOCR (this is large and may take time)
echo "Installing EasyOCR (this will download models)..."
pip install easyocr==1.7.0

# Install NLP libraries
echo -e "\n4. Installing NLP libraries..."
pip install langdetect==1.0.9
pip install tiktoken==0.5.1
pip install nltk==3.8.1

# Install spacy separately as it's large
echo "Installing spaCy..."
pip install spacy==3.7.2

# Download spacy model
echo "Downloading spaCy English model..."
python -m spacy download en_core_web_sm || echo "Spacy model download failed - you may need to run this manually"

# Install database and utilities
echo -e "\n5. Installing database and utility libraries..."
pip install supabase==2.0.3
pip install redis==5.0.1
pip install python-magic==0.4.27
pip install chardet==5.2.0
pip install beautifulsoup4==4.12.2
pip install lxml==4.9.3
pip install httpx==0.25.2
pip install aiofiles==23.2.1
pip install structlog==23.2.0

# Install testing dependencies
echo -e "\n6. Installing testing dependencies..."
pip install pytest==7.4.3
pip install pytest-asyncio==0.21.1
pip install pytest-cov==4.1.0

echo -e "\n=================================="
echo "Installation complete!"
echo "=================================="

# Check if all critical packages are installed
echo -e "\nVerifying installation..."
python -c "import fastapi; print('✓ FastAPI installed')"
python -c "import uvicorn; print('✓ Uvicorn installed')"
python -c "import pptx; print('✓ python-pptx installed')"
python -c "import docx; print('✓ python-docx installed')"
python -c "import pdfplumber; print('✓ pdfplumber installed')"
python -c "import easyocr; print('✓ EasyOCR installed')"
python -c "import spacy; print('✓ spaCy installed')"
python -c "import supabase; print('✓ Supabase installed')"

echo -e "\nTo start the service, run:"
echo "  source venv/bin/activate"
echo "  ./start.sh"
echo ""
echo "Or directly with:"
echo "  source venv/bin/activate && uvicorn app.main:app --host 0.0.0.0 --port 8002 --reload"