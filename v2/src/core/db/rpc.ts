'use client';
import type { Database } from './database.types';
import { browserDb } from './client';
import { DbError, unwrap } from './errors';

type Fns = Database['api']['Functions'];
export type ApiFunction = keyof Fns & string;
export type ApiArgs<F extends ApiFunction> = Fns[F]['Args'];
export type ApiReturns<F extends ApiFunction> = Fns[F]['Returns'];

/**
 * A browser api.* call that gives up after this long. The gateway holds a stalled call ~5 s and gives up at 10 s, so
 * a call still waiting at 30 s is not coming back — and a Save button spinning for ~30 s is a crash in the person's
 * eyes (F126/F131). The timeout only stops waiting: the write may still land on the server, so a failed write is
 * never retried blindly (a response lost after the server committed would double-apply on retry); the person retries
 * on the same screen, with the form intact.
 */
const RPC_TIMEOUT_MS = 30_000;

/**
 * One api.* call from the browser, as the signed-in person (the Data API checks the session; the database checks the
 * access — V125). The typed error is thrown (core/db/errors.ts); the screen turns its key into words (words.ts).
 */
export async function rpc<F extends ApiFunction>(
  fn: F,
  args: ApiArgs<F>,
  opts: { retry?: boolean } = {},
): Promise<ApiReturns<F>> {
  // Whether the attempt now running gave up on the timeout: a retry after a 30 s wait would wait another 30 s,
  // so a timed-out call is never retried.
  let timedOut = false;
  const attempt = async (): Promise<ApiReturns<F>> => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        timedOut = true;
        reject(new DbError('Unavailable', 'common.unavailable', `${fn} timed out after ${RPC_TIMEOUT_MS / 1000}s`));
      }, RPC_TIMEOUT_MS);
    });
    try {
      const result = await Promise.race([browserDb().rpc(fn, args as never), timeout]);
      return unwrap(result as { data: ApiReturns<F> | null; error: { code?: string; message?: string } | null });
    } finally {
      clearTimeout(timer);
    }
  };
  try {
    return await attempt();
  } catch (e) {
    // A read that failed on its way (not a refusal, and not a call that already waited out the timeout) is tried
    // once more, as the server read is (readTwice). Only reads pass retry: a response lost after the server
    // committed would double-apply a write on retry, so writes never retry.
    if (opts.retry && e instanceof DbError && e.kind === 'Unavailable' && !timedOut) {
      await new Promise((done) => setTimeout(done, 250));
      return attempt();
    }
    throw e;
  }
}
