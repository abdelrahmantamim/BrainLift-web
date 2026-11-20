"""
CSV Parser - Parses CSV files as tables
"""

import csv
import io
from typing import Dict, Any, List, Optional
import structlog
import chardet

from ..models import ParsedDocument, ParseOptions, DocumentMetadata, Chunk, ChunkMetadata
from .base import BaseParser

logger = structlog.get_logger()


class CSVParser(BaseParser):
    """Parser for CSV files"""
    
    async def parse(
        self, 
        file: Any, 
        filename: str, 
        options: Optional[ParseOptions] = None
    ) -> ParsedDocument:
        """Parse CSV file"""
        options = options or ParseOptions()
        
        try:
            # Read file content
            if hasattr(file, 'read'):
                content = file.read()
                if hasattr(file, 'seek'):
                    file.seek(0)
            else:
                content = file
            
            # Detect encoding
            if isinstance(content, bytes):
                detected = chardet.detect(content)
                encoding = detected['encoding'] or 'utf-8'
                text = content.decode(encoding, errors='ignore')
            else:
                text = content
            
            # Parse CSV
            csv_reader = csv.reader(io.StringIO(text))
            rows = list(csv_reader)
            
            if not rows:
                return ParsedDocument(
                    content="",
                    chunks=[],
                    metadata=DocumentMetadata(
                        title=filename,
                        page_count=1,
                        word_count=0
                    )
                )
            
            # Detect if first row is headers
            has_header = self._detect_header(rows)
            
            # Extract headers and data
            if has_header and len(rows) > 1:
                headers = rows[0]
                data_rows = rows[1:]
            else:
                # Generate generic headers
                headers = [f"Column {i+1}" for i in range(len(rows[0]))] if rows else []
                data_rows = rows
            
            # Create chunks
            chunks = []
            
            # Add the full table as a chunk
            table_data = {
                'headers': headers,
                'rows': data_rows,
                'has_header': has_header
            }
            
            chunks.append(Chunk(
                id=f"{filename}_table",
                type="table",
                content=table_data,
                metadata=ChunkMetadata(
                    page=1,
                    section="Full Table",
                    has_table=True,
                    table_rows=len(data_rows),
                    table_cols=len(headers)
                )
            ))
            
            # Create smaller chunks for large tables
            if len(data_rows) > options.chunk_size:
                chunk_id = 0
                for i in range(0, len(data_rows), options.chunk_size):
                    chunk_rows = data_rows[i:i + options.chunk_size]
                    chunks.append(Chunk(
                        id=f"{filename}_chunk_{chunk_id}",
                        type="table",
                        content={
                            'headers': headers,
                            'rows': chunk_rows,
                            'has_header': True
                        },
                        metadata=ChunkMetadata(
                            page=1,
                            section=f"Rows {i+1}-{min(i+options.chunk_size, len(data_rows))}",
                            has_table=True,
                            table_rows=len(chunk_rows),
                            table_cols=len(headers)
                        )
                    ))
                    chunk_id += 1
            
            # Add summary statistics if numeric data is present
            stats = self._calculate_statistics(headers, data_rows)
            if stats:
                chunks.append(Chunk(
                    id=f"{filename}_stats",
                    type="metadata",
                    content=stats,
                    metadata=ChunkMetadata(
                        page=1,
                        section="Statistics"
                    )
                ))
            
            # Calculate word count
            word_count = sum(len(str(cell).split()) for row in rows for cell in row)
            
            # Create metadata
            metadata = DocumentMetadata(
                title=filename,
                page_count=1,
                word_count=word_count,
                has_tables=True,
                table_count=1
            )
            
            # Create a text representation for content
            text_content = self._create_text_representation(headers, data_rows, has_header)
            
            return ParsedDocument(
                content=text_content,
                chunks=chunks,
                metadata=metadata,
                tables=[table_data]
            )
            
        except Exception as e:
            logger.error(f"Error parsing CSV {filename}: {str(e)}")
            raise
    
    def _detect_header(self, rows: List[List[str]]) -> bool:
        """Detect if the first row contains headers"""
        if len(rows) < 2:
            return False
        
        first_row = rows[0]
        second_row = rows[1] if len(rows) > 1 else []
        
        # Check if first row has different characteristics than data rows
        # Headers are usually strings and not numeric
        first_row_numeric = sum(1 for cell in first_row if self._is_numeric(cell))
        second_row_numeric = sum(1 for cell in second_row if self._is_numeric(cell))
        
        # If first row has significantly fewer numeric values, it's likely headers
        if second_row and first_row_numeric < second_row_numeric * 0.5:
            return True
        
        # Check if all values in first row are unique (common for headers)
        if len(set(first_row)) == len(first_row) and len(first_row) > 1:
            return True
        
        return False
    
    def _is_numeric(self, value: str) -> bool:
        """Check if a string value is numeric"""
        try:
            float(value.replace(',', ''))
            return True
        except ValueError:
            return False
    
    def _calculate_statistics(self, headers: List[str], rows: List[List[str]]) -> Optional[Dict[str, Any]]:
        """Calculate basic statistics for numeric columns"""
        if not rows:
            return None
        
        stats = {}
        
        for col_idx, header in enumerate(headers):
            values = []
            for row in rows:
                if col_idx < len(row):
                    try:
                        value = float(row[col_idx].replace(',', ''))
                        values.append(value)
                    except ValueError:
                        pass
            
            if values and len(values) > len(rows) * 0.5:  # At least 50% numeric
                stats[header] = {
                    'count': len(values),
                    'min': min(values),
                    'max': max(values),
                    'avg': sum(values) / len(values),
                    'sum': sum(values)
                }
        
        return stats if stats else None
    
    def _create_text_representation(self, headers: List[str], rows: List[List[str]], has_header: bool) -> str:
        """Create a text representation of the CSV data"""
        lines = []
        
        if has_header:
            lines.append("Headers: " + ", ".join(headers))
            lines.append("-" * 50)
        
        lines.append(f"Total rows: {len(rows)}")
        lines.append(f"Total columns: {len(headers)}")
        lines.append("-" * 50)
        
        # Show first few rows as preview
        preview_rows = min(10, len(rows))
        if preview_rows > 0:
            lines.append("Data preview (first 10 rows):")
            for i in range(preview_rows):
                row_text = " | ".join(str(cell) for cell in rows[i][:10])  # Limit columns too
                if len(rows[i]) > 10:
                    row_text += " | ..."
                lines.append(f"Row {i+1}: {row_text}")
        
        return "\n".join(lines)