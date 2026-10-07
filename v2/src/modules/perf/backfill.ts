// The achievements mode of the Past work grid (builder C's PastWorkGrid, #105) — what Achievements passes it: the
// categories as the grid's choices, the codes that carry a deal value (the Value column, V502, V505), and the held
// keys with their values as the grid's `HeldKey` (V502), from api.backfill_achievement_keys_held (V378). Plain data,
// no React, so it is tested without the component.
import type { Category, ReportKind } from './types';

/** The grid's choice: a category by its code, with both names (V76). */
export type GridChoice = { key: string; en: string; ar: string };

/** What the database holds under a key (the grid's HeldKey): the deal value and where it came from. */
export type GridHeldKey = {
  amount: number | null;
  from: { kind: ReportKind; period: string } | 'typed' | null;
};

/** api.backfill_achievement_keys_held's answer, one row per held key. */
export type HeldKeyRow = {
  key: string;
  amount: number | null;
  from_kind: ReportKind | null;
  from_period: string | null;
  typed: boolean;
};

/** The categories a paste may name: the active ones, sub-categories under their parents, by code. */
export function choicesOf(categories: readonly Category[]): GridChoice[] {
  return categories.filter((c) => c.active).map((c) => ({ key: c.code, en: c.name_en, ar: c.name_ar }));
}

/** The codes whose rows carry a deal value (Contract signed, MoU and their sub-categories). */
export function valueKindsOf(categories: readonly Category[]): string[] {
  return categories.filter((c) => c.active && c.has_deal_value).map((c) => c.code);
}

/** The held keys as the grid reads them: a report it came from, `typed` by a person, or blank (null). */
export function heldKeysOf(rows: readonly HeldKeyRow[]): Map<string, GridHeldKey> {
  return new Map(
    rows.map((r) => [
      r.key,
      {
        amount: r.amount === null ? null : Number(r.amount),
        from: r.typed ? 'typed' : r.from_kind && r.from_period ? { kind: r.from_kind, period: r.from_period } : null,
      },
    ]),
  );
}
