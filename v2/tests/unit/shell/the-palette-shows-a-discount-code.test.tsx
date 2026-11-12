// @vitest-environment jsdom
/**
 * F-B1-01 + F-B3-03 (Landing 15): Ctrl-K finds a discount code by its text, under a DISCOUNT CODES group
 * that opens the code's detail — and no longer returns a NOTES group, even when the answer still carries
 * notes. Every value is made up.
 * Sabotage: tests/sabotage/screens.mjs "search-box-shows-no-codes".
 */
import { NextIntlClientProvider } from 'next-intl';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import en from '../../../messages/en.json';
import type { Me } from '../../../src/core/auth/me';

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
      levels: { codes: 'view' },
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

const flush = async () => {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
};

const CODE_ID = '11111111-1111-4111-8111-111111111111';

describe('the palette shows a discount code', () => {
  it('the code is found by its text, under Discount codes, and no note shows', async () => {
    rpcMock.mockResolvedValue({
      people: [],
      partners: [],
      codes: [{ id: CODE_ID, code: 'FLIGHTS10', state: 'active' }],
      tasks: [],
      notes: [{ id: 'note-1', label: 'Made-up Al Safa note', capture_kind: 'note' }],
    });
    await draw();
    await type('flights10');
    await flush();
    await flush();
    expect(rpcMock).toHaveBeenCalledWith('search', { p_q: 'flights10', p_limit: 8 });
    const row = document.querySelector(`[data-palette-code="${CODE_ID}"]`);
    expect(row, 'the code is found by its text').not.toBeNull();
    expect(row?.textContent).toContain('FLIGHTS10');
    expect(row?.textContent).toContain('Active');
    expect(document.body.textContent).toContain('Discount codes');
    expect(document.querySelector('[data-palette-note]'), 'and no note shows').toBeNull();
  });

  it('and nothing when no code carries the text', async () => {
    rpcMock.mockResolvedValue({ people: [], partners: [], codes: [], tasks: [] });
    await draw();
    await type('flights10');
    await flush();
    await flush();
    expect(document.querySelector('[data-palette-code]')).toBeNull();
    expect(document.body.textContent).toContain('Nothing matches');
  });
});
