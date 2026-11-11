'use server';

// The password door (owner, 29 Sep 13:50: sign-in is work email + password; no emails are sent), on the server:
//   signInWithPassword — is this email allowed? (api.sign_in_password_check, with the secret key; a refusal is logged
//                        with its reason) then Supabase checks the password and sets the session cookie (Auth's own
//                        refusal is logged too, api.sign_in_password_refused); api.sign_in_complete, as the new
//                        session, logs the sign-in and registers the device (V74). A person whose password must change
//                        (first sign-in, or after an admin's generate) lands on /set-password first: the database
//                        says so (V166), and until it is changed the person reaches nothing else.
//   setOwnPassword     — the person whose password must change (the database says so: api.me() answers
//                        must_change_password) sets a new one, on the session they have just signed in with; anyone
//                        else is refused (not_needed). The server records it (api.own_password_set, secret key only —
//                        the browser never clears its own flag) and signs their other devices out.
//   changePassword     — My profile → Change password: made with the current password (a fresh session opened with it
//                        sets the new one — core/db/probe.ts), and recorded the same way.
// Too many tries (V172): the database counts wrong passwords per e-mail — five in fifteen minutes lock it for fifteen
// minutes — because Supabase's own limit sees this server's address, not the person's; a wrong current password on
// My profile counts too. Auth's "secure password change" is on: a session older than a day cannot change its password
// straight through Supabase.
// The 6-digit code door (actions.ts) stays in the code, off unless an admin switches auth.code_door_enabled on.
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { changeWithCurrent } from '@/core/db/probe';
import { serverDb } from '@/core/db/server';
import { serviceDb } from '@/core/db/service';
import { deviceLabel } from './device-label';
import { CHANGE_PASSWORD_PATH } from './password';
import { passwordProblem } from './password-rules';
import { safeNext } from './safe-next';

export type PasswordError =
  | 'invalid_email'
  | 'not_listed'
  | 'switched_off'
  | 'wrong_password'
  | 'wrong_current'
  | 'rate_limited'
  | 'too_short'
  | 'too_long'
  | 'same_as_email'
  | 'mismatch'
  | 'not_signed_in'
  | 'not_needed'
  | 'unavailable';

export type PasswordResult = { ok: true } | { ok: false; error: PasswordError };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function signInWithPassword(
  rawEmail: string,
  rawPassword: string,
  next: string | null,
): Promise<PasswordResult> {
  const email = String(rawEmail ?? '')
    .trim()
    .toLowerCase();
  const password = String(rawPassword ?? '');
  if (!EMAIL.test(email) || email.length > 254) return { ok: false, error: 'invalid_email' };
  if (!password) return { ok: false, error: 'wrong_password' };
  const ua = (await headers()).get('user-agent');

  const check = await serviceDb().rpc('sign_in_password_check', { p_email: email, p_user_agent: ua ?? undefined });
  if (check.error) return { ok: false, error: 'unavailable' };
  if (check.data === 'not_listed' || check.data === 'switched_off') return { ok: false, error: check.data };
  if (check.data === 'locked' || check.data === 'rate_limited') return { ok: false, error: 'rate_limited' };
  if (check.data !== 'allowed') return { ok: false, error: 'unavailable' };

  const db = await serverDb();
  const signed = await db.auth.signInWithPassword({ email, password });
  if (signed.error || !signed.data.session) {
    const code = signed.error?.code ?? '';
    const refused = await serviceDb().rpc('sign_in_password_refused', {
      p_email: email,
      p_detail: code || signed.error?.message || 'no_session',
      p_user_agent: ua ?? undefined,
    });
    const limited = signed.error?.status === 429 || /rate_limit/.test(code) || refused.data === 'locked';
    return { ok: false, error: limited ? 'rate_limited' : 'wrong_password' };
  }
  const done = await db.rpc('sign_in_complete', {
    p_provider: 'email',
    p_device_label: deviceLabel(ua) ?? undefined,
    p_user_agent: ua ?? undefined,
  });
  const target = safeNext(next);
  if (!done.error && done.data === 'must_change_password')
    redirect(`${CHANGE_PASSWORD_PATH}?next=${encodeURIComponent(target)}`);
  if (done.error || done.data !== 'ok') {
    await db.auth.signOut({ scope: 'local' });
    const refused =
      done.data === 'not_listed' || done.data === 'switched_off'
        ? done.data
        : done.data === 'locked'
          ? 'rate_limited'
          : 'unavailable';
    return { ok: false, error: refused };
  }
  redirect(target);
}

/** The rules a new password meets (at least ten characters, at most 72 bytes, never the e-mail), or the refusal. */
function refusal(password: string, again: string, email: string | undefined): PasswordError | null {
  const problem = passwordProblem(password, email);
  if (problem) return problem;
  if (password !== again) return 'mismatch';
  return null;
}

/** What api.me() says of the signed-in person: ok, must_change_password, or a refusal. */
async function meStatus(db: Awaited<ReturnType<typeof serverDb>>): Promise<string | null> {
  const me = await db.rpc('me');
  return me.error ? null : ((me.data as { status?: string } | null)?.status ?? null);
}

/**
 * After Auth took a person's new password: the server records it, clears "must change password" (V166) and signs
 * every other device of the person out in the same logged request — this one stays in (ACC-021). The session to
 * keep may be passed in: Auth deletes every session when the password is updated, so after the change there is no
 * session left to read it from — the caller captures it first, or signs in again and passes the fresh one.
 */
async function recordChange(
  db: Awaited<ReturnType<typeof serverDb>>,
  authUserId: string,
  keepSession?: string,
): Promise<boolean> {
  let session = keepSession;
  if (!session) {
    const { data } = await db.auth.getClaims();
    session = (data?.claims as { session_id?: string } | undefined)?.session_id;
  }
  const { error } = await serviceDb().rpc('own_password_set', {
    p_auth_user: authUserId,
    p_keep_session: session ?? '00000000-0000-0000-0000-000000000000',
  });
  return !error;
}

/**
 * The session_id inside a session's access token (the JWT's own claim — read locally, no Auth call: getClaims
 * would ask Auth each time, and this action already makes enough round-trips to stay inside the screen's wait).
 */
function sessionIdOf(session: { access_token?: string } | null | undefined): string | undefined {
  const token = session?.access_token;
  if (!token) return undefined;
  try {
    const part = token.split('.')[1];
    if (!part) return undefined;
    const payload = JSON.parse(Buffer.from(part, 'base64url').toString('utf8')) as {
      session_id?: unknown;
    };
    return typeof payload.session_id === 'string' ? payload.session_id : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Auth deletes every session when a password is updated — the device that changed it included — so after the change
 * the device signs in again with the new password and registers that fresh session as its device. Returns the fresh
 * session's id, or null when the fresh sign-in did not land (then the caller records the change keeping the device
 * the request came from instead, and the person signs in again). A half-landed sign-in is ended, so no session
 * without a device is left behind in the cookie.
 */
async function reSignIn(
  db: Awaited<ReturnType<typeof serverDb>>,
  email: string,
  password: string,
): Promise<string | null> {
  const signed = await db.auth.signInWithPassword({ email, password });
  if (signed.error || !signed.data.session) return null;
  const ua = (await headers()).get('user-agent');
  const done = await db.rpc('sign_in_complete', {
    p_provider: 'email',
    p_device_label: deviceLabel(ua) ?? undefined,
    p_user_agent: ua ?? undefined,
  });
  // Landing 10 (#1580 triage): on the setOwnPassword path the person is still flagged
  // must_change_password when this sign-in completes — the flag is cleared only by the recordChange
  // that follows — so 'must_change_password' is a landed sign-in here, not a refusal. Rejecting it
  // signed the fresh session straight back out and left the person with no cookie at all.
  if (done.error || (done.data !== 'ok' && done.data !== 'must_change_password')) {
    await db.auth.signOut({ scope: 'local' }).catch(() => undefined);
    return null;
  }
  return sessionIdOf(signed.data.session) ?? null;
}

/**
 * The person whose password must change (first sign-in, or after an admin's generate) sets a new one; the flag clears
 * and they go on. Only then: the database must say so (api.me() → must_change_password) — anyone else changes theirs on
 * My profile, with the current password (not_needed).
 */
export async function setOwnPassword(
  rawPassword: string,
  rawAgain: string,
  next: string | null,
): Promise<PasswordResult> {
  const password = String(rawPassword ?? '');
  const db = await serverDb();
  // The person is read from the session cookie here, not asked of Auth: the proxy verified this session with Auth
  // on this same request (getClaims), and the change itself is made on that session — the action already makes
  // enough round-trips to stay inside the screen's wait.
  const { data: sessionNow } = await db.auth.getSession();
  const who = sessionNow.session?.user;
  if (!who) return { ok: false, error: 'not_signed_in' };
  const status = await meStatus(db);
  if (status === 'ok') return { ok: false, error: 'not_needed' };
  if (status !== 'must_change_password') return { ok: false, error: 'not_signed_in' };
  const refused = refusal(password, String(rawAgain ?? ''), who.email);
  if (refused) return { ok: false, error: refused };
  // The session to keep is captured before the change (see changePassword): the update deletes every session.
  const keepBefore = sessionIdOf(sessionNow.session);
  const changed = await db.auth.updateUser({ password });
  if (changed.error) return { ok: false, error: 'unavailable' };
  const email = who.email;
  if (!email) return { ok: false, error: 'unavailable' };
  const fresh = await reSignIn(db, email, password);
  if (!(await recordChange(db, who.id, fresh ?? keepBefore))) return { ok: false, error: 'unavailable' };
  redirect(safeNext(next));
}

/**
 * My profile → Change password: the current password is asked for and checked first (QA-92: an unlocked, signed-in
 * computer must not be enough to lock its person out), against Supabase Auth with a throwaway client that keeps no
 * session and touches no cookie; only then is the new one set for the signed-in person, and the server records it.
 */
export async function changePassword(
  rawCurrent: string,
  rawPassword: string,
  rawAgain: string,
): Promise<PasswordResult> {
  const password = String(rawPassword ?? '');
  const db = await serverDb();
  // The person is read from the session cookie here, not asked of Auth: the proxy verified this session with Auth
  // on this same request (getClaims), and the change itself is authorised by signing in with the current password
  // below — the action already makes enough round-trips to stay inside the screen's wait.
  const { data: sessionNow } = await db.auth.getSession();
  const who = sessionNow.session?.user;
  const email = who?.email;
  if (!who || !email) return { ok: false, error: 'not_signed_in' };
  // The two pre-checks are independent reads, so they go together instead of one after the other.
  const [status, limited] = await Promise.all([meStatus(db), serviceDb().rpc('sign_in_limited', { p_email: email })]);
  if (status !== 'ok' && status !== 'must_change_password') return { ok: false, error: 'not_signed_in' };
  const refused = refusal(password, String(rawAgain ?? ''), email);
  if (refused) return { ok: false, error: refused };
  // A wrong current password counts as a wrong password (V172): an unlocked computer cannot guess its way through.
  if (limited.error) return { ok: false, error: 'unavailable' };
  if (limited.data) return { ok: false, error: 'rate_limited' };
  // The session to keep is captured before the change: Auth deletes every session when the password is updated,
  // so after the change there is no session left to read it from (the record then fell back to none, and every
  // device — this one included — was signed out).
  const keepBefore = sessionIdOf(sessionNow.session);
  const check = await changeWithCurrent(email, String(rawCurrent ?? ''), password);
  if (check === 'wrong') {
    const ua = (await headers()).get('user-agent');
    const counted = await serviceDb().rpc('sign_in_password_refused', {
      p_email: email,
      p_detail: 'invalid_credentials',
      p_user_agent: ua ?? undefined,
    });
    return { ok: false, error: counted.data === 'locked' ? 'rate_limited' : 'wrong_current' };
  }
  if (check !== 'ok') return { ok: false, error: 'unavailable' };
  // The change deleted every session, this device's included: sign in again with the new password, so the device
  // stays in (ACC-021) instead of landing on the sign-in page. When that fresh sign-in does not land, the change
  // is still recorded keeping the device this request came from (captured below, before the change — after it there
  // is no session left to read it from): the person signs in again, the other devices go.
  const fresh = await reSignIn(db, email, password);
  if (!(await recordChange(db, who.id, fresh ?? keepBefore))) return { ok: false, error: 'unavailable' };
  return { ok: true };
}
