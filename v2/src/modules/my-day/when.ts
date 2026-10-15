import { formatDate } from '@/core/i18n/format';
import { nextWorkingDay } from './logic';

/**
 * The "When" of a Reminder or a Follow up (productivity stage 2): three usual answers and a day of one's own, in
 * Riyadh time, 24-hour (V40, D20). A `When` is a Riyadh day and a time of day; the instant sent to the server is that
 * day and time at UTC+3 (Riyadh has no daylight saving).
 */
export type When = { day: string; time: string };
export type WhenKey = 'later_today' | 'tomorrow' | 'next_week' | 'pick';
export const WHEN_KEYS: WhenKey[] = ['later_today', 'tomorrow', 'next_week', 'pick'];

/** The time chips under Pick a day. */
export const TIME_CHIPS = ['08:00', '09:00', '12:00', '15:00', '17:00'] as const;
/** The morning a Tomorrow or Next week reminder fires. */
export const MORNING = '09:00';
/** Later today never goes past the end of the working day. */
export const WORKDAY_END = '17:30';
const LATER_BY_MINUTES = 3 * 60;
/** Later today needs at least this long before the end of the day, or it is not offered. */
const LATER_AT_LEAST = 5;

const RIYADH_MS = 3 * 3600 * 1000;
const pad = (n: number) => String(n).padStart(2, '0');
const toMinutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const toHhmm = (m: number) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;

/** Riyadh's day and minutes since midnight, from an instant. */
export function riyadhNow(now: Date): { day: string; minutes: number } {
  const d = new Date(now.getTime() + RIYADH_MS);
  return { day: d.toISOString().slice(0, 10), minutes: d.getUTCHours() * 60 + d.getUTCMinutes() };
}

/** Three hours on, or the end of the working day if that comes first; not offered when too little of the day is left. */
export function laterToday(now: Date): When | null {
  const { day, minutes } = riyadhNow(now);
  const target = Math.min(minutes + LATER_BY_MINUTES, toMinutes(WORKDAY_END));
  return target - minutes >= LATER_AT_LEAST ? { day, time: toHhmm(target) } : null;
}

/** The next working day (Sunday after a Thursday) at nine. */
export const tomorrow = (now: Date): When => ({ day: nextWorkingDay(riyadhNow(now).day), time: MORNING });

/**
 * The first Sunday after the next working day, at nine (QA-566, the Architect's ruling of 14 Oct): Next week is the week
 * AFTER Tomorrow's, so it is always later than Tomorrow. On a Thursday, a Friday and a Saturday Tomorrow is already the
 * Sunday that starts a new week, and Next week is the Sunday after it. Mirrors my.next_week_day.
 */
export function nextWeek(now: Date): When {
  return { day: nextWeekDay(riyadhNow(now).day), time: MORNING };
}

/** The same day for a Riyadh day given as "2026-10-15": Wrap up names it on its Next week choice. */
export function nextWeekDay(day: string): string {
  const d = new Date(`${nextWorkingDay(day)}T12:00:00Z`);
  do d.setUTCDate(d.getUTCDate() + 1);
  while (d.getUTCDay() !== 0);
  return d.toISOString().slice(0, 10);
}

/** Whether the next working day is the next calendar day (it is not from a Thursday: Friday and Saturday are the weekend). */
export function tomorrowIsPlain(day: string): boolean {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10) === nextWorkingDay(day);
}

/**
 * What the Tomorrow choice is called when the next working day is not literally tomorrow (the Architect's ruling of
 * 14 Oct): the day's own name, "Sunday" (Arabic "الأحد"), on a Thursday, a Friday and a Saturday. On the other days
 * `null`, and the word stays "Tomorrow". The date sits beside it as before. Used by the Wrap up sheet and its Save line,
 * the When chips and Snooze.
 */
export function tomorrowDayNameOf(day: string, locale: 'en' | 'ar'): string | null {
  if (tomorrowIsPlain(day)) return null;
  return formatDate(`${nextWorkingDay(day)}T12:00:00+03:00`, locale, {
    weekday: 'long',
    day: undefined,
    month: undefined,
    year: undefined,
  });
}

/** The same, from an instant. */
export const tomorrowDayName = (now: Date, locale: 'en' | 'ar'): string | null =>
  tomorrowDayNameOf(riyadhNow(now).day, locale);

/** The bell's snooze "until tomorrow": 08:00 Riyadh on the next working day (the Architect's ruling of 15 Oct), so a Thursday lands on Sunday, not on the weekend. */
export const snoozeUntilTomorrow = (now: Date): Date =>
  new Date(`${nextWorkingDay(riyadhNow(now).day)}T08:00:00+03:00`);

/**
 * The Riyadh day "For a week" lands on (the Architect's ruling of 15 Oct): seven days from `day`, or the first working day
 * after it when that is a Friday or a Saturday, so a Friday or a Saturday snoozes to the Sunday after.
 */
export function weekOutDay(day: string): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 7);
  while (d.getUTCDay() === 5 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** The bell's snooze "for a week": 08:00 Riyadh on that day. */
export const snoozeForAWeek = (now: Date): Date => new Date(`${weekOutDay(riyadhNow(now).day)}T08:00:00+03:00`);

/** The When a chip names; Pick a day takes the person's own day and time. Later today is null when it is not offered. */
export function whenFor(key: WhenKey, now: Date, pick?: When): When | null {
  if (key === 'later_today') return laterToday(now);
  if (key === 'tomorrow') return tomorrow(now);
  if (key === 'next_week') return nextWeek(now);
  return pick ?? tomorrow(now);
}

/** The instant the server is sent: the Riyadh day and time at UTC+3. */
export const instantOf = (w: When): string => `${w.day}T${w.time}:00+03:00`;

export const hasPassed = (w: When, now: Date): boolean => Date.parse(instantOf(w)) <= now.getTime();
