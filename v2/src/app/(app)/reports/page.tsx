import { getLocale, getTranslations } from 'next-intl/server';
import { requireMe } from '@/core/auth/require-me';
import { serverRpc } from '@/core/db/server-rpc';
import { nameOf, type OrgAnswer } from '@/modules/org/types';
import { tradeName, type PartnersAnswer } from '@/modules/partners/types';
import { ReportSummary } from '@/modules/perf/screens/ReportSummary';
import type { AchievementPage, AchievementRow } from '@/modules/perf/types';
import { Page } from '@/ui/shell/Page';
import { pageTitle } from '@/ui/shell/page-title';

export const generateMetadata = pageTitle('nav.reports');

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
/** The achievements door answers at most 200 rows a call. */
const PAGE = 200;
/**
 * How many rows the summary reads at most — far above a month's (one read); past it, the capped line says so. Kept at
 * five reads: every read of the door re-checks who may see each of the department's achievements (about 2 ms a row
 * today, measured 13 Nov), so "Any month" over a long history must not read on and on.
 */
const READ_CAP = 1000;

/**
 * Every achievement the summary counts, read 200 at a time until the door says there are no more (up to READ_CAP):
 * the sums then cover the same rows the total counts — one read of 200 summed only the first 200 next to a total
 * of all of them. Drafts (no date yet) never count (V68), as Targets leaves them out: the door is asked for dated
 * ones only.
 */
async function readAll(month: string | undefined): Promise<AchievementPage> {
  const filter = { ...(month ? { month } : {}), draft: false };
  const rows: AchievementRow[] = [];
  let total = 0;
  for (let offset = 0; offset < READ_CAP; offset += PAGE) {
    const p = (await serverRpc('achievements', {
      p_filter: filter as never,
      p_limit: PAGE,
      p_offset: offset,
    })) as unknown as AchievementPage;
    rows.push(...p.rows);
    total = p.total;
    if (!p.more) break;
  }
  return { rows, total, more: rows.length < total };
}

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
  const [page, drafts, org, clients, suppliers] = await Promise.all([
    level === 'none' ? null : readAll(month).catch(() => null),
    // the drafts left out, counted so the summary can say so (a month holds none: a draft has no date)
    level === 'none' || month
      ? 0
      : (serverRpc('achievements', { p_filter: { draft: true } as never, p_limit: 1 }) as Promise<unknown>)
          .then((p) => (p as AchievementPage).total)
          .catch(() => 0),
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
  const partners: Record<string, string> = Object.fromEntries(
    [...((clients as PartnersAnswer | null)?.rows ?? []), ...((suppliers as PartnersAnswer | null)?.rows ?? [])].map(
      (p) => [p.id, tradeName(p, lang)],
    ),
  );
  // the two lists hold live organisations only, 500 a side at most: an achievement's organisation that is not among
  // them (archived, or past the first 500) is named on its own, as the record page names it — never "No
  // organisation listed" for one that is there
  const unnamed = [...new Set((page?.rows ?? []).map((r) => r.partner_id))].filter(
    (id): id is string => !!id && !(id in partners),
  );
  const found = await Promise.all(
    unnamed
      .slice(0, 200)
      .map((id) =>
        (serverRpc('hover_partner', { p_id: id }) as Promise<unknown>)
          .then((p) => [id, p ? tradeName(p as { trade_name_en: string; trade_name_ar: string | null }, lang) : ''])
          .catch(() => [id, '']),
      ),
  );
  for (const [id, name] of found) if (name) partners[id!] = name;
  return (
    <Page page="reports" title={t('nav.reports')}>
      <ReportSummary page={page} month={month} drafts={drafts} people={people} partners={partners} />
    </Page>
  );
}
