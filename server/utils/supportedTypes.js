/**
 * Supported file types configuration
 * This is automatically synced with the unified parser's capabilities
 */

// MIME type mappings for all extensions supported by the unified parser
const MIME_TYPE_MAPPINGS = {
  // Documents
  'pdf': ['application/pdf'],
  'doc': ['application/msword'],
  'docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  
  // Text files
  'txt': ['text/plain'],
  'text': ['text/plain'],
  
  // Data formats
  'csv': ['text/csv', 'application/csv'],
  'json': ['application/json', 'text/json'],
  
  // Markup
  'md': ['text/markdown', 'text/x-markdown'],
  'markdown': ['text/markdown', 'text/x-markdown'],
  'html': ['text/html', 'application/xhtml+xml'],
  'htm': ['text/html', 'application/xhtml+xml'],
  
  // Images
  'jpg': ['image/jpeg', 'image/jpg'],
  'jpeg': ['image/jpeg', 'image/jpg'],
  'png': ['image/png'],
  'gif': ['image/gif'],
  'webp': ['image/webp'],
  'bmp': ['image/bmp', 'image/x-ms-bmp'],
  'tiff': ['image/tiff'],
  'heic': ['image/heic'],
  'heif': ['image/heif'],
  
  // Presentations
  'ppt': ['application/vnd.ms-powerpoint'],
  'pptx': ['application/vnd.openxmlformats-officedocument.presentationml.presentation'],
  
  // Unsupported (but recognized)
  'xls': ['application/vnd.ms-excel'],
  'xlsx': ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
};

// Extensions supported by the unified parser
const PARSER_SUPPORTED_EXTENSIONS = [
  'docx', 'doc', 'pdf', 'pptx', 'ppt', 'txt', 'text',
  'md', 'markdown', 'json', 'csv', 'html', 'htm',
  'jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff', 'webp', 'heic', 'heif'
];

/**
 * Build SUPPORTED_TYPES object dynamically based on parser capabilities
 */
function buildSupportedTypes() {
  const supportedTypes = {};
  
  // Add all MIME types for supported extensions
  for (const [ext, mimeTypes] of Object.entries(MIME_TYPE_MAPPINGS)) {
    const isSupported = PARSER_SUPPORTED_EXTENSIONS.includes(ext);
    
    for (const mimeType of mimeTypes) {
      if (ext === 'xls' || ext === 'xlsx') {
        // Special case for Excel files
        supportedTypes[mimeType] = {
          name: 'Excel',
          supported: false,
          message: 'Excel files are not yet supported'
        };
      } else {
        supportedTypes[mimeType] = {
          name: getFileTypeName(ext),
          supported: isSupported
        };
      }
    }
  }
  
  return supportedTypes;
}

/**
 * Get user-friendly name for file type
 */
function getFileTypeName(extension) {
  const names = {
    'pdf': 'PDF',
    'doc': 'Word Document',
    'docx': 'Word Document',
    'txt': 'Text File',
    'text': 'Text File',
    'csv': 'CSV File',
    'json': 'JSON File',
    'md': 'Markdown',
    'markdown': 'Markdown',
    'html': 'HTML',
    'htm': 'HTML',
    'jpg': 'JPEG Image',
    'jpeg': 'JPEG Image',
    'png': 'PNG Image',
    'gif': 'GIF Image',
    'webp': 'WebP Image',
    'bmp': 'Bitmap Image',
    'tiff': 'TIFF Image',
    'ppt': 'PowerPoint',
    'pptx': 'PowerPoint',
    'xls': 'Excel',
    'xlsx': 'Excel'
  };
  
  return names[extension] || extension.toUpperCase();
}

/**
 * Get list of supported format names for error messages
 */
function getSupportedFormatsMessage() {
  const formats = new Set();
  
  for (const ext of PARSER_SUPPORTED_EXTENSIONS) {
    const name = getFileTypeName(ext);
    formats.add(name);
  }
  
  // Group similar formats
  const formatGroups = {
    'PDF': ['PDF'],
    'Word': ['Word Document'],
    'PowerPoint': ['PowerPoint'],
    'Text': ['Text File'],
    'Images': ['JPEG Image', 'PNG Image', 'GIF Image', 'WebP Image', 'Bitmap Image', 'TIFF Image'],
    'Data': ['CSV File', 'JSON File'],
    'Markup': ['Markdown', 'HTML']
  };
  
  const groupedFormats = [];
  for (const [group, items] of Object.entries(formatGroups)) {
    if (items.some(item => formats.has(item))) {
      groupedFormats.push(group);
    }
  }
  
  return groupedFormats.join(', ');
}

// Export the dynamically built configuration
const SUPPORTED_TYPES = buildSupportedTypes();

export {
  SUPPORTED_TYPES,
  PARSER_SUPPORTED_EXTENSIONS,
  getSupportedFormatsMessage
};