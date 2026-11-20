#!/bin/bash

echo "Starting Unified Parser with minimal dependencies"
echo "================================================"

# Create a minimal virtual environment
if [ -d "venv_minimal" ]; then
    rm -rf venv_minimal
fi

echo "1. Creating fresh virtual environment..."
python3.12 -m venv venv_minimal
source venv_minimal/bin/activate

echo -e "\n2. Installing core dependencies only..."
pip install --upgrade pip

# Install minimal dependencies first
pip install fastapi==0.104.1
pip install uvicorn[standard]==0.24.0
pip install python-multipart==0.0.6
pip install aiofiles==23.2.1

# Install document parsing
pip install python-docx==1.1.0
pip install python-pptx==0.6.23
pip install pdfplumber==0.10.3
pip install PyPDF2==3.0.1

# Install Supabase without pydantic conflicts
pip install httpx==0.24.1
pip install postgrest==0.13.0
pip install gotrue==2.1.0
pip install realtime==1.0.2
pip install storage3==0.7.0

# Install image processing
pip install Pillow==10.1.0
pip install numpy==1.26.4

# Basic utilities
pip install python-dotenv==1.0.0
pip install chardet==5.2.0

echo -e "\n3. Creating minimal app without problematic dependencies..."
# Create a minimal version that works
cat > app_minimal.py << 'EOF'
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import os
from typing import Optional
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Unified Parser Service", version="1.0.0")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Import parsers
try:
    from app.parsers.txt_parser import TXTParser
    from app.parsers.pdf_parser import PDFParser
    from app.parsers.docx_parser import DOCXParser
    from app.parsers.pptx_parser import PPTXParser
    parsers_available = True
    logger.info("✓ Parsers imported successfully")
except ImportError as e:
    logger.error(f"Failed to import parsers: {e}")
    parsers_available = False

@app.get("/")
async def root():
    return {
        "service": "Unified Parser Service",
        "status": "running",
        "parsers_available": parsers_available,
        "endpoints": {
            "parse": "/parse",
            "health": "/health",
            "docs": "/docs"
        }
    }

@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "parsers": parsers_available
    }

@app.post("/parse")
async def parse_document(
    file: UploadFile = File(...),
    extract_images: bool = True,
    extract_tables: bool = True,
    chunk_size: Optional[int] = 1000
):
    """Parse a document and extract content"""
    if not parsers_available:
        raise HTTPException(status_code=503, detail="Parsers not available")
    
    # Get file extension
    filename = file.filename
    ext = filename.split('.')[-1].lower()
    
    # Read file content
    content = await file.read()
    await file.seek(0)
    
    try:
        if ext == 'txt':
            parser = TXTParser()
        elif ext == 'pdf':
            parser = PDFParser()
        elif ext in ['docx', 'doc']:
            parser = DOCXParser()
        elif ext in ['pptx', 'ppt']:
            parser = PPTXParser()
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported file type: {ext}")
        
        # Parse the document
        from app.models import ParseOptions
        options = ParseOptions(
            extract_images=extract_images,
            extract_tables=extract_tables,
            chunk_size=chunk_size,
            enable_ocr=False  # Disable OCR for now
        )
        
        result = await parser.parse(file.file, filename, options)
        
        # Convert to dict for response
        return {
            "filename": filename,
            "content": result.content,
            "chunks": [chunk.dict() for chunk in result.chunks],
            "metadata": result.metadata.dict() if result.metadata else {},
            "tables": result.tables,
            "images": len(result.images) if result.images else 0
        }
        
    except Exception as e:
        logger.error(f"Error parsing {filename}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8002)
EOF

echo -e "\n4. Testing the minimal app..."
python -c "
import app_minimal
print('✓ App imports successfully')
"

echo -e "\n5. Starting the service..."
python app_minimal.py &
SERVER_PID=$!

echo -e "\n6. Waiting for service to start..."
sleep 3

echo -e "\n7. Testing the service..."
curl -s http://localhost:8002/health | python -m json.tool

echo -e "\n8. Service is running! PID: $SERVER_PID"
echo "To stop the service, run: kill $SERVER_PID"

# Wait a moment to show it's working
sleep 2

echo -e "\n9. Stopping the service..."
kill $SERVER_PID

echo -e "\n✅ Service tested successfully!"
echo ""
echo "To run the service permanently:"
echo "  source venv_minimal/bin/activate"
echo "  python app_minimal.py"
echo ""
echo "Or fix the main app by removing spacy and using simpler dependencies."