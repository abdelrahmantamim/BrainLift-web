import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccountDeletionError, deleteAccountData } from '../services/accountDeletion.service.js';

const USER = '11111111-1111-4111-8111-111111111111';
const AUTH_USER = 'better-auth-user-1';

function makeSupabase({ files = [], profileEmail = 'learner@example.test', failTable, failOnceTable, storageError } = {}) {
  const operations = [];
  const failures = new Map();
  const from = vi.fn((table) => {
    const chain = {};
    let action;
    for (const method of ['select', 'delete', 'eq', 'or', 'maybeSingle']) {
      chain[method] = vi.fn((...args) => {
        if (method === 'select' || method === 'delete') action = method;
        operations.push([table, method, ...args]);
        return chain;
      });
    }
    chain.then = resolve => {
      const stage = table === 'files' && action === 'select' ? 'file-manifest' : table;
      const priorFailures = failures.get(stage) || 0;
      const shouldFail = failTable === stage || (failOnceTable === stage && priorFailures === 0);
      if (shouldFail) failures.set(stage, priorFailures + 1);
      resolve({
        data: table === 'files' && action === 'select'
          ? files
          : table === 'profiles' && action === 'select' ? { email: profileEmail } : null,
        error: shouldFail ? { message: 'db unavailable' } : null,
      });
    };
    return chain;
  });
  const remove = vi.fn(async paths => {
    operations.push(['storage', 'remove', paths]);
    return { error: storageError || null };
  });
  return {
    client: { from, storage: { from: vi.fn(() => ({ remove })) } },
    operations,
    remove,
  };
}

function makeAuthPool({ failSql, existingTables, inventoryError, connectError, missingColumn } = {}) {
  const clientQuery = vi.fn(async sql => {
    if (sql === failSql) throw new Error('auth unavailable');
    return { rowCount: 0 };
  });
  const release = vi.fn();
  const inventoryQuery = vi.fn(async (_sql, [tables]) => {
    if (inventoryError) throw new Error('inventory unavailable');
    const selected = existingTables
      ? [...new Set(['files', 'profiles', 'users', ...existingTables])]
      : tables;
    const special = {
      files: ['id', 'path', 'user_id'], profiles: ['id'], users: ['id'],
      content_reports: ['reporter_id'],
      share_tracking: ['sender_id', 'recipient_email'],
      user_blocklist: ['user_id', 'blocked_user_id'],
      spam_confirmations: ['recipient_id', 'sender_id'],
    };
    return {
      rows: selected.flatMap(table_name => (special[table_name] || ['id', 'user_id'])
        .filter(column_name => `${table_name}.${column_name}` !== missingColumn)
        .map(column_name => ({ table_name, column_name }))),
    };
  });
  return {
    pool: {
      query: inventoryQuery,
      connect: vi.fn(async () => {
        if (connectError) throw new Error('auth unavailable');
        return { query: clientQuery, release };
      }),
    },
    query: clientQuery,
    inventoryQuery,
    release,
  };
}

describe('deleteAccountData', () => {
  let auth;
  beforeEach(() => { auth = makeAuthPool(); });

  it('removes only canonical paths loaded for the authenticated owner', async () => {
    const db = makeSupabase({
      files: [
        { id: 'f1', path: `${USER}/notes.pdf` },
        { id: 'f2', path: `${USER}/notes.pdf` },
        { id: 'f3', path: null },
      ],
    });
    await deleteAccountData({ userId: USER, authUserId: AUTH_USER, supabase: db.client, authPool: auth.pool });

    expect(db.remove).toHaveBeenCalledWith([`${USER}/notes.pdf`]);
    expect(db.operations).toContainEqual(['files', 'eq', 'user_id', USER]);
    expect(db.operations.flat()).not.toContain('body-supplied-user');
    expect(auth.query).toHaveBeenCalledWith(
      'DELETE FROM "user" WHERE "id" = $1',
      [AUTH_USER],
    );
    expect(auth.query).toHaveBeenCalledWith(
      'DELETE FROM auth_id_mapping WHERE better_auth_id = $1 AND uuid = $2',
      [AUTH_USER, USER],
    );
  });

  it('handles an empty or already-cleaned application account', async () => {
    const db = makeSupabase();
    await expect(deleteAccountData({ userId: USER, authUserId: AUTH_USER, supabase: db.client, authPool: auth.pool }))
      .resolves.toBeUndefined();
    expect(db.remove).not.toHaveBeenCalled();
    expect(auth.query).toHaveBeenCalledWith('COMMIT');
  });

  it('uses the live schema inventory so absent optional feature tables do not fail deletion', async () => {
    const db = makeSupabase();
    auth = makeAuthPool({ existingTables: [] });
    await expect(deleteAccountData({
      userId: USER,
      authUserId: AUTH_USER,
      supabase: db.client,
      authPool: auth.pool,
    })).resolves.toBeUndefined();
    expect(db.operations.some(op => op[0] === 'quiz_results')).toBe(false);
  });

  it('fails closed when schema inventory is unavailable or ownership columns drift', async () => {
    const db = makeSupabase();
    auth = makeAuthPool({ inventoryError: true });
    await expect(deleteAccountData({
      userId: USER, authUserId: AUTH_USER, supabase: db.client, authPool: auth.pool,
    })).rejects.toMatchObject({ stage: 'schema-inventory' });
    expect(db.client.from).not.toHaveBeenCalled();

    auth = makeAuthPool({ missingColumn: 'device_fingerprints.user_id' });
    await expect(deleteAccountData({
      userId: USER, authUserId: AUTH_USER, supabase: db.client, authPool: auth.pool,
    })).rejects.toMatchObject({ stage: 'schema-inventory' });
  });

  it('retains file rows when storage cleanup fails so a retry has its manifest', async () => {
    const db = makeSupabase({ files: [{ id: 'f1', path: `${USER}/notes.pdf` }], storageError: { message: 'timeout' } });
    await expect(deleteAccountData({ userId: USER, authUserId: AUTH_USER, supabase: db.client, authPool: auth.pool }))
      .rejects.toMatchObject({ name: 'AccountDeletionError', stage: 'file-storage' });
    expect(db.operations).not.toContainEqual(['files', 'delete']);
    expect(auth.pool.connect).not.toHaveBeenCalled();
  });

  it('stops on a checked database error and does not falsely report success', async () => {
    const db = makeSupabase({ failTable: 'quiz_attempts' });
    await expect(deleteAccountData({ userId: USER, authUserId: AUTH_USER, supabase: db.client, authPool: auth.pool }))
      .rejects.toMatchObject({ code: 'ACCOUNT_DELETION_RETRYABLE', stage: 'quiz_attempts' });
    expect(auth.pool.connect).not.toHaveBeenCalled();
  });

  it('detects canonical files-row deletion failures', async () => {
    const db = makeSupabase({
      files: [{ id: 'f1', path: `${USER}/notes.pdf` }],
      failTable: 'files',
    });
    await expect(deleteAccountData({
      userId: USER, authUserId: AUTH_USER, supabase: db.client, authPool: auth.pool,
    })).rejects.toMatchObject({ stage: 'files' });
    expect(db.remove).toHaveBeenCalledOnce();
    expect(auth.pool.connect).not.toHaveBeenCalled();
  });

  it('retries idempotently after storage succeeds and files-row deletion fails once', async () => {
    const db = makeSupabase({
      files: [{ id: 'f1', path: `${USER}/notes.pdf` }],
      failOnceTable: 'files',
    });
    const args = { userId: USER, authUserId: AUTH_USER, supabase: db.client, authPool: auth.pool };
    await expect(deleteAccountData(args)).rejects.toMatchObject({ stage: 'files' });
    await expect(deleteAccountData(args)).resolves.toBeUndefined();
    expect(db.remove).toHaveBeenCalledTimes(2);
    expect(auth.pool.connect).toHaveBeenCalledOnce();
  });

  it('rolls back auth deletion atomically and surfaces the failure', async () => {
    const db = makeSupabase();
    auth = makeAuthPool({ failSql: 'DELETE FROM "account" WHERE "userId" = $1' });
    await expect(deleteAccountData({ userId: USER, authUserId: AUTH_USER, supabase: db.client, authPool: auth.pool }))
      .rejects.toBeInstanceOf(AccountDeletionError);
    expect(auth.query).toHaveBeenCalledWith('ROLLBACK');
    expect(auth.query).not.toHaveBeenCalledWith('COMMIT');
    expect(auth.release).toHaveBeenCalledOnce();
  });

  it('normalizes an auth connection failure as retryable', async () => {
    const db = makeSupabase();
    auth = makeAuthPool({ connectError: true });
    await expect(deleteAccountData({
      userId: USER, authUserId: AUTH_USER, supabase: db.client, authPool: auth.pool,
    })).rejects.toMatchObject({
      name: 'AccountDeletionError',
      code: 'ACCOUNT_DELETION_RETRYABLE',
      stage: 'authentication',
    });
  });

  it('scopes every owned delete to the authenticated user and both relationship directions', async () => {
    const db = makeSupabase();
    await deleteAccountData({ userId: USER, authUserId: AUTH_USER, supabase: db.client, authPool: auth.pool });
    const filters = db.operations.filter(op => op[1] === 'eq');
    expect(filters.length).toBeGreaterThan(20);
    expect(filters.every(op => op[2] === 'recipient_email' || op[3] === USER)).toBe(true);
    expect(db.operations).toContainEqual([
      'share_tracking', 'eq', 'recipient_email', 'learner@example.test',
    ]);
    expect(db.operations).toContainEqual([
      'user_blocklist', 'or', `user_id.eq.${USER},blocked_user_id.eq.${USER}`,
    ]);
    expect(db.operations).toContainEqual([
      'spam_confirmations', 'or', `recipient_id.eq.${USER},sender_id.eq.${USER}`,
    ]);
  });
});
