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

/** The next Sunday after today (a Sunday asks for the one after) at nine. */
export function nextWeek(now: Date): When {
  const { day } = riyadhNow(now);
  const d = new Date(`${day}T12:00:00Z`);
  do d.setUTCDate(d.getUTCDate() + 1);
  while (d.getUTCDay() !== 0);
  return { day: d.toISOString().slice(0, 10), time: MORNING };
}

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
