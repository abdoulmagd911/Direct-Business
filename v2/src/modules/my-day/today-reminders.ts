import type { DueReminder } from './reminder-alert';
import type { AboutRecord, PendingReminder } from './types';

/** A reminder as the Today block draws it: when it falls in Riyadh time, and its alert in the bell if it has gone out. */
export type TodayReminder = {
  id: string;
  note_id: string | null;
  text: string;
  remind_at: string;
  day: string;
  time: string;
  notification_id: string | null;
  /** The record a follow-up is about, named only if this reader may see it (V454). */
  about: AboutRecord | null;
};

type DueWithAbout = DueReminder & { about?: AboutRecord | null };

/** An instant's Riyadh date ("2026-10-14") and clock ("09:00"); Riyadh is UTC+3 all year (D20). */
export const riyadhParts = (iso: string) => {
  const r = new Date(Date.parse(iso) + 3 * 3_600_000).toISOString();
  return { day: r.slice(0, 10), time: r.slice(11, 16) };
};

const row = (r: PendingReminder | DueWithAbout, notification_id: string | null): TodayReminder => ({
  id: r.id,
  note_id: r.note_id,
  text: (r.text ?? '').trim(),
  remind_at: r.remind_at,
  ...riyadhParts(r.remind_at),
  notification_id,
  about: r.about ?? null,
});

/**
 * The reminders the Today block lists: those whose time has come and are not put away (`due`, with their alert) and
 * those still to fall later today or that the job has not yet sent (`pending`), as Overdue (an earlier Riyadh day) and
 * Today. A reminder on a later day is not today's. Each appears once, the copy with its alert winning, since Done clears
 * that too.
 */
/** The reminders for a later Riyadh day: what the Reminders block below keeps, so none is listed twice on My day. */
export const laterReminders = (pending: PendingReminder[], day: string): PendingReminder[] =>
  pending.filter((r) => riyadhParts(r.remind_at).day > day);

/**
 * My notes without the notes whose reminder is already listed above them (the Today block or the Reminders block), so a
 * Reminder shows once on My day. A note whose reminder is done or gone is an ordinary note again and stays.
 */
export function notesWithoutListedReminders<N extends { id: string }>(
  notes: N[],
  pending: PendingReminder[],
  due: DueWithAbout[],
): N[] {
  const listed = new Set<string>();
  for (const r of [...pending, ...due]) if (r.note_id) listed.add(r.note_id);
  return notes.filter((n) => !listed.has(n.id));
}

export function todayReminders(
  pending: PendingReminder[],
  due: DueWithAbout[],
  day: string,
): { overdue: TodayReminder[]; today: TodayReminder[] } {
  const byId = new Map<string, TodayReminder>();
  for (const r of pending) byId.set(r.id, row(r, null));
  for (const r of due) byId.set(r.id, row(r, r.notification_id));
  const all = [...byId.values()].sort(
    (a, b) => Date.parse(a.remind_at) - Date.parse(b.remind_at) || a.id.localeCompare(b.id),
  );
  return { overdue: all.filter((r) => r.day < day), today: all.filter((r) => r.day === day) };
}
