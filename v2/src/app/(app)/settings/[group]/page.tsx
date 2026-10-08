import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { requireMe } from '@/core/auth/require-me';
import { serverRpc } from '@/core/db/server-rpc';
import { listsOf, settingsGroups } from '@/modules/settings/groups';
import type { SettingsAnswer } from '@/modules/settings/schema';
import type { ListEntry } from '@/modules/settings/screens/ListEditor';
import { OrgAccess, type OrgAnswer, type PeopleAnswer, type MatrixAnswer } from '@/modules/org/screens/OrgAccess';
import { SettingsGroup } from '@/modules/settings/screens/SettingsGroup';
import { SettingsShell } from '@/modules/settings/screens/SettingsShell';
import { DataState } from '@/ui/DataState';
import { PageHeader } from '@/ui/PageHeader';
import { isAdmin } from '@/ui/shell/nav';
import { Page } from '@/ui/shell/Page';

export async function generateMetadata({ params }: { params: Promise<{ group: string }> }) {
  const { group } = await params;
  const def = settingsGroups().find((g) => g.slug === group);
  return def ? { title: (await getTranslations())(def.label) } : {};
}

/**
 * A Settings group (V97: admins only — anyone else is refused by address, in words). The group's settings and lists
 * come from the database (api.settings, api.list); Organization & access carries its own tab row.
 */
export default async function SettingsGroupPage({
  params,
  searchParams,
}: {
  params: Promise<{ group: string }>;
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const [{ group }, { tab }, me] = await Promise.all([params, searchParams, requireMe()]);
  // Riyadh's date on the server: the day a setting change applies from is never the browser's clock (PRF-139)
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Riyadh' });
  const def = settingsGroups().find((g) => g.slug === group);
  if (!def) notFound();
  const t = await getTranslations();
  if (!isAdmin(me))
    return (
      <Page>
        <PageHeader title={t(def.label)} />
        <DataState
          kind="no-access"
          what={t('settings.title')}
          message={t('settings.noAccess')}
          goHome={t('errors.notFound.goMyDay')}
        />
      </Page>
    );
  // W47: every read of the page goes out together, one round after me — the settings, the organisation, each list,
  // and on Organization & access the people and the access matrix — not in three rounds one after the other.
  const listDefs = listsOf(def.page);
  const isOrg = group === 'org';
  const [settings, org, lists, people, matrix] = await Promise.all([
    serverRpc('settings', { p_group: def.page }) as Promise<unknown>,
    serverRpc('org', {} as never) as Promise<unknown>,
    Promise.all(
      listDefs.map(async (l) => ({
        ...l,
        rows: (await serverRpc('list', { p_list: l.key, p_include_retired: true })) as unknown as ListEntry[],
      })),
    ),
    isOrg ? (serverRpc('people', {} as never) as Promise<unknown>) : null,
    isOrg ? (serverRpc('access_matrix', {} as never) as Promise<unknown>) : null,
  ]);
  const answer = settings as SettingsAnswer;
  const departments = (org as OrgAnswer).departments;
  if (isOrg) {
    return (
      <SettingsShell current={group} title={t(def.label)}>
        <OrgAccess
          me={me}
          tab={typeof tab === 'string' ? tab : 'people'}
          org={org as OrgAnswer}
          people={people as PeopleAnswer}
          matrix={matrix as MatrixAnswer}
          settings={answer.settings}
          canEdit={answer.can_edit}
          today={today}
        />
      </SettingsShell>
    );
  }
  return (
    <SettingsShell current={group} title={t(def.label)}>
      <SettingsGroup
        settings={answer.settings}
        canEdit={answer.can_edit}
        departments={departments}
        lists={lists}
        today={today}
      />
    </SettingsShell>
  );
}
