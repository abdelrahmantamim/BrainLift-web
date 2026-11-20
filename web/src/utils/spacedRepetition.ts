import type { SpacedRepetitionResult } from '@/types/flashcard.types';

/**
 * SM-2 Spaced Repetition Algorithm
 * Based on the SuperMemo 2 algorithm for spaced repetition learning
 */
export function calculateSpacedRepetition(
  currentEaseFactor: number,
  currentInterval: number,
  currentRepetitions: number,
  rating: 'again' | 'hard' | 'good' | 'easy'
): SpacedRepetitionResult {
  // Convert rating to quality (0-3)
  const qualityMap = {
    again: 0,
    hard: 1,
    good: 2,
    easy: 3,
  };
  const quality = qualityMap[rating];

  let easeFactor = currentEaseFactor;
  let interval = currentInterval;
  let repetitions = currentRepetitions;

  // Calculate new ease factor
  easeFactor = Math.max(1.3, easeFactor + (0.1 - (3 - quality) * (0.08 + (3 - quality) * 0.02)));

  // Calculate interval based on quality
  if (quality < 2) {
    // Failed card - reset
    repetitions = 0;
    interval = 1;
  } else {
    // Passed card
    if (repetitions === 0) {
      interval = 1;
    } else if (repetitions === 1) {
      interval = 6;
    } else {
      interval = Math.round(interval * easeFactor);
    }
    repetitions += 1;
  }

  // Apply rating-specific adjustments
  switch (rating) {
    case 'easy':
      interval = Math.round(interval * 1.3);
      break;
    case 'hard':
      interval = Math.round(interval * 0.6);
      break;
  }

  // Calculate next due date
  const nextDue = new Date();
  nextDue.setDate(nextDue.getDate() + interval);

  return {
    easeFactor,
    interval,
    repetitions,
    nextDue: nextDue.toISOString(),
  };
}

/**
 * Check if a card is due for review
 */
export function isCardDue(nextDue?: string): boolean {
  if (!nextDue) return true;
  return new Date(nextDue) <= new Date();
}

/**
 * Get cards that are due for review
 */
export function getDueCards<T extends { nextDue?: string }>(cards: T[]): T[] {
  return cards.filter(card => isCardDue(card.nextDue));
}

/**
 * Sort cards by due date (most overdue first)
 */
export function sortByDueDate<T extends { nextDue?: string }>(cards: T[]): T[] {
  return [...cards].sort((a, b) => {
    if (!a.nextDue) return -1;
    if (!b.nextDue) return 1;
    return new Date(a.nextDue).getTime() - new Date(b.nextDue).getTime();
  });
}