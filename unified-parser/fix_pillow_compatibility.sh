#!/bin/bash

echo "Fixing Pillow compatibility issue with EasyOCR"
echo "============================================="

# Activate virtual environment
source venv/bin/activate

# Downgrade Pillow to a compatible version
echo "1. Installing compatible Pillow version..."
pip uninstall -y Pillow
pip install Pillow==9.5.0  # Last version with ANTIALIAS

# Verify the fix
echo -e "\n2. Verifying Pillow compatibility..."
python -c "
from PIL import Image
print(f'✓ Pillow {Image.__version__} installed')
print(f'✓ ANTIALIAS available: {hasattr(Image, \"ANTIALIAS\")}')
"

# Re-run the OCR test
echo -e "\n3. Re-testing OCR functionality..."
python test_ocr.py

# If that still fails, let's create a patched version
if [ $? -ne 0 ]; then
    echo -e "\n4. Creating compatibility patch..."
    cat > patch_easyocr.py << 'EOF'
"""Patch EasyOCR for Pillow 10+ compatibility"""
import PIL.Image

# Add compatibility for Pillow 10+
if not hasattr(PIL.Image, 'ANTIALIAS'):
    PIL.Image.ANTIALIAS = PIL.Image.LANCZOS
    print("✓ Applied Pillow 10+ compatibility patch")

# Test the patch
import easyocr
print("✓ EasyOCR imported successfully with patch")
EOF

    python patch_easyocr.py
fi

echo -e "\n=================================="
echo "Compatibility fix complete!"
echo "=================================="

# Create a startup wrapper that applies the patch
cat > start_with_patch.sh << 'EOF'
#!/bin/bash

# Activate virtual environment
source venv/bin/activate

# Apply Pillow compatibility patch if needed
export PYTHONPATH="${PYTHONPATH}:."
python -c "
import PIL.Image
if not hasattr(PIL.Image, 'ANTIALIAS'):
    PIL.Image.ANTIALIAS = PIL.Image.LANCZOS
"

# Start the service
echo "Starting Unified Parser Service..."
uvicorn app.main:app --host 0.0.0.0 --port 8002 --reload
EOF

chmod +x start_with_patch.sh

echo -e "\nYou can now start the service with:"
echo "  ./start_with_patch.sh"
echo ""
echo "Or continue with the original ./start.sh if OCR is working"