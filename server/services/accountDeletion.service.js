/**
 * Account data inventory
 *
 * syncUserToSupabase maps Better Auth's `req.user.id` through auth_id_mapping
 * and rewrites `req.userId` to the application UUID used by profiles and all
 * application ownership columns. These values may differ and must never be
 * substituted for each other. Files are represented by
 * files rows; file_chunks depend on files and the external object is files.path
 * in the user-files bucket. Chat messages depend on chat_conversations;
 * flashcards/progress/sessions depend on decks; quiz attempts/results depend on
 * quizzes. The remaining tables below own progress, activity, notifications,
 * sharing/import history, generated content and device records directly by
 * user_id. Parent deletion is deliberately last so FK cascades can supplement
 * (but never replace) the checked deletes.
 *
 * Recovery: storage is removed before its manifest row, every database delete
 * is idempotent, and the auth transaction runs last. A failure therefore keeps
 * the Better Auth user/session available to retry. Object storage and Postgres
 * cannot share a transaction; a successful storage removal followed by a DB
 * failure is safe because the retained files row preserves the retry manifest.
 */

export class AccountDeletionError extends Error {
  constructor(stage, cause) {
    super(`Account deletion failed at ${stage}`, { cause });
    this.name = 'AccountDeletionError';
    this.code = 'ACCOUNT_DELETION_RETRYABLE';
    this.stage = stage;
  }
}

const OWNED_TABLES = [
  'quiz_attempts', 'quiz_results', 'flashcard_progress', 'flashcard_sessions',
  'xp_transactions', 'activity_logs', 'notifications', 'notification_history',
  'notification_preferences', 'push_tokens', 'push_notifications',
  'notification_queue',
  'user_recent_activities', 'user_study_sessions', 'user_daily_goals',
  'user_achievements', 'user_stats_daily', 'generated_pdfs', 'study_sessions',
  'import_tracking', 'imported_content', 'share_events',
  'moderation_queue', 'shareable_links', 'device_fingerprints', 'quizzes',
  'flashcard_decks', 'folders',
  'chat_conversations',
];
const REQUIRED_COLUMNS = {
  files: ['id', 'path', 'user_id'],
  profiles: ['id'],
  users: ['id'],
  ...Object.fromEntries(OWNED_TABLES.map(table => [table, ['user_id']])),
  content_reports: ['reporter_id'],
  share_tracking: ['sender_id', 'recipient_email'],
  user_blocklist: ['user_id', 'blocked_user_id'],
  spam_confirmations: ['recipient_id', 'sender_id'],
};
const CORE_TABLES = new Set(['files', 'profiles', 'users']);

async function checked(stage, query) {
  const { error } = await query;
  if (error) throw new AccountDeletionError(stage, error);
}

export async function deleteAccountData({ userId, authUserId, supabase, authPool }) {
  if (!userId || !authUserId) {
    throw new AccountDeletionError('identity', new Error('Missing authenticated identity'));
  }

  let existingTables;
  try {
    const { rows } = await authPool.query(
      `SELECT table_name, column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = ANY($1::text[])`,
      [Object.keys(REQUIRED_COLUMNS)],
    );
    const columnsByTable = new Map();
    for (const { table_name: table, column_name: column } of rows) {
      if (!columnsByTable.has(table)) columnsByTable.set(table, new Set());
      columnsByTable.get(table).add(column);
    }
    for (const [table, columns] of Object.entries(REQUIRED_COLUMNS)) {
      const actual = columnsByTable.get(table);
      if (!actual) {
        if (CORE_TABLES.has(table)) throw new Error(`Missing required table ${table}`);
        continue;
      }
      if (columns.some(column => !actual.has(column))) {
        throw new Error(`Unexpected ownership schema for ${table}`);
      }
    }
    existingTables = new Set(columnsByTable.keys());
  } catch (error) {
    throw new AccountDeletionError('schema-inventory', error);
  }

  const { data: files, error: filesError } = await supabase
    .from('files').select('id, path').eq('user_id', userId);
  if (filesError) throw new AccountDeletionError('file-manifest', filesError);

  const { data: profile, error: profileError } = await supabase
    .from('profiles').select('email').eq('id', userId).maybeSingle();
  if (profileError) throw new AccountDeletionError('profile-manifest', profileError);

  const paths = [...new Set((files || []).map(file => file.path).filter(Boolean))];
  if (paths.length) {
    const { error } = await supabase.storage.from('user-files').remove(paths);
    if (error) throw new AccountDeletionError('file-storage', error);
  }

  await checked('files', supabase.from('files').delete().eq('user_id', userId));
  if (existingTables.has('content_reports')) {
    await checked(
      'content-reports',
      supabase.from('content_reports').delete().eq('reporter_id', userId),
    );
  }
  if (existingTables.has('share_tracking')) {
    await checked(
      'share-tracking-sender',
      supabase.from('share_tracking').delete().eq('sender_id', userId),
    );
    if (profile?.email) {
      await checked(
        'share-tracking-recipient',
        supabase.from('share_tracking').delete().eq('recipient_email', profile.email),
      );
    }
  }

  for (const table of OWNED_TABLES) {
    if (existingTables.has(table)) {
      await checked(table, supabase.from(table).delete().eq('user_id', userId));
    }
  }

  if (existingTables.has('user_blocklist')) {
    await checked(
      'user-blocklist',
      supabase.from('user_blocklist').delete()
        .or(`user_id.eq.${userId},blocked_user_id.eq.${userId}`),
    );
  }
  if (existingTables.has('spam_confirmations')) {
    await checked(
      'spam-confirmations',
      supabase.from('spam_confirmations').delete()
        .or(`recipient_id.eq.${userId},sender_id.eq.${userId}`),
    );
  }
  await checked('profiles', supabase.from('profiles').delete().eq('id', userId));
  await checked('users', supabase.from('users').delete().eq('id', userId));

  let client;
  try {
    client = await authPool.connect();
  } catch (error) {
    throw new AccountDeletionError('authentication', error);
  }
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM "session" WHERE "userId" = $1', [authUserId]);
    await client.query('DELETE FROM "account" WHERE "userId" = $1', [authUserId]);
    await client.query(
      'DELETE FROM auth_id_mapping WHERE better_auth_id = $1 AND uuid = $2',
      [authUserId, userId],
    );
    await client.query('DELETE FROM "user" WHERE "id" = $1', [authUserId]);
    await client.query('COMMIT');
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch { /* original error wins */ }
    throw new AccountDeletionError('authentication', error);
  } finally {
    client.release();
  }
}
