"""
File type detection utilities
"""

import magic
from typing import Optional, BinaryIO
import io


def detect_file_type(file: BinaryIO) -> Optional[str]:
    """
    Detect file type from content using python-magic
    
    Args:
        file: File-like object
        
    Returns:
        MIME type string or None
    """
    try:
        # Read first few bytes for detection
        if hasattr(file, 'read'):
            initial_position = file.tell() if hasattr(file, 'tell') else 0
            content = file.read(1024)  # Read first 1KB
            
            # Reset file position
            if hasattr(file, 'seek'):
                file.seek(initial_position)
            
            # Detect MIME type
            mime = magic.from_buffer(content, mime=True)
            return mime
    except Exception:
        # If magic fails, return None
        return None


def get_extension_from_mime(mime_type: str) -> Optional[str]:
    """
    Get file extension from MIME type
    
    Args:
        mime_type: MIME type string
        
    Returns:
        File extension without dot or None
    """
    mime_to_ext = {
        'application/pdf': 'pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
        'application/msword': 'doc',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
        'application/vnd.ms-powerpoint': 'ppt',
        'text/plain': 'txt',
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'image/gif': 'gif',
        'image/bmp': 'bmp',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
        'application/vnd.ms-excel': 'xls'
    }
    
    return mime_to_ext.get(mime_type)