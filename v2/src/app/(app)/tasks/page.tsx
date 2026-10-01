import { getTranslations } from 'next-intl/server';
import { DataState } from '@/ui/DataState';
import { PageHeader } from '@/ui/PageHeader';
import { Page } from '@/ui/shell/Page';
import { pageTitle } from '@/ui/shell/page-title';

export const generateMetadata = pageTitle('nav.tasks');

export default async function AreaPage() {
  const t = await getTranslations();
  return (
    <Page page="tasks" title={t('nav.tasks')}>
      <PageHeader title={t('nav.tasks')} />
      <DataState kind="empty" message={t('pages.empty.tasks')} />
    </Page>
  );
}
