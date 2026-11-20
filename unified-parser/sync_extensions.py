#!/usr/bin/env python3
"""
Extension Synchronization Check between Server and Unified Parser

This script compares the supported file extensions between the tutoring app server
and the unified parser to ensure they are in sync.
"""

import json
from pathlib import Path


# Unified Parser supported extensions (from ParserFactory)
PARSER_EXTENSIONS = {
    "docx": "Word Document",
    "doc": "Word Document (Legacy)",
    "pdf": "PDF",
    "pptx": "PowerPoint",
    "ppt": "PowerPoint (Legacy)",
    "txt": "Text",
    "text": "Text",
    "md": "Markdown",
    "markdown": "Markdown",
    "json": "JSON",
    "csv": "CSV",
    "html": "HTML",
    "htm": "HTML",
    "jpg": "JPEG Image",
    "jpeg": "JPEG Image",
    "png": "PNG Image",
    "gif": "GIF Image",
    "bmp": "Bitmap Image",
    "tiff": "TIFF Image",
    "webp": "WebP Image"
}

# Server supported MIME types (from server/routes/files.routes.js)
SERVER_MIME_TYPES = {
    'application/pdf': {'supported': True, 'extensions': ['pdf']},
    'application/msword': {'supported': True, 'extensions': ['doc']},
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {'supported': True, 'extensions': ['docx']},
    'text/plain': {'supported': True, 'extensions': ['txt']},
    'text/csv': {'supported': True, 'extensions': ['csv']},
    'image/jpeg': {'supported': True, 'extensions': ['jpg', 'jpeg']},
    'image/jpg': {'supported': True, 'extensions': ['jpg']},
    'image/png': {'supported': True, 'extensions': ['png']},
    'image/gif': {'supported': True, 'extensions': ['gif']},
    'image/webp': {'supported': True, 'extensions': ['webp']},
    'application/vnd.ms-powerpoint': {'supported': True, 'extensions': ['ppt']},
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': {'supported': True, 'extensions': ['pptx']},
    'application/vnd.ms-excel': {'supported': False, 'extensions': ['xls']},
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {'supported': False, 'extensions': ['xlsx']},
}

# Additional MIME types that the parser supports but server doesn't
PARSER_ADDITIONAL_MIME_TYPES = {
    'text/markdown': {'extensions': ['md', 'markdown']},
    'text/x-markdown': {'extensions': ['md', 'markdown']},
    'application/json': {'extensions': ['json']},
    'text/html': {'extensions': ['html', 'htm']},
    'application/xhtml+xml': {'extensions': ['html']},
    'image/bmp': {'extensions': ['bmp']},
    'image/tiff': {'extensions': ['tiff']},
}


def get_server_supported_extensions():
    """Extract supported extensions from server MIME types."""
    extensions = set()
    for mime, info in SERVER_MIME_TYPES.items():
        if info['supported']:
            extensions.update(info['extensions'])
    return extensions


def compare_extensions():
    """Compare extensions between server and parser."""
    parser_exts = set(PARSER_EXTENSIONS.keys())
    server_exts = get_server_supported_extensions()
    
    print("📊 Extension Comparison Report")
    print("=" * 60)
    
    # Extensions in parser but not in server
    parser_only = parser_exts - server_exts
    if parser_only:
        print("\n🔴 Extensions supported by Parser but NOT by Server:")
        for ext in sorted(parser_only):
            print(f"   - .{ext} ({PARSER_EXTENSIONS[ext]})")
    
    # Extensions in server but not in parser
    server_only = server_exts - parser_exts
    if server_only:
        print("\n🔴 Extensions supported by Server but NOT by Parser:")
        for ext in sorted(server_only):
            print(f"   - .{ext}")
    
    # Common extensions
    common = parser_exts & server_exts
    print(f"\n✅ Extensions supported by BOTH services: {len(common)}")
    for ext in sorted(common):
        print(f"   - .{ext} ({PARSER_EXTENSIONS[ext]})")
    
    # Generate recommendations
    print("\n📝 Recommendations:")
    print("=" * 60)
    
    if parser_only:
        print("\n1. Add these MIME types to server's SUPPORTED_TYPES:")
        print("```javascript")
        print("const SUPPORTED_TYPES = {")
        print("  // ... existing types ...")
        
        for ext in sorted(parser_only):
            if ext in ['md', 'markdown']:
                print("  'text/markdown': { supported: true },")
            elif ext == 'json':
                print("  'application/json': { supported: true },")
            elif ext in ['html', 'htm']:
                print("  'text/html': { supported: true },")
            elif ext == 'bmp':
                print("  'image/bmp': { supported: true },")
            elif ext == 'tiff':
                print("  'image/tiff': { supported: true },")
            elif ext == 'text':
                # Skip 'text' as it's an alias for 'txt'
                continue
        
        print("};")
        print("```")
    
    if server_only:
        print("\n2. These extensions are in server but not in parser:")
        print("   Consider if they need to be added to the parser.")
    
    # Summary
    print("\n📊 Summary:")
    print(f"   - Parser supports: {len(parser_exts)} extensions")
    print(f"   - Server supports: {len(server_exts)} extensions")
    print(f"   - Common extensions: {len(common)}")
    print(f"   - Parser-only: {len(parser_only)}")
    print(f"   - Server-only: {len(server_only)}")
    
    return len(parser_only) == 0 and len(server_only) == 0


def generate_server_update():
    """Generate JavaScript code to update server's SUPPORTED_TYPES."""
    parser_only = set(PARSER_EXTENSIONS.keys()) - get_server_supported_extensions()
    
    # Filter out aliases
    parser_only = {ext for ext in parser_only if ext not in ['text']}
    
    if not parser_only:
        print("\n✅ Server is already in sync with parser!")
        return
    
    print("\n📄 Generated Update for server/routes/files.routes.js:")
    print("=" * 60)
    print("Add these entries to the SUPPORTED_TYPES object:\n")
    
    print("```javascript")
    additions = []
    
    if 'md' in parser_only or 'markdown' in parser_only:
        additions.append("  'text/markdown': { supported: true },")
        additions.append("  'text/x-markdown': { supported: true },")
    
    if 'json' in parser_only:
        additions.append("  'application/json': { supported: true },")
    
    if 'html' in parser_only or 'htm' in parser_only:
        additions.append("  'text/html': { supported: true },")
        additions.append("  'application/xhtml+xml': { supported: true },")
    
    if 'bmp' in parser_only:
        additions.append("  'image/bmp': { supported: true },")
    
    if 'tiff' in parser_only:
        additions.append("  'image/tiff': { supported: true },")
    
    for line in additions:
        print(line)
    
    print("```")
    
    print("\nAnd update the error message to include the new formats:")
    print("```javascript")
    print('const errorMessage = fileType.includes("excel") ')
    print('  ? "Excel files are not yet supported"')
    print('  : `File type "${extension}" is not supported. Supported formats: PDF, Word, PowerPoint, Text, Images, Markdown, JSON, CSV, and HTML.`;')
    print("```")


if __name__ == "__main__":
    print("🔄 Unified Parser & Server Extension Sync Check")
    print("=" * 60)
    
    # Run comparison
    is_synced = compare_extensions()
    
    # Generate update code if needed
    if not is_synced:
        generate_server_update()
    else:
        print("\n✅ Both services support the same file extensions!")