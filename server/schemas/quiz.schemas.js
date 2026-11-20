import { z } from 'zod';

export const generateQuizSchema = z.object({
  type: z.enum(['topic', 'files']).optional(),
  topic: z.string().max(500).optional(),
  content: z.string().optional(),
  fileIds: z.array(z.string()).optional(),
  questionCount: z.number().int().min(1).max(50).optional().default(10),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional().default('medium'),
  customInstructions: z.string().max(2000).optional(),
  languagePreference: z.string().optional(),
  detectedLanguage: z.any().optional(),
  targetLanguage: z.string().optional(),
}).passthrough();

export const saveQuizSchema = z.object({
  title: z.string().max(300).optional(),
  description: z.string().max(2000).optional().nullable(),
  questions: z.array(z.object({
    id: z.union([z.string(), z.number()]).optional(),
    question: z.string(),
    options: z.array(z.string()).min(2).max(6),
    correctAnswer: z.number().int().min(0),
    explanation: z.string().optional(),
  }).passthrough()).min(1, 'At least one question is required'),
  source: z.string().optional(),
  sourceData: z.any().optional(),
  tags: z.array(z.string()).optional(),
  category: z.string().optional(),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
}).passthrough();

export const manualQuizSchema = z.object({
  title: z.string().max(300).optional(),
  description: z.string().max(2000).optional(),
  questions: z.array(z.object({
    question: z.string(),
    options: z.array(z.string()).min(2).max(6),
    correctAnswer: z.number().int().min(0),
    explanation: z.string().optional(),
  }).passthrough()).min(1, 'At least one question is required'),
  questionCount: z.number().optional(),
  tags: z.array(z.string()).optional(),
  category: z.string().optional(),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
}).passthrough();

export const quizAttemptSchema = z.object({
  score: z.number().min(0).max(100),
  totalQuestions: z.number().int().min(1),
  answers: z.array(z.any()).optional(),
  timeSpent: z.number().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  quizTitle: z.string().optional(),
}).passthrough();
