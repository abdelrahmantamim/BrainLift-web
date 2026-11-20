import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

const mocks = vi.hoisted(() => ({ gate: vi.fn() }));

function chain() {
  const value = {};
  for (const name of ['select', 'eq', 'single', 'update', 'insert', 'delete', 'order', 'limit']) value[name] = vi.fn(() => value);
  value.then = (resolve) => resolve({ data: null, error: null });
  return value;
}

vi.mock('../config/services.config.js', () => ({ getSupabase: () => ({ from: () => chain() }) }));
vi.mock('../middleware/auth.middleware.js', () => ({ authMiddleware: (_req, _res, next) => next(), requireAuth: (_req, _res, next) => next() }));
vi.mock('../middleware/subscriptionLimits.middleware.js', () => ({
  checkSubscriptionLimit: (feature) => (req, res, _next) => {
    mocks.gate(feature, req.path);
    res.status(429).json({ error: { code: 'DAILY_LIMIT_REACHED' } });
  },
}));

const { default: quizRouter } = await import('../routes/quiz.routes.js');
const { default: flashcardRouter } = await import('../routes/flashcards.routes.js');

function app() {
  const instance = express();
  instance.use(express.json());
  instance.use((req, _res, next) => { req.userId = 'user-1'; next(); });
  instance.use('/api/quiz', quizRouter);
  instance.use('/api/flashcards', flashcardRouter);
  return instance;
}

beforeEach(() => mocks.gate.mockClear());

describe('feature usage route boundaries at an exhausted limit', () => {
  it('blocks quiz and flashcard generation', async () => {
    expect((await request(app()).post('/api/quiz/generate').send({ type: 'topic', topic: 'Biology' })).status).toBe(429);
    expect((await request(app()).post('/api/flashcards/generate').send({ topic: 'Biology' })).status).toBe(429);
    expect(mocks.gate.mock.calls.map(([feature]) => feature)).toEqual(['quiz', 'flashcard']);
  });

  it('does not charge quiz attempts, saves, or manual creation', async () => {
    expect((await request(app()).post('/api/quiz/q1/attempt').send({})).status).toBe(400);
    expect((await request(app()).post('/api/quiz/save').send({})).status).toBe(400);
    expect((await request(app()).post('/api/quiz/manual').send({})).status).toBe(400);
    expect(mocks.gate).not.toHaveBeenCalled();
  });

  it('does not charge flashcard manual creation or review', async () => {
    expect((await request(app()).post('/api/flashcards/manual').send({})).status).toBe(400);
    expect((await request(app()).patch('/api/flashcards/cards/card-1/review').send({})).status).toBe(404);
    expect(mocks.gate).not.toHaveBeenCalled();
  });
});
