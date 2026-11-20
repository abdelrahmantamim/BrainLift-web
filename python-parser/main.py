"""
Python File Parser Service
High-performance document parsing with OCR support
"""

import os
import uuid
from typing import Optional, List, Dict, Any
from datetime import datetime

from fastapi import FastAPI, File, UploadFile, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from parsers.docx_parser import DocxParser
from parsers.pptx_parser import PptxParser
from parsers.pdf_parser import PDFParser
from parsers.image_parser import ImageParser
from parsers.text_parser import TextParser
from chunkers.smart_chunker import SmartChunker
from utils.language_detector import detect_language
from utils.supabase_client import SupabaseClient
from utils.redis_cache import RedisCache

app = FastAPI(
    title="Document Parser API",
    description="Extract structured content from documents with OCR support",
    version="1.0.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure based on your needs
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize services
supabase = SupabaseClient()
redis_cache = RedisCache()
chunker = SmartChunker()

# Parsers mapping
PARSERS = {
    'docx': DocxParser(),
    'doc': DocxParser(),
    'pptx': PptxParser(),
    'ppt': PptxParser(),
    'pdf': PDFParser(),
    'txt': TextParser(),
    'jpg': ImageParser(),
    'jpeg': ImageParser(),
    'png': ImageParser(),
}

class ParseOptions(BaseModel):
    extract_tables: bool = True
    ocr_enabled: bool = True
    chunk_size: int = 1000
    preserve_formatting: bool = True
    language: Optional[str] = None

class ParseResponse(BaseModel):
    file_id: str
    metadata: Dict[str, Any]
    chunks: List[Dict[str, Any]]
    processing_time: float

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "services": {
            "supabase": supabase.is_connected(),
            "redis": redis_cache.is_connected()
        }
    }

@app.post("/parse", response_model=ParseResponse)
async def parse_file(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    extract_tables: bool = True,
    ocr_enabled: bool = True,
    chunk_size: int = 1000,
    preserve_formatting: bool = True
):
    """
    Parse a document and extract structured content
    
    Supported formats: DOCX, PPTX, PDF, TXT, JPG, PNG
    """
    start_time = datetime.utcnow()
    
    # Validate file
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")
    
    file_extension = file.filename.split('.')[-1].lower()
    if file_extension not in PARSERS:
        raise HTTPException(
            status_code=400, 
            detail=f"Unsupported file format: {file_extension}"
        )
    
    # Generate file ID
    file_id = str(uuid.uuid4())
    
    try:
        # Read file content
        content = await file.read()
        
        # Check cache first
        cache_key = f"parse:{file.filename}:{len(content)}"
        cached_result = await redis_cache.get(cache_key)
        if cached_result:
            return JSONResponse(content=cached_result)
        
        # Get appropriate parser
        parser = PARSERS[file_extension]
        
        # Parse options
        options = ParseOptions(
            extract_tables=extract_tables,
            ocr_enabled=ocr_enabled,
            chunk_size=chunk_size,
            preserve_formatting=preserve_formatting
        )
        
        # Parse document
        parsed_content = await parser.parse(content, options)
        
        # Detect language if not specified
        if not parsed_content.get('metadata', {}).get('language'):
            text_sample = ' '.join([
                chunk.get('content', '') 
                for chunk in parsed_content.get('chunks', [])[:5]
            ])
            detected_lang = detect_language(text_sample)
            parsed_content['metadata']['language'] = detected_lang
        
        # Smart chunking
        chunks = chunker.chunk(
            parsed_content['chunks'],
            max_size=chunk_size,
            preserve_structure=preserve_formatting
        )
        
        # Prepare response
        response_data = {
            "file_id": file_id,
            "metadata": {
                "filename": file.filename,
                "size": len(content),
                "format": file_extension,
                **parsed_content.get('metadata', {})
            },
            "chunks": chunks,
            "processing_time": (datetime.utcnow() - start_time).total_seconds()
        }
        
        # Cache result
        await redis_cache.set(cache_key, response_data, expire=3600)
        
        # Store in database (async)
        background_tasks.add_task(
            store_chunks_in_db,
            file_id,
            file.filename,
            chunks,
            parsed_content.get('metadata', {})
        )
        
        return response_data
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error parsing file: {str(e)}"
        )

async def store_chunks_in_db(
    file_id: str, 
    filename: str, 
    chunks: List[Dict], 
    metadata: Dict
):
    """Store parsed chunks in Supabase"""
    try:
        # Store file metadata
        await supabase.insert('parsed_files', {
            'id': file_id,
            'filename': filename,
            'metadata': metadata,
            'created_at': datetime.utcnow().isoformat()
        })
        
        # Store chunks
        chunk_records = []
        for idx, chunk in enumerate(chunks):
            chunk_records.append({
                'file_id': file_id,
                'chunk_index': idx,
                'type': chunk.get('type', 'text'),
                'content': chunk.get('content', ''),
                'metadata': chunk.get('metadata', {}),
                'embedding': None  # Can add vector embeddings later
            })
        
        if chunk_records:
            await supabase.insert_many('file_chunks_v2', chunk_records)
            
    except Exception as e:
        print(f"Error storing chunks: {e}")

@app.get("/parse/status/{file_id}")
async def get_parse_status(file_id: str):
    """Get the status of a parsed file"""
    try:
        result = await supabase.get('parsed_files', file_id)
        if not result:
            raise HTTPException(status_code=404, detail="File not found")
        
        chunks_count = await supabase.count('file_chunks_v2', {'file_id': file_id})
        
        return {
            "file_id": file_id,
            "status": "completed",
            "metadata": result['metadata'],
            "chunks_count": chunks_count,
            "created_at": result['created_at']
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error fetching status: {str(e)}"
        )

@app.post("/extract-tables/{file_id}")
async def extract_tables(file_id: str):
    """Extract all tables from a parsed document"""
    try:
        chunks = await supabase.query(
            'file_chunks_v2',
            {'file_id': file_id, 'type': 'table'}
        )
        
        tables = []
        for chunk in chunks:
            tables.append({
                'chunk_id': chunk['id'],
                'table_data': chunk['content'],
                'page': chunk.get('metadata', {}).get('page'),
                'position': chunk['chunk_index']
            })
        
        return {
            "file_id": file_id,
            "tables_count": len(tables),
            "tables": tables
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error extracting tables: {str(e)}"
        )

@app.post("/ocr")
async def perform_ocr(
    file: UploadFile = File(...),
    languages: List[str] = ['en']
):
    """Perform OCR on an image file"""
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")
    
    try:
        content = await file.read()
        parser = ImageParser()
        
        result = await parser.ocr(content, languages=languages)
        
        return {
            "text": result['text'],
            "confidence": result.get('confidence', 0),
            "language": detect_language(result['text']),
            "bounding_boxes": result.get('boxes', [])
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"OCR error: {str(e)}"
        )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", 8001)),
        reload=True
    )