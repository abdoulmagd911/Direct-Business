import { getTranslations } from 'next-intl/server';
import { DataState } from '@/ui/DataState';
import { PageHeader } from '@/ui/PageHeader';
import { Page } from '@/ui/shell/Page';
import { pageTitle } from '@/ui/shell/page-title';

export const generateMetadata = pageTitle('nav.appraisal');

export default async function AreaPage() {
  const t = await getTranslations();
  return (
    <Page page="appraisal" title={t('nav.appraisal')}>
      <PageHeader title={t('nav.appraisal')} />
      <DataState kind="empty" message={t('pages.empty.appraisal')} />
    </Page>
  );
}
