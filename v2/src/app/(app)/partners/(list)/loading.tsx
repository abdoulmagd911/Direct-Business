import { getTranslations } from 'next-intl/server';
import { ListSkeleton } from '@/modules/partners/list/ListSkeleton';
import { Page } from '@/ui/shell/Page';

/**
 * FIX-45: a slow navigation used to show the stale old list with no sign anything was happening (F109: the tester
 * read the wait as a stuck preview card). While the list is rendering, the page now says it is loading — Landing 31:
 * as the list's own shapes (title, cards, rows) in the look's shimmer. Presentation only — it changes no timing.
 * L24: scoped to the list only via the (list) route group, so a missing record still answers a real 404 instead of
 * streaming this frame first with a 200.
 */
export default async function PartnersLoading() {
  const t = await getTranslations();
  return (
    <Page>
      <ListSkeleton label={t('common.loading')} />
    </Page>
  );
}
