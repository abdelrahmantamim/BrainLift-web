"""
Intelligent chunking strategies using NLP
"""

from typing import Dict
import asyncio
import structlog

from .base import BaseChunker
from .simple_chunker import SimpleChunker
from .structural_chunker import StructuralChunker
from .fixed_chunker import FixedChunker

# Make spacy-based chunker optional
try:
    from .semantic_chunker import SemanticChunker
    SPACY_AVAILABLE = True
except ImportError:
    logger.warning("Spacy not available, using simple chunker instead")
    SPACY_AVAILABLE = False
    SemanticChunker = SimpleChunker

logger = structlog.get_logger()


class ChunkerFactory:
    """Factory class for chunking strategies"""
    
    def __init__(self):
        self.chunkers = {}
        self._initialized = False
        
    async def initialize(self):
        """Initialize NLP models"""
        if self._initialized:
            return
            
        logger.info("initializing_nlp_models")
        
        # Initialize chunkers
        self.chunkers = {
            "semantic": SemanticChunker() if SPACY_AVAILABLE else SimpleChunker(),
            "structural": StructuralChunker(),
            "fixed": FixedChunker(),
            "simple": SimpleChunker()
        }
        
        # Load models asynchronously
        tasks = []
        for name, chunker in self.chunkers.items():
            if hasattr(chunker, 'initialize'):
                tasks.append(chunker.initialize())
        
        if tasks:
            await asyncio.gather(*tasks)
        
        self._initialized = True
        logger.info("nlp_models_initialized")
    
    def get_chunker(self, strategy: str) -> BaseChunker:
        """Get chunker for strategy"""
        if not self._initialized:
            raise RuntimeError("ChunkerFactory not initialized. Call initialize() first.")
            
        chunker = self.chunkers.get(strategy)
        if not chunker:
            raise ValueError(f"Unknown chunking strategy: {strategy}")
            
        return chunker
    
    def is_ready(self) -> bool:
        """Check if NLP models are loaded"""
        return self._initialized


__all__ = ["ChunkerFactory", "BaseChunker"]