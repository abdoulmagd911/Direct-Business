// @vitest-environment jsdom
/**
 * Landing 32 (Finance F-B): on a code's page an admin — the read's own `can_toggle` — takes a counted row out of the
 * count (Exclude) or puts back a row that was excluded by hand (Include). Each asks for a reason, which is required,
 * names the row to the database by the organisation it is recorded under and its own number, and reads the detail
 * again. A row a list rule catches says so in words and offers no button (it is changed in Settings → Finance); a row
 * that is not counted for another reason offers none; a reader who is not an admin sees none at all.
 * Every value is made up. Sabotage: tests/sabotage/landing-32-codes-tab.mjs.
 */
import { NextIntlClientProvider } from 'next-intl';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ar from '../../../messages/ar.json';
import en from '../../../messages/en.json';
import { toggleOf } from '../../../src/modules/codes/toggle';
import type { CodeDetail, CodeLedgerRow } from '../../../src/modules/codes/types';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const seen: { rpc: [string, Record<string, unknown>][]; said: string[]; refreshed: number } = {
  rpc: [],
  said: [],
  refreshed: 0,
};
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: () => {}, refresh: () => (seen.refreshed += 1) }),
}));
vi.mock('@/core/db/rpc', () => ({
  rpc: async (fn: string, args: Record<string, unknown>) => {
    seen.rpc.push([fn, args]);
    return { id: 'r-1', number: args.p_number, request_id: 'req-1' };
  },
}));
// the command wrapper: says the done words, runs the write, then the caller's re-read — as the real one does
vi.mock('@/core/commands/command', () => ({
  command: async (words: { done: string }, write: () => Promise<unknown>, opts?: { after?: () => void }) => {
    const answer = await write();
    seen.said.push(words.done);
    opts?.after?.();
    return answer;
  },
}));

const { CodesScreen } = await import('../../../src/modules/codes/screens/CodesScreen');

const ORG = '00000000-0000-4000-8000-000000990001';
const aUse = (over: Partial<CodeLedgerRow>): CodeLedgerRow => ({
  use_id: 'u',
  invoice_id: 'inv',
  ref: '9001',
  created_on: '2026-11-01',
  status_word: null,
  discount_sar: 60,
  source: 'promo',
  direct_url: null,
  counted: true,
  revenue: 450,
  cost: null,
  profit: null,
  excluded_reason: null,
  partner_id: ORG,
  number: '9001',
  excluded_by: null,
  excluded_row_level: false,
  ...over,
});
const notCounted = { counted: false, revenue: null, cost: null, profit: null } as const;
const detailOf = (can_toggle: boolean | undefined): CodeDetail => ({
  id: 'a',
  code: 'MADEUP10',
  valid_from: null,
  valid_to: null,
  state: 'active',
  partner_id: ORG,
  partner_name: 'Made-up Org',
  partner_name_ar: null,
  fee_percent: null,
  totals: { total_discount: 60, total_collected: 450, total_cost: null, total_profit: null, units: 1 },
  ledger: [
    aUse({ use_id: 'u-counted', ref: '9001', number: '9001' }),
    aUse({
      use_id: 'u-by-hand',
      ref: '9002',
      number: '9002',
      ...notCounted,
      status_word: 'Fully paid',
      excluded_reason: 'made-up reason typed by hand',
      excluded_by: 'invoice',
      excluded_row_level: true,
    }),
    aUse({
      use_id: 'u-list-rule',
      ref: '9003',
      number: '9003',
      ...notCounted,
      status_word: 'Fully paid',
      excluded_reason: 'made-up list reason',
      excluded_by: 'client_id',
      excluded_row_level: false,
    }),
    aUse({ use_id: 'u-not-paid', ref: '9004', number: '9004', ...notCounted, status_word: 'Partially paid' }),
    aUse({ use_id: 'u-no-number', ref: '9005', number: null }),
    aUse({ use_id: 'u-no-org', ref: '9006', number: '9006', partner_id: null }),
  ],
  attributions: [],
  ...(can_toggle === undefined ? {} : { can_toggle }),
});

let root: Root | null = null;
afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.innerHTML = '';
  seen.rpc.length = 0;
  seen.said.length = 0;
  seen.refreshed = 0;
});

const draw = async (detail: CodeDetail, over: { locale?: 'en' | 'ar'; full?: boolean } = {}) => {
  const locale = over.locale ?? 'en';
  const host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(
      <NextIntlClientProvider locale={locale} messages={locale === 'ar' ? ar : en} timeZone="Asia/Riyadh">
        <CodesScreen
          rows={[]}
          detail={detail}
          companyRows={[]}
          partners={[]}
          full={over.full ?? false}
          selectedId={detail.id}
          listFailed={false}
          detailFailed={false}
          companiesFailed={false}
          files={[]}
          filesFailed={false}
        />
      </NextIntlClientProvider>,
    );
  });
};

const rowOf = (id: string) => document.querySelector(`[data-code-use="${id}"]`)!;
const excludeOn = (id: string) => rowOf(id).querySelector('[data-code-exclude]') as HTMLButtonElement | null;
const includeOn = (id: string) => rowOf(id).querySelector('[data-code-include]') as HTMLButtonElement | null;
const reasonBox = () => document.querySelector('[data-reason]') as HTMLTextAreaElement | null;
const saveButton = () => document.querySelector('[data-reason-save]') as HTMLButtonElement;
const typeReason = (value: string) => {
  const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!;
  act(() => {
    set.call(reasonBox()!, value);
    reasonBox()!.dispatchEvent(new Event('input', { bubbles: true }));
  });
};

describe('the one action a row offers an admin', () => {
  it('a counted row can be excluded, a row excluded by hand can be included, and nothing else is offered', () => {
    expect(toggleOf(aUse({}))).toEqual({ kind: 'exclude', partnerId: ORG, number: '9001' });
    expect(toggleOf(aUse({ ...notCounted, excluded_by: 'invoice', excluded_row_level: true }))).toEqual({
      kind: 'include',
      partnerId: ORG,
      number: '9001',
    });
    expect(toggleOf(aUse({ ...notCounted, excluded_by: 'client_id', excluded_row_level: false }))).toBeNull();
    expect(toggleOf(aUse({ ...notCounted }))).toBeNull();
  });

  it('a row with no organisation or no number offers no action', () => {
    expect(toggleOf(aUse({ partner_id: null }))).toBeNull();
    expect(toggleOf(aUse({ number: null }))).toBeNull();
    expect(toggleOf(aUse({ number: '' }))).toBeNull();
    expect(toggleOf(aUse({ ...notCounted, excluded_row_level: true, number: null }))).toBeNull();
  });
});

describe('Exclude and Include on a code’s page', () => {
  it('an admin sees Exclude on a counted row and Include only on a row excluded by hand', async () => {
    await draw(detailOf(true));
    expect(excludeOn('u-counted')!.textContent).toBe('Exclude');
    expect(includeOn('u-counted')).toBeNull();
    expect(includeOn('u-by-hand')!.textContent).toBe('Include');
    expect(excludeOn('u-by-hand')).toBeNull();
    for (const id of ['u-list-rule', 'u-not-paid', 'u-no-number', 'u-no-org']) {
      expect(excludeOn(id), id).toBeNull();
      expect(includeOn(id), id).toBeNull();
    }
    expect(document.querySelectorAll('[data-code-exclude]').length).toBe(1);
    expect(document.querySelectorAll('[data-code-include]').length).toBe(1);
  });

  it('a row a list rule catches says so in words, and only that row does', async () => {
    await draw(detailOf(true));
    expect(rowOf('u-list-rule').querySelector('[data-code-list-rule]')!.textContent).toBe(
      'Excluded by a list rule — change it in Settings → Finance',
    );
    for (const id of ['u-counted', 'u-by-hand', 'u-not-paid']) {
      expect(rowOf(id).querySelector('[data-code-list-rule]'), id).toBeNull();
    }
  });

  it('keeps the status word and the excluded reason on a row that is not counted', async () => {
    await draw(detailOf(true));
    expect(rowOf('u-by-hand').textContent).toContain('Fully paid · made-up reason typed by hand');
    expect(rowOf('u-list-rule').textContent).toContain('Fully paid · made-up list reason');
    expect(rowOf('u-not-paid').textContent).toContain('Partially paid');
  });

  it('a reader who is not an admin sees no Exclude and no Include, even at Full', async () => {
    await draw(detailOf(false), { full: true });
    expect(document.querySelector('[data-code-exclude]')).toBeNull();
    expect(document.querySelector('[data-code-include]')).toBeNull();
    // the list-rule words are for every reader
    expect(rowOf('u-list-rule').querySelector('[data-code-list-rule]')).not.toBeNull();
    act(() => root?.unmount());
    document.body.innerHTML = '';
    // an older read that does not say is not an admin's read
    await draw(detailOf(undefined), { full: true });
    expect(document.querySelector('[data-code-exclude]')).toBeNull();
    expect(document.querySelector('[data-code-include]')).toBeNull();
  });

  it('Exclude asks for a reason, which is required, then excludes the row by its organisation and number and reads again', async () => {
    await draw(detailOf(true));
    expect(reasonBox()).toBeNull();
    await act(async () => excludeOn('u-counted')!.click());
    expect(document.body.textContent).toContain('Exclude this row from the count?');
    expect(document.body.textContent).toContain('Reason (required)');
    expect(saveButton().textContent).toBe('Exclude');
    expect(saveButton().disabled, 'no reason, no save').toBe(true);
    typeReason('   ');
    expect(saveButton().disabled, 'spaces are not a reason').toBe(true);
    expect(seen.rpc).toEqual([]);
    typeReason('  made-up test booking  ');
    expect(saveButton().disabled).toBe(false);
    await act(async () => saveButton().click());
    expect(seen.rpc).toEqual([
      ['finance_row_exclude', { p_partner: ORG, p_number: '9001', p_reason: 'made-up test booking' }],
    ]);
    expect(seen.said).toEqual(['Row excluded']);
    expect(seen.refreshed, 'the detail is read again').toBe(1);
  });

  it('Include asks for a reason too, then includes the row again', async () => {
    await draw(detailOf(true));
    await act(async () => includeOn('u-by-hand')!.click());
    expect(document.body.textContent).toContain('Include this row in the count again?');
    expect(saveButton().textContent).toBe('Include');
    expect(saveButton().disabled).toBe(true);
    typeReason('made-up: it was a real booking');
    await act(async () => saveButton().click());
    expect(seen.rpc).toEqual([
      ['finance_row_include', { p_partner: ORG, p_number: '9002', p_reason: 'made-up: it was a real booking' }],
    ]);
    expect(seen.said).toEqual(['Row included']);
    expect(seen.refreshed).toBe(1);
  });

  it('reads in Arabic', async () => {
    await draw(detailOf(true), { locale: 'ar' });
    expect(excludeOn('u-counted')!.textContent).toBe('استبعاد');
    expect(includeOn('u-by-hand')!.textContent).toBe('احتساب');
    expect(rowOf('u-list-rule').querySelector('[data-code-list-rule]')!.textContent).toBe(
      'مستبعد بقاعدة من القوائم — غيّرها من الإعدادات ← المالية',
    );
    await act(async () => excludeOn('u-counted')!.click());
    expect(document.body.textContent).toContain('استبعاد هذا السطر من الاحتساب؟');
    expect(document.body.textContent).toContain('السبب (مطلوب)');
  });
});
