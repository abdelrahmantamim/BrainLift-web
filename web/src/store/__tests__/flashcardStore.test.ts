import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act } from '@testing-library/react';
import { useFlashcardStore } from '../flashcardStore';
import { flashcardService } from '@/services/flashcard.service';
import { trackError } from '@/utils/analytics';
import type { DeckWithCards } from '@/types/flashcard.types';

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/services/flashcard.service', () => ({
  flashcardService: {
    getDeck: vi.fn(),
    startSession: vi.fn().mockResolvedValue('session-1'),
    reviewCard: vi.fn(),
  },
}));

vi.mock('@/utils/analytics', () => ({
  trackError: vi.fn(),
}));

const mockedFlashcardService = vi.mocked(flashcardService);
const mockedTrackError = vi.mocked(trackError);

function makeDeck(): DeckWithCards {
  return {
    deck: {
      id: 'deck-1',
      name: 'Test Deck',
      createdAt: new Date().toISOString(),
    },
    cards: [
      {
        id: 'card-1',
        question: 'Q1',
        answer: 'A1',
        easeFactor: 2.5,
        interval: 0,
        repetitions: 0,
        nextDue: new Date(0).toISOString(),
      },
      {
        id: 'card-2',
        question: 'Q2',
        answer: 'A2',
        easeFactor: 2.5,
        interval: 0,
        repetitions: 0,
        nextDue: new Date(0).toISOString(),
      },
    ],
  };
}

describe('flashcardStore — SM-2 review persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedFlashcardService.startSession.mockResolvedValue('session-1');
    useFlashcardStore.setState({
      decks: [],
      currentDeck: null,
      currentCardIndex: 0,
      showAnswer: false,
      studySession: null,
      reviewQueue: [],
      pendingReviews: [],
      isLoading: false,
      error: null,
    });
  });

  it('persists one reviewCard call per rated card with the SM-2 values from pendingReviews, and tolerates a rejected call', async () => {
    mockedFlashcardService.getDeck.mockResolvedValue(makeDeck());
    mockedFlashcardService.reviewCard
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce(undefined);

    await act(async () => {
      await useFlashcardStore.getState().startStudySession('deck-1');
    });

    act(() => {
      useFlashcardStore.getState().rateCard('good');
    });
    // rateCard schedules its own auto-advance via setTimeout; advance
    // explicitly so the second rating lands on card-2, not card-1 again.
    act(() => {
      useFlashcardStore.getState().nextCard();
    });
    act(() => {
      useFlashcardStore.getState().rateCard('easy');
    });

    const pendingReviews = useFlashcardStore.getState().pendingReviews;
    expect(pendingReviews).toHaveLength(2);

    await act(async () => {
      await useFlashcardStore.getState().endStudySession();
    });

    expect(mockedFlashcardService.reviewCard).toHaveBeenCalledTimes(2);

    for (const review of pendingReviews) {
      expect(mockedFlashcardService.reviewCard).toHaveBeenCalledWith(
        review.cardId,
        review.easeFactor,
        review.interval,
        review.repetitions,
        review.nextDue
      );
    }

    // One call rejected — should be logged, not thrown, and must not have
    // prevented session completion (resetStudy ran: currentDeck cleared).
    expect(mockedTrackError).toHaveBeenCalledTimes(1);
    expect(mockedTrackError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ source: 'endStudySession' })
    );
    expect(useFlashcardStore.getState().currentDeck).toBeNull();
    expect(useFlashcardStore.getState().studySession).toBeNull();
  });
});
