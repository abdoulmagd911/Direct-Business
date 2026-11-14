import { getTranslations } from 'next-intl/server';
import { DataState } from '@/ui/DataState';
import { Page } from '@/ui/shell/Page';

/**
 * FIX-45: the Suppliers list renders through the same page component and the same reads as Partners, so a slow
 * navigation shows the same stale old list here. While it renders, the page says it is loading. Presentation only.
 */
export default async function SuppliersLoading() {
  const t = await getTranslations();
  return (
    <Page bare>
      <DataState kind="loading" message={t('common.loading')} />
    </Page>
  );
}
