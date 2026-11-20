import { describe, it, expect, vi, beforeEach } from 'vitest';
import toast from 'react-hot-toast';
import { trackEvent } from '@/utils/analytics';
import { useLimitModalStore } from '@/store/limitModalStore';
import api from '../api';

vi.mock('react-hot-toast', () => ({
  default: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock('@/utils/analytics', () => ({
  trackEvent: vi.fn(),
}));

vi.mock('@/services/auth.service', () => ({
  authService: {
    refreshSession: vi.fn(),
  },
}));

const mockedToast = vi.mocked(toast, true);
const mockedTrackEvent = vi.mocked(trackEvent);

// Axios exposes registered interceptors on `.handlers`; grab the response
// error handler directly so we can drive it with a synthetic AxiosError
// without performing a real network round-trip.
function getResponseErrorHandler() {
  const handlers = (api.interceptors.response as unknown as {
    handlers: Array<{ rejected: (error: unknown) => unknown }>;
  }).handlers;
  const handler = handlers.find((h) => h && typeof h.rejected === 'function');
  if (!handler) throw new Error('No response error interceptor registered');
  return handler.rejected;
}

function makeAxiosError(status: number, data: unknown, url = '/some/endpoint') {
  return {
    isAxiosError: true,
    response: { status, data },
    config: { url, _retry: false },
    request: {},
    message: 'Request failed',
  };
}

describe('api.ts response interceptor — 429 limit handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useLimitModalStore.getState().close();
  });

  it('tracks limit_hit, opens the modal, and rejects without toasting for a 429 with a limit code', async () => {
    const rejected = getResponseErrorHandler();
    const error = makeAxiosError(429, {
      error: {
        code: 'LIFETIME_LIMIT_REACHED',
        tier: 'free',
        limit: 5,
        usage: 5,
        featureType: 'quiz',
        period: 'lifetime',
      },
    });

    await expect(rejected(error)).rejects.toBe(error);

    expect(mockedTrackEvent).toHaveBeenCalledWith('limit_hit', {
      limitType: 'quiz',
      currentUsage: 5,
      limit: 5,
      source: 'server_429',
    });
    expect(useLimitModalStore.getState().isOpen).toBe(true);
    expect(useLimitModalStore.getState().params).toMatchObject({
      limitType: 'quiz',
      used: 5,
      total: 5,
      period: 'lifetime',
      placement: 'server_429',
    });
    expect(mockedToast.error).not.toHaveBeenCalled();
  });

  it('falls through to the generic toast for a 429 without a recognized limit code', async () => {
    const rejected = getResponseErrorHandler();
    const error = makeAxiosError(429, {
      error: { code: 'SOME_OTHER_CODE', message: 'Too many requests' },
    });

    await expect(rejected(error)).rejects.toBe(error);

    expect(mockedTrackEvent).not.toHaveBeenCalled();
    expect(useLimitModalStore.getState().isOpen).toBe(false);
    expect(mockedToast.error).toHaveBeenCalledWith('Too many requests');
  });
});
