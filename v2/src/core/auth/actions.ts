'use server';

// The sign-in doors, run on the server (TECH-SPEC §4; V59 as amended by V166 — e-mail and password, no e-mail sent):
//   signInWithPassword — is this email allowed? (api.sign_in_password_check, with the secret key; a refusal is logged)
//                then Supabase checks the password and sets the session cookie; api.sign_in_complete, as the new
//                session, logs the sign-in and registers this device (V74), or refuses and the session is ended. A
//                password an admin set must be changed first: the sign-in goes to CHANGE_PASSWORD_PATH.
//   changePassword — the signed-in person's new password: checked here (10 characters at least), taken by Auth, then
//                recorded by the server (api.password_changed, secret key only — the browser never clears its flag).
//   sendCode / verifyCode — the emailed-code door, off unless an admin switches auth.code_door_enabled on: Supabase emails a
//                6-digit code (never creating a user; sign-ups are off), then checks it.
//   signInMethods — which doors the sign-in page offers.
// Refusals come back as keys of the catalog's sign_in.error.*; nothing here trusts the browser to decide access.
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { serverDb } from '@/core/db/server';
import { serviceDb } from '@/core/db/service';
import { deviceLabel } from './device-label';
import { CHANGE_PASSWORD_PATH, passwordProblem, type PasswordProblem } from './password';
import { safeNext } from './safe-next';

export type SignInError =
  | 'invalid_email'
  | 'not_listed'
  | 'switched_off'
  | 'rate_limited'
  | 'code_expired'
  | 'code_invalid'
  | 'code_off'
  | 'wrong_password'
  | 'unavailable';

export type SendCodeResult = { ok: true; email: string } | { ok: false; error: SignInError };
export type VerifyCodeResult = { ok: false; error: SignInError };
export type PasswordSignInResult = { ok: false; error: SignInError };
export type ChangePasswordError = PasswordProblem | 'same_password' | 'not_signed_in' | 'unavailable';
export type ChangePasswordResult = { ok: false; error: ChangePasswordError };

/** How long a code lives (seconds) — the same as [auth.email] otp_expiry in supabase/config.toml and on the project. */
const CODE_LIFETIME_S = 600;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function userAgent(): Promise<string | null> {
  return (await headers()).get('user-agent');
}

/** The doors the sign-in page offers: the password always; the emailed code only when an admin switched it on. */
export async function signInMethods(): Promise<{ password: boolean; code: boolean }> {
  const { data, error } = await serviceDb().rpc('sign_in_methods');
  const methods = data as { password?: boolean; code?: boolean } | null;
  if (error || !methods) return { password: true, code: false };
  return { password: methods.password !== false, code: methods.code === true };
}

/** After a door let the session in: the database completes the sign-in, and where the person goes next. */
async function complete(next: string | null, ua: string | null): Promise<{ ok: false; error: SignInError }> {
  const db = await serverDb();
  const done = await db.rpc('sign_in_complete', {
    p_provider: 'email',
    p_device_label: deviceLabel(ua) ?? undefined,
    p_user_agent: ua ?? undefined,
  });
  if (!done.error && done.data === 'must_change_password')
    redirect(`${CHANGE_PASSWORD_PATH}?next=${encodeURIComponent(safeNext(next))}`);
  if (done.error || done.data !== 'ok') {
    await db.auth.signOut({ scope: 'local' });
    const refused =
      done.data === 'not_listed' || done.data === 'switched_off' || done.data === 'code_off'
        ? done.data
        : 'unavailable';
    return { ok: false, error: refused };
  }
  redirect(safeNext(next));
}

export async function signInWithPassword(
  rawEmail: string,
  rawPassword: string,
  next: string | null,
): Promise<PasswordSignInResult> {
  const email = String(rawEmail ?? '')
    .trim()
    .toLowerCase();
  const password = String(rawPassword ?? '');
  if (!EMAIL.test(email) || email.length > 254) return { ok: false, error: 'invalid_email' };
  if (!password) return { ok: false, error: 'wrong_password' };
  const ua = await userAgent();

  const check = await serviceDb().rpc('sign_in_password_check', { p_email: email, p_user_agent: ua ?? undefined });
  if (check.error) return { ok: false, error: 'unavailable' };
  if (check.data !== 'allowed')
    return {
      ok: false,
      error: check.data === 'not_listed' || check.data === 'switched_off' ? check.data : 'unavailable',
    };

  const db = await serverDb();
  const signed = await db.auth.signInWithPassword({ email, password });
  if (signed.error || !signed.data.session) {
    const code = signed.error?.code ?? '';
    await serviceDb().rpc('sign_in_password_refused', {
      p_email: email,
      p_detail: code || signed.error?.message || 'no_session',
      p_user_agent: ua ?? undefined,
    });
    if (signed.error?.status === 429 || /rate_limit/.test(code)) return { ok: false, error: 'rate_limited' };
    if (code === 'invalid_credentials') return { ok: false, error: 'wrong_password' };
    if (code === 'user_banned') return { ok: false, error: 'switched_off' };
    return { ok: false, error: 'unavailable' };
  }
  return complete(next, ua);
}

export async function changePassword(rawPassword: string, next: string | null): Promise<ChangePasswordResult> {
  const db = await serverDb();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return { ok: false, error: 'not_signed_in' };
  const me = await db.rpc('me');
  const status = (me.data as { status?: string } | null)?.status;
  if (me.error || (status !== 'ok' && status !== 'must_change_password')) return { ok: false, error: 'not_signed_in' };

  const password = String(rawPassword ?? '');
  const problem = passwordProblem(password, user.email);
  if (problem) return { ok: false, error: problem };
  const updated = await db.auth.updateUser({ password });
  if (updated.error) {
    const code = updated.error.code ?? '';
    if (code === 'same_password') return { ok: false, error: 'same_password' };
    if (code === 'weak_password') return { ok: false, error: 'too_short' };
    return { ok: false, error: 'unavailable' };
  }
  const recorded = await serviceDb().rpc('password_changed', { p_auth_user: user.id });
  if (recorded.error) return { ok: false, error: 'unavailable' };
  redirect(safeNext(next));
}

export async function sendCode(rawEmail: string): Promise<SendCodeResult> {
  const email = String(rawEmail ?? '')
    .trim()
    .toLowerCase();
  if (!EMAIL.test(email) || email.length > 254) return { ok: false, error: 'invalid_email' };
  const ua = await userAgent();

  const check = await serviceDb().rpc('sign_in_check', { p_email: email, p_user_agent: ua ?? undefined });
  if (check.error) return { ok: false, error: 'unavailable' };
  if (check.data === 'code_off') return { ok: false, error: 'code_off' };
  if (check.data === 'not_listed' || check.data === 'switched_off') return { ok: false, error: check.data };
  if (check.data !== 'allowed') return { ok: false, error: 'unavailable' };

  const db = await serverDb();
  const { error } = await db.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
  if (error) {
    const limited = error.status === 429 || /rate_limit/.test(error.code ?? '');
    await logEvent(email, 'provider_error', `${error.code ?? error.status ?? ''} ${error.message}`.trim(), ua);
    return { ok: false, error: limited ? 'rate_limited' : 'unavailable' };
  }
  return { ok: true, email };
}

/**
 * @param sentAt when the browser last asked for a code (ms since epoch) — tells "expired" from "wrong", which Supabase
 *   reports alike; it only chooses the wording and the log's reason, never whether the code is accepted.
 */
export async function verifyCode(
  rawEmail: string,
  rawCode: string,
  next: string | null,
  sentAt: number,
): Promise<VerifyCodeResult> {
  const email = String(rawEmail ?? '')
    .trim()
    .toLowerCase();
  const code = String(rawCode ?? '').replace(/\D/g, '');
  if (!EMAIL.test(email)) return { ok: false, error: 'invalid_email' };
  const ua = await userAgent();
  const late = Number.isFinite(sentAt) && Date.now() - sentAt > CODE_LIFETIME_S * 1000;
  if (code.length !== 6) return { ok: false, error: 'code_invalid' };

  const db = await serverDb();
  const verified = await db.auth.verifyOtp({ email, token: code, type: 'email' });
  if (verified.error || !verified.data.session) {
    const reason = late ? 'code_expired' : 'code_invalid';
    await logEvent(email, reason, verified.error?.code ?? verified.error?.message ?? null, ua);
    return { ok: false, error: reason };
  }
  return complete(next, ua);
}

async function logEvent(
  email: string,
  result: 'code_expired' | 'code_invalid' | 'provider_error',
  detail: string | null,
  ua: string | null,
) {
  await serviceDb().rpc('sign_in_event', {
    p_email: email,
    p_result: result,
    p_detail: detail ?? undefined,
    p_user_agent: ua ?? undefined,
    p_provider: 'email',
  });
}
