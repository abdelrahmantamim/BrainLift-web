import { ChartJSNodeCanvas } from 'chartjs-node-canvas';
import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Default dimensions for different screen sizes
const DIMENSIONS = {
  preview: { width: 300, height: 200 },
  phone: { width: 375, height: 667 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1920, height: 1080 }
};

export class ChartGenerationService {
  constructor() {
    this.chartRenderers = new Map();
    this.initializeRenderers();
  }

  initializeRenderers() {
    // Initialize Chart.js renderers for different sizes
    this.chartRenderers.set('preview', new ChartJSNodeCanvas({
      width: DIMENSIONS.preview.width,
      height: DIMENSIONS.preview.height,
      backgroundColour: 'white'
    }));

    this.chartRenderers.set('full', new ChartJSNodeCanvas({
      width: 1200, // More reasonable size for full view
      height: 800,
      backgroundColour: 'white'
    }));

    this.chartRenderers.set('phone', new ChartJSNodeCanvas({
      width: DIMENSIONS.phone.width,
      height: DIMENSIONS.phone.height,
      backgroundColour: 'white'
    }));

    this.chartRenderers.set('tablet', new ChartJSNodeCanvas({
      width: DIMENSIONS.tablet.width,
      height: DIMENSIONS.tablet.height,
      backgroundColour: 'white'
    }));
  }

  async generateChart(chartData) {
    const chartId = crypto.randomBytes(16).toString('hex');
    
    try {
      console.log('[ChartGenerationService] Generating chart:', {
        type: chartData.type,
        hasData: !!chartData.data,
        dataKeys: chartData.data ? Object.keys(chartData.data) : []
      });

      // Generate both preview and full-size images
      const preview = await this.renderChart(chartData, 'preview');
      const full = await this.renderChart(chartData, 'full');

      if (!preview || !full) {
        throw new Error('Failed to render chart images');
      }

      return {
        success: true,
        chartId,
        preview: {
          buffer: preview.buffer,
          mimeType: preview.mimeType,
          width: preview.width,
          height: preview.height
        },
        full: {
          buffer: full.buffer,
          mimeType: full.mimeType,
          width: full.width,
          height: full.height
        }
      };
    } catch (error) {
      console.error('[ChartGenerationService] Error:', error);
      return {
        success: false,
        error: error.message || 'Unknown error'
      };
    }
  }

  async renderChart(chartData, size = 'full') {
    const { type } = chartData;

    // Chart.js supported types
    const chartJsTypes = ['bar', 'line', 'pie', 'scatter', 'area', 'radar', 'bubble'];
    
    // Mermaid supported types
    const mermaidTypes = ['flow', 'mindmap', 'gantt', 'sankey', 'network'];
    
    // Custom implementation types
    const customTypes = ['tree', 'heatmap', 'waterfall'];

    if (chartJsTypes.includes(type)) {
      return this.renderChartJS(chartData, size);
    } else if (mermaidTypes.includes(type)) {
      return this.renderMermaid(chartData, size);
    } else if (customTypes.includes(type)) {
      return this.renderCustomChart(chartData, size);
    } else {
      throw new Error(`Unsupported chart type: ${type}`);
    }
  }

  async renderChartJS(chartData, size) {
    const { type, title, subtitle, data, config } = chartData;
    const renderer = this.chartRenderers.get(size);
    
    if (!renderer) {
      throw new Error(`No renderer found for size: ${size}`);
    }
    
    // Log the raw data for debugging pie charts
    if (type === 'pie') {
      console.log('[ChartGenerationService] Pie chart raw data:', JSON.stringify(data, null, 2));
    }
    
    // Get dimensions based on the renderer's configuration
    const dimensions = config?.dimensions?.[size] || 
                      (size === 'full' ? { width: 1200, height: 800 } : DIMENSIONS[size]) ||
                      DIMENSIONS.desktop;

    const configuration = {
      type: type === 'area' ? 'line' : type,
      data: this.formatChartJSData(type, data),
      options: {
        responsive: false,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: !!title,
            text: title,
            font: { size: size === 'preview' ? 14 : 24 }
          },
          subtitle: {
            display: !!subtitle,
            text: subtitle,
            font: { size: size === 'preview' ? 12 : 18 }
          },
          legend: {
            display: type !== 'scatter' && type !== 'bubble',
            position: 'top',
            labels: {
              font: { size: size === 'preview' ? 10 : 14 }
            }
          }
        },
        scales: this.getScales(type, data)
      }
    };

    // Apply custom config
    if (config) {
      if (config.colors) {
        configuration.data.datasets.forEach((dataset, i) => {
          dataset.backgroundColor = config.colors[i % config.colors.length];
          dataset.borderColor = config.colors[i % config.colors.length];
        });
      }
    }

    const buffer = await renderer.renderToBuffer(configuration);
    
    return {
      buffer,
      mimeType: 'image/png',
      width: dimensions.width,
      height: dimensions.height
    };
  }

  formatChartJSData(type, data) {
    switch (type) {
      case 'pie':
        // Handle both simple format and Chart.js format
        if (data.datasets && Array.isArray(data.datasets)) {
          // Chart.js format already provided
          return {
            labels: data.labels,
            datasets: data.datasets.map(dataset => ({
              ...dataset,
              backgroundColor: dataset.backgroundColor || this.getDefaultColors()
            }))
          };
        } else {
          // Simple format with labels and values
          return {
            labels: data.labels,
            datasets: [{
              data: data.values,
              backgroundColor: data.colors || this.getDefaultColors()
            }]
          };
        }

      case 'bar':
      case 'line':
        // Handle both simple format and Chart.js format
        if (data.datasets && Array.isArray(data.datasets)) {
          // Chart.js format already provided
          return {
            labels: data.labels,
            datasets: data.datasets.map((dataset, i) => ({
              ...dataset,
              backgroundColor: dataset.backgroundColor || this.getDefaultColors()[i % this.getDefaultColors().length],
              borderColor: dataset.borderColor || dataset.backgroundColor || this.getDefaultColors()[i % this.getDefaultColors().length],
              fill: type === 'area' || dataset.fill
            }))
          };
        } else {
          // Simple format - convert to Chart.js format
          console.warn(`[ChartGenerationService] ${type} chart data is not in Chart.js format, attempting conversion`);
          return {
            labels: data.labels || [],
            datasets: [{
              label: 'Data',
              data: data.values || [],
              backgroundColor: this.getDefaultColors()[0],
              borderColor: this.getDefaultColors()[0],
              fill: false
            }]
          };
        }

      case 'area':
        // Handle both simple format and Chart.js format
        if (data.datasets && Array.isArray(data.datasets)) {
          // Chart.js format already provided
          return {
            labels: data.labels,
            datasets: data.datasets.map((dataset, i) => ({
              ...dataset,
              backgroundColor: dataset.backgroundColor || this.getDefaultColors(0.2)[i % this.getDefaultColors().length],
              borderColor: dataset.borderColor || dataset.backgroundColor || this.getDefaultColors()[i % this.getDefaultColors().length],
              fill: true
            }))
          };
        } else {
          // Simple format - convert to Chart.js format
          console.warn('[ChartGenerationService] Area chart data is not in Chart.js format, attempting conversion');
          return {
            labels: data.labels || [],
            datasets: [{
              label: 'Data',
              data: data.values || [],
              backgroundColor: this.getDefaultColors(0.2)[0],
              borderColor: this.getDefaultColors()[0],
              fill: true
            }]
          };
        }

      case 'scatter':
      case 'bubble':
        return {
          datasets: data.datasets.map((dataset, i) => ({
            ...dataset,
            backgroundColor: dataset.backgroundColor || this.getDefaultColors()[i]
          }))
        };

      case 'radar':
        return {
          labels: data.labels,
          datasets: data.datasets.map((dataset, i) => ({
            ...dataset,
            backgroundColor: dataset.backgroundColor || this.getDefaultColors(0.2)[i],
            borderColor: dataset.borderColor || this.getDefaultColors()[i]
          }))
        };

      default:
        return data;
    }
  }

  getScales(type, data) {
    switch (type) {
      case 'pie':
      case 'radar':
        return undefined;

      case 'scatter':
      case 'bubble':
        return {
          x: {
            type: 'linear',
            position: 'bottom',
            title: {
              display: !!data.xAxis?.label,
              text: data.xAxis?.label
            },
            min: data.xAxis?.min,
            max: data.xAxis?.max
          },
          y: {
            type: 'linear',
            position: 'left',
            title: {
              display: !!data.yAxis?.label,
              text: data.yAxis?.label
            },
            min: data.yAxis?.min,
            max: data.yAxis?.max
          }
        };

      default:
        return {
          x: {
            display: true,
            title: {
              display: !!data.xAxis?.label,
              text: data.xAxis?.label
            }
          },
          y: {
            display: true,
            beginAtZero: true,
            title: {
              display: !!data.yAxis?.label,
              text: data.yAxis?.label
            }
          }
        };
    }
  }

  async renderMermaid(chartData, size) {
    const { type, title, data } = chartData;
    const dimensions = chartData.config?.dimensions?.[size] || 
                      (size === 'full' ? { width: 1200, height: 800 } : DIMENSIONS[size]) ||
                      DIMENSIONS.desktop;
    
    let mermaidCode = '';

    switch (type) {
      case 'flow':
        mermaidCode = this.generateFlowchart(data);
        break;
      case 'mindmap':
        mermaidCode = this.generateMindMap(data);
        break;
      case 'gantt':
        mermaidCode = this.generateGanttChart(data);
        break;
      case 'network':
        mermaidCode = this.generateNetworkDiagram(data);
        break;
      case 'sankey':
        mermaidCode = this.generateSankeyDiagram(data);
        break;
    }

    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
      const page = await browser.newPage();
      
      // Set a reasonable timeout
      page.setDefaultTimeout(15000);
      
      await page.setViewport({
        width: dimensions.width,
        height: dimensions.height
      });

      // Log only if there's an issue
      // console.log('[ChartGenerationService] Mermaid code to render:', mermaidCode);
      
      await page.setContent(`
        <!DOCTYPE html>
        <html>
        <head>
          <script src="https://cdn.jsdelivr.net/npm/mermaid@9.4.3/dist/mermaid.min.js"></script>
          <script>
            mermaid.initialize({ 
              startOnLoad: true,
              theme: 'default',
              flowchart: {
                htmlLabels: true,
                curve: 'basis'
              },
              themeVariables: {
                fontSize: '${size === 'preview' ? '12px' : '16px'}'
              }
            });
          </script>
          <style>
            body { 
              margin: 0; 
              padding: 10px; 
              background: white;
              font-family: Arial, sans-serif;
              display: flex;
              flex-direction: column;
              align-items: center;
            }
            h2 {
              text-align: center;
              margin-bottom: 10px;
              font-size: ${size === 'preview' ? '16px' : '24px'};
            }
            .mermaid {
              max-width: 100%;
              overflow: visible;
            }
            /* Ensure the SVG fits its content */
            .mermaid svg {
              max-width: 100%;
              height: auto;
            }
          </style>
        </head>
        <body>
          ${title ? `<h2>${title}</h2>` : ''}
          <div class="mermaid">
            ${mermaidCode}
          </div>
        </body>
        </html>
      `, { waitUntil: 'networkidle0' });

      // Give Mermaid a moment to initialize
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Wait for Mermaid to render or show error
      await page.waitForFunction(() => {
        const mermaidDiv = document.querySelector('.mermaid');
        return mermaidDiv && (mermaidDiv.querySelector('svg') || mermaidDiv.textContent.includes('error'));
      }, { timeout: 10000 });
      
      // Debug: Check if SVG was created successfully
      const hasSvg = await page.evaluate(() => {
        const mermaidDiv = document.querySelector('.mermaid');
        return mermaidDiv && mermaidDiv.querySelector('svg') !== null;
      });
      
      if (!hasSvg) {
        console.log('[ChartGenerationService] Warning: No SVG generated');
      }
      
      // Check if there's an error (look for actual Mermaid error messages, not CSS with 'error' in class names)
      const hasError = await page.evaluate(() => {
        const mermaidDiv = document.querySelector('.mermaid');
        if (!mermaidDiv) return false;
        
        // Check if SVG was created - if yes, it's successful
        if (mermaidDiv.querySelector('svg')) return false;
        
        // Check for actual error indicators
        const text = mermaidDiv.textContent || '';
        return text.includes('Syntax error') || text.includes('Parse error') || text.includes('error in text');
      });
      
      if (hasError) {
        const errorText = await page.evaluate(() => {
          const mermaidDiv = document.querySelector('.mermaid');
          return mermaidDiv ? mermaidDiv.textContent : 'Unknown error';
        });
        throw new Error(`Mermaid rendering error: ${errorText}`);
      }
      
      // Get the bounding box of the actual content with tighter bounds
      const boundingBox = await page.evaluate(() => {
        const svg = document.querySelector('.mermaid svg');
        const title = document.querySelector('h2');
        
        if (!svg) return null;
        
        // Get the actual SVG bounding box
        const svgBBox = svg.getBBox();
        const svgRect = svg.getBoundingClientRect();
        
        // Calculate the actual content area
        const contentWidth = Math.max(svgBBox.width, svgRect.width);
        const contentHeight = Math.max(svgBBox.height, svgRect.height);
        
        // Use smaller padding for tighter bounds
        const padding = 10;
        
        let top = svgRect.top;
        let totalHeight = contentHeight;
        
        // Include title if present
        if (title) {
          const titleRect = title.getBoundingClientRect();
          top = titleRect.top;
          totalHeight = (svgRect.bottom - titleRect.top);
        }
        
        // Calculate 5-10% extra space
        const extraSpace = 1.05; // 5% extra
        
        return {
          x: Math.max(0, svgRect.left - padding),
          y: Math.max(0, top - padding),
          width: Math.ceil(contentWidth * extraSpace) + (padding * 2),
          height: Math.ceil(totalHeight * extraSpace) + (padding * 2)
        };
      });
      
      const screenshot = await page.screenshot({
        type: 'png',
        clip: boundingBox || undefined,
        fullPage: false
      });

      return {
        buffer: screenshot,
        mimeType: 'image/png',
        width: dimensions.width,
        height: dimensions.height
      };
    } finally {
      await browser.close();
    }
  }

  generateFlowchart(data) {
    let mermaid = 'graph TD\n';
    
    // Mermaid reserved words that need to be escaped
    const reservedWords = ['end', 'graph', 'subgraph', 'style', 'class', 'click', 'link'];
    
    // Function to escape node IDs if they're reserved words
    const escapeNodeId = (id) => {
      if (reservedWords.includes(id.toLowerCase())) {
        return `${id}_node`;
      }
      return id;
    };
    
    // Create a mapping of original IDs to escaped IDs
    const idMap = {};
    data.nodes.forEach(node => {
      idMap[node.id] = escapeNodeId(node.id);
    });
    
    // Add nodes
    data.nodes.forEach(node => {
      const escapedId = idMap[node.id];
      const shape = this.getNodeShape(node.type);
      // For labels with special characters, wrap in brackets
      const label = node.label;
      mermaid += `    ${escapedId}${shape[0]}${label}${shape[1]}\n`;
      
      // Add styling if color is provided
      if (node.color) {
        // Ensure color is in a format Mermaid accepts
        const color = node.color.startsWith('#') ? node.color : `#${node.color}`;
        mermaid += `    style ${escapedId} fill:${color}\n`;
      }
    });
    
    // Add edges (handle both 'edges' and 'connections' properties)
    const edges = data.edges || data.connections || [];
    edges.forEach(edge => {
      const fromId = idMap[edge.from] || edge.from;
      const toId = idMap[edge.to] || edge.to;
      const arrow = edge.type === 'conditional' ? '-.->|' : '-->';
      const label = edge.label ? `|${edge.label}|` : '';
      mermaid += `    ${fromId} ${arrow}${label} ${toId}\n`;
    });
    
    return mermaid;
  }

  getNodeShape(type) {
    switch (type) {
      case 'start':
      case 'end':
        return ['((', '))'];
      case 'process':
        return ['[', ']'];
      case 'decision':
        return ['{', '}'];
      case 'data':
        return ['[(', ')]'];
      default:
        return ['[', ']'];
    }
  }

  generateMindMap(data) {
    function buildMindMap(node, indent = '') {
      let result = `${indent}${node.text}\n`;
      if (node.children) {
        node.children.forEach(child => {
          result += buildMindMap(child, indent + '  ');
        });
      }
      return result;
    }

    return `mindmap
  root((${data.root.text}))
${data.root.children?.map(child => buildMindMap(child, '    ')).join('') || ''}`;
  }

  generateGanttChart(data) {
    let mermaid = 'gantt\n';
    mermaid += '    title Gantt Chart\n';
    mermaid += '    dateFormat YYYY-MM-DD\n';
    
    data.tasks.forEach(task => {
      const status = task.progress === 100 ? 'done' : 
                    task.progress > 0 ? 'active' : '';
      mermaid += `    ${task.name} :${status}, ${task.id}, ${task.start}, ${task.end}\n`;
      
      if (task.dependencies?.length) {
        task.dependencies.forEach(dep => {
          mermaid += `    ${task.name} : after ${dep}\n`;
        });
      }
    });
    
    return mermaid;
  }

  generateNetworkDiagram(data) {
    let mermaid = 'graph TB\n';
    
    // Add nodes
    data.nodes.forEach(node => {
      mermaid += `    ${node.id}["${node.label}"]\n`;
      if (node.color) {
        mermaid += `    style ${node.id} fill:${node.color}\n`;
      }
    });
    
    // Add edges
    data.edges.forEach(edge => {
      const label = edge.label ? `|${edge.label}|` : '';
      mermaid += `    ${edge.source} --- ${label} ${edge.target}\n`;
    });
    
    return mermaid;
  }

  generateSankeyDiagram(data) {
    // Mermaid doesn't support Sankey directly, so we'll use a flow diagram
    let mermaid = 'graph LR\n';
    
    // Add nodes
    data.nodes.forEach(node => {
      mermaid += `    ${node.id}["${node.label}"]\n`;
    });
    
    // Add links with thickness based on value
    data.links.forEach(link => {
      mermaid += `    ${link.source} -->|${link.value}| ${link.target}\n`;
    });
    
    return mermaid;
  }

  async renderCustomChart(chartData, size) {
    const { type } = chartData;
    
    switch (type) {
      case 'tree':
        return this.renderTreeDiagram(chartData, size);
      case 'heatmap':
        return this.renderHeatmap(chartData, size);
      case 'waterfall':
        return this.renderWaterfall(chartData, size);
      default:
        throw new Error(`Custom chart type not implemented: ${type}`);
    }
  }

  async renderTreeDiagram(chartData, size) {
    // Convert tree to Mermaid format
    const mermaidData = {
      ...chartData,
      type: 'flow',
      data: this.convertTreeToFlow(chartData.data)
    };
    
    return this.renderMermaid(mermaidData, size);
  }

  convertTreeToFlow(treeData) {
    const nodes = [];
    const edges = [];
    
    function traverse(node, parentId = null) {
      nodes.push({
        id: node.id,
        label: node.name,
        type: 'process'
      });
      
      if (parentId) {
        edges.push({
          from: parentId,
          to: node.id
        });
      }
      
      if (node.children) {
        node.children.forEach(child => traverse(child, node.id));
      }
    }
    
    traverse(treeData.root);
    
    return { nodes, edges };
  }

  async renderHeatmap(chartData, size) {
    // Use Chart.js with a custom plugin or convert to a colored grid
    // For now, we'll create a simple implementation using Canvas
    const dimensions = chartData.config?.dimensions?.[size] || 
                      (size === 'full' ? { width: 1200, height: 800 } : DIMENSIONS[size]) ||
                      DIMENSIONS.desktop;
    
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
      const page = await browser.newPage();
      await page.setViewport(dimensions);
      
      const { xLabels, yLabels, values, colorScale } = chartData.data;
      const cellWidth = Math.floor((dimensions.width - 100) / xLabels.length);
      const cellHeight = Math.floor((dimensions.height - 100) / yLabels.length);
      
      const html = this.generateHeatmapHTML(chartData, cellWidth, cellHeight, size);
      
      await page.setContent(html);
      const screenshot = await page.screenshot({ type: 'png' });
      
      return {
        buffer: screenshot,
        mimeType: 'image/png',
        width: dimensions.width,
        height: dimensions.height
      };
    } finally {
      await browser.close();
    }
  }

  generateHeatmapHTML(chartData, cellWidth, cellHeight, size) {
    const { title, data } = chartData;
    const { xLabels, yLabels, values, colorScale } = data;
    
    const minValue = colorScale?.min ?? Math.min(...values.flat());
    const maxValue = colorScale?.max ?? Math.max(...values.flat());
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body {
            margin: 0;
            padding: 20px;
            background: white;
            font-family: Arial, sans-serif;
          }
          h2 {
            text-align: center;
            font-size: ${size === 'preview' ? '16px' : '24px'};
          }
          .heatmap {
            display: inline-block;
            margin: 20px;
          }
          .row {
            display: flex;
          }
          .cell {
            width: ${cellWidth}px;
            height: ${cellHeight}px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: ${size === 'preview' ? '10px' : '14px'};
            border: 1px solid #ddd;
          }
          .label {
            font-weight: bold;
            background: #f5f5f5;
          }
        </style>
      </head>
      <body>
        ${title ? `<h2>${title}</h2>` : ''}
        <div class="heatmap">
          <div class="row">
            <div class="cell label"></div>
            ${xLabels.map(label => `<div class="cell label">${label}</div>`).join('')}
          </div>
          ${yLabels.map((yLabel, y) => `
            <div class="row">
              <div class="cell label">${yLabel}</div>
              ${xLabels.map((xLabel, x) => {
                const value = values[y][x];
                const color = this.getHeatmapColor(value, minValue, maxValue);
                return `<div class="cell" style="background-color: ${color}">${value}</div>`;
              }).join('')}
            </div>
          `).join('')}
        </div>
      </body>
      </html>
    `;
  }

  getHeatmapColor(value, min, max) {
    const normalized = (value - min) / (max - min);
    const hue = (1 - normalized) * 240; // Blue to Red
    return `hsl(${hue}, 70%, 50%)`;
  }

  async renderWaterfall(chartData, size) {
    // Convert waterfall to a special bar chart
    const { title, data } = chartData;
    const { categories, values, colors } = data;
    
    let runningTotal = 0;
    const datasets = [{
      label: 'Waterfall',
      data: values.map((item, index) => {
        const prevTotal = runningTotal;
        runningTotal += item.value;
        return {
          x: categories[index],
          y: [prevTotal, runningTotal]
        };
      }),
      backgroundColor: values.map(item => {
        if (item.type === 'increase') return colors?.increase || '#4CAF50';
        if (item.type === 'decrease') return colors?.decrease || '#F44336';
        return colors?.total || '#2196F3';
      })
    }];
    
    const barChartData = {
      type: 'bar',
      title,
      data: {
        labels: categories,
        datasets
      }
    };
    
    return this.renderChartJS(barChartData, size);
  }

  getDefaultColors(alpha = 1) {
    return [
      `rgba(255, 99, 132, ${alpha})`,
      `rgba(54, 162, 235, ${alpha})`,
      `rgba(255, 206, 86, ${alpha})`,
      `rgba(75, 192, 192, ${alpha})`,
      `rgba(153, 102, 255, ${alpha})`,
      `rgba(255, 159, 64, ${alpha})`,
      `rgba(199, 199, 199, ${alpha})`,
      `rgba(83, 102, 255, ${alpha})`,
      `rgba(255, 99, 255, ${alpha})`,
      `rgba(99, 255, 132, ${alpha})`
    ];
  }
}

// Export singleton instance
export const chartGenerationService = new ChartGenerationService();