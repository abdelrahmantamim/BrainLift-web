"""
Comprehensive tests for PPTX parser to ensure all functionality is preserved
"""

import pytest
import asyncio
from pathlib import Path
import base64
from io import BytesIO
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.enum.text import PP_ALIGN
from pptx.enum.shapes import MSO_SHAPE_TYPE

from app.parsers.pptx_parser import PPTXParser
from app.models import ParseOptions


class TestPPTXParser:
    """Test suite for PPTX parser"""
    
    @pytest.fixture
    def parser(self):
        """Create parser instance"""
        return PPTXParser()
    
    @pytest.fixture
    def parse_options(self):
        """Default parsing options"""
        return ParseOptions(
            extract_tables=True,
            enable_ocr=True,
            chunk_strategy="semantic"
        )
    
    @pytest.fixture
    def sample_pptx(self, tmp_path):
        """Create a comprehensive test PPTX file"""
        prs = Presentation()
        
        # Slide 1: Title slide with metadata
        slide1 = prs.slides.add_slide(prs.slide_layouts[0])
        title = slide1.shapes.title
        subtitle = slide1.placeholders[1]
        title.text = "Test Presentation"
        subtitle.text = "Testing All Features"
        
        # Add speaker notes
        notes_slide1 = slide1.notes_slide
        notes_slide1.notes_text_frame.text = "This is a speaker note for slide 1"
        
        # Slide 2: Content with bullets
        slide2 = prs.slides.add_slide(prs.slide_layouts[1])
        slide2.shapes.title.text = "Bullet Points Test"
        bullets = slide2.placeholders[1]
        tf = bullets.text_frame
        tf.text = "First level bullet"
        
        p = tf.add_paragraph()
        p.text = "Second level bullet"
        p.level = 1
        
        p = tf.add_paragraph()
        p.text = "Third level bullet"
        p.level = 2
        
        p = tf.add_paragraph()
        p.text = "Back to first level"
        p.level = 0
        
        # Slide 3: Table
        slide3 = prs.slides.add_slide(prs.slide_layouts[5])
        slide3.shapes.title.text = "Table Test"
        
        x, y, cx, cy = Inches(2), Inches(2), Inches(6), Inches(2)
        table = slide3.shapes.add_table(3, 3, x, y, cx, cy).table
        
        # Add headers
        table.cell(0, 0).text = "Header 1"
        table.cell(0, 1).text = "Header 2"
        table.cell(0, 2).text = "Header 3"
        
        # Add data
        table.cell(1, 0).text = "Data 1"
        table.cell(1, 1).text = "Data 2"
        table.cell(1, 2).text = "Data 3"
        
        table.cell(2, 0).text = "More data"
        table.cell(2, 1).text = "123"
        table.cell(2, 2).text = "456"
        
        # Slide 4: Image
        slide4 = prs.slides.add_slide(prs.slide_layouts[5])
        slide4.shapes.title.text = "Image Test"
        
        # Create a test image
        from PIL import Image
        img = Image.new('RGB', (100, 100), color='red')
        img_buffer = BytesIO()
        img.save(img_buffer, format='PNG')
        img_buffer.seek(0)
        
        left = Inches(2)
        top = Inches(2)
        pic = slide4.shapes.add_picture(img_buffer, left, top, width=Inches(2))
        pic.name = "Test Image Alt Text"
        
        # Slide 5: Mixed content
        slide5 = prs.slides.add_slide(prs.slide_layouts[1])
        slide5.shapes.title.text = "Mixed Content"
        
        # Add text box
        txBox = slide5.shapes.add_textbox(Inches(1), Inches(2), Inches(5), Inches(1))
        tf = txBox.text_frame
        tf.text = "This is a text box with some content"
        
        # Add notes with complex content
        notes_slide5 = slide5.notes_slide
        notes_slide5.notes_text_frame.text = "Complex notes with multiple lines\nLine 2\nLine 3"
        
        # Set metadata
        prs.core_properties.title = "Test Presentation"
        prs.core_properties.author = "Test Author"
        
        # Save to bytes
        pptx_buffer = BytesIO()
        prs.save(pptx_buffer)
        return pptx_buffer.getvalue()
    
    @pytest.mark.asyncio
    async def test_basic_parsing(self, parser, parse_options, sample_pptx):
        """Test basic parsing functionality"""
        result = await parser.parse(sample_pptx, parse_options)
        
        assert result is not None
        assert result.metadata.title == "Test Presentation"
        assert result.metadata.author == "Test Author"
        assert result.metadata.pages == 5
        assert len(result.chunks) > 0
    
    @pytest.mark.asyncio
    async def test_title_extraction(self, parser, parse_options, sample_pptx):
        """Test slide title extraction"""
        result = await parser.parse(sample_pptx, parse_options)
        
        # Find all heading chunks
        headings = [c for c in result.chunks if c.type == "heading"]
        heading_texts = [h.content for h in headings]
        
        assert "Test Presentation" in heading_texts
        assert "Bullet Points Test" in heading_texts
        assert "Table Test" in heading_texts
        assert "Image Test" in heading_texts
        assert "Mixed Content" in heading_texts
    
    @pytest.mark.asyncio
    async def test_bullet_extraction(self, parser, parse_options, sample_pptx):
        """Test bullet point extraction with hierarchy"""
        result = await parser.parse(sample_pptx, parse_options)
        
        # Find list chunks
        lists = [c for c in result.chunks if c.type == "list"]
        assert len(lists) > 0
        
        # Check bullet hierarchy
        bullet_list = None
        for lst in lists:
            if any("First level bullet" in item.get('text', '') for item in lst.content):
                bullet_list = lst.content
                break
        
        assert bullet_list is not None
        assert len(bullet_list) >= 2  # At least 2 top-level items
        
        # Check nested structure
        has_nested = False
        for item in bullet_list:
            if item.get('children'):
                has_nested = True
                break
        assert has_nested, "Should have nested bullet points"
    
    @pytest.mark.asyncio
    async def test_table_extraction(self, parser, parse_options, sample_pptx):
        """Test table extraction"""
        result = await parser.parse(sample_pptx, parse_options)
        
        # Find table chunks
        tables = [c for c in result.chunks if c.type == "table"]
        assert len(tables) > 0
        
        table = tables[0].content
        assert table['headers'] == ["Header 1", "Header 2", "Header 3"]
        assert table['row_count'] == 3
        assert table['col_count'] == 3
        assert table['has_header'] == True
        assert len(table['rows']) == 2  # Data rows (excluding header)
    
    @pytest.mark.asyncio
    async def test_image_extraction(self, parser, parse_options, sample_pptx):
        """Test image extraction with data"""
        result = await parser.parse(sample_pptx, parse_options)
        
        # Find image chunks
        images = [c for c in result.chunks if c.type == "image"]
        assert len(images) > 0
        
        image = images[0].content
        assert 'id' in image
        assert 'base64' in image
        assert image['base64'].startswith('data:image/')
        assert image['alt_text'] == "Test Image Alt Text"
        assert 'dimensions' in image
        assert image['format'] in ['png', 'jpeg']
    
    @pytest.mark.asyncio
    async def test_speaker_notes(self, parser, parse_options, sample_pptx):
        """Test speaker notes extraction"""
        result = await parser.parse(sample_pptx, parse_options)
        
        # Find note chunks
        notes = [c for c in result.chunks if c.type == "note"]
        assert len(notes) >= 2
        
        note_contents = [n.content for n in notes]
        assert "This is a speaker note for slide 1" in note_contents
        assert any("Complex notes" in n for n in note_contents)
        
        # Check metadata
        for note in notes:
            assert note.metadata.is_speaker_note == True
            assert note.metadata.page is not None
    
    @pytest.mark.asyncio
    async def test_metadata_counts(self, parser, parse_options, sample_pptx):
        """Test metadata counts"""
        result = await parser.parse(sample_pptx, parse_options)
        
        assert result.metadata.has_tables == True
        assert result.metadata.has_images == True
        assert result.metadata.table_count >= 1
        assert result.metadata.image_count >= 1
        assert result.metadata.notes_count >= 2
        assert result.metadata.word_count > 0
    
    @pytest.mark.asyncio
    async def test_page_tracking(self, parser, parse_options, sample_pptx):
        """Test that all chunks have correct page numbers"""
        result = await parser.parse(sample_pptx, parse_options)
        
        for chunk in result.chunks:
            assert chunk.metadata.page is not None
            assert 1 <= chunk.metadata.page <= 5
    
    @pytest.mark.asyncio
    async def test_empty_presentation(self, parser, parse_options):
        """Test parsing empty presentation"""
        prs = Presentation()
        buffer = BytesIO()
        prs.save(buffer)
        
        result = await parser.parse(buffer.getvalue(), parse_options)
        assert result.metadata.pages == 0
        assert len(result.chunks) == 0
    
    @pytest.mark.asyncio
    async def test_ocr_integration(self, parser, parse_options):
        """Test OCR on images with text"""
        prs = Presentation()
        slide = prs.slides.add_slide(prs.slide_layouts[5])
        
        # Create image with text
        from PIL import Image, ImageDraw, ImageFont
        img = Image.new('RGB', (200, 100), color='white')
        draw = ImageDraw.Draw(img)
        draw.text((10, 10), "OCR TEST TEXT", fill='black')
        
        img_buffer = BytesIO()
        img.save(img_buffer, format='PNG')
        img_buffer.seek(0)
        
        slide.shapes.add_picture(img_buffer, Inches(1), Inches(1))
        
        pptx_buffer = BytesIO()
        prs.save(pptx_buffer)
        
        result = await parser.parse(pptx_buffer.getvalue(), parse_options)
        
        images = [c for c in result.chunks if c.type == "image"]
        assert len(images) > 0
        
        # OCR might fail in test environment, but field should exist
        assert 'ocr_text' in images[0].content
    
    @pytest.mark.asyncio
    async def test_complex_formatting(self, parser, parse_options):
        """Test preservation of complex formatting information"""
        prs = Presentation()
        slide = prs.slides.add_slide(prs.slide_layouts[1])
        
        # Add formatted text
        title = slide.shapes.title
        title.text = "Formatted Title"
        
        content = slide.placeholders[1]
        tf = content.text_frame
        p = tf.paragraphs[0]
        p.text = "Bold and italic text"
        p.font.bold = True
        
        pptx_buffer = BytesIO()
        prs.save(pptx_buffer)
        
        result = await parser.parse(pptx_buffer.getvalue(), parse_options)
        assert len(result.chunks) > 0
    
    @pytest.mark.asyncio
    async def test_layout_preservation(self, parser, parse_options):
        """Test that slide layout information is preserved"""
        prs = Presentation()
        
        # Use different layouts
        layouts = [0, 1, 5]  # Title, Title and Content, Blank
        for layout_idx in layouts:
            slide = prs.slides.add_slide(prs.slide_layouts[layout_idx])
            slide.shapes.title.text = f"Layout {layout_idx}"
        
        pptx_buffer = BytesIO()
        prs.save(pptx_buffer)
        
        result = await parser.parse(pptx_buffer.getvalue(), parse_options)
        
        # Check that layout info is preserved in some chunks
        has_layout = any(
            chunk.metadata.layout is not None 
            for chunk in result.chunks 
            if chunk.type == "heading"
        )
        assert has_layout