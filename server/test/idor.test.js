import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// --- Controllable Supabase mock -----------------------------------------
// Each test sets `tableResults` to control what a given table query resolves to,
// and inspects `deleteCalls` / `updateCalls` to prove unauthorized paths do not
// mutate.
let tableResults = {};
const deleteCalls = [];
const updateCalls = [];

function chainFor(table) {
  const chain = {};
  for (const m of ['select', 'eq', 'order', 'limit', 'in', 'gte', 'lte']) chain[m] = vi.fn(() => chain);
  chain.delete = vi.fn(() => { deleteCalls.push(table); return chain; });
  chain.update = vi.fn(() => { updateCalls.push(table); return chain; });
  chain.single = vi.fn(() => chain);
  chain.maybeSingle = vi.fn(() => chain);
  chain.then = (resolve) => resolve(tableResults[table] ?? { data: null, error: null });
  return chain;
}

const supabaseMock = { from: vi.fn((t) => chainFor(t)) };

vi.mock('../config/services.config.js', () => ({
  getSupabase: () => supabaseMock,
  getOpenAI: () => ({}),
  getGenAI: () => ({}),
}));

// Auth middleware: inject a fixed user id.
vi.mock('../middleware/auth.middleware.js', () => ({
  authMiddleware: (req, _res, next) => { req.userId = 'owner-1'; next(); },
  requireAuth: (req, _res, next) => { req.userId = 'owner-1'; next(); },
  requireAuthForRefresh: (req, _res, next) => next(),
}));

const { default: chatRouter } = await import('../routes/chat.routes.js');
const { default: flashcardsRouter } = await import('../routes/flashcards.routes.js');

function app() {
  const a = express();
  a.use(express.json());
  a.use((req, _res, next) => { req.userId = 'owner-1'; next(); });
  a.use('/api/chat', chatRouter);
  a.use('/api/flashcards', flashcardsRouter);
  return a;
}

beforeEach(() => {
  tableResults = {};
  deleteCalls.length = 0;
  updateCalls.length = 0;
});

describe('IDOR — chat conversation delete', () => {
  it('returns 404 and does NOT delete messages when the session is not owned', async () => {
    tableResults['study_sessions'] = { data: null, error: null }; // ownership check finds nothing
    const res = await request(app()).delete('/api/chat/conversation/someone-elses-id');
    expect(res.status).toBe(404);
    expect(deleteCalls).not.toContain('chat_conversations');
    expect(deleteCalls).not.toContain('study_sessions');
  });

  it('deletes when the session is owned', async () => {
    tableResults['study_sessions'] = { data: { id: 'conv-1' }, error: null };
    const res = await request(app()).delete('/api/chat/conversation/conv-1');
    expect(res.status).toBe(200);
    expect(deleteCalls).toContain('chat_conversations');
  });
});

describe('IDOR — flashcard review update', () => {
  it('returns 403 and does NOT update when the deck is not owned', async () => {
    tableResults['flashcards'] = { data: { deck_id: 'deck-x' }, error: null };
    tableResults['flashcard_decks'] = { data: null, error: null }; // deck not owned
    const res = await request(app())
      .patch('/api/flashcards/cards/card-1/review')
      .send({ easeFactor: 2.5, interval: 1, repetitions: 0, nextDue: new Date().toISOString() });
    expect(res.status).toBe(403);
    expect(updateCalls).not.toContain('flashcards');
  });

  it('updates when the deck is owned', async () => {
    tableResults['flashcards'] = { data: { deck_id: 'deck-1' }, error: null };
    tableResults['flashcard_decks'] = { data: { id: 'deck-1' }, error: null };
    const res = await request(app())
      .patch('/api/flashcards/cards/card-1/review')
      .send({ easeFactor: 2.5, interval: 1, repetitions: 0, nextDue: new Date().toISOString() });
    expect(res.status).toBe(200);
    expect(updateCalls).toContain('flashcards');
  });
});
