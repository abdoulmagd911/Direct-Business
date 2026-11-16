import { getTranslations } from 'next-intl/server';
import { ListSkeleton } from '@/modules/partners/list/ListSkeleton';
import { Page } from '@/ui/shell/Page';

/**
 * FIX-45: the Suppliers list renders through the same page component and the same reads as Partners, so a slow
 * navigation shows the same stale old list here. While the list renders, the page says it is loading — Landing 31:
 * as the list's own shapes in the look's shimmer. Presentation only. L24: scoped to the list only via the (list)
 * route group, so a missing record still answers a real 404 instead of streaming this frame first with a 200.
 */
export default async function SuppliersLoading() {
  const t = await getTranslations();
  return (
    <Page>
      <ListSkeleton label={t('common.loading')} />
    </Page>
  );
}
