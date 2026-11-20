import OpenAI from 'openai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { chartGenerationService } from '../services/chartGenerationService.js';
import { chartSystemPrompt, chartPromptTemplates } from '../prompts/chartPrompts.js';
import { loadModelConfig, getModelConfig } from '../utils/modelConfig.js';
import { initializeServices } from '../config/services.config.js';
import chalk from 'chalk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from parent directory
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Initialize services
initializeServices();
await loadModelConfig();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ANSI escape codes for colors (in case chalk is not installed)
const colors = {
  green: (text) => chalk?.green ? chalk.green(text) : `\x1b[32m${text}\x1b[0m`,
  red: (text) => chalk?.red ? chalk.red(text) : `\x1b[31m${text}\x1b[0m`,
  yellow: (text) => chalk?.yellow ? chalk.yellow(text) : `\x1b[33m${text}\x1b[0m`,
  blue: (text) => chalk?.blue ? chalk.blue(text) : `\x1b[34m${text}\x1b[0m`,
  gray: (text) => chalk?.gray ? chalk.gray(text) : `\x1b[90m${text}\x1b[0m`,
  bold: (text) => chalk?.bold ? chalk.bold(text) : `\x1b[1m${text}\x1b[0m`
};

const chartType = process.argv[2];
const customPrompt = process.argv.slice(3).join(' ');

if (!chartType) {
  console.error('Usage: node testSingleChart.js <chartType> [custom prompt]');
  console.error('Available types: flow, bar, line, pie, mindmap, gantt, scatter, area, radar, tree, network, heatmap, bubble, waterfall, sankey');
  process.exit(1);
}

// Default prompts for each chart type
const defaultPrompts = {
  flow: 'Create a flow chart for user registration process: Start -> Enter Email -> Verify Email -> Create Password -> Complete Profile -> End',
  bar: 'Create a bar chart showing monthly revenue: Jan $45k, Feb $52k, Mar $48k, Apr $61k, May $58k',
  line: 'Create a line chart showing temperature over a week: Mon 20°C, Tue 22°C, Wed 19°C, Thu 21°C, Fri 23°C, Sat 25°C, Sun 24°C',
  pie: 'Create a pie chart showing market share: Company A 35%, Company B 28%, Company C 22%, Others 15%',
  mindmap: 'Create a mind map for project planning with main topic "New Feature" and branches: Requirements, Design, Development, Testing',
  gantt: 'Create a Gantt chart for website redesign: Planning (Jan 1-15), Design (Jan 10-25), Development (Jan 20-Feb 20), Testing (Feb 15-28)',
  scatter: 'Create a scatter plot showing correlation between hours studied and test scores: (2,65), (3,70), (4,78), (5,85), (6,90)',
  area: 'Create an area chart showing website traffic sources over 4 months: Organic (10k,12k,15k,18k), Social (5k,6k,8k,9k), Direct (3k,3.5k,4k,5k)',
  radar: 'Create a radar chart for skills assessment: Communication 85, Technical 90, Leadership 75, Teamwork 88, Problem Solving 92',
  tree: 'Create a tree diagram for company structure: CEO -> CTO (Engineering, QA) and CFO (Accounting, Finance)',
  network: 'Create a network diagram showing team connections: Alice-Bob, Alice-Charlie, Bob-David, Charlie-David, David-Eve',
  heatmap: 'Create a heatmap for store traffic by hour (9AM,12PM,3PM,6PM) and day (Mon-Fri) with values from 20 to 75',
  bubble: 'Create a bubble chart showing products: A (x:25, y:15, size:5M), B (x:35, y:10, size:8M), C (x:20, y:20, size:3M)',
  waterfall: 'Create a waterfall chart: Starting 100k, Sales +50k, Costs -20k, Marketing +30k, Operations -15k',
  sankey: 'Create a Sankey diagram: Revenue Sources (Sales $100M, Services $50M) -> Departments (R&D $80M, Marketing $40M, Operations $30M)'
};

async function testChart() {
  const prompt = customPrompt || defaultPrompts[chartType];
  
  if (!prompt) {
    console.error(colors.red(`No default prompt available for chart type: ${chartType}`));
    process.exit(1);
  }
  
  console.log(colors.bold(`\n🧪 Testing ${chartType.toUpperCase()} Chart\n`));
  console.log(colors.gray('Prompt:'), prompt);
  console.log(colors.gray('─'.repeat(50)));
  
  try {
    // Step 1: Generate with AI
    console.log(colors.blue('\n1. Generating with AI...'));
    
    const chartExamples = Object.entries(chartPromptTemplates).map(([type, template]) => 
      `${type.toUpperCase()}: ${template.description}\nExample:\n\`\`\`json\n${JSON.stringify(template.example, null, 2)}\n\`\`\``
    ).join('\n\n');

    const systemMessage = `You are a helpful AI assistant that generates charts in a specific JSON format.

${chartSystemPrompt}

When the user asks for a chart, ALWAYS use these exact JSON formats wrapped in \`\`\`json code blocks:

${chartExamples}

CRITICAL RULES:
1. ALWAYS use the exact JSON structure shown in the examples
2. ALWAYS wrap chart JSON in \`\`\`json code blocks
3. For flow charts, use nodes and edges arrays, NOT Mermaid syntax
4. Include descriptive titles for all charts`;

    // Get the configured model for chat
    const modelConfig = getModelConfig();
    const chatModel = modelConfig.chat || { provider: 'openai', model_name: 'gpt-4.1-nano' };
    
    if (chatModel.provider !== 'openai') {
      throw new Error(`This script currently only supports OpenAI models. Configured: ${chatModel.provider}`);
    }
    
    console.log(colors.gray(`Using model: ${chatModel.model_name}`));
    
    const response = await openai.chat.completions.create({
      model: chatModel.model_name,
      messages: [
        { role: 'system', content: systemMessage },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 2000,
    });

    const content = response.choices[0].message.content;
    console.log(colors.gray('\nAI Response:'));
    console.log(colors.gray(content.substring(0, 200) + '...'));
    
    // Extract JSON
    const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/);
    if (!jsonMatch) {
      throw new Error('No JSON code block found in AI response');
    }
    
    const chartData = JSON.parse(jsonMatch[1]);
    console.log(colors.green('✓ JSON extracted successfully'));
    
    // Step 2: Validate structure
    console.log(colors.blue('\n2. Validating structure...'));
    
    if (!chartData.type) throw new Error('Missing type field');
    if (!chartData.data) throw new Error('Missing data field');
    if (chartData.type !== chartType) {
      console.log(colors.yellow(`⚠️  Type mismatch: expected ${chartType}, got ${chartData.type}`));
    }
    
    console.log(colors.green('✓ Basic structure valid'));
    
    // Step 3: Render chart
    console.log(colors.blue('\n3. Rendering chart...'));
    
    const result = await chartGenerationService.generateChart(chartData);
    
    if (result.success) {
      console.log(colors.green('✓ Chart rendered successfully!'));
      console.log(colors.gray(`  Preview: ${(result.preview.buffer.length / 1024).toFixed(1)}KB`));
      console.log(colors.gray(`  Full: ${(result.full.buffer.length / 1024).toFixed(1)}KB`));
      
      // Save the generated chart data
      console.log(colors.blue('\n4. Chart Data:'));
      console.log(JSON.stringify(chartData, null, 2));
      
    } else {
      console.log(colors.red(`✗ Rendering failed: ${result.error}`));
    }
    
  } catch (error) {
    console.error(colors.red(`\n❌ Test failed: ${error.message}`));
    if (error.stack) {
      console.error(colors.gray(error.stack));
    }
    process.exit(1);
  }
}

testChart();