import { getTranslations } from 'next-intl/server';
import { DataState } from '@/ui/DataState';
import { PageHeader } from '@/ui/PageHeader';
import { Page } from '@/ui/shell/Page';
import { pageTitle } from '@/ui/shell/page-title';

export const generateMetadata = pageTitle('nav.reports');

export default async function AreaPage() {
  const t = await getTranslations();
  return (
    <Page page="reports" title={t('nav.reports')}>
      <PageHeader title={t('nav.reports')} />
      <DataState kind="empty" message={t('pages.empty.reports')} />
    </Page>
  );
}
