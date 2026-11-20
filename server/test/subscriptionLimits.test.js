import { describe, it, expect, vi, beforeEach } from 'vitest';

// rpc result is controlled per test.
let rpcResult = { data: [{ allowed: true, current_usage: 1 }], error: null };
const rpcSpy = vi.fn(() => Promise.resolve(rpcResult));

function tableChain(table) {
  const chain = {};
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.single = vi.fn(() => chain);
  // profiles -> a free-tier user; app_config -> error so defaults are used.
  if (table === 'profiles') {
    chain.then = (resolve) => resolve({ data: { subscription_tier: 'free', subscription_end_date: null }, error: null });
  } else {
    chain.then = (resolve) => resolve({ data: null, error: { message: 'not found' } });
  }
  return chain;
}

const supabaseMock = {
  from: vi.fn((t) => tableChain(t)),
  rpc: (...a) => rpcSpy(...a),
};

vi.mock('../config/services.config.js', () => ({ getSupabase: () => supabaseMock }));

const { checkSubscriptionLimit } = await import('../middleware/subscriptionLimits.middleware.js');

function run(featureType, req = {}) {
  const mw = checkSubscriptionLimit(featureType);
  return new Promise((resolve) => {
    const res = {
      statusCode: 200,
      once: vi.fn(),
      status(c) { this.statusCode = c; return this; },
      json(body) { resolve({ statusCode: this.statusCode, body, nexted: false }); },
    };
    mw({ method: 'POST', userId: 'u1', ...req }, res, () => resolve({ statusCode: 200, nexted: true }));
  });
}

beforeEach(() => {
  rpcResult = { data: [{ allowed: true, current_usage: 1 }], error: null };
  rpcSpy.mockClear();
});

describe('checkSubscriptionLimit (atomic RPC)', () => {
  it('calls the atomic RPC and proceeds when allowed', async () => {
    const out = await run('quiz');
    expect(out.nexted).toBe(true);
    expect(rpcSpy).toHaveBeenCalledWith('reserve_feature_usage', expect.objectContaining({
      p_user_id: 'u1', p_feature: 'quiz',
    }));
  });

  it('returns 429 with a *_LIMIT_REACHED code when the RPC denies', async () => {
    rpcResult = { data: [{ allowed: false, current_usage: 5 }], error: null };
    const out = await run('quiz');
    expect(out.statusCode).toBe(429);
    expect(out.body?.error?.code).toMatch(/LIMIT_REACHED$/);
  });

  it('fails open (next) on an RPC error rather than blocking a paying user', async () => {
    rpcResult = { data: null, error: { message: 'db down' } };
    const out = await run('quiz');
    expect(out.nexted).toBe(true);
  });

  it('passes through GET requests without calling the RPC', async () => {
    const out = await run('quiz', { method: 'GET' });
    expect(out.nexted).toBe(true);
    expect(rpcSpy).not.toHaveBeenCalled();
  });

  it('finalizes a successful response and releases a failed response', async () => {
    const listeners = {};
    const res = { statusCode: 200, once: vi.fn((event, fn) => { listeners[event] = fn; }) };
    await new Promise(resolve => checkSubscriptionLimit('quiz')({ method: 'POST', userId: 'u1' }, res, resolve));
    listeners.finish();
    await vi.waitFor(() => expect(rpcSpy).toHaveBeenCalledWith('finalize_feature_usage', expect.any(Object)));

    rpcSpy.mockClear();
    const failedListeners = {};
    const failedRes = { statusCode: 500, once: vi.fn((event, fn) => { failedListeners[event] = fn; }) };
    await new Promise(resolve => checkSubscriptionLimit('quiz')({ method: 'POST', userId: 'u1' }, failedRes, resolve));
    failedListeners.finish();
    await vi.waitFor(() => expect(rpcSpy).toHaveBeenCalledWith('release_feature_usage', expect.any(Object)));
  });

  it('releases a pending reservation when the client disconnects', async () => {
    const listeners = {};
    const res = { statusCode: 200, once: vi.fn((event, fn) => { listeners[event] = fn; }) };
    await new Promise(resolve => checkSubscriptionLimit('chat')({ method: 'POST', userId: 'u1' }, res, resolve));
    listeners.close();
    await vi.waitFor(() => expect(rpcSpy).toHaveBeenCalledWith('release_feature_usage', expect.any(Object)));
  });
});
