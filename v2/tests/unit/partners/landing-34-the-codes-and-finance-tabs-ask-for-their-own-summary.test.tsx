// @vitest-environment jsdom
/**
 * Landing 34: the record's one read no longer works out the finance summary (it was most of that read's time, and
 * why records timed out). The Codes and Finance tabs ask for it themselves — when one of them is opened, not before;
 * once for as long as the record is open; again after a change on the record — and a summary that does not load says
 * so inside the tab with a Try again that reads again. The Overview never asks. Made-up values only.
 * Sabotage: tests/sabotage/landing-34-partners.mjs.
 */
import { NextIntlClientProvider } from 'next-intl';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import en from '../../../messages/en.json';
import { DbError } from '../../../src/core/db/errors';

type Held = { fn: string; args: unknown; answer: (v: unknown) => void; fail: (e: unknown) => void };
const asked = vi.hoisted(() => [] as Held[]);
vi.mock('@/core/db/rpc', () => ({
  rpc: (fn: string, args: unknown) =>
    new Promise((answer, fail) => {
      asked.push({ fn, args, answer, fail });
    }),
}));
vi.mock('@/modules/partners/screens/record/CompanyTabs', () => ({
  CodesTab: ({ summary }: { summary: { made_up: string } | null }) => (
    <div data-stub-codes>{summary ? summary.made_up : 'no summary'}</div>
  ),
  FinanceTab: ({ summary, onRetry }: { summary: { made_up: string } | null; onRetry: () => void }) => (
    <div data-stub-finance>
      {summary ? summary.made_up : 'no summary'}
      <button type="button" data-stub-retry onClick={onRetry} />
    </div>
  ),
}));

const { SummaryTabs } = await import('../../../src/modules/partners/screens/record/SummaryTabs');

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let pageRetries = 0;
afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.innerHTML = '';
  asked.length = 0;
  pageRetries = 0;
});

const draw = (tab: string, more: { deferred?: boolean; initial?: unknown; stamp?: number } = {}) => {
  if (!root) {
    const host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
  }
  act(() => {
    root!.render(
      <NextIntlClientProvider locale="en" messages={en}>
        <SummaryTabs
          tab={tab}
          card={{ id: 'made-up-org' } as never}
          deferred={more.deferred ?? true}
          initial={(more.initial ?? null) as never}
          stamp={more.stamp ?? 0}
          onPageRetry={() => void (pageRetries += 1)}
          side="client"
          hideImported={false}
          view=""
        />
      </NextIntlClientProvider>,
    );
  });
};
const state = () => document.querySelector('[data-summary-state]')?.getAttribute('data-summary-state') ?? null;
const answer = (i: number, v: unknown) => act(async () => asked[i]!.answer(v));
const fail = (i: number, e: unknown) => act(async () => asked[i]!.fail(e));
const TIMEOUT = new DbError('Unavailable', 'common.unavailable', '57014 canceling statement due to statement timeout');

describe('the Codes and Finance tabs ask for their own summary', () => {
  it('the Overview asks for nothing and draws nothing of it', () => {
    draw('overview');
    expect(asked).toHaveLength(0);
    expect(document.body.textContent).toBe('');
    draw('history');
    draw('related');
    expect(asked).toHaveLength(0);
  });

  it('opening Codes asks once, says it is loading, then draws the tab with the summary', async () => {
    draw('overview');
    draw('codes');
    expect(asked.map((a) => [a.fn, a.args])).toEqual([['company_summary', { p_partner: 'made-up-org' }]]);
    expect(state()).toBe('loading');
    expect(document.querySelector('[data-stub-codes]'), 'no totals are drawn before they are read').toBeNull();
    await answer(0, { made_up: 'summary read once' });
    expect(state()).toBeNull();
    expect(document.querySelector('[data-stub-codes]')?.textContent).toBe('summary read once');
  });

  it('what was read is kept: Finance after Codes, and away and back, ask nothing again', async () => {
    draw('codes');
    await answer(0, { made_up: 'summary read once' });
    draw('finance');
    expect(document.querySelector('[data-stub-finance]')?.textContent).toBe('summary read once');
    draw('overview');
    draw('codes');
    expect(asked).toHaveLength(1);
    expect(document.querySelector('[data-stub-codes]')?.textContent).toBe('summary read once');
  });

  it('a summary that does not load says why inside the tab, and Try again reads again', async () => {
    draw('finance');
    await fail(0, TIMEOUT);
    expect(state()).toBe('failed');
    const box = document.querySelector('[data-summary-state="failed"]');
    expect(box?.textContent).toContain('Finance could not be loaded. It took too long and was stopped.');
    expect(box?.querySelector('[data-failure-ref]')?.textContent).toBe('Unavailable · 57014');
    expect(document.querySelector('[data-stub-finance]')).toBeNull();
    await act(async () => (document.querySelector('[data-summary-retry]') as HTMLButtonElement).click());
    expect(asked).toHaveLength(2);
    expect(state(), 'the try is seen: the tab is loading again').toBe('loading');
    await fail(1, TIMEOUT);
    expect(document.querySelector('[data-read-tried]')?.textContent).toBe('Tried again once: it still did not load.');
    await act(async () => (document.querySelector('[data-summary-retry]') as HTMLButtonElement).click());
    await answer(2, { made_up: 'read on the third try' });
    expect(state()).toBeNull();
    expect(document.querySelector('[data-stub-finance]')?.textContent).toContain('read on the third try');
    expect(pageRetries, 'the page itself is never read again for it').toBe(0);
  });

  it('after a change on the record the summary is read again, the old one staying until it lands', async () => {
    draw('finance');
    await answer(0, { made_up: 'before the change' });
    draw('finance', { stamp: 1 });
    expect(asked).toHaveLength(2);
    expect(document.querySelector('[data-stub-finance]')?.textContent).toContain('before the change');
    await answer(1, { made_up: 'after the change' });
    expect(document.querySelector('[data-stub-finance]')?.textContent).toContain('after the change');
  });

  it('a change made on another tab is read when the tab is next opened, not before', async () => {
    draw('finance');
    await answer(0, { made_up: 'before the change' });
    draw('overview', { stamp: 1 });
    expect(asked).toHaveLength(1);
    draw('finance', { stamp: 1 });
    expect(asked).toHaveLength(2);
  });

  it('a page read that still carries the summary is drawn as before, with nothing asked', () => {
    draw('codes', { deferred: false, initial: { made_up: 'from the page read' } });
    expect(asked).toHaveLength(0);
    expect(document.querySelector('[data-stub-codes]')?.textContent).toBe('from the page read');
    draw('finance', { deferred: false, initial: null });
    act(() => (document.querySelector('[data-stub-retry]') as HTMLButtonElement).click());
    expect(pageRetries).toBe(1);
  });
});
