import 'server-only';
import type { Database } from './database.types';
import { unwrap } from './errors';
import { readTwice } from './retry';
import { serverDb } from './server';

type Fns = Database['api']['Functions'];

/**
 * One api.* read on the server for this request's session (a page's first data). A read that failed on its way is tried
 * once more (W43, core/db/retry.ts). Throws the typed error.
 */
export async function serverRpc<F extends keyof Fns & string>(fn: F, args: Fns[F]['Args']): Promise<Fns[F]['Returns']> {
  const db = await serverDb();
  const result = await readTwice(() => db.rpc(fn, args as never));
  return unwrap(result as { data: Fns[F]['Returns'] | null; error: { code?: string; message?: string } | null });
}
