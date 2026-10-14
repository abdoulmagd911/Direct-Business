/**
 * Quick capture and Wrap up v2 without a browser (productivity stage 1): what the sheet sends for each kind, the
 * morning a reminder starts at, and what Wrap up walks and sends. The browser half is tests/e2e/capture-wrap.spec.ts.
 * Sabotage: tests/sabotage/capture-wrap.mjs.
 */
import { describe, expect, it } from 'vitest';
import {
  WRAP_DEFAULT,
  moveDaysCollide,
  nextWeekDay,
  wrapMoves,
  wrapItems,
  wrapLabel,
  wrapPayload,
  wrapRecover,
  wrapSummary,
} from '../../../src/modules/my-day/logic';
import { quickCaptureArgs } from '../../../src/modules/my-day/quick-capture';
import type { MyNote, TodayTask } from '../../../src/modules/my-day/types';

const opts = { visibility: 'private', day: '2026-10-13' };
const task = (id: string, group: TodayTask['group'], role: TodayTask['role'] = 'owner'): TodayTask =>
  ({
    id,
    number: `T-${id}`,
    title: id,
    due_on: '2026-10-13',
    partner_id: null,
    partner_name: null,
    group,
    role,
  }) as TodayTask;
const note = (id: string, extra: Partial<MyNote> = {}): MyNote =>
  ({
    id,
    kind: 'sticky',
    title: id,
    body: null,
    items: [],
    mine: true,
    finished_at: null,
    links: [],
    ...extra,
  }) as MyNote;

describe('Quick capture sends what each kind needs', () => {
  it('files a note or an idea with the first line as its title, the rest as its body, private', () => {
    expect(quickCaptureArgs('note', 'Hello\nmore words', opts)).toEqual({
      kind: 'sticky',
      values: { visibility: 'private', happened_on: '2026-10-13', title: 'Hello', body: 'more words' },
    });
    expect(quickCaptureArgs('idea', 'An idea', opts)?.kind).toBe('idea');
    expect(
      quickCaptureArgs('meeting', 'Kick-off with the made-up client', opts),
      'a meeting note keeps its kind',
    ).toEqual({
      kind: 'meeting',
      values: { visibility: 'private', happened_on: '2026-10-13', title: 'Kick-off with the made-up client' },
    });
  });
  it('makes every line after the title a checklist item, or the one line its own item', () => {
    const two = quickCaptureArgs('checklist', 'Pack\nPassports\nChargers', opts);
    expect((two?.values.items as unknown[]).length).toBe(2);
    const one = quickCaptureArgs('checklist', 'Only this', opts);
    expect((one?.values.items as { text: string }[])[0]?.text).toBe('Only this');
  });
  it('ties a Reminder to its record when it is a Follow up', () => {
    const args = quickCaptureArgs('reminder', 'Ask about the offer', {
      ...opts,
      remindAt: '2026-10-15T09:00:00+03:00',
      about: { entity: 'partner', id: 'c1' },
    });
    expect(args?.values.about, 'the record travels with the reminder').toEqual({ entity: 'partner', id: 'c1' });
    expect(args?.values.visibility, 'private').toBe('private');
  });
  it('refuses a reminder with no time and nothing when there are no words', () => {
    expect(quickCaptureArgs('reminder', 'Call back', opts), 'a reminder asks when').toBeNull();
    expect(quickCaptureArgs('reminder', 'Call back', { ...opts, remindAt: '2026-10-14T09:00:00+03:00' })?.kind).toBe(
      'reminder',
    );
    expect(quickCaptureArgs('note', '  \n ', opts)).toBeNull();
  });
});

describe('Wrap up v2 walks the day and sends one request', () => {
  it("walks my overdue and today's tasks and my open captures, not later tasks or ones I only help on", () => {
    const items = wrapItems(
      [task('a', 'overdue'), task('b', 'today'), task('c', 'next'), task('d', 'helping', 'helper')],
      [note('n1'), note('n2', { mine: false })],
    );
    expect(items.map((i) => i.id)).toEqual(['a', 'b', 'n1']);
  });
  it('chooses Tomorrow unless told otherwise, and Done wins over any move', () => {
    const items = wrapItems([task('a', 'today'), task('b', 'today'), task('c', 'today')], []);
    const sent = wrapPayload(items, {
      b: { done: false, move: 'next_week' },
      c: { done: true, move: 'drop' },
    });
    expect(WRAP_DEFAULT).toEqual({ done: false, move: 'tomorrow' });
    expect(sent.map((s) => s.choice)).toEqual(['tomorrow', 'next_week', 'done']);
    expect(sent[0]).toEqual({ kind: 'task', id: 'a', choice: 'tomorrow' });
  });
  it('counts what one Save will do, rows left alone going to tomorrow', () => {
    const items = wrapItems([task('a', 'today'), task('b', 'today'), task('c', 'today'), task('d', 'overdue')], []);
    expect(
      wrapSummary(items, {
        b: { done: false, move: 'next_week' },
        c: { done: true, move: 'drop' },
        d: { done: false, move: 'drop' },
      }),
    ).toEqual({ done: 1, tomorrow: 1, next_week: 1, drop: 1 });
  });
  it('after a refused Save names the rows that left and keeps the rest', () => {
    const before = wrapItems([task('a', 'today'), task('b', 'today')], []);
    const after = wrapItems([task('b', 'today')], []);
    const back = wrapRecover(before, after);
    expect(back.gone.map((i) => i.id)).toEqual(['a']);
    expect(back.items.map((i) => i.id)).toEqual(['b']);
    expect(wrapLabel(back.gone[0]!), 'a task is named by its number').toBe('T-a a');
  });
});

// 2026-10-13 is a Tuesday. Friday and Saturday are the weekend; the week starts on Sunday (D20).
describe('Wrap up offers one choice when Tomorrow and Next week are the same day', () => {
  const days = {
    sunday: '2026-10-18',
    monday: '2026-10-19',
    tuesday: '2026-10-13',
    wednesday: '2026-10-14',
    thursday: '2026-10-15',
    friday: '2026-10-16',
    saturday: '2026-10-17',
  };
  it('puts Next week on the first Sunday after the day', () => {
    expect(nextWeekDay(days.tuesday)).toBe('2026-10-18');
    expect(nextWeekDay(days.thursday)).toBe('2026-10-18');
    expect(nextWeekDay(days.sunday), 'a Sunday asks for the one after').toBe('2026-10-25');
  });
  it('offers Tomorrow, Next week and Drop on an ordinary working day', () => {
    for (const d of [days.sunday, days.monday, days.tuesday, days.wednesday]) {
      expect(moveDaysCollide(d), d).toBe(false);
      expect(wrapMoves(d), d).toEqual(['tomorrow', 'next_week', 'drop']);
    }
  });
  it('offers only Tomorrow and Drop on the last working day and on the weekend, when both are Sunday', () => {
    for (const d of [days.thursday, days.friday, days.saturday]) {
      expect(moveDaysCollide(d), d).toBe(true);
      expect(wrapMoves(d), d).toEqual(['tomorrow', 'drop']);
    }
  });
  it('sends a leftover Next week as Tomorrow when the two are the same day, and counts it so', () => {
    const items = wrapItems([task('a', 'today'), task('b', 'today')], []);
    const states = { b: { done: false, move: 'next_week' as const } };
    expect(wrapPayload(items, states, true).map((p) => p.choice)).toEqual(['tomorrow', 'tomorrow']);
    expect(wrapSummary(items, states, true)).toEqual({ done: 0, tomorrow: 2, next_week: 0, drop: 0 });
    expect(
      wrapPayload(items, states).map((p) => p.choice),
      'on other days it is kept',
    ).toEqual(['tomorrow', 'next_week']);
  });
});
