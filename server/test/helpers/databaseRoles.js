// Native PostgreSQL has none of Supabase's built-in roles on a fresh cluster.
// Serialize setup across independently running test files; role creation is global.
export async function ensureTestDatabaseRoles(client) {
  await client.query(`DO $$ BEGIN
    PERFORM pg_advisory_xact_lock(20260915, 1);
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
      CREATE ROLE anon;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
      CREATE ROLE authenticated;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
      CREATE ROLE service_role;
    END IF;
  END $$;`);
}
