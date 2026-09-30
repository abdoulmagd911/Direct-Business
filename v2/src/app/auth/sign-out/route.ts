import { NextResponse, type NextRequest } from 'next/server';
import { getMe } from '@/core/auth/get-me';
import { refusalOf } from '@/core/auth/me';
import { CHANGE_PASSWORD_PATH } from '@/core/auth/password';
import { safeNext } from '@/core/auth/safe-next';
import { serverDb } from '@/core/db/server';

// Signing out (TECH-SPEC §4, V74).
//   POST — the person's own "Sign out": this device is marked signed out and its Supabase session deleted (so its
//          refresh token dies), then the browser's cookies are cleared.
//   GET  — where the gate sends a session the database refuses: it asks api.me() itself and clears the cookies only
//          when the answer is a refusal, so a stray link can never sign a valid session out. Then the sign-in page,
//          with the reason and the address to come back to.

export async function POST(request: NextRequest) {
  const db = await serverDb();
  await db.rpc('device_sign_out', {}); // already signed out, or no device: nothing to mark
  await db.auth.signOut({ scope: 'local' });
  return NextResponse.redirect(new URL('/sign-in', request.url), 303);
}

export async function GET(request: NextRequest) {
  const next = safeNext(request.nextUrl.searchParams.get('next'));
  const me = await getMe();
  if (me?.status === 'ok') return NextResponse.redirect(new URL(next, request.url));
  // A password to change is no refusal (V166): the session stays, and the person is sent to change it.
  if (me?.status === 'must_change_password')
    return NextResponse.redirect(new URL(`${CHANGE_PASSWORD_PATH}?${new URLSearchParams({ next })}`, request.url));
  const params = new URLSearchParams({ next });
  const reason = me ? refusalOf(me) : null;
  if (reason) params.set('reason', reason);
  // Refused, or a token nobody accepts any more: the browser's copy is cleared (nothing valid is ever cleared here).
  const db = await serverDb();
  await db.auth.signOut({ scope: 'local' });
  return NextResponse.redirect(new URL(`/sign-in?${params}`, request.url));
}
