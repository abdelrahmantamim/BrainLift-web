"""
Semantic chunker - simplified version without spacy
"""

from typing import List, Dict, Any
import re
import structlog
from ..models import Chunk
from .simple_chunker import SimpleChunker

logger = structlog.get_logger()

# Just use SimpleChunker as SemanticChunker for now
class SemanticChunker(SimpleChunker):
    """Semantic chunker using simple sentence splitting"""
    
    def __init__(self, model_name: str = "en_core_web_sm"):
        super().__init__()
        logger.info("Using simplified semantic chunker without spacy")
    
    async def initialize(self):
        """No initialization needed for simple version"""
        pass
