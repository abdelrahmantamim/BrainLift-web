import logger from '../../utils/serverLogger.js';
import { generateAIResponse } from './unifiedAIService.js';

export async function generateQuiz({
  topic,
  content,
  difficulty = 'medium',
  questionCount = 10,
  questionTypes = ['multiple_choice'],
  model = 'gpt-4'
}) {
  try {
    const prompt = `Generate a quiz with ${questionCount} questions about ${topic || 'the following content'}.
    
    ${content ? `Content: ${content}` : ''}
    
    Difficulty: ${difficulty}
    Question types: ${questionTypes.join(', ')}
    
    Return a JSON object with this structure:
    {
      "title": "Quiz title",
      "description": "Brief description",
      "questions": [
        {
          "id": "unique-id",
          "question": "Question text",
          "options": ["Option A", "Option B", "Option C", "Option D"],
          "correctAnswer": 0,
          "explanation": "Why this answer is correct",
          "difficulty": "easy|medium|hard"
        }
      ]
    }`;
    
    logger.info('Quiz', `Generating ${questionCount} questions on ${topic || 'content'}`);
    
    const response = await generateAIResponse({
      feature: 'quiz',
      messages: [
        {
          role: 'system',
          content: 'You are an expert educator creating educational quizzes. Always return valid JSON.'
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7
    });
    
    const result = JSON.parse(response.content);
    
    // Ensure all questions have required fields
    result.questions = result.questions.map((q, index) => ({
      id: q.id || `q${index + 1}`,
      question: q.question,
      options: q.options || [],
      correctAnswer: q.correctAnswer || 0,
      explanation: q.explanation || '',
      difficulty: q.difficulty || difficulty
    }));
    
    return result;
  } catch (error) {
    logger.error('Quiz', 'Generation error:', error);
    throw error;
  }
}