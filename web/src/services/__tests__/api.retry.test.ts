import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import toast from 'react-hot-toast';
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

// Axios exposes registered interceptors on `.handlers`; grab the response
// error handler directly so we can drive it with a synthetic AxiosError
// without performing a real network round-trip.
function getResponseErrorHandler() {
  const handlers = (api.interceptors.response as unknown as {
    handlers: Array<{ rejected: (error: unknown) => Promise<unknown> }>;
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

describe('api.ts response interceptor — 503 bounded retry', () => {
  const originalAdapter = api.defaults.adapter;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    api.defaults.adapter = originalAdapter;
  });

  it('retries a 503 once, then resolves with the 200 from the retried request, waiting 500ms', async () => {
    const rejected = getResponseErrorHandler();
    const error = makeAxiosError(503, { error: { message: 'Service temporarily unavailable, please retry' } });

    // Stub the transport adapter so the retried call (issued via the same
    // `api` instance, through `api(cfg)`) resolves instantly with a 200
    // instead of making a real network request. Using the adapter — rather
    // than spying on `api.request` — ensures we intercept regardless of
    // whether the retry is issued as `api(cfg)` or `api.request(cfg)`.
    const adapterSpy = vi.fn().mockResolvedValue({
      status: 200,
      data: { ok: true },
      statusText: 'OK',
      headers: {},
      config: error.config,
    });
    api.defaults.adapter = adapterSpy;

    const promise = rejected(error);

    await vi.advanceTimersByTimeAsync(500);

    const result = (await promise) as { status: number; data: unknown; config: { _retryCount503?: number } };
    expect(result).toMatchObject({ status: 200, data: { ok: true } });
    expect(adapterSpy).toHaveBeenCalledTimes(1);
    // Axios clones/merges the config on each internal `api(cfg)` call, so we
    // read `_retryCount503` off the settled result's config, not the original
    // (stale) `error.config` reference — the counter value still propagates
    // forward through axios's config merge, just not via reference identity.
    expect(result.config._retryCount503).toBe(1);
    expect(mockedToast.error).not.toHaveBeenCalled();
  });

  it('retries 503 twice then resolves with 200 on the third attempt, awaiting both delays', async () => {
    const rejected = getResponseErrorHandler();
    const error = makeAxiosError(503, { error: { message: 'Service temporarily unavailable, please retry' } });

    // 1st retried attempt -> 503, 2nd retried attempt -> 200. Adapters are
    // responsible for calling `settle()`/rejecting on a non-2xx status
    // themselves; a bare custom adapter doesn't reject automatically, so we
    // reject explicitly here to mimic the real xhr/http adapter's behavior.
    // Crucially, we reuse the *config object the adapter receives* (the same
    // reference `_retryCount503` is stamped onto), not a disconnected one —
    // otherwise the counter would never accumulate across retries.
    let call = 0;
    const adapterSpy = vi.fn().mockImplementation(async (cfg) => {
      call += 1;
      if (call === 1) {
        return Promise.reject({
          isAxiosError: true,
          response: { status: 503, data: { error: { message: 'Service temporarily unavailable, please retry' } } },
          config: cfg,
          request: {},
          message: 'Request failed',
        });
      }
      return { status: 200, data: { ok: true }, statusText: 'OK', headers: {}, config: cfg };
    });
    api.defaults.adapter = adapterSpy;

    const promise = rejected(error);

    await vi.advanceTimersByTimeAsync(500); // first retry delay
    await vi.advanceTimersByTimeAsync(1500); // second retry delay

    const result = (await promise) as { status: number; data: unknown; config: { _retryCount503?: number } };
    expect(result).toMatchObject({ status: 200, data: { ok: true } });
    expect(result.config._retryCount503).toBe(2);
    expect(mockedToast.error).not.toHaveBeenCalled();
  });

  it('rejects after 3 total attempts (2 retries) and toasts the final-failure copy exactly once', async () => {
    const rejected = getResponseErrorHandler();
    const error = makeAxiosError(503, { error: { message: 'Service temporarily unavailable, please retry' } });

    // All retried attempts also come back 503. Reuse the config object the
    // adapter receives so `_retryCount503` accumulates across attempts.
    const adapterSpy = vi.fn().mockImplementation(async (cfg) =>
      Promise.reject({
        isAxiosError: true,
        response: { status: 503, data: { error: { message: 'Service temporarily unavailable, please retry' } } },
        config: cfg,
        request: {},
        message: 'Request failed',
      })
    );
    api.defaults.adapter = adapterSpy;

    let rejection: { response?: { status?: number }; config?: { _retryCount503?: number } } | undefined;
    // Attach the catch handler synchronously (before advancing fake timers)
    // so intermediate rejections inside axios's internal retry chain are
    // never briefly "unhandled" from Node's perspective.
    const settled = rejected(error).catch((e: unknown) => {
      rejection = e as typeof rejection;
    });

    await vi.advanceTimersByTimeAsync(500);
    await vi.advanceTimersByTimeAsync(1500);
    await settled;
    expect(rejection).toMatchObject({ response: { status: 503 } });

    // _retryCount503 is incremented once per 503 seen (initial + 2 retries),
    // so it lands on 3 at the point retrying stops (the 3rd increment fails
    // the `<= 2` guard) — this matches "max 2 retries, 3 attempts total".
    expect(rejection?.config?._retryCount503).toBe(3);
    expect(mockedToast.error).toHaveBeenCalledTimes(1);
    expect(mockedToast.error).toHaveBeenCalledWith('Temporary server issue — please try again in a moment.');
  });
});
