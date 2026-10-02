import { getTranslations } from 'next-intl/server';
import { requireMe } from '@/core/auth/require-me';
import { serverRpc } from '@/core/db/server-rpc';
import { loadLookups } from '@/modules/tasks/load';
import { apiFilter, parseFilters } from '@/modules/tasks/rules';
import { TaskListScreen } from '@/modules/tasks/screens/TaskListScreen';
import type { TaskList } from '@/modules/tasks/types';
import { Page } from '@/ui/shell/Page';

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
  const [list, lookups] = await Promise.all([
    serverRpc('tasks', { p_filter: apiFilter(filters) as never, p_limit: 200 }).then(
      (r) => r as unknown as TaskList,
      () => null,
    ),
    loadLookups(me),
  ]);
  return (
    <Page page="tasks" title={title}>
      <TaskListScreen data={{ filters, list, lookups, adding: params.new === '1' }} />
    </Page>
  );
}
