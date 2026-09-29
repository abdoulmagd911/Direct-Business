import 'server-only';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { PATH_HEADER } from '@/core/db/proxy-session';
import { getMe } from './get-me';
import type { Me } from './me';
import { CHANGE_PASSWORD_PATH } from './password';

/**
 * The gate (A5, TECH-SPEC §4 step 7): api.me() is answered before anything inside the app is drawn. No session → the
 * sign-in page, then back to this address; a refused session (not listed, switched off, device signed out or idle for
 * 30 days) → /auth/sign-out, which clears it and says why. The layout awaits it for the shell, and every screen's
 * `Page` awaits it too — Next draws a page and its layout side by side, so the layout alone could not keep a refused
 * person's page out of the reply. One api.me() per request (getMe is cached).
 */
export async function requireMe(): Promise<Me> {
  const [me, h] = await Promise.all([getMe(), headers()]);
  const here = h.get(PATH_HEADER) ?? '/';
  if (!me) redirect(`/sign-in?next=${encodeURIComponent(here)}`);
  // A password an admin set is changed first (V166): the session is kept, and nothing else is drawn.
  if (me.status === 'must_change_password') redirect(`${CHANGE_PASSWORD_PATH}?next=${encodeURIComponent(here)}`);
  if (me.status !== 'ok') redirect(`/auth/sign-out?next=${encodeURIComponent(here)}`);
  return me;
}
