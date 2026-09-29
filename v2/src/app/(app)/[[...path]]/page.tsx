import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { requireMe } from '@/core/auth/require-me';
import { getAppSettings } from '@/core/settings/app';
import { DataState } from '@/ui/DataState';
import { PageHeader } from '@/ui/PageHeader';
import { navFor } from '@/ui/shell/nav';
import { Page } from '@/ui/shell/Page';

/** The root goes to the person's start page: their own choice, else the admin's default, else My day (ACC-091). */
export async function startRoute(): Promise<string> {
  const [me, app] = await Promise.all([requireMe(), getAppSettings()]);
  const entries = navFor(me);
  for (const key of [me.profile?.start_page, app.default_start_page]) {
    const entry = key ? entries.find((e) => e.page === key) : undefined;
    if (entry) return entry.route;
  }
  return '/my-day';
}

// The root goes to the start page. Every other signed-in address the modules have not built yet (their own pages win
// over this one) gets the shell, the address as the title and an honest empty state — so a deep link can be seen to
// come back (P3-2's specs).
export default async function Placeholder({ params }: { params: Promise<{ path?: string[] }> }) {
  const { path } = await params;
  if (!path?.length) redirect(await startRoute());
  const t = await getTranslations();
  return (
    <Page>
      <PageHeader title={`/${(path ?? []).join('/')}`} />
      <DataState kind="empty" message={t('state.empty')} />
    </Page>
  );
}
