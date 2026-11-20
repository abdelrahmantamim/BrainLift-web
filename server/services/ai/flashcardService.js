import logger from '../../utils/serverLogger.js';
import { generateAIResponse } from './unifiedAIService.js';

export async function generateFlashcards({
  content,
  topic,
  cardCount = 10,
  difficulty = 'medium',
  model = 'gpt-3.5-turbo'
}) {
  try {
    const prompt = `Generate ${cardCount} flashcards ${topic ? `about ${topic}` : 'from the following content'}.
    
    ${content ? `Content: ${content}` : ''}
    
    Difficulty: ${difficulty}
    
    Return a JSON object with this structure:
    {
      "title": "Flashcard deck title",
      "description": "Brief description",
      "cards": [
        {
          "front": "Question or prompt",
          "back": "Answer or explanation",
          "hint": "Optional hint"
        }
      ]
    }
    
    Make the flashcards educational and focused on key concepts.`;
    
    logger.info('Flashcards', `Generating ${cardCount} flashcards`);
    
    const response = await generateAIResponse({
      feature: 'quiz',
      messages: [
        {
          role: 'system',
          content: 'You are an expert educator creating effective flashcards for learning. Always return valid JSON.'
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7
    });
    
    const result = JSON.parse(response.content);
    
    // Ensure all cards have required fields
    result.cards = result.cards.map(card => ({
      front: card.front || card.question || '',
      back: card.back || card.answer || '',
      hint: card.hint || undefined
    }));
    
    return result;
  } catch (error) {
    logger.error('Flashcards', 'Generation error:', error);
    throw error;
  }
}