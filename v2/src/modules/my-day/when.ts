import { intlLocale } from '@/core/i18n/format';
import { nextWorkingDay } from './logic';

/**
 * "When" for a reminder (productivity Stage 2, design §D): three usual answers and a day of your own, all in Riyadh time
 * (D20: UTC+3, no daylight saving). A time is written the way `datetime-local` writes it, "2026-10-14T09:00".
 */
export type WhenChoice = 'later' | 'tomorrow' | 'next' | 'pick';
export const WHEN_CHOICES: WhenChoice[] = ['later', 'tomorrow', 'next', 'pick'];
/** The five time chips under "Pick a day". */
export const TIME_CHIPS = ['08:00', '09:00', '12:00', '15:00', '17:00'] as const;
export const MORNING = '09:00';
/** The end of the working day, in minutes after midnight (17:30). */
const DAY_END = 17 * 60 + 30;

const pad = (n: number) => String(n).padStart(2, '0');
const clock = (minutes: number) => `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;

/** Riyadh's date and the minutes since its midnight at `now`. */
export function riyadhClock(now: Date): { day: string; minutes: number } {
  const r = new Date(now.getTime() + 3 * 3_600_000);
  return { day: r.toISOString().slice(0, 10), minutes: r.getUTCHours() * 60 + r.getUTCMinutes() };
}

/** The first Sunday strictly after `day` (the week starts on Sunday). */
export function nextSunday(day: string): string {
  const d = new Date(`${day}T12:00:00Z`);
  do d.setUTCDate(d.getUTCDate() + 1);
  while (d.getUTCDay() !== 0);
  return d.toISOString().slice(0, 10);
}

export type WhenOptions = {
  /** Three hours on, to the next five minutes, but never past 17:30; absent once the working day is over. */
  later: string | undefined;
  /** The next working day at 09:00: on a Thursday that is Sunday (Friday and Saturday are the weekend). */
  tomorrow: string;
  /** The first Sunday after "Tomorrow", so the two chips never name the same day. */
  next: string;
  /** Riyadh's date now. */
  day: string;
};

export function whenOptions(now: Date): WhenOptions {
  const { day, minutes } = riyadhClock(now);
  const target = Math.min(Math.ceil((minutes + 180) / 5) * 5, DAY_END);
  const tomorrowDay = nextWorkingDay(day);
  return {
    later: minutes < DAY_END && target > minutes ? `${day}T${clock(target)}` : undefined,
    tomorrow: `${tomorrowDay}T${MORNING}`,
    next: `${nextSunday(tomorrowDay)}T${MORNING}`,
    day,
  };
}

/**
 * The time a choice means, as `datetime-local` writes it. "Pick a day" never leaves the sheet without a time: an empty
 * Day reads as Tomorrow's and an empty Time as 09:00, so Save is never blocked by it.
 */
export function resolveWhen(choice: WhenChoice, opts: WhenOptions, pick: { day: string; time: string }): string {
  if (choice === 'pick') return `${pick.day || opts.tomorrow.slice(0, 10)}T${pick.time || MORNING}`;
  return (choice === 'later' ? opts.later : choice === 'next' ? opts.next : opts.tomorrow) ?? opts.tomorrow;
}

/** The one line that says the result: "Wed 14 Oct · 09:00" — Latin digits, Gregorian dates, in Arabic too. */
export function whenLine(local: string, locale: 'en' | 'ar'): string {
  const [day, time] = local.split('T');
  const d = new Date(`${day}T12:00:00Z`);
  if (!day || !time || Number.isNaN(d.getTime())) return '';
  const date = new Intl.DateTimeFormat(intlLocale(locale), {
    timeZone: 'UTC',
    calendar: 'gregory',
    numberingSystem: 'latn',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
    .format(d)
    .replace(',', '');
  return `${date} · ${time}`;
}

/** An instant's Riyadh date ("2026-10-14") and clock ("09:00"). */
export function riyadhParts(iso: string): { day: string; time: string } {
  const r = new Date(new Date(iso).getTime() + 3 * 3_600_000).toISOString();
  return { day: r.slice(0, 10), time: r.slice(11, 16) };
}
