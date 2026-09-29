import { getTranslations } from 'next-intl/server';
import { DataState } from '@/ui/DataState';
import { PageHeader } from '@/ui/PageHeader';
import { Page } from '@/ui/shell/Page';

const GROUPS = ['profile', 'org', 'partners', 'performance', 'finance', 'work', 'app'] as const;

/** Settings groups: My profile first, then the groups the registry declares — their forms come in P3-5. */
export default async function SettingsGroupPage({ params }: { params: Promise<{ group: string }> }) {
  const { group } = await params;
  const t = await getTranslations();
  const known = (GROUPS as readonly string[]).includes(group);
  const title = known ? t(`nav.settings.${group}`) : group === 'activity' ? t('nav.activity') : t('nav.settings_home');
  return (
    <Page>
      <PageHeader crumbs={[{ label: t('nav.settings_home'), href: '/settings' }]} title={title} />
      <DataState kind="empty" message={t('state.empty')} />
    </Page>
  );
}
