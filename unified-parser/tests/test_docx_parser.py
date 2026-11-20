"""
Comprehensive tests for DOCX parser to ensure all functionality works correctly
"""

import pytest
import asyncio
from pathlib import Path
from io import BytesIO
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.style import WD_STYLE_TYPE
from PIL import Image, ImageDraw

from app.parsers.docx_parser import DOCXParser
from app.models import ParseOptions


class TestDOCXParser:
    """Test suite for DOCX parser"""
    
    @pytest.fixture
    def parser(self):
        """Create parser instance"""
        return DOCXParser()
    
    @pytest.fixture
    def parse_options(self):
        """Default parsing options"""
        return ParseOptions(
            extract_tables=True,
            enable_ocr=True,
            chunk_strategy="semantic"
        )
    
    @pytest.fixture
    def sample_docx(self, tmp_path):
        """Create a comprehensive test DOCX file"""
        doc = Document()
        
        # Set document properties
        core_props = doc.core_properties
        core_props.title = "Test Document"
        core_props.author = "Test Author"
        
        # Title
        title = doc.add_heading('Test DOCX Document', 0)
        
        # Introduction section
        doc.add_heading('1. Introduction', level=1)
        para = doc.add_paragraph('This is a test document with various content types.')
        para.add_run(' This sentence is bold.').bold = True
        para.add_run(' This sentence is italic.').italic = True
        
        # Subheading
        doc.add_heading('1.1 Background Information', level=2)
        doc.add_paragraph(
            'The DOCX parser should handle all document elements including '
            'headings, paragraphs, lists, tables, and images.'
        )
        
        # Lists
        doc.add_heading('2. Features', level=1)
        doc.add_paragraph('The parser supports:', style='List Bullet')
        doc.add_paragraph('Text extraction', style='List Bullet')
        doc.add_paragraph('Table parsing', style='List Bullet')
        doc.add_paragraph('Image detection', style='List Bullet')
        doc.add_paragraph('Nested bullets:', style='List Bullet')
        
        # Numbered list
        doc.add_paragraph('Processing steps:', style='List Number')
        doc.add_paragraph('Open document', style='List Number')
        doc.add_paragraph('Extract content', style='List Number')
        doc.add_paragraph('Parse structure', style='List Number')
        
        # Table
        doc.add_heading('3. Data Table', level=1)
        table = doc.add_table(rows=4, cols=3)
        table.style = 'Light Grid Accent 1'
        
        # Add headers
        hdr_cells = table.rows[0].cells
        hdr_cells[0].text = 'Name'
        hdr_cells[1].text = 'Value'
        hdr_cells[2].text = 'Description'
        
        # Add data
        data_rows = [
            ('Feature A', '100', 'First feature'),
            ('Feature B', '200', 'Second feature'),
            ('Feature C', '300', 'Third feature')
        ]
        
        for i, (name, value, desc) in enumerate(data_rows, 1):
            row_cells = table.rows[i].cells
            row_cells[0].text = name
            row_cells[1].text = value
            row_cells[2].text = desc
        
        # Add page break
        doc.add_page_break()
        
        # Second page with image
        doc.add_heading('4. Visual Content', level=1)
        doc.add_paragraph('Below is an embedded image:')
        
        # Create test image
        img = Image.new('RGB', (200, 100), color='lightblue')
        draw = ImageDraw.Draw(img)
        draw.text((50, 40), "Test Image", fill='black')
        
        img_buffer = BytesIO()
        img.save(img_buffer, format='PNG')
        img_buffer.seek(0)
        
        # Add image with alt text
        picture = doc.add_picture(img_buffer, width=Inches(2))
        picture._inline.docPr.set('descr', 'Test image with text')
        
        # More content
        doc.add_heading('5. Conclusion', level=1)
        doc.add_paragraph('This document demonstrates all major features.')
        
        # Complex nested structure
        doc.add_heading('5.1 Summary', level=2)
        doc.add_paragraph('Key points covered in this document.')
        
        doc.add_heading('5.1.1 Technical Details', level=3)
        doc.add_paragraph('Additional technical information.')
        
        # Save to bytes
        docx_buffer = BytesIO()
        doc.save(docx_buffer)
        return docx_buffer.getvalue()
    
    @pytest.mark.asyncio
    async def test_basic_parsing(self, parser, parse_options, sample_docx):
        """Test basic parsing functionality"""
        result = await parser.parse(sample_docx, parse_options)
        
        assert result is not None
        assert result.metadata.title == "Test Document"
        assert result.metadata.author == "Test Author"
        assert result.metadata.pages >= 2
        assert len(result.chunks) > 0
    
    @pytest.mark.asyncio
    async def test_heading_extraction(self, parser, parse_options, sample_docx):
        """Test heading extraction with levels"""
        result = await parser.parse(sample_docx, parse_options)
        
        headings = [c for c in result.chunks if c.type == "heading"]
        assert len(headings) > 0
        
        # Check heading texts
        heading_texts = [h.content for h in headings]
        assert "Test DOCX Document" in heading_texts
        assert "1. Introduction" in heading_texts
        assert "1.1 Background Information" in heading_texts
        assert "5.1.1 Technical Details" in heading_texts
        
        # Check heading levels
        level_1_headings = [h for h in headings if h.level == 1]
        level_2_headings = [h for h in headings if h.level == 2]
        level_3_headings = [h for h in headings if h.level == 3]
        
        assert len(level_1_headings) > 0
        assert len(level_2_headings) > 0
        assert len(level_3_headings) > 0
    
    @pytest.mark.asyncio
    async def test_paragraph_extraction(self, parser, parse_options, sample_docx):
        """Test paragraph extraction with formatting"""
        result = await parser.parse(sample_docx, parse_options)
        
        paragraphs = [c for c in result.chunks if c.type == "paragraph"]
        assert len(paragraphs) > 0
        
        # Check content
        para_texts = [p.content for p in paragraphs]
        assert any("test document" in p for p in para_texts)
        assert any("bold" in p for p in para_texts)
        assert any("italic" in p for p in para_texts)
        
        # Check formatting metadata
        formatted_paras = [
            p for p in paragraphs 
            if p.metadata.has_bold or p.metadata.has_italic
        ]
        assert len(formatted_paras) > 0
    
    @pytest.mark.asyncio
    async def test_list_extraction(self, parser, parse_options, sample_docx):
        """Test list extraction"""
        result = await parser.parse(sample_docx, parse_options)
        
        # Find list items
        list_items = [c for c in result.chunks if c.type == "list_item"]
        if not list_items:
            # Might be grouped as list chunks
            lists = [c for c in result.chunks if c.type == "list"]
            assert len(lists) > 0
            
            # Check list content
            for lst in lists:
                assert isinstance(lst.content, list)
                assert len(lst.content) > 0
                
                # Check for bullet and numbered lists
                if lst.metadata.list_type:
                    assert lst.metadata.list_type in ['bullet', 'number']
    
    @pytest.mark.asyncio
    async def test_table_extraction(self, parser, parse_options, sample_docx):
        """Test table extraction"""
        result = await parser.parse(sample_docx, parse_options)
        
        tables = [c for c in result.chunks if c.type == "table"]
        assert len(tables) > 0
        
        table = tables[0].content
        assert 'headers' in table
        assert 'rows' in table
        assert table['headers'] == ['Name', 'Value', 'Description']
        assert len(table['rows']) == 3
        assert table['summary'] is not None
        
        # Check metadata
        assert tables[0].metadata.table_rows == 3
        assert tables[0].metadata.table_cols == 3
    
    @pytest.mark.asyncio
    async def test_image_extraction(self, parser, parse_options, sample_docx):
        """Test image extraction with alt text"""
        result = await parser.parse(sample_docx, parse_options)
        
        images = [c for c in result.chunks if c.type == "image"]
        assert len(images) > 0
        
        image = images[0].content
        assert 'id' in image
        assert 'base64' in image
        assert image['base64'].startswith('data:image/')
        assert image['alt_text'] == 'Test image with text'
        assert 'dimensions' in image
        assert image['dimensions']['width'] > 0
        assert image['dimensions']['height'] > 0
    
    @pytest.mark.asyncio
    async def test_hierarchical_structure(self, parser, parse_options, sample_docx):
        """Test preservation of document hierarchy"""
        result = await parser.parse(sample_docx, parse_options)
        
        # Check parent-child relationships
        headings = {c.id: c for c in result.chunks if c.type == "heading"}
        
        # Find paragraphs with parent headings
        paras_with_parents = [
            c for c in result.chunks 
            if c.type == "paragraph" and c.parent_id
        ]
        assert len(paras_with_parents) > 0
        
        # Verify parent exists
        for para in paras_with_parents:
            assert para.parent_id in headings
    
    @pytest.mark.asyncio
    async def test_metadata_section_path(self, parser, parse_options, sample_docx):
        """Test section path in metadata"""
        result = await parser.parse(sample_docx, parse_options)
        
        # Find deep heading
        deep_heading = None
        for chunk in result.chunks:
            if chunk.type == "heading" and "5.1.1" in chunk.content:
                deep_heading = chunk
                break
        
        assert deep_heading is not None
        assert deep_heading.metadata.section_path is not None
        # Should show parent sections
        assert "Conclusion" in deep_heading.metadata.section_path or "Summary" in deep_heading.metadata.section_path
    
    @pytest.mark.asyncio
    async def test_page_estimation(self, parser, parse_options, sample_docx):
        """Test page count estimation"""
        result = await parser.parse(sample_docx, parse_options)
        
        assert result.metadata.pages >= 1
        
        # All chunks should have page numbers
        for chunk in result.chunks:
            assert chunk.metadata.page is not None
            assert chunk.metadata.page >= 1
    
    @pytest.mark.asyncio
    async def test_empty_document(self, parser, parse_options):
        """Test parsing empty document"""
        doc = Document()
        buffer = BytesIO()
        doc.save(buffer)
        
        result = await parser.parse(buffer.getvalue(), parse_options)
        assert result.metadata.pages == 1
        assert result.metadata.word_count == 0
    
    @pytest.mark.asyncio
    async def test_complex_formatting(self, parser, parse_options):
        """Test complex formatting scenarios"""
        doc = Document()
        
        # Add paragraph with multiple formatting
        para = doc.add_paragraph()
        para.add_run('Normal text ')
        para.add_run('bold and italic').bold = True
        para.add_run(' text').italic = True
        
        # Add colored text
        run = para.add_run(' colored text')
        run.font.color.rgb = RGBColor(255, 0, 0)
        
        buffer = BytesIO()
        doc.save(buffer)
        
        result = await parser.parse(buffer.getvalue(), parse_options)
        assert len(result.chunks) > 0
    
    @pytest.mark.asyncio
    async def test_nested_tables(self, parser, parse_options):
        """Test document with multiple tables"""
        doc = Document()
        
        # Add multiple tables
        for i in range(3):
            doc.add_heading(f'Table {i+1}', level=2)
            table = doc.add_table(rows=2, cols=2)
            table.rows[0].cells[0].text = f'T{i+1}-H1'
            table.rows[0].cells[1].text = f'T{i+1}-H2'
            table.rows[1].cells[0].text = f'Data {i+1}'
            table.rows[1].cells[1].text = f'Value {i+1}'
            doc.add_paragraph('')  # Space between tables
        
        buffer = BytesIO()
        doc.save(buffer)
        
        result = await parser.parse(buffer.getvalue(), parse_options)
        
        tables = [c for c in result.chunks if c.type == "table"]
        assert len(tables) == 3
        
        # Each table should have parent heading
        tables_with_parents = [t for t in tables if t.parent_id]
        assert len(tables_with_parents) > 0
    
    @pytest.mark.asyncio
    async def test_special_characters(self, parser, parse_options):
        """Test handling of special characters"""
        doc = Document()
        
        # Add content with special characters
        doc.add_paragraph('Special characters: © ® ™ € £ ¥')
        doc.add_paragraph('Unicode: 你好 مرحبا שלום')
        doc.add_paragraph('Math symbols: ∑ ∏ ∫ √ ∞')
        
        buffer = BytesIO()
        doc.save(buffer)
        
        result = await parser.parse(buffer.getvalue(), parse_options)
        
        # Should preserve special characters
        all_text = ' '.join(
            c.content for c in result.chunks 
            if isinstance(c.content, str)
        )
        
        assert '©' in all_text
        assert '∑' in all_text
        assert '你好' in all_text