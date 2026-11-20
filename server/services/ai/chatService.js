import logger from '../../utils/serverLogger.js';
import { chartSystemPrompt, chartPromptTemplates } from '../../prompts/chartPrompts.js';
import { generateAIResponse } from './unifiedAIService.js';

export async function generateChatResponse({
  messages,
  context,
  model = 'gpt-4',
  temperature = 0.7,
  maxTokens = 2000
}) {
  try {
    // Build comprehensive chart examples
    const chartExamples = Object.entries(chartPromptTemplates).map(([type, template]) => 
      `${type.toUpperCase()}: ${template.description}\nExample:\n\`\`\`json\n${JSON.stringify(template.example, null, 2)}\n\`\`\``
    ).join('\n\n');

    let systemMessage = {
      role: 'system',
      content: `You are a helpful AI tutor assistant. Provide clear, educational responses.

${chartSystemPrompt}

When the user asks for a chart, ALWAYS use these exact JSON formats wrapped in \`\`\`json code blocks:

${chartExamples}

CRITICAL RULES FOR CHARTS:
1. ALWAYS use the exact JSON structure shown in the examples
2. ALWAYS wrap chart JSON in \`\`\`json code blocks (not \`\`\`chart-json)
3. For Gantt charts, use the format with tasks array, NOT Mermaid syntax
4. For flow charts, use "edges" array (NOT "connections")
5. Include descriptive titles for all charts
6. Use proper date formats (YYYY-MM-DD) for timeline-based charts
7. Never use newlines within JSON string values`
    };
    
    if (context) {
      systemMessage.content += `\n\nContext: ${context}`;
    }
    
    // Prepare messages
    const allMessages = [systemMessage, ...messages];
    
    logger.info('Chat', `Generating response`);
    
    // Use unified AI service
    const response = await generateAIResponse({
      feature: 'chat',
      messages: allMessages,
      temperature,
      maxTokens
    });
    
    return {
      content: response.content,
      model: response.model,
      usage: response.usage
    };
  } catch (error) {
    logger.error('Chat', 'Generation error:', error);
    throw error;
  }
}