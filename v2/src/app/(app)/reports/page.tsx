import { getLocale, getTranslations } from 'next-intl/server';
import { requireMe } from '@/core/auth/require-me';
import { serverRpc } from '@/core/db/server-rpc';
import { nameOf, type OrgAnswer } from '@/modules/org/types';
import { tradeName, type PartnersAnswer } from '@/modules/partners/types';
import { ReportSummary } from '@/modules/perf/screens/ReportSummary';
import type { AchievementPage } from '@/modules/perf/types';
import { Page } from '@/ui/shell/Page';
import { pageTitle } from '@/ui/shell/page-title';

export const generateMetadata = pageTitle('nav.reports');

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * Reports, first version: a read-only monthly summary over the same
 * `achievements` door the Achievements page reads, filtered only by month.
 * No report editor, no new module. Partner names come from the partners
 * doors, each caught on its own so a missing side never breaks the page.
 */
export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [q, me, t] = await Promise.all([searchParams, requireMe(), getTranslations()]);
  const level = me.levels.reports ?? 'none';
  const rawMonth = typeof q.month === 'string' ? q.month : undefined;
  const month = rawMonth && MONTH.test(rawMonth) ? rawMonth : undefined;
  const [page, org, clients, suppliers] = await Promise.all([
    level === 'none'
      ? null
      : (
          serverRpc('achievements', {
            p_filter: (month ? { month } : {}) as never,
            p_limit: 200,
          }) as Promise<unknown>
        ).catch(() => null),
    (serverRpc('org', {} as never) as Promise<unknown>).catch(() => null),
    (serverRpc('partners', { p_filters: { side: 'client' } as never, p_limit: 500 }) as Promise<unknown>).catch(
      () => null,
    ),
    (
      serverRpc('partners', {
        p_filters: { side: 'supplier_partner' } as never,
        p_limit: 500,
      }) as Promise<unknown>
    ).catch(() => null),
  ]);
  const lang = (await getLocale()) as 'en' | 'ar';
  const people = Object.fromEntries(((org as OrgAnswer | null)?.people ?? []).map((p) => [p.id, nameOf(p, lang)]));
  const partners = Object.fromEntries(
    [...((clients as PartnersAnswer | null)?.rows ?? []), ...((suppliers as PartnersAnswer | null)?.rows ?? [])].map(
      (p) => [p.id, tradeName(p, lang)],
    ),
  );
  return (
    <Page page="reports" title={t('nav.reports')}>
      <ReportSummary page={page as AchievementPage | null} month={month} people={people} partners={partners} />
    </Page>
  );
}
