"""
Simple test script to verify the unified parser service
"""

import asyncio
import httpx
from pathlib import Path


async def test_health():
    """Test health endpoint"""
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get("http://localhost:8002/health")
            print(f"Health check: {response.status_code}")
            print(f"Response: {response.json()}")
        except Exception as e:
            print(f"Health check failed: {e}")


async def test_parse_text():
    """Test parsing a simple text file"""
    # Create test file
    test_content = """# Introduction

This is a test document to verify the unified parser service.

## Features

The service supports:
- Multiple file formats
- OCR for images
- Smart chunking with NLP

## Conclusion

The unified parser provides comprehensive document parsing capabilities.
"""
    
    test_file = Path("test_document.txt")
    test_file.write_text(test_content)
    
    try:
        async with httpx.AsyncClient() as client:
            with open(test_file, "rb") as f:
                files = {"file": ("test_document.txt", f, "text/plain")}
                data = {
                    "extract_tables": "true",
                    "chunk_strategy": "semantic",
                    "enable_ocr": "false"
                }
                
                response = await client.post(
                    "http://localhost:8002/parse",
                    files=files,
                    data=data,
                    timeout=30.0
                )
                
                print(f"Parse status: {response.status_code}")
                if response.status_code == 200:
                    result = response.json()
                    print(f"Processing ID: {result.get('processing_id')}")
                    print(f"Status: {result.get('status')}")
                    print(f"Chunks found: {len(result.get('chunks', []))}")
                    print(f"Metadata: {result.get('metadata')}")
                else:
                    print(f"Error: {response.text}")
                    
    except Exception as e:
        print(f"Parse test failed: {e}")
    finally:
        # Clean up
        if test_file.exists():
            test_file.unlink()


async def main():
    """Run tests"""
    print("Testing Unified Parser Service...")
    print("-" * 50)
    
    await test_health()
    print("-" * 50)
    
    await test_parse_text()
    print("-" * 50)


if __name__ == "__main__":
    asyncio.run(main())