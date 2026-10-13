// A server read that failed on its way, not in the database, is tried once more before the error screen (W43). In
// production the Supabase gateway sometimes holds a signed-in call from the server for 5 s and gives up at 10 s
// (status 555, "Internal server error."), while the database answers the same call in milliseconds; a second try
// almost always lands. Only reads go through here, so a second try never does anything twice. A refusal the database
// gave (a key, a SQLSTATE, a rejected token) is an answer, and is never retried.
import type { PostgrestLikeError } from './errors';

/** What supabase-js answers for one call: the error (if any) and the HTTP status (0 when the request never got one). */
export interface CallResult {
  error: PostgrestLikeError | null;
  status?: number;
}

const TRANSIENT_CODES = new Set(['PGRST000', 'PGRST001', 'PGRST002', 'PGRST003', '57014']);

/** How long to wait before the second try. */
export const RETRY_DELAY_MS = 250;

/** Whether a failed call failed in transit — no answer, or a gateway or server failure without a database code. */
export function isTransient(result: CallResult): boolean {
  if (!result.error) return false;
  const code = result.error.code ?? '';
  // A database or API refusal carries its code (P0001, 42501, 23505, PGRST301 …): that is an answer, not a failure.
  // The codes of a failure on the way are not: the API could not reach the database or its pool (PGRST000–003), the
  // connection dropped (08…), or the statement was cancelled for time (57014).
  if (code !== '' && !TRANSIENT_CODES.has(code) && !code.startsWith('08')) return false;
  const status = result.status ?? 0;
  return status === 0 || status === 408 || status >= 500;
}

/** Runs one read; when it fails in transit, waits a moment and runs it once more. Answers the last result. */
export async function readTwice<R extends CallResult>(
  call: () => PromiseLike<R>,
  wait: (ms: number) => Promise<void> = (ms) => new Promise((done) => setTimeout(done, ms)),
): Promise<R> {
  const first = await call();
  if (!isTransient(first)) return first;
  await wait(RETRY_DELAY_MS);
  return call();
}
