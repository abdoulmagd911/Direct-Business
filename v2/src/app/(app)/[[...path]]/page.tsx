import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { DataState } from '@/ui/DataState';
import { PageHeader } from '@/ui/PageHeader';
import { Page } from '@/ui/shell/Page';

// The root goes to My day (the start page — profile.start_page follows in P3-5). Every other signed-in address the
// modules have not built yet (their own pages win over this one) gets the shell, the address as the title and an honest
// empty state — so a deep link can be seen to come back (P3-2's specs).
export default async function Placeholder({ params }: { params: Promise<{ path?: string[] }> }) {
  const { path } = await params;
  if (!path?.length) redirect('/my-day');
  const t = await getTranslations();
  return (
    <Page>
      <PageHeader title={`/${(path ?? []).join('/')}`} />
      <DataState kind="empty" message={t('state.empty')} />
    </Page>
  );
}
