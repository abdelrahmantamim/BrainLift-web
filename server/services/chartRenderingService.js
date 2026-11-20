import puppeteer from 'puppeteer';
import { ChartJSNodeCanvas } from 'chartjs-node-canvas';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Chart.js renderer
const chartJSNodeCanvas = new ChartJSNodeCanvas({ 
  width: 800, 
  height: 600,
  backgroundColour: 'white'
});

export async function renderChart(chartSpec) {
  const { type, title, data } = chartSpec;

  switch (type) {
    case 'bar':
    case 'line':
    case 'pie':
      return renderChartJS(type, title, data);
    
    case 'flow':
    case 'mind':
    case 'sequence':
    case 'gantt':
      return renderMermaid(type, title, data);
    
    default:
      throw new Error(`Unsupported chart type: ${type}`);
  }
}

async function renderChartJS(type, title, data) {
  const configuration = {
    type,
    data: type === 'pie' ? {
      labels: data.labels,
      datasets: [{
        data: data.values,
        backgroundColor: [
          '#FF6384',
          '#36A2EB',
          '#FFCE56',
          '#4BC0C0',
          '#9966FF',
          '#FF9F40'
        ]
      }]
    } : data,
    options: {
      responsive: true,
      plugins: {
        title: {
          display: true,
          text: title,
          font: {
            size: 18
          }
        },
        legend: {
          display: true,
          position: 'top'
        }
      },
      scales: type !== 'pie' ? {
        y: {
          beginAtZero: true
        }
      } : undefined
    }
  };

  const imageBuffer = await chartJSNodeCanvas.renderToBuffer(configuration);
  return {
    buffer: imageBuffer,
    mimeType: 'image/png',
    width: 800,
    height: 600
  };
}

async function renderMermaid(type, title, data) {
  let mermaidCode = '';

  switch (type) {
    case 'flow':
      mermaidCode = generateFlowchart(data);
      break;
    case 'mind':
      mermaidCode = generateMindMap(data);
      break;
    case 'sequence':
      mermaidCode = generateSequenceDiagram(data);
      break;
    case 'gantt':
      mermaidCode = generateGanttChart(data);
      break;
  }

  // Create temp file for mermaid
  const tempInput = path.join(__dirname, `temp-${Date.now()}.mmd`);
  const tempOutput = path.join(__dirname, `temp-${Date.now()}.png`);

  try {
    await fs.writeFile(tempInput, mermaidCode);

    // Use puppeteer to render mermaid
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setContent(`
      <!DOCTYPE html>
      <html>
      <head>
        <script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>
        <script>mermaid.initialize({ startOnLoad: true });</script>
        <style>
          body { 
            margin: 0; 
            padding: 20px; 
            background: white;
            font-family: Arial, sans-serif;
          }
          h2 {
            text-align: center;
            margin-bottom: 20px;
          }
          .mermaid {
            text-align: center;
          }
        </style>
      </head>
      <body>
        <h2>${title}</h2>
        <div class="mermaid">
          ${mermaidCode}
        </div>
      </body>
      </html>
    `);

    await page.waitForSelector('.mermaid svg');
    
    // Get dimensions
    const dimensions = await page.evaluate(() => {
      const svg = document.querySelector('.mermaid svg');
      const bbox = svg.getBoundingClientRect();
      return {
        width: Math.ceil(bbox.width + 40),
        height: Math.ceil(bbox.height + 100)
      };
    });

    await page.setViewport({
      width: dimensions.width,
      height: dimensions.height
    });

    const screenshot = await page.screenshot({
      type: 'png',
      fullPage: true
    });

    await browser.close();

    // Cleanup temp files
    await fs.unlink(tempInput).catch(() => {});

    return {
      buffer: screenshot,
      mimeType: 'image/png',
      width: dimensions.width,
      height: dimensions.height
    };

  } catch (error) {
    // Cleanup on error
    await fs.unlink(tempInput).catch(() => {});
    await fs.unlink(tempOutput).catch(() => {});
    throw error;
  }
}

function generateFlowchart(data) {
  let mermaid = 'graph TD\n';
  
  // Add nodes
  data.nodes.forEach(node => {
    mermaid += `    ${node.id}["${node.label}"]\n`;
  });
  
  // Add edges
  data.edges.forEach(edge => {
    const label = edge.label ? `|${edge.label}|` : '';
    mermaid += `    ${edge.from} --> ${label} ${edge.to}\n`;
  });
  
  return mermaid;
}

function generateMindMap(data) {
  function buildMindMap(node, indent = '') {
    let result = `${indent}${node.text || node}\n`;
    if (node.children) {
      node.children.forEach(child => {
        result += buildMindMap(child, indent + '  ');
      });
    }
    return result;
  }

  return `mindmap
  root((${data.root}))
${data.children.map(child => buildMindMap(child, '    ')).join('')}`;
}

function generateSequenceDiagram(data) {
  let mermaid = 'sequenceDiagram\n';
  
  // Add actors
  data.actors.forEach(actor => {
    mermaid += `    participant ${actor}\n`;
  });
  
  // Add messages
  data.messages.forEach(msg => {
    mermaid += `    ${msg.from}->>+${msg.to}: ${msg.text}\n`;
  });
  
  return mermaid;
}

function generateGanttChart(data) {
  let mermaid = 'gantt\n';
  mermaid += '    title ' + (data.title || 'Project Timeline') + '\n';
  mermaid += '    dateFormat YYYY-MM-DD\n';
  
  data.tasks.forEach(task => {
    const status = task.progress === 100 ? 'done' : 
                  task.progress > 0 ? 'active' : 'crit';
    mermaid += `    ${task.name} :${status}, ${task.start}, ${task.end}\n`;
  });
  
  return mermaid;
}

// Function to create thumbnail
export async function createThumbnail(imageBuffer, maxWidth = 300, maxHeight = 200) {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  const base64Image = imageBuffer.toString('base64');
  
  await page.setContent(`
    <!DOCTYPE html>
    <html>
    <body style="margin: 0; display: flex; align-items: center; justify-content: center; min-height: 100vh;">
      <img id="image" src="data:image/png;base64,${base64Image}" style="max-width: ${maxWidth}px; max-height: ${maxHeight}px; object-fit: contain;">
    </body>
    </html>
  `);

  const dimensions = await page.evaluate(() => {
    const img = document.getElementById('image');
    return {
      width: img.naturalWidth,
      height: img.naturalHeight,
      displayWidth: img.width,
      displayHeight: img.height
    };
  });

  await page.setViewport({
    width: dimensions.displayWidth,
    height: dimensions.displayHeight
  });

  const thumbnail = await page.screenshot({
    type: 'png',
    omitBackground: true
  });

  await browser.close();

  return {
    buffer: thumbnail,
    width: dimensions.displayWidth,
    height: dimensions.displayHeight
  };
}