"""
Parser modules for different file types
"""

from typing import Dict, Type, List
import structlog

from .base import BaseParser
from .docx_parser import DOCXParser
from .pdf_parser import PDFParser
from .pptx_parser import PPTXParser
from .image_parser import ImageParser
from .text_parser import TextParser
from .markdown_parser import MarkdownParser
from .json_parser import JSONParser
from .csv_parser import CSVParser
from .html_parser import HTMLParser

logger = structlog.get_logger()


class ParserFactory:
    """Factory class to get appropriate parser for file type"""
    
    def __init__(self):
        # Store parser classes, not instances
        self.parsers: Dict[str, Type[BaseParser]] = {
            "docx": DOCXParser,
            "doc": DOCXParser,
            "pdf": PDFParser,
            "pptx": PPTXParser,
            "ppt": PPTXParser,
            "txt": TextParser,
            "text": TextParser,
            "md": MarkdownParser,
            "markdown": MarkdownParser,
            "json": JSONParser,
            "csv": CSVParser,
            "html": HTMLParser,
            "htm": HTMLParser,
            "jpg": ImageParser,
            "jpeg": ImageParser,
            "png": ImageParser,
            "gif": ImageParser,
            "bmp": ImageParser,
            "tiff": ImageParser,
            "webp": ImageParser
        }
    
    def get_parser(self, file_type: str) -> BaseParser:
        """Get parser instance for file type"""
        parser_class = self.parsers.get(file_type.lower())
        if not parser_class:
            raise ValueError(f"No parser available for file type: {file_type}")
        
        # Create new instance
        parser = parser_class()
        logger.info("parser_selected", file_type=file_type, parser=parser.__class__.__name__)
        return parser
    
    def supports_file_type(self, file_type: str) -> bool:
        """Check if file type is supported"""
        return file_type.lower() in self.parsers
    
    def get_supported_types(self) -> List[str]:
        """Get list of supported file extensions"""
        return list(self.parsers.keys())


__all__ = ["ParserFactory", "BaseParser"]