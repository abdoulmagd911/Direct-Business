// Next.js runs this before every page request (the file convention that replaced `middleware`). The work is in
// src/core/db/proxy-session.ts, where the one-client rule allows a Supabase client (A4).
import type { NextRequest } from 'next/server';
import { updateSession } from '@/core/db/proxy-session';

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Everything except Next's own assets and plain files (images, fonts, icons, robots.txt …).
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|woff2?|txt)$).*)'],
};
