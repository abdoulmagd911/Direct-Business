import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { requireMe } from '@/core/auth/require-me';
import { serverRpc } from '@/core/db/server-rpc';
import { readOrFail as maybe } from '@/modules/org/read-or-fail';
import { loadLookups } from '@/modules/tasks/load';
import { TaskRecord } from '@/modules/tasks/screens/TaskRecord';
import type { TaskDetail, TaskList } from '@/modules/tasks/types';
import { historyRows, type RecordChange } from '@/ui/record/history';
import { Page } from '@/ui/shell/Page';
import { pageTitle } from '@/ui/shell/page-title';

export const generateMetadata = pageTitle('nav.tasks');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NUMBER = /^TSK-\d{4}-\d{4,}$/;

/**
 * One task's record (V95), at its number (`/tasks/TSK-2026-0001`) — or its id, the address a notice or a search hit
 * carries. A number is found among the tasks one may see, live work first, then past work (V491).
 */
async function idOf(key: string): Promise<string | null> {
  if (UUID.test(key)) return key;
  if (!NUMBER.test(key)) return null;
  for (const past of [false, true]) {
    const r = (await serverRpc('tasks', {
      p_filter: { scope: 'all', q: key, past_work: past },
      p_limit: 5,
    })) as unknown as TaskList;
    const hit = r.rows.find((x) => x.number === key);
    if (hit) return hit.id;
  }
  return null;
}

export default async function TaskPage({
  params,
  searchParams,
}: {
  params: Promise<{ number: string }>;
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const [{ number }, { tab }, me, t] = await Promise.all([params, searchParams, requireMe(), getTranslations()]);
  if ((me.levels.tasks ?? 'none') === 'none')
    return (
      <Page page="tasks" title={t('nav.tasks')}>
        {null}
      </Page>
    );
  const id = await idOf(decodeURIComponent(number));
  if (!id) notFound();
  const failed: string[] = [];
  const [task, history, lookups] = await Promise.all([
    serverRpc('task', { p_id: id }).then(
      (r) => r as unknown as TaskDetail,
      (e: { kind?: string }) => {
        if (e.kind === 'NotFound' || e.kind === 'PermissionDenied') notFound();
        throw e;
      },
    ),
    maybe<RecordChange[]>('history', failed, () =>
      serverRpc('record_history', { p_entity: 'task', p_id: id } as never),
    ),
    loadLookups(me, failed),
  ]);
  return (
    <Page bare>
      <TaskRecord
        data={{
          task,
          tab: typeof tab === 'string' ? tab : 'overview',
          history: history ? historyRows(history, 'task', id) : null,
          lookups,
        }}
      />
    </Page>
  );
}
