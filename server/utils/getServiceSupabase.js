import { createClient } from '@supabase/supabase-js';

// Create a Supabase client with service role key to bypass RLS
function getServiceSupabase() {
  if (!process.env.SUPABASE_SERVICE_KEY) {
    console.warn('[ServiceSupabase] No service key found, falling back to anon key');
    return null;
  }

  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );
}

export { getServiceSupabase };