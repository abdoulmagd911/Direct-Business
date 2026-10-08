import { getLocale, getTranslations } from 'next-intl/server';
import { requireMe } from '@/core/auth/require-me';
import { serverRpc } from '@/core/db/server-rpc';
import { readOrFail as maybe } from '@/modules/org/read-or-fail';
import type { FromNote } from '@/modules/my-day/types';
import type { OrgAnswer } from '@/modules/org/types';
import { AchievementRecord, type AchievementRecordData } from '@/modules/perf/screens/AchievementRecord';
import type { AchievementDetail, Category } from '@/modules/perf/types';
import { historyRows, type RecordChange } from '@/ui/record/history';
import { DataState } from '@/ui/DataState';
import { PageHeader } from '@/ui/PageHeader';
import { Page } from '@/ui/shell/Page';
import { pageTitle } from '@/ui/shell/page-title';

export const generateMetadata = pageTitle('pages.achievements.title');

type ListEntry = { key: string; name_en: string; name_ar: string };

/** An achievement's record page (V95, GC-4): `/kpis/achievements/<id>?tab=…`. */
export default async function AchievementPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const [{ id }, { tab }, me, locale] = await Promise.all([params, searchParams, requireMe(), getLocale()]);
  const lang = locale as 'en' | 'ar';
  const failed: string[] = [];
  const a = await maybe<AchievementDetail>('achievement', failed, () => serverRpc('achievement', { p_id: id }));
  if (!a) {
    // refused (another department's) or not read: said in words, never an empty page
    const t = await getTranslations();
    const what = t('pages.achievements.title');
    return (
      <Page page="kpis" title={what}>
        <PageHeader title={what} />
        {failed.length ? (
          <DataState kind="failed" what={what} message={t('state.failed', { what })} />
        ) : (
          <DataState kind="no-access" what={what} message={t('state.noAccess', { what })} />
        )}
      </Page>
    );
  }
  const [org, history, categories, systems, partner, fromNote] = await Promise.all([
    maybe<OrgAnswer>('org', failed, () => serverRpc('org', {} as never)),
    maybe<RecordChange[]>('history', failed, () => serverRpc('record_history', { p_entity: 'achievement', p_id: id })),
    maybe<Category[]>('categories', failed, () => serverRpc('achievement_categories', { p_plan: a.plan_id })),
    maybe<ListEntry[]>('systems', failed, () => serverRpc('list', { p_list: 'ref_system' })),
    a.partner_id
      ? maybe<{ trade_name_en: string; trade_name_ar: string | null }>('partner', failed, () =>
          serverRpc('hover_partner', { p_id: a.partner_id! }),
        )
      : Promise.resolve(null),
    maybe<FromNote | null>('from_note', failed, () => serverRpc('from_note', { p_entity: 'achievement', p_id: id })),
  ]);
  const data: AchievementRecordData = {
    a,
    tab: typeof tab === 'string' ? tab : 'overview',
    org,
    partnerName: partner ? (lang === 'ar' && partner.trade_name_ar) || partner.trade_name_en : null,
    history: history ? historyRows(history, 'achievement', id) : null,
    categories: categories ?? [],
    systems: (systems ?? []).map((s) => ({ key: s.key, name: lang === 'ar' ? s.name_ar : s.name_en })),
    full: (me.levels.kpis ?? 'none') === 'full',
    meId: me.person.id,
    fromNote: fromNote ?? null,
    failed,
  };
  return (
    <Page page="kpis" bare>
      <AchievementRecord data={data} />
    </Page>
  );
}
