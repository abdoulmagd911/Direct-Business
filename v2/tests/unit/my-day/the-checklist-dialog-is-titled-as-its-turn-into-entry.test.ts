/**
 * V647 wording: the Turn into menu says "Item on a task's checklist" and the dialog that opens from it carries the same
 * words as its title, in English and in Arabic (the supervisor's live test of #309, 30 Oct). Made-up values: none.
 * Sabotage: tests/sabotage/checklist-wording.mjs.
 */
import { describe, expect, it } from 'vitest';
import ar from '../../../messages/ar.json';
import en from '../../../messages/en.json';

describe('the checklist dialog is titled as its Turn into entry', () => {
  for (const [name, catalog] of [
    ['English', en],
    ['Arabic', ar],
  ] as const) {
    it(`${name}: the dialog title is the menu entry`, () => {
      const turn = catalog.pages.myDay.turn;
      expect(turn.itemTitle).toBe(turn.kinds.action_item);
    });
  }
  it("says it in the supervisor's words in English", () => {
    expect(en.pages.myDay.turn.kinds.action_item).toBe("Item on a task's checklist");
  });
});
