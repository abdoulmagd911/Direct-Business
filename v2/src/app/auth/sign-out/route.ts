import { NextResponse, type NextRequest } from 'next/server';
import { getMe } from '@/core/auth/get-me';
import { refusalOf } from '@/core/auth/me';
import { CHANGE_PASSWORD_PATH } from '@/core/auth/password';
import { safeNext, sitePath } from '@/core/auth/safe-next';
import { serverDb } from '@/core/db/server';

// Signing out (TECH-SPEC §4, V74).
//   POST — the person's own "Sign out": this device is marked signed out and its Supabase session deleted (so its
//          refresh token dies), then the browser's cookies are cleared.
//   GET  — where the gate sends a session the database refuses: it asks api.me() itself and clears the cookies only
//          when the answer is a refusal, so a stray link can never sign a valid session out. Then the sign-in page,
//          with the reason and the address to come back to.

export async function POST() {
  const db = await serverDb();
  await db.rpc('device_sign_out', {}); // already signed out, or no device: nothing to mark
  await db.auth.signOut({ scope: 'local' });
  return goTo('/sign-in', 303);
}

export async function GET(request: NextRequest) {
  const next = safeNext(request.nextUrl.searchParams.get('next'));
  const me = await getMe();
  if (me?.status === 'ok') return goTo(next);
  // A password to change is no refusal (V166): the session stays, and the person is sent to change it.
  if (me?.status === 'must_change_password') return goTo(`${CHANGE_PASSWORD_PATH}?${new URLSearchParams({ next })}`);
  const params = new URLSearchParams({ next });
  const reason = me ? refusalOf(me) : null;
  if (reason) params.set('reason', reason);
  // A request the browser makes in the background — the router prefetching a link, or fetching a page's data — only
  // follows the refusal: clearing the session there would sign the browser out unseen, and the person's next real visit
  // would arrive with no session and never be told why. That visit asks again, and clears it.
  if (isBackground(request)) return goTo(`/sign-in?${params}`);
  // Refused, or a token nobody accepts any more: the browser's copy is cleared (nothing valid is ever cleared here).
  const db = await serverDb();
  await db.auth.signOut({ scope: 'local' });
  return goTo(`/sign-in?${params}`);
}

/**
 * A redirect to a path on this site, as a relative Location the browser resolves against the address it is on (QA-561).
 * Under `next start` request.url names the host the server listens on (localhost), not the one the browser asked
 * for, so an absolute Location built from it sent the person to another origin, and the page's
 * CSP (`form-action 'self'`) blocked the Sign out form's redirect: the session ended on the server, but the screen and
 * its data stayed.
 */
function goTo(path: string, status: 303 | 307 = 307): NextResponse {
  // resolved and percent-encoded (a header holds no Arabic letters); a path that would leave the site — one resolving
  // to "//host" — goes home instead (QA-562)
  return new NextResponse(null, { status, headers: { Location: sitePath(path) ?? '/' } });
}

/** The router's own fetches (a prefetch, a page's data) carry these; a visit to the address does not. */
function isBackground(request: NextRequest): boolean {
  return (
    request.headers.get('next-router-prefetch') === '1' ||
    request.headers.get('rsc') === '1' ||
    request.nextUrl.searchParams.has('_rsc')
  );
}
