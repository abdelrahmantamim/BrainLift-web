import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { ensureTestDatabaseRoles } from './helpers/databaseRoles.js';

const results = new Map();
const updates = [];
const rpcResults = [];
const checkAndUnlockAchievements = vi.fn();
function nextResult(table) {
  const queue = results.get(table) || [];
  return queue.length > 1 ? queue.shift() : (queue[0] || { data: null, error: null });
}
function chainFor(table) {
  const chain = {};
  for (const method of ['select', 'eq', 'in', 'contains']) chain[method] = vi.fn(() => chain);
  chain.update = vi.fn(payload => { updates.push({ table, payload }); return chain; });
  chain.single = vi.fn(() => chain);
  chain.maybeSingle = vi.fn(() => chain);
  chain.then = resolve => resolve(nextResult(table));
  return chain;
}
const rpc = vi.fn(async () => rpcResults.length > 1 ? rpcResults.shift() : (rpcResults[0] || { data: [{ duplicate: false, session_id: 'session-1', points_earned: 5 }], error: null }));
const supabase = { from: vi.fn(table => chainFor(table)), rpc };
const trackUserActivity = vi.fn();
vi.mock('../config/services.config.js', () => ({ getSupabase: () => supabase, getOpenAI: () => ({}), getGenAI: () => ({}) }));
vi.mock('../routes/stats.routes.js', () => ({ trackUserActivity }));
vi.mock('../services/activityTracking.service.js', () => ({ default: { checkAndUnlockAchievements } }));
vi.mock('../middleware/auth.middleware.js', () => ({ authMiddleware: (_req, _res, next) => next(), requireAuth: (_req, _res, next) => next() }));
const { default: router } = await import('../routes/flashcards.routes.js');

function app(userId = 'owner-1') {
  const instance = express();
  instance.use(express.json());
  instance.use((req, _res, next) => { req.userId = userId; next(); });
  instance.use('/flashcards', router);
  return instance;
}
const payload = {
  completionId: 'completion-1', deckId: 'deck-1', cardsReviewed: ['card-1'], correctAnswers: 1,
  startTime: '2026-09-15T12:00:00.000Z', endTime: '2026-09-15T12:01:00.000Z', sessionData: { 'card-1': 'easy' },
};

beforeEach(() => {
  results.clear(); updates.length = 0; vi.clearAllMocks();
  rpcResults.length = 0;
  trackUserActivity.mockResolvedValue(undefined);
  checkAndUnlockAchievements.mockResolvedValue(undefined);
});

describe('flashcard session lifecycle', () => {
  it('starts without awarding completed activity', async () => {
    results.set('flashcard_decks', [{ data: { id: 'deck-1' }, error: null }]);
    const response = await request(app()).post('/flashcards/session/start').send({ deckId: 'deck-1', deckName: 'Deck' });
    expect(response.status).toBe(200);
    expect(trackUserActivity).not.toHaveBeenCalled();
  });

  it('rejects no-work and unowned completions', async () => {
    const empty = await request(app()).post('/flashcards/session/complete').send({ ...payload, cardsReviewed: [], correctAnswers: 0 });
    expect(empty.status).toBe(400);
    results.set('flashcard_decks', [{ data: null, error: { message: 'not found' } }]);
    const unowned = await request(app('other-user')).post('/flashcards/session/complete').send(payload);
    expect(unowned.status).toBe(404);
    expect(trackUserActivity).not.toHaveBeenCalled();
  });

  it('validates reviewed cards belong to the owned deck', async () => {
    results.set('flashcard_decks', [{ data: { name: 'Deck' }, error: null }]);
    results.set('flashcards', [{ data: [], error: null }]);
    const response = await request(app()).post('/flashcards/session/complete').send(payload);
    expect(response.status).toBe(400);
    expect(trackUserActivity).not.toHaveBeenCalled();
  });

  it('awards one valid completion and treats a sequential retry as duplicate', async () => {
    results.set('flashcard_decks', [{ data: { name: 'Deck' }, error: null }]);
    results.set('flashcards', [{ data: [{ id: 'card-1' }], error: null }]);
    rpcResults.push({ data: [{ duplicate: false, session_id: 'session-1' }], error: null }, { data: [{ duplicate: true, session_id: 'session-1' }], error: null });
    const first = await request(app()).post('/flashcards/session/complete').send(payload);
    expect(first.status).toBe(200);
    const retry = await request(app()).post('/flashcards/session/complete').send(payload);
    expect(retry.body).toMatchObject({ success: true, duplicate: true });
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(checkAndUnlockAchievements).toHaveBeenCalledTimes(1);
  });

  it('accepts a legacy completion without an explicit completion id', async () => {
    results.set('flashcard_decks', [{ data: { name: 'Deck' }, error: null }]);
    results.set('flashcards', [{ data: [{ id: 'card-1' }], error: null }]);
    results.set('user_study_sessions', [{ data: null, error: null }]);
    const { completionId: _omitted, ...legacy } = payload;
    const response = await request(app()).post('/flashcards/session/complete').send(legacy);
    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith('complete_flashcard_session', expect.objectContaining({ p_completion_id: expect.any(String) }));
  });

  it('returns retryable 503 after a transaction failure and accepts the same completion on retry', async () => {
    results.set('flashcard_decks', [{ data: { name: 'Deck' }, error: null }]);
    results.set('flashcards', [{ data: [{ id: 'card-1' }], error: null }]);
    results.set('user_study_sessions', [{ data: null, error: null }]);
    rpcResults.push({ data: null, error: { message: 'database offline' } }, { data: [{ duplicate: false, session_id: 'session-2' }], error: null });
    const failed = await request(app()).post('/flashcards/session/complete').send(payload);
    expect(failed.status).toBe(503);
    expect(failed.body.error.code).toBe('SESSION_TRACKING_FAILED');
    const retry = await request(app()).post('/flashcards/session/complete').send(payload);
    expect(retry.status).toBe(200);
    expect(retry.body.success).toBe(true);
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(checkAndUnlockAchievements).toHaveBeenCalledTimes(1);
  });

  it('keeps a committed completion successful when optional achievement refresh fails', async () => {
    results.set('flashcard_decks', [{ data: { name: 'Deck' }, error: null }]);
    results.set('flashcards', [{ data: [{ id: 'card-1' }], error: null }]);
    rpcResults.push({ data: [{ duplicate: false, session_id: 'session-3' }], error: null });
    checkAndUnlockAchievements.mockRejectedValueOnce(new Error('badge refresh unavailable'));
    const response = await request(app()).post('/flashcards/session/complete').send(payload);
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(checkAndUnlockAchievements).toHaveBeenCalledTimes(1);
  });

  it('rejects an empty RPC result and does not run optional effects', async () => {
    results.set('flashcard_decks', [{ data: { name: 'Deck' }, error: null }]);
    results.set('flashcards', [{ data: [{ id: 'card-1' }], error: null }]);
    rpcResults.push({ data: [], error: null });
    const response = await request(app()).post('/flashcards/session/complete').send(payload);
    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe('SESSION_TRACKING_FAILED');
    expect(checkAndUnlockAchievements).not.toHaveBeenCalled();
  });

});

describe.skipIf(!process.env.FEATURE_USAGE_TEST_DATABASE_URL)('flashcard completion database idempotency', () => {
  it('commits essential effects once and rolls all of them back when XP fails', async () => {
    const databaseUrl = new URL(process.env.FEATURE_USAGE_TEST_DATABASE_URL);
    if (databaseUrl.pathname !== '/brainlift_usage_test' || databaseUrl.port !== '55437') {
      throw new Error('Flashcard idempotency integration test requires brainlift_usage_test on port 55437');
    }

    const admin = new pg.Client({ connectionString: databaseUrl.toString() });
    const first = new pg.Client({ connectionString: databaseUrl.toString() });
    const second = new pg.Client({ connectionString: databaseUrl.toString() });
    await Promise.all([admin.connect(), first.connect(), second.connect()]);
    try {
      await ensureTestDatabaseRoles(admin);
      await admin.query(`DROP TABLE IF EXISTS user_recent_activities,user_daily_goals,user_study_sessions,flashcards,flashcard_decks,xp_awards,xp_fault CASCADE;
        CREATE TABLE flashcard_decks(id uuid PRIMARY KEY,user_id uuid NOT NULL,name text,last_reviewed timestamptz);
        CREATE TABLE flashcards(id uuid PRIMARY KEY,deck_id uuid NOT NULL REFERENCES flashcard_decks(id));
        CREATE TABLE user_study_sessions(id uuid DEFAULT gen_random_uuid() PRIMARY KEY,user_id uuid NOT NULL,session_type text NOT NULL,content_id uuid,content_title text,start_time timestamptz DEFAULT now(),end_time timestamptz,duration_minutes integer,score numeric(5,2),questions_answered integer,correct_answers integer,metadata jsonb DEFAULT '{}',created_at timestamptz DEFAULT now());
        CREATE TABLE user_recent_activities(id uuid DEFAULT gen_random_uuid() PRIMARY KEY,user_id uuid NOT NULL,activity_type text NOT NULL,title text NOT NULL,description text,icon text,metadata jsonb DEFAULT '{}',points_earned integer DEFAULT 0,created_at timestamptz DEFAULT now());
        CREATE TABLE user_daily_goals(id uuid DEFAULT gen_random_uuid() PRIMARY KEY,user_id uuid NOT NULL,goal_date date NOT NULL,quiz_goal integer DEFAULT 1,flashcard_goal integer DEFAULT 10,chat_goal integer DEFAULT 1,file_goal integer DEFAULT 1,study_time_goal integer DEFAULT 30,quiz_completed integer DEFAULT 0,flashcards_reviewed integer DEFAULT 0,chat_sessions integer DEFAULT 0,files_uploaded integer DEFAULT 0,study_time_minutes integer DEFAULT 0,is_completed boolean DEFAULT false,created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now(),UNIQUE(user_id,goal_date));
        CREATE TABLE xp_awards(id bigserial PRIMARY KEY,user_id uuid,amount integer,source_id uuid);
        CREATE TABLE xp_fault(should_fail boolean); INSERT INTO xp_fault VALUES(false);
        DROP FUNCTION IF EXISTS update_user_daily_stats(uuid);
        DROP FUNCTION IF EXISTS award_xp(uuid,integer,text,text,uuid,jsonb);
        CREATE OR REPLACE FUNCTION award_xp(p_user_id uuid,p_amount integer,p_reason text,p_source_type text,p_source_id text,p_metadata jsonb) RETURNS void LANGUAGE plpgsql AS $$ BEGIN IF (SELECT should_fail FROM xp_fault) THEN RAISE EXCEPTION 'injected XP failure'; END IF; INSERT INTO xp_awards(user_id,amount,source_id) VALUES(p_user_id,p_amount,p_source_id::uuid); END $$;`);
      await admin.query(await readFile(new URL('../migrations/20260915_flashcard_completion_idempotency.sql', import.meta.url), 'utf8'));
      const owner = '00000000-0000-4000-8000-000000000001';
      const deck='10000000-0000-4000-8000-000000000001', card='20000000-0000-4000-8000-000000000001';
      await admin.query('INSERT INTO flashcard_decks(id,user_id,name) VALUES($1,$2,$3)',[deck,owner,'Deck']);
      await admin.query('INSERT INTO flashcards(id,deck_id) VALUES($1,$2)',[card,deck]);
      const complete=(client,id)=>client.query("SELECT * FROM complete_flashcard_session($1,$2,$3,1,'2026-09-15T12:00:00Z','2026-09-15T12:01:00Z',$4,'{}')",[owner,deck,[card],id]);
      // Reproduce the deployed schema: no optional stats RPC, text XP source ID.
      await expect(complete(admin,'before-repair')).rejects.toThrow(/update_user_daily_stats/);
      expect((await admin.query('SELECT count(*)::int n FROM user_study_sessions')).rows[0].n).toBe(0);
      const repair = await readFile(new URL('../migrations/20260916051939_repair_flashcard_completion_dependencies.sql', import.meta.url), 'utf8');
      await admin.query(repair);
      await admin.query(repair); // repair is safe to rerun
      const permissions = await admin.query(`SELECT
        has_function_privilege('anon','complete_flashcard_session(uuid,uuid,uuid[],integer,timestamptz,timestamptz,text,jsonb)','EXECUTE') AS anon,
        has_function_privilege('authenticated','complete_flashcard_session(uuid,uuid,uuid[],integer,timestamptz,timestamptz,text,jsonb)','EXECUTE') AS authenticated,
        has_function_privilege('service_role','complete_flashcard_session(uuid,uuid,uuid[],integer,timestamptz,timestamptz,text,jsonb)','EXECUTE') AS service_role`);
      expect(permissions.rows[0]).toEqual({ anon: false, authenticated: false, service_role: true });
      const attempts=await Promise.all([complete(first,'same-completion'),complete(second,'same-completion')]);
      expect(attempts.filter(result=>result.rows[0].duplicate===false)).toHaveLength(1);
      expect(attempts.filter(result=>result.rows[0].duplicate===true)).toHaveLength(1);
      expect((await admin.query('SELECT count(*)::int n FROM user_study_sessions')).rows[0].n).toBe(1);
      expect((await admin.query('SELECT count(*)::int n FROM user_recent_activities')).rows[0].n).toBe(1);
      expect((await admin.query('SELECT flashcards_reviewed FROM user_daily_goals')).rows[0].flashcards_reviewed).toBe(1);
      expect((await admin.query('SELECT count(*)::int n FROM xp_awards')).rows[0].n).toBe(1);
      expect((await admin.query('SELECT last_reviewed IS NOT NULL reviewed FROM flashcard_decks')).rows[0].reviewed).toBe(true);

      await admin.query('UPDATE xp_fault SET should_fail=true; UPDATE flashcard_decks SET last_reviewed=NULL');
      await expect(complete(admin,'failed-completion')).rejects.toThrow(/injected XP failure/);
      expect((await admin.query('SELECT count(*)::int n FROM user_study_sessions')).rows[0].n).toBe(1);
      expect((await admin.query('SELECT count(*)::int n FROM user_recent_activities')).rows[0].n).toBe(1);
      expect((await admin.query('SELECT flashcards_reviewed FROM user_daily_goals')).rows[0].flashcards_reviewed).toBe(1);
      expect((await admin.query('SELECT count(*)::int n FROM xp_awards')).rows[0].n).toBe(1);
      expect((await admin.query('SELECT last_reviewed IS NULL untouched FROM flashcard_decks')).rows[0].untouched).toBe(true);
    } finally {
      await Promise.all([admin.end(), first.end(), second.end()]);
    }
  });
});
