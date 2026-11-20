// @vitest-environment jsdom
/**
 * Landing 32 (Finance F-B) — the exclusion list and the merge list in Settings → Finance.
 * The lists draw what the reads return (the kind in words, the value, the reason, "N rows · SAR amount"); the rules
 * made by Exclude on single Ledger rows are listed apart, read-only; Add needs a kind, a value and a reason (and, for
 * a merge, the organisation); a client ID keeps digits only; a rule that is already on the list is said in words; and
 * NOTHING is pre-filled, suggested or defaulted — the owner types every entry himself.
 * Every value is made up. Sabotages: tests/sabotage/landing-32-settings-lists.mjs.
 */
import { NextIntlClientProvider } from 'next-intl';
import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import ar from '../../../messages/ar.json';
import en from '../../../messages/en.json';
import { toDbError } from '../../../src/core/db/errors';
import {
  blankExclusion,
  blankMerge,
  EXCLUSION_KINDS,
  exclusionDraftOk,
  exclusionFields,
  MERGE_KINDS,
  mergeDraftOk,
  mergeFields,
  mergeTargetName,
  refusalWords,
  ruleHook,
  ruleValueOk,
  splitExclusionRules,
  typedRuleValue,
  type ExclusionRule,
  type MergeRule,
} from '../../../src/modules/settings/finance-lists';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {}, refresh: () => {} }) }));

const { ExclusionListCard, ExclusionAddFields } =
  await import('../../../src/modules/settings/screens/ExclusionListCard');
const { MergeListCard, MergeAddFields } = await import('../../../src/modules/settings/screens/MergeListCard');

const draw = (el: ReactElement, locale: 'en' | 'ar' = 'en') =>
  renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={locale === 'ar' ? ar : en} timeZone="Asia/Riyadh">
      {el}
    </NextIntlClientProvider>,
  );

const rule = (over: Partial<ExclusionRule>): ExclusionRule => ({
  id: 'made-up-rule-1',
  kind: 'client_id',
  value: '990001',
  mode: 'exclude',
  reason: 'Made-up reason: a test account',
  version: 1,
  row_level: false,
  rows: 3,
  amount_sar: 12500,
  ...over,
});
const EXCLUSIONS: ExclusionRule[] = [
  rule({}),
  rule({
    id: 'made-up-rule-2',
    kind: 'name',
    value: 'Made-up Org',
    reason: 'Made-up reason: internal',
    rows: 1,
    amount_sar: 800,
  }),
  rule({
    id: 'made-up-rule-3',
    kind: 'discount_code',
    value: 'MADEUP10',
    reason: 'Made-up reason: staff code',
    rows: 0,
    amount_sar: 0,
  }),
  rule({
    id: 'made-up-rule-4',
    kind: 'tax_no',
    value: '3990000000',
    reason: 'Made-up reason: ours',
    rows: 2,
    amount_sar: 4000.4,
  }),
  rule({
    id: 'made-up-rule-5',
    kind: 'invoice',
    value: 'MADEUP-INV-9901',
    reason: 'Made-up reason: one row',
    row_level: true,
    rows: 1,
    amount_sar: 150,
  }),
];
const MERGES: MergeRule[] = [
  {
    id: 'made-up-merge-1',
    kind: 'discount_code',
    value: 'MADEUP10',
    partner_id: 'made-up-partner-1',
    partner_number: 'P-99001',
    trade_name_en: 'Made-up Org',
    trade_name_ar: 'جهة مختلقة',
    reason: 'Made-up reason: their own code',
    version: 1,
    rows: 4,
    amount_sar: 23000,
  },
  {
    id: 'made-up-merge-2',
    kind: 'client_id',
    value: '990001',
    partner_id: 'made-up-partner-1',
    partner_number: 'P-99001',
    trade_name_en: 'Made-up Org',
    trade_name_ar: null,
    reason: 'Made-up reason: a second account',
    version: 1,
    rows: 1,
    amount_sar: 900,
  },
];
// The lists are boxes with a table's roles (a phone shows them as cards, never a table tag): rows are read from the
// parsed markup by their hook.
const parsed = (html: string) => new DOMParser().parseFromString(html, 'text/html');
const row = (html: string, attr: string, hook: string) =>
  parsed(html).querySelector(`[role="row"][${attr}="${hook}"]`)?.outerHTML ?? '';

describe('the exclusion list', () => {
  it('draws each list rule the read returned: its kind in words, the value, the reason and Remove', () => {
    const html = draw(<ExclusionListCard rules={EXCLUSIONS} />);
    expect(html).toContain('data-exclusion-list');
    for (const [hook, kind, reason] of [
      ['client_id:990001', 'Client ID', 'Made-up reason: a test account'],
      ['name:Made-up Org', 'Name', 'Made-up reason: internal'],
      ['discount_code:MADEUP10', 'Discount code', 'Made-up reason: staff code'],
      ['tax_no:3990000000', 'VAT / CR number', 'Made-up reason: ours'],
    ] as const) {
      const tr = row(html, 'data-exclusion-rule', hook);
      expect(tr, hook).toContain(kind);
      expect(tr, hook).toContain(hook.split(':')[1]);
      expect(tr, hook).toContain(reason);
      expect(tr, hook).toMatch(/<button[^>]*data-exclusion-remove[^>]*>Remove</);
    }
    expect(html.match(/data-exclusion-rule=/g)).toHaveLength(4);
  });
  it('says what each rule catches now as "N rows · SAR amount", in whole riyals', () => {
    const html = draw(<ExclusionListCard rules={EXCLUSIONS} />);
    const catches = (hook: string) =>
      parsed(row(html, 'data-exclusion-rule', hook)).querySelector('[data-exclusion-catches]')?.textContent;
    expect(catches('client_id:990001')).toBe('Catches now3 rows·SAR 12,500');
    expect(catches('name:Made-up Org')).toBe('Catches now1 row·SAR 800');
    expect(catches('discount_code:MADEUP10')).toBe('Catches now0 rows·SAR 0');
    expect(catches('tax_no:3990000000')).toBe('Catches now2 rows·SAR 4,000');
  });
  it('lists the rules made by Exclude on single Ledger rows apart, read-only, with how they are undone', () => {
    const html = draw(<ExclusionListCard rules={EXCLUSIONS} />);
    const apart = parsed(html).querySelector('[data-exclusion-row-rules]')?.outerHTML ?? '';
    expect(apart).toContain('data-exclusion-row-rule="MADEUP-INV-9901"');
    expect(apart).toContain('Made-up reason: one row');
    expect(apart).toContain('These are undone with Include on the Ledger row.');
    expect(apart).not.toContain('<button');
    expect(html).not.toContain('data-exclusion-rule="invoice:MADEUP-INV-9901"');
  });
  it('carries the sentence that says what excluding does', () => {
    expect(draw(<ExclusionListCard rules={EXCLUSIONS} />)).toContain(
      'Excluding takes out exactly what is typed and keeps everything else. An excluded row stays visible in the Ledger as not counted; nothing is removed.',
    );
  });
  it('an empty list says "Nothing is excluded yet." with the one Add button', () => {
    const html = draw(<ExclusionListCard rules={[]} />);
    expect(html).toContain('Nothing is excluded yet.');
    expect(html.match(/data-exclusion-add/g)).toHaveLength(1);
    expect(html).not.toContain('role="table"');
    expect(draw(<ExclusionListCard rules={EXCLUSIONS} />).match(/data-exclusion-add/g)).toHaveLength(1);
  });
  it('a read that failed is said with Try again — never as an empty list', () => {
    const html = draw(<ExclusionListCard rules={null} />);
    expect(html).toContain('data-state="failed"');
    expect(html).toContain('Exclusion list could not be loaded');
    expect(html).toMatch(/<button[^>]*>.*?Try again<\/button>/);
    expect(html).not.toContain('Nothing is excluded yet.');
    expect(html).not.toContain('data-exclusion-add');
  });
  it('reads in Arabic, the figures in Latin numerals', () => {
    const html = draw(<ExclusionListCard rules={EXCLUSIONS} />, 'ar');
    expect(html).toContain('قائمة الاستبعاد');
    expect(html).toContain('الرقم الضريبي / السجل التجاري');
    expect(html).toContain('3 صفوف');
    expect(html).toContain('12,500');
    expect(html).not.toMatch(/[٠-٩]/);
    expect(draw(<ExclusionListCard rules={[]} />, 'ar')).toContain('لا شيء مستبعد بعد.');
  });
});

describe('the merge list', () => {
  it('draws each rule the read returned: kind, value, the organisation it counts under with its number, reason, Remove', () => {
    const html = draw(<MergeListCard rules={MERGES} />);
    expect(html).toContain('data-merge-list');
    const code = row(html, 'data-merge-rule', 'discount_code:MADEUP10');
    expect(code).toContain('Discount code');
    expect(code).toMatch(/data-merge-target="made-up-partner-1"[^>]*>.*?Made-up Org.*?P-99001/);
    expect(code).toContain('Made-up reason: their own code');
    expect(code.replace(/<[^>]+>/g, '')).toContain('Merges now4 rows·SAR 23,000');
    expect(code).toMatch(/<button[^>]*data-merge-remove[^>]*>Remove</);
    const id = row(html, 'data-merge-rule', 'client_id:990001');
    expect(id).toContain('Client ID');
    expect(id.replace(/<[^>]+>/g, '')).toContain('Merges now1 row·SAR 900');
  });
  it('names the organisation in the reader’s language, the English name when there is no Arabic', () => {
    const html = draw(<MergeListCard rules={MERGES} />, 'ar');
    expect(row(html, 'data-merge-rule', 'discount_code:MADEUP10')).toContain('جهة مختلقة');
    expect(row(html, 'data-merge-rule', 'client_id:990001')).toContain('Made-up Org');
    expect(mergeTargetName(MERGES[0]!, 'en')).toBe('Made-up Org');
  });
  it('carries the two sentences that say what merging does', () => {
    const html = draw(<MergeListCard rules={MERGES} />);
    expect(html).toContain('Merging merges only what is named.');
    expect(html).toContain('A discount code merged into an organisation leaves the promo pool.');
  });
  it('an empty list says "Nothing is merged yet." with the one Add button; a failed read says so with Try again', () => {
    const empty = draw(<MergeListCard rules={[]} />);
    expect(empty).toContain('Nothing is merged yet.');
    expect(empty.match(/data-merge-add/g)).toHaveLength(1);
    const failed = draw(<MergeListCard rules={null} />);
    expect(failed).toContain('data-state="failed"');
    expect(failed).toContain('Merge list could not be loaded');
    expect(failed).not.toContain('Nothing is merged yet.');
  });
});

describe('nothing is pre-filled', () => {
  it('the add dialog of the exclusion list opens with no kind, no value and no reason', () => {
    expect(blankExclusion()).toEqual({ kind: '', value: '', reason: '' });
    const html = draw(<ExclusionAddFields draft={blankExclusion()} onChange={() => {}} />);
    expect(html).toContain('data-exclusion-kind=""');
    expect(html).toMatch(/<input[^>]*data-exclusion-value[^>]*value=""/);
    expect(html).toMatch(/<textarea[^>]*data-exclusion-reason[^>]*><\/textarea>/);
    // the kind shows the word Choose, not one of the four
    expect(html).toMatch(/<button[^>]*data-placeholder=""[^>]*>.*?Choose/);
    expect(html).not.toMatch(/<input[^>]*placeholder=/);
    expect(html).not.toContain('<datalist');
  });
  it('the add dialog of the merge list opens with no kind, no value, no organisation and no reason', () => {
    expect(blankMerge()).toEqual({ kind: '', value: '', partner: null, reason: '' });
    const html = draw(<MergeAddFields draft={blankMerge()} onChange={() => {}} />);
    expect(html).toContain('data-merge-kind=""');
    expect(html).toMatch(/<input[^>]*data-merge-value[^>]*value=""/);
    expect(html).toContain('data-merge-partner=""');
    expect(html).not.toContain('data-partner-picked');
    expect(html).toMatch(/<textarea[^>]*data-merge-reason[^>]*><\/textarea>/);
  });
  it('the kinds offered are the four of the exclusion list and the two of the merge list', () => {
    expect([...EXCLUSION_KINDS]).toEqual(['client_id', 'name', 'discount_code', 'tax_no']);
    expect([...MERGE_KINDS]).toEqual(['client_id', 'discount_code']);
  });
});

describe('Add', () => {
  const full = { kind: 'discount_code', value: 'MADEUP10', reason: 'Made-up reason' } as const;
  it('needs a reason', () => {
    expect(exclusionDraftOk({ ...full })).toBe(true);
    expect(exclusionDraftOk({ ...full, reason: '' })).toBe(false);
    expect(exclusionDraftOk({ ...full, reason: '   ' })).toBe(false);
    const partner = { id: 'made-up-partner-1' };
    expect(mergeDraftOk({ ...full, partner })).toBe(true);
    expect(mergeDraftOk({ ...full, partner, reason: ' ' })).toBe(false);
  });
  it('needs a value', () => {
    expect(exclusionDraftOk({ ...full, value: '' })).toBe(false);
    expect(exclusionDraftOk({ ...full, value: '  ' })).toBe(false);
    expect(mergeDraftOk({ ...full, value: ' ', partner: { id: 'made-up-partner-1' } })).toBe(false);
  });
  it('needs a kind — none is chosen for the person', () => {
    expect(exclusionDraftOk({ ...full, kind: '' })).toBe(false);
    expect(mergeDraftOk({ ...full, kind: '', partner: { id: 'made-up-partner-1' } })).toBe(false);
  });
  it('a merge needs the organisation it is counted under', () => {
    expect(mergeDraftOk({ ...full, partner: null })).toBe(false);
  });
  it('a client ID is digits only: anything else is dropped as it is typed', () => {
    expect(typedRuleValue('client_id', '99 00-01a')).toBe('990001');
    expect(typedRuleValue('client_id', '٩٩٠٠٠١')).toBe('990001');
    expect(typedRuleValue('name', 'Made-up Org 99')).toBe('Made-up Org 99');
    expect(typedRuleValue('discount_code', 'MADEUP10')).toBe('MADEUP10');
    expect(ruleValueOk('client_id', '990001')).toBe(true);
    expect(ruleValueOk('client_id', '99x')).toBe(false);
    expect(exclusionDraftOk({ kind: 'client_id', value: 'MADEUP', reason: 'Made-up reason' })).toBe(false);
  });
  it('saves exactly what was typed, trimmed — as an exclude rule, with its reason', () => {
    expect(exclusionFields({ kind: 'name', value: '  Made-up Org ', reason: ' Made-up reason ' })).toEqual({
      kind: 'name',
      value: 'Made-up Org',
      mode: 'exclude',
      reason: 'Made-up reason',
    });
    expect(
      mergeFields({
        kind: 'client_id',
        value: ' 990001 ',
        partner: { id: 'made-up-partner-1' },
        reason: ' Made-up reason',
      }),
    ).toEqual({ kind: 'client_id', value: '990001', partner_id: 'made-up-partner-1', reason: 'Made-up reason' });
  });
});

describe('the pieces', () => {
  it('a rule is hooked as <kind>:<value>, and the row-level rules are split from the list', () => {
    expect(ruleHook({ kind: 'client_id', value: '990001' })).toBe('client_id:990001');
    const { list, rowLevel } = splitExclusionRules(EXCLUSIONS);
    expect(list.map((r) => r.id)).toEqual(['made-up-rule-1', 'made-up-rule-2', 'made-up-rule-3', 'made-up-rule-4']);
    expect(rowLevel.map((r) => r.id)).toEqual(['made-up-rule-5']);
  });
});

describe('a refusal', () => {
  const lookup = (cat: unknown, key: string) =>
    key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], cat);
  const words = (cat: unknown) => ({
    has: (k: string) => typeof lookup(cat, k) === 'string',
    failed: (k: string, d: string) => String(lookup(cat, k)).replace('{detail}', d),
  });
  it('a duplicate is said in words, in both languages', () => {
    const twice = toDbError({ code: '23505', message: 'finance.exclusion_rule_exists' });
    expect(refusalWords(twice, words(en))).toBe('This is already on the exclusion list.');
    expect(refusalWords(twice, words(ar))).toBe('هذا موجود في قائمة الاستبعاد من قبل.');
    const merged = toDbError({ code: '23505', message: 'finance.merge_rule_exists' });
    expect(refusalWords(merged, words(en))).toBe('This is already on the merge list.');
    expect(refusalWords(merged, words(ar))).toBe('هذا موجود في قائمة الدمج من قبل.');
  });
  it('the dialog shows the refusal where the person is typing', () => {
    const html = draw(
      <ExclusionAddFields
        draft={{ kind: 'discount_code', value: 'MADEUP10', reason: 'Made-up reason' }}
        onChange={() => {}}
        error="This is already on the exclusion list."
      />,
    );
    expect(html).toMatch(/<p role="alert"[^>]*data-exclusion-error[^>]*>This is already on the exclusion list\.<\/p>/);
  });
});
