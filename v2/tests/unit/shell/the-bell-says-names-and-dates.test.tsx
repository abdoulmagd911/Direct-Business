// @vitest-environment jsdom
/**
 * The bell (26 Oct): a line says the record's NAME, not its type; a due-date notice past its day says overdue, on its
 * day due today, never "coming due"; Today is a group; the unread count sits on the group header, not between rows.
 * Every name is made up. Sabotages: tests/sabotage/screens.mjs "bell-says-the-type-not-the-name",
 * "bell-says-coming-due-when-late", "bell-today-is-not-a-group", "bell-group-header-has-no-unread".
 */
import { NextIntlClientProvider } from 'next-intl';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import en from '../../../messages/en.json';
import type { Notification } from '../../../src/core/notify/useNotifications';
import { dueState, groupOf, recordName } from '../../../src/ui/shell/bell-words';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
(globalThis as { ResizeObserver?: unknown }).ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {}, refresh: () => {} }) }));
// the server's clock for this page load: 26 Oct 2026, 12:00 in Riyadh
vi.mock('@/core/auth/me-context', () => ({ useMe: () => ({ session: { last_seen_at: '2026-10-26T09:00:00Z' } }) }));

const { NotificationsPanel } = await import('../../../src/ui/shell/NotificationsPanel');

const NOW = new Date('2026-10-26T09:00:00Z');
const row = (id: string, extra: Partial<Notification> = {}): Notification => ({
  id,
  kind: 'assigned',
  entity: 'task',
  entity_id: null,
  request_id: null,
  actor_id: null,
  actor_name_en: 'TEST Person',
  actor_name_ar: null,
  label_key: null,
  label_args: null,
  created_at: '2026-10-26T08:00:00Z',
  read_at: null,
  ...extra,
});

describe('record names and due words', () => {
  it('says the name the server gave, else the name the notice carries, and only then the type', () => {
    expect(recordName(row('a', { title: 'TEST Task A' }), 'en', 'Task')).toBe('TEST Task A');
    expect(recordName(row('b', { label_args: { title: 'TEST Late task' } }), 'en', 'Task')).toBe('TEST Late task');
    expect(recordName(row('c'), 'en', 'Task')).toBe('Task');
  });

  it('puts a due-date notice at overdue, due today or coming, by its day against the server clock', () => {
    const due = (d: string) => row('d', { kind: 'alert_due_tomorrow', label_args: { due_on: d } });
    expect(dueState(due('2026-10-25'), NOW)).toBe('overdue');
    expect(dueState(due('2026-10-26'), NOW)).toBe('today');
    expect(dueState(due('2026-10-27'), NOW)).toBe('coming');
    expect(dueState(row('e'), NOW)).toBeNull();
  });

  it('groups a notice made today under Today', () => {
    expect(groupOf('2026-10-26T08:00:00Z', NOW)).toBe('today');
    expect(groupOf('2026-10-25T08:00:00Z', NOW)).toBe('yesterday');
    expect(groupOf('2026-10-20T08:00:00Z', NOW)).toBe('earlier');
  });
});

let root: Root | null = null;
afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.innerHTML = '';
});
const draw = (items: Notification[], markRead: (ids?: string[]) => Promise<void> = async () => {}) => {
  const host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  act(() => {
    root!.render(
      <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Riyadh">
        <NotificationsPanel
          open
          onOpenChange={() => {}}
          tab="all"
          onTabChange={() => {}}
          items={items}
          tabUnread={() => 0}
          failed={false}
          reload={async () => {}}
          markRead={markRead}
          snooze={async () => {}}
        />
      </NextIntlClientProvider>,
    );
  });
};

describe('the panel', () => {
  const items = [
    row('1', { title: 'TEST Task A' }),
    row('2', { title: 'TEST Task B', read_at: '2026-10-26T08:30:00Z' }),
    row('3', { kind: 'alert_due_tomorrow', label_args: { title: 'TEST Late task', due_on: '2026-10-25' } }),
    row('4', { created_at: '2026-10-25T08:00:00Z', title: 'TEST Task C' }),
  ];

  it('names the record, and says overdue for a task past its day', () => {
    draw(items);
    const text = document.body.textContent ?? '';
    expect(text).toContain('assigned you TEST Task A');
    expect(text).toContain('TEST Late task is overdue');
    expect(text).not.toContain('coming due');
    expect(text).not.toContain('assigned you Task');
  });

  it('has a Today group, with its unread count on the header and no label between the rows', () => {
    draw(items);
    const today = document.querySelector('[data-notifications-group="today"]');
    expect(today, 'a Today group').not.toBeNull();
    expect(today!.querySelector('h3')!.textContent).toContain('Today');
    expect(today!.querySelector('[data-notifications-group-unread]')!.textContent).toBe('2 unread');
    expect(document.querySelectorAll('li .sr-only').length, 'no loose unread label between rows').toBe(0);
  });
});

describe('marking one notice read', () => {
  it('has a Mark as read button on each unread row, beside the snooze, and none on a read row', () => {
    const marked: (string[] | undefined)[] = [];
    draw(
      [row('u1', { title: 'TEST Task A' }), row('r1', { title: 'TEST Task B', read_at: '2026-10-26T08:30:00Z' })],
      async (ids) => {
        marked.push(ids);
      },
    );
    const unread = document.querySelector('[data-notification="u1"]')!;
    const read = document.querySelector('[data-notification="r1"]')!;
    const button = unread.querySelector<HTMLButtonElement>('[data-notification-mark-read]');
    expect(button, 'a button on the unread row').not.toBeNull();
    expect(button!.getAttribute('aria-label')).toBe('Mark as read');
    expect(unread.querySelector('[data-notification-snooze]'), 'beside the snooze').not.toBeNull();
    expect(read.querySelector('[data-notification-mark-read]'), 'none on a read row').toBeNull();
    act(() => button!.click());
    expect(marked, 'marks only that notice').toEqual([['u1']]);
  });
});
