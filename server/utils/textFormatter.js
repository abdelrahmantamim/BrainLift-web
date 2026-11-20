/**
 * Formats AI response text to handle markdown-style formatting
 * Preserves markdown for frontend processing but ensures consistency
 */
function formatAIResponse(text) {
  if (!text) return text;
  
  // Standardize bold formatting: convert single * to double **
  // This handles both *text* and **text** formats
  text = text.replace(/(?<!\*)\*(?!\*)([^*\n]+)\*(?!\*)/g, '**$1**');
  
  // Ensure headers have proper spacing
  text = text.replace(/^(#{1,6})\s*(.+)$/gm, '$1 $2');
  
  // Ensure line breaks around headers
  text = text.replace(/(^|\n)(#{1,6}\s+[^\n]+)/g, '$1\n$2');
  text = text.replace(/(#{1,6}\s+[^\n]+)(\n|$)/g, '$1\n$2');
  
  return text;
}

/**
 * Converts markdown to HTML tags
 * Handles headers, bold, italic, and other common markdown
 */
function markdownToHtml(text) {
  if (!text) return text;
  
  // Convert headers (### Header -> <h3>Header</h3>)
  text = text.replace(/^#{6}\s+(.+)$/gm, '<h6>$1</h6>');
  text = text.replace(/^#{5}\s+(.+)$/gm, '<h5>$1</h5>');
  text = text.replace(/^#{4}\s+(.+)$/gm, '<h4>$1</h4>');
  text = text.replace(/^#{3}\s+(.+)$/gm, '<h3>$1</h3>');
  text = text.replace(/^#{2}\s+(.+)$/gm, '<h2>$1</h2>');
  text = text.replace(/^#\s+(.+)$/gm, '<h1>$1</h1>');
  
  // Convert bold (**text** or __text__)
  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/__([^_]+)__/g, '<strong>$1</strong>');
  
  // Convert italic (*text* or _text_)
  text = text.replace(/(?<!\*)\*(?!\*)([^*]+)\*(?!\*)/g, '<em>$1</em>');
  text = text.replace(/(?<!_)_(?!_)([^_]+)_(?!_)/g, '<em>$1</em>');
  
  // Convert line breaks
  text = text.replace(/\n/g, '<br>');
  
  return text;
}

/**
 * Parses text and extracts formatting information
 * Returns an array of { text, type } objects where type can be:
 * 'normal', 'bold', 'italic', 'h1', 'h2', 'h3', etc.
 */
function parseTextFormatting(text) {
  if (!text) return [];
  
  const parts = [];
  const lines = text.split('\n');
  
  for (const line of lines) {
    // Check if line is a header
    const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headerMatch) {
      const level = headerMatch[1].length;
      parts.push({
        text: headerMatch[2],
        type: `h${level}`,
        isHeader: true
      });
      continue;
    }
    
    // Parse inline formatting (bold, italic)
    const regex = /\*\*([^*]+)\*\*|\*([^*]+)\*/g;
    let lastIndex = 0;
    let match;
    let hasFormatting = false;
    
    while ((match = regex.exec(line)) !== null) {
      hasFormatting = true;
      
      // Add text before the formatted part
      if (match.index > lastIndex) {
        parts.push({
          text: line.substring(lastIndex, match.index),
          type: 'normal',
          isBold: false,
          isItalic: false
        });
      }
      
      // Add the formatted part
      if (match[1]) {
        // Bold (** **)
        parts.push({
          text: match[1],
          type: 'bold',
          isBold: true,
          isItalic: false
        });
      } else if (match[2]) {
        // Italic (* *)
        parts.push({
          text: match[2],
          type: 'italic',
          isBold: false,
          isItalic: true
        });
      }
      
      lastIndex = match.index + match[0].length;
    }
    
    // Add remaining text after last match or entire line if no formatting
    if (!hasFormatting) {
      if (line.trim()) {
        parts.push({
          text: line,
          type: 'normal',
          isBold: false,
          isItalic: false
        });
      }
    } else if (lastIndex < line.length) {
      parts.push({
        text: line.substring(lastIndex),
        type: 'normal',
        isBold: false,
        isItalic: false
      });
    }
  }
  
  return parts;
}

export {
  formatAIResponse,
  markdownToHtml,
  parseTextFormatting
};