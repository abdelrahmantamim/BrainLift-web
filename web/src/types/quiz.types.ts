export interface Quiz {
  id: string;
  title: string;
  description?: string;
  questionCount: number;
  createdAt: string;
  lastAttempt?: string;
  bestScore?: number;
  attempts: number;
  source_data?: Record<string, unknown>;
  difficulty?: 'easy' | 'medium' | 'hard';
  category?: string;
  tags?: string[];
  userId: string;
}

export interface Question {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation?: string;
}

export interface QuizWithQuestions extends Quiz {
  questions: Question[];
}

export interface Answer {
  questionId: string;
  selectedOption: number;
  isCorrect: boolean;
  timeSpent: number;
}

export interface QuizAttempt {
  id: string;
  quizId: string;
  userId: string;
  score: number;
  totalQuestions: number;
  percentage: number;
  timeTaken: number;
  completedAt: string;
  answers: Answer[];
}

export interface QuizGenerationParams {
  type: 'topic' | 'files';
  topic?: string;
  fileIds?: string[];
  questionCount: number;
  difficulty: 'easy' | 'medium' | 'hard';
  additionalContext?: string;
  language?: string;
}

export interface CreateQuizParams {
  title: string;
  description?: string;
  questions: Omit<Question, 'id'>[];
  difficulty?: 'easy' | 'medium' | 'hard';
  category?: string;
  tags?: string[];
}

export interface UpdateQuizParams {
  title?: string;
  description?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  category?: string;
  tags?: string[];
}

export const QUIZ_CATEGORIES = [
  { id: 'science', name: 'Science', icon: '🔬', gradient: 'bg-pg-teal/20' },
  { id: 'math', name: 'Math', icon: '🔢', gradient: 'bg-pg-lilac/20' },
  { id: 'history', name: 'History', icon: '📚', gradient: 'bg-pg-coral/20' },
  { id: 'language', name: 'Language', icon: '🌍', gradient: 'bg-pg-yellow/20' },
  { id: 'general', name: 'General', icon: '🎯', gradient: 'bg-pg-indigo/20' },
] as const;

export const DIFFICULTY_CONFIG = {
  easy: { label: 'Easy', color: 'text-green-500', bgColor: 'bg-green-500/20' },
  medium: { label: 'Medium', color: 'text-yellow-500', bgColor: 'bg-yellow-500/20' },
  hard: { label: 'Hard', color: 'text-red-500', bgColor: 'bg-red-500/20' },
} as const;