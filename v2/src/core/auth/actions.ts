'use server';

// The two steps of the emailed-code door (TECH-SPEC §4 step 3, V59), run on the server:
//   sendCode   — is this email allowed? (api.sign_in_check, with the secret key; a refusal is logged with its reason)
//                then Supabase emails a 6-digit code, never creating a user (sign-ups are off; shouldCreateUser false).
//   verifyCode — Supabase checks the code and sets the session cookie; api.sign_in_complete, as the new session, logs
//                the sign-in and registers this device (V74), or refuses and the session is ended at once.
// Refusals come back as keys of the catalog's sign_in.error.*; nothing here trusts the browser to decide access.
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { serverDb } from '@/core/db/server';
import { serviceDb } from '@/core/db/service';
import { deviceLabel } from './device-label';
import { safeNext } from './safe-next';

export type SignInError =
  'invalid_email' | 'not_listed' | 'switched_off' | 'rate_limited' | 'code_expired' | 'code_invalid' | 'unavailable';

export type SendCodeResult = { ok: true; email: string } | { ok: false; error: SignInError };
export type VerifyCodeResult = { ok: false; error: SignInError };

/** How long a code lives (seconds) — the same as [auth.email] otp_expiry in supabase/config.toml and on the project. */
const CODE_LIFETIME_S = 600;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function userAgent(): Promise<string | null> {
  return (await headers()).get('user-agent');
}

export async function sendCode(rawEmail: string): Promise<SendCodeResult> {
  const email = String(rawEmail ?? '')
    .trim()
    .toLowerCase();
  if (!EMAIL.test(email) || email.length > 254) return { ok: false, error: 'invalid_email' };
  const ua = await userAgent();

  const check = await serviceDb().rpc('sign_in_check', { p_email: email, p_user_agent: ua ?? undefined });
  if (check.error) return { ok: false, error: 'unavailable' };
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
  redirect(safeNext(next));
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
