import { getTranslations } from 'next-intl/server';
import { DataState } from '@/ui/DataState';
import { Page } from '@/ui/shell/Page';

/**
 * FIX-45: a slow navigation used to show the stale old list with no sign anything was happening (F109: the tester
 * read the wait as a stuck preview card). While the list is rendering, the page now says it is loading.
 * Presentation only — it changes no timing. L24: scoped to the list only via the (list) route group, so a missing
 * record still answers a real 404 instead of streaming this frame first with a 200.
 */
export default async function PartnersLoading() {
  const t = await getTranslations();
  return (
    <Page bare>
      <DataState kind="loading" message={t('common.loading')} />
    </Page>
  );
}
