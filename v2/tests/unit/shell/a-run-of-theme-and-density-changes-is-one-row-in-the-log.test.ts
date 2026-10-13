/**
 * W38: consecutive changes of one person's own Theme or Density (newest first) are one row in the log, each field once
 * from what it was before the first to what it is after the last, with a count; a change of anything else, an undone
 * one, a colleague's, and a lone change stay as they are. Sabotage: tests/sabotage/screens.mjs
 * "preference-runs-stay-separate".
 */
import { describe, expect, it } from 'vitest';
import { groupPreferenceRuns, type HistoryRow } from '../../../src/ui/record/history';

const row = (n: number, field: string, before: string, after: string, over: Partial<HistoryRow> = {}): HistoryRow => ({
  request_id: `r${n}`,
  at: `2026-10-01T10:0${n}:00Z`,
  actor_id: 'p1',
  kind: 'ui',
  label_key: null,
  label_args: null,
  reason: null,
  undone: false,
  undo_of: null,
  changes: [
    {
      entity: 'core.person_profile',
      id: 'x',
      action: 'update',
      fields: [field],
      before: { [field]: before },
      after: { [field]: after },
    },
  ],
  ...over,
});

describe('a run of personal Theme and Density changes', () => {
  it('is one row: each field once, from its first before to its last after, with the count', () => {
    const rows = [
      row(4, 'theme', 'dark', 'light'),
      row(3, 'density', 'compact', 'comfortable'),
      row(2, 'theme', 'direct', 'dark'),
    ];
    const out = groupPreferenceRuns(rows);
    expect(out, 'three changes, one row').toHaveLength(1);
    expect(out[0]!.grouped).toBe(3);
    expect(out[0]!.request_id, 'its Undo takes back the newest request').toBe('r4');
    const c = out[0]!.changes[0]!;
    expect(c.fields).toEqual(['theme', 'density']);
    expect(c.before).toEqual({ theme: 'direct', density: 'compact' });
    expect(c.after).toEqual({ theme: 'light', density: 'comfortable' });
  });
  it('leaves a lone change, another field, an undone change and a colleague alone', () => {
    const lone = [row(3, 'theme', 'dark', 'light')];
    expect(groupPreferenceRuns(lone)[0]!.grouped).toBeUndefined();
    const mixed = [
      row(5, 'theme', 'dark', 'light'),
      row(4, 'full_name_en', 'A', 'B'),
      row(3, 'theme', 'direct', 'dark'),
      row(2, 'density', 'compact', 'comfortable', { actor_id: 'p2' }),
      row(1, 'density', 'comfortable', 'compact', { actor_id: 'p2' }),
    ];
    const out = groupPreferenceRuns(mixed);
    expect(out.map((r) => r.request_id)).toEqual(['r5', 'r4', 'r3', 'r2']);
    expect(out.find((r) => r.request_id === 'r2')!.grouped, "a colleague's two are their own run").toBe(2);
    const undone = [row(3, 'theme', 'dark', 'light', { undone: true }), row(2, 'theme', 'direct', 'dark')];
    expect(groupPreferenceRuns(undone), 'an undone change is not folded in').toHaveLength(2);
  });
});
