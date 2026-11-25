// @vitest-environment jsdom
/**
 * Landing 52 (FIX-13, the F1 live re-test of 25 Nov): the top search sent one request for every letter typed —
 * seven at once for one word, each slow while the others ran, one cut off — and a request that failed was shown as
 * "Nothing matches". Now: one request once the typing pauses, for the words as they stand; a request lost on its
 * way is asked again by itself (rpc's `retry`); one that still fails says so, with Try again; and "Nothing matches"
 * is kept for a search the server answered. An organisation the server finds is listed. Every value is made up.
 * Sabotage: tests/sabotage/landing-52.mjs.
 */
import { NextIntlClientProvider } from 'next-intl';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import en from '../../../messages/en.json';
import type { Me } from '../../../src/core/auth/me';
import { SEARCH_PAUSE_MS } from '../../../src/ui/shell/search-pause';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
(globalThis as { ResizeObserver?: unknown }).ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
(globalThis as { matchMedia?: unknown }).matchMedia = () => ({
  matches: false,
  addListener() {},
  removeListener() {},
});
Element.prototype.scrollIntoView = () => {};

const { rpcMock } = vi.hoisted(() => ({ rpcMock: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {}, refresh: () => {} }) }));
vi.mock('@/core/auth/me-context', () => ({
  useMe: () =>
    ({
      status: 'ok',
      person: { id: 'p1', role: null },
      levels: { partners: 'view' },
      capabilities: [],
      departments: [],
      profile: null,
    }) as unknown as Me,
  useMaybeMe: () => null,
}));
vi.mock('@/core/db/rpc', () => ({ rpc: rpcMock }));

const { CommandPalette } = await import('../../../src/ui/shell/CommandPalette');

let root: Root | null = null;
afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.innerHTML = '';
  rpcMock.mockReset();
});

const draw = async () => {
  const host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(
      <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Riyadh">
        <CommandPalette open onOpenChange={() => {}} />
      </NextIntlClientProvider>,
    );
  });
};

const type = async (text: string) => {
  const input = document.querySelector('input[placeholder="Go to a page or search…"]') as HTMLInputElement;
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!;
  await act(async () => {
    setter.call(input, text);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
};

const wait = async (ms: number) => {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });
};
const pause = () => wait(SEARCH_PAUSE_MS + 30);

const ORG_ID = '22222222-2222-4222-8222-222222222222';
const nothing = { people: [], partners: [], codes: [], tasks: [], invoices: [] };
const found = {
  ...nothing,
  partners: [
    { id: ORG_ID, number: 'DK-P-9001', trade_name_en: 'Made-up Transport Co', trade_name_ar: null, matched_by: 'name' },
  ],
};

describe('the top search asks once, promptly, and says when it fails (Landing 52, FIX-13)', () => {
  it('a word typed letter by letter is one request, for the whole word, and its organisation is listed', async () => {
    rpcMock.mockResolvedValue(found);
    await draw();
    for (const typed of ['m', 'ma', 'mad', 'made', 'made-', 'made-u', 'made-up']) {
      await type(typed);
      await wait(20); // faster than the pause: nothing is asked yet
    }
    expect(rpcMock, 'nothing is asked while the letters are still coming').not.toHaveBeenCalled();
    expect(document.querySelector('[data-palette-searching]'), 'the box says Searching meanwhile').not.toBeNull();
    await pause();
    expect(rpcMock, 'one request for the whole word').toHaveBeenCalledTimes(1);
    expect(rpcMock).toHaveBeenCalledWith('search', { p_q: 'made-up', p_limit: 8 }, { retry: true });
    const row = document.querySelector(`[data-palette-partner="${ORG_ID}"]`);
    expect(row, 'the organisation the server found is listed').not.toBeNull();
    expect(row?.textContent).toContain('Made-up Transport Co');
    expect(row?.textContent).toContain('DK-P-9001');
    expect(document.querySelector('[data-palette-searching]')).toBeNull();
  });

  it('the pause is short: under a third of a second', () => {
    expect(SEARCH_PAUSE_MS).toBeGreaterThanOrEqual(150);
    expect(SEARCH_PAUSE_MS).toBeLessThanOrEqual(300);
  });

  it('a search that fails says so, with Try again — never "Nothing matches"', async () => {
    rpcMock.mockRejectedValue(new Error('made up: the request was cut off'));
    await draw();
    await type('made-up');
    await pause();
    const failed = document.querySelector('[data-palette-search-failed]');
    expect(failed, 'the failure is said').not.toBeNull();
    expect(failed?.textContent).toContain('Search did not answer.');
    expect(failed?.textContent).toContain('Try again');
    expect(document.body.textContent, 'a failed search is not "Nothing matches"').not.toContain('Nothing matches');

    // Try again asks once more, and the answer shows
    rpcMock.mockReset();
    rpcMock.mockResolvedValue(found);
    await act(async () => {
      failed!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await pause();
    expect(rpcMock, 'Try again asks the same words again').toHaveBeenCalledWith(
      'search',
      { p_q: 'made-up', p_limit: 8 },
      { retry: true },
    );
    expect(document.querySelector(`[data-palette-partner="${ORG_ID}"]`), 'and the answer shows').not.toBeNull();
    expect(document.querySelector('[data-palette-search-failed]')).toBeNull();
  });

  it('"Nothing matches" is said only once the server has answered with nothing', async () => {
    rpcMock.mockResolvedValue(nothing);
    await draw();
    await type('zzzz');
    expect(document.body.textContent, 'not before the answer').not.toContain('Nothing matches');
    await pause();
    expect(document.body.textContent).toContain('Nothing matches');
    expect(document.querySelector('[data-palette-search-failed]')).toBeNull();
  });
});
