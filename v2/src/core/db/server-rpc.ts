import 'server-only';
import type { Database } from './database.types';
import { unwrap } from './errors';
import { serverDb } from './server';

type Fns = Database['api']['Functions'];

/** One api.* read on the server for this request's session (a page's first data). Throws the typed error. */
export async function serverRpc<F extends keyof Fns & string>(fn: F, args: Fns[F]['Args']): Promise<Fns[F]['Returns']> {
  const db = await serverDb();
  const result = await db.rpc(fn, args as never);
  return unwrap(result as { data: Fns[F]['Returns'] | null; error: { code?: string; message?: string } | null });
}
