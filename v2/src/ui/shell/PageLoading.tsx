import { getTranslations } from 'next-intl/server';
import { DataState } from '@/ui/DataState';
import { Page } from './Page';

/**
 * A main tab's loading frame (owner, 13 Nov: "tap My day — it does not open, it just lags"): the moment a tab is
 * tapped its page says it is loading, instead of the old page standing frozen until the server has read everything —
 * the frame is fetched ahead with the link, so it shows at once. The same frame FIX-45 gave Clients and Suppliers.
 * Presentation only: it changes no read and no timing.
 *
 * Only for a section none of whose pages answers Not found or redirects (W32, the Architect's order of 2 Nov): a frame
 * makes every answer under it start as 200 before its page has run, so a record that does not exist would answer 200,
 * and a redirect would be made by the browser instead of the server. Tasks, Settings, People and Partners answer 404
 * for a record that does not exist and KPIs redirects, so they get none (an app-wide frame was reverted for this;
 * tests/sabotage/an-app-wide-loading-frame.mjs).
 */
export async function PageLoading() {
  const t = await getTranslations();
  return (
    <Page bare>
      <DataState kind="loading" message={t('common.loading')} />
    </Page>
  );
}
