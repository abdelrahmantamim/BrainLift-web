"""
Pydantic models for request/response validation
"""

from typing import List, Dict, Any, Optional
from datetime import datetime
from pydantic import BaseModel, Field, validator
import uuid


class ParseOptions(BaseModel):
    """Options for document parsing"""
    extract_tables: bool = True
    extract_images: bool = True
    enable_ocr: bool = True
    chunk_strategy: str = Field(
        default="semantic",
        description="Chunking strategy: semantic, structural, or fixed"
    )
    chunk_size: int = Field(
        default=1000,
        ge=100,
        le=5000,
        description="Maximum chunk size in tokens"
    )
    language: str = Field(
        default="auto",
        description="Language code or 'auto' for detection"
    )
    preserve_structure: bool = True
    enable_summarization: bool = False
    
    @validator("chunk_strategy")
    def validate_strategy(cls, v):
        allowed = ["semantic", "structural", "fixed"]
        if v not in allowed:
            raise ValueError(f"chunk_strategy must be one of {allowed}")
        return v


class ChunkMetadata(BaseModel):
    """Metadata for a document chunk"""
    page: Optional[int] = None
    section: Optional[str] = None
    font_size: Optional[int] = None
    is_bold: Optional[bool] = None
    is_italic: Optional[bool] = None
    confidence: Optional[float] = None
    language: Optional[str] = None
    parent_type: Optional[str] = None
    # Additional metadata
    has_table: Optional[bool] = None
    has_image: Optional[bool] = None
    is_speaker_note: Optional[bool] = None
    layout: Optional[str] = None
    list_type: Optional[str] = None
    table_rows: Optional[int] = None
    table_cols: Optional[int] = None
    image_id: Optional[str] = None
    image_format: Optional[str] = None
    image_dimensions: Optional[str] = None


class Chunk(BaseModel):
    """Represents a document chunk"""
    id: str = Field(default_factory=lambda: f"chunk_{uuid.uuid4().hex[:8]}")
    type: str  # heading, paragraph, table, list, image, note
    level: Optional[int] = None  # For headings (1-6)
    content: Any  # Text string or structured data (for tables)
    parent_id: Optional[str] = None
    children_ids: List[str] = []
    metadata: ChunkMetadata = ChunkMetadata()
    embedding: Optional[List[float]] = None  # For vector search


class DocumentMetadata(BaseModel):
    """Metadata extracted from document"""
    title: Optional[str] = None
    author: Optional[str] = None
    subject: Optional[str] = None
    keywords: Optional[str] = None
    created_date: Optional[str] = None
    modified_date: Optional[str] = None
    pages: Optional[int] = None
    language: Optional[str] = None
    language_confidence: Optional[float] = None
    has_tables: bool = False
    has_images: bool = False
    has_ocr_content: bool = False
    word_count: Optional[int] = None
    # Additional metadata for comprehensive parsing
    image_count: Optional[int] = 0
    table_count: Optional[int] = 0
    notes_count: Optional[int] = 0


class ParsedDocument(BaseModel):
    """Result of document parsing"""
    file_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    content: str = ""  # Full document content
    chunks: List[Chunk] = []
    metadata: DocumentMetadata = DocumentMetadata()
    tables: List[Dict[str, Any]] = []  # Extracted tables
    images: List[Dict[str, Any]] = []  # Extracted images
    warnings: List[str] = []


class ParseResponse(BaseModel):
    """API response for parse endpoint"""
    file_id: str
    file_type: str
    metadata: DocumentMetadata
    chunks: List[Dict[str, Any]]  # Simplified for JSON response
    summary: Optional[str] = None
    key_topics: List[str] = []
    processing_time_ms: int
    warnings: List[str] = []


class HealthResponse(BaseModel):
    """Health check response"""
    status: str
    service: str
    version: str
    timestamp: str
    checks: Dict[str, bool]


class TableData(BaseModel):
    """Structured table data"""
    headers: List[str]
    rows: List[List[str]]
    has_header: bool = True
    metadata: Dict[str, Any] = {}


class ImageData(BaseModel):
    """Image information"""
    id: str
    format: str  # jpg, png, etc.
    width: int
    height: int
    ocr_text: Optional[str] = None
    caption: Optional[str] = None
    base64_data: Optional[str] = None
    metadata: Dict[str, Any] = {}


class LanguageDetectionResult(BaseModel):
    """Language detection result"""
    language: str
    confidence: float
    alternatives: List[Dict[str, float]] = []


class SummaryResult(BaseModel):
    """Document summary result"""
    summary: str
    key_topics: List[str]
    entities: List[Dict[str, str]] = []  # Named entities
    word_count: int
    
    
class ErrorResponse(BaseModel):
    """Error response model"""
    error: str
    detail: Optional[str] = None
    timestamp: str = Field(default_factory=lambda: datetime.utcnow().isoformat())