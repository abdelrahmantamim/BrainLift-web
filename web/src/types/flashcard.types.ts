export interface FlashcardCard {
  front: string;
  back: string;
}

export interface Flashcard {
  id: string;
  question: string;
  answer: string;
  citation?: string;
  nextDue?: string;
  easeFactor: number;
  interval: number;
  repetitions: number;
}

export interface FlashcardDeck {
  id: string;
  name: string;
  fileId?: string;
  fileName?: string;
  cardCount: number;
  dueCount: number;
  createdAt: string;
  lastReviewed?: string;
  category?: string;
  tags?: string[];
  // Legacy fields for backward compatibility
  _id?: string;
  userId?: string;
  title?: string;
  description?: string;
  cards?: FlashcardCard[];
  isPublic?: boolean;
  shareId?: string;
  updatedAt?: number;
}

export interface FlashcardPair {
  id: string;
  question: string;
  answer: string;
}

export interface DeckWithCards {
  deck: {
    id: string;
    name: string;
    fileName?: string;
    createdAt: string;
    lastReviewed?: string;
  };
  cards: Flashcard[];
}

export interface FlashcardGenerationParams {
  mode: 'files' | 'topic' | 'notes';
  topic?: string;
  fileIds?: string[];
  notes?: string;
  content?: string; // For text content
  cardCount?: number;
  additionalContext?: string;
  language?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
}

export interface CreateFlashcardsParams {
  title: string;
  deckName?: string; // For backward compatibility
  description?: string;
  cards: {
    question: string;
    answer: string;
  }[];
}

export interface ReviewRating {
  cardId?: string;
  cardIndex: number;
  rating: number; // 0-5 for SuperMemo-2 algorithm
  // SM-2 result computed at rating time (populated by flashcardStore.rateCard),
  // used to persist the review outcome via flashcardService.reviewCard.
  easeFactor?: number;
  interval?: number;
  repetitions?: number;
  nextDue?: string;
}

export interface SpacedRepetitionResult {
  easeFactor: number;
  interval: number;
  repetitions: number;
  nextDue: string;
}

export interface StudySession {
  deckId: string;
  totalCards: number;
  reviewedCards: number;
  ratings: {
    again: number;
    hard: number;
    good: number;
    easy: number;
  };
  startTime: number;
  endTime?: number;
}

export const DIFFICULTY_RATINGS = {
  again: { label: 'Again', color: 'text-red-500', bgColor: 'bg-red-500/20', value: 0 },
  hard: { label: 'Hard', color: 'text-orange-500', bgColor: 'bg-orange-500/20', value: 1 },
  good: { label: 'Good', color: 'text-blue-500', bgColor: 'bg-blue-500/20', value: 2 },
  easy: { label: 'Easy', color: 'text-green-500', bgColor: 'bg-green-500/20', value: 3 },
} as const;