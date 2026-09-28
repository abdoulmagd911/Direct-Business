import 'server-only';

// The server's own client, with the secret key (TECH-SPEC §4 step 2): it creates and bans auth users for the admin's
// allow-list and calls the few api.* functions granted to service_role alone (the sign-in pre-check and its log).
// Never imported by anything that reaches the browser — `server-only` makes such an import fail the build.
import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';
import { MissingSetting, supabaseUrl } from './env';

export type ServiceDb = SupabaseClient<Database, 'api'>;

export function serviceDb(): ServiceDb {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new MissingSetting('SUPABASE_SECRET_KEY');
  return createClient<Database, 'api'>(supabaseUrl(), key, {
    db: { schema: 'api' },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
