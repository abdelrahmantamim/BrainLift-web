const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');
const { v4: uuidv4 } = require('uuid');

class MarkItDownService {
  constructor() {
    // Check for MarkItDown in common locations
    this.markitdownPath = process.env.MARKITDOWN_PATH || '/Users/abdelrahmantamim/.local/bin/markitdown';
    this.pythonPath = process.env.PYTHON_PATH || 'python3';
    this.serviceName = 'MarkItDown';
    this.isAvailable = null;
    this.lastHealthCheck = null;
    this.healthCheckInterval = 60000; // 1 minute
  }

  async checkHealth() {
    // Cache health check results
    if (this.lastHealthCheck && Date.now() - this.lastHealthCheck < this.healthCheckInterval) {
      return this.isAvailable;
    }

    try {
      // Try direct execution first
      const result = await this.executeDirectCommand(['--version']);
      this.isAvailable = result.includes('markitdown') || result.includes('MarkItDown');
      this.lastHealthCheck = Date.now();
      
      if (this.isAvailable) {
        console.log('[MarkItDown] Service available via direct path');
      } else {
        // Fallback to python module
        const moduleResult = await this.executePythonCommand(['--version']);
        this.isAvailable = moduleResult.includes('markitdown') || moduleResult.includes('MarkItDown');
        if (this.isAvailable) {
          console.log('[MarkItDown] Service available via python module');
        } else {
          console.log('[MarkItDown] Service not installed');
        }
      }
      
      return this.isAvailable;
    } catch (error) {
      console.log('[MarkItDown] Service check failed:', error.message);
      this.isAvailable = false;
      this.lastHealthCheck = Date.now();
      return false;
    }
  }

  async executeDirectCommand(args, inputFile = null) {
    return new Promise((resolve, reject) => {
      const fullArgs = [...args];
      if (inputFile) {
        fullArgs.push(inputFile);
      }

      const process = spawn(this.markitdownPath, fullArgs);
      let stdout = '';
      let stderr = '';

      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      process.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`MarkItDown process exited with code ${code}: ${stderr}`));
        } else {
          resolve(stdout);
        }
      });

      process.on('error', (error) => {
        reject(new Error(`Failed to start MarkItDown: ${error.message}`));
      });
    });
  }

  async executePythonCommand(args, inputFile = null) {
    return new Promise((resolve, reject) => {
      const fullArgs = ['-m', 'markitdown', ...args];
      if (inputFile) {
        fullArgs.push(inputFile);
      }

      const process = spawn(this.pythonPath, fullArgs);
      let stdout = '';
      let stderr = '';

      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      process.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`MarkItDown process exited with code ${code}: ${stderr}`));
        } else {
          resolve(stdout);
        }
      });

      process.on('error', (error) => {
        reject(new Error(`Failed to start MarkItDown: ${error.message}`));
      });
    });
  }

  async executeCommand(args, inputFile = null) {
    // Try direct path first
    try {
      return await this.executeDirectCommand(args, inputFile);
    } catch (error) {
      // Fallback to python module
      return await this.executePythonCommand(args, inputFile);
    }
  }

  async convertToMarkdown(buffer, fileName, mimeType) {
    try {
      // Check if service is available
      const isHealthy = await this.checkHealth();
      if (!isHealthy) {
        throw new Error('MarkItDown service is not available');
      }

      // Create temporary file
      const tempDir = os.tmpdir();
      const tempFileName = `${uuidv4()}_${fileName}`;
      const tempFilePath = path.join(tempDir, tempFileName);

      // Write buffer to temp file
      await fs.writeFile(tempFilePath, buffer);

      try {
        // Convert using MarkItDown
        console.log(`[MarkItDown] Converting ${fileName}`);
        const markdown = await this.executeCommand([], tempFilePath);

        // Parse the output to extract content and metadata
        const result = this.parseMarkdownOutput(markdown, fileName);

        console.log(`[MarkItDown] Conversion successful:`, {
          fileName,
          contentLength: result.content.length,
          hasMetadata: !!result.metadata
        });

        return result;
      } finally {
        // Clean up temp file
        try {
          await fs.unlink(tempFilePath);
        } catch (err) {
          console.warn(`[MarkItDown] Failed to delete temp file: ${tempFilePath}`);
        }
      }
    } catch (error) {
      console.error('[MarkItDown] Conversion error:', error);
      throw error;
    }
  }

  parseMarkdownOutput(markdown, fileName) {
    // Extract any metadata if present
    const metadata = {
      fileName,
      processedAt: new Date().toISOString(),
      processor: 'markitdown'
    };

    // Check for special patterns that might indicate document structure
    const hasHeadings = /^#{1,6}\s/m.test(markdown);
    const hasTables = /\|.*\|/.test(markdown);
    const hasLists = /^[\*\-\+]\s/m.test(markdown) || /^\d+\.\s/m.test(markdown);
    const hasCodeBlocks = /```[\s\S]*?```/.test(markdown);

    metadata.structure = {
      hasHeadings,
      hasTables,
      hasLists,
      hasCodeBlocks
    };

    // Count sections based on headings
    const headingMatches = markdown.match(/^#{1,6}\s.+$/gm) || [];
    metadata.sectionCount = headingMatches.length;

    return {
      content: markdown,
      metadata,
      format: 'markdown'
    };
  }

  /**
   * Create intelligent chunks from markdown content
   * Respects document structure (headings, lists, code blocks)
   */
  createStructuredChunks(markdown, fileName, options = {}) {
    const {
      maxChunkSize = 4000,
      overlapSize = 400,
      respectStructure = true
    } = options;

    const chunks = [];
    
    if (!respectStructure) {
      // Simple character-based chunking
      return this.createSimpleChunks(markdown, fileName, maxChunkSize, overlapSize);
    }

    // Split by top-level sections (# or ##)
    const sections = this.splitBySections(markdown);
    
    sections.forEach((section, sectionIndex) => {
      if (section.content.length <= maxChunkSize) {
        // Section fits in one chunk
        chunks.push({
          id: `chunk_${chunks.length}`,
          content: section.content,
          metadata: {
            fileName,
            chunkIndex: chunks.length,
            sectionIndex,
            sectionTitle: section.title,
            type: 'section',
            isComplete: true
          }
        });
      } else {
        // Section needs to be split
        const subChunks = this.splitLargeSection(section, maxChunkSize, overlapSize);
        subChunks.forEach((subChunk, subIndex) => {
          chunks.push({
            id: `chunk_${chunks.length}`,
            content: subChunk,
            metadata: {
              fileName,
              chunkIndex: chunks.length,
              sectionIndex,
              sectionTitle: section.title,
              subSectionIndex: subIndex,
              type: 'section_part',
              isComplete: false
            }
          });
        });
      }
    });

    return chunks;
  }

  splitBySections(markdown) {
    const lines = markdown.split('\n');
    const sections = [];
    let currentSection = { title: 'Introduction', content: '', level: 0 };

    for (const line of lines) {
      const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
      
      if (headingMatch) {
        const level = headingMatch[1].length;
        const title = headingMatch[2];
        
        // Only split on h1 and h2
        if (level <= 2) {
          if (currentSection.content.trim()) {
            sections.push(currentSection);
          }
          currentSection = { title, content: line + '\n', level };
        } else {
          currentSection.content += line + '\n';
        }
      } else {
        currentSection.content += line + '\n';
      }
    }

    // Don't forget the last section
    if (currentSection.content.trim()) {
      sections.push(currentSection);
    }

    return sections;
  }

  splitLargeSection(section, maxChunkSize, overlapSize) {
    const chunks = [];
    const paragraphs = section.content.split(/\n\n+/);
    let currentChunk = section.title ? `${'#'.repeat(section.level)} ${section.title}\n\n` : '';
    
    for (const paragraph of paragraphs) {
      if (currentChunk.length + paragraph.length > maxChunkSize && currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        // Add overlap from the end of previous chunk
        const overlap = currentChunk.slice(-overlapSize);
        currentChunk = overlap + '\n\n' + paragraph + '\n\n';
      } else {
        currentChunk += paragraph + '\n\n';
      }
    }
    
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }
    
    return chunks;
  }

  createSimpleChunks(text, fileName, chunkSize, overlapSize) {
    const chunks = [];
    let currentChunk = '';
    let chunkIndex = 0;
    
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    
    for (const sentence of sentences) {
      if (currentChunk.length + sentence.length > chunkSize && currentChunk.length > 0) {
        chunks.push({
          id: `chunk_${chunkIndex}`,
          content: currentChunk.trim(),
          metadata: {
            fileName,
            chunkIndex,
            type: 'text',
            startChar: Math.max(0, (chunkIndex * chunkSize) - (chunkIndex * overlapSize)),
            endChar: Math.min(text.length, ((chunkIndex + 1) * chunkSize) - (chunkIndex * overlapSize))
          }
        });
        
        // Start next chunk with overlap
        const overlap = currentChunk.slice(-overlapSize);
        currentChunk = overlap + ' ' + sentence;
        chunkIndex++;
      } else {
        currentChunk += sentence;
      }
    }
    
    // Don't forget the last chunk
    if (currentChunk.trim()) {
      chunks.push({
        id: `chunk_${chunkIndex}`,
        content: currentChunk.trim(),
        metadata: {
          fileName,
          chunkIndex,
          type: 'text'
        }
      });
    }
    
    return chunks;
  }

  /**
   * Check if a file type is supported by MarkItDown
   */
  isSupported(mimeType, fileName) {
    const supportedMimes = [
      'application/pdf',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/html',
      'text/plain',
      'text/csv',
      'application/json',
      'application/xml',
      'text/xml',
      'application/epub+zip'
    ];

    const supportedExtensions = [
      '.pdf', '.ppt', '.pptx', '.doc', '.docx', 
      '.xls', '.xlsx', '.html', '.txt', '.csv', 
      '.json', '.xml', '.epub', '.md'
    ];

    const ext = path.extname(fileName).toLowerCase();
    
    return supportedMimes.includes(mimeType) || 
           supportedExtensions.includes(ext) ||
           mimeType.startsWith('image/'); // MarkItDown also handles images
  }
}

module.exports = new MarkItDownService();