import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { requireMe } from '@/core/auth/require-me';
import type { Me } from '@/core/auth/me';
import { serverRpc } from '@/core/db/server-rpc';
import { loadLookups } from '@/modules/tasks/load';
import { apiFilter, parseFilters, showsTeamLoad } from '@/modules/tasks/rules';
import { TaskListScreen } from '@/modules/tasks/screens/TaskListScreen';
import type { TaskList, TeamLoad } from '@/modules/tasks/types';
import { DataState } from '@/ui/DataState';
import { Page } from '@/ui/shell/Page';
import { pageTitle } from '@/ui/shell/page-title';

export const generateMetadata = pageTitle('nav.tasks');

type Params = Record<string, string | string[] | undefined>;

/** The Tasks list (§3.7; P5-2's first PR, V517): the view and chips are in the address, read here on the server. */
export default async function TasksPage({ searchParams }: { searchParams: Promise<Params> }) {
  const [t, me, params] = await Promise.all([getTranslations(), requireMe(), searchParams]);
  const title = t('nav.tasks');
  if ((me.levels.tasks ?? 'none') === 'none')
    return (
      <Page page="tasks" title={title}>
        {null}
      </Page>
    );
  // /tasks/new (the + menu's Task) shows the loading state at once while the list is read, so a phone never sits on a
  // blank page (the supervisor's sweep of 15 Oct, V284); every other visit reads as before
  if (params.new === '1')
    return (
      <Suspense
        fallback={
          <Page page="tasks" title={title}>
            <div data-tasks-loading>
              <DataState kind="loading" message={t('state.loading', { what: title })} />
            </div>
          </Page>
        }
      >
        <TasksBody me={me} params={params} title={title} />
      </Suspense>
    );
  return TasksBody({ me, params, title });
}

async function TasksBody({ me, params, title }: { me: Me; params: Params; title: string }) {
  const filters = parseFilters(params);
  const [list, lookups, load] = await Promise.all([
    serverRpc('tasks', { p_filter: apiFilter(filters) as never, p_limit: 200 }).then(
      (r) => r as unknown as TaskList,
      () => null,
    ),
    loadLookups(me),
    // the team's load (V91): only on the Team view, for someone who gives work to others
    showsTeamLoad(filters.scope, me.capabilities)
      ? serverRpc('team_load', {} as never).then(
          (r) => r as unknown as TeamLoad[],
          () => null,
        )
      : Promise.resolve(undefined),
  ]);
  return (
    <Page page="tasks" title={title}>
      <TaskListScreen data={{ filters, list, lookups, load, adding: params.new === '1' }} />
    </Page>
  );
}
