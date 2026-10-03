import { getLocale, getTranslations } from 'next-intl/server';
import { requireMe } from '@/core/auth/require-me';
import { serverRpc } from '@/core/db/server-rpc';
import { nameOf, type OrgAnswer } from '@/modules/org/types';
import { LogAchievement } from '@/modules/perf/screens/LogAchievement';
import type { Category } from '@/modules/perf/types';
import { DataState } from '@/ui/DataState';
import { PageHeader } from '@/ui/PageHeader';
import { Page } from '@/ui/shell/Page';

type ListEntry = { key: string; name_en: string; name_ar: string };

/** Log achievement (GC-4): from the + and from the list, for everyone with Own on KPIs (a Member logs their own). */
export default async function NewAchievementPage() {
  const [me, t, locale] = await Promise.all([requireMe(), getTranslations(), getLocale()]);
  const lang = locale as 'en' | 'ar';
  const level = me.levels.kpis ?? 'none';
  const title = t('pages.achievements.log');
  if (level !== 'own' && level !== 'full') {
    return (
      <Page page="kpis" title={title}>
        <PageHeader title={title} />
        <DataState kind="no-access" what={title} message={t('state.noAccess', { what: title })} />
      </Page>
    );
  }
  const year = Number(
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Riyadh', year: 'numeric' }).format(new Date()),
  );
  const [categories, org, systems] = await Promise.all([
    (serverRpc('achievement_categories', { p_year: year }) as Promise<unknown>).catch(() => []),
    (serverRpc('org', {} as never) as Promise<unknown>).catch(() => null),
    (serverRpc('list', { p_list: 'ref_system' }) as Promise<unknown>).catch(() => []),
  ]);
  const people = ((org as OrgAnswer | null)?.people ?? [])
    .filter((p) => p.department_id === me.person.department_id)
    .map((p) => ({ id: p.id, name: nameOf(p, lang) }));
  const dept = (org as OrgAnswer | null)?.departments.find((d) => d.id === me.person.department_id);
  return (
    <Page page="kpis" title={title}>
      <LogAchievement
        categories={categories as Category[]}
        year={year}
        people={people}
        systems={(systems as ListEntry[]).map((s) => ({ key: s.key, name: lang === 'ar' ? s.name_ar : s.name_en }))}
        meId={me.person.id}
        full={level === 'full'}
        department={{
          id: me.person.department_id,
          name: dept ? (lang === 'ar' && dept.name_ar ? dept.name_ar : dept.name_en) : '',
        }}
        canOpenPlan={me.levels['settings.performance'] === 'full'}
      />
    </Page>
  );
}
