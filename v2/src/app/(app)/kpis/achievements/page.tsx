import { getLocale, getTranslations } from 'next-intl/server';
import { requireMe } from '@/core/auth/require-me';
import { serverRpc } from '@/core/db/server-rpc';
import { nameOf, type OrgAnswer } from '@/modules/org/types';
import { AchievementList } from '@/modules/perf/screens/AchievementList';
import { apiFilter, filterOf, type AchievementPage, type Category } from '@/modules/perf/types';
import { Page } from '@/ui/shell/Page';
import { pageTitle } from '@/ui/shell/page-title';

export const generateMetadata = pageTitle('pages.achievements.title');

/** Achievements under KPIs (GC-4): `/kpis/achievements`, its filters in the address. */
export default async function AchievementsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [q, me, t] = await Promise.all([searchParams, requireMe(), getTranslations()]);
  const level = me.levels.kpis ?? 'none';
  const filter = filterOf(q);
  const [page, categories, org] = await Promise.all([
    level === 'none'
      ? null
      : (serverRpc('achievements', { p_filter: apiFilter(filter) as never, p_limit: 200 }) as Promise<unknown>).catch(
          () => null,
        ),
    level === 'none' ? [] : (serverRpc('achievement_categories', {}) as Promise<unknown>).catch(() => []),
    (serverRpc('org', {} as never) as Promise<unknown>).catch(() => null),
  ]);
  const lang = (await getLocale()) as 'en' | 'ar';
  const people = Object.fromEntries(((org as OrgAnswer | null)?.people ?? []).map((p) => [p.id, nameOf(p, lang)]));
  return (
    <Page page="kpis" title={t('pages.achievements.title')}>
      <AchievementList
        page={page as AchievementPage | null}
        filter={filter}
        categories={categories as Category[]}
        people={people}
        canLog={level === 'own' || level === 'full'}
      />
    </Page>
  );
}
