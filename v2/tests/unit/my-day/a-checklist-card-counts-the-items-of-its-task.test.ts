/**
 * A checklist note's card on My day (the Architect's ruling of 16 Oct): once the note has become a task, the card counts
 * that task's action items — they are what gets closed — and until then its own rows. Sabotage:
 * tests/sabotage/capture-polish.mjs. Every value is made up.
 */
import { describe, expect, it } from 'vitest';
import { cardCount, checklistCount } from '../../../src/modules/my-day/logic';

const items = [
  { text: 'Made-up: one', done: true },
  { text: 'Made-up: two', done: false },
];

describe('a checklist card', () => {
  it("counts the note's own rows when it made no task", () => {
    expect(cardCount({ items })).toEqual({ done: 1, total: 2 });
    expect(cardCount({ items, task_items: null })).toEqual({ done: 1, total: 2 });
    expect(cardCount({ items, task_items: { done: 0, total: 0 } })).toEqual(checklistCount({ items }));
  });
  it("counts the task's action items once it made some: closing them moves the card", () => {
    expect(cardCount({ items, task_items: { done: 2, total: 2 } })).toEqual({ done: 2, total: 2 });
    expect(cardCount({ items, task_items: { done: 0, total: 2 } })).toEqual({ done: 0, total: 2 });
  });
});
