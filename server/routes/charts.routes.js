import express from 'express';
import { checkSubscriptionLimit } from '../middleware/subscriptionLimits.middleware.js';
import { chartGenerationService } from '../services/chartGenerationService.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = express.Router();

function validateChartGeneration(req, res, next) {
  const { chartData } = req.body || {};
  if (!chartData) return res.status(400).json({ success: false, error: 'Chart data is required' });
  if (!chartData.type || !chartData.data) return res.status(400).json({ success: false, error: 'Invalid chart data format. Must include type and data fields.' });
  next();
}

// Generate chart from JSON data
router.post('/generate', requireAuth, validateChartGeneration, checkSubscriptionLimit('chart'), async (req, res) => {
  try {
    const { chartData } = req.body;

    // Generate chart images
    const result = await chartGenerationService.generateChart(chartData);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error || 'Failed to generate chart'
      });
    }

    // Convert buffers to base64 for transmission
    const response = {
      success: true,
      chartId: result.chartId,
      preview: {
        data: result.preview.buffer.toString('base64'),
        mimeType: result.preview.mimeType,
        width: result.preview.width,
        height: result.preview.height
      },
      full: {
        data: result.full.buffer.toString('base64'),
        mimeType: result.full.mimeType,
        width: result.full.width,
        height: result.full.height
      }
    };

    res.json(response);
  } catch (error) {
    console.error('Chart generation error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
});

// Get supported chart types
router.get('/types', async (req, res) => {
  res.json({
    success: true,
    types: [
      { value: 'flow', label: 'Flow Chart', category: 'diagram' },
      { value: 'bar', label: 'Bar Chart', category: 'chart' },
      { value: 'line', label: 'Line Chart', category: 'chart' },
      { value: 'pie', label: 'Pie Chart', category: 'chart' },
      { value: 'mindmap', label: 'Mind Map', category: 'diagram' },
      { value: 'gantt', label: 'Gantt Chart', category: 'timeline' },
      { value: 'scatter', label: 'Scatter Plot', category: 'chart' },
      { value: 'area', label: 'Area Chart', category: 'chart' },
      { value: 'radar', label: 'Radar Chart', category: 'chart' },
      { value: 'tree', label: 'Tree Diagram', category: 'diagram' },
      { value: 'network', label: 'Network Diagram', category: 'diagram' },
      { value: 'sankey', label: 'Sankey Diagram', category: 'flow' },
      { value: 'bubble', label: 'Bubble Chart', category: 'chart' },
      { value: 'heatmap', label: 'Heat Map', category: 'chart' },
      { value: 'waterfall', label: 'Waterfall Chart', category: 'chart' }
    ]
  });
});

// Test endpoint with sample data
router.post('/test/:type', requireAuth, async (req, res) => {
  const { type } = req.params;
  
  // Generate sample data based on type
  const sampleData = getSampleData(type);
  
  if (!sampleData) {
    return res.status(400).json({
      success: false,
      error: `No sample data available for chart type: ${type}`
    });
  }

  try {
    const result = await chartGenerationService.generateChart(sampleData);
    
    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error || 'Failed to generate chart'
      });
    }

    res.json({
      success: true,
      chartId: result.chartId,
      preview: {
        data: result.preview.buffer.toString('base64'),
        mimeType: result.preview.mimeType,
        width: result.preview.width,
        height: result.preview.height
      },
      full: {
        data: result.full.buffer.toString('base64'),
        mimeType: result.full.mimeType,
        width: result.full.width,
        height: result.full.height
      }
    });
  } catch (error) {
    console.error('Test chart generation error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

function getSampleData(type) {
  const samples = {
    flow: {
      type: 'flow',
      title: 'Decision Flow Chart',
      data: {
        nodes: [
          { id: 'start', label: 'Start', type: 'start' },
          { id: 'check', label: 'Check condition?', type: 'decision' },
          { id: 'yes', label: 'Process A', type: 'process' },
          { id: 'no', label: 'Process B', type: 'process' },
          { id: 'end', label: 'End', type: 'end' }
        ],
        edges: [
          { from: 'start', to: 'check' },
          { from: 'check', to: 'yes', label: 'Yes', type: 'conditional' },
          { from: 'check', to: 'no', label: 'No', type: 'conditional' },
          { from: 'yes', to: 'end' },
          { from: 'no', to: 'end' }
        ]
      }
    },
    bar: {
      type: 'bar',
      title: 'Sales by Quarter',
      data: {
        labels: ['Q1', 'Q2', 'Q3', 'Q4'],
        datasets: [
          {
            label: '2023',
            data: [65, 59, 80, 81],
            backgroundColor: 'rgba(54, 162, 235, 0.8)'
          },
          {
            label: '2024',
            data: [85, 69, 90, 101],
            backgroundColor: 'rgba(255, 99, 132, 0.8)'
          }
        ]
      }
    },
    line: {
      type: 'line',
      title: 'Temperature Over Time',
      data: {
        labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
        datasets: [
          {
            label: 'Temperature (°C)',
            data: [5, 7, 12, 18, 22, 25],
            borderColor: 'rgb(75, 192, 192)',
            tension: 0.1
          }
        ]
      }
    },
    pie: {
      type: 'pie',
      title: 'Market Share',
      data: {
        labels: ['Product A', 'Product B', 'Product C', 'Product D'],
        values: [30, 25, 20, 25]
      }
    },
    mindmap: {
      type: 'mindmap',
      title: 'Project Planning',
      data: {
        root: {
          id: 'main',
          text: 'Project',
          children: [
            {
              id: 'planning',
              text: 'Planning',
              children: [
                { id: 'req', text: 'Requirements' },
                { id: 'design', text: 'Design' }
              ]
            },
            {
              id: 'dev',
              text: 'Development',
              children: [
                { id: 'frontend', text: 'Frontend' },
                { id: 'backend', text: 'Backend' }
              ]
            }
          ]
        }
      }
    }
  };

  return samples[type];
}

export default router;
