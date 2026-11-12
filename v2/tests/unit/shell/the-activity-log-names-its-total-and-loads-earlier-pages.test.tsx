// @vitest-environment jsdom
/**
 * The /activity log (F-B4-04, F-B5-13, F-B2-02, O1 — Landing 15 Group C): "Show all" names the whole log's
 * total, not the page just read; older pages load on "Show earlier"; a change's values read in words — a start
 * page, a shared-with list, a capability or setting named by its key. Every value is made up.
 */
import { NextIntlClientProvider } from 'next-intl';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import en from '../../../messages/en.json';
import { ActivityTimeline, type HistoryRow } from '../../../src/ui/record/ActivityTimeline';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
(globalThis as { ResizeObserver?: unknown }).ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {}, refresh: () => {} }) }));

const PERSON_A = '11111111-1111-4111-8111-111111111111';
const PERSON_B = '22222222-2222-4222-8222-222222222222';
const people = {
  [PERSON_A]: {
    displayName: 'TEST Person A',
    fullName: 'TEST Person A',
    avatarUrl: null,
    badge: { kind: 'none' as const, value: null },
  },
  [PERSON_B]: {
    displayName: 'TEST Person B',
    fullName: 'TEST Person B',
    avatarUrl: null,
    badge: { kind: 'none' as const, value: null },
  },
};

const row = (request_id: string, at: string, changes: HistoryRow['changes']): HistoryRow => ({
  request_id,
  at,
  actor_id: null,
  kind: 'ui',
  label_key: null,
  label_args: null,
  reason: null,
  undone: false,
  undo_of: null,
  changes,
});

let root: Root | null = null;
afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.innerHTML = '';
});
const draw = (props: {
  rows: HistoryRow[];
  totalCount?: number;
  hasEarlier?: boolean;
  onLoadEarlier?: () => Promise<void> | void;
  initial?: number;
}) => {
  const host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  const { rows, ...rest } = props;
  act(() => {
    root!.render(
      <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Riyadh">
        <ActivityTimeline rows={rows} people={people} initial={props.initial ?? 50} {...rest} />
      </NextIntlClientProvider>,
    );
  });
  return host;
};

describe('the log names its true total and loads earlier pages', () => {
  const rows = [
    row('r1', '2026-11-08T09:11:00Z', [
      { entity: 'task', action: 'update', fields: ['title'], before: { title: 'A' }, after: { title: 'B' } },
    ]),
    row('r2', '2026-11-08T08:00:00Z', [
      { entity: 'task', action: 'update', fields: ['title'], before: { title: 'C' }, after: { title: 'D' } },
    ]),
  ];

  it('names the whole log in "Show all", not the rows read so far', () => {
    draw({ rows, totalCount: 1200, initial: 1 });
    expect(document.body.textContent).toContain('Show all (1200)');
    expect(document.body.textContent).not.toContain('Show all (2)');
  });
  it('names the rows read when no total is given', () => {
    draw({ rows, initial: 1 });
    expect(document.body.textContent).toContain('Show all (2)');
  });
  it('offers "Show earlier" only while older pages wait, and loads them on press', async () => {
    const load = vi.fn(async () => {});
    draw({ rows, totalCount: 1200, hasEarlier: true, onLoadEarlier: load, initial: 1 });
    const button = document.querySelector('[data-activity-load-earlier]');
    expect(button?.textContent).toContain('Show earlier');
    await act(async () => {
      button?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(load).toHaveBeenCalledTimes(1);
  });
  it('offers no "Show earlier" once everything is read', () => {
    draw({ rows, totalCount: 2, hasEarlier: false, initial: 1 });
    expect(document.querySelector('[data-activity-load-earlier]')).toBeNull();
  });
});

describe('a change reads in words', () => {
  it('reads a start page and a shared-with list, never a raw value or id', () => {
    const host = draw({
      rows: [
        row('r1', '2026-11-08T09:00:00Z', [
          {
            entity: 'profile',
            action: 'update',
            fields: ['start_page', 'shared_with'],
            before: { start_page: 'my_day', shared_with: [PERSON_A] },
            after: { start_page: 'tasks', shared_with: [PERSON_A, PERSON_B] },
          },
        ]),
      ],
    });
    const text = host.textContent ?? '';
    expect(text).toContain('Start page: My day → Tasks');
    expect(text).toContain('Shared with: TEST Person A → TEST Person A, TEST Person B');
    expect(text).not.toContain('my_day');
    expect(text).not.toContain(PERSON_A);
    expect(text).not.toContain(PERSON_B);
  });
  it('reads a file hash as SHA-256', () => {
    const host = draw({
      rows: [
        row('r1', '2026-11-08T09:00:00Z', [
          {
            entity: 'file',
            action: 'update',
            fields: ['sha256'],
            before: { sha256: 'aaa' },
            after: { sha256: 'bbb' },
          },
        ]),
      ],
    });
    expect(host.textContent).toContain('SHA-256: aaa → bbb');
    expect(host.textContent).not.toContain('Sha256');
  });
  it('names an added capability and setting by their words, not their keys (O1)', () => {
    const host = draw({
      rows: [
        row('r1', '2026-11-08T09:00:00Z', [
          { entity: 'capability', action: 'insert', fields: ['key'], after: { key: 'tasks.assign_own' } },
        ]),
        row('r2', '2026-11-08T08:00:00Z', [
          { entity: 'setting', action: 'insert', fields: ['key'], after: { key: 'app.arabic_enabled' } },
        ]),
      ],
    });
    const text = host.textContent ?? '';
    expect(text).toContain('Assign a task I own or created');
    expect(text).toContain('Arabic');
    expect(text).not.toContain('tasks.assign_own');
    expect(text).not.toContain('app.arabic_enabled');
  });
});
