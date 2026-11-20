// Chart specifications for rare/advanced chart types
// These are loaded on-demand to keep the main prompt small

export const CHART_SPECS = {
  mindmap: {
    description: "For brainstorming and organizing ideas",
    example: {
      type: "mindmap",
      title: "Mind Map Title",
      data: {
        root: {
          id: "main",
          text: "Central Topic",
          children: [
            {
              id: "branch1",
              text: "Branch 1",
              children: [
                { id: "sub1", text: "Sub 1" },
                { id: "sub2", text: "Sub 2" }
              ]
            }
          ]
        }
      }
    }
  },
  
  tree: {
    description: "For hierarchical data",
    example: {
      type: "tree",
      title: "Organization Structure",
      data: {
        root: {
          id: "ceo",
          name: "CEO",
          children: [
            {
              id: "cto",
              name: "CTO",
              children: [
                { id: "dev_lead", name: "Dev Lead" }
              ]
            }
          ]
        }
      }
    }
  },
  
  gantt: {
    description: "For project timelines and schedules",
    example: {
      type: "gantt",
      title: "Project Timeline",
      data: {
        tasks: [
          {
            id: "task1",
            name: "Research",
            start: "2024-01-01",
            end: "2024-01-15",
            progress: 100
          },
          {
            id: "task2",
            name: "Design",
            start: "2024-01-10",
            end: "2024-01-25",
            progress: 60,
            dependencies: ["task1"]
          }
        ]
      }
    }
  },
  
  network: {
    description: "For showing relationships",
    example: {
      type: "network",
      title: "Social Network",
      data: {
        nodes: [
          { id: "alice", label: "Alice", group: "friend" },
          { id: "bob", label: "Bob", group: "friend" }
        ],
        edges: [
          { source: "alice", target: "bob" }
        ]
      }
    }
  },
  
  scatter: {
    description: "For showing correlations between variables",
    example: {
      type: "scatter",
      title: "Height vs Weight",
      data: {
        datasets: [{
          label: "Sample Data",
          data: [
            { x: 160, y: 55 },
            { x: 170, y: 65 }
          ],
          backgroundColor: "rgba(255, 99, 132, 0.5)"
        }],
        xAxis: { label: "Height (cm)" },
        yAxis: { label: "Weight (kg)" }
      }
    }
  },
  
  area: {
    description: "For showing cumulative totals over time",
    example: {
      type: "area",
      title: "Revenue Growth",
      data: {
        labels: ["Q1", "Q2", "Q3", "Q4"],
        datasets: [
          {
            label: "Product A",
            data: [10000, 15000, 18000, 22000],
            backgroundColor: "rgba(255, 99, 132, 0.2)",
            stack: "Stack 0"
          }
        ]
      }
    }
  },
  
  radar: {
    description: "For comparing multiple variables",
    example: {
      type: "radar",
      title: "Skills Assessment",
      data: {
        labels: ["Communication", "Technical", "Leadership", "Creativity", "Problem Solving"],
        datasets: [{
          label: "Current Skills",
          data: [80, 75, 85, 70, 90],
          backgroundColor: "rgba(54, 162, 235, 0.2)",
          borderColor: "rgb(54, 162, 235)"
        }],
        scale: { min: 0, max: 100 }
      }
    }
  },
  
  heatmap: {
    description: "For showing intensity across two dimensions",
    example: {
      type: "heatmap",
      title: "Activity Heatmap",
      data: {
        xLabels: ["Mon", "Tue", "Wed", "Thu", "Fri"],
        yLabels: ["Morning", "Afternoon", "Evening"],
        values: [
          [10, 20, 30, 25, 15],
          [25, 30, 35, 30, 20],
          [15, 10, 20, 15, 25]
        ]
      }
    }
  },
  
  waterfall: {
    description: "For showing sequential changes in value",
    example: {
      type: "waterfall",
      title: "Profit Analysis",
      data: {
        categories: ["Starting", "Sales", "Costs", "Marketing", "Revenue", "Final"],
        values: [
          { value: 100000, type: "total" },
          { value: 50000, type: "increase" },
          { value: -20000, type: "decrease" },
          { value: -10000, type: "decrease" },
          { value: 30000, type: "increase" },
          { value: 150000, type: "total" }
        ]
      }
    }
  },
  
  bubble: {
    description: "For showing three dimensions of data",
    example: {
      type: "bubble",
      title: "Product Analysis",
      data: {
        datasets: [{
          label: "Products",
          data: [
            { x: 20, y: 30, r: 15 },
            { x: 40, y: 10, r: 25 }
          ],
          backgroundColor: "rgba(255, 99, 132, 0.6)"
        }],
        xAxis: { label: "Market Share %" },
        yAxis: { label: "Growth Rate %" }
      }
    }
  },
  
  sankey: {
    description: "For showing flow quantities between nodes",
    example: {
      type: "sankey",
      title: "Budget Flow",
      data: {
        nodes: [
          { id: "source1", label: "Revenue", value: 100 },
          { id: "sink1", label: "Operations", value: 80 }
        ],
        links: [
          { source: "source1", target: "sink1", value: 60 }
        ]
      }
    }
  },
  
  venn: {
    description: "For showing overlaps and relationships",
    example: {
      type: "venn",
      sets: [
        { name: "Set A", items: ["Item 1", "Item 2"], color: "#FF6B6B" },
        { name: "Set B", items: ["Item 3", "Item 4"], color: "#4ECDC4" }
      ],
      intersections: [
        { sets: ["Set A", "Set B"], items: ["Shared Item"] }
      ],
      title: "Venn Diagram"
    }
  },
  
  progress: {
    description: "For showing completion or achievement",
    example: {
      type: "progress",
      progress: 75,
      title: "Course Progress",
      subtitle: "3 of 4 modules",
      color: "#4ECDC4"
    }
  },
  
  multiProgress: {
    description: "For comparing multiple progress metrics",
    example: {
      type: "multi-progress",
      items: [
        { label: "Math", progress: 85, color: "#FF6B6B" },
        { label: "Science", progress: 72, color: "#4ECDC4" }
      ],
      title: "Subject Progress"
    }
  }
};

// Legacy chart formats for backward compatibility
export const LEGACY_CHART_FORMATS = {
  pie: {
    type: "pie",
    data: [
      { name: "Category A", value: 30, color: "#FF6B6B" },
      { name: "Category B", value: 45, color: "#4ECDC4" }
    ],
    title: "Distribution Chart",
    hasLegend: true,
    absolute: false,
    avoidFalseZero: true
  },
  
  bar: {
    type: "bar",
    data: [
      { label: "Item 1", value: 85, color: "#FF6B6B" }
    ],
    title: "Comparison Chart",
    orientation: "vertical",
    barRadius: 4,
    showValues: true
  },
  
  line: {
    type: "line",
    data: [
      { x: "Jan", y: 65 },
      { x: "Feb", y: 72 }
    ],
    title: "Trend Chart",
    color: "#4ECDC4"
  },
  
  flow: {
    type: "flow",
    data: {
      nodes: [
        { id: "start", label: "Begin Process", type: "start", color: "#4ECDC4" }
      ],
      connections: [
        { from: "start", to: "step1" }
      ]
    },
    title: "Process Flow"
  }
};

// Function to get chart specification
export function getChartSpec(chartType) {
  return CHART_SPECS[chartType] || null;
}

// Function to check if a chart type needs legacy format
export function hasLegacyFormat(chartType) {
  return LEGACY_CHART_FORMATS.hasOwnProperty(chartType);
}

// Function to detect chart types mentioned in a message
export function detectChartTypes(message) {
  const chartKeywords = {
    pie: ['pie', 'distribution', 'percentage', 'proportion'],
    bar: ['bar', 'comparison', 'compare'],
    line: ['line', 'trend', 'over time', 'timeline'],
    flow: ['flow', 'process', 'workflow', 'decision tree'],
    mindmap: ['mind map', 'mindmap', 'brainstorm'],
    tree: ['tree', 'hierarchy', 'organization', 'structure'],
    gantt: ['gantt', 'project timeline', 'schedule'],
    network: ['network', 'relationship', 'connection'],
    scatter: ['scatter', 'correlation', 'plot'],
    area: ['area', 'cumulative'],
    radar: ['radar', 'skills', 'spider'],
    heatmap: ['heatmap', 'heat map', 'intensity'],
    waterfall: ['waterfall', 'sequential change'],
    bubble: ['bubble', 'three dimensions'],
    sankey: ['sankey', 'flow quantity'],
    venn: ['venn', 'overlap', 'intersection'],
    progress: ['progress', 'completion'],
    multiProgress: ['multi-progress', 'multiple progress']
  };
  
  const detectedTypes = [];
  const lowerMessage = message.toLowerCase();
  
  for (const [chartType, keywords] of Object.entries(chartKeywords)) {
    if (keywords.some(keyword => lowerMessage.includes(keyword))) {
      detectedTypes.push(chartType);
    }
  }
  
  return detectedTypes;
}