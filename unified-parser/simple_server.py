#!/usr/bin/env python3
"""Simple working parser server without problematic dependencies"""

from http.server import HTTPServer, BaseHTTPRequestHandler
import json
import io
import os
import sys
import cgi
from datetime import datetime

# Add app to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Import only what we need
from app.parsers.txt_parser import TXTParser
from app.parsers.pdf_parser import PDFParser
from app.parsers.docx_parser import DOCXParser
from app.parsers.pptx_parser import PPTXParser
from app.models import ParseOptions

class ParserHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            response = {
                "service": "Unified Parser Service (Simple)",
                "status": "running",
                "endpoints": {
                    "/": "Service info",
                    "/health": "Health check",
                    "/parse": "Parse document (POST)"
                },
                "supported_formats": ["txt", "pdf", "docx", "pptx"]
            }
            self.wfile.write(json.dumps(response, indent=2).encode())
        
        elif self.path == '/health':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            response = {
                "status": "healthy",
                "timestamp": datetime.utcnow().isoformat()
            }
            self.wfile.write(json.dumps(response, indent=2).encode())
        
        else:
            self.send_error(404)
    
    def do_POST(self):
        if self.path == '/parse':
            # Parse multipart form data
            content_type = self.headers.get('Content-Type')
            if not content_type or 'multipart/form-data' not in content_type:
                self.send_error(400, "Content-Type must be multipart/form-data")
                return
            
            # Parse the form data
            form = cgi.FieldStorage(
                fp=self.rfile,
                headers=self.headers,
                environ={
                    'REQUEST_METHOD': 'POST',
                    'CONTENT_TYPE': self.headers['Content-Type']
                }
            )
            
            # Get the file
            if 'file' not in form:
                self.send_error(400, "No file provided")
                return
            
            file_item = form['file']
            if not file_item.filename:
                self.send_error(400, "No filename provided")
                return
            
            filename = file_item.filename
            file_data = file_item.file.read()
            
            # Get file extension
            ext = filename.split('.')[-1].lower()
            
            # Select parser
            parser = None
            if ext == 'txt':
                parser = TXTParser()
            elif ext == 'pdf':
                parser = PDFParser()
            elif ext in ['docx', 'doc']:
                parser = DOCXParser()
            elif ext in ['pptx', 'ppt']:
                parser = PPTXParser()
            else:
                self.send_error(400, f"Unsupported file type: {ext}")
                return
            
            try:
                # Parse the document
                options = ParseOptions(
                    extract_images=True,
                    extract_tables=True,
                    enable_ocr=False  # Disable OCR for simplicity
                )
                
                # Run async parser in sync context
                import asyncio
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                
                file_obj = io.BytesIO(file_data)
                result = loop.run_until_complete(
                    parser.parse(file_obj, filename, options)
                )
                
                # Prepare response
                response = {
                    "success": True,
                    "filename": filename,
                    "content": result.content[:1000] + "..." if len(result.content) > 1000 else result.content,
                    "chunks": [chunk.dict() for chunk in result.chunks] if result.chunks else [],
                    "metadata": result.metadata.dict() if result.metadata else {},
                    "tables": result.tables if result.tables else [],
                    "images": len(result.images) if result.images else 0
                }
                
                # Send response
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps(response, indent=2).encode())
                
            except Exception as e:
                self.send_error(500, f"Parsing error: {str(e)}")
        
        else:
            self.send_error(404)

def run_server(port=8002):
    """Run the simple parser server"""
    server_address = ('', port)
    httpd = HTTPServer(server_address, ParserHandler)
    print(f"\n✅ Unified Parser Service (Simple) running on http://0.0.0.0:{port}")
    print(f"   Health check: http://localhost:{port}/health")
    print(f"   Service info: http://localhost:{port}/")
    print("\nPress Ctrl+C to stop the server\n")
    
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down server...")
        httpd.shutdown()

if __name__ == "__main__":
    # Test imports first
    print("Testing imports...")
    try:
        from app.parsers.txt_parser import TXTParser
        print("✓ TXT parser imported")
        from app.parsers.pdf_parser import PDFParser
        print("✓ PDF parser imported")
        from app.parsers.docx_parser import DOCXParser
        print("✓ DOCX parser imported")
        from app.parsers.pptx_parser import PPTXParser
        print("✓ PPTX parser imported")
        print("✓ All parsers imported successfully!")
        
        # Run server
        run_server()
        
    except ImportError as e:
        print(f"✗ Import error: {e}")
        print("\nMake sure you're in the unified-parser directory and have activated the venv")