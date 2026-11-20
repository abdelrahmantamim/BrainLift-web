#!/bin/bash

echo "Setting up Unified Parser with pre-built wheels"
echo "==============================================="

# Ensure we're using Python 3.12
if command -v python3.12 &> /dev/null; then
    PYTHON_CMD=python3.12
else
    echo "Python 3.12 not found. Using system Python 3..."
    PYTHON_CMD=python3
fi

# Remove existing venv if it exists
if [ -d "venv" ]; then
    echo "Removing existing virtual environment..."
    rm -rf venv
fi

# Create new virtual environment
echo "Creating virtual environment..."
$PYTHON_CMD -m venv venv

# Activate virtual environment
echo "Activating virtual environment..."
source venv/bin/activate

# Upgrade pip to latest version for better wheel support
echo "Upgrading pip, setuptools, and wheel..."
pip install --upgrade pip setuptools wheel

# Install numpy with specific version that has wheels for macOS
echo -e "\n1. Installing NumPy (using pre-built wheel)..."
pip install numpy==1.26.4  # Latest version with good macOS ARM64 support

# Install core dependencies
echo -e "\n2. Installing core dependencies..."
pip install fastapi==0.104.1
pip install uvicorn[standard]==0.24.0
pip install python-multipart==0.0.6
pip install pydantic==2.5.0
pip install pydantic-settings==2.0.3

# Install document parsing libraries
echo -e "\n3. Installing document parsing libraries..."
pip install python-docx==1.1.0
pip install python-pptx==0.6.23
pip install pdfplumber==0.10.3
pip install openpyxl==3.1.2
pip install PyPDF2==3.0.1

# Install image processing libraries (using pre-built wheels)
echo -e "\n4. Installing image processing libraries..."
pip install Pillow==10.1.0
pip install opencv-python-headless==4.8.1.78

# Install tiktoken (pre-built wheel if available)
echo -e "\n5. Installing tiktoken..."
pip install tiktoken --prefer-binary || echo "Tiktoken installation failed - continuing without it"

# Install OCR libraries
echo -e "\n6. Installing OCR libraries..."
pip install easyocr==1.7.0

# Install NLP libraries (excluding spacy for now)
echo -e "\n7. Installing text processing libraries..."
pip install langdetect==1.0.9
pip install nltk==3.8.1

# Install spacy separately with specific version
echo -e "\n8. Installing spaCy..."
pip install spacy==3.7.2 --prefer-binary

# Try to download spacy model
echo -e "\n9. Downloading spaCy model..."
python -m spacy download en_core_web_sm || echo "SpaCy model download failed - you may need to download it manually"

# Install database and utilities
echo -e "\n10. Installing database and utilities..."
pip install supabase==2.0.3
pip install redis==5.0.1
pip install chardet==5.2.0
pip install beautifulsoup4==4.12.2
pip install lxml==4.9.3
pip install httpx==0.25.2
pip install aiofiles==23.2.1
pip install structlog==23.2.0

# Install python-magic without libmagic dependency
echo -e "\n11. Installing file type detection..."
pip install python-magic-bin==0.4.14  # This includes the libmagic library

# Install testing dependencies
echo -e "\n12. Installing testing dependencies..."
pip install pytest==7.4.3
pip install pytest-asyncio==0.21.1
pip install pytest-cov==4.1.0

echo -e "\n=================================="
echo "Verifying installation..."
echo "=================================="

# Check installations
python -c "import sys; print(f'Python version: {sys.version}')"
python -c "import fastapi; print('✓ FastAPI installed')" || echo "✗ FastAPI not installed"
python -c "import uvicorn; print('✓ Uvicorn installed')" || echo "✗ Uvicorn not installed"
python -c "import numpy; print(f'✓ NumPy {numpy.__version__} installed')" || echo "✗ NumPy not installed"
python -c "import cv2; print(f'✓ OpenCV {cv2.__version__} installed')" || echo "✗ OpenCV not installed"
python -c "import PIL; print('✓ Pillow installed')" || echo "✗ Pillow not installed"
python -c "import pptx; print('✓ python-pptx installed')" || echo "✗ python-pptx not installed"
python -c "import docx; print('✓ python-docx installed')" || echo "✗ python-docx not installed"
python -c "import pdfplumber; print('✓ pdfplumber installed')" || echo "✗ pdfplumber not installed"
python -c "import supabase; print('✓ Supabase installed')" || echo "✗ Supabase not installed"

echo -e "\n=================================="
echo "Installation complete!"
echo "=================================="

# Create a simple .env file if it doesn't exist
if [ ! -f .env ]; then
    echo -e "\nCreating .env file..."
    cat > .env << 'EOF'
# Copy your values from server/.env
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_KEY=
API_KEY=your-secure-api-key-here
ENABLE_OCR=true
LOG_LEVEL=INFO
USE_EXTERNAL_PPTX=false
EOF
    echo "Created .env file - please update it with your actual values"
fi

echo -e "\nNext steps:"
echo "1. Update the .env file with your Supabase credentials"
echo "2. Run: source venv/bin/activate"
echo "3. Run: ./start.sh"