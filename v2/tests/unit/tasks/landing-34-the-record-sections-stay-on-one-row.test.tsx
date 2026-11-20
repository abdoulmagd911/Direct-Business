/**
 * Landing 34, item 23 (the 19 Nov test round, on a phone): the task record's sections bar wrapped — "Action items 0"
 * dropped to a second row in a taller pale box. The task record asks the shared record page for ONE row that scrolls
 * inside itself (`tabsOneRow`), and its tabs read with their counts as words ("Action items 0"). Every value is
 * made up.
 * Sabotage: tests/sabotage/landing-34-shell.mjs.
 */
import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import en from '../../../messages/en.json';
import { TaskRecord } from '../../../src/modules/tasks/screens/TaskRecord';
import { ME, STATUSES, row } from './fixtures';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {}, refresh: () => {} }) }));
vi.mock('@/core/auth/me-context', () => ({
  useMe: () => ({ person: { id: ME }, capabilities: [], levels: { kpis: 'own' } }),
  useMaybeMe: () => null,
}));
vi.mock('@/core/db/rpc', () => ({ rpc: vi.fn(async () => []) }));

const html = renderToStaticMarkup(
  <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Riyadh">
    <TaskRecord
      data={{
        task: {
          ...row({}),
          notes: null,
          assigned_by: null,
          closed_by: null,
          created_by: ME,
          action_items: [],
          refs: [],
          contacts: [],
          status_history: [],
        },
        tab: 'overview',
        history: null,
        comments: null,
        files: [],
        lookups: { statuses: STATUSES, priorities: [], org: null, partners: [], projects: [], failed: [] },
      }}
    />
  </NextIntlClientProvider>,
);

describe('the task record’s sections bar on a phone', () => {
  const header = /<header[^>]*data-record-header[^>]*>/.exec(html)?.[0] ?? '';
  const bar = /<div class="([^"]*)"><nav[^>]*data-tabs/.exec(html)?.[1] ?? '';
  it('is one row: the record page is told so', () => {
    expect(header).toContain('data-tabs-one-row="true"');
  });
  it('does not wrap, and stays a pill that scrolls inside itself', () => {
    expect(bar.split(/\s+/)).toEqual(
      expect.arrayContaining(['max-sm:[&amp;_[data-tabs]]:flex-nowrap', 'max-sm:[&amp;_[data-tabs]]:rounded-pill']),
    );
    const track = /<nav[^>]*data-tabs[^>]*>/.exec(html)?.[0] ?? '';
    expect(track).toMatch(/\boverflow-x-auto\b/);
    // each tab keeps its own width (never squeezed to fit): the row is what scrolls
    expect(html).toMatch(/<a[^>]*class="[^"]*\bshrink-0\b[^"]*"[^>]*>(?:<span data-tab-face="true">)?Action items/);
  });
  it('"Action items 0" reads with its space', () => {
    const tabs = /<nav[^>]*data-tabs[^>]*>(.*?)<\/nav>/s.exec(html)?.[1] ?? '';
    expect(tabs.replace(/<[^>]+>/g, '')).toContain('Action items 0');
  });
});
