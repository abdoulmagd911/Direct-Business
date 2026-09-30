import 'server-only';

// A throwaway server-side client for one check against Supabase Auth that must not touch this request's session:
// it keeps no session, refreshes nothing and sets no cookie (used to confirm a person's CURRENT password as My profile
// changes it — QA-92). It is the third and last way a client is made here; screens never import it.
import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';
import { publishableKey, supabaseUrl } from './env';

/**
 * My profile's change, made with the CURRENT password: a fresh session is opened with it (a wrong one answers `wrong`),
 * that fresh session sets the new password — so Auth's "secure password change" (on: a session older than a day may not
 * change its password without a code by e-mail) lets it, while a device signed in for days, or a stolen token, may not —
 * and the fresh session is ended. The person's own devices stay signed in: the app's rules decide those (V172).
 */
export async function changeWithCurrent(
  email: string,
  current: string,
  next: string,
): Promise<'ok' | 'wrong' | 'unavailable'> {
  if (!current) return 'wrong';
  const probe = createClient<Database, 'api'>(supabaseUrl(), publishableKey(), {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await probe.auth.signInWithPassword({ email, password: current });
  if (error) return error.status === 400 ? 'wrong' : 'unavailable';
  const changed = await probe.auth.updateUser({ password: next });
  // the probe was given a session of its own: end it, so that token stops working
  if (data.session) await probe.auth.signOut({ scope: 'local' }).catch(() => undefined);
  return changed.error ? 'unavailable' : 'ok';
}
