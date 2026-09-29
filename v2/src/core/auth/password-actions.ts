'use server';

// The password door (owner, 29 Sep 13:50: sign-in is work email + password; no emails are sent), on the server:
//   signInWithPassword — is this email allowed? (api.sign_in_password_check, with the secret key; a refusal is logged
//                        with its reason) then Supabase checks the password and sets the session cookie (Auth's own
//                        refusal is logged too, api.sign_in_password_refused); api.sign_in_complete, as the new
//                        session, logs the sign-in and registers the device (V74). A person whose password must change
//                        (first sign-in, or after an admin's generate) lands on /set-password first: the database
//                        says so (V166), and until it is changed the person reaches nothing else.
//   setOwnPassword     — the signed-in person sets their own password; the server records it (api.own_password_set,
//                        secret key only — the browser never clears its own flag) and signs their other devices out.
//   changePassword     — My profile → Change password, recorded the same way.
// The 6-digit code door (actions.ts) stays in the code, off unless an admin switches auth.code_door_enabled on.
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { passwordHolds } from '@/core/db/probe';
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
  if (check.data !== 'allowed') return { ok: false, error: 'unavailable' };

  const db = await serverDb();
  const signed = await db.auth.signInWithPassword({ email, password });
  if (signed.error || !signed.data.session) {
    const code = signed.error?.code ?? '';
    await serviceDb().rpc('sign_in_password_refused', {
      p_email: email,
      p_detail: code || signed.error?.message || 'no_session',
      p_user_agent: ua ?? undefined,
    });
    const limited = signed.error?.status === 429 || /rate_limit/.test(code);
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
    const refused = done.data === 'not_listed' || done.data === 'switched_off' ? done.data : 'unavailable';
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

/**
 * After Auth took a person's new password: the server records it, clears "must change password" (V166) and signs
 * every other device of the person out in the same logged request — this one stays in (ACC-021).
 */
async function recordChange(db: Awaited<ReturnType<typeof serverDb>>, authUserId: string): Promise<boolean> {
  const { data } = await db.auth.getClaims();
  const session = (data?.claims as { session_id?: string } | undefined)?.session_id;
  const { error } = await serviceDb().rpc('own_password_set', {
    p_auth_user: authUserId,
    p_keep_session: session ?? '00000000-0000-0000-0000-000000000000',
  });
  return !error;
}

/** The signed-in person sets their own password (first sign-in or after a generate); the flag clears and they go on. */
export async function setOwnPassword(
  rawPassword: string,
  rawAgain: string,
  next: string | null,
): Promise<PasswordResult> {
  const password = String(rawPassword ?? '');
  const db = await serverDb();
  const { data: who } = await db.auth.getUser();
  if (!who.user) return { ok: false, error: 'not_signed_in' };
  const refused = refusal(password, String(rawAgain ?? ''), who.user.email);
  if (refused) return { ok: false, error: refused };
  const me = await db.rpc('me');
  const status = (me.data as { status?: string } | null)?.status;
  if (me.error || (status !== 'ok' && status !== 'must_change_password')) return { ok: false, error: 'not_signed_in' };
  const changed = await db.auth.updateUser({ password });
  if (changed.error) return { ok: false, error: 'unavailable' };
  if (!(await recordChange(db, who.user.id))) return { ok: false, error: 'unavailable' };
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
  if (!who.user?.email) return { ok: false, error: 'not_signed_in' };
  const refused = refusal(password, String(rawAgain ?? ''), who.user.email);
  if (refused) return { ok: false, error: refused };
  const check = await passwordHolds(who.user.email, String(rawCurrent ?? ''));
  if (check !== 'ok') return { ok: false, error: check === 'wrong' ? 'wrong_current' : 'unavailable' };
  const changed = await db.auth.updateUser({ password });
  if (changed.error) return { ok: false, error: 'unavailable' };
  if (!(await recordChange(db, who.user.id))) return { ok: false, error: 'unavailable' };
  return { ok: true };
}
