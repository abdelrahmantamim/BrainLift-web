import { describe, it, expect, vi, beforeEach } from 'vitest';
import api from '../../services/api';
import { trackEvent } from '../analytics';
import { useLimitModalStore } from '../../store/limitModalStore';
import { checkAndGate, refreshLimits, invalidateCache } from '../limits';

vi.mock('../../services/api', () => ({
  default: {
    get: vi.fn(),
  },
}));

vi.mock('../analytics', () => ({
  trackEvent: vi.fn(),
}));

const mockedApi = vi.mocked(api, true);
const mockedTrackEvent = vi.mocked(trackEvent);

function structuredResponse(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    tier: 'free',
    expiresAt: null,
    limits: {
      quiz: { limit: 5, used: 5, remaining: 0, type: 'lifetime' },
      flashcard: { limit: 5, used: 1, remaining: 4, type: 'lifetime' },
      file_upload: { limit: 5, used: 1, remaining: 4, type: 'lifetime' },
      chat: { limit: 20, used: 1, remaining: 19, type: 'weekly' },
      export: { limit: -1, used: 0, remaining: -1, type: 'lifetime' },
      chart: { limit: 5, used: 0, remaining: 5, type: 'lifetime' },
      file_storage: { limit: 10, used: 0, remaining: 10, type: 'cumulative' },
    },
    ...overrides,
  };
}

describe('limits.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    invalidateCache();
    useLimitModalStore.getState().close();
  });

  it('normalizes the new per-feature shape', async () => {
    mockedApi.get.mockResolvedValue({ data: structuredResponse() });

    const data = await refreshLimits();

    expect(data?.limits.quiz).toEqual({ limit: 5, used: 5, remaining: 0, type: 'lifetime' });
    expect(data?.tier).toBe('free');
  });

  it('returns true for paid tier without fetching counts twice within TTL', async () => {
    mockedApi.get.mockResolvedValue({ data: structuredResponse({ tier: 'pro' }) });

    const first = await checkAndGate('quiz', 'quiz_generation');
    const second = await checkAndGate('quiz', 'quiz_generation');

    expect(first).toBe(true);
    expect(second).toBe(true);
    expect(mockedApi.get).toHaveBeenCalledTimes(1);
  });

  it('free tier with remaining: 0 returns false, tracks limit_hit, and opens the modal', async () => {
    mockedApi.get.mockResolvedValue({ data: structuredResponse() });

    const allowed = await checkAndGate('quiz', 'quiz_generation');

    expect(allowed).toBe(false);
    expect(mockedTrackEvent).toHaveBeenCalledWith('limit_hit', {
      limitType: 'quiz',
      currentUsage: 5,
      limit: 5,
    });
    expect(useLimitModalStore.getState().isOpen).toBe(true);
    expect(useLimitModalStore.getState().params).toMatchObject({
      limitType: 'quiz',
      used: 5,
      total: 5,
      placement: 'quiz_generation',
    });
  });

  it('fails open (returns true) on fetch failure', async () => {
    mockedApi.get.mockRejectedValue(new Error('network down'));

    const allowed = await checkAndGate('quiz', 'quiz_generation');

    expect(allowed).toBe(true);
  });
});
