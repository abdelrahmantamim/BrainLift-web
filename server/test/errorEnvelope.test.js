import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

// pdf.routes.js pulls in authMiddleware, whose real implementation imports
// ../config/better-auth.config.js (a real Postgres pool + Better Auth init
// with pre-existing, unrelated init issues under vitest). Mock the
// middleware module directly so requests reach the route's own validation
// logic without depending on that unrelated init path.
vi.mock('../middleware/auth.middleware.js', () => ({
  authMiddleware: (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ') || authHeader.substring(7) !== 'valid-token') {
      return res.status(401).json({ error: { message: 'Authentication required' } });
    }
    req.userId = 'user-1';
    req.user = { id: 'user-1' };
    next();
  },
  requireAuth: (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ') || authHeader.substring(7) !== 'valid-token') {
      return res.status(401).json({ error: { message: 'Authentication required' } });
    }
    req.userId = 'user-1';
    req.user = { id: 'user-1' };
    next();
  },
}));

const { default: pdfRouter } = await import('../routes/pdf.routes.js');
const { default: aiRouter } = await import('../routes/ai.routes.js');

function appWith(router, mountPath) {
  const app = express();
  app.use(express.json());
  app.use(mountPath, router);
  return app;
}

describe('Error envelope shape — user-facing routers', () => {
  it('POST /api/pdf/generate-from-chat with no content returns nested { error: { message } }', async () => {
    const app = appWith(pdfRouter, '/api/pdf');
    const res = await request(app)
      .post('/api/pdf/generate-from-chat')
      .set('Authorization', 'Bearer valid-token')
      .send({});

    expect(res.status).toBe(400);
    expect(typeof res.body.error).toBe('object');
    expect(typeof res.body.error.message).toBe('string');
    expect(res.body.error.message.length).toBeGreaterThan(0);
    expect(res.body.error.message).toBe('Content is required');
  });

  it('POST /api/ai/chat/complete with no messages returns nested { error: { message } }', async () => {
    const app = appWith(aiRouter, '/api/ai');
    const res = await request(app)
      .post('/api/ai/chat/complete')
      .send({});

    expect(res.status).toBe(400);
    expect(typeof res.body.error).toBe('object');
    expect(typeof res.body.error.message).toBe('string');
    expect(res.body.error.message.length).toBeGreaterThan(0);
    expect(res.body.error.message).toBe('Messages array is required');
  });
});
