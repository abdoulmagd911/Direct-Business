import { getTranslations } from 'next-intl/server';
import { DataState } from '@/ui/DataState';
import { PageHeader } from '@/ui/PageHeader';
import { Page } from '@/ui/shell/Page';
import { pageTitle } from '@/ui/shell/page-title';

export const generateMetadata = pageTitle('nav.overview');

export default async function AreaPage() {
  const t = await getTranslations();
  return (
    <Page page="overview" title={t('nav.overview')}>
      <PageHeader title={t('nav.overview')} />
      <DataState kind="empty" message={t('pages.empty.overview')} />
    </Page>
  );
}
