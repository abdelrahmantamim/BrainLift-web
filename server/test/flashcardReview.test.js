import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// --- Controllable Supabase mock -----------------------------------------
// Follows the mock style of test/idor.test.js: `tableResults` drives what a
// given table query resolves to, and `updateCalls` records the payloads
// passed to `.update()` so we can assert the SM-2 fields actually land on
// the right columns (not just that "some" update happened).
let tableResults = {};
const updateCalls = [];

function chainFor(table) {
  const chain = {};
  for (const m of ['select', 'eq', 'order', 'limit', 'in', 'gte', 'lte']) chain[m] = vi.fn(() => chain);
  chain.update = vi.fn((payload) => {
    updateCalls.push({ table, payload });
    return chain;
  });
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

// Auth middleware: inject a fixed user id, matching idor.test.js's pattern.
vi.mock('../middleware/auth.middleware.js', () => ({
  authMiddleware: (req, _res, next) => { req.userId = 'owner-1'; next(); },
  requireAuth: (req, _res, next) => { req.userId = 'owner-1'; next(); },
  requireAuthForRefresh: (req, _res, next) => next(),
}));

// The handler also lazily imports stats.routes.js to track activity; stub it
// so the request doesn't try to hit real activity tracking.
vi.mock('../routes/stats.routes.js', () => ({
  trackUserActivity: vi.fn().mockResolvedValue(undefined),
}));

const { default: flashcardsRouter } = await import('../routes/flashcards.routes.js');

function app() {
  const a = express();
  a.use(express.json());
  a.use((req, _res, next) => { req.userId = 'owner-1'; next(); });
  a.use('/api/flashcards', flashcardsRouter);
  return a;
}

beforeEach(() => {
  tableResults = {};
  updateCalls.length = 0;
});

describe('PATCH /flashcards/cards/:cardId/review — contract pin', () => {
  it('updates ease_factor/interval/repetitions/next_due on an owned card', async () => {
    tableResults['flashcards'] = { data: { deck_id: 'deck-1' }, error: null };
    tableResults['flashcard_decks'] = { data: { id: 'deck-1', name: 'Deck One' }, error: null };

    const nextDue = new Date('2026-08-01T00:00:00.000Z').toISOString();
    const res = await request(app())
      .patch('/api/flashcards/cards/card-1/review')
      .send({ easeFactor: 2.6, interval: 6, repetitions: 2, nextDue });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });

    const flashcardsUpdate = updateCalls.find((c) => c.table === 'flashcards');
    expect(flashcardsUpdate).toBeTruthy();
    expect(flashcardsUpdate.payload).toMatchObject({
      ease_factor: 2.6,
      interval: 6,
      repetitions: 2,
      next_due: nextDue,
    });
  });

  it('returns 403 and does not update flashcards when the deck is not owned', async () => {
    tableResults['flashcards'] = { data: { deck_id: 'deck-x' }, error: null };
    tableResults['flashcard_decks'] = { data: null, error: null }; // owned-by-check fails

    const res = await request(app())
      .patch('/api/flashcards/cards/card-1/review')
      .send({ easeFactor: 2.5, interval: 1, repetitions: 0, nextDue: new Date().toISOString() });

    expect(res.status).toBe(403);
    expect(updateCalls.find((c) => c.table === 'flashcards')).toBeUndefined();
  });

  it('returns 404 when the card itself does not exist', async () => {
    tableResults['flashcards'] = { data: null, error: null };

    const res = await request(app())
      .patch('/api/flashcards/cards/missing-card/review')
      .send({ easeFactor: 2.5, interval: 1, repetitions: 0, nextDue: new Date().toISOString() });

    expect(res.status).toBe(404);
    expect(updateCalls.find((c) => c.table === 'flashcards')).toBeUndefined();
  });
});
