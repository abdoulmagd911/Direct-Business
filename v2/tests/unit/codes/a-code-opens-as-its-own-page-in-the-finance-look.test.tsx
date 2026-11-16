// @vitest-environment jsdom
/**
 * Landing 31 (the V21 boards): the Discount codes page wears the Finance page's look. The list says how many codes
 * there are, filters by state on pills that carry each state's count, and a code's text is the way into its page.
 * A code (`/codes?code=<id>`) is drawn as its own page — the way back in its trail, its totals as the kit's KPI cards
 * with what was collected in the Revenue green, and one ledger where a use that is not counted says so on its row and
 * carries no figure. The in-app actions stay: Full still records a use and an attribution. Every figure is the read's
 * own; every value here is made up.
 * Sabotage: tests/sabotage/landing-31-finance-tab-codes.mjs.
 */
import { NextIntlClientProvider } from 'next-intl';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ar from '../../../messages/ar.json';
import en from '../../../messages/en.json';
import type { CodeDetail, CodeLedgerRow, CodeRow, CompanyCodeRow } from '../../../src/modules/codes/types';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {}, refresh: () => {} }) }));

const { CodesScreen } = await import('../../../src/modules/codes/screens/CodesScreen');

const row = (over: Partial<CodeRow>): CodeRow => ({
  id: 'id',
  code: 'CODE',
  valid_from: null,
  valid_to: null,
  state: 'active',
  total_discount: null,
  total_collected: null,
  units: 0,
  partner_id: 'p-1',
  partner_name: 'Made-up Travel',
  partner_name_ar: 'سفر تجريبي',
  ...over,
});
const rows = [
  row({ id: 'a', code: 'MADEUP10', total_discount: 120, total_collected: 900, units: 2 }),
  row({ id: 'b', code: 'MADEUP20', state: 'expired', total_discount: 50, total_collected: 400, units: 1 }),
  row({ id: 'c', code: 'MADEUP30', state: 'inactive' }),
];
const aUse = (over: Partial<CodeLedgerRow>): CodeLedgerRow => ({
  use_id: 'u',
  invoice_id: 'inv',
  ref: '7001',
  created_on: '2026-11-01',
  status_word: null,
  discount_sar: 60,
  source: 'manual',
  direct_url: null,
  counted: true,
  revenue: 450,
  cost: 300,
  profit: 150,
  excluded_reason: null,
  ...over,
});
const detail: CodeDetail = {
  id: 'a',
  code: 'MADEUP10',
  valid_from: '2026-11-01',
  valid_to: null,
  state: 'active',
  partner_id: 'p-1',
  partner_name: 'Made-up Travel',
  partner_name_ar: 'سفر تجريبي',
  fee_percent: 10,
  totals: { total_discount: 120, total_collected: 900, total_cost: 600, total_profit: null, units: 2 },
  ledger: [
    aUse({
      use_id: 'u-held',
      ref: '7003',
      counted: false,
      status_word: 'Partially paid',
      revenue: null,
      cost: null,
      profit: null,
      discount_sar: 77,
    }),
    aUse({ use_id: 'u-1', ref: '7001', direct_url: 'https://example.test/7001' }),
    aUse({ use_id: 'u-2', ref: '7002' }),
  ],
  attributions: [
    { id: 'at-1', partner_id: 'p-1', partner_name: 'Made-up Travel', partner_name_ar: null, is_promo: true },
  ],
};
const companyRows: CompanyCodeRow[] = [
  {
    partner_id: 'p-1',
    partner_name: 'Made-up Travel',
    codes: 2,
    total_discount: 170,
    total_collected: 1300,
    total_profit: null,
  },
];

let root: Root | null = null;
afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.innerHTML = '';
});

const draw = async (
  over: {
    locale?: 'en' | 'ar';
    detail?: CodeDetail | null;
    selectedId?: string | null;
    full?: boolean;
    detailFailed?: boolean;
    detailError?: string | null;
    listFailed?: boolean;
    companiesFailed?: boolean;
    rows?: CodeRow[];
  } = {},
) => {
  const locale = over.locale ?? 'en';
  const host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(
      <NextIntlClientProvider locale={locale} messages={locale === 'ar' ? ar : en} timeZone="Asia/Riyadh">
        <CodesScreen
          rows={over.rows ?? rows}
          detail={over.detail ?? null}
          companyRows={companyRows}
          partners={[{ id: 'p-1', name: 'Made-up Travel' }]}
          full={over.full ?? false}
          selectedId={over.selectedId ?? over.detail?.id ?? null}
          listFailed={over.listFailed ?? false}
          detailFailed={over.detailFailed ?? false}
          detailError={over.detailError ?? null}
          companiesFailed={over.companiesFailed ?? false}
          files={[]}
          filesFailed={false}
        />
      </NextIntlClientProvider>,
    );
  });
};

const q = (sel: string) => document.querySelector(sel);
const all = (sel: string) => [...document.querySelectorAll(sel)];
const pill = (s: string) => q(`[data-codes-filter="${s}"]`) as HTMLButtonElement;

describe('the Discount codes list in the Finance look', () => {
  it('says how many codes there are and carries each state’s count on its pill', async () => {
    await draw();
    expect(q('[data-codes-count]')!.textContent).toBe('3 codes');
    expect(pill('all').textContent).toBe('All3');
    expect(pill('active').textContent).toBe('Active1');
    expect(pill('inactive').textContent).toBe('Inactive1');
    expect(pill('expired').textContent).toBe('Expired1');
    expect(pill('all').getAttribute('aria-pressed')).toBe('true');
    await act(async () => pill('expired').click());
    expect(pill('expired').getAttribute('aria-pressed')).toBe('true');
    expect(pill('all').getAttribute('aria-pressed')).toBe('false');
    expect(all('[data-code-row]').map((r) => r.getAttribute('data-code-row'))).toEqual(['b']);
  });

  it('counts in Arabic with the board’s words', async () => {
    await draw({ locale: 'ar' });
    expect(q('[data-codes-count]')!.textContent).toBe('3 أكواد');
    expect(pill('active').textContent).toBe('نشطة1');
    expect(q('[data-codes-order]')!.textContent).toBe('إجمالي الخصم، الأعلى أولًا');
  });

  it('a code’s text opens its page, and each row shows the read’s own figures', async () => {
    await draw();
    const first = q('[data-code-row="a"]')!;
    expect((first.querySelector('[data-code-open]') as HTMLAnchorElement).getAttribute('href')).toBe('/codes?code=a');
    expect(first.textContent).toContain('120');
    expect(first.textContent).toContain('900');
    expect(first.textContent).toContain('Active');
    // a code with no counted use shows a dash, never 0
    const none = q('[data-code-row="c"]')!;
    expect(none.textContent).toContain('—');
    expect(none.textContent).toContain('Inactive');
    expect(q('[data-codes-detail]'), 'no code page under the list').toBeNull();
    expect(q('[data-codes-partner-row="p-1"]')!.textContent).toContain('1,300');
    expect(q('[data-codes-partners] h2')!.textContent).toBe('Promo totals by partner');
  });

  it('a list that failed says so with Try again and claims no count', async () => {
    await draw({ listFailed: true, rows: [] });
    expect(q('[data-codes-count]')).toBeNull();
    expect(q('[data-state="failed"]')!.textContent).toContain('Try again');
  });

  it('a list with no codes at all says none exist yet', async () => {
    await draw({ rows: [] });
    expect(q('[data-state="empty"]')!.textContent).toContain('No discount codes yet');
  });
});

describe('a code as its own page in the Finance look', () => {
  it('is drawn alone, with the way back in its trail', async () => {
    await draw({ detail });
    expect(q('[data-codes-page]')!.getAttribute('data-codes-view')).toBe('detail');
    expect(all('[data-code-row]').length, 'the list is not under it').toBe(0);
    expect(q('[data-codes-partners]')).toBeNull();
    const back = q('[data-crumbs] a') as HTMLAnchorElement;
    expect(back.getAttribute('href')).toBe('/codes');
    expect(back.textContent).toBe('Discount codes');
    expect(q('[data-codes-detail] h1')!.textContent).toBe('MADEUP10');
    expect(q('[data-code-partner]')!.textContent).toBe('Made-up Travel');
    expect(q('[data-code-validity]')!.textContent).toBe('From 1 Nov 2026');
    expect((q('[data-code-finance-link]') as HTMLAnchorElement).getAttribute('href')).toBe('/finance?code=MADEUP10');
  });

  it('shows its totals as five cards, what was collected in the Revenue green, an empty total as a dash', async () => {
    await draw({ detail });
    const tiles = all('[data-code-totals] [data-kpi-tile]');
    expect(tiles.length).toBe(5);
    const [collected, discount, cost, profit, invoices] = tiles;
    expect(collected!.getAttribute('data-tone')).toBe('success');
    expect(collected!.textContent).toContain('Total collected');
    expect(collected!.textContent).toContain('900');
    expect(discount!.getAttribute('data-tone')).toBeNull();
    expect(discount!.textContent).toContain('120');
    expect(q('[data-code-fee]')!.textContent).toBe('Configured discount 10%');
    expect(cost!.textContent).toContain('600');
    expect(profit!.textContent, 'no profit yet: a dash, never 0').toContain('—');
    expect(profit!.textContent).not.toMatch(/\b0\b/);
    expect(invoices!.textContent).toContain('2');
  });

  it('keeps one ledger, the counted uses first; a use that is not counted says so and carries no figure', async () => {
    await draw({ detail });
    const uses = all('[data-code-use]');
    expect(uses.map((u) => u.getAttribute('data-code-use'))).toEqual(['u-1', 'u-2', 'u-held']);
    expect(uses[0]!.textContent).toContain('Counted');
    expect(uses[0]!.textContent).toContain('450');
    expect((uses[0]!.querySelector('a') as HTMLAnchorElement).getAttribute('href')).toBe('https://example.test/7001');
    expect(uses[1]!.querySelector('a'), 'no stored link, no link').toBeNull();
    const held = uses[2]!;
    expect(held.getAttribute('data-counted')).toBe('false');
    expect(held.textContent).toContain('Not counted');
    expect(held.textContent).toContain('Partially paid');
    expect(held.textContent, 'its discount is not in the totals, so it is not shown as a figure').not.toContain('77');
    expect(held.textContent).not.toContain(en.common.sar);
  });

  it('says so when no use is counted yet', async () => {
    await draw({ detail: { ...detail, ledger: [] } });
    expect(q('[data-code-ledger-empty]')!.textContent).toBe('No counted invoices for this code yet');
    expect(all('[data-code-use]').length).toBe(0);
  });

  it('keeps the in-app actions for Full, and offers none to a reader', async () => {
    await draw({ detail, full: true });
    expect(q('[data-code-use-form]')).not.toBeNull();
    expect(q('[data-code-attribution-form]')).not.toBeNull();
    expect(all('[data-code-use] button').length, 'each use can be removed').toBe(3);
    act(() => root?.unmount());
    document.body.innerHTML = '';
    await draw({ detail, full: false });
    expect(q('[data-code-use-form]')).toBeNull();
    expect(q('[data-code-attribution-form]')).toBeNull();
    expect(all('[data-code-use] button').length).toBe(0);
    expect(q('[data-code-attributions]')!.textContent).toContain('Made-up Travel');
  });

  it('a code that failed to read keeps the way back, Try again and the error’s kind beside it', async () => {
    await draw({ selectedId: 'a', detailFailed: true, detailError: 'Unavailable · 57014' });
    expect(q('[data-codes-detail]')).toBeNull();
    expect((q('[data-crumbs] a') as HTMLAnchorElement).getAttribute('href')).toBe('/codes');
    expect(q('[data-state="failed"]')!.textContent).toContain('Try again');
    expect(q('[data-codes-detail-error]')!.textContent).toBe('Unavailable · 57014');
  });

  it('reads in Arabic with the reader’s currency word and the board’s pills', async () => {
    await draw({ locale: 'ar', detail });
    const text = document.body.textContent ?? '';
    expect(text).toContain(ar.common.sar);
    expect(text).not.toContain('SAR');
    expect(all('[data-code-use]')[0]!.textContent).toContain('محتسب');
    expect(all('[data-code-use]')[2]!.textContent).toContain('غير محتسب');
    expect((q('[data-crumbs] a') as HTMLAnchorElement).textContent).toBe('أكواد الخصم');
  });
});
