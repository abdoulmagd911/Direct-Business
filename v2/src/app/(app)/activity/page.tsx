import { RefreshCw } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireMe } from '@/core/auth/require-me';
import { failureRef, readAgain } from '@/core/db/read-again';
import { serverRpc } from '@/core/db/server-rpc';
import type { OrgAnswer } from '@/modules/org/types';
import { parseDueDay } from '@/modules/tasks/rules';
import { ActivityScreen, type DeletedRow, type SignInRow } from '@/modules/settings/screens/ActivityScreen';
import { buttonVariants } from '@/ui/button-variants';
import { cn } from '@/ui/cn';
import { DataState } from '@/ui/DataState';
import { PageHeader } from '@/ui/PageHeader';
import type { HistoryRow } from '@/ui/record/history';
import { canSee } from '@/ui/person';
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
  // Landing 28: the settings log is not offered while signed in as a test user. api.settings_log begins with
  // authz.require_admin(), which refuses every switched session (test_switch.no_access_change) whatever the test
  // user's role — so the tab is not drawn (ActivityScreen) and its address lands on the default tab, keeping the
  // Who and Since filters. The read is never sent.
  if (me.test_switch && tab === 'settings') {
    const kept = new URLSearchParams();
    if (filters.actor) kept.set('actor', filters.actor);
    if (filters.since) kept.set('since', filters.since);
    const query = kept.toString();
    redirect(query ? `/activity?${query}` : '/activity');
  }
  const othersSignIns = canSee(me, 'settings.org');
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
      // one's own sign-ins always; someone else's with People & access · View (api.sign_in_log, V132) — a head or
      // manager naming another person in the address was refused, and the refusal took the whole page down
      return {
        signIns:
          ((await serverRpc('sign_in_log', {
            p_person: othersSignIns && filters.person ? filters.person : me.person.id,
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
  // Landing 28: each read is caught on its own (the codes page's readAgain), so one failing read never takes the
  // whole page into the error screen — the three were awaited together with no catch, and one refusal drew
  // "This page could not be drawn". Still one round: the three go out together.
  const failure: { ref: string | null } = { ref: null };
  const keep = (e: unknown) => {
    failure.ref ??= failureRef(e);
  };
  const [org, priorities, read] = await Promise.all([
    readAgain(() => serverRpc('org', {} as never) as unknown as Promise<OrgAnswer>, keep),
    readAgain(
      () =>
        serverRpc('list', { p_list: 'priority' }) as unknown as Promise<
          { id: string; name_en: string; name_ar: string | null }[]
        >,
    ),
    readAgain(tabRead, keep),
  ]);
  // Without the organisation the screen cannot name anyone: the page says so, with Try again as a link to the
  // same address (a server page cannot pass a callback — FIX-28), inside the app's frame.
  if (!org) {
    const again = new URLSearchParams({ tab });
    for (const [k, v] of Object.entries(filters)) if (v) again.set(k, v);
    return (
      <Page>
        <PageHeader title={t('nav.activity')} />
        <DataState
          kind="failed"
          what={t('nav.activity')}
          message={t('state.failed', { what: t('nav.activity') })}
          action={
            <>
              <Link href={`/activity?${again}`} className={cn(buttonVariants({ size: 'sm' }), 'ms-auto')} data-retry>
                <RefreshCw aria-hidden="true" />
                {t('common.tryAgain')}
              </Link>
              {failure.ref ? (
                <span dir="ltr" className="basis-full font-data text-xs text-muted" data-activity-error>
                  {failure.ref}
                </span>
              ) : null}
            </>
          }
        />
      </Page>
    );
  }
  const { rows = [], signIns = [], deleted = [], total, sinceIso } = read ?? {};
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
        priorities={priorities ?? []}
        readFailed={read === null}
        readError={failure.ref}
        total={total}
        sinceIso={sinceIso}
      />
    </Page>
  );
}
