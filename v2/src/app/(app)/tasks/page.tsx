import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { requireMe } from '@/core/auth/require-me';
import type { Me } from '@/core/auth/me';
import { serverRpc } from '@/core/db/server-rpc';
import { loadLookups, type TaskLookups } from '@/modules/tasks/load';
import { NewTaskEntry } from '@/modules/tasks/screens/NewTaskEntry';
import { homeScope, listFilter, parseFilters, showsTeamLoad } from '@/modules/tasks/rules';
import { TaskListScreen } from '@/modules/tasks/screens/TaskListScreen';
import type { TaskList, TeamLoad } from '@/modules/tasks/types';
import { TasksSkeleton } from '@/modules/tasks/screens/TasksSkeleton';
import { PageHeader } from '@/ui/PageHeader';
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
  if (params.new === '1') {
    // Landing 34 (item 6): the form does not wait for the list. It is drawn with this first answer, outside the part
    // that arrives late (NewTaskEntry), and is handed the names it offers as a promise — the same one round of reads
    // the list makes below, started here once.
    const lookups = loadLookups(me);
    const filters = parseFilters(params, homeScope(me.capabilities));
    return (
      <>
        <NewTaskEntry
          names={lookups.then(({ org, partners, projects, priorities }) => ({ org, partners, projects, priorities }))}
          initial={{ partnerId: filters.partner, projectId: filters.project }}
        />
        <Suspense
          fallback={
            <Page page="tasks" title={title}>
              <div data-tasks-loading>
                <PageHeader title={title} />
                <div className="mt-5">
                  <TasksSkeleton board={params.layout === 'board'} label={t('state.loading', { what: title })} />
                </div>
              </div>
            </Page>
          }
        >
          {/* the list under the form: its own Add task is closed — the open form is the one above */}
          <TasksBody me={me} params={{ ...params, new: undefined }} title={title} lookups={lookups} />
        </Suspense>
      </>
    );
  }
  return TasksBody({ me, params, title });
}

async function TasksBody({
  me,
  params,
  title,
  lookups: started,
}: {
  me: Me;
  params: Params;
  title: string;
  /** The lookups, when the page has already started reading them (/tasks/new hands the same read to its form). */
  lookups?: Promise<TaskLookups>;
}) {
  const filters = parseFilters(params, homeScope(me.capabilities));
  const [list, lookups, load] = await Promise.all([
    // every chip and the sort are the door's (listFilter), so the page of 200 and its total are the view's own
    serverRpc('tasks', { p_filter: listFilter(filters) as never, p_limit: 200 }).then(
      (r) => r as unknown as TaskList,
      () => null,
    ),
    started ?? loadLookups(me),
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
