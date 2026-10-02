import { cookies } from 'next/headers';
import type { ReactNode } from 'react';
import { MeProvider } from '@/core/auth/me-context';
import { requireMe } from '@/core/auth/require-me';
import { prefsFrom } from '@/core/prefs';
import { effectivePrefs } from '@/core/prefs/effective';
import { getAppSettings } from '@/core/settings/app';
import { AppShell } from '@/ui/shell/AppShell';
import { PrefsSync } from '@/ui/shell/PrefsSync';

export const dynamic = 'force-dynamic';

// Only an allowed person gets the shell (P3-3) and its pages: the gate is core/auth/require-me.ts (A5).
export default async function AppLayout({ children }: { children: ReactNode }) {
  const [me, app, store] = await Promise.all([requireMe(), getAppSettings(), cookies()]);
  const prefs = effectivePrefs(
    me,
    app,
    prefsFrom((n) => store.get(n)?.value),
  );
  return (
    <MeProvider me={me}>
      <PrefsSync {...prefs} />
      <AppShell>{children}</AppShell>
    </MeProvider>
  );
}
