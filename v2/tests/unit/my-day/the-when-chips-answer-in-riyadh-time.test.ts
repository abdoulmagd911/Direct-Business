/**
 * The When chips without a browser (productivity stage 2): Later today is three hours on or the end of the working
 * day and goes when too little is left; Tomorrow is the next working day (Sunday after a Thursday) at nine; Next week is
 * the next Sunday at nine; the instant sent is the Riyadh day and time at UTC+3. The browser half is tests/e2e/when-chips.spec.ts.
 * Sabotage: tests/sabotage/when-chips.mjs.
 */
import { describe, expect, it } from 'vitest';
import {
  hasPassed,
  instantOf,
  laterToday,
  nextWeek,
  riyadhNow,
  snoozeUntilTomorrow,
  tomorrow,
  tomorrowDayName,
  tomorrowIsPlain,
  whenFor,
} from '../../../src/modules/my-day/when';

// Riyadh is UTC+3: 06:00Z is 09:00 there.
const at = (iso: string) => new Date(iso);

describe('the When chips', () => {
  it('reads the Riyadh day and minute from an instant, across midnight', () => {
    expect(riyadhNow(at('2026-10-14T06:00:00Z'))).toEqual({ day: '2026-10-14', minutes: 540 });
    expect(riyadhNow(at('2026-10-14T21:30:00Z')), '00:30 the next day in Riyadh').toEqual({
      day: '2026-10-15',
      minutes: 30,
    });
  });
  it('puts Later today three hours on, and at the end of the working day when that comes first', () => {
    expect(laterToday(at('2026-10-14T06:00:00Z')), '09:00 → 12:00').toEqual({ day: '2026-10-14', time: '12:00' });
    expect(laterToday(at('2026-10-14T11:00:00Z')), '14:00 → 17:00').toEqual({ day: '2026-10-14', time: '17:00' });
    expect(laterToday(at('2026-10-14T12:00:00Z')), '15:00 + 3h is past 17:30').toEqual({
      day: '2026-10-14',
      time: '17:30',
    });
  });
  it('does not offer Later today when too little of the day is left', () => {
    expect(laterToday(at('2026-10-14T14:28:00Z')), '17:28 leaves two minutes').toBeNull();
    expect(laterToday(at('2026-10-14T16:00:00Z')), '19:00 is after the day').toBeNull();
    expect(laterToday(at('2026-10-14T21:30:00Z')), 'just after midnight is a new day, 00:30 → 03:30').toEqual({
      day: '2026-10-15',
      time: '03:30',
    });
  });
  it('makes Tomorrow the next working day at nine: a Thursday asks for Sunday', () => {
    expect(tomorrow(at('2026-10-14T06:00:00Z')), 'Wednesday → Thursday').toEqual({ day: '2026-10-15', time: '09:00' });
    expect(tomorrow(at('2026-10-15T06:00:00Z')), 'Thursday → Sunday, the weekend is Friday and Saturday').toEqual({
      day: '2026-10-18',
      time: '09:00',
    });
  });
  it('makes Next week the next Sunday at nine, and a Sunday asks for the one after', () => {
    expect(nextWeek(at('2026-10-14T06:00:00Z'))).toEqual({ day: '2026-10-18', time: '09:00' });
    expect(nextWeek(at('2026-10-18T06:00:00Z')), 'on a Sunday').toEqual({ day: '2026-10-25', time: '09:00' });
  });
  it('puts Next week on the Sunday after Tomorrow on every day of the week, so it is never the same day as Tomorrow (QA-566)', () => {
    // Sun 11 – Sat 17 Oct 2026; Friday and Saturday are the weekend. [day, Tomorrow, Next week]
    const table = [
      ['2026-10-11', '2026-10-12', '2026-10-18'],
      ['2026-10-12', '2026-10-13', '2026-10-18'],
      ['2026-10-13', '2026-10-14', '2026-10-18'],
      ['2026-10-14', '2026-10-15', '2026-10-18'],
      ['2026-10-15', '2026-10-18', '2026-10-25'],
      ['2026-10-16', '2026-10-18', '2026-10-25'],
      ['2026-10-17', '2026-10-18', '2026-10-25'],
    ] as const;
    for (const [day, tmrw, next] of table) {
      const now = at(`${day}T06:00:00Z`);
      expect(tomorrow(now).day, `${day}: Tomorrow`).toBe(tmrw);
      expect(nextWeek(now).day, `${day}: Next week`).toBe(next);
      expect(nextWeek(now).day > tomorrow(now).day, `${day}: Next week is later than Tomorrow`).toBe(true);
    }
  });
  it('calls Tomorrow by its day when the next working day is not literally tomorrow, and keeps the word on other days', () => {
    // Sun 11 – Sat 17 Oct 2026: from a Thursday and a Friday the next working day is Sunday, two days or three away;
    // on a Saturday Sunday IS tomorrow, so the word stays
    const plain = ['2026-10-11', '2026-10-12', '2026-10-13', '2026-10-14', '2026-10-17'];
    const named = ['2026-10-15', '2026-10-16'];
    for (const day of plain) {
      expect(tomorrowIsPlain(day), `${day} is plain`).toBe(true);
      expect(tomorrowDayName(at(`${day}T06:00:00Z`), 'en'), `${day}: the word stays Tomorrow`).toBeNull();
    }
    for (const day of named) {
      expect(tomorrowIsPlain(day), `${day} is not plain`).toBe(false);
      expect(tomorrowDayName(at(`${day}T06:00:00Z`), 'en'), `${day}: named`).toBe('Sunday');
      expect(tomorrowDayName(at(`${day}T06:00:00Z`), 'ar'), `${day}: named in Arabic`).toBe('الأحد');
    }
  });
  it('snoozes the bell until 08:00 on the next working day: a Thursday lands on Sunday, not on the weekend', () => {
    // Sun 11 – Sat 17 Oct 2026 (the instants are late evening there too, so the Riyadh day is the one that counts)
    const lands: Record<string, string> = {
      '2026-10-11': '2026-10-12',
      '2026-10-12': '2026-10-13',
      '2026-10-13': '2026-10-14',
      '2026-10-14': '2026-10-15',
      '2026-10-15': '2026-10-18',
      '2026-10-16': '2026-10-18',
      '2026-10-17': '2026-10-18',
    };
    for (const [day, to] of Object.entries(lands)) {
      for (const time of ['06:00:00Z', '20:30:00Z']) {
        const until = snoozeUntilTomorrow(at(`${day}T${time}`));
        expect(until.toISOString(), `${day} ${time}`).toBe(`${to}T05:00:00.000Z`); // 08:00 at UTC+3
      }
    }
  });
  it('sends the Riyadh day and time at UTC+3, and takes Pick a day as given', () => {
    expect(instantOf({ day: '2026-10-15', time: '15:00' })).toBe('2026-10-15T15:00:00+03:00');
    expect(whenFor('pick', at('2026-10-14T06:00:00Z'), { day: '2026-10-16', time: '12:00' })).toEqual({
      day: '2026-10-16',
      time: '12:00',
    });
    expect(whenFor('later_today', at('2026-10-14T16:00:00Z'))).toBeNull();
  });
  it('knows a time that has passed', () => {
    const now = at('2026-10-14T09:00:00Z'); // 12:00 in Riyadh
    expect(hasPassed({ day: '2026-10-14', time: '11:59' }, now)).toBe(true);
    expect(hasPassed({ day: '2026-10-14', time: '15:00' }, now)).toBe(false);
  });
});
