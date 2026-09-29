import 'server-only';

// A throwaway server-side client for one check against Supabase Auth that must not touch this request's session:
// it keeps no session, refreshes nothing and sets no cookie (used to confirm a person's CURRENT password before My
// profile changes it — QA-92). It is the third and last way a client is made here; screens never import it.
import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';
import { publishableKey, supabaseUrl } from './env';

/** Does this email and password pair hold? Answers only yes, no, or that Auth did not answer. */
export async function passwordHolds(email: string, password: string): Promise<'ok' | 'wrong' | 'unavailable'> {
  if (!password) return 'wrong';
  const probe = createClient<Database, 'api'>(supabaseUrl(), publishableKey(), {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await probe.auth.signInWithPassword({ email, password });
  if (error) return error.status === 400 ? 'wrong' : 'unavailable';
  // the probe was given a session of its own: end it, so that token stops working
  if (data.session) await probe.auth.signOut({ scope: 'local' }).catch(() => undefined);
  return 'ok';
}
