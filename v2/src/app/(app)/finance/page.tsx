import { getTranslations } from 'next-intl/server';
import { DataState } from '@/ui/DataState';
import { PageHeader } from '@/ui/PageHeader';
import { Page } from '@/ui/shell/Page';

export default async function AreaPage() {
  const t = await getTranslations();
  return (
    <Page page="finance" title={t('nav.finance')}>
      <PageHeader title={t('nav.finance')} />
      <DataState kind="empty" message={t('state.empty')} />
    </Page>
  );
}
