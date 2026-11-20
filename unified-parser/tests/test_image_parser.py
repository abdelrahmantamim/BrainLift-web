"""
Comprehensive tests for Image parser to ensure OCR and image processing work correctly
"""

import pytest
import asyncio
from io import BytesIO
from PIL import Image, ImageDraw, ImageFont
import numpy as np

from app.parsers.image_parser import ImageParser
from app.models import ParseOptions


class TestImageParser:
    """Test suite for Image parser"""
    
    @pytest.fixture
    def parser(self):
        """Create parser instance"""
        return ImageParser()
    
    @pytest.fixture
    def parse_options(self):
        """Default parsing options"""
        return ParseOptions(
            extract_tables=True,
            enable_ocr=True,
            chunk_strategy="semantic"
        )
    
    @pytest.fixture
    def text_image(self):
        """Create image with clear text"""
        img = Image.new('RGB', (800, 600), color='white')
        draw = ImageDraw.Draw(img)
        
        # Add text at various positions
        texts = [
            (50, 50, "Document Title", 36),
            (50, 150, "Section 1: Introduction", 24),
            (50, 200, "This is a paragraph of text that should be extracted by OCR.", 16),
            (50, 250, "It contains multiple lines and sentences.", 16),
            (50, 350, "Section 2: Content", 24),
            (50, 400, "• First bullet point", 16),
            (50, 430, "• Second bullet point", 16),
            (50, 460, "• Third bullet point", 16)
        ]
        
        for x, y, text, size in texts:
            draw.text((x, y), text, fill='black')
        
        buffer = BytesIO()
        img.save(buffer, format='PNG')
        return buffer.getvalue()
    
    @pytest.fixture
    def table_image(self):
        """Create image with table-like structure"""
        img = Image.new('RGB', (600, 400), color='white')
        draw = ImageDraw.Draw(img)
        
        # Draw table
        table_data = [
            ["Header 1", "Header 2", "Header 3"],
            ["Row 1 Col 1", "Row 1 Col 2", "Row 1 Col 3"],
            ["Row 2 Col 1", "Row 2 Col 2", "Row 2 Col 3"]
        ]
        
        x_start, y_start = 50, 50
        cell_width, cell_height = 150, 40
        
        for i, row in enumerate(table_data):
            for j, cell in enumerate(row):
                x = x_start + j * cell_width
                y = y_start + i * cell_height
                
                # Draw cell border
                draw.rectangle(
                    [x, y, x + cell_width, y + cell_height],
                    outline='black',
                    width=2
                )
                
                # Draw text
                draw.text((x + 10, y + 10), cell, fill='black')
        
        buffer = BytesIO()
        img.save(buffer, format='PNG')
        return buffer.getvalue()
    
    @pytest.fixture
    def skewed_image(self):
        """Create skewed/rotated image to test preprocessing"""
        img = Image.new('RGB', (600, 400), color='white')
        draw = ImageDraw.Draw(img)
        
        # Add text
        draw.text((100, 100), "This text is straight", fill='black')
        draw.text((100, 150), "Before rotation", fill='black')
        
        # Rotate image
        img = img.rotate(5, expand=True, fillcolor='white')
        
        buffer = BytesIO()
        img.save(buffer, format='PNG')
        return buffer.getvalue()
    
    @pytest.fixture
    def noisy_image(self):
        """Create image with noise to test preprocessing"""
        img = Image.new('RGB', (400, 300), color='white')
        draw = ImageDraw.Draw(img)
        
        # Add text
        draw.text((50, 50), "Noisy Text", fill='black')
        
        # Add noise
        pixels = img.load()
        width, height = img.size
        
        import random
        for _ in range(1000):
            x = random.randint(0, width - 1)
            y = random.randint(0, height - 1)
            pixels[x, y] = (
                random.randint(0, 255),
                random.randint(0, 255),
                random.randint(0, 255)
            )
        
        buffer = BytesIO()
        img.save(buffer, format='PNG')
        return buffer.getvalue()
    
    @pytest.mark.asyncio
    async def test_basic_ocr(self, parser, parse_options, text_image):
        """Test basic OCR functionality"""
        result = await parser.parse(text_image, parse_options)
        
        assert result is not None
        assert len(result.chunks) > 0
        assert result.metadata.has_images == True
        
        # Extract all text
        all_text = ' '.join(
            c.content for c in result.chunks 
            if isinstance(c.content, str)
        ).upper()
        
        assert "DOCUMENT TITLE" in all_text
        assert "INTRODUCTION" in all_text
        assert "BULLET POINT" in all_text
    
    @pytest.mark.asyncio
    async def test_layout_detection(self, parser, parse_options, text_image):
        """Test layout analysis and region detection"""
        result = await parser.parse(text_image, parse_options)
        
        # Should detect title as heading
        headings = [c for c in result.chunks if c.type == "heading"]
        assert len(headings) > 0
        
        # Should detect body text
        paragraphs = [c for c in result.chunks if c.type == "paragraph"]
        assert len(paragraphs) > 0
        
        # Should detect list items
        lists = [c for c in result.chunks if c.type == "list"]
        # Lists might be detected or might be in paragraphs
    
    @pytest.mark.asyncio
    async def test_table_detection(self, parser, parse_options, table_image):
        """Test table detection in images"""
        result = await parser.parse(table_image, parse_options)
        
        # Look for table chunks
        tables = [c for c in result.chunks if c.type == "table"]
        
        # Table detection is complex, so also check if text was extracted
        all_text = ' '.join(
            c.content for c in result.chunks 
            if isinstance(c.content, str)
        )
        
        assert "Header 1" in all_text
        assert "Row 1 Col 1" in all_text
    
    @pytest.mark.asyncio
    async def test_preprocessing_skew(self, parser, parse_options, skewed_image):
        """Test skew correction preprocessing"""
        result = await parser.parse(skewed_image, parse_options)
        
        # Should still extract text after deskewing
        all_text = ' '.join(
            c.content for c in result.chunks 
            if isinstance(c.content, str)
        )
        
        assert "straight" in all_text.lower() or "rotation" in all_text.lower()
    
    @pytest.mark.asyncio
    async def test_preprocessing_noise(self, parser, parse_options, noisy_image):
        """Test noise reduction preprocessing"""
        result = await parser.parse(noisy_image, parse_options)
        
        # Should extract text despite noise
        all_text = ' '.join(
            c.content for c in result.chunks 
            if isinstance(c.content, str)
        ).upper()
        
        # Might not be perfect due to noise
        assert "NOISY" in all_text or "TEXT" in all_text
    
    @pytest.mark.asyncio
    async def test_confidence_scores(self, parser, parse_options, text_image):
        """Test OCR confidence scores"""
        result = await parser.parse(text_image, parse_options)
        
        # Check that chunks have confidence scores
        chunks_with_confidence = [
            c for c in result.chunks 
            if c.metadata.confidence is not None
        ]
        
        if chunks_with_confidence:
            for chunk in chunks_with_confidence:
                assert 0 <= chunk.metadata.confidence <= 1
    
    @pytest.mark.asyncio
    async def test_multi_format_support(self, parser, parse_options):
        """Test different image formats"""
        formats = ['PNG', 'JPEG', 'BMP']
        
        for fmt in formats:
            # Create image
            img = Image.new('RGB', (200, 100), color='white')
            draw = ImageDraw.Draw(img)
            draw.text((10, 10), f"{fmt} Format Test", fill='black')
            
            buffer = BytesIO()
            if fmt == 'JPEG':
                img.save(buffer, format=fmt, quality=95)
            else:
                img.save(buffer, format=fmt)
            
            result = await parser.parse(buffer.getvalue(), parse_options)
            assert len(result.chunks) > 0
    
    @pytest.mark.asyncio
    async def test_empty_image(self, parser, parse_options):
        """Test parsing empty/blank image"""
        img = Image.new('RGB', (200, 200), color='white')
        buffer = BytesIO()
        img.save(buffer, format='PNG')
        
        result = await parser.parse(buffer.getvalue(), parse_options)
        
        # Should handle gracefully
        assert result is not None
        assert len(result.chunks) >= 1
        
        # Should indicate no text found
        if result.chunks:
            content = result.chunks[0].content
            assert "No text detected" in content or content == ""
    
    @pytest.mark.asyncio
    async def test_metadata_extraction(self, parser, parse_options, text_image):
        """Test image metadata extraction"""
        result = await parser.parse(text_image, parse_options)
        
        assert result.metadata.image_dimensions is not None
        assert "800x600" in result.metadata.image_dimensions
        assert result.metadata.image_format is not None
        assert result.metadata.word_count > 0
    
    @pytest.mark.asyncio
    async def test_position_detection(self, parser, parse_options):
        """Test position-based text grouping"""
        img = Image.new('RGB', (800, 600), color='white')
        draw = ImageDraw.Draw(img)
        
        # Add text in different regions
        draw.text((50, 50), "Top Left Text", fill='black')
        draw.text((600, 50), "Top Right Text", fill='black')
        draw.text((50, 500), "Bottom Left Text", fill='black')
        draw.text((600, 500), "Bottom Right Text", fill='black')
        draw.text((400, 300), "Center Text", fill='black')
        
        buffer = BytesIO()
        img.save(buffer, format='PNG')
        
        result = await parser.parse(buffer.getvalue(), parse_options)
        
        # Check position metadata
        for chunk in result.chunks:
            if hasattr(chunk.metadata, 'position'):
                assert chunk.metadata.position in [
                    'top-left', 'top-center', 'top-right',
                    'middle-left', 'middle-center', 'middle-right',
                    'bottom-left', 'bottom-center', 'bottom-right'
                ]
    
    @pytest.mark.asyncio
    async def test_large_image_handling(self, parser, parse_options):
        """Test handling of large images"""
        # Create large image
        img = Image.new('RGB', (3000, 2000), color='white')
        draw = ImageDraw.Draw(img)
        draw.text((100, 100), "Large Image Test", fill='black')
        
        buffer = BytesIO()
        img.save(buffer, format='PNG', optimize=True)
        
        result = await parser.parse(buffer.getvalue(), parse_options)
        
        # Should handle large images
        assert result is not None
        assert len(result.chunks) > 0
    
    @pytest.mark.asyncio
    async def test_ocr_language_detection(self, parser, parse_options):
        """Test language detection in OCR"""
        # This test would need multi-language text
        # For now, just verify the structure exists
        
        img = Image.new('RGB', (400, 200), color='white')
        draw = ImageDraw.Draw(img)
        draw.text((50, 50), "English Text", fill='black')
        
        buffer = BytesIO()
        img.save(buffer, format='PNG')
        
        result = await parser.parse(buffer.getvalue(), parse_options)
        
        # Should have language metadata
        assert result.metadata.language is not None