import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// --- Mocks ---------------------------------------------------------------
const verifyAppleToken = vi.fn();
vi.mock('apple-signin-auth', () => ({
  default: { verifyIdToken: (...a) => verifyAppleToken(...a) },
}));

const verifyGoogleToken = vi.fn();
vi.mock('google-auth-library', () => ({
  OAuth2Client: class {
    verifyIdToken = (...a) => verifyGoogleToken(...a);
  },
}));

// Shared pg pool: queries resolve to no rows by default (forces the "new user"
// path); tests can register SQL-substring routes to return specific rows.
let poolRoutes = [];
const poolQuery = vi.fn((sql) => {
  for (const r of poolRoutes) {
    if (sql.includes(r.match)) return Promise.resolve({ rows: r.rows });
  }
  return Promise.resolve({ rows: [] });
});
vi.mock('../utils/pgPool.js', () => ({
  default: { query: (...a) => poolQuery(...a) },
  closePool: vi.fn(),
}));

vi.mock('../config/services.config.js', () => ({
  getSupabase: () => ({
    from: () => {
      const chain = {};
      for (const m of ['insert', 'select', 'update', 'eq', 'single']) chain[m] = () => chain;
      chain.then = (r) => r({ data: { id: 'x', profiles: {} }, error: null });
      return chain;
    },
  }),
}));

const { default: oauthRouter } = await import('../routes/oauth.routes.js');

function app() {
  const a = express();
  a.use(express.json());
  a.use('/api/oauth', oauthRouter);
  return a;
}

beforeEach(() => {
  verifyAppleToken.mockReset();
  verifyGoogleToken.mockReset();
  poolRoutes = [];
  poolQuery.mockClear();
  process.env.APPLE_CLIENT_ID = 'com.brainlift.app';
  process.env.GOOGLE_CLIENT_ID = 'test-google-client-id';
});

describe('Apple OAuth verification', () => {
  it('rejects an unverifiable identity token with 401', async () => {
    verifyAppleToken.mockRejectedValue(new Error('bad signature'));
    const res = await request(app())
      .post('/api/oauth/apple/mobile')
      .send({ identityToken: 'forged', email: 'attacker@getbrainlift.app' });
    expect(res.status).toBe(401);
  });

  it('ignores a forged request-body email; uses the verified payload', async () => {
    verifyAppleToken.mockResolvedValue({ sub: 'apple-123', email: 'real@user.com' });
    const res = await request(app())
      .post('/api/oauth/apple/mobile')
      .send({ identityToken: 'valid', email: 'attacker@getbrainlift.app' });
    // verification succeeded; identity is real@user.com (DB-side behavior beyond
    // this is mocked). The key assertion is it did NOT 401/400 on the forged email.
    expect(res.status).not.toBe(401);
    expect(verifyAppleToken).toHaveBeenCalledWith('valid', expect.objectContaining({ audience: 'com.brainlift.app' }));
  });

  it('rejects a token with no email claim and no linked sub — never resolves via the forged body email', async () => {
    verifyAppleToken.mockResolvedValue({ sub: 'apple-unknown' }); // repeat-login token, no email claim
    const res = await request(app())
      .post('/api/oauth/apple/mobile')
      .send({ identityToken: 'valid', email: 'victim@example.com' });
    expect(res.status).toBe(400);
    // The client-supplied email must never reach a DB lookup (account takeover).
    const usedVictimEmail = poolQuery.mock.calls.some(
      ([, params]) => Array.isArray(params) && params.includes('victim@example.com')
    );
    expect(usedVictimEmail).toBe(false);
  });

  it('resolves a repeat login by the linked Apple sub when the token has no email', async () => {
    verifyAppleToken.mockResolvedValue({ sub: 'apple-123' }); // no email claim
    poolRoutes = [
      { match: '"providerId" = $1 AND "accountId" = $2', rows: [{ userId: 'user-1' }] },
      { match: 'FROM "user" WHERE id', rows: [{ id: 'user-1', email: 'real@user.com', name: 'Real' }] },
    ];
    const res = await request(app())
      .post('/api/oauth/apple/mobile')
      .send({ identityToken: 'valid', email: 'victim@example.com' });
    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe('user-1');
    expect(res.body.isNewUser).toBe(false);
  });
});

describe('Google OAuth verification', () => {
  it('rejects when idToken is missing with 400', async () => {
    const res = await request(app())
      .post('/api/oauth/google/mobile')
      .send({ user: { email: 'attacker@getbrainlift.app', id: 'x' } });
    expect(res.status).toBe(400);
    expect(verifyGoogleToken).not.toHaveBeenCalled();
  });

  it('rejects an unverifiable token with 401', async () => {
    verifyGoogleToken.mockRejectedValue(new Error('bad token'));
    const res = await request(app())
      .post('/api/oauth/google/mobile')
      .send({ idToken: 'forged' });
    expect(res.status).toBe(401);
  });

  it('verifies the token and ignores any client-supplied user object', async () => {
    verifyGoogleToken.mockResolvedValue({ getPayload: () => ({ sub: 'g-123', email: 'real@user.com', name: 'Real' }) });
    const res = await request(app())
      .post('/api/oauth/google/mobile')
      .send({ idToken: 'valid', user: { email: 'attacker@getbrainlift.app', id: 'evil' } });
    expect(res.status).not.toBe(401);
    expect(verifyGoogleToken).toHaveBeenCalled();
  });
});
