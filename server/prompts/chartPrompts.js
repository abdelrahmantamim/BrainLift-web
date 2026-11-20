export const chartPromptTemplates = {
  flow: {
    description: 'Flow Chart - For process flows, decision trees, and workflows',
    example: {
      type: 'flow',
      title: 'User Login Flow',
      data: {
        nodes: [
          { id: 'start', label: 'Start', type: 'start' },
          { id: 'login', label: 'Enter Credentials', type: 'process' },
          { id: 'validate', label: 'Valid?', type: 'decision' },
          { id: 'success', label: 'Login Success', type: 'process' },
          { id: 'error', label: 'Show Error', type: 'process' },
          { id: 'end', label: 'End', type: 'end' }
        ],
        edges: [
          { from: 'start', to: 'login' },
          { from: 'login', to: 'validate' },
          { from: 'validate', to: 'success', label: 'Yes', type: 'conditional' },
          { from: 'validate', to: 'error', label: 'No', type: 'conditional' },
          { from: 'success', to: 'end' },
          { from: 'error', to: 'login' }
        ]
      }
    }
  },

  bar: {
    description: 'Bar Chart - For comparing quantities across categories',
    example: {
      type: 'bar',
      title: 'Monthly Sales',
      data: {
        labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May'],
        datasets: [{
          label: 'Sales 2024',
          data: [12000, 19000, 15000, 21000, 18000],
          backgroundColor: 'rgba(54, 162, 235, 0.8)'
        }]
      }
    }
  },

  line: {
    description: 'Line Chart - For showing trends over time',
    example: {
      type: 'line',
      title: 'Temperature Trend',
      data: {
        labels: ['6AM', '9AM', '12PM', '3PM', '6PM', '9PM'],
        datasets: [{
          label: 'Temperature (°C)',
          data: [18, 22, 28, 32, 29, 24],
          borderColor: 'rgb(75, 192, 192)',
          tension: 0.1
        }]
      }
    }
  },

  pie: {
    description: 'Pie Chart - For showing parts of a whole',
    example: {
      type: 'pie',
      title: 'Market Share',
      data: {
        labels: ['Product A', 'Product B', 'Product C', 'Product D'],
        values: [35, 25, 20, 20],
        colors: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0']
      }
    }
  },

  mindmap: {
    description: 'Mind Map - For brainstorming and organizing ideas',
    example: {
      type: 'mindmap',
      title: 'Project Planning',
      data: {
        root: {
          id: 'main',
          text: 'New Website',
          children: [
            {
              id: 'design',
              text: 'Design',
              children: [
                { id: 'ui', text: 'UI/UX' },
                { id: 'branding', text: 'Branding' }
              ]
            },
            {
              id: 'development',
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
  },

  gantt: {
    description: 'Gantt Chart - For project timelines and schedules',
    example: {
      type: 'gantt',
      title: 'Project Timeline',
      data: {
        tasks: [
          {
            id: 'task1',
            name: 'Research',
            start: '2024-01-01',
            end: '2024-01-15',
            progress: 100
          },
          {
            id: 'task2',
            name: 'Design',
            start: '2024-01-10',
            end: '2024-01-25',
            progress: 60,
            dependencies: ['task1']
          },
          {
            id: 'task3',
            name: 'Development',
            start: '2024-01-20',
            end: '2024-02-15',
            progress: 20,
            dependencies: ['task2']
          }
        ]
      }
    }
  },

  scatter: {
    description: 'Scatter Plot - For showing correlations between variables',
    example: {
      type: 'scatter',
      title: 'Height vs Weight',
      data: {
        datasets: [{
          label: 'Sample Data',
          data: [
            { x: 160, y: 55 },
            { x: 165, y: 60 },
            { x: 170, y: 65 },
            { x: 175, y: 70 },
            { x: 180, y: 75 }
          ],
          backgroundColor: 'rgba(255, 99, 132, 0.5)'
        }],
        xAxis: { label: 'Height (cm)' },
        yAxis: { label: 'Weight (kg)' }
      }
    }
  },

  area: {
    description: 'Area Chart - For showing cumulative totals over time',
    example: {
      type: 'area',
      title: 'Revenue Growth',
      data: {
        labels: ['Q1', 'Q2', 'Q3', 'Q4'],
        datasets: [
          {
            label: 'Product A',
            data: [10000, 15000, 18000, 22000],
            backgroundColor: 'rgba(255, 99, 132, 0.2)',
            stack: 'Stack 0'
          },
          {
            label: 'Product B',
            data: [5000, 8000, 12000, 15000],
            backgroundColor: 'rgba(54, 162, 235, 0.2)',
            stack: 'Stack 0'
          }
        ]
      }
    }
  },

  radar: {
    description: 'Radar Chart - For comparing multiple variables',
    example: {
      type: 'radar',
      title: 'Skills Assessment',
      data: {
        labels: ['Communication', 'Technical', 'Leadership', 'Creativity', 'Problem Solving'],
        datasets: [{
          label: 'Current Skills',
          data: [80, 75, 85, 70, 90],
          backgroundColor: 'rgba(54, 162, 235, 0.2)',
          borderColor: 'rgb(54, 162, 235)'
        }],
        scale: { min: 0, max: 100 }
      }
    }
  },

  tree: {
    description: 'Tree Diagram - For hierarchical data',
    example: {
      type: 'tree',
      title: 'Organization Structure',
      data: {
        root: {
          id: 'ceo',
          name: 'CEO',
          children: [
            {
              id: 'cto',
              name: 'CTO',
              children: [
                { id: 'dev_lead', name: 'Dev Lead' },
                { id: 'qa_lead', name: 'QA Lead' }
              ]
            },
            {
              id: 'cfo',
              name: 'CFO',
              children: [
                { id: 'accountant', name: 'Accountant' }
              ]
            }
          ]
        }
      }
    }
  },

  network: {
    description: 'Network Diagram - For showing relationships',
    example: {
      type: 'network',
      title: 'Social Network',
      data: {
        nodes: [
          { id: 'alice', label: 'Alice', group: 'friend' },
          { id: 'bob', label: 'Bob', group: 'friend' },
          { id: 'charlie', label: 'Charlie', group: 'family' },
          { id: 'david', label: 'David', group: 'colleague' }
        ],
        edges: [
          { source: 'alice', target: 'bob' },
          { source: 'alice', target: 'charlie' },
          { source: 'bob', target: 'david' },
          { source: 'charlie', target: 'david' }
        ]
      }
    }
  },

  heatmap: {
    description: 'Heat Map - For showing intensity across two dimensions',
    example: {
      type: 'heatmap',
      title: 'Activity Heatmap',
      data: {
        xLabels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
        yLabels: ['Morning', 'Afternoon', 'Evening'],
        values: [
          [10, 20, 30, 25, 15],
          [25, 30, 35, 30, 20],
          [15, 10, 20, 15, 25]
        ]
      }
    }
  },
  waterfall: {
    description: 'Waterfall Chart - For showing sequential changes in value',
    example: {
      type: 'waterfall',
      title: 'Profit Analysis',
      data: {
        categories: ['Starting', 'Sales', 'Costs', 'Marketing', 'Revenue', 'Final'],
        values: [
          { value: 100000, type: 'total' },
          { value: 50000, type: 'increase' },
          { value: -20000, type: 'decrease' },
          { value: -10000, type: 'decrease' },
          { value: 30000, type: 'increase' },
          { value: 150000, type: 'total' }
        ]
      }
    }
  },
  bubble: {
    description: 'Bubble Chart - For showing three dimensions of data',
    example: {
      type: 'bubble',
      title: 'Product Analysis',
      data: {
        datasets: [{
          label: 'Products',
          data: [
            { x: 20, y: 30, r: 15 },
            { x: 40, y: 10, r: 25 },
            { x: 15, y: 37, r: 20 }
          ],
          backgroundColor: 'rgba(255, 99, 132, 0.6)'
        }],
        xAxis: { label: 'Market Share %' },
        yAxis: { label: 'Growth Rate %' }
      }
    }
  },
  sankey: {
    description: 'Sankey Diagram - For showing flow quantities between nodes',
    example: {
      type: 'sankey',
      title: 'Budget Flow',
      data: {
        nodes: [
          { id: 'source1', label: 'Revenue', value: 100 },
          { id: 'source2', label: 'Investment', value: 50 },
          { id: 'sink1', label: 'Operations', value: 80 },
          { id: 'sink2', label: 'Marketing', value: 70 }
        ],
        links: [
          { source: 'source1', target: 'sink1', value: 60 },
          { source: 'source1', target: 'sink2', value: 40 },
          { source: 'source2', target: 'sink1', value: 20 },
          { source: 'source2', target: 'sink2', value: 30 }
        ]
      }
    }
  }
};

export const getChartPrompt = (requestedChart) => {
  const prompt = `
When generating charts, always use the exact JSON format shown below. Do not add any extra text or explanations outside the JSON.

Available chart types and their formats:

${Object.entries(chartPromptTemplates).map(([type, template]) => `
${type.toUpperCase()} CHART:
${template.description}

Example format:
\`\`\`json
${JSON.stringify(template.example, null, 2)}
\`\`\`
`).join('\n')}

IMPORTANT RULES:
1. Always wrap chart JSON in \`\`\`json code blocks
2. Use the exact structure shown in examples
3. Include a descriptive title
4. Ensure all data is properly formatted
5. For dates, use ISO format (YYYY-MM-DD)
6. For colors, use hex codes or rgba() format

User request: ${requestedChart}

Generate the appropriate chart JSON based on the request above.
`;

  return prompt;
};

export const chartSystemPrompt = `
You are an AI assistant capable of generating various types of charts and diagrams. When a user asks for a chart, visualization, or diagram, you should:

1. Identify the most appropriate chart type for their data/request
2. Generate the chart in the exact JSON format required
3. Wrap the JSON in \`\`\`json code blocks
4. Include meaningful titles and labels
5. Use appropriate colors and styling

Available chart types:
- flow: Process flows, decision trees
- bar: Comparing quantities
- line: Trends over time
- pie: Parts of a whole
- mindmap: Brainstorming, organizing ideas
- gantt: Project timelines
- scatter: Correlations
- area: Cumulative totals
- radar: Multi-dimensional comparisons
- tree: Hierarchical data
- network: Relationships
- heatmap: Intensity across dimensions
- waterfall: Sequential changes
- bubble: Three-dimensional data
- sankey: Flow quantities

Always prioritize clarity and accuracy in your visualizations.
`;