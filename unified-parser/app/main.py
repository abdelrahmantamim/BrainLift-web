"""
Unified File Parser Service
Comprehensive document parsing with NLP-based chunking
"""

import os
import time
from datetime import datetime
from typing import Optional, Dict, Any

from fastapi import FastAPI, File, UploadFile, HTTPException, BackgroundTasks, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import structlog

from .config import settings
from .models import ParseOptions, ParseResponse, HealthResponse
from .parsers import ParserFactory
from .chunkers import ChunkerFactory
from .utils.file_detector import detect_file_type
from .utils.language_detector import LanguageDetector
from .database import DatabaseService
from .cache import CacheService

# Setup structured logging
logger = structlog.get_logger()

# Create FastAPI app
app = FastAPI(
    title="Unified File Parser Service",
    description="Extract structured content from documents with intelligent chunking",
    version="2.0.0",
    docs_url="/docs" if settings.debug else None,
    redoc_url="/redoc" if settings.debug else None,
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize services
db_service = DatabaseService()
cache_service = CacheService()
parser_factory = ParserFactory()
chunker_factory = ChunkerFactory()
language_detector = LanguageDetector()


@app.on_event("startup")
async def startup_event():
    """Initialize services on startup."""
    logger.info(
        "service_starting",
        service=settings.service_name,
        version="2.0.0",
        environment=settings.environment
    )
    
    # Initialize database connection
    await db_service.initialize()
    
    # Load NLP models
    await chunker_factory.initialize()
    
    logger.info("service_started", status="ready")


@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown."""
    await db_service.close()
    await cache_service.close()
    logger.info("service_stopped")


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint."""
    return HealthResponse(
        status="healthy",
        service=settings.service_name,
        version="2.0.0",
        timestamp=datetime.utcnow().isoformat(),
        checks={
            "database": await db_service.is_healthy(),
            "cache": await cache_service.is_healthy(),
            "nlp_models": chunker_factory.is_ready()
        }
    )


@app.post("/parse", response_model=ParseResponse)
async def parse_file(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    extract_tables: bool = Form(True),
    enable_ocr: bool = Form(True),
    chunk_strategy: str = Form("semantic"),
    chunk_size: int = Form(1000),
    language: str = Form("auto"),
    preserve_structure: bool = Form(True),
    enable_summarization: bool = Form(False)
):
    """
    Parse a document and extract structured content with intelligent chunking.
    
    Supported formats:
    - Documents: DOCX, PDF, TXT
    - Presentations: PPTX
    - Images: JPG, PNG (with OCR)
    - Spreadsheets: XLSX (basic support)
    """
    start_time = time.time()
    
    # Validate file
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")
    
    # Read file content
    content = await file.read()
    if len(content) > settings.max_file_size_bytes:
        raise HTTPException(
            status_code=413, 
            detail=f"File too large. Maximum size is {settings.max_file_size_mb}MB"
        )
    
    # Detect file type
    file_type = detect_file_type(content, file.filename)
    if not file_type:
        raise HTTPException(
            status_code=400,
            detail="Unsupported file format"
        )
    
    logger.info(
        "parsing_file",
        filename=file.filename,
        file_type=file_type,
        size_bytes=len(content)
    )
    
    try:
        # Check cache
        cache_key = cache_service.generate_key(content, file.filename)
        cached_result = await cache_service.get(cache_key)
        if cached_result:
            logger.info("cache_hit", filename=file.filename)
            return JSONResponse(content=cached_result)
        
        # Parse options
        options = ParseOptions(
            extract_tables=extract_tables,
            enable_ocr=enable_ocr,
            chunk_strategy=chunk_strategy,
            chunk_size=chunk_size,
            language=language,
            preserve_structure=preserve_structure,
            enable_summarization=enable_summarization
        )
        
        # Get appropriate parser
        parser = parser_factory.get_parser(file_type)
        
        # Parse document
        parsed_data = await parser.parse(content, options)
        
        # Detect language if auto
        if language == "auto":
            sample_text = " ".join([
                chunk.get("content", "")[:200] 
                for chunk in parsed_data.chunks[:5]
            ])
            detected_lang = await language_detector.detect(sample_text)
            parsed_data.metadata.language = detected_lang.language
            parsed_data.metadata.language_confidence = detected_lang.confidence
        
        # Apply NLP-based chunking
        chunker = chunker_factory.get_chunker(options.chunk_strategy)
        enhanced_chunks = await chunker.process(
            parsed_data.chunks,
            max_size=options.chunk_size,
            language=parsed_data.metadata.language
        )
        
        # Generate summary if requested
        summary = None
        key_topics = []
        if enable_summarization and enhanced_chunks:
            summary_data = await chunker.generate_summary(enhanced_chunks)
            summary = summary_data.get("summary")
            key_topics = summary_data.get("key_topics", [])
        
        # Prepare response
        response_data = ParseResponse(
            file_id=parsed_data.file_id,
            file_type=file_type,
            metadata=parsed_data.metadata,
            chunks=enhanced_chunks,
            summary=summary,
            key_topics=key_topics,
            processing_time_ms=int((time.time() - start_time) * 1000)
        )
        
        # Cache result
        await cache_service.set(
            cache_key,
            response_data.dict(),
            expire=settings.cache_ttl
        )
        
        # Store in database (async)
        background_tasks.add_task(
            store_parsed_data,
            parsed_data.file_id,
            file.filename,
            file_type,
            enhanced_chunks,
            parsed_data.metadata.dict()
        )
        
        logger.info(
            "parsing_completed",
            filename=file.filename,
            chunks_count=len(enhanced_chunks),
            processing_time_ms=response_data.processing_time_ms
        )
        
        return response_data
        
    except Exception as e:
        logger.error(
            "parsing_failed",
            filename=file.filename,
            error=str(e),
            exc_info=True
        )
        raise HTTPException(
            status_code=500,
            detail=f"Error parsing file: {str(e)}"
        )


async def store_parsed_data(
    file_id: str,
    filename: str,
    file_type: str,
    chunks: list,
    metadata: dict
):
    """Store parsed data in database."""
    try:
        await db_service.store_parsed_file(
            file_id=file_id,
            filename=filename,
            file_type=file_type,
            chunks=chunks,
            metadata=metadata
        )
        logger.info("data_stored", file_id=file_id)
    except Exception as e:
        logger.error(
            "storage_failed",
            file_id=file_id,
            error=str(e),
            exc_info=True
        )


@app.get("/parse/status/{file_id}")
async def get_parse_status(file_id: str):
    """Get the status of a parsed file."""
    try:
        result = await db_service.get_parsed_file(file_id)
        if not result:
            raise HTTPException(status_code=404, detail="File not found")
        
        return {
            "file_id": file_id,
            "status": "completed",
            "filename": result["filename"],
            "file_type": result["file_type"],
            "metadata": result["metadata"],
            "chunks_count": result["chunks_count"],
            "created_at": result["created_at"]
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error("status_check_failed", file_id=file_id, error=str(e))
        raise HTTPException(
            status_code=500,
            detail=f"Error fetching status: {str(e)}"
        )


@app.post("/extract/tables/{file_id}")
async def extract_tables(file_id: str):
    """Extract all tables from a parsed document."""
    try:
        tables = await db_service.get_file_tables(file_id)
        
        return {
            "file_id": file_id,
            "tables_count": len(tables),
            "tables": tables
        }
    except Exception as e:
        logger.error("table_extraction_failed", file_id=file_id, error=str(e))
        raise HTTPException(
            status_code=500,
            detail=f"Error extracting tables: {str(e)}"
        )


@app.post("/summarize/{file_id}")
async def summarize_document(
    file_id: str,
    max_length: int = 500,
    style: str = "informative"  # informative, concise, detailed
):
    """Generate a summary of a parsed document."""
    try:
        chunks = await db_service.get_file_chunks(file_id)
        if not chunks:
            raise HTTPException(status_code=404, detail="File not found")
        
        # Use NLP chunker for summarization
        chunker = chunker_factory.get_chunker("semantic")
        summary_data = await chunker.generate_summary(
            chunks,
            max_length=max_length,
            style=style
        )
        
        return {
            "file_id": file_id,
            "summary": summary_data["summary"],
            "key_topics": summary_data.get("key_topics", []),
            "key_entities": summary_data.get("entities", [])
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error("summarization_failed", file_id=file_id, error=str(e))
        raise HTTPException(
            status_code=500,
            detail=f"Error generating summary: {str(e)}"
        )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=settings.port,
        reload=settings.debug
    )