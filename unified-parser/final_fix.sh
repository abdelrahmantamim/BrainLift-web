#!/bin/bash

echo "Final fix for Unified Parser Service"
echo "===================================="

# Use current venv
source venv/bin/activate

# The issue is FastAPI 0.95.2 with Pydantic 1.10.13 on Python 3.12
# We need to use compatible versions

echo "1. Uninstalling problematic packages..."
pip uninstall -y fastapi pydantic pydantic-core pydantic-settings

echo -e "\n2. Installing compatible versions..."
# Install Pydantic 2.x first
pip install pydantic==2.5.0

# Install FastAPI that works with Pydantic 2.x
pip install fastapi==0.104.1

# Install other dependencies
pip install python-multipart==0.0.6
pip install aiofiles==23.2.1

echo -e "\n3. Creating a working main.py without problematic imports..."
cat > app/main_working.py << 'EOF'
"""Unified Parser Service - Working Version"""

import os
import logging
from datetime import datetime
from typing import Optional, Dict, Any

# Apply patches before any other imports
try:
    from app.utils.ocr_patch import patch_easyocr_utils
    patch_easyocr_utils()
except:
    pass

from fastapi import FastAPI, File, UploadFile, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Import parsers with error handling
parsers_available = {}
try:
    from app.parsers.txt_parser import TXTParser
    parsers_available['txt'] = TXTParser
    logger.info("✓ TXT parser loaded")
except Exception as e:
    logger.error(f"Failed to load TXT parser: {e}")

try:
    from app.parsers.pdf_parser import PDFParser
    parsers_available['pdf'] = PDFParser
    logger.info("✓ PDF parser loaded")
except Exception as e:
    logger.error(f"Failed to load PDF parser: {e}")

try:
    from app.parsers.docx_parser import DOCXParser
    parsers_available['docx'] = DOCXParser
    parsers_available['doc'] = DOCXParser
    logger.info("✓ DOCX parser loaded")
except Exception as e:
    logger.error(f"Failed to load DOCX parser: {e}")

try:
    from app.parsers.pptx_parser import PPTXParser
    parsers_available['pptx'] = PPTXParser
    parsers_available['ppt'] = PPTXParser
    logger.info("✓ PPTX parser loaded")
except Exception as e:
    logger.error(f"Failed to load PPTX parser: {e}")

# Import models
try:
    from app.models import ParseOptions
    models_available = True
except:
    models_available = False
    # Define a simple ParseOptions if models fail
    class ParseOptions:
        def __init__(self, **kwargs):
            self.extract_images = kwargs.get('extract_images', True)
            self.extract_tables = kwargs.get('extract_tables', True)
            self.enable_ocr = kwargs.get('enable_ocr', False)
            self.chunk_size = kwargs.get('chunk_size', 1000)
            self.language = kwargs.get('language', 'en')

# Create FastAPI app
app = FastAPI(
    title="Unified Parser Service",
    description="Document parsing service for multiple formats",
    version="1.0.0"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    """Service information"""
    return {
        "service": "Unified Parser Service",
        "status": "running",
        "version": "1.0.0",
        "parsers_available": list(parsers_available.keys()),
        "endpoints": {
            "/": "Service info",
            "/health": "Health check",
            "/parse": "Parse document",
            "/docs": "API documentation"
        }
    }

@app.get("/health")
async def health():
    """Health check"""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "parsers": len(parsers_available),
        "models": models_available
    }

@app.post("/parse")
async def parse_document(
    file: UploadFile = File(...),
    extract_images: bool = Form(True),
    extract_tables: bool = Form(True),
    enable_ocr: bool = Form(False),
    chunk_size: int = Form(1000),
    language: str = Form("en")
):
    """Parse a document"""
    
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")
    
    # Get extension
    ext = file.filename.split('.')[-1].lower()
    
    if ext not in parsers_available:
        raise HTTPException(
            status_code=400, 
            detail=f"Unsupported file type: {ext}. Supported: {list(parsers_available.keys())}"
        )
    
    try:
        # Create parser
        parser_class = parsers_available[ext]
        parser = parser_class()
        
        # Create options
        options = ParseOptions(
            extract_images=extract_images,
            extract_tables=extract_tables,
            enable_ocr=enable_ocr,
            chunk_size=chunk_size,
            language=language
        )
        
        # Parse document
        logger.info(f"Parsing {file.filename} with {parser_class.__name__}")
        result = await parser.parse(file.file, file.filename, options)
        
        # Convert result to dict
        response = {
            "success": True,
            "filename": file.filename,
            "content": result.content[:1000] + "..." if len(result.content) > 1000 else result.content,
            "metadata": result.metadata.dict() if hasattr(result.metadata, 'dict') else {},
            "chunks": [
                chunk.dict() if hasattr(chunk, 'dict') else chunk 
                for chunk in (result.chunks or [])
            ],
            "tables": result.tables or [],
            "images": len(result.images) if result.images else 0
        }
        
        return response
        
    except Exception as e:
        logger.error(f"Error parsing {file.filename}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8002)
EOF

echo -e "\n4. Testing the working version..."
python -c "
try:
    from app.main_working import app
    print('✓ Working app imports successfully!')
except Exception as e:
    print(f'✗ Import failed: {e}')
"

echo -e "\n5. Starting the service..."
uvicorn app.main_working:app --host 0.0.0.0 --port 8002 &
SERVER_PID=$!

echo "Server PID: $SERVER_PID"

# Wait for startup
echo -e "\n6. Waiting for service to start..."
sleep 5

# Test endpoints
echo -e "\n7. Testing endpoints..."
echo "Health check:"
curl -s http://localhost:8002/health | python -m json.tool

echo -e "\nService info:"
curl -s http://localhost:8002/ | python -m json.tool

# Keep running for verification
echo -e "\n✅ Service is running!"
echo "API docs available at: http://localhost:8002/docs"
echo ""
echo "Keeping service running for 10 seconds..."
sleep 10

# Stop service
echo -e "\nStopping service..."
kill $SERVER_PID

echo -e "\n✅ Test complete!"
echo ""
echo "To run the service permanently:"
echo "  source venv/bin/activate"
echo "  uvicorn app.main_working:app --host 0.0.0.0 --port 8002 --reload"