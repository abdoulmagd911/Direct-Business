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
//                        else is refused (not_needed). The server records it (api.password_changed, secret key only —
//                        the browser never clears its own flag).
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

/** After Auth took a person's new password: the server records it and clears "must change password" (V166). */
async function recordChange(authUserId: string): Promise<boolean> {
  const { error } = await serviceDb().rpc('password_changed', { p_auth_user: authUserId });
  return !error;
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
  const { data: who } = await db.auth.getUser();
  if (!who.user) return { ok: false, error: 'not_signed_in' };
  const status = await meStatus(db);
  if (status === 'ok') return { ok: false, error: 'not_needed' };
  if (status !== 'must_change_password') return { ok: false, error: 'not_signed_in' };
  const refused = refusal(password, String(rawAgain ?? ''), who.user.email);
  if (refused) return { ok: false, error: refused };
  const changed = await db.auth.updateUser({ password });
  if (changed.error) return { ok: false, error: 'unavailable' };
  if (!(await recordChange(who.user.id))) return { ok: false, error: 'unavailable' };
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
  const { data: who } = await db.auth.getUser();
  const email = who.user?.email;
  if (!who.user || !email) return { ok: false, error: 'not_signed_in' };
  const status = await meStatus(db);
  if (status !== 'ok' && status !== 'must_change_password') return { ok: false, error: 'not_signed_in' };
  const refused = refusal(password, String(rawAgain ?? ''), email);
  if (refused) return { ok: false, error: refused };
  // A wrong current password counts as a wrong password (V172): an unlocked computer cannot guess its way through.
  const limited = await serviceDb().rpc('sign_in_limited', { p_email: email });
  if (limited.error) return { ok: false, error: 'unavailable' };
  if (limited.data) return { ok: false, error: 'rate_limited' };
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
  if (!(await recordChange(who.user.id))) return { ok: false, error: 'unavailable' };
  return { ok: true };
}
