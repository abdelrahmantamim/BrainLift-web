import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  RotateCw,
  BookOpen,
  Trophy,
  Clock,
  Home,
  X,
} from 'lucide-react';
import { useFlashcardStore } from '@/store/flashcardStore';
import { DIFFICULTY_RATINGS } from '@/types/flashcard.types';
import { cn } from '@/lib/utils';

export const FlashcardStudyPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    currentDeck,
    currentCardIndex,
    showAnswer,
    studySession,
    reviewQueue,
    isLoading,
    startStudySession,
    flipCard,
    nextCard,
    previousCard,
    rateCard,
    endStudySession,
    resetStudy,
  } = useFlashcardStore();

  const [showResults, setShowResults] = useState(false);
  const [, setIsFlipping] = useState(false);

  useEffect(() => {
    if (id) {
      startStudySession(id);
    }

    return () => {
      resetStudy();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleFlip = () => {
    setIsFlipping(true);
    setTimeout(() => {
      flipCard();
      setIsFlipping(false);
    }, 150);
  };

  const handleRate = (rating: 'again' | 'hard' | 'good' | 'easy') => {
    rateCard(rating);

    // Check if this was the last card
    if (currentCardIndex === reviewQueue.length - 1) {
      setTimeout(() => setShowResults(true), 500);
    }
  };

  const handleFinish = async () => {
    await endStudySession();
    navigate('/flashcards');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <BookOpen className="w-12 h-12 mx-auto mb-4 text-pg-coral animate-pulse" />
          <p className="text-pg-text-secondary font-body">Loading flashcards...</p>
        </div>
      </div>
    );
  }

  if (!currentDeck || reviewQueue.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <p className="text-pg-text-secondary font-body mb-4">No cards to study</p>
          <button
            onClick={() => navigate('/flashcards')}
            className="pg-btn pg-btn-coral"
          >
            Back to Decks
          </button>
        </div>
      </div>
    );
  }

  if (showResults && studySession) {
    const totalTime = Math.floor(((studySession.endTime || Date.now()) - studySession.startTime) / 1000);
    const avgTimePerCard = Math.floor(totalTime / studySession.reviewedCards);

    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="pg-card shadow-clay-yellow p-8 text-center">
          <Trophy className="w-16 h-16 mx-auto mb-4 text-pg-yellow" />
          <h1 className="text-3xl font-heading font-bold text-pg-navy mb-2">Study Session Complete!</h1>
          <p className="text-pg-text-secondary font-body mb-8">{currentDeck.deck.name}</p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="pg-card shadow-clay-coral p-4">
              <p className="text-2xl font-heading font-bold text-pg-coral">{studySession.reviewedCards}</p>
              <p className="text-sm text-pg-text-secondary font-body">Cards Reviewed</p>
            </div>
            <div className="pg-card shadow-clay-teal p-4">
              <p className="text-2xl font-heading font-bold text-pg-teal">{studySession.ratings.easy}</p>
              <p className="text-sm text-pg-text-secondary font-body">Easy</p>
            </div>
            <div className="pg-card shadow-clay-lilac p-4">
              <p className="text-2xl font-heading font-bold text-pg-lilac">{studySession.ratings.good}</p>
              <p className="text-sm text-pg-text-secondary font-body">Good</p>
            </div>
            <div className="pg-card shadow-clay-yellow p-4">
              <p className="text-2xl font-heading font-bold text-pg-yellow">
                {studySession.ratings.hard + studySession.ratings.again}
              </p>
              <p className="text-sm text-pg-text-secondary font-body">Need Practice</p>
            </div>
          </div>

          <div className="flex items-center justify-center gap-2 text-pg-text-secondary font-body mb-8">
            <Clock className="w-5 h-5" />
            <span>Total time: {Math.floor(totalTime / 60)}m {totalTime % 60}s</span>
            <span className="mx-2">-</span>
            <span>Avg per card: {avgTimePerCard}s</span>
          </div>

          <div className="flex justify-center gap-3">
            <button
              onClick={handleFinish}
              className="pg-btn pg-btn-outline flex items-center gap-2"
            >
              <Home className="w-5 h-5" />
              Back to Decks
            </button>
            <button
              onClick={() => {
                setShowResults(false);
                startStudySession(id!);
              }}
              className="pg-btn pg-btn-coral flex items-center gap-2"
            >
              <RotateCw className="w-5 h-5" />
              Study Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  const currentCard = reviewQueue[currentCardIndex];
  const progress = ((currentCardIndex + 1) / reviewQueue.length) * 100;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => navigate('/flashcards')}
          className="p-2 rounded-lg hover:bg-pg-cream transition-colors text-pg-navy"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex-1 mx-8">
          <div className="flex items-center justify-between text-sm text-pg-text-secondary font-body mb-2">
            <span>{currentDeck.deck.name}</span>
            <span>{currentCardIndex + 1} / {reviewQueue.length}</span>
          </div>
          <div className="pg-xp-track h-2">
            <div
              className="pg-xp-fill transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Flashcard */}
      <div className="relative h-96 mb-8 perspective-1000">
        <div
          className={cn(
            "absolute inset-0 w-full h-full transition-all duration-500 transform-style-3d cursor-pointer",
            showAnswer && "rotate-y-180"
          )}
          onClick={handleFlip}
        >
          {/* Front of card */}
          <div className={cn(
            "pg-card shadow-clay-coral h-full p-8 flex flex-col text-center",
            "backface-hidden absolute inset-0"
          )}>
            <p className="text-sm text-pg-text-secondary font-body mb-4 flex-shrink-0">Question</p>
            <div className="flex-1 overflow-y-auto flex items-center justify-center">
              <div>
                <h2 className="text-2xl font-heading font-semibold text-pg-navy">{currentCard.question}</h2>
                {currentCard.citation && (
                  <p className="text-sm text-pg-text-secondary font-body mt-4">Source: {currentCard.citation}</p>
                )}
              </div>
            </div>
          </div>

          {/* Back of card */}
          <div className={cn(
            "pg-card shadow-clay-teal h-full p-8 flex flex-col text-center",
            "backface-hidden rotate-y-180 absolute inset-0"
          )}>
            <p className="text-sm text-pg-text-secondary font-body mb-4 flex-shrink-0">Answer</p>
            <div className="flex-1 overflow-y-auto flex items-center justify-center">
              <div>
                <h2 className="text-2xl font-heading font-semibold text-pg-navy">{currentCard.answer}</h2>
                {currentCard.citation && (
                  <p className="text-sm text-pg-text-secondary font-body mt-4">Source: {currentCard.citation}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="space-y-4">
        {!showAnswer ? (
          <button
            onClick={handleFlip}
            className="w-full pg-btn pg-btn-coral pg-btn-lg justify-center"
          >
            Reveal Answer
          </button>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {(Object.keys(DIFFICULTY_RATINGS) as Array<keyof typeof DIFFICULTY_RATINGS>).map((rating) => {
              const config = DIFFICULTY_RATINGS[rating];
              return (
                <button
                  key={rating}
                  onClick={() => handleRate(rating)}
                  className={cn(
                    "py-3 px-4 rounded-btn font-heading font-semibold transition-all duration-200",
                    "border-2 border-pg-navy hover:-translate-y-1 cursor-pointer",
                    config.bgColor,
                    config.color,
                  )}
                >
                  {config.label}
                </button>
              );
            })}
          </div>
        )}

        <div className="flex items-center justify-between">
          <button
            onClick={previousCard}
            disabled={currentCardIndex === 0}
            className="pg-btn pg-btn-outline flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-5 h-5" />
            Previous
          </button>

          <button
            onClick={handleFlip}
            className="p-2 rounded-lg hover:bg-pg-cream transition-colors text-pg-navy"
          >
            <RotateCw className="w-5 h-5" />
          </button>

          <button
            onClick={nextCard}
            disabled={currentCardIndex === reviewQueue.length - 1}
            className="pg-btn pg-btn-outline flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};
