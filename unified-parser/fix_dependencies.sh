#!/bin/bash

echo "Fixing dependency issues..."
echo "=========================="

# Activate virtual environment
source venv/bin/activate

# Fix NumPy version conflict
echo "1. Fixing NumPy version conflict..."
pip uninstall -y numpy
pip install numpy==1.24.3

# Reinstall OpenCV with compatible version
echo -e "\n2. Reinstalling OpenCV..."
pip uninstall -y opencv-python opencv-python-headless
pip install opencv-python-headless==4.8.1.78

# Install spaCy (it seems it failed earlier)
echo -e "\n3. Installing spaCy..."
pip install spacy==3.7.2

# Try installing EasyOCR again
echo -e "\n4. Reinstalling EasyOCR..."
pip install easyocr==1.7.0

# Download spaCy model
echo -e "\n5. Downloading spaCy model..."
python -m spacy download en_core_web_sm || echo "Model download failed - continuing"

echo -e "\n=========================="
echo "Verifying fixes..."
echo "=========================="

# Test imports
python -c "import numpy; print(f'✓ NumPy {numpy.__version__} installed')"
python -c "import cv2; print(f'✓ OpenCV {cv2.__version__} installed')"
python -c "import spacy; print(f'✓ spaCy {spacy.__version__} installed')"
python -c "import easyocr; print('✓ EasyOCR installed')"

echo -e "\nTesting basic functionality..."
python run_minimal.py

echo -e "\nIf all checks pass, you can start the service with:"
echo "  ./start.sh"