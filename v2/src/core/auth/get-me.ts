import 'server-only';

// The server's "who am I": one api.me() call per request (React's cache shares it between the gate and any page).
import { cache } from 'react';
import { serverDb } from '@/core/db/server';
import { toDbError } from '@/core/db/errors';
import type { MeAnswer } from './me';

/** api.me() for this request's session, or null when there is no session at all. */
export const getMe = cache(async (): Promise<MeAnswer | null> => {
  const db = await serverDb();
  // Only whether a session cookie is there; the database verifies the token itself when api.me() is called.
  const { data } = await db.auth.getSession();
  if (!data.session) return null;
  const { data: me, error } = await db.rpc('me');
  if (error) {
    // A token the database no longer accepts (expired past refresh, or its session deleted) is "no session".
    if (error.code === 'PGRST301' || error.code === 'PGRST303') return null;
    const e = toDbError(error);
    if (e.kind === 'PermissionDenied' && e.key === 'auth.not_signed_in') return null;
    throw e;
  }
  return me as unknown as MeAnswer;
});
