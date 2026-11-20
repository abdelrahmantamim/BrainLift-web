import { create } from 'zustand';
import type { Quiz, QuizWithQuestions, Answer } from '@/types/quiz.types';
import { quizService } from '@/services/quiz.service';
import toast from 'react-hot-toast';

interface QuizState {
  quizzes: Quiz[];
  currentQuiz: QuizWithQuestions | null;
  currentAnswers: Answer[];
  currentQuestionIndex: number;
  quizStartTime: number | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchQuizzes: () => Promise<void>;
  fetchQuiz: (quizId: string) => Promise<void>;
  deleteQuiz: (quizId: string) => Promise<void>;
  importQuiz: (shareId: string) => Promise<void>;
  renameQuiz: (quizId: string, title: string, description?: string) => Promise<void>;
  updateQuizTags: (quizId: string, updates: { tags?: string[]; category?: string; difficulty?: 'easy' | 'medium' | 'hard' }) => Promise<void>;
  
  // Quiz taking
  startQuiz: (quizId: string) => Promise<void>;
  answerQuestion: (questionId: string, selectedOption: number) => void;
  nextQuestion: () => void;
  previousQuestion: () => void;
  submitQuiz: () => Promise<void>;
  resetQuiz: () => void;
}

export const useQuizStore = create<QuizState>((set, get) => ({
  quizzes: [],
  currentQuiz: null,
  currentAnswers: [],
  currentQuestionIndex: 0,
  quizStartTime: null,
  isLoading: false,
  error: null,

  fetchQuizzes: async () => {
    set({ isLoading: true, error: null });
    try {
      const quizzes = await quizService.getQuizzes();
      set({ quizzes, isLoading: false });
    } catch {
      set({ error: 'Failed to fetch quizzes', isLoading: false });
      toast.error('Failed to load quizzes');
    }
  },

  fetchQuiz: async (quizId: string) => {
    set({ isLoading: true, error: null });
    try {
      const quiz = await quizService.getQuiz(quizId);
      set({ currentQuiz: quiz, isLoading: false });
    } catch {
      set({ error: 'Failed to fetch quiz', isLoading: false });
      toast.error('Failed to load quiz');
    }
  },

  deleteQuiz: async (quizId: string) => {
    try {
      await quizService.deleteQuiz(quizId);
      set((state) => ({
        quizzes: state.quizzes.filter((q) => q.id !== quizId),
      }));
      toast.success('Quiz deleted successfully');
    } catch {
      toast.error('Failed to delete quiz');
    }
  },

  importQuiz: async (shareId: string) => {
    set({ isLoading: true, error: null });
    try {
      const quiz = await quizService.importQuiz(shareId);
      set((state) => ({
        quizzes: [...state.quizzes, quiz],
        isLoading: false,
      }));
      toast.success('Quiz imported successfully');
    } catch {
      set({ error: 'Failed to import quiz', isLoading: false });
      toast.error('Failed to import quiz');
    }
  },

  startQuiz: async (quizId: string) => {
    const { fetchQuiz } = get();
    await fetchQuiz(quizId);
    
    const quiz = get().currentQuiz;
    if (quiz) {
      const initialAnswers: Answer[] = quiz.questions.map((q) => ({
        questionId: q.id,
        selectedOption: -1,
        isCorrect: false,
        timeSpent: 0,
      }));
      
      set({
        currentAnswers: initialAnswers,
        currentQuestionIndex: 0,
        quizStartTime: Date.now(),
      });
    }
  },

  answerQuestion: (questionId: string, selectedOption: number) => {
    const { currentAnswers, currentQuiz } = get();
    if (!currentQuiz) return;

    const question = currentQuiz.questions.find((q) => q.id === questionId);
    if (!question) return;

    const isCorrect = selectedOption === question.correctAnswer;
    
    set({
      currentAnswers: currentAnswers.map((a) =>
        a.questionId === questionId
          ? { ...a, selectedOption, isCorrect }
          : a
      ),
    });
  },

  nextQuestion: () => {
    const { currentQuestionIndex, currentQuiz } = get();
    if (!currentQuiz) return;
    
    if (currentQuestionIndex < currentQuiz.questions.length - 1) {
      set({ currentQuestionIndex: currentQuestionIndex + 1 });
    }
  },

  previousQuestion: () => {
    const { currentQuestionIndex } = get();
    if (currentQuestionIndex > 0) {
      set({ currentQuestionIndex: currentQuestionIndex - 1 });
    }
  },

  submitQuiz: async () => {
    const { currentQuiz, currentAnswers, quizStartTime } = get();
    if (!currentQuiz || !quizStartTime) return;

    const timeTaken = Math.floor((Date.now() - quizStartTime) / 1000);
    
    try {
      // Calculate score locally since we have the data
      const correctAnswers = currentAnswers.filter(a => a.isCorrect).length;
      const totalQuestions = currentAnswers.length;
      
      await quizService.submitQuizAttempt(
        currentQuiz.id,
        currentAnswers,
        timeTaken
      );
      
      // Update quiz in list with new attempt data
      set((state) => ({
        quizzes: state.quizzes.map((q) =>
          q.id === currentQuiz.id
            ? {
                ...q,
                lastAttempt: new Date().toISOString(),
                bestScore: Math.max(q.bestScore || 0, correctAnswers),
                attempts: q.attempts + 1,
              }
            : q
        ),
      }));
      
      toast.success(`Quiz completed! Score: ${correctAnswers}/${totalQuestions}`);
    } catch {
      toast.error('Failed to submit quiz');
    }
  },

  resetQuiz: () => {
    set({
      currentQuiz: null,
      currentAnswers: [],
      currentQuestionIndex: 0,
      quizStartTime: null,
    });
  },

  renameQuiz: async (quizId: string, title: string, description?: string) => {
    set({ isLoading: true });
    try {
      await quizService.updateQuiz(quizId, { title, description });
      set((state) => ({
        quizzes: state.quizzes.map((q) =>
          q.id === quizId ? { ...q, title, description } : q
        ),
        isLoading: false,
      }));
      toast.success('Quiz renamed successfully');
    } catch {
      set({ isLoading: false });
      toast.error('Failed to rename quiz');
    }
  },

  updateQuizTags: async (quizId: string, updates: { tags?: string[]; category?: string; difficulty?: 'easy' | 'medium' | 'hard' }) => {
    set({ isLoading: true });
    try {
      await quizService.updateQuizTags(quizId, updates);
      set((state) => ({
        quizzes: state.quizzes.map((q) =>
          q.id === quizId ? { ...q, ...updates } : q
        ),
        isLoading: false,
      }));
      toast.success('Quiz updated successfully');
    } catch {
      set({ isLoading: false });
      toast.error('Failed to update quiz');
    }
  },
}));