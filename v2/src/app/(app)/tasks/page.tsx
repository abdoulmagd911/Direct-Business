import { getTranslations } from 'next-intl/server';
import { requireMe } from '@/core/auth/require-me';
import { serverRpc } from '@/core/db/server-rpc';
import { loadLookups } from '@/modules/tasks/load';
import { apiFilter, parseFilters, showsTeamLoad } from '@/modules/tasks/rules';
import { TaskListScreen } from '@/modules/tasks/screens/TaskListScreen';
import type { TaskList, TeamLoad } from '@/modules/tasks/types';
import { Page } from '@/ui/shell/Page';
import { pageTitle } from '@/ui/shell/page-title';

export const generateMetadata = pageTitle('nav.tasks');

/** The Tasks list (§3.7; P5-2's first PR, V517): the view and chips are in the address, read here on the server. */
export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [t, me, params] = await Promise.all([getTranslations(), requireMe(), searchParams]);
  const title = t('nav.tasks');
  if ((me.levels.tasks ?? 'none') === 'none')
    return (
      <Page page="tasks" title={title}>
        {null}
      </Page>
    );
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
