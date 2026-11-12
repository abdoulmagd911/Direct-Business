/**
 * F-B1-06 (FIX-05): a stored priority is shown on the task record — as a chip and in Details — whether or not the
 * task is an executive directive. Before, the chip drew only for an executive directive, so a stored priority was
 * invisible on the record. Every value is made up.
 */
import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import en from '../../../messages/en.json';
import { TaskRecord } from '../../../src/modules/tasks/screens/TaskRecord';
import { ME, STATUSES, row } from './fixtures';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {}, refresh: () => {} }) }));
vi.mock('@/core/auth/me-context', () => ({
  useMe: () => ({ person: { id: ME }, capabilities: ['tasks.assign'], levels: { kpis: 'full' } }),
  useMaybeMe: () => null,
}));
vi.mock('@/core/db/rpc', () => ({ rpc: vi.fn(async () => []) }));

const priorities = [{ id: 'p1', key: 'high', name_en: 'High', name_ar: 'عالية', sort: 1, active: true }];

const draw = (over: Record<string, unknown> = {}) =>
  renderToStaticMarkup(
    <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Riyadh">
      <TaskRecord
        data={{
          task: {
            ...row({ priority: 'high', priority_en: 'High', priority_ar: 'عالية' }),
            notes: null,
            assigned_by: null,
            closed_by: null,
            created_by: ME,
            action_items: [],
            refs: [],
            contacts: [],
            status_history: [],
            ...over,
          },
          tab: 'overview',
          history: null,
          comments: null,
          files: [],
          lookups: { statuses: STATUSES, priorities, org: null, partners: [], projects: [], failed: [] },
        }}
      />
    </NextIntlClientProvider>,
  );

describe('the task record shows its priority (F-B1-06)', () => {
  it('draws the priority chip and the Details line on an ordinary prioritised task', () => {
    const html = draw({ executive_directive: false });
    // once as the header chip, once as the Details line — both visible without an executive directive
    expect(html.match(/High/g)?.length).toBe(2);
    expect(html).toContain('Priority');
  });

  it('draws no priority on a task with none', () => {
    const html = draw({ priority: null, priority_en: null, priority_ar: null });
    expect(html).not.toContain('High');
  });
});
