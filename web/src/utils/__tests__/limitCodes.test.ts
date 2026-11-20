import { describe, it, expect } from 'vitest';
import { isLimitReachedCode } from '../limitCodes';

describe('isLimitReachedCode', () => {
  it('returns true for LIFETIME_LIMIT_REACHED (free-tier quiz/flashcard/upload/chart)', () => {
    expect(isLimitReachedCode('LIFETIME_LIMIT_REACHED')).toBe(true);
  });

  it('returns true for WEEKLY_LIMIT_REACHED (free-tier chat)', () => {
    expect(isLimitReachedCode('WEEKLY_LIMIT_REACHED')).toBe(true);
  });

  it('returns true for DAILY_LIMIT_REACHED (paid tiers)', () => {
    expect(isLimitReachedCode('DAILY_LIMIT_REACHED')).toBe(true);
  });

  it('returns false for FILE_STORAGE_LIMIT_REACHED (different, separate flow)', () => {
    expect(isLimitReachedCode('FILE_STORAGE_LIMIT_REACHED')).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isLimitReachedCode(undefined)).toBe(false);
  });

  it('returns false for an empty string', () => {
    expect(isLimitReachedCode('')).toBe(false);
  });

  it('returns false for a non-string value', () => {
    expect(isLimitReachedCode(429)).toBe(false);
    expect(isLimitReachedCode(null)).toBe(false);
    expect(isLimitReachedCode({ code: 'DAILY_LIMIT_REACHED' })).toBe(false);
  });
});
