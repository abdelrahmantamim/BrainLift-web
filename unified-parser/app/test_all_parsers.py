"""
Comprehensive test suite for all parsers
Tests both existing and new parsers to ensure service stability
"""

import asyncio
import json
import os
import sys
import tempfile
from typing import Dict, Any
from pathlib import Path

# Add parent directory to path for imports
parent_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, parent_dir)

import structlog
from app.parsers import ParserFactory
from app.models import ParseOptions

logger = structlog.get_logger()


class TestAllParsers:
    """Test all parsers with sample files"""
    
    def __init__(self):
        self.factory = ParserFactory()
        self.test_results: Dict[str, Any] = {}
    
    async def test_text_parser(self):
        """Test text parser"""
        logger.info("Testing Text Parser...")
        
        content = """Sample Text Document
        
This is a test document to verify the text parser functionality.

It contains multiple paragraphs and should be parsed correctly.

Features to test:
- Multiple lines
- Different sections
- Word counting"""
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as f:
            f.write(content)
            f.flush()
            
            parser = self.factory.get_parser('txt')
            result = await parser.parse(content, "test.txt", ParseOptions())
            
            os.unlink(f.name)
            
            assert result.content == content
            assert len(result.chunks) > 0
            assert result.metadata.word_count > 0
            
        self.test_results['text'] = {'status': 'PASSED', 'chunks': len(result.chunks)}
        logger.info("Text Parser: PASSED")
    
    async def test_markdown_parser(self):
        """Test markdown parser"""
        logger.info("Testing Markdown Parser...")
        
        content = """# Markdown Test Document

## Introduction
This is a test markdown document with various elements.

### Code Example
```python
def hello_world():
    print("Hello, World!")
```

### Table Example
| Header 1 | Header 2 |
|----------|----------|
| Cell 1   | Cell 2   |
| Cell 3   | Cell 4   |

### List Example
- Item 1
- Item 2
  - Nested item
- Item 3

### Image Example
![Alt text](image.png)
"""
        
        parser = self.factory.get_parser('md')
        result = await parser.parse(content, "test.md", ParseOptions())
        
        # Verify different chunk types
        chunk_types = {chunk.type for chunk in result.chunks}
        assert 'heading' in chunk_types
        assert 'code' in chunk_types
        assert 'table' in chunk_types
        assert 'list' in chunk_types
        assert 'image' in chunk_types
        
        # Verify table parsing
        tables = [c for c in result.chunks if c.type == 'table']
        assert len(tables) > 0
        assert tables[0].content['headers'] == ['Header 1', 'Header 2']
        
        self.test_results['markdown'] = {'status': 'PASSED', 'chunks': len(result.chunks)}
        logger.info("Markdown Parser: PASSED")
    
    async def test_json_parser(self):
        """Test JSON parser"""
        logger.info("Testing JSON Parser...")
        
        content = json.dumps({
            "name": "Test Document",
            "version": "1.0",
            "data": [
                {"id": 1, "name": "Item 1", "value": 100},
                {"id": 2, "name": "Item 2", "value": 200},
                {"id": 3, "name": "Item 3", "value": 300}
            ],
            "metadata": {
                "created": "2024-01-01",
                "author": "Test User"
            }
        }, indent=2)
        
        parser = self.factory.get_parser('json')
        result = await parser.parse(content, "test.json", ParseOptions())
        
        assert len(result.chunks) > 0
        assert result.content == content  # Should be formatted JSON
        assert len(result.tables) > 0  # Should extract table from data array
        
        self.test_results['json'] = {'status': 'PASSED', 'chunks': len(result.chunks)}
        logger.info("JSON Parser: PASSED")
    
    async def test_csv_parser(self):
        """Test CSV parser"""
        logger.info("Testing CSV Parser...")
        
        content = """Name,Age,City,Score
John Doe,30,New York,85.5
Jane Smith,25,Los Angeles,92.0
Bob Johnson,35,Chicago,78.5
Alice Brown,28,Houston,88.0"""
        
        parser = self.factory.get_parser('csv')
        result = await parser.parse(content, "test.csv", ParseOptions())
        
        assert len(result.chunks) > 0
        assert result.metadata.has_tables
        assert len(result.tables) == 1
        
        # Verify table structure
        table = result.tables[0]
        assert table['headers'] == ['Name', 'Age', 'City', 'Score']
        assert len(table['rows']) == 4
        
        # Check if statistics were calculated
        stats_chunks = [c for c in result.chunks if c.type == 'metadata']
        assert len(stats_chunks) > 0
        
        self.test_results['csv'] = {'status': 'PASSED', 'chunks': len(result.chunks)}
        logger.info("CSV Parser: PASSED")
    
    async def test_html_parser(self):
        """Test HTML parser"""
        logger.info("Testing HTML Parser...")
        
        content = """<!DOCTYPE html>
<html>
<head>
    <title>Test HTML Document</title>
    <meta name="author" content="Test Author">
    <meta name="description" content="Test description">
</head>
<body>
    <h1>Main Title</h1>
    <p>This is a paragraph with some text.</p>
    
    <h2>Section Title</h2>
    <p>Another paragraph here.</p>
    
    <table>
        <tr>
            <th>Column 1</th>
            <th>Column 2</th>
        </tr>
        <tr>
            <td>Data 1</td>
            <td>Data 2</td>
        </tr>
    </table>
    
    <ul>
        <li>List item 1</li>
        <li>List item 2</li>
    </ul>
    
    <img src="test.jpg" alt="Test image">
    
    <pre><code>
    function test() {
        console.log("Hello");
    }
    </code></pre>
</body>
</html>"""
        
        parser = self.factory.get_parser('html')
        result = await parser.parse(content, "test.html", ParseOptions(extract_images=True))
        
        # Verify different chunk types
        chunk_types = {chunk.type for chunk in result.chunks}
        assert 'heading' in chunk_types
        assert 'paragraph' in chunk_types
        assert 'table' in chunk_types
        assert 'list' in chunk_types
        assert 'image' in chunk_types
        assert 'code' in chunk_types
        
        # Verify metadata extraction
        assert result.metadata.title == "Test HTML Document"
        assert result.metadata.author == "Test Author"
        
        self.test_results['html'] = {'status': 'PASSED', 'chunks': len(result.chunks)}
        logger.info("HTML Parser: PASSED")
    
    async def test_pdf_parser(self):
        """Test PDF parser (requires actual PDF file)"""
        logger.info("Testing PDF Parser...")
        
        # Create a simple test by checking parser exists
        parser = self.factory.get_parser('pdf')
        assert parser is not None
        
        self.test_results['pdf'] = {'status': 'VERIFIED', 'note': 'Parser exists'}
        logger.info("PDF Parser: VERIFIED (requires actual PDF file)")
    
    async def test_docx_parser(self):
        """Test DOCX parser (requires actual DOCX file)"""
        logger.info("Testing DOCX Parser...")
        
        # Create a simple test by checking parser exists
        parser = self.factory.get_parser('docx')
        assert parser is not None
        
        self.test_results['docx'] = {'status': 'VERIFIED', 'note': 'Parser exists'}
        logger.info("DOCX Parser: VERIFIED (requires actual DOCX file)")
    
    async def test_pptx_parser(self):
        """Test PPTX parser (requires actual PPTX file)"""
        logger.info("Testing PPTX Parser...")
        
        # Create a simple test by checking parser exists
        parser = self.factory.get_parser('pptx')
        assert parser is not None
        
        self.test_results['pptx'] = {'status': 'VERIFIED', 'note': 'Parser exists'}
        logger.info("PPTX Parser: VERIFIED (requires actual PPTX file)")
    
    async def test_image_parser(self):
        """Test image parser (requires actual image file)"""
        logger.info("Testing Image Parser...")
        
        # Create a simple test by checking parser exists
        parser = self.factory.get_parser('jpg')
        assert parser is not None
        
        self.test_results['image'] = {'status': 'VERIFIED', 'note': 'Parser exists'}
        logger.info("Image Parser: VERIFIED (requires actual image file)")
    
    async def test_unsupported_format(self):
        """Test unsupported format handling"""
        logger.info("Testing unsupported format handling...")
        
        try:
            parser = self.factory.get_parser('xyz')
            assert False, "Should have raised ValueError"
        except ValueError as e:
            assert "No parser available" in str(e)
        
        self.test_results['unsupported'] = {'status': 'PASSED'}
        logger.info("Unsupported format handling: PASSED")
    
    async def run_all_tests(self):
        """Run all parser tests"""
        logger.info("=" * 50)
        logger.info("Starting comprehensive parser tests...")
        logger.info("=" * 50)
        
        tests = [
            self.test_text_parser(),
            self.test_markdown_parser(),
            self.test_json_parser(),
            self.test_csv_parser(),
            self.test_html_parser(),
            self.test_pdf_parser(),
            self.test_docx_parser(),
            self.test_pptx_parser(),
            self.test_image_parser(),
            self.test_unsupported_format()
        ]
        
        # Run all tests
        for test in tests:
            try:
                await test
            except Exception as e:
                logger.error(f"Test failed: {str(e)}")
                test_name = test.__name__.replace('test_', '').replace('_parser', '')
                self.test_results[test_name] = {'status': 'FAILED', 'error': str(e)}
        
        # Summary
        logger.info("=" * 50)
        logger.info("Test Summary:")
        logger.info("=" * 50)
        
        passed = sum(1 for r in self.test_results.values() if r['status'] in ['PASSED', 'VERIFIED'])
        failed = sum(1 for r in self.test_results.values() if r['status'] == 'FAILED')
        
        for parser, result in self.test_results.items():
            status = result['status']
            extra = f" - {result.get('note', '')}" if 'note' in result else ""
            extra += f" - {result.get('chunks', 0)} chunks" if 'chunks' in result else ""
            logger.info(f"{parser.upper()}: {status}{extra}")
        
        logger.info("=" * 50)
        logger.info(f"Total: {len(self.test_results)} tests")
        logger.info(f"Passed/Verified: {passed}")
        logger.info(f"Failed: {failed}")
        logger.info("=" * 50)
        
        # Check supported file types
        logger.info("\nSupported file types:")
        supported = self.factory.get_supported_types()
        logger.info(f"Total formats: {len(supported)}")
        logger.info(f"Formats: {', '.join(sorted(supported))}")
        
        return failed == 0


async def main():
    """Main test runner"""
    tester = TestAllParsers()
    success = await tester.run_all_tests()
    
    if not success:
        logger.error("Some tests failed!")
        exit(1)
    else:
        logger.info("All tests passed!")


if __name__ == "__main__":
    asyncio.run(main())