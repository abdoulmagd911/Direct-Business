'use server';

// The password door (owner, 29 Sep 13:50: sign-in is work email + password; no emails are sent), on the server:
//   signInWithPassword — is this email allowed? (api.sign_in_check, with the secret key; a refusal is logged with its
//                        reason) then Supabase checks the password and sets the session cookie; api.sign_in_complete,
//                        as the new session, logs the sign-in and registers the device (V74). A person whose password
//                        must change (first sign-in, or after an admin's reset) lands on /set-password first.
//   setOwnPassword     — the signed-in person sets their own password and the must-change flag is cleared.
//   changePassword     — My profile → Change password.
// The 6-digit code door (actions.ts) stays in the code behind SIGN_IN_METHOD=code.
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { passwordHolds } from '@/core/db/probe';
import { serverDb } from '@/core/db/server';
import { serviceDb } from '@/core/db/service';
import { deviceLabel } from './device-label';
import { MUST_CHANGE, passwordOk } from './password-rules';
import { safeNext } from './safe-next';

export type PasswordError =
  | 'invalid_email'
  | 'not_listed'
  | 'switched_off'
  | 'wrong_password'
  | 'wrong_current'
  | 'rate_limited'
  | 'too_short'
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

  const check = await serviceDb().rpc('sign_in_check', { p_email: email, p_user_agent: ua ?? undefined });
  if (check.error) return { ok: false, error: 'unavailable' };
  if (check.data === 'not_listed' || check.data === 'switched_off') return { ok: false, error: check.data };
  if (check.data !== 'allowed') return { ok: false, error: 'unavailable' };

  const db = await serverDb();
  const signed = await db.auth.signInWithPassword({ email, password });
  if (signed.error || !signed.data.session) {
    const limited = signed.error?.status === 429 || /rate_limit/.test(signed.error?.code ?? '');
    return { ok: false, error: limited ? 'rate_limited' : 'wrong_password' };
  }
  const done = await db.rpc('sign_in_complete', {
    p_provider: 'email',
    p_device_label: deviceLabel(ua) ?? undefined,
    p_user_agent: ua ?? undefined,
  });
  if (done.error || done.data !== 'ok') {
    await db.auth.signOut({ scope: 'local' });
    const refused = done.data === 'not_listed' || done.data === 'switched_off' ? done.data : 'unavailable';
    return { ok: false, error: refused };
  }
  const target = safeNext(next);
  if (signed.data.session.user.app_metadata?.[MUST_CHANGE] === true)
    redirect(`/set-password?next=${encodeURIComponent(target)}`);
  redirect(target);
}

/** The signed-in person sets their own password (first sign-in or after a reset); the flag clears and they go on. */
export async function setOwnPassword(
  rawPassword: string,
  rawAgain: string,
  next: string | null,
): Promise<PasswordResult> {
  const password = String(rawPassword ?? '');
  if (!passwordOk(password)) return { ok: false, error: 'too_short' };
  if (password !== String(rawAgain ?? '')) return { ok: false, error: 'mismatch' };
  const db = await serverDb();
  const { data: who } = await db.auth.getUser();
  if (!who.user) return { ok: false, error: 'not_signed_in' };
  const changed = await db.auth.updateUser({ password });
  if (changed.error) return { ok: false, error: 'unavailable' };
  const cleared = await serviceDb().auth.admin.updateUserById(who.user.id, {
    app_metadata: { ...(who.user.app_metadata ?? {}), [MUST_CHANGE]: false },
  });
  if (cleared.error) return { ok: false, error: 'unavailable' };
  // The session's token carries the flag: a refresh brings the cleared one before the gate reads it again.
  await db.auth.refreshSession();
  redirect(safeNext(next));
}

/** My profile → Change password: the new password twice; the person stays signed in. */
/**
 * My profile → Change password: the current password is asked for and checked first (QA-92: an unlocked, signed-in
 * computer must not be enough to lock its person out), against Supabase Auth with a throwaway client that keeps no
 * session and touches no cookie; only then is the new one set for the signed-in person.
 */
export async function changePassword(
  rawCurrent: string,
  rawPassword: string,
  rawAgain: string,
): Promise<PasswordResult> {
  const password = String(rawPassword ?? '');
  if (!passwordOk(password)) return { ok: false, error: 'too_short' };
  if (password !== String(rawAgain ?? '')) return { ok: false, error: 'mismatch' };
  const db = await serverDb();
  const { data: who } = await db.auth.getUser();
  if (!who.user?.email) return { ok: false, error: 'not_signed_in' };
  const check = await passwordHolds(who.user.email, String(rawCurrent ?? ''));
  if (check !== 'ok') return { ok: false, error: check === 'wrong' ? 'wrong_current' : 'unavailable' };
  const changed = await db.auth.updateUser({ password });
  if (changed.error) return { ok: false, error: 'unavailable' };
  return { ok: true };
}
