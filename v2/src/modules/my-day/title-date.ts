import { MORNING, riyadhNow } from './when';

/**
 * A date typed in a title (V639 (1)): "Call hotel Friday 6pm" is read as a day and a time in Riyadh time, English words
 * first (the Arabic words follow, reviewed by builder C). It is only read, never written into the title: the person
 * sees the day it was read as in a chip they can remove before saving.
 *
 *  - a day: today · tomorrow · a weekday (Sunday … Saturday, the next one after today) · "21 Oct" or "Oct 21", with an
 *    optional year (a day already gone this year means next year). Ordinary words are not days (V651, QA-581/582):
 *    a short weekday (Sun … Sat) counts only after "on" or "next", or beside a time; a lowercase "may" is a month only
 *    with a year beside it; when a weekday and a month are both typed the weekday wins.
 *  - a time: "6pm", "6:30 pm", "at 18:30"; a bare "at 6" is not read, and a bare 18:30 among other words ("Flight EK
 *    18:30") is never a date
 *  - a day with no time takes 09:00, the morning a Tomorrow reminder fires; a time with no day is today if it is still
 *    to come, else tomorrow.
 *  - anything that would be in the past is not read.
 */
export type TitleDate = {
  /** The Riyadh day, "2026-10-23". */
  day: string;
  /** "18:00", or null when no time was typed. */
  time: string | null;
  /** The words that were read, as typed ("Friday 6pm"). */
  found: string;
};

const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'] as const;
const MONTH_RE =
  '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
const WEEKDAY_RE =
  '(sun(?:day)?|mon(?:day)?|tue(?:s(?:day)?)?|wed(?:nesday)?|thu(?:r(?:s(?:day)?)?)?|fri(?:day)?|sat(?:urday)?)';
// A weekday comes first: when a weekday and a month are both typed, the weekday wins (V651)
const DAY_RES: { re: RegExp; kind: 'word' | 'weekday' | 'dm' | 'md' }[] = [
  { re: new RegExp(`\\b((?:on|next)\\s+)?${WEEKDAY_RE}\\b`, 'i'), kind: 'weekday' },
  {
    re: new RegExp(`\\b(?:on\\s+)?(\\d{1,2})(?:st|nd|rd|th)?\\s+${MONTH_RE}\\.?(?:\\s+(\\d{4}))?\\b`, 'i'),
    kind: 'dm',
  },
  {
    re: new RegExp(`\\b(?:on\\s+)?${MONTH_RE}\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(\\d{4}))?\\b`, 'i'),
    kind: 'md',
  },
  { re: /\b(today|tomorrow)\b/i, kind: 'word' },
];
const TIME_RE = /\b(?:at\s+)?(?:(\d{1,2})(?::(\d{2}))?\s*(am|pm)|([01]?\d|2[0-3]):([0-5]\d))\b/i;

const pad = (n: number) => String(n).padStart(2, '0');
const hhmm = (h: number, m: number) => `${pad(h)}:${pad(m)}`;
const addDays = (day: string, n: number) => {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const dowOf = (day: string) => new Date(`${day}T12:00:00Z`).getUTCDay();
const realDay = (y: number, m: number, d: number) => {
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
    ? `${y}-${pad(m)}-${pad(d)}`
    : null;
};

type TimeRead = { time: string; at: number; end: number; explicit: boolean };

/** Every time in the text, in order; an impossible one (13pm, 9:75pm) is skipped, never the end of the search. */
function timesIn(text: string): TimeRead[] {
  const out: TimeRead[] = [];
  for (const m of text.matchAll(new RegExp(TIME_RE.source, 'gi'))) {
    let time: string;
    if (m[3]) {
      const h = Number(m[1]);
      if (h < 1 || h > 12) continue;
      if (m[2] !== undefined && Number(m[2]) > 59) continue;
      const pm = m[3].toLowerCase() === 'pm';
      time = hhmm((h % 12) + (pm ? 12 : 0), Number(m[2] ?? 0));
    } else {
      time = hhmm(Number(m[4]), Number(m[5]));
    }
    // a time with am/pm or an "at" before it is meant as a time; a bare 18:30 beside other words ("Flight EK 18:30") is not
    out.push({ time, at: m.index, end: m.index + m[0].length, explicit: !!m[3] || /^at\s/i.test(m[0]) });
  }
  return out;
}

/** The first time meant as one; failing that the first bare one (it still counts beside a day: "tomorrow 14:00"). */
function readTime(text: string): TimeRead | null {
  const all = timesIn(text);
  return all.find((x) => x.explicit) ?? all[0] ?? null;
}

type DayRead = { day: string; at: number; end: number };

function readDay(text: string, today: string, t: { at: number; end: number } | null): DayRead | null {
  for (const { re, kind } of DAY_RES) {
    // every match is looked at, in order, and the first valid one kept: a rejected match never hides a later valid
    // one (QA-583: "Check sat phone Friday 6pm" is Friday)
    for (const m of text.matchAll(new RegExp(re.source, 'gi'))) {
      const at = m.index;
      const end = m.index + m[0].length;
      if (kind === 'word') return { day: m[1]!.toLowerCase() === 'today' ? today : addDays(today, 1), at, end };
      if (kind === 'weekday') {
        const word = m[2]!;
        const want = WEEKDAYS.indexOf(word.slice(0, 3).toLowerCase() as (typeof WEEKDAYS)[number]);
        const ahead = (want - dowOf(today) + 7) % 7 || 7;
        const fullName = /^(sunday|monday|tuesday|wednesday|thursday|friday|saturday)$/i.test(word);
        // a short weekday is a day only after "on" or "next", or beside a time (V651); anything else is another word
        if (!fullName && !m[1] && !(t && Math.min(Math.abs(t.at - end), Math.abs(at - t.end)) <= 6)) continue;
        return { day: addDays(today, ahead), at, end };
      }
      const dayNum = Number(kind === 'dm' ? m[1] : m[2]);
      const monthText = (kind === 'dm' ? m[2] : m[1])!;
      const monthWord = monthText.slice(0, 3).toLowerCase();
      // "may" is also a word: a lowercase "may" is a month only with a year beside it (V651)
      if (monthText === 'may' && !m[3]) continue;
      const month = MONTHS.indexOf(monthWord as (typeof MONTHS)[number]) + 1;
      const typedYear = m[3] ? Number(m[3]) : null;
      const thisYear = Number(today.slice(0, 4));
      let day = realDay(typedYear ?? thisYear, month, dayNum);
      if (day && !typedYear && day < today) day = realDay(thisYear + 1, month, dayNum);
      if (!day) continue;
      return { day, at, end };
    }
  }
  return null;
}

export function readDateInTitle(text: string, now: Date): TitleDate | null {
  const { day: today, minutes } = riyadhNow(now);
  const t = readTime(text);
  const d = readDay(text, today, t);
  // a time alone counts only when it is meant as one: "4pm", "at 18:30" — never makes a flight number a date ("Flight EK 18:30")
  if (!d && t && !t.explicit) return null;
  if (!d && !t) return null;
  // the words read, as typed: a day and a time side by side are one stretch ("Friday at 6pm"), else the two pieces
  const first = d && t ? (d.at <= t.at ? d : t) : (d ?? t)!;
  const second = d && t ? (d.at <= t.at ? t : d) : null;
  const found = second
    ? second.at - first.end <= 6
      ? text.slice(first.at, second.end)
      : `${text.slice(first.at, first.end)} ${text.slice(second.at, second.end)}`
    : text.slice(first.at, first.end);
  const time = t?.time ?? null;
  let day = d?.day;
  if (!day) {
    // a time alone: today if still to come, else tomorrow
    const at = Number(time!.slice(0, 2)) * 60 + Number(time!.slice(3, 5));
    day = at > minutes ? today : addDays(today, 1);
  }
  const effective = time ?? MORNING;
  const eff = Number(effective.slice(0, 2)) * 60 + Number(effective.slice(3, 5));
  if (day < today || (day === today && eff <= minutes)) return null;
  return { day, time, found: found.trim() };
}
