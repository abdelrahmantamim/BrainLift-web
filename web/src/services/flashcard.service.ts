import api from './api';
import type {
  FlashcardDeck,
  DeckWithCards,
  FlashcardGenerationParams,
  CreateFlashcardsParams,
  ReviewRating,
  Flashcard,
} from '@/types/flashcard.types';

class FlashcardService {
  // Get all flashcard decks
  async getDecks(): Promise<FlashcardDeck[]> {
    try {
      const response = await api.get<{ decks: FlashcardDeck[] }>('/flashcards/decks');
      return response.data.decks || [];
    } catch {
      console.error('Error fetching flashcard decks:');
      return [];
    }
  }

  // Get a specific deck with cards
  async getDeck(deckId: string): Promise<DeckWithCards> {
    const response = await api.get<DeckWithCards>(`/flashcards/decks/${deckId}`);
    return response.data;
  }

  // Generate flashcards with AI
  async generateFlashcards(params: FlashcardGenerationParams): Promise<{ deckId: string; deckName: string; cardCount: number }> {
    const response = await api.post<{ deckId: string; deckName: string; cardCount: number }>('/flashcards/generate', {
      topic: params.topic,
      fileIds: params.fileIds,
      notes: params.notes,
      numberOfCards: params.cardCount || 15,
      customInstructions: params.additionalContext,
      difficulty: params.difficulty || 'medium',
      languagePreference: 'auto-detect-default-english',
    });
    return response.data;
  }

  // Create flashcards manually
  async createFlashcards(params: CreateFlashcardsParams): Promise<{ id: string }> {
    const response = await api.post<{ deckId: string }>('/flashcards/manual', {
      deckName: params.title,
      flashcards: params.cards.map(card => ({
        q: card.question,
        a: card.answer,
      })),
      category: params.description || 'general',
    });
    return { id: response.data.deckId };
  }

  // Review a card (update spaced repetition data)
  async reviewCard(cardId: string, easeFactor: number, interval: number, repetitions: number, nextDue: string): Promise<void> {
    await api.patch(`/flashcards/cards/${cardId}/review`, {
      easeFactor,
      interval,
      repetitions,
      nextDue,
    });
  }

  // Bulk review cards (for end of study session) - Note: Use individual card review for now
  async reviewCards(_deckId: string, _reviews: ReviewRating[]): Promise<void> {
    // Server doesn't have bulk review yet, would need to implement individual reviews
    console.warn('Bulk review not implemented, use individual reviewCard calls');
    throw new Error('Bulk review not yet implemented on server');
  }

  // Delete a deck
  async deleteDeck(deckId: string): Promise<void> {
    await api.delete(`/flashcards/decks/${deckId}`);
  }

  // Rename a deck
  async renameDeck(deckId: string, name: string): Promise<void> {
    await api.patch(`/flashcards/decks/${deckId}/rename`, {
      name: name,
    });
  }

  // Import deck by ID - Note: Server doesn't have this endpoint yet
  async importDeck(_shareId: string): Promise<{ id: string }> {
    // This would need to be implemented on the server
    throw new Error('Import functionality not yet implemented on server');
  }

  // Share deck with email
  async shareDeckWithEmail(deckId: string, email: string): Promise<void> {
    await api.post('/send-to-friend', {
      shareId: deckId,
      shareType: 'flashcards',
      recipientEmail: email,
    });
  }

  // Get shared deck (public endpoint)
  async getSharedDeck(shareId: string): Promise<DeckWithCards> {
    const response = await api.get<DeckWithCards>(`/share/flashcards/${shareId}`);
    return response.data;
  }

  // Search public flashcards - Note: Server doesn't have this endpoint yet
  async searchPublicFlashcards(_searchTerm: string): Promise<FlashcardDeck[]> {
    // This would need to be implemented on the server
    console.warn('Search functionality not yet implemented on server');
    return [];
  }

  // Get flashcards shared with me - Note: Server doesn't have this endpoint yet
  async getSharedWithMe(): Promise<FlashcardDeck[]> {
    // This would need to be implemented on the server
    console.warn('Shared flashcards functionality not yet implemented on server');
    return [];
  }

  // Get flashcard statistics - Note: Server doesn't have this endpoint yet
  async getFlashcardStats(_deckId: string): Promise<Record<string, unknown>> {
    // This would need to be implemented on the server
    console.warn('Stats functionality not yet implemented on server');
    return {};
  }

  // Start study session and track activity for daily goals
  async startSession(deckId: string, deckName?: string, totalCards?: number): Promise<string> {
    const response = await api.post('/flashcards/session/start', {
      deckId,
      deckName: deckName || 'Flashcard Deck',
      totalCards: totalCards || 0,
    });
    return response.data?.sessionId || 'tracked';
  }

  // Update study session - Note: Server doesn't have this endpoint yet
  async updateSession(_sessionId: string, _cardsStudied: number, _correctAnswers: number, _completed?: boolean): Promise<void> {
    // This would need to be implemented on the server
    console.warn('Session tracking not yet implemented on server');
  }

  // Get deck with editing capabilities (includes all card details)
  async getDeckForEdit(deckId: string): Promise<{ deck: FlashcardDeck; cards: Flashcard[]; totalCards: number }> {
    const response = await api.get(`/flashcards/decks/${deckId}/edit`);
    return response.data;
  }

  // Update a single flashcard
  async updateCard(cardId: string, question: string, answer: string): Promise<{ success: boolean; card: Flashcard }> {
    const response = await api.put(`/flashcards/cards/${cardId}`, {
      question,
      answer,
    });
    return response.data;
  }

  // Delete a single flashcard
  async deleteCard(cardId: string): Promise<{ success: boolean; message: string }> {
    const response = await api.delete(`/flashcards/cards/${cardId}`);
    return response.data;
  }
}

export const flashcardService = new FlashcardService();