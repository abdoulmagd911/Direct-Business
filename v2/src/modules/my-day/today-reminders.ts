import type { DueReminder, PendingReminder } from './types';
import { riyadhParts } from './when';

/** A reminder as the Today block draws it: when it falls in Riyadh time, and its alert in the bell if it has gone out. */
export type TodayReminder = {
  id: string;
  note_id: string | null;
  text: string;
  remind_at: string;
  day: string;
  time: string;
  notification_id: string | null;
};

const row = (r: PendingReminder | DueReminder, notification_id: string | null): TodayReminder => ({
  id: r.id,
  note_id: r.note_id,
  text: (r.text ?? '').trim(),
  remind_at: r.remind_at,
  ...riyadhParts(r.remind_at),
  notification_id,
});

/**
 * The reminders the Today block lists: those whose time has come and are not put away (`due`, with their alert) and
 * those still to fall later today or that the job has not yet sent (`pending`), as Overdue (an earlier Riyadh day) and
 * Today. A reminder on a later day is not today's. Each appears once, the copy with its alert winning, since Done clears
 * that too.
 */
export function todayReminders(
  pending: PendingReminder[],
  due: DueReminder[],
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
