// @vitest-environment jsdom
/**
 * Landing 35, item 2 (the owner's live sweep of 21 Nov): "Tasks search only filters after Enter."
 *  - Typing alone asks: a pause of 250 ms after the last key moves the address to the box's words — once, not once per
 *    letter. The address is REPLACED, never pushed, so Back is not walked through every letter.
 *  - Emptying the box drops the search; Enter asks at once and is not asked a second time by the timer.
 *  - Every other choice stays in the address: the tab, the board, the chips.
 *  - The box is never rewritten by an answer to its own question — an older answer ("ab") arriving after the person
 *    typed on ("abc") leaves the box, its focus and its caret alone — but it does follow a search set by another hand.
 * Every value is made up.
 * Sabotages: tests/sabotage/landing-35-tasks.mjs.
 */
import { NextIntlClientProvider } from 'next-intl';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../../messages/en.json';
import {
  SEARCH_DEBOUNCE_MS,
  searchBoxOnAddress,
  searchHref,
  searchTerm,
  type TaskFilters,
} from '../../../src/modules/tasks/rules';
import { ME, STATUSES, row } from './fixtures';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
(globalThis as { ResizeObserver?: unknown }).ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
(globalThis as { matchMedia?: unknown }).matchMedia = () => ({ matches: false, addListener() {}, removeListener() {} });
Element.prototype.scrollIntoView = () => {};

const { replaced, pushed } = vi.hoisted(() => ({ replaced: [] as string[], pushed: [] as string[] }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: (href: string) => pushed.push(href),
    replace: (href: string) => replaced.push(href),
    refresh: () => {},
  }),
}));
vi.mock('@/core/auth/me-context', () => ({
  useMe: () => ({ person: { id: ME }, capabilities: [], levels: { tasks: 'own' } }),
  useMaybeMe: () => null,
}));
vi.mock('@/core/db/rpc', () => ({ rpc: vi.fn(async () => []) }));

const { TaskListScreen } = await import('../../../src/modules/tasks/screens/TaskListScreen');

const lookups = { statuses: STATUSES, priorities: [], org: null, partners: [], projects: [], failed: [] } as never;
const ROWS = [row({ id: 's1', number: 'TSK-2026-0301', title: 'Made-up visa task' })];

let root: Root | null = null;
let host: HTMLDivElement;
const screen = (filters: TaskFilters) => (
  <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Riyadh">
    <TaskListScreen data={{ filters, list: { rows: ROWS, total: ROWS.length, more: false }, lookups, adding: false }} />
  </NextIntlClientProvider>
);
/** Draws the screen at an address — or, when it is already drawn, hands it the address's answer (as the router does). */
const arrive = async (filters: TaskFilters) => {
  if (!root) {
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
  }
  await act(async () => root!.render(screen(filters)));
};
const box = () => host.querySelector<HTMLInputElement>('input[type="search"]')!;
const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
/** Types into the box as a person does: the whole new text, one input event. */
const type = async (text: string) => {
  await act(async () => {
    setValue.call(box(), text);
    box().dispatchEvent(new Event('input', { bubbles: true }));
  });
};
const wait = (ms: number) => act(async () => void vi.advanceTimersByTime(ms));
const enter = () =>
  act(async () => void box().form!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));

beforeEach(() => {
  vi.useFakeTimers();
  window.history.replaceState(null, '', '/tasks');
});
afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.innerHTML = '';
  replaced.length = 0;
  pushed.length = 0;
  vi.useRealTimers();
});

describe('the search asks as it is typed in', () => {
  it('typing alone moves the address to the box’s words after a short pause — no Enter', async () => {
    await arrive({ scope: 'my_work' });
    await type('visa');
    expect(replaced, 'not before the pause').toEqual([]);
    await wait(SEARCH_DEBOUNCE_MS - 1);
    expect(replaced, 'not before the pause is over').toEqual([]);
    await wait(1);
    expect(replaced).toEqual(['/tasks?q=visa']);
  });

  it('the pause is about a quarter of a second', () => {
    expect(SEARCH_DEBOUNCE_MS).toBeGreaterThanOrEqual(200);
    expect(SEARCH_DEBOUNCE_MS).toBeLessThanOrEqual(300);
  });

  it('the address is replaced, never pushed, so Back is not walked through every letter', async () => {
    await arrive({ scope: 'my_work' });
    await type('visa');
    await wait(SEARCH_DEBOUNCE_MS);
    expect(replaced).toHaveLength(1);
    expect(pushed).toEqual([]);
  });

  it('letters typed quickly are one question, for the last text', async () => {
    await arrive({ scope: 'my_work' });
    for (const text of ['v', 'vi', 'vis', 'visa']) {
      await type(text);
      await wait(100);
    }
    expect(replaced, 'nothing while the keys keep coming').toEqual([]);
    await wait(SEARCH_DEBOUNCE_MS);
    expect(replaced).toEqual(['/tasks?q=visa']);
  });

  it('emptying the box drops the search', async () => {
    window.history.replaceState(null, '', '/tasks?q=visa');
    await arrive({ scope: 'my_work', q: 'visa' });
    expect(box().value).toBe('visa');
    await type('');
    await wait(SEARCH_DEBOUNCE_MS);
    expect(replaced).toEqual(['/tasks']);
  });

  it('Enter asks at once, and the timer does not ask the same again', async () => {
    await arrive({ scope: 'my_work' });
    await type('visa');
    await enter();
    expect(replaced).toEqual(['/tasks?q=visa']);
    await wait(SEARCH_DEBOUNCE_MS * 4);
    expect(replaced, 'one question').toEqual(['/tasks?q=visa']);
  });

  it('a box that says what the address holds asks nothing', async () => {
    await arrive({ scope: 'my_work', q: 'visa' });
    await wait(SEARCH_DEBOUNCE_MS * 4);
    await type('visa  ');
    await wait(SEARCH_DEBOUNCE_MS * 4);
    expect(replaced).toEqual([]);
  });

  it('the tab, the board and the chips stay in the address — on every tab and layout', async () => {
    for (const [filters, href] of [
      [{ scope: 'team', layout: 'board', status: 'open' }, '/tasks?view=team&layout=board&status=open&q=visa'],
      [
        { scope: 'owned', layout: 'calendar', month: '2099-03' },
        '/tasks?view=owned&layout=calendar&month=2099-03&q=visa',
      ],
      [{ scope: 'helping' }, '/tasks?view=helping&q=visa'],
      [{ scope: 'past' }, '/tasks?view=past&q=visa'],
    ] as [TaskFilters, string][]) {
      await arrive(filters);
      await type('visa');
      await wait(SEARCH_DEBOUNCE_MS);
      expect(replaced.at(-1), filters.scope).toBe(href);
      act(() => root?.unmount());
      root = null;
    }
  });
});

describe('the box is the person’s while they type', () => {
  it('an older answer arriving after more was typed leaves the box, its focus and its caret alone', async () => {
    await arrive({ scope: 'my_work' });
    box().focus();
    await type('ab');
    await wait(SEARCH_DEBOUNCE_MS);
    await type('abc');
    box().setSelectionRange(3, 3);
    // the answer to "ab" arrives while "abc" is in the box
    await arrive({ scope: 'my_work', q: 'ab' });
    expect(box().value, 'the last letter is not eaten').toBe('abc');
    expect(document.activeElement, 'the box keeps the focus').toBe(box());
    expect(box().selectionStart, 'the caret stays at the end').toBe(3);
    // and the newer words are still asked for
    await wait(SEARCH_DEBOUNCE_MS);
    expect(replaced).toEqual(['/tasks?q=ab', '/tasks?q=abc']);
  });

  it('the same input element lives through an answer (it is not drawn anew)', async () => {
    await arrive({ scope: 'my_work' });
    const before = box();
    await type('visa');
    await wait(SEARCH_DEBOUNCE_MS);
    await arrive({ scope: 'my_work', q: 'visa' });
    expect(box()).toBe(before);
    expect(box().value).toBe('visa');
  });

  it('a search set by another hand (Clear all, a saved view, Back) is shown in the box', async () => {
    await arrive({ scope: 'my_work' });
    await type('visa');
    await wait(SEARCH_DEBOUNCE_MS);
    await arrive({ scope: 'my_work', q: 'visa' });
    await arrive({ scope: 'my_work', q: 'hotel' });
    expect(box().value).toBe('hotel');
    await arrive({ scope: 'my_work' });
    expect(box().value).toBe('');
    await wait(SEARCH_DEBOUNCE_MS * 4);
    expect(replaced, 'following the address asks nothing').toEqual(['/tasks?q=visa']);
  });
});

describe('the rules behind the box', () => {
  it('the words asked for are the box’s, trimmed and no longer than the address keeps', () => {
    expect(searchTerm('  visa ')).toBe('visa');
    expect(searchTerm('   ')).toBeUndefined();
    expect(searchTerm('x'.repeat(140))).toHaveLength(100);
  });

  it('there is an address to move to only when the box and the address differ', () => {
    expect(searchHref({ scope: 'team', q: 'visa' }, ' visa ')).toBeNull();
    expect(searchHref({ scope: 'team' }, '  ')).toBeNull();
    expect(searchHref({ scope: 'team', q: 'visa' }, '')).toBe('/tasks?view=team');
    expect(searchHref({ scope: 'team' }, 'visa')).toBe('/tasks?view=team&q=visa');
  });

  it('an answer the box asked for never moves the box; once the newest is answered the older are forgotten', () => {
    expect(searchBoxOnAddress('ab', ['ab', 'abc'])).toEqual({ follow: false, asked: ['ab', 'abc'] });
    expect(searchBoxOnAddress('abc', ['ab', 'abc'])).toEqual({ follow: false, asked: ['abc'] });
    expect(searchBoxOnAddress(undefined, ['abc', ''])).toEqual({ follow: false, asked: [''] });
  });

  it('a search the box did not ask for moves it, and starts the memory again', () => {
    expect(searchBoxOnAddress('hotel', ['ab', 'abc'])).toEqual({ follow: true, asked: [] });
    expect(searchBoxOnAddress(undefined, ['abc'])).toEqual({ follow: true, asked: [] });
    expect(searchBoxOnAddress('visa', [])).toEqual({ follow: true, asked: [] });
  });
});
