import { instantOf, whenFor, type When, type WhenKey } from './when';

/** One row of api.reminders_due: a reminder whose time has come and whose alert is still open. */
export type DueReminder = {
  id: string;
  note_id: string;
  text: string;
  remind_at: string;
  notification_id: string;
};
export type DueAnswer = { due: DueReminder[]; next_at: string | null };

/** The three answers Snooze offers: the same as the When chips (the Later today chip when enough of the day is left). */
export const SNOOZE_KEYS = ['later_today', 'tomorrow', 'next_week'] as const satisfies readonly WhenKey[];
export type SnoozeKey = (typeof SNOOZE_KEYS)[number];

export function snoozeChoices(now: Date): { key: SnoozeKey; when: When }[] {
  return SNOOZE_KEYS.flatMap((key) => {
    const when = whenFor(key, now);
    return when ? [{ key, when }] : [];
  });
}

/** The instant a snooze is sent to the server. */
export const snoozeInstant = (when: When) => instantOf(when);

/** The job that tells a reminder runs every minute, so a time that has come is told within one. */
const SLACK_MS = 5_000;
const WAITING_FOR_THE_JOB_MS = 15_000;

/**
 * How long until the screen asks again: once, at the next reminder's time (a few seconds after, so the job has had its
 * turn); if that time has already come but the job has not told it yet, a short wait. Never a repeating timer (A2).
 * `null` when no reminder is waiting.
 */
export function alertDelay(nextAt: string | null, now: Date): number | null {
  if (!nextAt) return null;
  const wait = Date.parse(nextAt) - now.getTime();
  return wait > 0 ? wait + SLACK_MS : WAITING_FOR_THE_JOB_MS;
}

/** A timer's longest wait: browsers fire a larger one at once. A reminder further off is asked for again when this one ends. */
export const LONGEST_WAIT_MS = 2 ** 31 - 1;

/** The reminders whose browser notification has not been shown yet in this tab, once per reminder id. */
export function unannounced(due: DueReminder[], seen: ReadonlySet<string>): DueReminder[] {
  return due.filter((r) => !seen.has(r.id));
}
