/**
 * F-B1-06 (FIX-05): a stored priority is shown on the task — on the list row, not only in the filter. Before, the
 * row rendered title/number/owner/due/status only, so a stored priority was invisible there. Every value is made up.
 */
import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import en from '../../../messages/en.json';
import { TaskListScreen } from '../../../src/modules/tasks/screens/TaskListScreen';
import { ME, STATUSES, row } from './fixtures';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {}, refresh: () => {} }) }));
vi.mock('@/core/auth/me-context', () => ({
  useMe: () => ({ person: { id: ME }, capabilities: [], levels: {} }),
  useMaybeMe: () => null,
}));
vi.mock('@/core/db/rpc', () => ({ rpc: vi.fn(async () => []) }));

const priorities = [
  { id: 'p1', key: 'high', name_en: 'High', name_ar: 'عالية', sort: 1, active: true },
  { id: 'p2', key: 'low', name_en: 'Low', name_ar: 'منخفضة', sort: 3, active: true },
];

const draw = (rows: ReturnType<typeof row>[]) =>
  renderToStaticMarkup(
    <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Riyadh">
      <TaskListScreen
        data={{
          filters: { scope: 'my_work' },
          list: { rows, total: rows.length, more: false },
          lookups: { statuses: STATUSES, priorities, org: null, partners: [], projects: [], failed: [] },
          adding: false,
        }}
      />
    </NextIntlClientProvider>,
  );

describe('the Tasks list shows a task’s priority on its row (F-B1-06)', () => {
  it('draws the priority beside the status on a prioritised row', () => {
    const html = draw([row({ id: 't1', title: 'Made-up urgent task', priority: 'high', priority_en: 'High' })]);
    expect(html).toContain('data-task-row="TSK-2026-0001"');
    expect(html).toContain('Made-up urgent task');
    expect(html.match(/High/g)?.length, 'one priority chip, not one in the filter too').toBe(1);
  });

  it('draws no priority chip on a task with none', () => {
    const html = draw([row({ id: 't2', title: 'Made-up plain task', priority: null })]);
    expect(html).toContain('Made-up plain task');
    expect(html).not.toContain('High');
    expect(html).not.toContain('Low');
  });
});
