import { create } from 'zustand';
import type {
  FlashcardDeck,
  DeckWithCards,
  Flashcard,
  ReviewRating,
  StudySession,
} from '@/types/flashcard.types';
import { flashcardService } from '@/services/flashcard.service';
import { calculateSpacedRepetition, getDueCards } from '@/utils/spacedRepetition';
import { trackError } from '@/utils/analytics';
import toast from 'react-hot-toast';

interface FlashcardState {
  decks: FlashcardDeck[];
  currentDeck: DeckWithCards | null;
  currentCardIndex: number;
  showAnswer: boolean;
  studySession: StudySession | null;
  reviewQueue: Flashcard[];
  pendingReviews: ReviewRating[];
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchDecks: () => Promise<void>;
  fetchDeck: (deckId: string) => Promise<DeckWithCards>;
  deleteDeck: (deckId: string) => Promise<void>;
  renameDeck: (deckId: string, name: string) => Promise<void>;
  importDeck: (shareId: string) => Promise<void>;

  // Study actions
  startStudySession: (deckId: string) => Promise<void>;
  flipCard: () => void;
  nextCard: () => void;
  previousCard: () => void;
  rateCard: (rating: 'again' | 'hard' | 'good' | 'easy') => void;
  endStudySession: () => Promise<void>;
  resetStudy: () => void;
}

export const useFlashcardStore = create<FlashcardState>((set, get) => ({
  decks: [],
  currentDeck: null,
  currentCardIndex: 0,
  showAnswer: false,
  studySession: null,
  reviewQueue: [],
  pendingReviews: [],
  isLoading: false,
  error: null,

  fetchDecks: async () => {
    set({ isLoading: true, error: null });
    try {
      const decks = await flashcardService.getDecks();
      // Decks already come in the correct format from the new API
      set({ decks, isLoading: false });
    } catch (error) {
      set({ error: 'Failed to fetch flashcard decks', isLoading: false });
      toast.error('Failed to load flashcard decks');
      console.error('Failed to fetch flashcard decks:', error);
    }
  },

  fetchDeck: async (deckId: string) => {
    set({ isLoading: true, error: null });
    try {
      const deckWithCards = await flashcardService.getDeck(deckId);
      // The new API returns { deck: {...}, cards: [...] } format
      set({ currentDeck: deckWithCards, isLoading: false });
      return deckWithCards;
    } catch (error) {
      set({ error: 'Failed to fetch deck', isLoading: false });
      toast.error('Failed to load flashcard deck');
      throw error;
    }
  },

  deleteDeck: async (deckId: string) => {
    try {
      await flashcardService.deleteDeck(deckId);
      set((state) => ({
        decks: state.decks.filter((d) => d.id !== deckId),
      }));
      toast.success('Deck deleted successfully');
    } catch (error) {
      toast.error('Failed to delete deck');
      console.error('Failed to delete deck:', error);
    }
  },

  renameDeck: async (deckId: string, name: string) => {
    try {
      await flashcardService.renameDeck(deckId, name);
      set((state) => ({
        decks: state.decks.map((d) => 
          (d.id === deckId || d._id === deckId) 
            ? { ...d, name, title: name } 
            : d
        ),
        currentDeck: state.currentDeck?.deck?.id === deckId
          ? { ...state.currentDeck, deck: { ...state.currentDeck.deck, name } } 
          : state.currentDeck,
      }));
      toast.success('Deck renamed successfully');
    } catch (error) {
      toast.error('Failed to rename deck');
      console.error('Failed to rename deck:', error);
    }
  },

  importDeck: async (shareId: string) => {
    set({ isLoading: true, error: null });
    try {
      const result = await flashcardService.importDeck(shareId);
      // The import only returns an ID, so we need to fetch the full deck
      if (result.id) {
        // Refresh the deck list to include the newly imported deck
        const { fetchDecks } = get();
        await fetchDecks();
      }
      set({ isLoading: false });
      toast.success('Deck imported successfully');
    } catch (error) {
      set({ error: 'Failed to import deck', isLoading: false });
      toast.error('Failed to import deck');
      console.error('Failed to import deck:', error);
    }
  },

  startStudySession: async (deckId: string) => {
    const { fetchDeck } = get();
    await fetchDeck(deckId);

    const deck = get().currentDeck;
    if (!deck) return;

    // Use cards from the new API structure that are already Flashcard objects
    const reviewCards: Flashcard[] = deck.cards.map(card => ({
      ...card,
      easeFactor: card.easeFactor || 2.5,
      interval: card.interval || 1,
      repetitions: card.repetitions || 0,
      nextDue: card.nextDue,
    }));
    
    // Get due cards
    const dueCards = getDueCards(reviewCards);
    const cardsToReview = dueCards.length > 0 ? dueCards : reviewCards;

    const session: StudySession = {
      deckId,
      totalCards: cardsToReview.length,
      reviewedCards: 0,
      ratings: {
        again: 0,
        hard: 0,
        good: 0,
        easy: 0,
      },
      startTime: Date.now(),
    };

    set({
      reviewQueue: cardsToReview,
      currentCardIndex: 0,
      showAnswer: false,
      studySession: session,
      pendingReviews: [],
    });

    // Track flashcard activity for daily goals
    flashcardService.startSession(deckId, deck.deck.name, cardsToReview.length).catch(() => {
      // Tracking failure shouldn't block the user
    });
  },

  flipCard: () => {
    set((state) => ({ showAnswer: !state.showAnswer }));
  },

  nextCard: () => {
    const { currentCardIndex, reviewQueue } = get();
    if (currentCardIndex < reviewQueue.length - 1) {
      set({ 
        currentCardIndex: currentCardIndex + 1,
        showAnswer: false,
      });
    }
  },

  previousCard: () => {
    const { currentCardIndex } = get();
    if (currentCardIndex > 0) {
      set({ 
        currentCardIndex: currentCardIndex - 1,
        showAnswer: false,
      });
    }
  },

  rateCard: (rating: 'again' | 'hard' | 'good' | 'easy') => {
    const { currentCardIndex, reviewQueue, studySession, pendingReviews, currentDeck } = get();
    if (!studySession || !currentDeck) return;

    const currentCard = reviewQueue[currentCardIndex];
    if (!currentCard) return;

    // Convert rating to numeric for SuperMemo-2
    const ratingMap: Record<string, number> = { 'again': 0, 'hard': 1, 'good': 3, 'easy': 5 };
    const numericRating = ratingMap[rating];

    // Calculate new spaced repetition values
    const result = calculateSpacedRepetition(
      currentCard.easeFactor || 2.5,
      currentCard.interval || 0,
      currentCard.repetitions || 0,
      rating
    );

    // Update the card locally
    const updatedCard = {
      ...currentCard,
      ...result,
    };

    // Add to pending reviews with card index and the computed SM-2 result,
    // so endStudySession can persist each card's outcome to the server.
    const newPendingReviews = [
      ...pendingReviews.filter(r => r.cardIndex !== currentCardIndex),
      {
        cardIndex: currentCardIndex,
        rating: numericRating as number,
        cardId: currentCard.id,
        easeFactor: result.easeFactor,
        interval: result.interval,
        repetitions: result.repetitions,
        nextDue: result.nextDue,
      },
    ];

    // Update study session stats
    const updatedSession = {
      ...studySession,
      reviewedCards: studySession.reviewedCards + 1,
      ratings: {
        ...studySession.ratings,
        [rating]: (studySession.ratings as Record<string, number>)[rating] + 1,
      },
    };

    set({
      reviewQueue: reviewQueue.map((card, index) =>
        index === currentCardIndex ? updatedCard : card
      ),
      pendingReviews: newPendingReviews,
      studySession: updatedSession,
    });

    // Auto-advance to next card
    const { nextCard } = get();
    if (currentCardIndex < reviewQueue.length - 1) {
      setTimeout(nextCard, 300);
    }
  },

  endStudySession: async () => {
    const { pendingReviews, studySession, currentDeck } = get();
    if (!studySession || !currentDeck) return;

    // Persist each rated card's SM-2 outcome individually (no bulk endpoint
    // exists on the server). Failures are logged but never block session
    // completion.
    if (pendingReviews.length > 0) {
      const reviews = pendingReviews;
      const results = await Promise.allSettled(
        reviews.map(r =>
          flashcardService.reviewCard(
            r.cardId as string,
            r.easeFactor as number,
            r.interval as number,
            r.repetitions as number,
            r.nextDue as string
          )
        )
      );
      const failed = results.filter(r => r.status === 'rejected').length;
      if (failed > 0) {
        trackError(new Error(`Failed to persist ${failed}/${reviews.length} flashcard reviews`), {
          source: 'endStudySession',
        });
      }
      toast.success(`Study session completed! Reviewed ${pendingReviews.length} cards`);
    }

    // Update session
    if (studySession) {
      try {
        // Note: Session tracking isn't implemented on server yet
        // const sessionId = await flashcardService.startSession(currentDeck.deck.id);
        // await flashcardService.updateSession(sessionId, studySession.reviewedCards, studySession.ratings.good + studySession.ratings.easy, true);
        console.warn('Session tracking needs implementation');
      } catch (error) {
        console.error('Failed to update session:', error);
      }
    }

    // Update deck's lastReviewed
    const { decks } = get();
    if (currentDeck) {
      set({
        decks: decks.map((d) =>
          d.id === currentDeck.deck.id
            ? { ...d, lastReviewed: new Date().toISOString() }
            : d
        ),
      });
    }

    get().resetStudy();
  },

  resetStudy: () => {
    set({
      currentDeck: null,
      currentCardIndex: 0,
      showAnswer: false,
      studySession: null,
      reviewQueue: [],
      pendingReviews: [],
    });
  },
}));