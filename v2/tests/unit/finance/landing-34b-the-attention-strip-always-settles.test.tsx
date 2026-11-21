/**
 * Landing 34, the follow-up (the owner on the live site: "What needs attention" sticks on Loading, and sometimes fails
 * to load). The Needs attention strip ALWAYS settles, from its own read alone: drawn with its figures when the read
 * answered; not there at all when the database refused the reader (no "Loading", no error); failed in words with Try
 * again when the read could not be made or answered nothing; and it never waits for another block — the months or
 * the closed months may be on their way, failed or refused, and the strip is drawn all the same.
 * Every value is made up.
 * Sabotage: tests/sabotage/landing-34b-finance.mjs.
 */
import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import en from '../../../messages/en.json';
import { attentionState, healthOf } from '../../../src/modules/finance/figures';
import { FinanceOverview } from '../../../src/modules/finance/screens/FinanceOverview';
import type { OverviewData } from '../../../src/modules/finance/types';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => {}, push: () => {} }) }));

const whole: OverviewData = {
  period: {
    from: '2026-01-01',
    to: '2026-11-20',
    units: 3,
    revenue: 4300,
    cost: 900,
    profit: 3400,
    provisional: { units: 0, revenue: 0, cost: 0, profit: 0 },
    losses: 0,
    months: [],
  },
  closed: [],
  health: [
    { key: 'checks_failed', count: 4, amount_sar: null },
    { key: 'no_organisation', count: 5, amount_sar: null },
  ],
  notInvoiced: { ready: { units: 0, amount_sar: 0 }, pending: { units: 0, amount_sar: 0 } },
  asOf: { as_of: '2026-11-19', files: {} },
  service: { from: '2026-01-01', to: '2026-11-20', revenue: 4300, rows: [], gap: 0 },
};

type Flags = Partial<Record<keyof OverviewData, boolean>>;
const html = (data: OverviewData, loading: Flags = {}, refused: Flags = {}) =>
  renderToStaticMarkup(
    <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Riyadh">
      <FinanceOverview
        ask={{ key: 'ytd', from: '2026-01-01', to: '2026-11-20' }}
        today="2026-11-20"
        full={false}
        data={data}
        loading={loading}
        refused={refused}
      />
    </NextIntlClientProvider>,
  );

const state = (out: string) => out.match(/data-finance-strip="([^"]*)"/)?.[1];
const flag = (out: string, kind: string) =>
  out.match(new RegExp(`data-finance-flag="${kind}" data-count="([^"]*)"`))?.[1];
const WORDS = 'What needs attention';

describe('the Needs attention strip always settles', () => {
  it('an answer draws the strip with its figures', () => {
    const out = html(whole);
    expect(state(out)).toBe('drawn');
    expect([flag(out, 'checks'), flag(out, 'no-client'), flag(out, 'late')]).toEqual(['4', '5', '0']);
  });

  it('an answer of nothing to flag (an empty list) is still an answer: the strip is drawn, every count 0', () => {
    const out = html({ ...whole, health: healthOf([]) });
    expect(state(out)).toBe('drawn');
    expect([flag(out, 'checks'), flag(out, 'no-client'), flag(out, 'late')]).toEqual(['0', '0', '0']);
  });

  it('a refusal leaves no strip at all — no Loading, no error, no Try again', () => {
    const out = html({ ...whole, health: null }, {}, { health: true });
    expect(state(out)).toBe('hidden');
    expect(out).not.toContain('data-finance-attention');
    expect(out).not.toContain(WORDS);
    expect(out).not.toContain('data-state="loading"');
    expect(out).not.toContain('data-state="failed"');
    expect(out).not.toContain('Try again');
    // the rest of the page is there
    expect(out).toContain('data-finance-tiles');
  });

  it('a read that truly failed says so in words, with Try again', () => {
    const out = html({ ...whole, health: null });
    expect(state(out)).toBe('failed');
    expect(out).toContain(`${WORDS} could not be loaded`);
    expect(out).toContain('Try again');
    expect(out).not.toContain('data-state="loading"');
  });

  it('an answer of nothing at all (null, or not a list) is a failed read with Try again — never Loading, never figures', () => {
    expect(healthOf(null)).toBeNull();
    expect(healthOf(undefined)).toBeNull();
    expect(healthOf({ key: 'checks_failed', count: 4 })).toBeNull();
    const out = html({ ...whole, health: healthOf(null) });
    expect(state(out)).toBe('failed');
    expect(out).toContain('Try again');
    expect(out).not.toContain('data-finance-flag');
  });

  it('is Loading only while its own read is on its way', () => {
    const out = html({ ...whole, health: null }, { health: true });
    expect(state(out)).toBe('loading');
    expect(out).toContain(`Loading ${WORDS}`);
    expect(out).not.toContain('Try again');
  });

  it('does not wait for a sibling: the months and the closed months on their way, failed or refused', () => {
    for (const [name, out] of [
      ['closed on its way', html({ ...whole, closed: null }, { closed: true })],
      ['closed failed', html({ ...whole, closed: null })],
      ['closed refused', html({ ...whole, closed: null }, {}, { closed: true })],
      ['figures on their way', html({ ...whole, period: null }, { period: true })],
      ['figures and closed failed', html({ ...whole, period: null, closed: null })],
    ] as const) {
      expect(state(out), name).toBe('drawn');
      expect([flag(out, 'checks'), flag(out, 'no-client')], name).toEqual(['4', '5']);
    }
    // the one count that comes from the closed months is a dash while they are away, never a 0
    expect(flag(html({ ...whole, closed: null }), 'late')).toBe('unknown');
  });

  it('the four states, from the read alone', () => {
    expect(attentionState({ health: [] })).toBe('drawn');
    expect(attentionState({ health: [], loading: true, refused: true })).toBe('drawn');
    expect(attentionState({ health: null, loading: true })).toBe('loading');
    expect(attentionState({ health: null, refused: true })).toBe('hidden');
    expect(attentionState({ health: null })).toBe('failed');
    expect(attentionState({ health: null, loading: false, refused: false })).toBe('failed');
  });
});
