export enum ChartType {
  FLOW = 'flow',
  BAR = 'bar',
  LINE = 'line',
  PIE = 'pie',
  MINDMAP = 'mindmap',
  GANTT = 'gantt',
  SCATTER = 'scatter',
  AREA = 'area',
  RADAR = 'radar',
  TREE = 'tree',
  NETWORK = 'network',
  SANKEY = 'sankey',
  BUBBLE = 'bubble',
  HEATMAP = 'heatmap',
  WATERFALL = 'waterfall',
}

export interface ChartDimensions {
  width: number;
  height: number;
}

export interface ChartConfig {
  theme?: 'light' | 'dark';
  colors?: string[];
  fontSize?: number;
  fontFamily?: string;
  backgroundColor?: string;
  dimensions?: {
    preview: ChartDimensions;
    full: ChartDimensions;
  };
}

export interface BaseChartData {
  type: ChartType;
  title?: string;
  subtitle?: string;
  config?: ChartConfig;
}

// Flow Chart
export interface FlowNode {
  id: string;
  label: string;
  type?: 'start' | 'end' | 'process' | 'decision' | 'data';
  position?: { x: number; y: number };
}

export interface FlowEdge {
  from: string;
  to: string;
  label?: string;
  type?: 'default' | 'conditional';
}

export interface FlowChartData extends BaseChartData {
  type: ChartType.FLOW;
  data: {
    nodes: FlowNode[];
    edges: FlowEdge[];
  };
}

// Bar Chart
export interface BarChartData extends BaseChartData {
  type: ChartType.BAR;
  data: {
    labels: string[];
    datasets: Array<{
      label: string;
      data: number[];
      backgroundColor?: string;
    }>;
    orientation?: 'vertical' | 'horizontal';
  };
}

// Line Chart
export interface LineChartData extends BaseChartData {
  type: ChartType.LINE;
  data: {
    labels: string[];
    datasets: Array<{
      label: string;
      data: number[];
      borderColor?: string;
      fill?: boolean;
      tension?: number;
    }>;
  };
}

// Pie Chart
export interface PieChartData extends BaseChartData {
  type: ChartType.PIE;
  data: {
    labels: string[];
    values: number[];
    colors?: string[];
  };
}

// Mind Map
export interface MindMapNode {
  id: string;
  text: string;
  children?: MindMapNode[];
  color?: string;
  collapsed?: boolean;
}

export interface MindMapData extends BaseChartData {
  type: ChartType.MINDMAP;
  data: {
    root: MindMapNode;
  };
}

// Gantt Chart
export interface GanttTask {
  id: string;
  name: string;
  start: string; // ISO date
  end: string; // ISO date
  progress?: number; // 0-100
  dependencies?: string[]; // task IDs
  color?: string;
}

export interface GanttChartData extends BaseChartData {
  type: ChartType.GANTT;
  data: {
    tasks: GanttTask[];
  };
}

// Scatter Plot
export interface ScatterPoint {
  x: number;
  y: number;
  label?: string;
}

export interface ScatterChartData extends BaseChartData {
  type: ChartType.SCATTER;
  data: {
    datasets: Array<{
      label: string;
      data: ScatterPoint[];
      backgroundColor?: string;
    }>;
    xAxis?: { label: string; min?: number; max?: number };
    yAxis?: { label: string; min?: number; max?: number };
  };
}

// Area Chart
export interface AreaChartData extends BaseChartData {
  type: ChartType.AREA;
  data: {
    labels: string[];
    datasets: Array<{
      label: string;
      data: number[];
      backgroundColor?: string;
      stack?: string;
    }>;
  };
}

// Radar Chart
export interface RadarChartData extends BaseChartData {
  type: ChartType.RADAR;
  data: {
    labels: string[];
    datasets: Array<{
      label: string;
      data: number[];
      backgroundColor?: string;
      borderColor?: string;
    }>;
    scale?: {
      min?: number;
      max?: number;
    };
  };
}

// Tree Diagram
export interface TreeNode {
  id: string;
  name: string;
  value?: number;
  children?: TreeNode[];
  color?: string;
}

export interface TreeChartData extends BaseChartData {
  type: ChartType.TREE;
  data: {
    root: TreeNode;
    orientation?: 'vertical' | 'horizontal';
  };
}

// Network Diagram
export interface NetworkNode {
  id: string;
  label: string;
  group?: string;
  size?: number;
  color?: string;
}

export interface NetworkEdge {
  source: string;
  target: string;
  weight?: number;
  label?: string;
}

export interface NetworkChartData extends BaseChartData {
  type: ChartType.NETWORK;
  data: {
    nodes: NetworkNode[];
    edges: NetworkEdge[];
  };
}

// Sankey Diagram
export interface SankeyLink {
  source: string;
  target: string;
  value: number;
}

export interface SankeyChartData extends BaseChartData {
  type: ChartType.SANKEY;
  data: {
    nodes: Array<{ id: string; label: string }>;
    links: SankeyLink[];
  };
}

// Bubble Chart
export interface BubblePoint {
  x: number;
  y: number;
  r: number; // radius
  label?: string;
}

export interface BubbleChartData extends BaseChartData {
  type: ChartType.BUBBLE;
  data: {
    datasets: Array<{
      label: string;
      data: BubblePoint[];
      backgroundColor?: string;
    }>;
    xAxis?: { label: string };
    yAxis?: { label: string };
  };
}

// Heatmap
export interface HeatmapChartData extends BaseChartData {
  type: ChartType.HEATMAP;
  data: {
    xLabels: string[];
    yLabels: string[];
    values: number[][]; // 2D array of values
    colorScale?: {
      min?: number;
      max?: number;
      colors?: string[];
    };
  };
}

// Waterfall Chart
export interface WaterfallChartData extends BaseChartData {
  type: ChartType.WATERFALL;
  data: {
    categories: string[];
    values: Array<{
      value: number;
      type?: 'increase' | 'decrease' | 'total';
    }>;
    colors?: {
      increase?: string;
      decrease?: string;
      total?: string;
    };
  };
}

// Union type for all chart data
export type ChartData =
  | FlowChartData
  | BarChartData
  | LineChartData
  | PieChartData
  | MindMapData
  | GanttChartData
  | ScatterChartData
  | AreaChartData
  | RadarChartData
  | TreeChartData
  | NetworkChartData
  | SankeyChartData
  | BubbleChartData
  | HeatmapChartData
  | WaterfallChartData;

// Chart generation response
export interface ChartGenerationResponse {
  success: boolean;
  chartId?: string;
  previewUrl?: string;
  fullUrl?: string;
  error?: string;
}

// Chart message format
export interface ChartMessage {
  type: 'chart';
  chartData: ChartData;
  images?: {
    preview: string; // base64 or URL
    full: string; // base64 or URL
  };
}