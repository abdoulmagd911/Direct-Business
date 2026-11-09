import { getTranslations } from 'next-intl/server';
import { DataState } from '@/ui/DataState';
import { Page } from '@/ui/shell/Page';

/**
 * FIX-45: a slow navigation used to show the stale old list with no sign anything was happening (F109: the tester
 * read the wait as a stuck preview card). While the list or a record is rendering, the page now says it is loading.
 * Presentation only — it changes no timing.
 */
export default async function ClientsLoading() {
  const t = await getTranslations();
  return (
    <Page bare>
      <DataState kind="loading" message={t('common.loading')} />
    </Page>
  );
}
