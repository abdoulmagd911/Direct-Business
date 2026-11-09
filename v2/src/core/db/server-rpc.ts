import 'server-only';
import type { Database } from './database.types';
import { unwrap } from './errors';
import { readTwice } from './retry';
import { serverDb } from './server';

type Fns = Database['api']['Functions'];

/**
 * One api.* read on the server for this request's session (a page's first data). A read that failed on its way is tried
 * once more (W43, core/db/retry.ts). Throws the typed error.
 *
 * FIX-45: every read logs its own duration (server-side, timings only, no data — the function name, milliseconds and
 * whether the retry fired), so a slow page can be attributed to a gateway stall, a specific function or the instance
 * instead of guessed at. A re-test that only times the whole page cannot close the FIX-45 diagnosis.
 */
export async function serverRpc<F extends keyof Fns & string>(fn: F, args: Fns[F]['Args']): Promise<Fns[F]['Returns']> {
  const db = await serverDb();
  const started = Date.now();
  let attempts = 0;
  const result = await readTwice(() => {
    attempts += 1;
    return db.rpc(fn, args as never);
  });
  console.log(`[serverRpc] fn=${fn} ms=${Date.now() - started} attempts=${attempts}`);
  return unwrap(result as { data: Fns[F]['Returns'] | null; error: { code?: string; message?: string } | null });
}
