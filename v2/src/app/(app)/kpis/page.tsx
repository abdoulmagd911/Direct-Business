import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { DataState } from '@/ui/DataState';
import { PageHeader } from '@/ui/PageHeader';
import { Page } from '@/ui/shell/Page';

/** KPIs: the page itself is still being built; Achievements (GC-4, V377) is reached from here. */
export default async function AreaPage() {
  const t = await getTranslations();
  return (
    <Page page="kpis" title={t('nav.kpis')}>
      <PageHeader
        title={t('nav.kpis')}
        actions={
          <Link
            href="/kpis/achievements"
            className="inline-flex h-[var(--control-h)] items-center rounded-md border border-border-strong bg-raised px-4 text-base font-medium text-text hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            data-achievements-link
          >
            {t('pages.achievements.title')}
          </Link>
        }
      />
      <DataState kind="empty" message={t('pages.beingBuilt')} />
    </Page>
  );
}
