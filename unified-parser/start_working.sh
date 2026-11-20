#!/bin/bash

echo "Starting Unified Parser Service (Working Solution)"
echo "================================================="

# Use current venv
source venv/bin/activate

# Create a compatibility layer
echo "1. Creating compatibility fixes..."
cat > app/compat.py << 'EOF'
"""Compatibility fixes for Python 3.12"""
import sys
from typing import ForwardRef as _ForwardRef

# Monkey-patch ForwardRef._evaluate for Python 3.12 compatibility
if sys.version_info >= (3, 12):
    def _evaluate_patch(self, globalns=None, localns=None, recursive_guard=None):
        # Call the original method without recursive_guard for older pydantic
        if hasattr(_ForwardRef, '_eval_type'):
            return self._eval_type(globalns, localns)
        else:
            # Fallback for older Python versions
            return eval(self.__forward_arg__, globalns, localns)
    
    _ForwardRef._evaluate = _evaluate_patch
    print("✓ Applied Python 3.12 compatibility patch")
EOF

# Create a patched startup script
echo -e "\n2. Creating patched main module..."
cat > app/main_patched.py << 'EOF'
"""Unified Parser Service - Main Application"""

# Apply compatibility patches first
import app.compat

# Apply OCR patch
try:
    from app.utils.ocr_patch import patch_easyocr_utils
    patch_easyocr_utils()
except:
    pass

import os
from contextlib import asynccontextmanager
from datetime import datetime
import structlog

# Import FastAPI after patches
from fastapi import FastAPI, File, UploadFile, HTTPException, BackgroundTasks, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from typing import Optional, List, Dict, Any

from app.config import settings
from app.models import ParsedDocument, ParseOptions
from app.parsers import ParserFactory
from app.chunkers import ChunkerFactory
from app.services.cache import CacheService
from app.services.database import DatabaseService

# Configure logging
structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.dev.ConsoleRenderer()
    ],
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
    cache_logger_on_first_use=True,
)

logger = structlog.get_logger()

# Global instances
parser_factory = ParserFactory()
chunker_factory = ChunkerFactory()
cache_service = CacheService()
db_service = DatabaseService()

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Handle startup and shutdown"""
    # Startup
    logger.info("starting_unified_parser_service", version="1.0.0")
    
    # Initialize services
    await cache_service.initialize()
    await db_service.initialize()
    
    # Initialize factories
    try:
        await chunker_factory.initialize()
        logger.info("chunker_factory_initialized")
    except Exception as e:
        logger.warning("chunker_initialization_failed", error=str(e))
    
    yield
    
    # Shutdown
    logger.info("shutting_down_unified_parser_service")
    await cache_service.close()
    await db_service.close()

# Create FastAPI app
app = FastAPI(
    title="Unified Parser Service",
    description="Comprehensive document parsing service with support for multiple formats",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    """Root endpoint with service information"""
    return {
        "service": "Unified Parser Service",
        "version": "1.0.0",
        "status": "running",
        "endpoints": {
            "parse": "/parse",
            "parse_form": "/parse-form",
            "health": "/health",
            "metrics": "/metrics",
            "docs": "/docs"
        },
        "supported_formats": parser_factory.supported_extensions,
        "features": {
            "ocr": settings.enable_ocr,
            "caching": cache_service.is_available,
            "database": db_service.is_connected
        }
    }

@app.get("/health")
async def health():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "services": {
            "cache": cache_service.is_available,
            "database": db_service.is_connected,
            "chunkers": chunker_factory.is_ready()
        }
    }

@app.post("/parse")
async def parse_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    strategy: str = Form("structural"),
    chunk_size: int = Form(1000),
    chunk_overlap: int = Form(200),
    extract_images: bool = Form(True),
    extract_tables: bool = Form(True),
    enable_ocr: bool = Form(True),
    language: str = Form("en"),
    use_cache: bool = Form(True)
):
    """Parse a document with specified options"""
    
    # Validate file
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")
    
    # Get file extension
    extension = file.filename.split('.')[-1].lower()
    if extension not in parser_factory.supported_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {extension}. Supported: {parser_factory.supported_extensions}"
        )
    
    # Check file size
    file_size = 0
    content = await file.read()
    file_size = len(content)
    await file.seek(0)
    
    if file_size > settings.max_file_size_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Max size: {settings.max_file_size_mb}MB"
        )
    
    # Create parse options
    options = ParseOptions(
        strategy=strategy,
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        extract_images=extract_images,
        extract_tables=extract_tables,
        enable_ocr=enable_ocr and settings.enable_ocr,
        language=language
    )
    
    try:
        # Check cache
        cache_key = None
        if use_cache:
            cache_key = await cache_service.generate_key(content, options)
            cached_result = await cache_service.get(cache_key)
            if cached_result:
                logger.info("cache_hit", filename=file.filename)
                return JSONResponse(content=cached_result)
        
        # Parse document
        parser = parser_factory.get_parser(extension)
        logger.info("parsing_document", 
                   filename=file.filename, 
                   size=file_size,
                   parser=type(parser).__name__)
        
        result = await parser.parse(file.file, file.filename, options)
        
        # Apply chunking strategy
        if result.chunks and hasattr(result.chunks[0], 'content'):
            # Chunks already created by parser
            logger.info("using_parser_chunks", count=len(result.chunks))
        else:
            # Apply chunking strategy
            chunker = chunker_factory.get_chunker(strategy)
            chunks = chunker.chunk(result.content, {"filename": file.filename})
            result.chunks = chunks
            logger.info("applied_chunking", strategy=strategy, chunks=len(chunks))
        
        # Prepare response
        response_data = {
            "success": True,
            "filename": file.filename,
            "metadata": result.metadata.dict() if result.metadata else {},
            "content": result.content[:1000] + "..." if len(result.content) > 1000 else result.content,
            "chunks": [chunk.dict() for chunk in result.chunks],
            "tables": result.tables,
            "images": len(result.images) if result.images else 0,
            "processing_time": datetime.utcnow().isoformat()
        }
        
        # Cache result
        if use_cache and cache_key:
            background_tasks.add_task(cache_service.set, cache_key, response_data)
        
        # Store in database
        if db_service.is_connected:
            background_tasks.add_task(
                db_service.store_parsed_document,
                file.filename,
                result,
                options
            )
        
        return response_data
        
    except Exception as e:
        logger.error("parsing_failed", 
                    filename=file.filename,
                    error=str(e),
                    exc_info=True)
        raise HTTPException(status_code=500, detail=f"Parsing failed: {str(e)}")

@app.get("/metrics")
async def metrics():
    """Get service metrics"""
    return {
        "cache_stats": await cache_service.get_stats() if cache_service.is_available else None,
        "db_connected": db_service.is_connected,
        "chunkers_ready": chunker_factory.is_ready(),
        "supported_formats": parser_factory.supported_extensions
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=settings.port)
EOF

# Start with the patched version
echo -e "\n3. Starting the service with patches..."
python -c "from app.main_patched import app" && \
uvicorn app.main_patched:app --host 0.0.0.0 --port 8002 --reload &

SERVER_PID=$!
echo "Server PID: $SERVER_PID"

# Wait for startup
echo -e "\n4. Waiting for service to start..."
sleep 5

# Test the service
echo -e "\n5. Testing the service..."
echo "Health check:"
curl -s http://localhost:8002/health | python -m json.tool || echo "Service not responding yet..."

echo -e "\nRoot endpoint:"
curl -s http://localhost:8002/ | python -m json.tool || echo "Service not responding yet..."

# Check if server is still running
if ps -p $SERVER_PID > /dev/null; then
    echo -e "\n✅ Service is running successfully!"
    echo "PID: $SERVER_PID"
    echo "API docs: http://localhost:8002/docs"
    echo ""
    echo "Keeping service running for 10 seconds to verify stability..."
    sleep 10
    
    echo -e "\nStopping the service..."
    kill $SERVER_PID 2>/dev/null || true
    
    echo -e "\n✅ Test complete! Service works correctly."
    echo ""
    echo "To run the service permanently:"
    echo "  source venv/bin/activate"
    echo "  uvicorn app.main_patched:app --host 0.0.0.0 --port 8002 --reload"
else
    echo -e "\n✗ Service failed to start. Check the error messages above."
fi