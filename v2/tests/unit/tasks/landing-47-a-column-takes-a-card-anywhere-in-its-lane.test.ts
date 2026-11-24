/**
 * Landing 47 (the small fix round) — the board's drag, its two small rules as they answer:
 *  - A column takes a card anywhere in its LANE: level with the column and inside the board, whether the pointer is on
 *    the column's own box, or above or below it (a short, empty column beside a long one). Not in the gap between two
 *    columns, and not outside the board.
 *  - The board scrolls sideways near its edges BY THE CLOCK: the same distance in a second on a 60 Hz and a 120 Hz
 *    screen; nothing outside the two edge strips; slower at a strip's inner side than at the board's edge; towards
 *    the edge the pointer is at; and a long pause between two frames never makes it jump.
 * Every value is made up. Sabotages: tests/sabotage/landing-47.mjs.
 */
import { describe, expect, it } from 'vitest';
import { EDGE_PX, SCROLL_PX_S, edgeScroll, laneAt } from '../../../src/modules/tasks/screens/board-drag';

const board = { left: 16, right: 1016, top: 400, bottom: 900 };
// a long column, a short (empty) one beside it, and a third; 12 px between them
const columns = [
  { key: 'not_started', box: { left: 16, right: 336, top: 400, bottom: 900 } },
  { key: 'in_progress', box: { left: 348, right: 668, top: 400, bottom: 480 } },
  { key: 'done', box: { left: 680, right: 1000, top: 400, bottom: 480 } },
];

describe('a column takes a card anywhere in its lane', () => {
  it('below a short column’s own box, level with it', () => {
    expect(laneAt(500, 820, board, columns)).toBe('in_progress');
    expect(laneAt(700, 899, board, columns)).toBe('done');
  });
  it('on a column’s own box too', () => {
    expect(laneAt(500, 440, board, columns)).toBe('in_progress');
    expect(laneAt(100, 700, board, columns)).toBe('not_started');
  });
  it('not in the gap between two columns', () => {
    expect(laneAt(342, 820, board, columns)).toBeNull();
    expect(laneAt(674, 440, board, columns)).toBeNull();
  });
  it('not outside the board: above it, below it, or beside it', () => {
    expect(laneAt(500, 399, board, columns)).toBeNull();
    expect(laneAt(500, 901, board, columns)).toBeNull();
    expect(laneAt(10, 500, board, columns)).toBeNull();
    expect(laneAt(1020, 500, board, columns)).toBeNull();
  });
  it('a column scrolled half off the board is taken only where it shows', () => {
    const half = [{ key: 'cancelled', box: { left: 900, right: 1220, top: 400, bottom: 480 } }];
    expect(laneAt(1000, 700, board, half)).toBe('cancelled');
    expect(laneAt(1100, 700, board, half)).toBeNull();
  });
});

describe('the board scrolls sideways near its edges by the clock', () => {
  const left = 0;
  const right = 400;
  const second = (x: number, hz: number) => {
    let sum = 0;
    for (let i = 0; i < hz; i++) sum += edgeScroll(x, left, right, 1000 / hz);
    return sum;
  };
  it('the same distance in a second at 60 Hz and at 120 Hz', () => {
    expect(second(right, 60)).toBeCloseTo(SCROLL_PX_S, 5);
    expect(second(right, 120)).toBeCloseTo(SCROLL_PX_S, 5);
    expect(second(right - 20, 120)).toBeCloseTo(second(right - 20, 60), 5);
  });
  it('nothing outside the two edge strips', () => {
    expect(edgeScroll(200, left, right, 16)).toBe(0);
    expect(edgeScroll(left + EDGE_PX, left, right, 16)).toBe(0);
    expect(edgeScroll(right - EDGE_PX, left, right, 16)).toBe(0);
  });
  it('towards the edge the pointer is at', () => {
    expect(edgeScroll(left + 5, left, right, 16)).toBeLessThan(0);
    expect(edgeScroll(right - 5, left, right, 16)).toBeGreaterThan(0);
  });
  it('slower at the strip’s inner side than at the board’s edge, and never still inside the strip', () => {
    const inner = edgeScroll(right - EDGE_PX + 2, left, right, 16);
    const edge = edgeScroll(right - 1, left, right, 16);
    expect(inner).toBeGreaterThan(0);
    expect(edge).toBeGreaterThan(inner * 2);
    expect(-edgeScroll(left + 1, left, right, 16)).toBeCloseTo(edge, 5);
  });
  it('a pointer past the edge scrolls at the full speed, no faster', () => {
    expect(edgeScroll(right + 300, left, right, 10)).toBeCloseTo(SCROLL_PX_S / 100, 5);
  });
  it('a long pause between two frames counts as 50 ms at most, and a clock that ran back as none', () => {
    expect(edgeScroll(right, left, right, 4000)).toBeCloseTo(SCROLL_PX_S / 20, 5);
    expect(edgeScroll(right, left, right, -8)).toBe(0);
  });
});
