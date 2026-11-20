#!/usr/bin/env python3
"""
Fix chunk validation issues in parsers
"""

import os
import sys

# Fix for image_parser.py
image_parser_fix = '''
                        if text_blocks:
                            content = '\\n'.join(text_blocks)
                            chunks.append(Chunk(
                                id=f"{filename}_chunk_0",
                                type="text",
                                content=content,
                                metadata=ChunkMetadata(
                                    page=1,
                                    confidence=0.9
                                )
                            ))
'''

image_parser_fix2 = '''
            chunks.append(Chunk(
                id=f"{filename}_image",
                type="image",
                content=f"[Image: {filename}]",
                metadata=ChunkMetadata(
                    page=1,
                    has_image=True,
                    image_id=filename,
                    image_format="png"
                )
            ))
'''

# Fix for text_parser.py
text_parser_fix = '''
        # Create chunks from sentences
        for i, chunk_text in enumerate(sentence_chunks):
            chunks.append(Chunk(
                id=f"{filename}_chunk_{i}",
                type="paragraph",
                content=chunk_text,
                metadata=ChunkMetadata(
                    page=1
                )
            ))
'''

print("Applying fixes to parsers...")

# Read and update image_parser.py
try:
    with open('app/parsers/image_parser.py', 'r') as f:
        content = f.read()
    
    # Add imports if not present
    if 'from ..models import' in content and 'Chunk' not in content:
        content = content.replace(
            'from ..models import ParsedDocument, ParseOptions, DocumentMetadata',
            'from ..models import ParsedDocument, ParseOptions, DocumentMetadata, Chunk, ChunkMetadata'
        )
    
    # Fix chunk creation
    content = content.replace(
        '''chunks.append({
                                'id': f"{filename}_chunk_0",
                                'content': content,
                                'metadata': {
                                    'page': 1,
                                    'type': 'text',
                                    'ocr_confidence': 'high'
                                }
                            })''',
        '''chunks.append(Chunk(
                                id=f"{filename}_chunk_0",
                                type="text",
                                content=content,
                                metadata=ChunkMetadata(
                                    page=1,
                                    confidence=0.9
                                )
                            ))'''
    )
    
    content = content.replace(
        '''chunks.append({
                'id': f"{filename}_image",
                'content': f"[Image: {filename}]",
                'metadata': {
                    'page': 1,
                    'type': 'image',
                    'image_data': f"data:image/png;base64,{self._encode_base64(img_data)}",
                    'width': image.width,
                    'height': image.height
                }
            })''',
        '''chunks.append(Chunk(
                id=f"{filename}_image",
                type="image",
                content=f"[Image: {filename}]",
                metadata=ChunkMetadata(
                    page=1,
                    has_image=True,
                    image_id=filename,
                    image_format="png"
                )
            ))'''
    )
    
    with open('app/parsers/image_parser.py', 'w') as f:
        f.write(content)
    
    print("✓ Fixed image_parser.py")
except Exception as e:
    print(f"✗ Error fixing image_parser.py: {e}")

# Read and update text_parser.py
try:
    with open('app/parsers/text_parser.py', 'r') as f:
        content = f.read()
    
    # Add imports if not present
    if 'from ..models import' in content and 'Chunk' not in content:
        content = content.replace(
            'from ..models import ParsedDocument, ParseOptions, DocumentMetadata',
            'from ..models import ParsedDocument, ParseOptions, DocumentMetadata, Chunk, ChunkMetadata'
        )
    
    # Fix chunk creation - find the pattern and replace
    if 'chunks.append({' in content:
        # Replace dictionary creation with Chunk model
        import re
        pattern = r'chunks\.append\(\{[^}]+\}\)'
        
        def replace_chunk(match):
            return '''chunks.append(Chunk(
                id=f"{filename}_chunk_{i}",
                type="paragraph",
                content=chunk_text,
                metadata=ChunkMetadata(
                    page=1
                )
            ))'''
        
        # Apply fix
        content = re.sub(pattern, replace_chunk, content)
    
    with open('app/parsers/text_parser.py', 'w') as f:
        f.write(content)
    
    print("✓ Fixed text_parser.py")
except Exception as e:
    print(f"✗ Error fixing text_parser.py: {e}")

print("\nFixes applied! The parsers should now create proper Chunk objects.")