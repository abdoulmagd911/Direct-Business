import { cookies } from 'next/headers';
import type { ReactNode } from 'react';
import { getMe } from '@/core/auth/get-me';
import { MeProvider } from '@/core/auth/me-context';
import { requireMe } from '@/core/auth/require-me';
import { DbError } from '@/core/db/errors';
import { prefsFrom } from '@/core/prefs';
import { effectivePrefs } from '@/core/prefs/effective';
import { getAppSettings } from '@/core/settings/app';
import { AppShell } from '@/ui/shell/AppShell';
import { LayoutTransient } from '@/ui/shell/LayoutTransient';
import { PrefsSync } from '@/ui/shell/PrefsSync';

export const dynamic = 'force-dynamic';

// Only an allowed person gets the shell (P3-3) and its pages: the gate is core/auth/require-me.ts (A5).
export default async function AppLayout({ children }: { children: ReactNode }) {
  // The person read is the one that fails transiently (the gateway holds it and gives up, F131/F163): probe it
  // first, so a transient failure renders a retryable state here instead of throwing the whole page to the root
  // crash page. getMe is cached per request, so requireMe below reuses this read — it is not a second call.
  // "No session" is not a failure: getMe returns null for it and requireMe redirects to sign-in, as before.
  try {
    await getMe();
  } catch (e) {
    if (e instanceof DbError && e.kind === 'Unavailable') return <LayoutTransient />;
    throw e;
  }
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
