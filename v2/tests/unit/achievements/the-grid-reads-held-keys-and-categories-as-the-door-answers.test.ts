import { describe, expect, it } from 'vitest';
import { choicesOf, heldKeysOf, valueKindsOf } from '../../../src/modules/perf/backfill';
import type { Category } from '../../../src/modules/perf/types';

// The grid's achievements mode (V502, V505): the held keys come back from api.backfill_achievement_keys_held with
// their deal value and its source, and the grid reads them as HeldKey — a report, typed by a person, or blank — so
// its preview says "updates a saved row" exactly when the database would. Every value is made up.
// Sabotage: tests/sabotage/achievements.mjs "held-typed-read-as-a-report".
const cat = (code: string, deal = false, active = true): Category => ({
  id: code,
  plan_id: 'p',
  code,
  name_en: `Made-up ${code}`,
  name_ar: `فئة ${code}`,
  parent_id: null,
  parent_code: null,
  is_money_link: false,
  has_deal_value: deal,
  sets_prospect: false,
  required_ref_system: null,
  sort: 0,
  active,
  version: 1,
});

describe('the grid reads held keys and categories as the door answers', () => {
  it('reads a report, a typed value and a blank one apart', () => {
    const held = heldKeysOf([
      { key: 'k1', amount: 90000, from_kind: 'bd_monthly', from_period: '2026-03', typed: false },
      { key: 'k2', amount: 150000, from_kind: null, from_period: null, typed: true },
      { key: 'k3', amount: null, from_kind: null, from_period: null, typed: false },
    ]);
    expect(held.get('k1')).toEqual({ amount: 90000, from: { kind: 'bd_monthly', period: '2026-03' } });
    expect(held.get('k2')).toEqual({ amount: 150000, from: 'typed' });
    expect(held.get('k3')).toEqual({ amount: null, from: null });
  });

  it('offers the active categories and marks the ones with a deal value', () => {
    const cats = [cat('CONTRACT', true), cat('AWARD'), cat('OLD', true, false)];
    expect(choicesOf(cats).map((c) => c.key)).toEqual(['CONTRACT', 'AWARD']);
    expect(valueKindsOf(cats)).toEqual(['CONTRACT']);
  });
});
