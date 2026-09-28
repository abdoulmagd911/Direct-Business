import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { getMe } from '@/core/auth/get-me';
import { MeProvider } from '@/core/auth/me-context';
import { PATH_HEADER } from '@/core/db/proxy-session';

// The gate (A5, TECH-SPEC §4 step 7): api.me() is answered before anything inside is drawn. No session → the sign-in
// page, then back to this address; a refused session (not listed, switched off, device signed out or idle for 30
// days) → /auth/sign-out, which clears it and shows why. Nothing below renders for anyone but an allowed person.
export default async function AppLayout({ children }: { children: ReactNode }) {
  const [me, h] = await Promise.all([getMe(), headers()]);
  const here = h.get(PATH_HEADER) ?? '/';
  if (!me) redirect(`/sign-in?next=${encodeURIComponent(here)}`);
  if (me.status !== 'ok') redirect(`/auth/sign-out?next=${encodeURIComponent(here)}`);
  return <MeProvider me={me}>{children}</MeProvider>;
}
