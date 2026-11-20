import { describe, expect, it, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { chatStreamErrorEvent, shouldRetryChatStream } from '../utils/chatStreamRecovery.js';

const mocks = vi.hoisted(() => ({
  stream: vi.fn(),
  finalize: vi.fn(),
  release: vi.fn(),
}));

function chain(result = { data: null, error: null }) {
  const value = {};
  for (const name of ['select', 'eq', 'order', 'limit', 'single', 'insert', 'update', 'neq']) value[name] = vi.fn(() => value);
  value.then = (resolve) => resolve(result);
  return value;
}

vi.mock('../config/services.config.js', () => ({
  getSupabase: () => ({
    rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
    from: vi.fn((table) => table === 'profiles' ? chain({ data: { preferences: {} }, error: null }) : chain()),
  }),
  getOpenAI: () => ({}),
  getGenAI: () => ({}),
}));
vi.mock('../utils/modelConfig.js', () => ({ getModelConfig: () => ({ chat: { provider: 'openai', model_name: 'test-model' } }) }));
vi.mock('../middleware/rateLimiter.middleware.js', () => ({ userChatLimiter: (_req, _res, next) => next() }));
vi.mock('../middleware/auth.middleware.js', () => ({ authMiddleware: (_req, _res, next) => next(), requireAuth: (_req, _res, next) => next() }));
vi.mock('../middleware/subscriptionLimits.middleware.js', () => ({
  checkSubscriptionLimit: () => (req, _res, next) => {
    req.featureUsage = { finalize: mocks.finalize, release: mocks.release };
    next();
  },
}));
vi.mock('../services/ai/unifiedAIService.js', () => ({
  generateAIResponse: vi.fn(),
  generateOpenAIStreamingResponse: (...args) => mocks.stream(...args),
}));

const { default: chatRouter } = await import('../routes/chat.routes.js');

function app() {
  const instance = express();
  instance.use(express.json());
  instance.use((req, _res, next) => { req.userId = '00000000-0000-4000-8000-000000000001'; next(); });
  instance.use('/api/chat', chatRouter);
  return instance;
}

beforeEach(() => {
  mocks.stream.mockReset();
  mocks.finalize.mockReset().mockResolvedValue(true);
  mocks.release.mockReset().mockResolvedValue(true);
});

describe('chat streaming recovery policy', () => {
  it('allows a bounded retry before any content is emitted', () => {
    expect(shouldRetryChatStream({ attempt: 0, maxRetries: 2, emittedChunk: false })).toBe(true);
    expect(shouldRetryChatStream({ attempt: 2, maxRetries: 2, emittedChunk: false })).toBe(false);
  });

  it('never retries after partial output and returns a stable sanitized error', () => {
    expect(shouldRetryChatStream({ attempt: 0, maxRetries: 2, emittedChunk: true })).toBe(false);
    expect(chatStreamErrorEvent(true)).toEqual({
      type: 'error',
      code: 'CHAT_STREAM_INTERRUPTED',
      message: 'The response was interrupted. Your prompt was kept so you can retry.',
    });
  });

  it('does not expose provider error details before output', () => {
    expect(chatStreamErrorEvent(false)).toEqual({
      type: 'error',
      code: 'CHAT_GENERATION_FAILED',
      message: 'The response could not be completed. Please try again.',
    });
  });

  it('does not retry the real stream handler after a yielded chunk and releases quota', async () => {
    mocks.stream.mockImplementation(() => (async function* () {
      yield 'Partial answer';
      throw new Error('provider billing secret');
    })());

    const response = await request(app())
      .post('/api/chat/message/stream')
      .send({ message: 'Explain this', conversationId: 'conversation-1' });

    expect(response.status).toBe(200);
    expect(mocks.stream).toHaveBeenCalledTimes(1);
    expect(mocks.release).toHaveBeenCalledTimes(1);
    expect(mocks.finalize).not.toHaveBeenCalled();
    expect(response.text).toContain('CHAT_STREAM_INTERRUPTED');
    expect(response.text).toContain('Partial answer');
    expect(response.text).not.toContain('provider billing secret');
  });
});
