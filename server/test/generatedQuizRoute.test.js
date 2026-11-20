import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

const mocks = vi.hoisted(() => ({
  generate: vi.fn(),
  finalize: vi.fn(),
  release: vi.fn(),
  from: vi.fn(),
}));

vi.mock('../config/services.config.js', () => ({ getSupabase: () => ({ from: mocks.from }) }));
vi.mock('../utils/modelConfig.js', () => ({ getModelConfig: () => ({ quiz: { provider: 'openai', model_name: 'test-model' } }) }));
vi.mock('../services/ai/unifiedAIService.js', () => ({ generateAIResponse: (...args) => mocks.generate(...args) }));
vi.mock('../middleware/auth.middleware.js', () => ({ authMiddleware: (_req, _res, next) => next(), requireAuth: (_req, _res, next) => next() }));
vi.mock('../middleware/subscriptionLimits.middleware.js', () => ({
  checkSubscriptionLimit: () => (req, _res, next) => {
    req.featureUsage = { finalize: mocks.finalize, release: mocks.release };
    next();
  },
}));

const { default: quizRouter } = await import('../routes/quiz.routes.js');

function app() {
  const instance = express();
  instance.use(express.json());
  instance.use((req, _res, next) => { req.userId = 'user-1'; next(); });
  instance.use('/api/quiz', quizRouter);
  return instance;
}

beforeEach(() => {
  mocks.generate.mockReset();
  mocks.finalize.mockReset().mockResolvedValue(true);
  mocks.release.mockReset().mockResolvedValue(true);
  mocks.from.mockReset();
});

describe('POST /api/quiz/generate provider validation', () => {
  it('returns 502, performs no persistence and releases quota for an invalid answer index', async () => {
    mocks.generate.mockResolvedValue({ content: '{"title":"Bad","questions":[{"question":"Q?","options":["A","B"],"correctAnswer":7}]}' });

    const response = await request(app()).post('/api/quiz/generate').send({
      type: 'topic',
      topic: 'Biology',
      questionCount: 1,
      difficulty: 'easy',
      detectedLanguage: { code: 'en', name: 'English' },
    });

    expect(response.status).toBe(502);
    expect(response.body).toEqual({ error: { message: 'We could not create a valid quiz. Please try again.', code: 'QUIZ_GENERATION_INVALID' } });
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.release).toHaveBeenCalledTimes(1);
    expect(mocks.finalize).not.toHaveBeenCalled();
  });
});
