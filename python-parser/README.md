# Python File Parser Service

A high-performance Python service for extracting structured content from various file formats (DOCX, PPTX, PDF, images) with OCR support.

## Architecture Overview

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Node.js API   │────▶│  Python Parser   │────▶│    Supabase     │
│                 │     │    Service       │     │   (chunks DB)   │
└─────────────────┘     └──────────────────┘     └─────────────────┘
         │                       │
         │                       ├── DOCX Parser (python-docx)
         │                       ├── PPTX Parser (python-pptx)
         │                       ├── PDF Parser (pdfplumber)
         │                       ├── OCR Engine (EasyOCR)
         │                       └── NLP Chunker (spaCy)
         │
         └── File Upload ────────┘
```

## Features

- **Structured Extraction**: Preserves document hierarchy (headers, paragraphs, tables)
- **Multi-format Support**: DOCX, PPTX, PDF, TXT, JPG/PNG (with OCR)
- **Table Recognition**: Extracts tables as structured data
- **OCR Support**: For scanned documents and images
- **Smart Chunking**: Semantic splitting for optimal AI context
- **Multi-language**: Supports Arabic, English, Spanish, Chinese, etc.

## API Endpoints

### 1. Parse File
```
POST /parse
Content-Type: multipart/form-data

Request:
- file: binary
- options: {
    "extract_tables": true,
    "ocr_enabled": true,
    "chunk_size": 1000,
    "preserve_formatting": true
  }

Response:
{
  "file_id": "uuid",
  "metadata": {
    "title": "Document Title",
    "author": "Author Name",
    "pages": 10,
    "language": "en"
  },
  "chunks": [
    {
      "id": "chunk_1",
      "type": "heading",
      "level": 1,
      "content": "Introduction",
      "page": 1,
      "metadata": {}
    },
    {
      "id": "chunk_2", 
      "type": "paragraph",
      "content": "This document explains...",
      "page": 1,
      "parent": "chunk_1"
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
  ]
}
```

### 2. Extract Images
```
POST /extract-images
```

### 3. Get Parse Status
```
GET /parse/status/{file_id}
```

## Installation

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows

# Install dependencies
pip install -r requirements.txt

# Download spaCy model
python -m spacy download en_core_web_sm
```

## Environment Variables

```env
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key
REDIS_URL=redis://localhost:6379
PORT=8001
```

## Chunk Types

1. **heading** - Document headers (H1-H6)
2. **paragraph** - Regular text paragraphs
3. **table** - Structured table data
4. **list** - Bullet/numbered lists
5. **image** - Image with OCR text
6. **equation** - Mathematical formulas
7. **code** - Code blocks
8. **note** - Speaker notes (PPTX)

## Processing Pipeline

1. **File Upload** → Validate format
2. **Format Detection** → Route to appropriate parser
3. **Content Extraction** → Parse structure
4. **OCR (if needed)** → Extract text from images
5. **Chunking** → Split into semantic chunks
6. **Language Detection** → Detect chunk language
7. **Storage** → Save to Supabase
8. **Response** → Return structured data

## Performance Optimizations

- Async processing with Celery for large files
- Redis caching for repeated requests
- GPU acceleration for OCR (if available)
- Streaming response for large documents

## Error Handling

- Graceful fallback for corrupted files
- Retry mechanism for OCR failures
- Detailed error messages for debugging