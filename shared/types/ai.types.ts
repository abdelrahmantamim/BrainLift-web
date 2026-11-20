// AI Service Types and Interfaces

export interface TutoringPromptParams {
  studentLevel: string;
  subject: string;
  message: string;
  context?: string;
  chatHistory?: string;
  learningStyle?: string;
  goals?: string[];
}

export interface AIResponse {
  response: string;
  usage: UsageMetrics;
  suggestions?: string[];
  modelUsed?: string;
  cached?: boolean;
  processingTime?: number;
}

export interface UsageMetrics {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCost: number;
  modelUsed: string;
}

export interface TutoringContext {
  studentLevel?: string;
  subject?: string;
  previousMessages?: ChatMessage[];
  learningStyle?: string;
  goals?: string[];
  uploadedMaterials?: DocumentReference[];
  performanceData?: StudentPerformance;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: Date;
  tokens?: number;
}

export interface DocumentReference {
  id: string;
  fileName: string;
  relevantSections?: string[];
  embedding?: number[];
}

export interface StudentPerformance {
  averageScore: number;
  attemptCount: number;
  improvementRate: number;
  strongTopics: string[];
  weakTopics: string[];
  lastAssessmentDate?: Date;
}

export interface ProcessedDocument {
  text: string;
  metadata: DocumentMetadata;
  chunks: string[];
  embeddings?: number[][];
}

export interface DocumentMetadata {
  pageCount?: number;
  wordCount: number;
  language?: string;
  extractedAt: string;
  processingTime: number;
  summary?: string;
  keyTopics?: string[];
  difficulty?: string;
  [key: string]: any;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  hint?: string;
  concept: string;
  difficulty: 'easy' | 'medium' | 'hard';
  relatedMaterial?: DocumentReference[];
}

export interface Quiz {
  questions: QuizQuestion[];
  topic: string;
  difficulty: string;
  generatedAt: Date;
  estimatedTime: number;
}

export interface SemanticSearchResult {
  id: string;
  content: string;
  relevanceScore: number;
  fileId?: string;
  fileName?: string;
  pageNumber?: number;
  context?: string;
  metadata?: any;
}

export interface BatchProcessingJob<T> {
  id: string;
  items: T[];
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  results?: any[];
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
}

export interface CacheEntry {
  key: string;
  value: string;
  expiresAt: Date;
  hits: number;
  lastAccessed: Date;
}

export interface ModelSelection {
  model: string;
  reasoning: string;
  estimatedTokens: number;
  estimatedCost: number;
}

export interface ErrorContext {
  operation: string;
  userId?: string;
  sessionId?: string;
  input?: any;
  error: Error;
  timestamp: Date;
  retryCount?: number;
}

export interface AIServiceConfig {
  maxRetries: number;
  retryDelay: number;
  cacheEnabled: boolean;
  cacheTTL: number;
  batchSize: number;
  maxTokensPerRequest: number;
  defaultModel: string;
  complexityThreshold: number;
  costLimit: {
    daily: number;
    monthly: number;
  };
}

export interface TokenPrediction {
  estimated: number;
  confidence: number;
  breakdown: {
    systemPrompt: number;
    userMessage: number;
    context: number;
    expectedResponse: number;
  };
}

// Enums
export enum AIModel {
  GPT4O_MINI = 'gpt-4o-mini',
  GPT4O = 'gpt-4o',
  GPT41_NANO = 'gpt-4.1-nano',
}

export enum CacheStrategy {
  AGGRESSIVE = 'aggressive', // Cache everything
  MODERATE = 'moderate',     // Cache common queries
  MINIMAL = 'minimal',       // Cache only expensive operations
}

export enum ProcessingPriority {
  HIGH = 'high',
  NORMAL = 'normal',
  LOW = 'low',
}

// Constants
export const MODEL_COSTS = {
  [AIModel.GPT4O_MINI]: {
    input: 0.00015,  // per 1K tokens
    output: 0.0006,  // per 1K tokens
  },
  [AIModel.GPT4O]: {
    input: 0.005,
    output: 0.015,
  },
  [AIModel.GPT41_NANO]: {
    input: 0.01,
    output: 0.03,
  },
};

export const MODEL_LIMITS = {
  [AIModel.GPT4O_MINI]: {
    maxTokens: 128000,
    maxOutput: 16384,
  },
  [AIModel.GPT4O]: {
    maxTokens: 128000,
    maxOutput: 4096,
  },
  [AIModel.GPT41_NANO]: {
    maxTokens: 128000,
    maxOutput: 4096,
  },
};