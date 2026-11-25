// @vitest-environment jsdom
/**
 * Landing 34, items 8 and 10 (the 19 Nov test round): a search result that "just closed the search", a notice and a
 * menu tap that "did nothing". A move made in code (`router.push`) now tells the shell first, so the top bar's Loading
 * shows at once — before, only a click on a link did; the search asks for the record's page BEFORE it closes; a notice
 * opens its page without waiting for "mark read" to be written; and after 400 ms the wait is said in words too.
 * Every name and address is made up.
 * Sabotage: tests/sabotage/landing-34-shell.mjs.
 */
import { NextIntlClientProvider } from 'next-intl';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../../messages/en.json';
import { SEARCH_PAUSE_MS } from '../../../src/ui/shell/search-pause';
import type { Me } from '../../../src/core/auth/me';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
(globalThis as { ResizeObserver?: unknown }).ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
(globalThis as { matchMedia?: unknown }).matchMedia = () => ({ matches: false, addListener() {}, removeListener() {} });
Element.prototype.scrollIntoView = () => {};

const { rpcMock, pushed, order } = vi.hoisted(() => ({
  rpcMock: vi.fn(),
  pushed: [] as string[],
  order: [] as string[],
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: (href: string) => {
      pushed.push(href);
      order.push(`push ${href}`);
    },
    refresh: () => {},
  }),
  usePathname: () => window.location.pathname,
  useSearchParams: () => new URLSearchParams(window.location.search),
}));
vi.mock('@/core/auth/me-context', () => ({
  useMe: () =>
    ({
      status: 'ok',
      person: { id: 'p1', role: null },
      levels: { clients: 'view', tasks: 'own' },
      capabilities: [],
      departments: [],
      profile: null,
    }) as unknown as Me,
  useMaybeMe: () => null,
}));
vi.mock('@/core/db/rpc', () => ({ rpc: rpcMock }));

const store = await import('../../../src/ui/shell/nav-pending');
const { CommandPalette } = await import('../../../src/ui/shell/CommandPalette');
const { NotificationsPanel } = await import('../../../src/ui/shell/NotificationsPanel');
const { NavProgress, PendingPill } = await import('../../../src/ui/shell/NavProgress');

const ORG = { id: '11111111-1111-4111-8111-111111111111', number: 'ORG-990001' };

let root: Root | null = null;
beforeEach(() => {
  window.history.replaceState(null, '', '/my-day');
  store.navSettled();
  pushed.length = 0;
  order.length = 0;
});
afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.innerHTML = '';
  rpcMock.mockReset();
  store.navSettled();
});

const mount = async (node: React.ReactNode) => {
  const host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(
      <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Riyadh">
        {node}
      </NextIntlClientProvider>,
    );
  });
};
const flush = () =>
  act(async () => {
    // Landing 51: the search asks once the typing has paused (SEARCH_PAUSE_MS), so the wait covers the pause
    await new Promise((r) => setTimeout(r, SEARCH_PAUSE_MS + 20));
  });

describe('a move made in code says so to the shell', () => {
  it('to another address: a move is on its way from the address we are on, until the page arrives', () => {
    expect(store.navPending()).toBe(false);
    expect(store.navStartedTo('/partners/abc')).toBe(true);
    expect(store.navLeftFrom()).toBe('/my-day?');
    expect(store.navPending()).toBe(true);
    // the page has arrived: the address is the new one, and the shell settles the move
    window.history.replaceState(null, '', '/partners/abc');
    expect(store.navPending(), 'not pending from an address we have left').toBe(false);
    store.navSettled();
    expect(store.navLeftFrom()).toBeNull();
  });
  it('to the address we are already on, or another site: nothing is on its way (no bar that could never clear)', () => {
    expect(store.navStartedTo('/my-day')).toBe(false);
    expect(store.navStartedTo('https://other.example.test/tasks')).toBe(false);
    expect(store.navLeftFrom()).toBeNull();
    expect(store.navStartedTo('/my-day?tab=team'), 'a query change is a move').toBe(true);
  });
  it('a move that never arrives stops showing after 20 s', () => {
    vi.useFakeTimers();
    try {
      store.navStarted();
      expect(store.navPending()).toBe(true);
      vi.advanceTimersByTime(store.NAV_PENDING_MAX_MS + 1);
      expect(store.navPending()).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
  it('the shell shows the bar and the words Loading for a move made in code, and takes them away when it lands', async () => {
    await mount(<NavProgress />);
    expect(document.querySelector('[data-nav-pending]')).toBeNull();
    await act(async () => {
      store.navStartedTo('/tasks/TSK-2026-0001');
    });
    expect(document.querySelector('[data-nav-pending]'), 'the bar, at once').not.toBeNull();
    expect(document.querySelector('[data-nav-pending-pill]')?.textContent).toBe('Loading');
    await act(async () => {
      store.navSettled();
    });
    expect(document.querySelector('[data-nav-pending]')).toBeNull();
    expect(document.querySelector('[data-nav-pending-pill]')).toBeNull();
  });
  it('the words are for the eye (the bar says it to a screen reader) and wait 400 ms before they show', () => {
    const html = renderToStaticMarkup(<PendingPill label="Loading" />);
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('show-late');
    expect(html).toContain('Loading');
  });
});

describe('a search result opens its record (item 8)', () => {
  const type = async (text: string) => {
    const input = document.querySelector('input[placeholder="Go to a page or search…"]') as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!;
    await act(async () => {
      setter.call(input, text);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
  };
  const found = () => ({
    people: [],
    partners: [{ ...ORG, trade_name_en: 'Made-up Org', trade_name_ar: null, matched_by: 'name' }],
    codes: [],
    tasks: [],
  });
  const open = async (onOpenChange: (o: boolean) => void) => {
    rpcMock.mockResolvedValue(found());
    await mount(<CommandPalette open onOpenChange={onOpenChange} />);
    await type('made');
    await flush();
    const item = document.querySelector(`[data-palette-partner="${ORG.id}"]`) as HTMLElement;
    expect(item, 'the organisation is listed').not.toBeNull();
    return item;
  };

  it('a click on an organisation asks the router for its page first, shows Loading, then closes the search', async () => {
    const item = await open((o) => order.push(`search ${o ? 'open' : 'closed'}`));
    await act(async () => {
      item.click();
    });
    expect(pushed).toEqual([`/partners/${ORG.id}`]);
    expect(order, 'the page is asked for before the search closes').toEqual([
      `push /partners/${ORG.id}`,
      'search closed',
    ]);
    expect(store.navPending(), 'the shell knows a page is on its way').toBe(true);
  });
  it('Enter on the result does the same', async () => {
    const closed: boolean[] = [];
    const item = await open((o) => closed.push(o));
    // cmdk selects the item under the pointer; Enter in the box then opens it
    await act(async () => {
      item.dispatchEvent(new MouseEvent('pointermove', { bubbles: true }));
    });
    const input = document.querySelector('input[placeholder="Go to a page or search…"]') as HTMLInputElement;
    await act(async () => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });
    expect(pushed).toEqual([`/partners/${ORG.id}`]);
    expect(closed).toEqual([false]);
  });
  it('the record we are already on is not asked for again: the search just closes', async () => {
    window.history.replaceState(null, '', `/partners/${ORG.id}`);
    const closed: boolean[] = [];
    const item = await open((o) => closed.push(o));
    await act(async () => {
      item.click();
    });
    expect(pushed).toEqual([]);
    expect(closed).toEqual([false]);
    expect(store.navPending()).toBe(false);
  });
});

describe('a notice opens its record without waiting for "mark read" (item 10)', () => {
  it('the page is asked for first; the write goes beside it', async () => {
    let written: (() => void) | undefined;
    const markRead = vi.fn(
      () =>
        new Promise<void>((done) => {
          order.push('mark read begins');
          written = () => {
            order.push('mark read written');
            done();
          };
        }),
    );
    const now = new Date().toISOString();
    await mount(
      <NotificationsPanel
        open
        onOpenChange={(o) => order.push(`bell ${o ? 'open' : 'closed'}`)}
        tab="all"
        onTabChange={() => {}}
        items={[
          {
            id: 'n1',
            kind: 'assigned',
            entity: 'task',
            entity_id: 'TSK-2026-0001',
            request_id: null,
            actor_id: null,
            actor_name_en: 'Made-up Person',
            actor_name_ar: null,
            label_key: null,
            label_args: null,
            created_at: now,
            read_at: null,
            title: 'Made-up task',
          },
        ]}
        tabUnread={() => 0}
        failed={false}
        reload={async () => {}}
        markRead={markRead as never}
        snooze={(async () => {}) as never}
      />,
    );
    const link = document.querySelector('[data-notification-link]') as HTMLElement | null;
    expect(link, 'the notice is a way to its record').not.toBeNull();
    await act(async () => {
      link!.click();
    });
    expect(order.slice(0, 2), 'the page before the write has answered').toEqual([
      'push /tasks/TSK-2026-0001',
      'bell closed',
    ]);
    expect(order).toContain('mark read begins');
    expect(order).not.toContain('mark read written');
    await act(async () => {
      written?.();
    });
  });
});
