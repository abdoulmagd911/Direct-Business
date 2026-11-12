import { getTranslations } from 'next-intl/server';
import { requireMe } from '@/core/auth/require-me';
import { serverRpc } from '@/core/db/server-rpc';
import type { OrgAnswer } from '@/modules/org/types';
import { parseDueDay } from '@/modules/tasks/rules';
import { ActivityScreen, type DeletedRow, type SignInRow } from '@/modules/settings/screens/ActivityScreen';
import { DataState } from '@/ui/DataState';
import { PageHeader } from '@/ui/PageHeader';
import type { HistoryRow } from '@/ui/record/history';
import { Page } from '@/ui/shell/Page';
import { isAdmin } from '@/ui/shell/nav';
import { pageTitle } from '@/ui/shell/page-title';

export const generateMetadata = pageTitle('nav.activity');

const str = (v: string | string[] | undefined) => (typeof v === 'string' ? v : '');

/** Activity (V97): the change log, the settings log with Revert and the sign-in log, for Activity · View. */
export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [q, me] = await Promise.all([searchParams, requireMe()]);
  const t = await getTranslations();
  const tab = str(q.tab) || 'changes';
  const filters = { actor: str(q.actor), entity: str(q.entity), since: str(q.since), person: str(q.person) };
  if ((me.levels['activity'] ?? 'none') === 'none')
    return (
      <Page>
        <PageHeader title={t('nav.activity')} />
        <DataState
          kind="no-access"
          what={t('nav.activity')}
          message={t('activity.locked')}
          goHome={t('errors.notFound.goMyDay')}
        />
      </Page>
    );
  // W47: the organisation and the tab's own read go out together, one round after me — not one after the other.
  const tabRead = async (): Promise<{
    rows?: HistoryRow[];
    signIns?: SignInRow[];
    deleted?: DeletedRow[];
    total?: number;
    sinceIso?: string;
  }> => {
    if (tab === 'deleted') {
      // Recently deleted (V401): what the viewer may see, inside audit.recently_deleted_days.
      return { deleted: ((await serverRpc('recently_deleted', { p_limit: 200 })) as unknown as DeletedRow[]) ?? [] };
    }
    if (tab === 'signIns') {
      return {
        signIns:
          ((await serverRpc('sign_in_log', {
            p_person: filters.person || me.person.id,
            p_limit: 100,
          } as never)) as unknown as SignInRow[]) ?? [],
      };
    }
    if (tab === 'settings' && isAdmin(me)) {
      // The settings log (api.settings_log — V97, P3-6d): every request that touched a settings page, with each
      // change's before and after, so Revert knows the value that stood before without another read.
      const log =
        ((await serverRpc('settings_log', { p_limit: 100 })) as unknown as (Omit<HistoryRow, 'undone'> & {
          undone_by: string | null;
        })[]) ?? [];
      return { rows: log.map(({ undone_by, ...r }) => ({ ...r, undone: undone_by !== null })) };
    }
    // A half-typed Since ("2026-1", "20 Oct") is not a date yet: new Date() on it throws on toISOString()
    // and the whole page falls — only a full YYYY-MM-DD reaches the read, and the box keeps its text so the
    // half-typed date is not lost.
    const since = parseDueDay(filters.since);
    const sinceIso = since ? new Date(`${since}T12:00:00+03:00`).toISOString() : undefined;
    // The What filter names a word, not a record type (F-B1-07): one option can stand for several entity keys,
    // joined with "," — the read takes them all at once, and the total counts them all.
    const entityFilter: { p_entity?: string; p_entities?: string[] } =
      tab === 'settings'
        ? { p_entity: 'setting' }
        : filters.entity
          ? {
              p_entities: filters.entity
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean),
            }
          : {};
    const [rows, total] = await Promise.all([
      serverRpc('activity', {
        p_actor: filters.actor || undefined,
        ...entityFilter,
        p_since: sinceIso,
        // "Show all" shows all entries (FIX-18, F192): the read takes the function's whole cap (500), so
        // the Since filter reaches older entries instead of the 100 newest cutting them off. Older pages load
        // on "Show earlier" in the screen, by (at, id) from the oldest row read (F-B4-04).
        p_limit: 500,
      }) as unknown as Promise<HistoryRow[]>,
      // The whole log's count under the same filters (F-B4-04): "Show all" names it, not the page just read.
      serverRpc('activity_total', {
        p_actor: filters.actor || undefined,
        ...entityFilter,
        p_since: sinceIso,
      }),
    ]);
    return { rows: rows ?? [], total, sinceIso };
  };
  const [org, priorities, read] = await Promise.all([
    serverRpc('org', {} as never) as unknown as Promise<OrgAnswer>,
    serverRpc('list', { p_list: 'priority' }) as unknown as Promise<
      { id: string; name_en: string; name_ar: string | null }[]
    >,
    tabRead(),
  ]);
  const { rows = [], signIns = [], deleted = [], total, sinceIso } = read;
  return (
    <Page bare>
      <ActivityScreen
        me={me}
        tab={tab}
        org={org}
        rows={rows}
        signIns={signIns}
        deleted={deleted}
        filters={filters}
        priorities={priorities}
        total={total}
        sinceIso={sinceIso}
      />
    </Page>
  );
}
