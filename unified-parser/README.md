# Unified File Parser Service

A comprehensive Python service for parsing and extracting structured content from various file formats with NLP-based smart chunking.

## Features

### File Format Support
- **DOCX**: Headers, tables, paragraphs, lists (python-docx)
- **PPTX**: Slides, speaker notes, tables, images (existing service)
- **PDF**: Native text extraction with OCR fallback (pdfplumber + PyMuPDF)
- **Images**: OCR with preprocessing (EasyOCR + OpenCV)
- **TXT**: Plain text with smart chunking

### Advanced Capabilities
- **OCR Support**: Multi-language OCR for scanned documents
- **Table Extraction**: Structured table data from PDFs and docs
- **Image Processing**: Deskew, denoise, and optimize for OCR
- **Smart Chunking**: NLP-based semantic chunking with spaCy
- **Language Detection**: Automatic language detection per chunk
- **Hierarchical Structure**: Preserve document structure and relationships

## Architecture

```
┌────────────────────┐
│   Node.js API      │
│  (File Upload)     │
└─────────┬──────────┘
          │
          ▼
┌────────────────────┐     ┌─────────────────┐
│  Unified Parser    │────▶│    Supabase     │
│     Service        │     │  (Chunks DB)    │
└─────────┬──────────┘     └─────────────────┘
          │
          ├── PPTX Parser (existing)
          ├── DOCX Parser (python-docx)
          ├── PDF Parser (pdfplumber)
          ├── OCR Engine (EasyOCR)
          ├── Image Processor (OpenCV)
          └── NLP Chunker (spaCy)
```

## API Endpoints

### Parse Any File
```
POST /parse
Content-Type: multipart/form-data

Request:
- file: binary
- options: {
    "extract_tables": true,
    "enable_ocr": true,
    "chunk_strategy": "semantic", // or "fixed"
    "chunk_size": 1000,
    "language": "auto", // or specific language code
    "preserve_structure": true
  }

Response:
{
  "file_id": "uuid",
  "file_type": "docx|pptx|pdf|image",
  "metadata": {
    "title": "Document Title",
    "author": "Author Name",
    "pages": 10,
    "language": "en",
    "has_tables": true,
    "has_images": true
  },
  "chunks": [
    {
      "id": "chunk_1",
      "type": "heading",
      "level": 1,
      "content": "Introduction",
      "page": 1,
      "parent_id": null,
      "language": "en",
      "metadata": {
        "font_size": 16,
        "is_bold": true
      }
    },
    {
      "id": "chunk_2",
      "type": "paragraph",
      "content": "This document explains...",
      "page": 1,
      "parent_id": "chunk_1",
      "language": "en"
    },
    {
      "id": "chunk_3",
      "type": "table",
      "content": {
        "headers": ["Column 1", "Column 2"],
        "rows": [["A", "B"], ["C", "D"]]
      },
      "page": 2
    }
  ],
  "summary": "AI-generated document summary...",
  "key_topics": ["topic1", "topic2"],
  "processing_time_ms": 2500
}
```

## Installation

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Download spaCy language models
python -m spacy download en_core_web_lg
python -m spacy download es_core_news_lg
python -m spacy download ar_core_web_lg

# Run the service
python run.py
```

## Environment Variables

```env
# Service Configuration
PORT=8002
SERVICE_NAME=unified-parser
ENVIRONMENT=development

# Database
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_KEY=your_service_key

# Redis Cache
REDIS_URL=redis://localhost:6379
CACHE_TTL=3600

# OCR Settings
OCR_LANGUAGES=en,ar,es,fr,de
OCR_GPU=false

# NLP Settings
SPACY_MODEL=en_core_web_lg
CHUNK_OVERLAP=100

# API Keys (optional)
OPENAI_API_KEY=your_key  # For advanced summarization

# PPTX parsing is now built-in, no external service needed
USE_EXTERNAL_PPTX=false
```

## Smart Chunking Strategies

### 1. Semantic Chunking (Default)
- Uses spaCy NLP to identify natural boundaries
- Preserves complete thoughts and paragraphs
- Maintains context across chunks

### 2. Structural Chunking
- Based on document structure (headers, sections)
- Keeps related content together
- Ideal for hierarchical documents

### 3. Fixed-Size Chunking
- Token-based splitting with overlap
- Useful for consistent chunk sizes
- Best for simple text processing

## Performance Optimizations

- Async processing with Celery for large files
- Redis caching for processed documents
- GPU acceleration for OCR (optional)
- Streaming responses for large files
- Batch processing for multiple files