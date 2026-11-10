import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { requireMe } from '@/core/auth/require-me';
import { serverRpc } from '@/core/db/server-rpc';
import { planTitle, type Category, type PlanRow, type TargetRow } from '@/modules/perf/types';
import { PlanDetailScreen } from '@/modules/perf/screens/PlanDetailScreen';
import type { OrgAnswer } from '@/modules/org/screens/OrgAccess';
import { settingsGroups } from '@/modules/settings/groups';
import type { ListEntry } from '@/modules/settings/screens/ListEditor';
import { SettingsShell } from '@/modules/settings/screens/SettingsShell';
import { DataState } from '@/ui/DataState';
import { PageHeader } from '@/ui/PageHeader';
import { isAdmin } from '@/ui/shell/nav';
import { Page } from '@/ui/shell/Page';

export async function generateMetadata() {
  const def = settingsGroups().find((g) => g.slug === 'performance');
  return def ? { title: (await getTranslations())(def.label) } : {};
}

/**
 * One plan's targets screen (FIX-23): the plan's targets and its achievement categories. Admins only, like every
 * Settings page — anyone else is refused by address, in words. A plan that is not there, or that the reader cannot
 * see, is not found.
 */
export default async function PlanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, me] = await Promise.all([params, requireMe()]);
  const t = await getTranslations();
  const def = settingsGroups().find((g) => g.slug === 'performance');
  if (!isAdmin(me))
    return (
      <Page>
        <PageHeader title={def ? t(def.label) : ''} />
        <DataState
          kind="no-access"
          what={t('settings.title')}
          message={t('settings.noAccess')}
          goHome={t('errors.notFound.goMyDay')}
        />
      </Page>
    );
  // every read of the page goes out together, one round after me — the plan, its categories and targets, the
  // organisation, and the reference systems a category may require
  const [plan, categories, targets, org, refSystems] = await Promise.all([
    serverRpc('plan', { p_id: id }) as Promise<unknown>,
    serverRpc('achievement_categories', { p_plan: id }) as Promise<unknown>,
    serverRpc('targets', { p_plan: id }) as Promise<unknown>,
    serverRpc('org', {} as never) as Promise<unknown>,
    serverRpc('list', { p_list: 'ref_system' }) as Promise<unknown>,
  ]);
  const planRow = plan as PlanRow | null;
  if (!planRow) notFound();
  const locale = (await getLocale()) as 'en' | 'ar';
  const departments = (org as OrgAnswer).departments;
  return (
    <SettingsShell current="performance" title={planTitle(planRow, departments, locale)}>
      <PlanDetailScreen
        plan={planRow}
        departments={departments}
        categories={categories as Category[]}
        targets={targets as TargetRow[]}
        refSystems={(refSystems as ListEntry[]).filter((r) => r.active)}
      />
    </SettingsShell>
  );
}
