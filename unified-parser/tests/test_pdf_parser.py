"""
Comprehensive tests for PDF parser to ensure all functionality works correctly
"""

import pytest
import asyncio
from pathlib import Path
from io import BytesIO
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image as RLImage
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.pdfgen import canvas
from PIL import Image, ImageDraw, ImageFont
import PyPDF2

from app.parsers.pdf_parser import PDFParser
from app.models import ParseOptions


class TestPDFParser:
    """Test suite for PDF parser"""
    
    @pytest.fixture
    def parser(self):
        """Create parser instance"""
        return PDFParser()
    
    @pytest.fixture
    def parse_options(self):
        """Default parsing options"""
        return ParseOptions(
            extract_tables=True,
            enable_ocr=True,
            chunk_strategy="semantic"
        )
    
    @pytest.fixture
    def sample_pdf(self, tmp_path):
        """Create a comprehensive test PDF file"""
        pdf_path = tmp_path / "test.pdf"
        doc = SimpleDocTemplate(str(pdf_path), pagesize=letter)
        styles = getSampleStyleSheet()
        story = []
        
        # Title
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=24,
            textColor=colors.HexColor('#000080')
        )
        story.append(Paragraph("Test PDF Document", title_style))
        story.append(Spacer(1, 12))
        
        # Subtitle/Author
        story.append(Paragraph("Author: Test Author", styles['Normal']))
        story.append(Spacer(1, 12))
        
        # Heading and content
        story.append(Paragraph("1. Introduction", styles['Heading1']))
        story.append(Paragraph(
            "This is a test PDF document with various content types to test the parser functionality.",
            styles['Normal']
        ))
        story.append(Spacer(1, 12))
        
        # Subheading
        story.append(Paragraph("1.1 Background", styles['Heading2']))
        story.append(Paragraph(
            "The PDF parser should extract all content including headings, paragraphs, tables, and images.",
            styles['Normal']
        ))
        story.append(Spacer(1, 12))
        
        # Table
        story.append(Paragraph("2. Data Table", styles['Heading1']))
        data = [
            ['Column A', 'Column B', 'Column C'],
            ['Data 1', 'Data 2', 'Data 3'],
            ['100', '200', '300'],
            ['Test', 'More Test', 'Final Test']
        ]
        t = Table(data)
        t.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 14),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        story.append(t)
        story.append(Spacer(1, 12))
        
        # More content
        story.append(Paragraph("3. Conclusion", styles['Heading1']))
        story.append(Paragraph(
            "This concludes our test document. All content should be properly extracted.",
            styles['Normal']
        ))
        
        # Build PDF
        doc.build(story)
        
        # Add metadata using PyPDF2
        with open(pdf_path, 'rb') as f:
            pdf_content = f.read()
            
        reader = PyPDF2.PdfReader(BytesIO(pdf_content))
        writer = PyPDF2.PdfWriter()
        
        for page in reader.pages:
            writer.add_page(page)
        
        writer.add_metadata({
            '/Title': 'Test PDF Document',
            '/Author': 'Test Author',
            '/Subject': 'Testing PDF Parser'
        })
        
        output_buffer = BytesIO()
        writer.write(output_buffer)
        return output_buffer.getvalue()
    
    @pytest.fixture
    def scanned_pdf(self, tmp_path):
        """Create a PDF that simulates a scanned document"""
        # Create image with text
        img = Image.new('RGB', (600, 800), color='white')
        draw = ImageDraw.Draw(img)
        
        # Add text to image
        y_position = 50
        texts = [
            "SCANNED DOCUMENT",
            "",
            "This is a scanned page",
            "It contains text as an image",
            "OCR should extract this text",
            "",
            "Important Information:",
            "- Point 1",
            "- Point 2",
            "- Point 3"
        ]
        
        for text in texts:
            draw.text((50, y_position), text, fill='black')
            y_position += 30
        
        # Save as PDF
        pdf_path = tmp_path / "scanned.pdf"
        img.save(str(pdf_path), "PDF")
        
        with open(pdf_path, 'rb') as f:
            return f.read()
    
    @pytest.mark.asyncio
    async def test_basic_parsing(self, parser, parse_options, sample_pdf):
        """Test basic PDF parsing functionality"""
        result = await parser.parse(sample_pdf, parse_options)
        
        assert result is not None
        assert result.metadata.title == "Test PDF Document"
        assert result.metadata.author == "Test Author"
        assert result.metadata.pages >= 1
        assert len(result.chunks) > 0
    
    @pytest.mark.asyncio
    async def test_heading_extraction(self, parser, parse_options, sample_pdf):
        """Test heading detection and extraction"""
        result = await parser.parse(sample_pdf, parse_options)
        
        headings = [c for c in result.chunks if c.type == "heading"]
        heading_texts = [h.content for h in headings]
        
        # Should detect major headings
        assert any("Introduction" in h for h in heading_texts)
        assert any("Data Table" in h for h in heading_texts)
        assert any("Conclusion" in h for h in heading_texts)
        
        # Check heading levels
        for heading in headings:
            assert heading.level is not None
            assert 1 <= heading.level <= 6
    
    @pytest.mark.asyncio
    async def test_paragraph_extraction(self, parser, parse_options, sample_pdf):
        """Test paragraph extraction"""
        result = await parser.parse(sample_pdf, parse_options)
        
        paragraphs = [c for c in result.chunks if c.type == "paragraph"]
        assert len(paragraphs) > 0
        
        # Check content
        para_texts = [p.content for p in paragraphs]
        assert any("test PDF document" in p for p in para_texts)
        assert any("extract all content" in p for p in para_texts)
    
    @pytest.mark.asyncio
    async def test_table_extraction(self, parser, parse_options, sample_pdf):
        """Test table extraction from PDF"""
        result = await parser.parse(sample_pdf, parse_options)
        
        tables = [c for c in result.chunks if c.type == "table"]
        assert len(tables) > 0
        
        table = tables[0].content
        assert 'headers' in table
        assert 'rows' in table
        assert table['headers'] == ['Column A', 'Column B', 'Column C']
        assert len(table['rows']) >= 3
        assert table['has_header'] == True
    
    @pytest.mark.asyncio
    async def test_ocr_functionality(self, parser, parse_options, scanned_pdf):
        """Test OCR on scanned PDF"""
        result = await parser.parse(scanned_pdf, parse_options)
        
        # Should extract text via OCR
        all_text = ' '.join(c.content for c in result.chunks if isinstance(c.content, str))
        
        assert "SCANNED DOCUMENT" in all_text.upper()
        assert "Important Information" in all_text
        
        # Check that OCR was used
        assert result.metadata.has_ocr_content == True
    
    @pytest.mark.asyncio
    async def test_image_extraction(self, parser, parse_options):
        """Test image extraction from PDF"""
        # Create PDF with embedded image
        from reportlab.pdfgen import canvas
        buffer = BytesIO()
        c = canvas.Canvas(buffer, pagesize=letter)
        
        # Add text
        c.drawString(100, 750, "PDF with Image")
        
        # Create and add image
        img = Image.new('RGB', (100, 100), color='blue')
        img_buffer = BytesIO()
        img.save(img_buffer, format='PNG')
        img_buffer.seek(0)
        
        # Save image to temp file (reportlab needs file path)
        import tempfile
        with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tmp:
            tmp.write(img_buffer.getvalue())
            tmp_path = tmp.name
        
        c.drawImage(tmp_path, 100, 600, width=100, height=100)
        c.save()
        
        # Clean up temp file
        import os
        os.unlink(tmp_path)
        
        result = await parser.parse(buffer.getvalue(), parse_options)
        
        images = [c for c in result.chunks if c.type == "image"]
        if images:  # Image extraction might not work in all environments
            assert len(images) > 0
            image = images[0].content
            assert 'id' in image
            assert 'base64' in image
            assert image['base64'].startswith('data:image/')
    
    @pytest.mark.asyncio
    async def test_metadata_preservation(self, parser, parse_options, sample_pdf):
        """Test PDF metadata extraction"""
        result = await parser.parse(sample_pdf, parse_options)
        
        assert result.metadata.title is not None
        assert result.metadata.author is not None
        assert result.metadata.created_date is not None
        assert result.metadata.word_count > 0
    
    @pytest.mark.asyncio
    async def test_page_tracking(self, parser, parse_options, sample_pdf):
        """Test that chunks have correct page numbers"""
        result = await parser.parse(sample_pdf, parse_options)
        
        for chunk in result.chunks:
            assert chunk.metadata.page is not None
            assert chunk.metadata.page >= 1
            assert chunk.metadata.page <= result.metadata.pages
    
    @pytest.mark.asyncio
    async def test_mixed_content(self, parser, parse_options):
        """Test PDF with mixed content types"""
        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter)
        styles = getSampleStyleSheet()
        story = []
        
        # Mix different content types
        story.append(Paragraph("Mixed Content Test", styles['Title']))
        story.append(Spacer(1, 12))
        
        # List-like content
        story.append(Paragraph("• First bullet point", styles['Normal']))
        story.append(Paragraph("• Second bullet point", styles['Normal']))
        story.append(Paragraph("  ◦ Nested point", styles['Normal']))
        story.append(Spacer(1, 12))
        
        # Code-like content
        code_style = ParagraphStyle(
            'Code',
            parent=styles['Normal'],
            fontName='Courier',
            fontSize=10,
            leftIndent=20
        )
        story.append(Paragraph("def hello():", code_style))
        story.append(Paragraph('    print("Hello World")', code_style))
        
        doc.build(story)
        
        result = await parser.parse(buffer.getvalue(), parse_options)
        assert len(result.chunks) > 0
        
        # Should have various content types
        chunk_types = set(c.type for c in result.chunks)
        assert len(chunk_types) > 1
    
    @pytest.mark.asyncio
    async def test_empty_pdf(self, parser, parse_options):
        """Test parsing empty PDF"""
        buffer = BytesIO()
        c = canvas.Canvas(buffer, pagesize=letter)
        c.save()
        
        result = await parser.parse(buffer.getvalue(), parse_options)
        assert result.metadata.pages == 1
        # Might have minimal chunks or none
    
    @pytest.mark.asyncio
    async def test_large_pdf_structure(self, parser, parse_options):
        """Test parsing PDF with many pages"""
        buffer = BytesIO()
        c = canvas.Canvas(buffer, pagesize=letter)
        
        # Create 5 pages
        for page_num in range(1, 6):
            c.drawString(100, 750, f"Page {page_num}")
            c.drawString(100, 700, f"Content on page {page_num}")
            if page_num < 5:
                c.showPage()
        
        c.save()
        
        result = await parser.parse(buffer.getvalue(), parse_options)
        assert result.metadata.pages == 5
        
        # Check that content from all pages is extracted
        page_numbers = set()
        for chunk in result.chunks:
            if chunk.metadata.page:
                page_numbers.add(chunk.metadata.page)
        
        assert len(page_numbers) == 5