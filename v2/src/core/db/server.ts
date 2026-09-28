import 'server-only';

// The per-request client of server components, server actions and route handlers: it acts as the signed-in person
// (their session cookie), so row rules and api.* functions see who is asking. One per request — never shared.
import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import type { Database } from './database.types';
import { publishableKey, supabaseUrl } from './env';

export type ServerDb = SupabaseClient<Database, 'api'>;

export async function serverDb(): Promise<ServerDb> {
  const store = await cookies();
  return createServerClient<Database, 'api'>(supabaseUrl(), publishableKey(), {
    db: { schema: 'api' },
    cookies: {
      getAll: () => store.getAll(),
      setAll(list) {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          // A server component may not set cookies; the proxy refreshes the session on the next request.
        }
      },
    },
  });
}
