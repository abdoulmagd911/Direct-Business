// @vitest-environment jsdom
/**
 * Landing 37 (Finance F-C, A6): the top search finds an invoice by its number — counted or not.
 * The search has answered invoices since V458 and the search box never drew them: a number typed there said "Nothing
 * matches" for an invoice that existed. Now the hit is drawn under Invoices with its number and customer; one that is
 * not fully paid yet says "Not counted yet", and opens the Finance Ledger on its own day at the Not yet counted list;
 * a counted one opens the Ledger's rows. Every value is made up.
 * Sabotage: tests/sabotage/landing-37-finance.mjs.
 */
import { NextIntlClientProvider } from 'next-intl';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import en from '../../../messages/en.json';
import { SEARCH_PAUSE_MS } from '../../../src/ui/shell/search-pause';
import type { Me } from '../../../src/core/auth/me';
import { invoiceHitCounts, invoiceHitRoute, invoiceHitsOf } from '../../../src/ui/shell/invoice-hit';

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

const { rpcMock, pushMock } = vi.hoisted(() => ({ rpcMock: vi.fn(), pushMock: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: pushMock, refresh: () => {} }) }));
vi.mock('@/core/auth/me-context', () => ({
  useMe: () =>
    ({
      status: 'ok',
      person: { id: 'p1', role: null },
      levels: { finance: 'view' },
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
  pushMock.mockReset();
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
    // Landing 51: the search asks once the typing has paused (SEARCH_PAUSE_MS), so the wait covers the pause
    await new Promise((r) => setTimeout(r, SEARCH_PAUSE_MS + 20));
  });
};

const DRAFT = {
  invoice_id: 'inv-draft',
  ref: 'MADEUP-20261113-01',
  kind: 'transaction',
  customer_name: 'Made-up New Company',
  created_on: '2026-11-13',
  total_sar: 100,
  status: 'Draft',
  pay_state: 'draft',
  source: 'manual',
};
const PAID = { ...DRAFT, invoice_id: 'inv-paid', ref: '9903700020', status: 'Fully Paid', pay_state: 'paid' };
const answer = (invoices: unknown[]) => ({ people: [], partners: [], codes: [], tasks: [], invoices });

describe('the top search finds an invoice by its number', () => {
  it('a Draft invoice is found by its number — not “Nothing matches” — and says it is not counted yet', async () => {
    rpcMock.mockResolvedValue(answer([DRAFT]));
    await draw();
    await type('MADEUP-20261113-01');
    await flush();
    await flush();
    const hit = document.querySelector('[data-palette-invoice="MADEUP-20261113-01"]');
    expect(hit, 'the invoice is found by its number').not.toBeNull();
    expect(document.body.textContent, 'under an Invoices heading').toContain('Invoices');
    expect(hit!.textContent).toContain('MADEUP-20261113-01');
    expect(hit!.textContent, 'with its customer').toContain('Made-up New Company');
    expect(hit!.textContent, 'it is not counted yet').toContain('Not counted yet');
    expect(hit!.getAttribute('data-counted')).toBe('false');
    expect(document.body.textContent, 'the empty state is not shown').not.toContain('Nothing matches');
  });

  it('pressing the hit opens the Ledger on the invoice’s day, at the Not yet counted list', async () => {
    rpcMock.mockResolvedValue(answer([DRAFT]));
    await draw();
    await type('20261113');
    await flush();
    await flush();
    await act(async () => {
      (document.querySelector('[data-palette-invoice="MADEUP-20261113-01"]') as HTMLElement).click();
    });
    expect(pushMock).toHaveBeenCalledWith(
      '/finance?period=custom&from=2026-11-13&to=2026-11-13#finance-ledger-waiting',
    );
  });

  it('a counted invoice shows its status word and no “Not counted yet”', async () => {
    rpcMock.mockResolvedValue(answer([PAID]));
    await draw();
    await type('9903700020');
    await flush();
    await flush();
    const hit = document.querySelector('[data-palette-invoice="9903700020"]')!;
    expect(hit.textContent).toContain('Fully Paid');
    expect(hit.textContent).not.toContain('Not counted yet');
    expect(hit.getAttribute('data-counted')).toBe('true');
  });

  it('no invoice in the answer draws no Invoices group', async () => {
    rpcMock.mockResolvedValue(answer([]));
    await draw();
    await type('9903700099');
    await flush();
    await flush();
    expect(document.querySelector('[data-palette-invoice]')).toBeNull();
    expect(document.body.textContent).toContain('Nothing matches');
  });
});

describe('where an invoice hit opens', () => {
  it('one that is not fully paid opens the Not yet counted list of its own day', () => {
    expect(invoiceHitRoute({ created_on: '2026-11-08', pay_state: 'pending' })).toBe(
      '/finance?period=custom&from=2026-11-08&to=2026-11-08#finance-ledger-waiting',
    );
    expect(invoiceHitRoute({ created_on: '2026-11-13', pay_state: 'draft' })).toContain('#finance-ledger-waiting');
  });

  it('a counted one opens the Ledger’s rows; a hit with no day opens the Finance page', () => {
    expect(invoiceHitRoute({ created_on: '2026-11-08', pay_state: 'paid' })).toBe(
      '/finance?period=custom&from=2026-11-08&to=2026-11-08#finance-ledger',
    );
    expect(invoiceHitRoute({ created_on: null, pay_state: 'paid' })).toBe('/finance#finance-ledger');
    expect(invoiceHitRoute({ created_on: 'not a day', pay_state: 'pending' })).toBe('/finance#finance-ledger-waiting');
  });

  it('a hit that does not say its state is not called uncounted; a hit with no number is no hit', () => {
    expect(invoiceHitCounts({})).toBe(true);
    expect(invoiceHitCounts({ pay_state: 'pending' })).toBe(false);
    expect(invoiceHitsOf({ invoices: [DRAFT, { invoice_id: 'x', ref: '' }, null] }).map((h) => h.ref)).toEqual([
      'MADEUP-20261113-01',
    ]);
    expect(invoiceHitsOf({}), 'an answer with no invoices part').toEqual([]);
  });
});
