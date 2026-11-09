import 'server-only';

// The server's "who am I": one api.me() call per request (React's cache shares it between the gate and any page).
import { cache } from 'react';
import { serverDb } from '@/core/db/server';
import { toDbError } from '@/core/db/errors';
import { readRetry } from '@/core/db/retry';
import type { MeAnswer } from './me';

/** api.me() for this request's session, or null when there is no session at all. */
export const getMe = cache(async (): Promise<MeAnswer | null> => {
  const db = await serverDb();
  // Only whether a session cookie is there; the database verifies the token itself when api.me() is called.
  const { data } = await db.auth.getSession();
  if (!data.session) return null;
  // A call that failed on its way is tried up to three times before the error screen (W43): the gateway holds a
  // signed-in call for 5 s and gives up at 10 s, and a second try almost always lands; a third covers a stall that
  // outlasts the second. An outage of ~20 s cannot be retried through — that is what the layout's retryable state
  // is for, so this read gives up and says so instead of spinning.
  const { data: me, error } = await readRetry(() => db.rpc('me'), 3, [250, 1000]);
  if (error) {
    // A token the database no longer accepts (expired past refresh, or its session deleted) is "no session".
    if (error.code === 'PGRST301' || error.code === 'PGRST303') return null;
    const e = toDbError(error);
    if (e.kind === 'PermissionDenied' && e.key === 'auth.not_signed_in') return null;
    throw e;
  }
  return me as unknown as MeAnswer;
});
