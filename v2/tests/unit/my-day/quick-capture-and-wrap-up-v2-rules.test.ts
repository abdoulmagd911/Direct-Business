/**
 * Quick capture and Wrap up v2 without a browser (productivity stage 1): what the sheet sends for each kind, the
 * morning a reminder starts at, and what Wrap up walks and sends. The browser half is tests/e2e/capture-wrap.spec.ts.
 * Sabotage: tests/sabotage/capture-wrap.mjs.
 */
import { describe, expect, it } from 'vitest';
import {
  wrapGroups,
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
  it('sends only the rows the person chose — a row left alone is not sent, and nothing is chosen by default', () => {
    const items = wrapItems([task('a', 'today'), task('b', 'today'), task('c', 'today')], []);
    expect(wrapPayload(items, {}), 'nothing chosen, nothing sent').toEqual([]);
    const sent = wrapPayload(items, { b: 'drop', c: 'done' });
    expect(sent.map((s) => s.choice)).toEqual(['drop', 'done']);
    expect(sent[0]).toEqual({ kind: 'task', id: 'b', choice: 'drop' });
  });
  it('counts what one Save will do from the choices made, and counts nothing for the rows left alone', () => {
    const items = wrapItems([task('a', 'today'), task('b', 'today'), task('c', 'today'), task('d', 'overdue')], []);
    expect(wrapSummary(items, { b: 'tomorrow', c: 'done', d: 'drop' })).toEqual({ done: 1, tomorrow: 1, drop: 1 });
    expect(wrapSummary(items, {}), 'no choice, no count').toEqual({ done: 0, tomorrow: 0, drop: 0 });
  });
  it('names each capture by its real kind — Idea, Checklist, Reminder — and a task as a task, never all as Note', () => {
    const items = wrapItems(
      [task('a', 'today')],
      [
        note('n1'),
        note('n2', { capture_kind: 'idea' }),
        note('n3', { capture_kind: 'checklist', kind: 'checklist' }),
        note('n4', { capture_kind: 'reminder' }),
        note('n5', { kind: 'checklist' }),
      ],
    );
    expect(items.map((i) => i.word)).toEqual(['task', 'note', 'idea', 'checklist', 'reminder', 'checklist']);
  });
  it('groups the rows by kind in a fixed order, and draws no group for a kind with no rows', () => {
    const items = wrapItems(
      [task('a', 'today')],
      [note('r', { capture_kind: 'reminder' }), note('i', { capture_kind: 'idea' }), note('n')],
    );
    const groups = wrapGroups(items);
    expect(groups.map((g) => g.word)).toEqual(['task', 'note', 'idea', 'reminder']);
    expect(groups.find((g) => g.word === 'idea')?.items.map((i) => i.id)).toEqual(['i']);
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
