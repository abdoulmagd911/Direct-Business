import { getTranslations } from 'next-intl/server';
import { DataState } from '@/ui/DataState';
import { PageHeader } from '@/ui/PageHeader';
import { Page } from '@/ui/shell/Page';

/** Settings groups: My profile first, then the six groups — built in P3-5. */
export default async function SettingsGroupPage({ params }: { params: Promise<{ group: string }> }) {
  const { group } = await params;
  const t = await getTranslations();
  const title = group === 'profile' ? t('pages.settings.myProfile') : t('nav.settings');
  return (
    <Page>
      <PageHeader crumbs={[{ label: t('nav.settings'), href: '/settings' }]} title={title} />
      <DataState kind="empty" message={t('state.empty')} />
    </Page>
  );
}
