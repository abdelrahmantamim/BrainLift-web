"""
JSON Parser - Parses JSON files with structure preservation
"""

import json
from typing import Dict, Any, List, Optional
import structlog

from ..models import ParsedDocument, ParseOptions, DocumentMetadata, Chunk, ChunkMetadata
from .base import BaseParser

logger = structlog.get_logger()


class JSONParser(BaseParser):
    """Parser for JSON files"""
    
    async def parse(
        self, 
        file: Any, 
        filename: str, 
        options: Optional[ParseOptions] = None
    ) -> ParsedDocument:
        """Parse JSON file"""
        options = options or ParseOptions()
        
        try:
            # Read file content
            if hasattr(file, 'read'):
                content = file.read()
                if hasattr(file, 'seek'):
                    file.seek(0)
            else:
                content = file
            
            # Decode content
            if isinstance(content, bytes):
                text = content.decode('utf-8', errors='ignore')
            else:
                text = content
            
            # Parse JSON
            try:
                data = json.loads(text)
            except json.JSONDecodeError as e:
                logger.error(f"Invalid JSON in {filename}: {e}")
                # Still create a chunk with the raw content
                return ParsedDocument(
                    content=text,
                    chunks=[
                        Chunk(
                            id=f"{filename}_chunk_0",
                            type="text",
                            content=f"Invalid JSON: {str(e)}\n\nRaw content:\n{text[:1000]}...",
                            metadata=ChunkMetadata(
                                page=1,
                                section="Error"
                            )
                        )
                    ],
                    metadata=DocumentMetadata(
                        title=filename,
                        page_count=1,
                        word_count=len(text.split())
                    )
                )
            
            # Convert JSON to chunks
            chunks = []
            chunk_id = 0
            
            # Process the JSON structure
            def process_value(key: str, value: Any, path: str = "", level: int = 0):
                nonlocal chunk_id
                
                if isinstance(value, dict):
                    # Create a chunk for the object
                    chunks.append(Chunk(
                        id=f"{filename}_chunk_{chunk_id}",
                        type="object",
                        level=level,
                        content={key: value} if key else value,
                        metadata=ChunkMetadata(
                            page=1,
                            section=path or "root"
                        )
                    ))
                    chunk_id += 1
                    
                    # Process nested values
                    for k, v in value.items():
                        new_path = f"{path}.{k}" if path else k
                        process_value(k, v, new_path, level + 1)
                
                elif isinstance(value, list):
                    # Create a chunk for arrays
                    chunks.append(Chunk(
                        id=f"{filename}_chunk_{chunk_id}",
                        type="array",
                        level=level,
                        content={key: value} if key else value,
                        metadata=ChunkMetadata(
                            page=1,
                            section=path or "root"
                        )
                    ))
                    chunk_id += 1
                    
                    # Process array items if they're complex
                    for i, item in enumerate(value):
                        if isinstance(item, (dict, list)):
                            new_path = f"{path}[{i}]"
                            process_value(f"[{i}]", item, new_path, level + 1)
                
                else:
                    # Primitive value
                    chunks.append(Chunk(
                        id=f"{filename}_chunk_{chunk_id}",
                        type="value",
                        level=level,
                        content={key: value} if key else str(value),
                        metadata=ChunkMetadata(
                            page=1,
                            section=path or "root"
                        )
                    ))
                    chunk_id += 1
            
            # Start processing from root
            process_value("", data)
            
            # Also create a formatted text chunk for better readability
            formatted_json = json.dumps(data, indent=2, ensure_ascii=False)
            chunks.insert(0, Chunk(
                id=f"{filename}_chunk_formatted",
                type="code",
                content=formatted_json,
                metadata=ChunkMetadata(
                    page=1,
                    section="Formatted JSON",
                    language="json"
                )
            ))
            
            # Extract any tables if present (arrays of objects with consistent keys)
            tables = self._extract_tables_from_json(data)
            
            # Create metadata
            metadata = DocumentMetadata(
                title=filename,
                page_count=1,
                word_count=len(formatted_json.split()),
                has_tables=len(tables) > 0,
                table_count=len(tables)
            )
            
            return ParsedDocument(
                content=formatted_json,
                chunks=chunks,
                metadata=metadata,
                tables=tables
            )
            
        except Exception as e:
            logger.error(f"Error parsing JSON {filename}: {str(e)}")
            raise
    
    def _extract_tables_from_json(self, data: Any) -> List[Dict[str, Any]]:
        """Extract table-like structures from JSON (arrays of objects)"""
        tables = []
        
        def find_tables(obj: Any, path: str = ""):
            if isinstance(obj, list) and len(obj) > 0:
                # Check if it's an array of objects with consistent keys
                if all(isinstance(item, dict) for item in obj):
                    # Get all keys from all objects
                    all_keys = set()
                    for item in obj:
                        all_keys.update(item.keys())
                    
                    # Check if at least 50% of objects have the same keys
                    key_consistency = sum(
                        1 for item in obj 
                        if len(set(item.keys()) & all_keys) >= len(all_keys) * 0.5
                    ) / len(obj)
                    
                    if key_consistency >= 0.7:  # 70% consistency threshold
                        # This looks like a table
                        headers = sorted(list(all_keys))
                        rows = []
                        for item in obj:
                            row = [str(item.get(key, "")) for key in headers]
                            rows.append(row)
                        
                        tables.append({
                            'headers': headers,
                            'rows': rows,
                            'path': path,
                            'has_header': True
                        })
            
            elif isinstance(obj, dict):
                for key, value in obj.items():
                    new_path = f"{path}.{key}" if path else key
                    find_tables(value, new_path)
        
        find_tables(data)
        return tables