# MarkItDown Setup Instructions

MarkItDown is a Microsoft tool that converts various document formats to Markdown, optimized for AI/LLM consumption.

## Installation

### 1. Install Python 3.10 or higher
Make sure you have Python 3.10+ installed:
```bash
python3 --version
```

### 2. Create Virtual Environment (Recommended)
```bash
cd server
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

### 3. Install MarkItDown
```bash
pip install markitdown

# Or with all optional dependencies for better format support:
pip install 'markitdown[all]'
```

### 4. Verify Installation
```bash
python -m markitdown --version
```

## Benefits for Your App

1. **Better Document Structure**: Converts documents to structured Markdown instead of plain text
2. **Comprehensive Format Support**: PDF, Word, PowerPoint, Excel, Images (with OCR), and more
3. **AI-Optimized**: Designed specifically for LLM consumption
4. **Smart Chunking**: Respects document structure (headings, sections, lists)

## How It Works

When a user uploads a document:
1. MarkItDown converts it to structured Markdown
2. The service creates intelligent chunks that respect document boundaries
3. Each chunk maintains context (section titles, hierarchy)
4. The AI receives well-formatted content it can understand better

## Example Output

Instead of plain text:
```
Key Terms for Cardiac Disorders Arrhythmia Definition An irregular...
```

You get structured Markdown:
```markdown
# Key Terms for Cardiac Disorders

## Arrhythmia
**Definition**: An irregular heartbeat pattern...

## Myocardial Infarction
**Definition**: Commonly known as a heart attack...
```

## Fallback Behavior

If MarkItDown is not installed or fails:
1. Falls back to unified parser
2. Then falls back to mammoth (Word) or pdf-parse (PDF)
3. Ensures documents are always processed

## Testing

After installation, restart your server and upload a Word or PDF document. 
Check the logs for:
```
[FileProcessor] Attempting to use MarkItDown for: document.docx
[FileProcessor] MarkItDown completed in XXXms
```