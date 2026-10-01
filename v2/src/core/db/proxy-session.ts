// What the proxy (src/proxy.ts) does on every page request (TECH-SPEC §4 step 7, V74):
//   · refreshes the session cookie when its access token is due (Supabase's SSR pattern — one client per request);
//   · sends a signed-out visitor to /sign-in?next=<the address>, so a deep link comes back to the same place — except
//     under /api, which answers 401 in JSON (W32);
//   · at most once an hour per browser, tells the database this device is still in use (api.device_touch); a device
//     idle for 30 days or signed out elsewhere goes to /auth/sign-out, which clears it and asks for a new code;
//   · hands the address to the (app) gate in the x-v2-path request header (a layout is not told its own path).
// The gate still calls api.me() before anything is drawn; this is the fast path, not the authority.
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from './database.types';
import { publishableKey, supabaseUrl } from './env';

export const PATH_HEADER = 'x-v2-path';
const AUTH_COOKIE = /^sb-.+-auth-token(\.\d+)?$/;
const TOUCH_COOKIE = 'v2_seen';
const TOUCH_EVERY_MS = 60 * 60 * 1000;

/** Pages anyone may open: the sign-in page and the auth routes (which check the session themselves). */
export function isPublicPath(path: string): boolean {
  return path === '/sign-in' || path.startsWith('/auth/');
}

/** An address under /api (W32). */
export function isApiPath(path: string): boolean {
  return path === '/api' || path.startsWith('/api/');
}

export async function updateSession(request: NextRequest): Promise<NextResponse> {
  const here = request.nextUrl.pathname + request.nextUrl.search;
  const forward = () => {
    const headers = new Headers(request.headers);
    headers.set(PATH_HEADER, here); // overwrites whatever a caller sent
    return NextResponse.next({ request: { headers } });
  };
  let response = forward();
  const hadSession = request.cookies.getAll().some((c) => AUTH_COOKIE.test(c.name) && c.value);

  const supabase = createServerClient<Database, 'api'>(supabaseUrl(), publishableKey(), {
    db: { schema: 'api' },
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(list, headers) {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = forward();
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
        for (const [key, value] of Object.entries(headers ?? {})) response.headers.set(key, value);
      },
    },
  });

  // Verifies the access token (and refreshes it when due). Nothing may run between creating the client and this call.
  const { data } = await supabase.auth.getClaims();
  const signedIn = !!data?.claims;
  const path = request.nextUrl.pathname;

  if (!signedIn) {
    if (isPublicPath(path)) return response;
    // W32: an /api address is for a program, not a person: it is told it is not signed in, in JSON, never redirected.
    if (isApiPath(path)) {
      return NextResponse.json(
        { ok: false, error: { kind: 'PermissionDenied', key: 'auth.not_signed_in' } },
        { status: 401, headers: { 'cache-control': 'no-store' } },
      );
    }
    // A session cookie Supabase no longer accepts (signed out elsewhere, banned): /auth/sign-out asks the database
    // why, so the sign-in page can say it; with no cookie at all, straight to the sign-in page.
    const to = hadSession ? '/auth/sign-out' : '/sign-in';
    return redirectWith(request, response, `${to}?next=${encodeURIComponent(here)}`);
  }

  if (!isPublicPath(path)) {
    const last = Number(request.cookies.get(TOUCH_COOKIE)?.value ?? 0);
    if (!(Date.now() - last < TOUCH_EVERY_MS)) {
      const { data: state } = await supabase.rpc('device_touch');
      if (state === 'signed_out') {
        return redirectWith(request, response, `/auth/sign-out?next=${encodeURIComponent(here)}`);
      }
      if (state === 'ok') {
        response.cookies.set(TOUCH_COOKIE, String(Date.now()), {
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
          secure: request.nextUrl.protocol === 'https:',
        });
      }
    }
  }
  return response;
}

/** A redirect that keeps the refreshed session cookies and the no-cache headers of the response it replaces. */
function redirectWith(request: NextRequest, from: NextResponse, to: string): NextResponse {
  const redirect = NextResponse.redirect(new URL(to, request.url));
  for (const cookie of from.cookies.getAll()) redirect.cookies.set(cookie);
  for (const key of ['cache-control', 'expires', 'pragma']) {
    const value = from.headers.get(key);
    if (value) redirect.headers.set(key, value);
  }
  return redirect;
}
