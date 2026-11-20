import { describe, it, expect, vi } from 'vitest';

// Default: a free-tier profile. Individual tests can override by reassigning.
let profileResult = { data: { subscription_tier: 'free', subscription_end_date: null }, error: null };

const supabaseMock = {
  from: vi.fn(() => {
    const chain = {};
    chain.select = vi.fn(() => chain);
    chain.eq = vi.fn(() => chain);
    chain.single = vi.fn(() => chain);
    chain.then = (resolve, reject) => {
      if (profileResult instanceof Error) return reject(profileResult);
      return resolve(profileResult);
    };
    return chain;
  }),
};
vi.mock('../config/services.config.js', () => ({ getSupabase: () => supabaseMock }));

const { requirePaidWeb } = await import('../middleware/requirePaidWeb.middleware.js');

function run(req) {
  return new Promise((resolve) => {
    const res = {
      statusCode: 200,
      status(c) { this.statusCode = c; return this; },
      json(body) { resolve({ statusCode: this.statusCode, body, nexted: false }); },
    };
    requirePaidWeb(req, res, () => resolve({ statusCode: 200, nexted: true }));
  });
}

describe('requirePaidWeb — Mobile Safety Invariant', () => {
  it('mobile session + free tier → next() (no 402)', async () => {
    profileResult = { data: { subscription_tier: 'free', subscription_end_date: null }, error: null };
    const out = await run({ session: { platform: 'mobile' }, userId: 'u1', headers: {} });
    expect(out.nexted).toBe(true);
  });

  it('web session + free tier → 402 WEB_PAID_ONLY', async () => {
    profileResult = { data: { subscription_tier: 'free', subscription_end_date: null }, error: null };
    const out = await run({ session: { platform: 'web' }, userId: 'u1', headers: {} });
    expect(out.statusCode).toBe(402);
    expect(out.body?.error?.code).toBe('WEB_PAID_ONLY');
  });

  it('web session + paid tier → next()', async () => {
    profileResult = { data: { subscription_tier: 'premium', subscription_end_date: null }, error: null };
    const out = await run({ session: { platform: 'web' }, userId: 'u1', headers: {} });
    expect(out.nexted).toBe(true);
  });

  it('no session at all → next() for a mobile-origin request', async () => {
    profileResult = { data: { subscription_tier: 'free', subscription_end_date: null }, error: null };
    const out = await run({ userId: 'u1', headers: {} });
    expect(out.nexted).toBe(true);
  });

  it('web session + tier-lookup DB error → 500 (not a 402 paywall)', async () => {
    profileResult = new Error('DB down');
    const out = await run({ session: { platform: 'web' }, userId: 'u1', headers: {} });
    expect(out.statusCode).toBe(500);
    expect(out.body?.error?.code).not.toBe('WEB_PAID_ONLY');
  });

  it('web session + supabase error RESULT (non-PGRST116) → 500, not a paywall for a paying user', async () => {
    profileResult = { data: null, error: { code: '57014', message: 'query canceled' } };
    const out = await run({ session: { platform: 'web' }, userId: 'u1', headers: {} });
    expect(out.statusCode).toBe(500);
    expect(out.body?.error?.code).not.toBe('WEB_PAID_ONLY');
  });

  it('web session + missing profile (PGRST116) → treated as free → 402', async () => {
    profileResult = { data: null, error: { code: 'PGRST116', message: 'no rows' } };
    const out = await run({ session: { platform: 'web' }, userId: 'u1', headers: {} });
    expect(out.statusCode).toBe(402);
    expect(out.body?.error?.code).toBe('WEB_PAID_ONLY');
  });
});
