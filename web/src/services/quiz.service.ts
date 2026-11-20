import api from '@/services/api';
import type {
  Quiz,
  QuizWithQuestions,
  QuizGenerationParams,
  CreateQuizParams,
  UpdateQuizParams,
  QuizAttempt,
  Answer
} from '@/types/quiz.types';

class QuizService {
  // Get user's quizzes
  async getQuizzes(): Promise<Quiz[]> {
    const { data } = await api.get('/quiz/list');
    // Ensure we always return an array
    return Array.isArray(data) ? data : (data?.quizzes || []);
  }

  // Get a specific quiz with questions
  async getQuiz(quizId: string): Promise<QuizWithQuestions> {
    const { data } = await api.get(`/quiz/${quizId}`);
    return data;
  }

  // Generate quiz with AI
  async generateQuiz(params: QuizGenerationParams): Promise<unknown> {
    const { data } = await api.post('/quiz/generate', params);
    return data;
  }

  // Save generated quiz
  async saveQuiz(quizData: unknown): Promise<{ quizId: string; message: string }> {
    const { data } = await api.post('/quiz/save', quizData);
    return data;
  }

  // Create manual quiz
  async createQuiz(params: CreateQuizParams): Promise<Quiz> {
    const { data } = await api.post('/quiz/manual', params);
    return data;
  }

  // Update quiz metadata
  async updateQuiz(quizId: string, params: UpdateQuizParams): Promise<Quiz> {
    const { data } = await api.patch(`/quiz/${quizId}`, params);
    return data;
  }

  // Update quiz tags
  async updateQuizTags(quizId: string, params: Pick<UpdateQuizParams, 'tags' | 'category' | 'difficulty'>): Promise<Quiz> {
    const { data } = await api.patch(`/quiz/${quizId}`, params);
    return data;
  }

  // Delete quiz
  async deleteQuiz(quizId: string): Promise<void> {
    await api.delete(`/quiz/${quizId}`);
  }

  // Import quiz by ID
  async importQuiz(shareId: string): Promise<Quiz> {
    const { data } = await api.post('/share/import-by-id', {
      contentId: shareId,
      contentType: 'quiz'
    });
    // The share endpoint returns the imported quiz in data.quiz
    return data.quiz || data;
  }

  // Submit quiz attempt
  async submitQuizAttempt(quizId: string, answers: Answer[], timeTaken: number): Promise<QuizAttempt> {
    // Calculate score
    const correctAnswers = answers.filter(a => a.isCorrect).length;
    const totalQuestions = answers.length;

    const { data } = await api.post(`/quiz/${quizId}/attempt`, {
      score: correctAnswers,
      totalQuestions: totalQuestions,
      answers: answers,
      timeSpent: timeTaken
    });
    return data;
  }

  // Get quiz attempts history
  async getQuizAttempts(quizId: string): Promise<QuizAttempt[]> {
    const { data } = await api.get(`/quiz/${quizId}/attempts`);
    return data;
  }

  // Get shared quiz (public endpoint)
  async getSharedQuiz(shareId: string): Promise<unknown> {
    const { data } = await api.get(`/quiz/shared/${shareId}`);
    return data;
  }
}

export const quizService = new QuizService();
