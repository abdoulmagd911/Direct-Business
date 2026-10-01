import { getTranslations } from 'next-intl/server';
import { DataState } from '@/ui/DataState';
import { PageHeader } from '@/ui/PageHeader';
import { Page } from '@/ui/shell/Page';

export default async function AreaPage() {
  const t = await getTranslations();
  return (
    <Page page="kpis" title={t('nav.kpis')}>
      <PageHeader title={t('nav.kpis')} />
      <DataState kind="empty" message={t('pages.empty.kpis')} />
    </Page>
  );
}
