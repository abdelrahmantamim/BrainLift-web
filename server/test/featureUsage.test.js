import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFile } from 'node:fs/promises';
import { ensureTestDatabaseRoles } from './helpers/databaseRoles.js';

const rpc = vi.fn();
vi.mock('../config/services.config.js', () => ({ getSupabase: () => ({ rpc }) }));
const { reserveFeatureUsage, finalizeFeatureUsage, releaseFeatureUsage } = await import('../services/featureUsage.service.js');

beforeEach(() => rpc.mockReset());

describe('feature usage reservation lifecycle', () => {
  it('reserves atomically through the admission RPC', async () => {
    rpc.mockResolvedValue({ data: [{ allowed: true, current_usage: 3 }], error: null });
    const result = await reserveFeatureUsage({ userId: 'u1', feature: 'quiz', period: 'daily', limit: 3, operationId: 'op1' });
    expect(result).toEqual(expect.objectContaining({ allowed: true, currentUsage: 3, operationId: 'op1' }));
    expect(rpc).toHaveBeenCalledWith('reserve_feature_usage', expect.objectContaining({ p_operation_id: 'op1', p_user_id: 'u1', p_feature: 'quiz' }));
  });

  it('reports denied reservations without committing usage', async () => {
    rpc.mockResolvedValue({ data: [{ allowed: false, current_usage: 3 }], error: null });
    await expect(reserveFeatureUsage({ userId: 'u1', feature: 'quiz', period: 'daily', limit: 3, operationId: 'op2' })).resolves.toMatchObject({ allowed: false });
  });

  it('uses idempotent terminal RPCs', async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    await finalizeFeatureUsage('op1');
    await finalizeFeatureUsage('op1');
    await releaseFeatureUsage('op2');
    await releaseFeatureUsage('op2');
    expect(rpc.mock.calls.filter(([name]) => name === 'finalize_feature_usage')).toHaveLength(2);
    expect(rpc.mock.calls.filter(([name]) => name === 'release_feature_usage')).toHaveLength(2);
  });

  it('reserves unlimited usage so successful operations remain visible in analytics', async () => {
    rpc.mockResolvedValue({ data: [{ allowed: true, current_usage: 101 }], error: null });
    await expect(reserveFeatureUsage({ userId: 'u1', feature: 'chat', period: 'daily', limit: -1, operationId: 'op3' })).resolves.toMatchObject({ allowed: true, operationId: 'op3' });
    expect(rpc).toHaveBeenCalledWith('reserve_feature_usage', expect.objectContaining({ p_limit: -1 }));
  });
});

describe.skipIf(!process.env.FEATURE_USAGE_PGLITE_MODULE)('feature usage SQL integration', () => {
  it('admits exactly one concurrent request for the last slot', async () => {
    const { PGlite } = await import(process.env.FEATURE_USAGE_PGLITE_MODULE);
    const db = new PGlite();
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
      CREATE TABLE profiles (id uuid PRIMARY KEY, daily_feature_usage jsonb DEFAULT '{}', weekly_feature_usage jsonb DEFAULT '{}', lifetime_feature_usage jsonb DEFAULT '{}', last_request_date date, week_start_date date, daily_ai_requests integer DEFAULT 0, monthly_ai_requests integer DEFAULT 0, total_ai_requests integer DEFAULT 0);`);
    await db.exec(await readFile(new URL('../migrations/20260915_feature_usage_reservations.sql', import.meta.url), 'utf8'));
    const user = '00000000-0000-4000-8000-000000000001';
    await db.query("INSERT INTO profiles(id,daily_feature_usage,last_request_date) VALUES($1,'{\"quiz\":2}','2026-09-15')", [user]);
    const reserve = (op) => db.query("SELECT * FROM reserve_feature_usage($1,$2,'quiz','daily',3,'2026-09-15','2026-09-14')", [op, user]);
    const results = await Promise.all([
      reserve('10000000-0000-4000-8000-000000000001'),
      reserve('10000000-0000-4000-8000-000000000002'),
    ]);
    expect(results.filter(({ rows }) => rows[0].allowed)).toHaveLength(1);
    await db.close();
  });
});

describe.skipIf(!process.env.FEATURE_USAGE_TEST_DATABASE_URL)('feature usage native PostgreSQL integration', () => {
  let pool;
  const user = '00000000-0000-4000-8000-000000000001';

  beforeAll(async () => {
    const databaseUrl = new URL(process.env.FEATURE_USAGE_TEST_DATABASE_URL);
    if (databaseUrl.pathname !== '/brainlift_usage_test') {
      throw new Error('FEATURE_USAGE_TEST_DATABASE_URL must target the dedicated brainlift_usage_test database');
    }
    const { Pool } = await import('pg');
    pool = new Pool({ connectionString: databaseUrl.toString(), max: 8 });
    await ensureTestDatabaseRoles(pool);
    await pool.query(`DROP TABLE IF EXISTS feature_usage_reservations; DROP TABLE IF EXISTS profiles;
      CREATE TABLE profiles (id uuid PRIMARY KEY, daily_feature_usage jsonb DEFAULT '{}', weekly_feature_usage jsonb DEFAULT '{}', lifetime_feature_usage jsonb DEFAULT '{}', last_request_date date, week_start_date date, daily_ai_requests integer DEFAULT 0, monthly_ai_requests integer DEFAULT 0, total_ai_requests integer DEFAULT 0);`);
    await pool.query(await readFile(new URL('../migrations/20260915_feature_usage_reservations.sql', import.meta.url), 'utf8'));
  });

  afterAll(async () => { await pool?.end(); });

  it('serializes independent connections competing for one remaining slot', async () => {
    await pool.query('TRUNCATE feature_usage_reservations, profiles');
    await pool.query("INSERT INTO profiles(id,daily_feature_usage,last_request_date) VALUES($1,'{\"quiz\":2}','2026-09-15')", [user]);
    const reserve = (op) => pool.query("SELECT * FROM reserve_feature_usage($1,$2,'quiz','daily',3,'2026-09-15','2026-09-14')", [op, user]);
    const results = await Promise.all([
      reserve('20000000-0000-4000-8000-000000000001'),
      reserve('20000000-0000-4000-8000-000000000002'),
    ]);
    expect(results.filter(({ rows }) => rows[0].allowed)).toHaveLength(1);
    expect((await pool.query("SELECT count(*)::int n FROM feature_usage_reservations WHERE status='pending'")).rows[0].n).toBe(1);
  });
});
