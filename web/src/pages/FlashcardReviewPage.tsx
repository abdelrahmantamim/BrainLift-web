import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  RotateCw,
  BookOpen,
  Home,
  X,
  Shuffle,
} from 'lucide-react';
import { useFlashcardStore } from '@/store/flashcardStore';
import { flashcardService } from '@/services/flashcard.service';
import type { DeckWithCards, Flashcard } from '@/types/flashcard.types';
import { cn } from '@/lib/utils';

export const FlashcardReviewPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { fetchDeck, isLoading } = useFlashcardStore();

  const [deck, setDeck] = useState<DeckWithCards | null>(null);
  const [reviewCards, setReviewCards] = useState<Flashcard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);

  useEffect(() => {
    if (id) {
      loadDeck();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const loadDeck = async () => {
    try {
      const deckData = await fetchDeck(id!);
      if (deckData) {
        setDeck(deckData);
        // Cards from new API are already in Flashcard format
        const flashcards: Flashcard[] = deckData.cards.map(card => ({
          ...card,
          easeFactor: card.easeFactor || 2.5,
          interval: card.interval || 1,
          repetitions: card.repetitions || 0,
        }));
        setReviewCards(flashcards);

        // Track flashcard activity for daily goals
        flashcardService.startSession(id!, deckData.deck.name, flashcards.length).catch(() => {
          // Tracking failure shouldn't block the user
        });
      }
    } catch {
      navigate('/flashcards');
    }
  };

  const handleFlip = () => {
    setShowAnswer(!showAnswer);
  };

  const handleNext = () => {
    if (currentIndex < reviewCards.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setShowAnswer(false);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setShowAnswer(false);
    }
  };

  const handleShuffle = () => {
    const shuffled = [...reviewCards].sort(() => Math.random() - 0.5);
    setReviewCards(shuffled);
    setCurrentIndex(0);
    setShowAnswer(false);
  };

  const handleRestart = () => {
    setCurrentIndex(0);
    setShowAnswer(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <BookOpen className="w-12 h-12 mx-auto mb-4 text-pg-coral animate-pulse" />
          <p className="font-body text-pg-text-secondary">Loading flashcards...</p>
        </div>
      </div>
    );
  }

  if (!deck || reviewCards.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="font-body text-pg-text-secondary mb-4">No cards to review</p>
          <button
            onClick={() => navigate('/flashcards')}
            className="pg-btn pg-btn-outline"
          >
            Back to Decks
          </button>
        </div>
      </div>
    );
  }

  const currentCard = reviewCards[currentIndex];
  const progress = ((currentIndex + 1) / reviewCards.length) * 100;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => navigate('/flashcards')}
          className="p-2 rounded-lg hover:bg-pg-cream transition-colors"
        >
          <X className="w-5 h-5 text-pg-navy" />
        </button>

        <div className="flex-1 mx-8">
          <div className="flex items-center justify-between text-sm font-body text-pg-text-secondary mb-2">
            <span>{deck.deck.name} (Review Mode)</span>
            <span>{currentIndex + 1} / {reviewCards.length}</span>
          </div>
          <div className="pg-xp-track">
            <div
              className="pg-xp-fill transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <button
          onClick={handleShuffle}
          className="p-2 rounded-lg hover:bg-pg-cream transition-colors"
          title="Shuffle cards"
        >
          <Shuffle className="w-5 h-5 text-pg-navy" />
        </button>
      </div>

      {/* Flashcard */}
      <div className="relative h-96 mb-8 perspective-1000">
        <div
          className={cn(
            "relative w-full h-full transition-transform duration-500 transform-style-3d cursor-pointer",
            showAnswer && "rotate-y-180"
          )}
          onClick={handleFlip}
        >
          {/* Front — Question */}
          <div className="pg-card shadow-clay-coral absolute inset-0 h-full p-8 flex flex-col text-center backface-hidden">
            <p className="text-sm font-body text-pg-text-secondary mb-4 flex-shrink-0">Question</p>
            <div className="flex-1 overflow-y-auto flex items-center justify-center">
              <div>
                <h2 className="text-2xl font-heading font-bold text-pg-navy">{currentCard.question}</h2>
                {currentCard.citation && (
                  <p className="text-sm font-body text-pg-text-secondary mt-4">Source: {currentCard.citation}</p>
                )}
              </div>
            </div>
          </div>

          {/* Back — Answer */}
          <div className="pg-card shadow-clay-teal absolute inset-0 h-full p-8 flex flex-col text-center backface-hidden rotate-y-180">
            <p className="text-sm font-body text-pg-text-secondary mb-4 flex-shrink-0">Answer</p>
            <div className="flex-1 overflow-y-auto flex items-center justify-center">
              <div>
                <h2 className="text-2xl font-heading font-bold text-pg-navy">{currentCard.answer}</h2>
                {currentCard.citation && (
                  <p className="text-sm font-body text-pg-text-secondary mt-4">Source: {currentCard.citation}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="space-y-4">
        <button
          onClick={handleFlip}
          className="w-full pg-btn pg-btn-coral transform hover:scale-[1.02]"
        >
          {showAnswer ? 'Show Question' : 'Show Answer'}
        </button>

        <div className="flex items-center justify-between">
          <button
            onClick={handlePrevious}
            disabled={currentIndex === 0}
            className="pg-btn pg-btn-outline disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <ChevronLeft className="w-5 h-5" />
            Previous
          </button>

          <div className="flex gap-2">
            <button
              onClick={handleFlip}
              className="p-2 rounded-lg hover:bg-pg-cream transition-colors"
            >
              <RotateCw className="w-5 h-5 text-pg-navy" />
            </button>

            {currentIndex === reviewCards.length - 1 && (
              <button
                onClick={handleRestart}
                className="pg-btn pg-btn-outline"
              >
                Restart
              </button>
            )}
          </div>

          <button
            onClick={handleNext}
            disabled={currentIndex === reviewCards.length - 1}
            className="pg-btn pg-btn-outline disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            Next
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {currentIndex === reviewCards.length - 1 && (
          <button
            onClick={() => navigate('/flashcards')}
            className="w-full pg-btn pg-btn-teal flex items-center justify-center gap-2"
          >
            <Home className="w-5 h-5" />
            Back to Decks
          </button>
        )}
      </div>
    </div>
  );
};
