/**
 * Landing 32 (Finance F-B), A2 + A3 — what stands above the import preview, never silent: the rule that keeps this
 * import out of the figures (its kind, its value, its reason), the rows the list names one by one, the state of the
 * code text — and, when a check did not answer, that it did not. Every value is made up.
 * Sabotage: tests/sabotage/landing-32-finance-ledger.mjs "the-rule-is-not-named",
 * "a-code-not-found-is-silent-in-the-preview", "a-failed-rule-check-is-silent".
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  ImportRuleNotes,
  importCodeStateOf,
  type ImportCodeState,
} from '../../../src/modules/finance/screens/ImportRuleNotes';
import type { RuleCheck, RuleCount } from '../../../src/modules/imports';
import { inWords, parts } from './landing-32-fixtures';

const counts = { new: 2, updated: 0, unchanged: 0, excluded: 0, needs_linking: 0 };
const nothing: RuleCount = { counts, rowNos: [], whole: false };
const none: RuleCheck = { excluded: false, kind: null, value: null, reason: null, numbers: [] };

const html = (
  props: { check?: RuleCheck | null; failed?: boolean; count?: RuleCount; code?: ImportCodeState | null },
  locale: 'en' | 'ar' = 'en',
) =>
  renderToStaticMarkup(
    inWords(
      <ImportRuleNotes
        check={props.check === undefined ? none : props.check}
        checkFailed={!!props.failed}
        count={props.count ?? nothing}
        codeState={props.code ?? null}
      />,
      locale,
    ),
  );

describe('the exclusion list above the preview', () => {
  const whole: RuleCheck = {
    excluded: true,
    kind: 'client_id',
    value: '990001',
    reason: 'Made-up internal account',
    numbers: [],
  };

  it('names the rule that keeps the whole import out: its kind, its value and its reason', () => {
    const out = html({ check: whole, count: { counts, rowNos: [2, 3], whole: true } });
    const said = parts(out, 'data-import-rule-excluded="all"')[0]!;
    expect(said).toContain('stored but not counted');
    expect(said).toContain('Client ID');
    expect(said).toContain('990001');
    expect(said).toContain('Made-up internal account');
    expect(said, 'it is a warning, read out').toContain('role="alert"');
    const arabic = html({ check: whole, count: { counts, rowNos: [2, 3], whole: true } }, 'ar');
    expect(arabic).toContain('ستُحفظ ولن تُحتسب');
    expect(arabic).toContain('رقم العميل');
  });

  it('a rule with no reason says none was typed, never a blank', () => {
    const out = html({ check: { ...whole, reason: null }, count: { counts, rowNos: [2], whole: true } });
    expect(out).toContain('Reason: none typed');
  });

  it('rows named one by one are said with their count', () => {
    const out = html({ check: { ...none, numbers: ['tr made 0003'] }, count: { counts, rowNos: [3], whole: false } });
    expect(parts(out, 'data-import-rule-excluded="rows"')[0]).toContain(
      '1 row of this import is on the exclusion list',
    );
  });

  it('a list that catches nothing says nothing', () => {
    expect(html({})).toBe('');
  });

  it('a check that did not answer says so — the preview is never silent about it', () => {
    const out = html({ check: null, failed: true });
    expect(out).toContain('data-import-rule-failed');
    expect(out).toContain('The exclusion list could not be checked');
  });
});

describe('the code text above the preview', () => {
  it('a code that has not been found is a warning', () => {
    const out = html({ code: 'not_found' });
    expect(out).toContain('data-import-code-state="not_found"');
    expect(out).toContain('Code has not been found');
    expect(out).toContain('role="alert"');
    expect(html({ code: 'not_found' }, 'ar')).toContain('لم يُعثر على الكود');
  });

  it('a text more than one code carries is held', () => {
    const out = html({ code: 'ambiguous' });
    expect(out).toContain('data-import-code-state="ambiguous"');
    expect(out).toContain('Held: more than one code carries this text');
  });

  it('a code that was found says so, without a warning', () => {
    const out = html({ code: 'found' });
    expect(out).toContain('data-import-code-state="found"');
    expect(out).toContain('Code found');
    expect(out).not.toContain('role="alert"');
  });

  it('a check that did not answer is said, never passed for found', () => {
    expect(importCodeStateOf({ text: 'MADEUP10', state: 'not_found', code_id: null })).toBe('not_found');
    expect(importCodeStateOf({ state: 'ambiguous' })).toBe('ambiguous');
    expect(importCodeStateOf({ state: null })).toBe('unchecked');
    expect(importCodeStateOf(null)).toBe('unchecked');
    const out = html({ code: 'unchecked' });
    expect(out).toContain('data-import-code-state="unchecked"');
    expect(out).toContain('The code could not be checked.');
  });

  it('an import with no code text shows no code line', () => {
    expect(html({ code: null })).not.toContain('data-import-code-state');
  });
});
