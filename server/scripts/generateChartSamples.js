import OpenAI from 'openai';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { chartSystemPrompt, chartPromptTemplates } from '../prompts/chartPrompts.js';
import { loadModelConfig, getModelConfig } from '../utils/modelConfig.js';
import { initializeServices } from '../config/services.config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from parent directory
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Initialize services
initializeServices();
await loadModelConfig();

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Chart type prompts from the test file
const chartPrompts = {
  flow: `Create a flow chart showing the process of making coffee:
1. Start
2. Check if coffee beans available
3. If yes, grind beans
4. If no, buy coffee beans then grind
5. Add water to machine
6. Brew coffee
7. Pour into cup
8. End`,

  bar: `Create a bar chart showing sales data:
- January: $45,000
- February: $52,000
- March: $48,000
- April: $61,000
- May: $58,000`,

  line: `Create a line chart showing website traffic over a week:
- Monday: 1200 visitors
- Tuesday: 1500 visitors
- Wednesday: 1800 visitors
- Thursday: 2100 visitors
- Friday: 2300 visitors
- Saturday: 1900 visitors
- Sunday: 1600 visitors`,

  pie: `Create a pie chart showing budget allocation:
- Marketing: 30%
- Development: 40%
- Operations: 20%
- Other: 10%`,

  mindmap: `Create a mind map for planning a vacation:
- Center: Vacation Planning
  - Destination
    - Beach
    - Mountains
  - Budget
    - Flights
    - Hotels
    - Food
  - Activities
    - Sightseeing
    - Adventure sports
  - Packing
    - Clothes
    - Documents`,

  gantt: `Create a Gantt chart for a website project:
- Research: Jan 1-15
- Design: Jan 10-25
- Development: Jan 20 - Feb 20
- Testing: Feb 15-28
- Launch: March 1`,

  scatter: `Create a scatter plot showing the relationship between study hours and test scores:
- (2 hours, 65%)
- (3 hours, 70%)
- (4 hours, 78%)
- (5 hours, 85%)
- (6 hours, 90%)
- (7 hours, 92%)
- (8 hours, 94%)`,

  area: `Create an area chart showing revenue by product over 4 quarters:
Product A: Q1: $10k, Q2: $15k, Q3: $18k, Q4: $22k
Product B: Q1: $5k, Q2: $8k, Q3: $12k, Q4: $15k
Product C: Q1: $3k, Q2: $4k, Q3: $6k, Q4: $8k`,

  radar: `Create a radar chart for employee skills assessment:
- Communication: 85
- Technical Skills: 90
- Leadership: 75
- Teamwork: 88
- Problem Solving: 92
- Time Management: 80`,

  tree: `Create a tree diagram showing company organization:
- CEO
  - CTO
    - Engineering Manager
      - Senior Developer
      - Junior Developer
    - QA Manager
      - QA Engineer
  - CFO
    - Accounting Manager
      - Accountant`,

  network: `Create a network diagram showing team connections:
- Alice connects to Bob and Charlie
- Bob connects to David and Eve
- Charlie connects to David
- David connects to Eve
- Eve connects to Frank`,

  heatmap: `Create a heatmap showing store traffic by hour and day:
Days: Mon-Fri
Hours: 9AM, 12PM, 3PM, 6PM
Values: 
Mon: 20, 45, 30, 55
Tue: 25, 50, 35, 60
Wed: 30, 55, 40, 65
Thu: 35, 60, 45, 70
Fri: 40, 65, 50, 75`,

  bubble: `Create a bubble chart showing market analysis:
- Product A: Market Share 25%, Growth 15%, Revenue $5M
- Product B: Market Share 35%, Growth 10%, Revenue $8M
- Product C: Market Share 20%, Growth 20%, Revenue $3M
- Product D: Market Share 20%, Growth 5%, Revenue $4M`,

  waterfall: `Create a waterfall chart showing quarterly profit changes:
- Starting profit: $100k
- Q1 Sales increase: +$50k
- Q1 Costs: -$20k
- Q2 Sales increase: +$60k
- Q2 Marketing: -$15k
- Q3 Sales increase: +$40k
- Q3 Operations: -$25k
- Final profit: (calculate)`,

  sankey: `Create a Sankey diagram showing budget flow:
Sources:
- Federal Funding: $100M
- State Funding: $50M
- Private Donations: $30M
Distribution:
- Education: $80M
- Healthcare: $60M
- Infrastructure: $40M`
};

async function generateChartSample(type, prompt) {
  try {
    console.log(`\nGenerating ${type} chart...`);
    
    // Build comprehensive chart examples
    const chartExamples = Object.entries(chartPromptTemplates).map(([chartType, template]) => 
      `${chartType.toUpperCase()}: ${template.description}\nExample:\n\`\`\`json\n${JSON.stringify(template.example, null, 2)}\n\`\`\``
    ).join('\n\n');

    const systemMessage = `You are a helpful AI assistant that generates charts in a specific JSON format.

${chartSystemPrompt}

When the user asks for a chart, ALWAYS use these exact JSON formats wrapped in \`\`\`json code blocks:

${chartExamples}

CRITICAL RULES FOR CHARTS:
1. ALWAYS use the exact JSON structure shown in the examples
2. ALWAYS wrap chart JSON in \`\`\`json code blocks (not \`\`\`chart-json or \`\`\`mermaid)
3. For Gantt charts, use the format with tasks array, NOT Mermaid syntax
4. For flow charts, use nodes and edges arrays, NOT Mermaid syntax
5. Include descriptive titles for all charts
6. Use proper date formats (YYYY-MM-DD) for timeline-based charts
7. Never use newlines within JSON string values
8. Do not escape quotes in the JSON`;

    // Get the configured model for chat
    const modelConfig = getModelConfig();
    const chatModel = modelConfig.chat || { provider: 'openai', model_name: 'gpt-4.1-nano' };
    
    if (chatModel.provider !== 'openai') {
      throw new Error(`This script currently only supports OpenAI models. Configured: ${chatModel.provider}`);
    }
    
    console.log(`  Using model: ${chatModel.model_name}`);
    
    const response = await openai.chat.completions.create({
      model: chatModel.model_name,
      messages: [
        { role: 'system', content: systemMessage },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3, // Lower temperature for more consistent output
      max_tokens: 2000,
    });

    const content = response.choices[0].message.content;
    
    // Extract JSON from the response
    const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/);
    if (jsonMatch) {
      const jsonStr = jsonMatch[1];
      try {
        const chartData = JSON.parse(jsonStr);
        return {
          type,
          prompt,
          response: content,
          chartData,
          success: true
        };
      } catch (error) {
        return {
          type,
          prompt,
          response: content,
          error: `JSON parse error: ${error.message}`,
          rawJson: jsonStr,
          success: false
        };
      }
    } else {
      return {
        type,
        prompt,
        response: content,
        error: 'No JSON code block found in response',
        success: false
      };
    }
  } catch (error) {
    return {
      type,
      prompt,
      error: `API error: ${error.message}`,
      success: false
    };
  }
}

async function main() {
  console.log('Generating chart samples for all types...\n');
  
  const results = [];
  
  for (const [type, prompt] of Object.entries(chartPrompts)) {
    const result = await generateChartSample(type, prompt);
    results.push(result);
    
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Save results
  const outputPath = path.join(__dirname, 'chartSamples.json');
  await fs.writeFile(outputPath, JSON.stringify(results, null, 2));
  
  // Summary
  console.log('\n=== SUMMARY ===');
  console.log(`Total charts: ${results.length}`);
  console.log(`Successful: ${results.filter(r => r.success).length}`);
  console.log(`Failed: ${results.filter(r => !r.success).length}`);
  
  results.forEach(result => {
    if (!result.success) {
      console.log(`\n${result.type} FAILED: ${result.error}`);
    }
  });
  
  console.log(`\nResults saved to: ${outputPath}`);
}

main().catch(console.error);