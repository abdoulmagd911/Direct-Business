/**
 * Productivity Stage 2, the Today block's reminders without a browser: which are listed (due today and overdue, by the
 * Riyadh day, D20), once each, and the record a follow-up is about (named only if the reader may see it, V454). Every
 * name and time is made up. Sabotage: tests/sabotage/stage2-capture-today.mjs.
 */
import { describe, expect, it } from 'vitest';
import {
  laterReminders,
  notesWithoutListedReminders,
  todayReminders,
} from '../../../src/modules/my-day/today-reminders';
import type { DueReminder } from '../../../src/modules/my-day/reminder-alert';
import type { PendingReminder } from '../../../src/modules/my-day/types';

const pending = (id: string, remind_at: string, text = id): PendingReminder => ({
  id,
  note_id: null,
  remind_at,
  text,
});
const due = (id: string, remind_at: string, notification_id = `n-${id}`): DueReminder => ({
  id,
  note_id: `note-${id}`,
  remind_at,
  text: id,
  notification_id,
});

describe('the Today block lists reminders due today and overdue', () => {
  const day = '2026-10-14';
  it('puts an earlier Riyadh day under Overdue and today under Today, leaving later days out', () => {
    const g = todayReminders(
      [pending('later-today', '2026-10-14T12:00:00+03:00'), pending('next-week', '2026-10-18T09:00:00+03:00')],
      [due('yesterday', '2026-10-13T09:00:00+03:00'), due('now', '2026-10-14T08:00:00+03:00')],
      day,
    );
    expect(g.overdue.map((r) => r.id)).toEqual(['yesterday']);
    expect(g.today.map((r) => r.id)).toEqual(['now', 'later-today']);
  });
  it('reads the day in Riyadh: 22:30 UTC on the 13th is already the 14th there', () => {
    const g = todayReminders([pending('late', '2026-10-13T22:30:00Z')], [], day);
    expect(g.today.map((r) => r.id)).toEqual(['late']);
  });
  it('lists a reminder once and keeps its alert, so Done clears the bell too', () => {
    const g = todayReminders([pending('x', '2026-10-14T08:00:00+03:00')], [due('x', '2026-10-14T08:00:00+03:00')], day);
    expect(g.today).toHaveLength(1);
    expect(g.today[0]?.notification_id).toBe('n-x');
    expect(g.today[0]?.time).toBe('08:00');
  });
  it('lists nothing when nothing is due', () => {
    expect(todayReminders([], [], day)).toEqual({ overdue: [], today: [] });
  });
});

describe('a follow-up keeps its record as a tag, never as its words', () => {
  it('carries the record the database named, and none when it named none', () => {
    const named = {
      ...due('f1', '2026-10-14T08:00:00+03:00'),
      about: { entity: 'partner' as const, id: 'c1', label: 'Waha Foods' },
    };
    const g = todayReminders([pending('f2', '2026-10-14T09:00:00+03:00')], [named], '2026-10-14');
    expect(g.today.find((r) => r.id === 'f1')?.about?.label).toBe('Waha Foods');
    expect(g.today.find((r) => r.id === 'f1')?.text, "the words stay the person's own (QA-560)").toBe('f1');
    expect(g.today.find((r) => r.id === 'f2')?.about).toBeNull();
  });
});

describe('no reminder is listed twice on My day', () => {
  it('keeps in the Reminders block only the ones for a later day', () => {
    const rows = [
      pending('today', '2026-10-14T15:00:00+03:00'),
      pending('late-night-utc', '2026-10-14T22:30:00Z'),
      pending('tomorrow', '2026-10-15T09:00:00+03:00'),
    ];
    expect(laterReminders(rows, '2026-10-14').map((r) => r.id)).toEqual(['late-night-utc', 'tomorrow']);
  });
});

describe('a Reminder shows once on My day', () => {
  const notes = [{ id: 'plain' }, { id: 'waiting' }, { id: 'due-now' }, { id: 'done-long-ago' }];
  it('leaves out the notes whose reminder is listed above, pending or due, and keeps every other note', () => {
    const kept = notesWithoutListedReminders(
      notes,
      [{ ...pending('r1', '2026-10-20T09:00:00+03:00'), note_id: 'waiting' }],
      [{ ...due('r2', '2026-10-14T08:00:00+03:00'), note_id: 'due-now' }],
    );
    expect(
      kept.map((n) => n.id),
      'a reminder is not also a note',
    ).toEqual(['plain', 'done-long-ago']);
  });
  it('keeps a note whose reminder is done or gone: it is an ordinary note again', () => {
    expect(notesWithoutListedReminders(notes, [], []).map((n) => n.id)).toEqual(notes.map((n) => n.id));
  });
});
