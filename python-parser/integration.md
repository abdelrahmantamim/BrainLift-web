# Integration Plan: Python Parser Service with Node.js Backend

## Overview
This document outlines how to integrate the Python parsing service with the existing Node.js backend for enhanced file processing.

## Architecture

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Mobile     │────▶│  Node.js API │────▶│Python Parser │────▶│   Supabase   │
│     App      │     │   (Gateway)  │     │   Service    │     │  (Storage)   │
└──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
                            │                      │
                            └──────────────────────┘
                              Async Processing
```

## Implementation Steps

### 1. Update Node.js File Upload Route

```javascript
// server/routes/file.routes.js

router.post('/upload', requireAuth, upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    const { processWithPython = true } = req.body;
    
    // Store file in Supabase Storage
    const fileRecord = await storeFile(file);
    
    if (processWithPython && PYTHON_PARSER_ENABLED) {
      // Send to Python service for parsing
      const formData = new FormData();
      formData.append('file', file.buffer, file.originalname);
      formData.append('extract_tables', 'true');
      formData.append('ocr_enabled', 'true');
      
      const parseResponse = await axios.post(
        `${PYTHON_PARSER_URL}/parse`,
        formData,
        {
          headers: formData.getHeaders(),
          maxBodyLength: Infinity,
          maxContentLength: Infinity
        }
      );
      
      // Store enhanced chunks
      const { chunks, metadata } = parseResponse.data;
      await storeEnhancedChunks(fileRecord.id, chunks, metadata);
      
      return res.json({
        success: true,
        file: fileRecord,
        parsing: {
          status: 'completed',
          chunks_count: chunks.length,
          metadata
        }
      });
    } else {
      // Fallback to existing Node.js parser
      await processWithNodeParser(fileRecord);
    }
    
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
});
```

### 2. Database Schema Updates

```sql
-- Add new table for enhanced chunks
CREATE TABLE file_chunks_enhanced (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  file_id UUID REFERENCES files(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  type TEXT NOT NULL, -- 'heading', 'paragraph', 'table', 'list', 'image'
  level INTEGER, -- For headings
  content JSONB NOT NULL, -- Text or structured data
  metadata JSONB DEFAULT '{}',
  parent_chunk_id UUID REFERENCES file_chunks_enhanced(id),
  language TEXT,
  embedding vector(1536), -- For semantic search
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for efficient querying
CREATE INDEX idx_file_chunks_enhanced_file_id ON file_chunks_enhanced(file_id);
CREATE INDEX idx_file_chunks_enhanced_type ON file_chunks_enhanced(type);
CREATE INDEX idx_file_chunks_enhanced_parent ON file_chunks_enhanced(parent_chunk_id);

-- Add parsing status to files table
ALTER TABLE files ADD COLUMN parsing_status TEXT DEFAULT 'pending';
ALTER TABLE files ADD COLUMN parsing_metadata JSONB DEFAULT '{}';
ALTER TABLE files ADD COLUMN parsed_at TIMESTAMPTZ;
```

### 3. Quiz Generation Enhancement

```javascript
// server/routes/quiz.routes.js

async function getEnhancedFileContent(fileIds) {
  const chunks = await supabase
    .from('file_chunks_enhanced')
    .select('*')
    .in('file_id', fileIds)
    .order('chunk_index');
  
  // Build structured content
  let content = '';
  let currentSection = null;
  
  for (const chunk of chunks) {
    switch (chunk.type) {
      case 'heading':
        content += `\n${'#'.repeat(chunk.level)} ${chunk.content}\n`;
        currentSection = chunk.content;
        break;
        
      case 'paragraph':
        content += `\n${chunk.content}\n`;
        break;
        
      case 'table':
        // Format table for AI understanding
        const table = chunk.content;
        content += '\n[TABLE]\n';
        content += `Headers: ${table.headers.join(' | ')}\n`;
        table.rows.forEach(row => {
          content += `Row: ${row.join(' | ')}\n`;
        });
        content += '[/TABLE]\n';
        break;
        
      case 'list':
        content += '\n';
        chunk.content.forEach(item => {
          content += `- ${item.text}\n`;
        });
        break;
    }
  }
  
  return content;
}
```

### 4. Environment Configuration

```env
# Python Parser Service
PYTHON_PARSER_URL=http://localhost:8001
PYTHON_PARSER_ENABLED=true
PYTHON_PARSER_API_KEY=your-internal-api-key

# Feature Flags
USE_ENHANCED_PARSING=true
ENABLE_OCR=true
ENABLE_TABLE_EXTRACTION=true
```

### 5. Docker Compose Setup

```yaml
version: '3.8'

services:
  node-api:
    build: ./server
    ports:
      - "3001:3001"
    environment:
      - PYTHON_PARSER_URL=http://python-parser:8001
    depends_on:
      - python-parser
      - redis

  python-parser:
    build: ./python-parser
    ports:
      - "8001:8001"
    environment:
      - REDIS_URL=redis://redis:6379
    volumes:
      - ./python-parser:/app
    depends_on:
      - redis

  redis:
    image: redis:alpine
    ports:
      - "6379:6379"
```

### 6. Mobile App Updates

```typescript
// mobile/src/services/FileService.ts

export const uploadFile = async (file: File, options?: UploadOptions) => {
  const formData = new FormData();
  formData.append('file', file);
  
  // Enable Python parsing for better results
  formData.append('processWithPython', 'true');
  
  if (options?.extractTables) {
    formData.append('extract_tables', 'true');
  }
  
  if (options?.enableOCR) {
    formData.append('ocr_enabled', 'true');
  }
  
  const response = await api.post('/files/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    onUploadProgress: options?.onProgress,
  });
  
  return response.data;
};
```

## Benefits

1. **Better Structure Recognition**
   - Preserves document hierarchy
   - Identifies tables, lists, and headings
   - Maintains parent-child relationships

2. **Improved Quiz Quality**
   - Questions based on section context
   - Table-based comparison questions
   - Better understanding of document structure

3. **OCR Support**
   - Process scanned PDFs and images
   - Multi-language OCR support
   - Preprocessing for better accuracy

4. **Scalability**
   - Async processing for large files
   - Redis caching for performance
   - Separate service for easy scaling

## Migration Strategy

1. **Phase 1**: Deploy Python service alongside existing system
2. **Phase 2**: Route new uploads to Python service with fallback
3. **Phase 3**: Migrate existing files in batches
4. **Phase 4**: Deprecate old parsing logic

## Monitoring

- Track parsing success rate
- Monitor processing time by file type
- Alert on OCR failures
- Dashboard for parsing statistics