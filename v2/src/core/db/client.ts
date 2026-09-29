'use client';

// The browser's one Supabase client (A4): created once, shared by every screen. The old app had five clients fighting
// over refresh tokens and signing people out. Only the `api` schema is reachable (A6).
import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';
import { publishableKey, supabaseUrl } from './env';

export type Db = SupabaseClient<Database, 'api'>;

let client: Db | undefined;

export function browserDb(): Db {
  client ??= createBrowserClient<Database, 'api'>(supabaseUrl(), publishableKey(), { db: { schema: 'api' } });
  return client;
}
