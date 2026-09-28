import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import type { ReactNode } from 'react';
import { getMe } from '@/core/auth/me';
import { MeProvider } from '@/core/auth/MeProvider';
import { AppShell } from '@/ui/shell/AppShell';

export const dynamic = 'force-dynamic';

/**
 * The server gate (A5): `me` is resolved before any app page paints. Nobody signed in → the sign-in
 * page, which returns to the same address afterwards. Builder A's P3-2 fills getMe().
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const me = await getMe();
  if (!me) {
    const h = await headers();
    const next = h.get('x-invoke-path') ?? h.get('next-url') ?? '/my-day';
    redirect(`/sign-in?next=${encodeURIComponent(next)}`);
  }
  return (
    <MeProvider me={me}>
      <AppShell>{children}</AppShell>
    </MeProvider>
  );
}
