import 'server-only';

// The server's "who am I": one api.me() call per request (React's cache shares it between the gate and any page).
import { cache } from 'react';
import { cookies } from 'next/headers';
import { serverDb } from '@/core/db/server';
import { publishableKey, supabaseUrl } from '@/core/db/env';
import { toDbError } from '@/core/db/errors';
import { readRetry } from '@/core/db/retry';
import type { MeAnswer, MeRefused } from './me';

/** api.me() for this request's session, or null when there is no session at all. */
export const getMe = cache(async (): Promise<MeAnswer | null> => {
  const db = await serverDb();
  // Only whether a session cookie is there; the database verifies the token itself when api.me() is called.
  const { data } = await db.auth.getSession();
  if (!data.session) return refusedFromDeadToken();
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

/**
 * A session Auth no longer accepts (its row deleted: signed out elsewhere, by an admin, or idle) still has a token
 * the database accepts — PostgREST checks the signature, not the session row — so api.me() itself can still say
 * why, when asked with that token directly. The sign-out route reads the refusal from here and tells the person
 * why. Only a refusal is ever returned this way: a live answer is not trusted from a session Auth rejected, so
 * that state signs in again instead of looping between the gate and the sign-out route.
 */
async function refusedFromDeadToken(): Promise<MeRefused | null> {
  const token = await deadAccessToken();
  if (!token) return null;
  try {
    const r = await fetch(`${supabaseUrl()}/rest/v1/rpc/me`, {
      method: 'POST',
      headers: {
        apikey: publishableKey(),
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: '{}',
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return null;
    const answer = (await r.json()) as MeAnswer | null;
    if (!answer || answer.status === 'ok' || answer.status === 'must_change_password') return null;
    return answer as MeRefused;
  } catch {
    return null;
  }
}

/** The access token the browser still holds, from the session cookie (base64url JSON, `base64-` prefix). */
async function deadAccessToken(): Promise<string | null> {
  try {
    const store = await cookies();
    const found = store.getAll().filter((c) => /^sb-.+-auth-token/.test(c.name) && c.value);
    if (!found.length) return null;
    // A session too long for one cookie is split across .0, .1, … — joined in order (the SDK's own shape).
    const base = found.find((c) => !/\.\d+$/.test(c.name));
    let raw: string | null = null;
    if (base) raw = base.value;
    else {
      const chunks = found.map((c) => ({ n: Number(c.name.split('.').pop()), v: c.value })).sort((a, b) => a.n - b.n);
      if (chunks[0]?.n !== 0) return null;
      raw = chunks.map((c) => c.v).join('');
    }
    if (!raw) return null;
    let text = raw;
    if (text.startsWith('base64-')) text = Buffer.from(text.slice('base64-'.length), 'base64url').toString('utf8');
    const session = JSON.parse(text) as { access_token?: unknown };
    return typeof session.access_token === 'string' ? session.access_token : null;
  } catch {
    return null;
  }
}
