const Tesseract = require('tesseract.js');
const sharp = require('sharp');
const sharedOcrPool = require('./sharedOcrPool.cjs');

// Optional OpenCV - JavaScript/WebAssembly version
let cv = null;
let cvPromise = null;
try {
  cvPromise = require('@techstark/opencv-js');
  console.log('[AdvancedImageProcessor] Loading @techstark/opencv-js...');
} catch (error) {
  console.log('[AdvancedImageProcessor] OpenCV not available, using fallback methods');
}

class AdvancedImageProcessor {
  constructor() {
    this.isInitialized = false;
    this.hasOpenCV = false;
    this.opencvInitialized = false;
    // No longer maintaining our own worker - using shared pool
  }

  async initialize() {
    if (this.isInitialized) return;
    
    try {
      console.log('[AdvancedImageProcessor] Initializing...');
      
      // Initialize OpenCV.js if available
      if (cvPromise && !this.opencvInitialized) {
        try {
          cv = await cvPromise;
          this.hasOpenCV = true;
          this.opencvInitialized = true;
          console.log('[AdvancedImageProcessor] OpenCV.js loaded successfully');
        } catch (error) {
          console.log('[AdvancedImageProcessor] OpenCV.js failed to load, using fallback:', error.message);
          this.hasOpenCV = false;
        }
      }
      
      // Initialize shared OCR pool
      await sharedOcrPool.initialize();
      this.isInitialized = true;
      console.log(`[AdvancedImageProcessor] Initialized successfully (OpenCV: ${this.hasOpenCV ? 'available' : 'fallback'})`);
    } catch (error) {
      console.error('[AdvancedImageProcessor] Initialization failed:', error);
      throw error;
    }
  }

  async processEducationalImage(imageBuffer, fileName, languageHint = null) {
    await this.initialize();
    
    try {
      console.log(`[AdvancedImageProcessor] Processing ${fileName}...`);
      
      // 1. Image preprocessing and analysis
      const imageAnalysis = await this.analyzeImageStructure(imageBuffer);
      
      // 2. Content type detection
      const contentType = await this.detectContentType(imageBuffer, imageAnalysis);
      
      // 3. Structured data extraction based on content type
      const extractedData = await this.extractStructuredData(imageBuffer, contentType, imageAnalysis);
      
      // 4. OCR with layout preservation
      const ocrResult = await this.performLayoutAwareOCR(imageBuffer, imageAnalysis, languageHint);
      
      // 5. Combine and structure the results
      const result = {
        fileName,
        contentType,
        imageAnalysis,
        extractedData,
        ocrResult,
        metadata: {
          processedAt: new Date().toISOString(),
          confidence: this.calculateOverallConfidence(extractedData, ocrResult),
          hasOpenCV: this.hasOpenCV
        }
      };
      
      console.log(`[AdvancedImageProcessor] ${fileName} processed successfully. Content type: ${contentType.primary}`);
      return result;
      
    } catch (error) {
      console.error(`[AdvancedImageProcessor] Error processing ${fileName}:`, error);
      throw error;
    }
  }

  async analyzeImageStructure(imageBuffer) {
    try {
      // Get basic image properties
      const metadata = await sharp(imageBuffer).metadata();
      
      if (this.hasOpenCV) {
        // Use OpenCV for advanced analysis
        return await this.analyzeWithOpenCV(imageBuffer, metadata);
      } else {
        // Use fallback analysis
        return await this.analyzeWithFallback(imageBuffer, metadata);
      }
    } catch (error) {
      console.error('Image structure analysis failed:', error);
      return { 
        error: error.message,
        dimensions: { width: 0, height: 0 },
        regions: [],
        lines: { horizontal: [], vertical: [], diagonal: [], total: 0 },
        textRegions: [],
        hasTable: false,
        hasDiagram: false,
        hasHandwriting: false
      };
    }
  }

  async analyzeWithOpenCV(imageBuffer, metadata) {
    try {
      // Create image data from buffer (no canvas needed for OpenCV.js)
      const imageData = await this.bufferToImageData(imageBuffer, metadata);
      
      // Create OpenCV Mat from ImageData
      const img = cv.matFromImageData(imageData);
      const gray = new cv.Mat();
      cv.cvtColor(img, gray, cv.COLOR_RGBA2GRAY);
      
      // Detect edges and contours
      const edges = new cv.Mat();
      cv.Canny(gray, edges, 50, 150);
      
      const contours = new cv.MatVector();
      const hierarchy = new cv.Mat();
      cv.findContours(edges, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
      
      // Analyze layout regions
      const regions = this.analyzeLayoutRegionsJS(contours, img.rows, img.cols);
      
      // Detect lines (for tables, diagrams)
      const lines = this.detectLinesJS(edges);
      
      // Clean up OpenCV Mats
      img.delete();
      gray.delete();
      edges.delete();
      contours.delete();
      hierarchy.delete();
      
      return {
        dimensions: { width: metadata.width, height: metadata.height },
        regions,
        lines,
        textRegions: [], // Simplified for now
        hasTable: this.hasTableStructure(lines, regions),
        hasDiagram: this.hasDiagramElements(regions, lines),
        hasHandwriting: false // Simplified for now
      };
    } catch (error) {
      console.error('[AdvancedImageProcessor] OpenCV analysis failed:', error);
      // Fall back to regular analysis
      return await this.analyzeWithFallback(imageBuffer, metadata);
    }
  }

  async analyzeWithFallback(imageBuffer, metadata) {
    // Simplified analysis without OpenCV
    const { width, height } = metadata;
    
    // Basic analysis using image properties
    const aspectRatio = width / height;
    const isSquareish = aspectRatio > 0.8 && aspectRatio < 1.2;
    
    return {
      dimensions: { width, height },
      regions: [
        {
          id: 0,
          boundingBox: { x: 0, y: 0, width, height },
          area: width * height,
          aspectRatio,
          type: isSquareish ? 'square' : (aspectRatio > 1 ? 'horizontal_rect' : 'vertical_rect')
        }
      ],
      lines: { horizontal: [], vertical: [], diagonal: [], total: 0 },
      textRegions: [],
      hasTable: false,
      hasDiagram: isSquareish, // Guess based on aspect ratio
      hasHandwriting: false
    };
  }

  async bufferToImageData(imageBuffer, metadata) {
    // Convert image buffer to ImageData for OpenCV.js
    try {
      // Use sharp to convert to raw RGBA data
      const { data, info } = await sharp(imageBuffer)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      
      // Create ImageData-like object
      return {
        data: new Uint8ClampedArray(data),
        width: info.width,
        height: info.height
      };
    } catch (error) {
      console.error('Failed to convert buffer to ImageData:', error);
      throw error;
    }
  }

  analyzeLayoutRegionsJS(contours, height, width) {
    // JavaScript OpenCV version of layout analysis
    const regions = [];
    
    try {
      for (let i = 0; i < contours.size(); i++) {
        const contour = contours.get(i);
        const rect = cv.boundingRect(contour);
        
        regions.push({
          id: i,
          boundingBox: {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height
          },
          area: rect.width * rect.height,
          aspectRatio: rect.width / rect.height,
          type: this.classifyRegionType(rect, rect.width / rect.height, rect.width * rect.height)
        });
      }
    } catch (error) {
      console.error('Layout analysis error:', error);
    }
    
    return regions;
  }

  detectLinesJS(edges) {
    // JavaScript OpenCV version of line detection
    try {
      const lines = new cv.Mat();
      cv.HoughLinesP(edges, lines, 1, Math.PI / 180, 50, 50, 10);
      
      const detectedLines = {
        horizontal: [],
        vertical: [],
        diagonal: [],
        total: 0
      };
      
      // Process detected lines
      for (let i = 0; i < lines.rows; i++) {
        const x1 = lines.data32S[i * 4];
        const y1 = lines.data32S[i * 4 + 1];
        const x2 = lines.data32S[i * 4 + 2];
        const y2 = lines.data32S[i * 4 + 3];
        
        const angle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
        
        if (Math.abs(angle) < 10 || Math.abs(angle - 180) < 10) {
          detectedLines.horizontal.push({ x1, y1, x2, y2, angle });
        } else if (Math.abs(angle - 90) < 10 || Math.abs(angle + 90) < 10) {
          detectedLines.vertical.push({ x1, y1, x2, y2, angle });
        } else {
          detectedLines.diagonal.push({ x1, y1, x2, y2, angle });
        }
      }
      
      detectedLines.total = detectedLines.horizontal.length + detectedLines.vertical.length + detectedLines.diagonal.length;
      
      lines.delete();
      return detectedLines;
    } catch (error) {
      console.error('Line detection error:', error);
      return { horizontal: [], vertical: [], diagonal: [], total: 0 };
    }
  }

  async detectContentType(imageBuffer, imageAnalysis) {
    const contentTypes = {
      primary: 'unknown',
      secondary: [],
      confidence: 0
    };

    try {
      // Table detection
      if (imageAnalysis.hasTable) {
        contentTypes.primary = 'table';
        contentTypes.secondary.push('data_visualization');
        contentTypes.confidence += 0.3;
      }

      // Mathematical content detection
      const mathConfidence = await this.detectMathematicalContent(imageBuffer);
      if (mathConfidence > 0.3) {
        if (contentTypes.primary === 'unknown') contentTypes.primary = 'mathematics';
        contentTypes.secondary.push('mathematics');
        contentTypes.confidence += mathConfidence;
      }

      // Diagram detection
      if (imageAnalysis.hasDiagram) {
        contentTypes.secondary.push('diagram');
        contentTypes.confidence += 0.2;
      }

      // Chart/Graph detection
      const chartType = this.detectChartType(imageAnalysis);
      if (chartType) {
        contentTypes.secondary.push(`chart_${chartType}`);
        contentTypes.confidence += 0.25;
      }

      // Worksheet/Exercise detection
      const exerciseConfidence = await this.detectExerciseContent(imageBuffer);
      if (exerciseConfidence > 0.4) {
        if (contentTypes.primary === 'unknown') contentTypes.primary = 'exercise';
        contentTypes.secondary.push('educational_exercise');
        contentTypes.confidence += exerciseConfidence;
      }

      // Handwritten content
      if (imageAnalysis.hasHandwriting) {
        contentTypes.secondary.push('handwritten');
        contentTypes.confidence += 0.1;
      }

      return contentTypes;
    } catch (error) {
      console.error('Content type detection failed:', error);
      return contentTypes;
    }
  }

  async extractStructuredData(imageBuffer, contentType, imageAnalysis) {
    const structuredData = {};

    try {
      switch (contentType.primary) {
        case 'table':
          structuredData.table = await this.extractTableData(imageBuffer, imageAnalysis);
          break;
          
        case 'mathematics':
          structuredData.mathematics = await this.extractMathematicalData(imageBuffer);
          break;
          
        case 'exercise':
          structuredData.exercise = await this.extractExerciseData(imageBuffer, imageAnalysis);
          break;
      }

      // Extract charts if detected
      if (contentType.secondary.includes('chart_pie')) {
        structuredData.pieChart = await this.extractPieChartData(imageBuffer, imageAnalysis);
      }
      
      if (contentType.secondary.includes('chart_bar')) {
        structuredData.barChart = await this.extractBarChartData(imageBuffer, imageAnalysis);
      }

      return structuredData;
    } catch (error) {
      console.error('Structured data extraction failed:', error);
      return { error: error.message };
    }
  }

  async extractTableData(imageBuffer, imageAnalysis) {
    try {
      // Use table regions to extract data
      const tableOCR = await this.performTableOCR(imageBuffer, imageAnalysis.regions);
      
      // Parse the OCR result into structured table data
      const tableData = this.parseTableFromOCR(tableOCR);
      
      return {
        headers: tableData.headers,
        rows: tableData.rows,
        metadata: {
          rowCount: tableData.rows.length,
          columnCount: tableData.headers.length,
          confidence: tableOCR.confidence
        }
      };
    } catch (error) {
      console.error('Table extraction failed:', error);
      return { error: error.message };
    }
  }

  async extractMathematicalData(imageBuffer) {
    try {
      const result = await this.worker.recognize(imageBuffer);
      const text = result.data.text;
      
      // Extract mathematical elements
      const numbers = this.extractNumbers(text);
      const operators = this.extractOperators(text);
      const equations = this.extractEquations(text);
      
      return {
        text,
        numbers,
        operators,
        equations,
        confidence: result.data.confidence
      };
    } catch (error) {
      console.error('Mathematical data extraction failed:', error);
      return { error: error.message };
    }
  }

  async extractPieChartData(imageBuffer, imageAnalysis) {
    try {
      // For pie charts, we look for circular regions and text labels
      const ocrResult = await sharedOcrPool.extractText(imageBuffer);
      const text = ocrResult.text;
      
      // Extract potential data from text
      const pieData = this.parsePieChartText(text);
      
      return {
        type: 'pie',
        data: pieData,
        confidence: ocrResult.confidence
      };
    } catch (error) {
      console.error('Pie chart extraction failed:', error);
      return { error: error.message };
    }
  }

  async extractBarChartData(imageBuffer, imageAnalysis) {
    try {
      const ocrResult = await sharedOcrPool.extractText(imageBuffer);
      const text = ocrResult.text;
      
      // Extract potential bar chart data
      const barData = this.parseBarChartText(text);
      
      return {
        type: 'bar',
        data: barData,
        confidence: ocrResult.confidence
      };
    } catch (error) {
      console.error('Bar chart extraction failed:', error);
      return { error: error.message };
    }
  }

  async extractExerciseData(imageBuffer, imageAnalysis) {
    try {
      // Extract question and answer areas
      const fullOCR = await sharedOcrPool.extractText(imageBuffer);
      const text = fullOCR.text;
      
      // Analyze the exercise structure
      const exercise = {
        questionNumber: this.extractQuestionNumber(text),
        questionText: this.extractQuestionText(text),
        instructions: this.extractInstructions(text),
        hasTable: imageAnalysis.hasTable,
        hasDiagram: imageAnalysis.hasDiagram,
        answerArea: this.detectAnswerArea(imageAnalysis),
        problemType: this.classifyProblemType(text)
      };

      // If there's a table, extract it
      if (exercise.hasTable) {
        exercise.tableData = await this.extractTableData(imageBuffer, imageAnalysis);
      }

      return exercise;
    } catch (error) {
      console.error('Exercise extraction failed:', error);
      return { error: error.message };
    }
  }

  // Helper methods for OpenCV analysis
  analyzeLayoutRegions(contours, height, width) {
    if (!this.hasOpenCV) return [];
    
    const regions = [];
    
    contours.forEach((contour, index) => {
      const rect = contour.boundingRect();
      const area = rect.width * rect.height;
      const aspectRatio = rect.width / rect.height;
      
      // Filter out noise (very small regions)
      if (area > (width * height * 0.01)) {
        regions.push({
          id: index,
          boundingBox: rect,
          area,
          aspectRatio,
          type: this.classifyRegionType(rect, aspectRatio, area)
        });
      }
    });
    
    return regions.sort((a, b) => b.area - a.area); // Sort by area, largest first
  }

  detectLines(edges) {
    if (!this.hasOpenCV) return { horizontal: [], vertical: [], diagonal: [], total: 0 };
    
    try {
      const lines = edges.houghLinesP(1, Math.PI / 180, 50, 50, 10);
      
      return {
        horizontal: lines.filter(line => Math.abs(line.w - line.y) < 10),
        vertical: lines.filter(line => Math.abs(line.x - line.z) < 10),
        diagonal: lines.filter(line => Math.abs(line.w - line.y) >= 10 && Math.abs(line.x - line.z) >= 10),
        total: lines.length
      };
    } catch (error) {
      return { horizontal: [], vertical: [], diagonal: [], total: 0 };
    }
  }

  hasTableStructure(lines, regions) {
    if (!this.hasOpenCV) {
      // Fallback: assume table if multiple rectangular regions
      return regions.length > 2 && regions.some(r => r.aspectRatio > 1.5);
    }
    
    // Check for grid-like structure
    const hasHorizontalLines = lines.horizontal.length >= 2;
    const hasVerticalLines = lines.vertical.length >= 2;
    const hasRectangularRegions = regions.some(r => r.aspectRatio > 1.5 && r.aspectRatio < 5);
    
    return hasHorizontalLines && hasVerticalLines && hasRectangularRegions;
  }

  hasDiagramElements(regions, lines) {
    if (!this.hasOpenCV) return false;
    
    // Simplified diagram detection without OpenCV contour operations
    // Look for square-ish shapes that might be diagrams
    const hasCircularShapes = regions.some(region => {
      // Circle-like shapes have aspect ratio close to 1 and reasonable size
      return region.aspectRatio > 0.8 && region.aspectRatio < 1.2 && region.area > 1000;
    });
    
    const hasDiagonalLines = lines.diagonal && lines.diagonal.length > 0;
    
    return hasCircularShapes || hasDiagonalLines;
  }

  // Text parsing helper methods
  extractNumbers(text) {
    const numberPattern = /\b\d+(?:\.\d+)?\b/g;
    const matches = text.match(numberPattern);
    return matches ? matches.map(n => parseFloat(n)) : [];
  }

  extractOperators(text) {
    const operatorPattern = /[+\-*/=]/g;
    return text.match(operatorPattern) || [];
  }

  extractEquations(text) {
    const equationPattern = /\d+\s*[+\-*/]\s*\d+\s*=\s*\d*/g;
    return text.match(equationPattern) || [];
  }

  parsePieChartText(text) {
    // Look for label-value pairs
    const lines = text.split('\n').filter(line => line.trim());
    const data = [];
    
    lines.forEach(line => {
      // Try to match patterns like "Category 15" or "Category: 15"
      const match = line.match(/([A-Za-z\s]+)[\s:]*(\d+)/);
      if (match) {
        data.push({
          name: match[1].trim(),
          population: parseInt(match[2]),
          color: this.generateColor(data.length),
          legendFontColor: '#7F7F7F',
          legendFontSize: 15
        });
      }
    });
    
    return data;
  }

  parseBarChartText(text) {
    // Similar to pie chart but structured for bar charts
    const lines = text.split('\n').filter(line => line.trim());
    const data = [];
    
    lines.forEach(line => {
      const match = line.match(/([A-Za-z\s]+)[\s:]*(\d+)/);
      if (match) {
        data.push({
          label: match[1].trim(),
          value: parseInt(match[2]),
          color: this.generateColor(data.length)
        });
      }
    });
    
    return data;
  }

  generateColor(index) {
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57', '#F38BA8'];
    return colors[index % colors.length];
  }

  async detectMathematicalContent(imageBuffer) {
    try {
      // Use shared OCR pool for consistency and performance
      const result = await sharedOcrPool.extractText(imageBuffer);
      const text = result.text;
      
      // Look for mathematical indicators
      const mathIndicators = [
        /\d+\s*[+\-*/=]\s*\d+/, // Basic arithmetic
        /[xy]\s*[+\-*/=]/, // Variables
        /\(\s*\d+\s*\)/, // Parentheses with numbers
        /\b\d+%\b/, // Percentages
        /\b\d+°\b/, // Degrees
        /\b(sin|cos|tan|log)\b/i, // Trigonometric functions
      ];
      
      let confidence = 0;
      mathIndicators.forEach(pattern => {
        if (pattern.test(text)) confidence += 0.2;
      });
      
      return Math.min(confidence, 1.0);
    } catch (error) {
      return 0;
    }
  }

  async detectExerciseContent(imageBuffer) {
    try {
      const result = await sharedOcrPool.extractText(imageBuffer);
      const text = result.text.toLowerCase();
      
      // Look for exercise indicators
      const exerciseIndicators = [
        /\b\d+\.\s/, // Numbered questions
        /\bdraw\b.*\b(chart|graph|diagram)\b/, // Drawing instructions
        /\bcalculate\b/, // Calculate instructions
        /\bshow\b.*\b(work|steps)\b/, // Show work instructions
        /\b(complete|fill)\b.*\b(table|chart)\b/, // Complete table
        /\banswer\b.*\b(question|problem)\b/, // Answer question
      ];
      
      let confidence = 0;
      exerciseIndicators.forEach(pattern => {
        if (pattern.test(text)) confidence += 0.15;
      });
      
      return Math.min(confidence, 1.0);
    } catch (error) {
      return 0;
    }
  }

  detectChartType(imageAnalysis) {
    // Pie chart detection
    if (imageAnalysis.regions.some(r => r.aspectRatio > 0.8 && r.aspectRatio < 1.2)) {
      const hasCircle = imageAnalysis.regions.some(r => r.type === 'square');
      if (hasCircle) return 'pie';
    }
    
    // Bar chart detection
    if (imageAnalysis.regions.filter(r => r.aspectRatio > 2 || r.aspectRatio < 0.5).length >= 3) {
      return 'bar';
    }
    
    return null;
  }

  classifyRegionType(rect, aspectRatio, area) {
    if (aspectRatio > 0.8 && aspectRatio < 1.2) return 'square';
    if (aspectRatio > 2) return 'horizontal_rect';
    if (aspectRatio < 0.5) return 'vertical_rect';
    return 'rectangle';
  }

  extractQuestionNumber(text) {
    const match = text.match(/^\s*(\d+)\./m);
    return match ? parseInt(match[1]) : null;
  }

  extractQuestionText(text) {
    // Extract main question text (usually the largest text block)
    const lines = text.split('\n').filter(line => line.trim().length > 10);
    return lines.length > 0 ? lines[0].trim() : '';
  }

  extractInstructions(text) {
    // Look for instruction keywords
    const instructionPatterns = [
      /draw\s+.*?(chart|graph|diagram|table)/i,
      /calculate\s+.*?/i,
      /complete\s+.*?/i,
      /show\s+.*?/i
    ];
    
    for (const pattern of instructionPatterns) {
      const match = text.match(pattern);
      if (match) return match[0];
    }
    
    return null;
  }

  classifyProblemType(text) {
    const lowerText = text.toLowerCase();
    
    if (lowerText.includes('pie chart')) return 'pie_chart_creation';
    if (lowerText.includes('bar chart') || lowerText.includes('bar graph')) return 'bar_chart_creation';
    if (lowerText.includes('calculate') && lowerText.includes('%')) return 'percentage_calculation';
    if (lowerText.includes('frequency') && lowerText.includes('table')) return 'frequency_analysis';
    if (lowerText.includes('probability')) return 'probability';
    
    return 'general';
  }

  calculateOverallConfidence(extractedData, ocrResult) {
    let confidence = 0;
    let factors = 0;
    
    if (ocrResult && ocrResult.confidence) {
      confidence += ocrResult.confidence;
      factors += 1;
    }
    
    if (extractedData && Object.keys(extractedData).length > 0) {
      confidence += 0.7;
      factors += 1;
    }
    
    return factors > 0 ? confidence / factors : 0;
  }

  async performLayoutAwareOCR(imageBuffer, imageAnalysis, languageHint = null) {
    try {
      // Prepare OCR options with language hint
      const ocrOptions = {};
      
      if (languageHint) {
        console.log(`[AdvancedImageProcessor] Using language hint: ${languageHint}`);
        // Convert language hint to Tesseract language codes
        const languageMap = {
          'arabic': ['ara', 'eng'], // Arabic first for better recognition
          'spanish': ['spa', 'eng'],
          'french': ['fra', 'eng'],
          'german': ['deu', 'eng'],
          'chinese': ['chi_sim', 'eng'],
          'japanese': ['jpn', 'eng'],
          'korean': ['kor', 'eng'],
          'russian': ['rus', 'eng'],
          'hindi': ['hin', 'eng'],
          'hebrew': ['heb', 'eng'],
          'persian': ['fas', 'eng'],
          'urdu': ['urd', 'eng'],
          'english': ['eng']
        };
        
        const languages = languageMap[languageHint.toLowerCase()] || ['eng'];
        ocrOptions.languages = languages;
      }
      
      // Use shared OCR pool for text extraction with language support
      const result = await sharedOcrPool.extractText(imageBuffer, ocrOptions);
      
      return {
        text: result.text,
        confidence: result.confidence,
        words: result.words,
        lines: result.lines,
        paragraphs: result.paragraphs
      };
    } catch (error) {
      console.error('Layout-aware OCR failed:', error);
      return { error: error.message };
    }
  }

  async performTableOCR(imageBuffer, regions) {
    // This would be enhanced with table-specific OCR logic
    return await this.performLayoutAwareOCR(imageBuffer, null);
  }

  parseTableFromOCR(ocrResult) {
    // Parse OCR text into table structure
    const lines = ocrResult.text.split('\n').filter(line => line.trim());
    
    if (lines.length < 2) {
      return { headers: [], rows: [] };
    }
    
    // Assume first line is headers
    const headers = this.splitTableRow(lines[0]);
    const rows = lines.slice(1).map(line => this.splitTableRow(line));
    
    return { headers, rows };
  }

  splitTableRow(rowText) {
    // Simple splitting - could be enhanced with position-based splitting
    return rowText.split(/\s{2,}|[|]/).map(cell => cell.trim()).filter(cell => cell);
  }

  async detectTextRegions(grayImage) {
    // Simplified text region detection
    return [];
  }

  async detectHandwriting(grayImage) {
    // Simplified handwriting detection
    return false;
  }

  detectAnswerArea(imageAnalysis) {
    // Look for large empty regions that might be answer areas
    const emptyRegions = imageAnalysis.regions.filter(r => r.area > 1000 && r.type === 'rectangle');
    return emptyRegions.length > 0;
  }

  async terminate() {
    // No longer managing our own worker - shared pool handles termination
    this.isInitialized = false;
    this.opencvInitialized = false;
    console.log('[AdvancedImageProcessor] Service terminated');
  }
}

module.exports = new AdvancedImageProcessor(); 