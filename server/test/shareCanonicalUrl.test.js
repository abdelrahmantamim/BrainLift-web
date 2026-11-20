import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// Mirrors server/test/webhook.test.js conventions: a minimal chainable
// Supabase mock plus module mocks for the middleware the route pulls in.

const supabaseMock = {
  from: vi.fn((table) => {
    const chain = {};
    chain.select = vi.fn(() => chain);
    chain.insert = vi.fn((vals) => {
      chain._insertedVals = vals;
      return chain;
    });
    chain.eq = vi.fn(() => chain);
    chain.single = vi.fn(() => {
      if (table === 'quizzes') {
        return Promise.resolve({ data: { id: 'quiz-1', user_id: 'user-1' }, error: null });
      }
      if (table === 'shareable_links') {
        return Promise.resolve({
          data: {
            share_id: 'abc1234567',
            user_id: 'user-1',
            content_type: 'quiz',
            content_id: 'quiz-1',
            title: 'Untitled',
            description: '',
          },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });
    return chain;
  }),
  rpc: vi.fn((fnName) => {
    if (fnName === 'generate_share_id') {
      return Promise.resolve({ data: 'abc1234567', error: null });
    }
    return Promise.resolve({ data: null, error: null });
  }),
};

vi.mock('../config/services.config.js', () => ({
  getSupabase: () => supabaseMock,
}));

vi.mock('../middleware/auth.middleware.js', () => ({
  authMiddleware: (req, res, next) => next(),
  requireAuth: (req, res, next) => {
    req.userId = 'user-1';
    next();
  },
}));

vi.mock('../middleware/adminAuth.middleware.js', () => ({
  requireSessionAdmin: (req, res, next) => next(),
}));

vi.mock('../middleware/requirePaidWeb.middleware.js', () => ({
  requirePaidWeb: (req, res, next) => next(),
}));

vi.mock('../middleware/syncUser.middleware.js', () => ({
  syncUserToSupabase: (req, res, next) => next(),
}));

vi.mock('../middleware/cache.middleware.js', () => ({
  invalidateCache: () => (req, res, next) => next(),
}));

vi.mock('../middleware/rateLimiter.middleware.js', () => ({
  shareCreationLimiter: (req, res, next) => next(),
  shareAccessLimiter: (req, res, next) => next(),
}));

vi.mock('../middleware/recipientRateLimit.middleware.js', () => ({
  recipientRateLimitMiddleware: (req, res, next) => next(),
}));

vi.mock('../services/circuitBreaker.service.js', () => ({
  withCircuitBreaker: (name, fn) => fn,
}));

const { default: shareRouter } = await import('../routes/share.routes.js');

function appWith() {
  const app = express();
  app.use(express.json());
  app.use('/share', shareRouter);
  return app;
}

describe('POST /share/create — canonical URLs', () => {
  beforeEach(() => {
    delete process.env.WEB_APP_URL;
    delete process.env.API_PUBLIC_URL;
  });

  it('returns shareUrl, previewUrl, deepLink, qrCodeUrl using env defaults for a quiz share', async () => {
    const res = await request(appWith())
      .post('/share/create')
      .send({ contentType: 'quiz', contentId: 'quiz-1' });

    expect(res.status).toBe(200);
    // Existing fields unchanged
    expect(res.body.success).toBe(true);
    expect(res.body.shareId).toBe('abc1234567');
    expect(res.body.shareLink).toBeTruthy();

    // New canonical fields, using documented defaults
    expect(res.body.shareUrl).toBe('https://getbrainlift.app/share/quiz/abc1234567');
    expect(res.body.previewUrl).toBe('https://getbrainlift.app/share/preview/quiz/abc1234567');
    expect(res.body.deepLink).toBe('brainlift://share/quiz/abc1234567');
    expect(res.body.qrCodeUrl).toBe('https://app.getbrainlift.app/api/qr/abc1234567/branded');
  });

  it('uses WEB_APP_URL / API_PUBLIC_URL env vars when set', async () => {
    process.env.WEB_APP_URL = 'https://web.example.com';
    process.env.API_PUBLIC_URL = 'https://api.example.com';

    const res = await request(appWith())
      .post('/share/create')
      .send({ contentType: 'quiz', contentId: 'quiz-1' });

    expect(res.status).toBe(200);
    expect(res.body.shareUrl).toBe('https://web.example.com/share/quiz/abc1234567');
    expect(res.body.previewUrl).toBe('https://web.example.com/share/preview/quiz/abc1234567');
    expect(res.body.deepLink).toBe('brainlift://share/quiz/abc1234567');
    expect(res.body.qrCodeUrl).toBe('https://api.example.com/api/qr/abc1234567/branded');

    delete process.env.WEB_APP_URL;
    delete process.env.API_PUBLIC_URL;
  });
});
