import { describe, it, expect, vi, beforeEach } from 'vitest';

// Control whether the shared pg pool query rejects (transient DB error) or
// returns no rows.
let poolShouldReject = false;
vi.mock('../utils/pgPool.js', () => ({
  default: {
    query: vi.fn(() => (poolShouldReject ? Promise.reject(new Error('DB down')) : Promise.resolve({ rows: [] }))),
  },
  closePool: vi.fn(),
}));

// Supabase mock (only reached on the happy path).
vi.mock('../config/services.config.js', () => ({
  getSupabase: () => ({
    from: () => {
      const chain = {};
      for (const m of ['upsert', 'select', 'insert', 'update', 'eq', 'single']) chain[m] = () => chain;
      chain.then = (r) => r({ data: null, error: null });
      return chain;
    },
  }),
}));

const { syncUserToSupabase } = await import('../middleware/syncUser.middleware.js');

function run(req) {
  return new Promise((resolve) => {
    const res = {
      statusCode: 200,
      status(c) { this.statusCode = c; return this; },
      json(body) { resolve({ statusCode: this.statusCode, body, nexted: false }); },
    };
    syncUserToSupabase(req, res, () => resolve({ statusCode: 200, nexted: true }));
  });
}

beforeEach(() => { poolShouldReject = false; });

describe('syncUserToSupabase identity hygiene', () => {
  it('returns 503 (retryable) on an id-mapping DB error rather than minting a throwaway UUID', async () => {
    poolShouldReject = true;
    const out = await run({ user: { id: 'better-auth-1', email: 'u@example.com' } });
    expect(out.statusCode).toBe(503);
    expect(out.nexted).toBe(false);
  });

  it('skips sync (next) when there is no authenticated user', async () => {
    const out = await run({});
    expect(out.nexted).toBe(true);
  });
});
