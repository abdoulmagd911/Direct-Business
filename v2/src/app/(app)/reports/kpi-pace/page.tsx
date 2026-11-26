import { getTranslations } from 'next-intl/server';
import { requireMe } from '@/core/auth/require-me';
import { serverRpc } from '@/core/db/server-rpc';
import type { PaceAnswer } from '@/modules/perf/pace';
import { KpiPace } from '@/modules/perf/screens/KpiPace';
import { Page } from '@/ui/shell/Page';
import { pageTitle } from '@/ui/shell/page-title';

export const generateMetadata = pageTitle('pages.kpiPace.title');

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * Reports → KPI pace (Landing 54): one read of api.kpi_pace for the month in the address — the current Riyadh month
 * when none is named, which the database decides, never this server's clock. A person with no level on Reports gets
 * the refusal under the page's name; one the read refuses (no level on Achievements) gets the failed state.
 */
export default async function KpiPacePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [q, me, t] = await Promise.all([searchParams, requireMe(), getTranslations()]);
  const asked = typeof q.month === 'string' && MONTH.test(q.month) ? q.month : undefined;
  const answer =
    (me.levels.reports ?? 'none') === 'none'
      ? null
      : ((await (serverRpc('kpi_pace', asked ? { p_month: `${asked}-01` } : {}) as Promise<unknown>).catch(
          () => null,
        )) as PaceAnswer | null);
  // with no month in the address and no answer, the month shown is only a label for the failed state
  const month = asked ?? answer?.month.slice(0, 7) ?? new Date().toISOString().slice(0, 7);
  return (
    <Page page="reports" title={t('pages.kpiPace.title')}>
      <KpiPace answer={answer} month={month} />
    </Page>
  );
}
