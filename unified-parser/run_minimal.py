#!/usr/bin/env python3
"""
Minimal test script to verify basic functionality
"""

import asyncio
import sys
from pathlib import Path

# Add app to path
sys.path.insert(0, str(Path(__file__).parent))

try:
    from app.parsers.txt_parser import TXTParser
    print("✓ Import successful - basic parser loaded")
    
    # Test basic parsing
    async def test_basic():
        parser = TXTParser()
        test_content = "Hello world\nThis is a test"
        
        # Create a mock file-like object
        from io import BytesIO
        file_obj = BytesIO(test_content.encode('utf-8'))
        
        result = await parser.parse(file_obj, "test.txt")
        print(f"✓ Basic parsing works - found {len(result['chunks'])} chunks")
        print(f"  Content: {result['chunks'][0]['content'][:50]}...")
        
    asyncio.run(test_basic())
    print("\n✓ All basic tests passed!")
    
except ImportError as e:
    print(f"✗ Import error: {e}")
    print("\nMake sure you've activated the virtual environment:")
    print("  source venv/bin/activate")
except Exception as e:
    print(f"✗ Error: {e}")