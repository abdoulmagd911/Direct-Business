import type { ReactNode } from 'react';
import { MeProvider } from '@/core/auth/me-context';
import { requireMe } from '@/core/auth/require-me';
import { AppShell } from '@/ui/shell/AppShell';

export const dynamic = 'force-dynamic';

// Only an allowed person gets the shell (P3-3) and its pages: the gate is core/auth/require-me.ts (A5).
export default async function AppLayout({ children }: { children: ReactNode }) {
  const me = await requireMe();
  return (
    <MeProvider me={me}>
      <AppShell>{children}</AppShell>
    </MeProvider>
  );
}
