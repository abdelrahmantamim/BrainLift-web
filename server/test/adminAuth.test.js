import { describe, it, expect, vi, beforeEach } from 'vitest';

let adminRow = null; // set per test: a row means "is admin", null means "not admin"
const supabaseMock = {
  from: vi.fn(() => {
    const chain = {};
    chain.select = vi.fn(() => chain);
    chain.eq = vi.fn(() => chain);
    chain.single = vi.fn(() => chain);
    chain.then = (resolve) => resolve(adminRow ? { data: adminRow, error: null } : { data: null, error: null });
    return chain;
  }),
};
vi.mock('../config/services.config.js', () => ({ getSupabase: () => supabaseMock }));

const { requireSessionAdmin } = await import('../middleware/adminAuth.middleware.js');

function run(req) {
  return new Promise((resolve) => {
    const res = {
      statusCode: 200,
      status(c) { this.statusCode = c; return this; },
      json(body) { resolve({ statusCode: this.statusCode, body, nexted: false }); },
    };
    requireSessionAdmin(req, res, () => resolve({ statusCode: 200, nexted: true }));
  });
}

beforeEach(() => { adminRow = null; });

describe('requireSessionAdmin', () => {
  it('allows a known active admin', async () => {
    adminRow = { id: 'admin-uuid' };
    const out = await run({ user: { email: 'admin@getbrainlift.app' } });
    expect(out.nexted).toBe(true);
  });

  it('denies a user whose email is not in admin_users — even an @getbrainlift.app address', async () => {
    adminRow = null; // not found in admin_users
    const out = await run({ user: { email: 'attacker@getbrainlift.app' } });
    expect(out.statusCode).toBe(403);
  });

  it('denies a non-admin user', async () => {
    adminRow = null;
    const out = await run({ user: { email: 'someone@example.com' } });
    expect(out.statusCode).toBe(403);
  });

  it('rejects an unauthenticated request', async () => {
    const out = await run({});
    expect(out.statusCode).toBe(401);
  });
});
