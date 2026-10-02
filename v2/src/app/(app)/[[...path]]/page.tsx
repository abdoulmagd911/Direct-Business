import { notFound, redirect } from 'next/navigation';
import { accountOf } from '@/core/auth/account';
import { requireMe } from '@/core/auth/require-me';
import { getAppSettings } from '@/core/settings/app';
import { navFor } from '@/ui/shell/nav';

/**
 * The root goes to the person's start page: their own choice, else the admin's default, else My day (ACC-091). The
 * owner's admin account is no team member and has no day of work (V444, W1): it starts on Settings.
 */
export async function startRoute(): Promise<string> {
  const [me, app] = await Promise.all([requireMe(), getAppSettings()]);
  if ((await accountOf(me.person.id)) === 'admin_account') return '/settings';
  const entries = navFor(me);
  for (const key of [me.profile?.start_page, app.default_start_page]) {
    const entry = key ? entries.find((e) => e.page === key) : undefined;
    if (entry) return entry.route;
  }
  return '/my-day';
}

// The root goes to the start page. Every other signed-in address the modules have not built (their own pages win over
// this one) is Not found, answered with status 404 (W32): ../not-found.tsx draws it inside the shell — never a raw path
// as a title (W28); the top bar still carries the address, so a deep link can be seen to come back (P3-2's specs).
export default async function Placeholder({ params }: { params: Promise<{ path?: string[] }> }) {
  const { path } = await params;
  if (!path?.length) redirect(await startRoute());
  notFound();
}
