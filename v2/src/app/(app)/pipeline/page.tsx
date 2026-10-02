import { getTranslations } from 'next-intl/server';
import { DataState } from '@/ui/DataState';
import { PageHeader } from '@/ui/PageHeader';
import { Page } from '@/ui/shell/Page';
import { pageTitle } from '@/ui/shell/page-title';

export const generateMetadata = pageTitle('nav.pipeline');

export default async function AreaPage() {
  const t = await getTranslations();
  return (
    <Page page="pipeline" title={t('nav.pipeline')}>
      <PageHeader title={t('nav.pipeline')} />
      <DataState kind="empty" message={t('pages.beingBuilt')} />
    </Page>
  );
}
