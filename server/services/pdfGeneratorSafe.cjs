const PDFDocument = require('pdfkit');
const sharp = require('sharp');

/**
 * Safe PDF Generator that avoids library conflicts
 * Uses SVG-based charts instead of canvas to prevent conflicts with sharp
 */
class PDFGeneratorSafe {
  constructor() {
    this.defaultOptions = {
      margins: {
        top: 72,
        bottom: 72,
        left: 72,
        right: 72
      },
      size: 'A4',
      info: {
        Title: 'AI Tutor Generated Document',
        Author: 'AI Tutor App',
        Creator: 'AI Tutor App'
      }
    };
  }

  /**
   * Generate a PDF from AI response content
   */
  async generateFromAIResponse(content, options = {}) {
    return new Promise(async (resolve, reject) => {
      try {
        const doc = new PDFDocument({
          ...this.defaultOptions,
          ...options
        });

        const chunks = [];
        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Add header
        this.addHeader(doc, content.title || 'AI Generated Content');

        // Add metadata
        if (content.metadata) {
          this.addMetadata(doc, content.metadata);
        }

        // Process content with charts
        if (content.text) {
          await this.processContentWithCharts(doc, content.text);
        } else if (content.sections) {
          await this.addSectionsWithCharts(doc, content.sections, content.charts);
        }

        // Add footer
        this.addFooter(doc);
        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Process content that may contain chart data
   */
  async processContentWithCharts(doc, text) {
    const parts = text.split(/(```json[\s\S]*?```)/g);
    let hasCharts = false;
    
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      
      if (part.startsWith('```json') && part.endsWith('```')) {
        // Extract JSON
        const jsonContent = part.slice(7, -3).trim();
        
        try {
          const data = JSON.parse(jsonContent);
          
          // Check if it's chart data
          if (data.type && ['pie', 'bar', 'line', 'flow'].includes(data.type)) {
            hasCharts = true;
            await this.addChart(doc, data);
          } else {
            // Regular JSON
            this.addCodeBlock(doc, jsonContent);
          }
        } catch (e) {
          // Failed to parse
          this.addCodeBlock(doc, jsonContent);
        }
      } else if (part.trim()) {
        // Clean up AI comments about generating charts
        const cleanedText = this.cleanAIComments(part, hasCharts);
        if (cleanedText.trim()) {
          this.addFormattedText(doc, cleanedText);
        }
      }
    }
  }
  
  /**
   * Remove AI comments about generating charts
   */
  cleanAIComments(text, hasCharts) {
    if (!hasCharts) return text;
    
    // Patterns to remove when charts are present
    const patternsToRemove = [
      /I'll\s+(?:generate|create|prepare|make)\s+(?:a|the|an)?\s*(?:chart|diagram|visualization|PDF|document)[\s\S]*?(?:\.|:|\n|$)/gi,
      /Here's?\s+(?:the|a|an)?\s*(?:chart|diagram|visualization|PDF|document)[\s\S]*?(?:\.|:|\n|$)/gi,
      /I've\s+(?:generated|created|prepared|made)\s+(?:a|the|an)?\s*(?:chart|diagram|visualization)[\s\S]*?(?:\.|:|\n|$)/gi,
      /Below\s+is\s+(?:the|a|an)?\s*(?:chart|diagram|visualization)[\s\S]*?(?:\.|:|\n|$)/gi,
      /The\s+(?:chart|diagram|visualization)\s+(?:shows|displays|represents)[\s\S]*?(?:\.|:|\n|$)/gi
    ];
    
    let cleaned = text;
    patternsToRemove.forEach(pattern => {
      cleaned = cleaned.replace(pattern, '');
    });
    
    // Remove empty lines that result from cleaning
    cleaned = cleaned.split('\n')
      .filter(line => line.trim())
      .join('\n');
    
    return cleaned;
  }

  /**
   * Add SVG chart directly to PDF
   */
  async addSvgChart(doc, svgData) {
    try {
      const { svg, title, type, width, height } = svgData;
      
      // Add title if present
      if (title) {
        doc.fontSize(16)
           .font('Helvetica-Bold')
           .text(title, { align: 'center' })
           .font('Helvetica')
           .moveDown(0.5);
      }
      
      // Convert SVG to PNG using sharp
      const pngBuffer = await sharp(Buffer.from(svg, 'utf8'))
        .resize(width || 400, height || 300, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 1 }
        })
        .png()
        .toBuffer();
      
      // Calculate position
      const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      const imgWidth = width || 400;
      const imgHeight = height || 300;
      const x = doc.page.margins.left + (pageWidth - imgWidth) / 2;
      
      // Ensure we have enough space
      if (doc.y + imgHeight > doc.page.height - doc.page.margins.bottom) {
        doc.addPage();
      }
      
      doc.image(pngBuffer, x, doc.y, {
        width: imgWidth,
        height: imgHeight
      });
      
      doc.moveDown(2);
    } catch (error) {
      console.error('[PDF] Error adding SVG chart:', error);
      doc.fontSize(12)
         .text('Chart could not be rendered', { align: 'center' })
         .moveDown();
    }
  }

  /**
   * Add a chart to the PDF using SVG
   */
  async addChart(doc, chartData) {
    try {
      // Add title if present
      if (chartData.title) {
        doc.fontSize(16)
           .font('Helvetica-Bold')
           .text(chartData.title, { align: 'center' })
           .font('Helvetica')
           .moveDown(0.5);
      }

      let chartSVG;
      
      // Generate SVG based on type
      switch (chartData.type) {
        case 'pie':
          chartSVG = this.generatePieChartSVG(chartData);
          break;
        case 'bar':
          chartSVG = this.generateBarChartSVG(chartData);
          break;
        case 'line':
          chartSVG = this.generateLineChartSVG(chartData);
          break;
        case 'flow':
          chartSVG = this.generateFlowChartSVG(chartData);
          break;
        default:
          this.addChartAsStyledText(doc, chartData);
          return;
      }

      if (chartSVG) {
        try {
          // Determine image dimensions based on chart type
          let imgWidth = 400;
          let imgHeight = 300;
          
          if (chartData.type === 'flow') {
            // Flow charts need more height
            const nodeCount = chartData.data?.nodes?.length || chartData.nodes?.length || 4;
            imgWidth = 350;
            imgHeight = Math.min(500, nodeCount * 80);
          }
          
          // Convert SVG to PNG using sharp with proper fit
          const pngBuffer = await sharp(Buffer.from(chartSVG, 'utf8'))
            .resize(imgWidth, imgHeight, {
              fit: 'contain',
              background: { r: 255, g: 255, b: 255, alpha: 1 }
            })
            .png()
            .toBuffer();

          // Calculate position with margins
          const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
          const x = doc.page.margins.left + (pageWidth - imgWidth) / 2;
          
          // Ensure we have enough space
          if (doc.y + imgHeight > doc.page.height - doc.page.margins.bottom) {
            doc.addPage();
          }
          
          doc.image(pngBuffer, x, doc.y, {
            width: imgWidth,
            height: imgHeight
          });
          
          doc.moveDown(2);
        } catch (svgError) {
          console.error('[PDF] SVG conversion error for', chartData.type, 'chart:', svgError.message);
          console.log('[PDF] SVG content length:', chartSVG.length);
          console.log('[PDF] First 200 chars of SVG:', chartSVG.substring(0, 200));
          // Fallback to styled text
          this.addChartAsStyledText(doc, chartData);
        }
      }

      // Add description if present
      if (chartData.description) {
        doc.fontSize(10)
           .text(chartData.description, {
             align: 'center',
             width: 450
           })
           .moveDown();
      }
    } catch (error) {
      console.error('Error adding chart:', error);
      this.addChartAsStyledText(doc, chartData);
    }
  }

  /**
   * Generate SVG for pie chart
   */
  generatePieChartSVG(chartData) {
    const width = 600;
    const height = 400;
    const centerX = 200;
    const centerY = 200;
    const radius = 150;
    
    let svg = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">`;
    svg += '<rect width="100%" height="100%" fill="white"/>';
    
    // Calculate total
    const total = chartData.data.reduce((sum, item) => sum + item.value, 0);
    let currentAngle = -90; // Start at top
    
    // Draw pie segments
    chartData.data.forEach((item, index) => {
      const percentage = (item.value / total) * 100;
      const angle = (percentage / 100) * 360;
      const endAngle = currentAngle + angle;
      
      // Calculate path
      const x1 = centerX + radius * Math.cos(currentAngle * Math.PI / 180);
      const y1 = centerY + radius * Math.sin(currentAngle * Math.PI / 180);
      const x2 = centerX + radius * Math.cos(endAngle * Math.PI / 180);
      const y2 = centerY + radius * Math.sin(endAngle * Math.PI / 180);
      
      const largeArc = angle > 180 ? 1 : 0;
      
      const path = `M ${centerX} ${centerY} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;
      
      svg += `<path d="${path}" fill="${item.color || this.getDefaultColor(index)}" stroke="white" stroke-width="2"/>`;
      
      // Add label in legend
      const legendY = 50 + (index * 30);
      svg += `<rect x="${width - 200}" y="${legendY}" width="20" height="20" fill="${item.color || this.getDefaultColor(index)}"/>`;
      svg += `<text x="${width - 170}" y="${legendY + 15}" font-family="Arial" font-size="14">${item.name}: ${percentage.toFixed(1)}%</text>`;
      
      currentAngle = endAngle;
    });
    
    svg += '</svg>';
    return svg;
  }

  /**
   * Generate SVG for bar chart
   */
  generateBarChartSVG(chartData) {
    const width = 600;
    const height = 400;
    const padding = 60;
    const orientation = chartData.orientation || 'vertical';
    const barRadius = chartData.barRadius || 0;
    
    // Ensure data is an array
    const data = Array.isArray(chartData.data) ? chartData.data : [];
    if (data.length === 0) return this.generateErrorSVG('No data for bar chart');
    
    const maxValue = Math.max(...data.map(item => item.value || 0));
    
    let svg = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">`;
    svg += '<rect width="100%" height="100%" fill="white"/>';
    
    if (orientation === 'vertical') {
      // Calculate bar width based on number of items
      const barWidth = Math.min(50, (width - 2 * padding - (data.length - 1) * 15) / data.length);
      
      // Draw axes
      svg += `<line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" stroke="black" stroke-width="2"/>`;
      svg += `<line x1="${padding}" y1="${padding}" x2="${padding}" y2="${height - padding}" stroke="black" stroke-width="2"/>`;
      
      // Draw bars
      data.forEach((item, index) => {
        const barHeight = (item.value / maxValue) * (height - 2 * padding);
        const x = padding + (index * (barWidth + 15)) + 20;
        const y = height - padding - barHeight;
        
        // Draw bar with optional rounded corners
        if (barRadius > 0) {
          svg += `<rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" fill="${item.color || '#3B82F6'}" stroke="${item.color || '#2563EB'}" stroke-width="1" rx="${barRadius}" ry="${barRadius}"/>`;
        } else {
          svg += `<rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" fill="${item.color || '#3B82F6'}" stroke="${item.color || '#2563EB'}" stroke-width="1"/>`;
        }
        
        // Add value label
        if (chartData.showValues !== false) {
          svg += `<text x="${x + barWidth/2}" y="${y - 5}" text-anchor="middle" font-family="Arial" font-size="12" font-weight="600">${item.value}</text>`;
        }
        
        // Add label
        const labelY = height - padding + 20;
        const label = item.label || item.name || '';
        if (label.length > 8) {
          svg += `<text x="${x + barWidth/2}" y="${labelY}" text-anchor="middle" font-family="Arial" font-size="11" transform="rotate(45 ${x + barWidth/2} ${labelY})">${label}</text>`;
        } else {
          svg += `<text x="${x + barWidth/2}" y="${labelY}" text-anchor="middle" font-family="Arial" font-size="11">${label}</text>`;
        }
      });
    } else {
      // Horizontal orientation
      const labelPadding = 120; // Space for labels
      const barHeight = Math.min(40, (height - 2 * padding - (data.length - 1) * 10) / data.length);
      
      // Draw axes
      svg += `<line x1="${padding + labelPadding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" stroke="black" stroke-width="2"/>`;
      svg += `<line x1="${padding + labelPadding}" y1="${padding}" x2="${padding + labelPadding}" y2="${height - padding}" stroke="black" stroke-width="2"/>`;
      
      // Draw bars
      data.forEach((item, index) => {
        const barWidth = (item.value / maxValue) * (width - 2 * padding - labelPadding);
        const x = padding + labelPadding;
        const y = padding + (index * (barHeight + 10)) + 20;
        
        // Draw bar with optional rounded corners
        if (barRadius > 0) {
          svg += `<rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" fill="${item.color || '#3B82F6'}" stroke="${item.color || '#2563EB'}" stroke-width="1" rx="${barRadius}" ry="${barRadius}"/>`;
        } else {
          svg += `<rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" fill="${item.color || '#3B82F6'}" stroke="${item.color || '#2563EB'}" stroke-width="1"/>`;
        }
        
        // Add value label
        if (chartData.showValues !== false) {
          svg += `<text x="${x + barWidth + 8}" y="${y + barHeight/2 + 5}" text-anchor="start" font-family="Arial" font-size="12" font-weight="600">${item.value}</text>`;
        }
        
        // Add category label
        const label = item.label || item.name || '';
        svg += `<text x="${padding + labelPadding - 8}" y="${y + barHeight/2 + 5}" text-anchor="end" font-family="Arial" font-size="11">${label}</text>`;
      });
    }
    
    svg += '</svg>';
    return svg;
  }

  /**
   * Generate SVG for line chart
   */
  generateLineChartSVG(chartData) {
    const width = 600;
    const height = 400;
    const padding = 60;
    
    // Ensure data is an array
    const data = Array.isArray(chartData.data) ? chartData.data : [];
    if (data.length === 0) return this.generateErrorSVG('No data for line chart');
    
    const values = data.map(item => item.value || item.y || 0);
    const maxValue = Math.max(...values);
    const minValue = Math.min(...values);
    const range = maxValue - minValue || 1;
    
    let svg = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">`;
    svg += '<rect width="100%" height="100%" fill="white"/>';
    
    // Draw axes
    svg += `<line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" stroke="black" stroke-width="2"/>`;
    svg += `<line x1="${padding}" y1="${padding}" x2="${padding}" y2="${height - padding}" stroke="black" stroke-width="2"/>`;
    
    // Calculate points
    const points = data.map((item, index) => {
      const x = padding + (index / Math.max(1, data.length - 1)) * (width - 2 * padding);
      const y = height - padding - ((item.value || item.y || 0) - minValue) / range * (height - 2 * padding);
      return { x, y, label: item.label || item.x || `Point ${index + 1}`, value: item.value || item.y || 0 };
    });
    
    // Draw line
    const pathData = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    svg += `<path d="${pathData}" fill="none" stroke="#EF4444" stroke-width="3"/>`;
    
    // Draw points and labels
    points.forEach(p => {
      svg += `<circle cx="${p.x}" cy="${p.y}" r="5" fill="#EF4444" stroke="white" stroke-width="2"/>`;
      svg += `<text x="${p.x}" y="${height - padding + 20}" text-anchor="middle" font-family="Arial" font-size="10">${p.label}</text>`;
      svg += `<text x="${p.x}" y="${p.y - 10}" text-anchor="middle" font-family="Arial" font-size="10">${p.value}</text>`;
    });
    
    svg += '</svg>';
    return svg;
  }

  generateErrorSVG(message) {
    return `<svg width="400" height="100" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#fee2e2"/>
      <text x="200" y="50" text-anchor="middle" font-family="Arial" font-size="14" fill="#dc2626">${message}</text>
    </svg>`;
  }

  /**
   * Generate SVG for flow chart
   */
  generateFlowChartSVG(chartData) {
    const svgWidth = 600;
    const svgHeight = 800;
    const nodeWidth = 120;
    const nodeHeight = 60;
    const verticalSpacing = 100;

    // Handle different data structures
    const nodes = chartData.data?.nodes || chartData.nodes || (chartData.data && Array.isArray(chartData.data) ? chartData.data : []);
    const connections = chartData.data?.connections || chartData.connections || [];
    
    if (!Array.isArray(nodes) || nodes.length === 0) {
      console.log('[PDF] No nodes found in flow chart data:', chartData);
      return this.generateErrorSVG('No nodes for flow chart');
    }
    
    // Position nodes vertically
    nodes.forEach((node, index) => {
      node.x = (svgWidth - nodeWidth) / 2;
      node.y = 50 + (index * verticalSpacing);
    });

    // Add viewBox to ensure full content is visible
    let svg = `<svg width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}" xmlns="http://www.w3.org/2000/svg">`;
    svg += '<rect width="100%" height="100%" fill="white"/>';
    
    // Define arrow marker
    svg += `
      <defs>
        <marker id="arrowhead" markerWidth="10" markerHeight="10" refX="9" refY="5" orient="auto">
          <polygon points="0 0, 10 5, 0 10" fill="#666"/>
        </marker>
      </defs>
    `;
    
    // Draw connections
    connections.forEach(conn => {
      const fromNode = nodes.find(n => n.id === conn.from);
      const toNode = nodes.find(n => n.id === conn.to);
      
      if (fromNode && toNode) {
        const x1 = fromNode.x + nodeWidth / 2;
        const y1 = fromNode.y + nodeHeight;
        const x2 = toNode.x + nodeWidth / 2;
        const y2 = toNode.y;
        
        svg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2 - 10}" stroke="#666" stroke-width="2" marker-end="url(#arrowhead)"/>`;
      }
    });
    
    // Draw nodes
    nodes.forEach(node => {
      const fillColor = this.getNodeColor(node.type);
      const textColor = node.type === 'start' || node.type === 'end' ? 'white' : 'white';
      
      switch (node.type) {
        case 'start':
        case 'end':
          svg += `<rect x="${node.x}" y="${node.y}" width="${nodeWidth}" height="${nodeHeight}" rx="30" fill="${fillColor}" stroke="#333" stroke-width="2"/>`;
          break;
        case 'decision':
          const cx = node.x + nodeWidth / 2;
          const cy = node.y + nodeHeight / 2;
          svg += `<polygon points="${cx},${node.y} ${node.x + nodeWidth},${cy} ${cx},${node.y + nodeHeight} ${node.x},${cy}" fill="${fillColor}" stroke="#333" stroke-width="2"/>`;
          break;
        default:
          svg += `<rect x="${node.x}" y="${node.y}" width="${nodeWidth}" height="${nodeHeight}" fill="${fillColor}" stroke="#333" stroke-width="2"/>`;
      }
      
      // Add text (simple single line)
      const textX = node.x + nodeWidth / 2;
      const textY = node.y + nodeHeight / 2 + 5;
      const text = node.label.length > 15 ? node.label.substring(0, 15) + '...' : node.label;
      svg += `<text x="${textX}" y="${textY}" text-anchor="middle" font-family="Arial" font-size="12" fill="${textColor}">${text}</text>`;
    });
    
    svg += '</svg>';
    return svg;
  }

  /**
   * Add chart as styled text (fallback)
   */
  addChartAsStyledText(doc, chartData) {
    // Create a visually appealing text representation
    doc.fontSize(12);
    
    switch (chartData.type) {
      case 'pie':
        this.addPieChartText(doc, chartData);
        break;
      case 'bar':
        this.addBarChartText(doc, chartData);
        break;
      case 'line':
        this.addLineChartText(doc, chartData);
        break;
      case 'flow':
        this.addFlowChartText(doc, chartData);
        break;
      default:
        doc.text(JSON.stringify(chartData.data, null, 2), { indent: 20 });
    }
    
    doc.moveDown();
  }

  // Include helper methods from original implementation
  addPieChartText(doc, chartData) {
    doc.fontSize(12)
       .text('Pie Chart Data:', { underline: true })
       .moveDown(0.5);

    const total = chartData.data.reduce((sum, item) => sum + (item.value || 0), 0);
    
    chartData.data.forEach(item => {
      const percentage = total > 0 ? ((item.value / total) * 100).toFixed(1) : 0;
      doc.fontSize(11)
         .text(`• ${item.name || item.label}: ${item.value} (${percentage}%)`, {
           indent: 20
         });
    });
  }

  addBarChartText(doc, chartData) {
    doc.fontSize(12)
       .text('Bar Chart Data:', { underline: true })
       .moveDown(0.5);

    const maxValue = Math.max(...chartData.data.map(item => item.value || 0));
    
    chartData.data.forEach(item => {
      const barLength = maxValue > 0 ? Math.floor((item.value / maxValue) * 30) : 0;
      const bar = '█'.repeat(barLength);
      
      doc.fontSize(11)
         .text(`${item.label || item.name}: ${bar} ${item.value}`, {
           indent: 20
         });
    });
  }

  addLineChartText(doc, chartData) {
    doc.fontSize(12)
       .text('Line Chart Data:', { underline: true })
       .moveDown(0.5);

    chartData.data.forEach((item, index) => {
      doc.fontSize(11)
         .text(`Point ${index + 1}: ${item.label || item.x} = ${item.value || item.y}`, {
           indent: 20
         });
    });
  }

  addFlowChartText(doc, chartData) {
    doc.fontSize(12)
       .text('Flow Chart:', { underline: true })
       .moveDown(0.5);

    if (chartData.nodes) {
      doc.fontSize(11)
         .text('Steps:', { indent: 20 })
         .moveDown(0.3);
      
      chartData.nodes.forEach((node, index) => {
        doc.fontSize(10)
           .text(`${index + 1}. ${node.label} (${node.type})`, {
             indent: 40
           });
      });
    }

    if (chartData.connections && chartData.connections.length > 0) {
      doc.moveDown(0.5)
         .fontSize(11)
         .text('Flow:', { indent: 20 })
         .moveDown(0.3);
      
      chartData.connections.forEach(conn => {
        const fromNode = chartData.nodes.find(n => n.id === conn.from);
        const toNode = chartData.nodes.find(n => n.id === conn.to);
        if (fromNode && toNode) {
          doc.fontSize(10)
             .text(`${fromNode.label} → ${toNode.label}`, {
               indent: 40
             });
        }
      });
    }
  }

  getNodeColor(type) {
    const colors = {
      'start': '#10B981',
      'end': '#EF4444',
      'process': '#3B82F6',
      'decision': '#F59E0B',
      'default': '#6B7280'
    };
    return colors[type] || colors.default;
  }

  getDefaultColor(index) {
    const colors = [
      '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', 
      '#9966FF', '#FF9F40', '#FF6384', '#C9CBCF'
    ];
    return colors[index % colors.length];
  }

  // Standard helper methods
  addHeader(doc, title) {
    doc.fontSize(20)
       .font('Helvetica-Bold')
       .text(title, {
         align: 'center',
         underline: true
       })
       .moveDown(2);
    
    doc.font('Helvetica')
       .fontSize(12);
  }

  addMetadata(doc, metadata) {
    doc.fontSize(10)
       .fillColor('#666666');

    Object.entries(metadata).forEach(([key, value]) => {
      doc.text(`${key}: ${value}`);
    });

    doc.fillColor('#000000')
       .moveDown(2);
  }

  addFormattedText(doc, text) {
    const lines = text.split('\n');
    
    lines.forEach(line => {
      if (line.startsWith('# ')) {
        doc.fontSize(18)
           .font('Helvetica-Bold')
           .text(line.substring(2))
           .font('Helvetica')
           .fontSize(12);
      } else if (line.startsWith('## ')) {
        doc.fontSize(16)
           .font('Helvetica-Bold')
           .text(line.substring(3))
           .font('Helvetica')
           .fontSize(12);
      } else if (line.startsWith('### ')) {
        doc.fontSize(14)
           .font('Helvetica-Bold')
           .text(line.substring(4))
           .font('Helvetica')
           .fontSize(12);
      } else if (line.startsWith('- ') || line.startsWith('* ')) {
        doc.text(`• ${line.substring(2)}`, {
          indent: 20,
          width: 450
        });
      } else if (line.trim()) {
        doc.text(line, {
          align: 'justify',
          width: 450
        });
      } else {
        doc.moveDown(0.5);
      }
    });
  }

  addCodeBlock(doc, code) {
    doc.font('Courier')
       .fontSize(10)
       .fillColor('#333333')
       .text(code, {
         indent: 20,
         width: 450
       })
       .font('Helvetica')
       .fillColor('#000000');
  }

  addFooter(doc) {
    // Don't add footer for now to avoid page switching issues
    // PDFKit has issues with switching pages after content is written
    return;
  }

  async addSectionsWithCharts(doc, sections, charts = [], svgCharts = []) {
    // Process sections
    for (const section of sections) {
      if (section.title) {
        doc.fontSize(16)
           .font('Helvetica-Bold')
           .text(section.title)
           .font('Helvetica')
           .moveDown(0.5);
      }

      if (section.content) {
        // For structured PDF content, add as formatted text directly
        this.addFormattedText(doc, section.content);
        doc.moveDown(0.5);
      }

      // Handle subsections
      if (section.subsections && section.subsections.length > 0) {
        for (const subsection of section.subsections) {
          if (subsection.title) {
            doc.fontSize(14)
               .font('Helvetica-Bold')
               .text(subsection.title, { indent: 20 })
               .font('Helvetica')
               .moveDown(0.3);
          }
          
          if (subsection.content) {
            doc.fontSize(12)
               .text(subsection.content, { 
                 indent: 20,
                 width: 450
               })
               .moveDown(0.5);
          }
        }
      }

      if (section.bullets) {
        section.bullets.forEach(bullet => {
          doc.fontSize(12)
             .text(`• ${bullet}`, {
               indent: 20,
               width: 450
             });
        });
      }

      if (section.code) {
        this.addCodeBlock(doc, section.code);
      }

      doc.moveDown(1.5);
    }
    
    // Process any charts at the end
    if ((charts && charts.length > 0) || (svgCharts && svgCharts.length > 0)) {
      doc.addPage();
      doc.fontSize(18)
         .font('Helvetica-Bold')
         .text('Charts and Visualizations', { align: 'center' })
         .font('Helvetica')
         .moveDown(2);
      
      // Add SVG charts if provided
      if (svgCharts && svgCharts.length > 0) {
        for (const svgChart of svgCharts) {
          await this.addSvgChart(doc, svgChart);
          doc.moveDown(2);
        }
      }
      
      // Add regular charts
      if (charts && charts.length > 0) {
        for (const chart of charts) {
          await this.addChart(doc, chart);
          doc.moveDown(2);
        }
      }
    }
  }

  // All quiz and study guide methods from original
  async generateStudyGuide(data) {
    const content = {
      title: data.title || 'Study Guide',
      metadata: {
        'Subject': data.subject || 'General',
        'Generated': new Date().toLocaleDateString(),
        'Topics': data.topics ? data.topics.join(', ') : 'Various'
      },
      sections: this.formatStudyGuideSections(data)
    };

    return this.generateFromAIResponse(content);
  }

  async generateQuizPDF(quizData) {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument(this.defaultOptions);
        const chunks = [];
        
        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Title page
        doc.fontSize(24)
           .text(quizData.title || 'Quiz', 50, 50, { align: 'center' });
        
        doc.fontSize(12)
           .text(`Subject: ${quizData.subject || 'General'}`, { align: 'center' })
           .text(`Date: ${new Date().toLocaleDateString()}`, { align: 'center' })
           .moveDown(2);

        // Questions
        doc.addPage();
        doc.fontSize(18).text('Questions', { underline: true }).moveDown();

        quizData.questions.forEach((q, index) => {
          doc.fontSize(14)
             .text(`${index + 1}. ${q.question}`)
             .moveDown(0.5);

          if (q.options && q.options.length > 0) {
            q.options.forEach((option, i) => {
              doc.fontSize(12)
                 .text(`   ${String.fromCharCode(65 + i)}. ${option}`, {
                   indent: 20
                 });
            });
          }

          doc.moveDown(1.5);

          if (doc.y > 650) {
            doc.addPage();
          }
        });

        // Answer key
        doc.addPage();
        doc.fontSize(18).text('Answer Key', { underline: true }).moveDown();

        quizData.questions.forEach((q, index) => {
          doc.fontSize(12)
             .text(`${index + 1}. ${q.correctAnswer}`, {
               indent: 20
             });
          
          if (q.explanation) {
            doc.fontSize(10)
               .text(`   Explanation: ${q.explanation}`, {
                 indent: 40,
                 width: 400
               });
          }
          doc.moveDown(0.5);
        });

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  async generateFlashcardsPDF(data) {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument(this.defaultOptions);
        const chunks = [];

        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Title
        doc.fontSize(24)
           .font('Helvetica-Bold')
           .text(data.title || 'Flashcards', { align: 'center' })
           .font('Helvetica')
           .fontSize(12)
           .text(`${data.cards?.length || 0} cards`, { align: 'center' })
           .text(`Date: ${new Date().toLocaleDateString()}`, { align: 'center' })
           .moveDown(2);

        // Cards
        if (data.cards && data.cards.length > 0) {
          data.cards.forEach((card, index) => {
            // Check if we need a new page
            if (doc.y > 650) {
              doc.addPage();
            }

            doc.fontSize(13)
               .font('Helvetica-Bold')
               .text(`Card ${index + 1}`, { underline: true })
               .moveDown(0.3);

            doc.fontSize(12)
               .font('Helvetica-Bold')
               .text('Question: ', { continued: true })
               .font('Helvetica')
               .text(card.front || card.question || '')
               .moveDown(0.3);

            doc.font('Helvetica-Bold')
               .text('Answer: ', { continued: true })
               .font('Helvetica')
               .text(card.back || card.answer || '')
               .moveDown(1);
          });
        }

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  async generateConversationPDF(data) {
    return new Promise(async (resolve, reject) => {
      try {
        const doc = new PDFDocument({
          ...this.defaultOptions,
        });

        const chunks = [];
        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Title
        doc.fontSize(24)
           .font('Helvetica-Bold')
           .text(data.title || 'Chat Conversation', { align: 'center' })
           .font('Helvetica')
           .fontSize(12)
           .text(`${data.messages?.length || 0} messages`, { align: 'center' })
           .text(`Date: ${new Date().toLocaleDateString()}`, { align: 'center' })
           .moveDown(2);

        // Messages
        if (data.messages && data.messages.length > 0) {
          data.messages.forEach((msg) => {
            if (doc.y > 650) {
              doc.addPage();
            }

            const isUser = msg.role === 'user';
            const label = isUser ? 'You' : 'BrainLift';
            const labelColor = isUser ? '#8B5CF6' : '#3B82F6';

            doc.fontSize(13)
               .font('Helvetica-Bold')
               .fillColor(labelColor)
               .text(label + ':')
               .fillColor('#000000')
               .font('Helvetica')
               .fontSize(12);

            // Render the message content with formatting
            this.addFormattedText(doc, msg.content || '');
            doc.moveDown(1);
          });
        }

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  async generateChatSummary(messages, metadata = {}) {
    const content = {
      title: 'Chat Summary',
      metadata: {
        'Date': new Date().toLocaleDateString(),
        'Messages': messages.length,
        ...metadata
      },
      sections: this.formatChatMessages(messages)
    };

    return this.generateFromAIResponse(content);
  }

  formatStudyGuideSections(data) {
    const sections = [];

    if (data.overview) {
      sections.push({
        title: 'Overview',
        content: data.overview
      });
    }

    if (data.concepts) {
      sections.push({
        title: 'Key Concepts',
        bullets: data.concepts
      });
    }

    if (data.topics) {
      data.topics.forEach(topic => {
        sections.push({
          title: topic.title,
          content: topic.content,
          bullets: topic.points
        });
      });
    }

    if (data.summary) {
      sections.push({
        title: 'Summary',
        content: data.summary
      });
    }

    return sections;
  }

  formatChatMessages(messages) {
    const sections = [];
    let currentSection = null;

    messages.forEach(msg => {
      if (msg.role === 'user') {
        if (currentSection) {
          sections.push(currentSection);
        }
        currentSection = {
          title: `Q: ${msg.content.substring(0, 100)}${msg.content.length > 100 ? '...' : ''}`,
          content: ''
        };
      } else if (msg.role === 'assistant' && currentSection) {
        currentSection.content = msg.content;
      }
    });

    if (currentSection) {
      sections.push(currentSection);
    }

    return sections;
  }
}

module.exports = new PDFGeneratorSafe();