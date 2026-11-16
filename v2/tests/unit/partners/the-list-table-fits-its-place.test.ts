/**
 * Landing 31: between a phone and a wide desk the partners table used to run off its card and scroll sideways. It
 * now draws the columns its own place has room for — Type goes first, then Owner, then Last activity; the
 * organisation, its status and its flags always stay — and under a table's width the list is rows in one card.
 * Sabotage: tests/sabotage/landing-31-partners-list.mjs.
 */
import { describe, expect, it } from 'vitest';
import { CARDS_UNDER, columnPlan } from '../../../src/modules/partners/list/columns';

/** What the drawn columns need at most (px): the plan must never ask for more than the place has. */
const NEED: Record<string, number> = { type: 136, owner_id: 200, last_activity_on: 136 };
const needed = (width: number, selectable: boolean) => {
  const plan = columnPlan(width, selectable);
  const shown = Object.keys(NEED).filter((c) => !(plan.hidden as string[]).includes(c));
  return (selectable ? 44 : 0) + 120 + 168 + 26 + plan.nameMax + shown.reduce((s, c) => s + NEED[c]!, 0);
};

describe('the partners table fits its place', () => {
  it('a wide place draws every column', () => {
    expect(columnPlan(1128, true)).toMatchObject({ cards: false, hidden: [] });
    expect(columnPlan(1200, false)).toMatchObject({ cards: false, hidden: [] });
  });
  it('Type goes first, then Owner, then Last activity', () => {
    expect(columnPlan(968, true).hidden).toEqual(['type']);
    expect(columnPlan(744, true).hidden).toEqual(['type', 'owner_id']);
    expect(columnPlan(620, true).hidden).toEqual(['type', 'owner_id', 'last_activity_on']);
  });
  it('under a table’s width the list is rows in one card', () => {
    expect(columnPlan(CARDS_UNDER - 1, true).cards).toBe(true);
    expect(columnPlan(360, true).cards).toBe(true);
    expect(columnPlan(CARDS_UNDER, true).cards).toBe(false);
  });
  it('before the place is measured it is the full table', () => {
    expect(columnPlan(0, true)).toMatchObject({ cards: false, hidden: [] });
  });
  it('never asks for more room than the place has, at any width from 600 to 1600', () => {
    for (const selectable of [true, false])
      for (let w = CARDS_UNDER; w <= 1600; w += 7)
        expect(needed(w, selectable), `${w}px, selectable ${selectable}`).toBeLessThanOrEqual(w);
  });
  it('the organisation’s name always keeps room to be read', () => {
    for (let w = CARDS_UNDER; w <= 1600; w += 7)
      expect(columnPlan(w, true).nameMax, `${w}px`).toBeGreaterThanOrEqual(200);
  });
});
