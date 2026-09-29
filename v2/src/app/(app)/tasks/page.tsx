import { getTranslations } from 'next-intl/server';
import { DataState } from '@/ui/DataState';
import { PageHeader } from '@/ui/PageHeader';
import { Page } from '@/ui/shell/Page';

export default async function AreaPage() {
  const t = await getTranslations();
  return (
    <Page>
      <PageHeader title={t('nav.tasks')} />
      <DataState kind="empty" message={t('state.empty')} />
    </Page>
  );
}
