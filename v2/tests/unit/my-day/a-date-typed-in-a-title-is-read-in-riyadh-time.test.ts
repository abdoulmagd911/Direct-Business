/**
 * V639 (1): a date typed in a title ("Call hotel Friday 6pm") is read as a Riyadh day and time, English words first.
 * Sabotage: tests/sabotage/title-date.mjs.
 */
import { describe, expect, it } from 'vitest';
import { readDateInTitle } from '../../../src/modules/my-day/title-date';

const at = (iso: string) => new Date(iso);
// Wed 21 Oct 2026, 10:00 Riyadh
const NOW = at('2026-10-21T07:00:00Z');
const read = (text: string, now = NOW) => {
  const r = readDateInTitle(text, now);
  return r && [r.day, r.time, r.found];
};

describe('a date typed in a title', () => {
  it('reads a weekday and a time', () => {
    expect(read('Call hotel Friday 6pm')).toEqual(['2026-10-23', '18:00', 'Friday 6pm']);
    expect(read('Call hotel friday at 6:30 pm')).toEqual(['2026-10-23', '18:30', 'friday at 6:30 pm']);
  });
  it('reads a weekday as the next one after today, and "next" the same', () => {
    expect(read('Report Wednesday')).toEqual(['2026-10-28', null, 'Wednesday']);
    expect(read('Report next Sunday')).toEqual(['2026-10-25', null, 'next Sunday']);
  });
  it('reads today, tomorrow and a 24-hour time', () => {
    expect(read('Pay the supplier tomorrow 14:00')).toEqual(['2026-10-22', '14:00', 'tomorrow 14:00']);
    expect(read('Send the pack today 5pm')).toEqual(['2026-10-21', '17:00', 'today 5pm']);
  });
  it('reads a day and month, either way round, with or without a year', () => {
    expect(read('Renew visa 28 Oct')).toEqual(['2026-10-28', null, '28 Oct']);
    expect(read('Renew visa Nov 3rd')).toEqual(['2026-11-03', null, 'Nov 3rd']);
    expect(read('Contract ends 1 March 2027')).toEqual(['2027-03-01', null, '1 March 2027']);
    // a day already gone this year means next year
    expect(read('Birthday 5 Jan')).toEqual(['2027-01-05', null, '5 Jan']);
  });
  it('reads a time alone as today if it is still to come, else tomorrow', () => {
    expect(read('Stand-up 4pm')).toEqual(['2026-10-21', '16:00', '4pm']);
    expect(read('Stand-up 9am')).toEqual(['2026-10-22', '09:00', '9am']);
  });
  it('does not read a time that has gone, or a bare number, or nothing', () => {
    expect(read('Send the pack today 8am')).toBeNull();
    expect(read('Meet at 6')).toBeNull();
    expect(read('Call the hotel')).toBeNull();
    expect(read('Invoice 2026-10-30')).toBeNull();
  });
  it('does not read ordinary words as dates (QA-581)', () => {
    expect(read('Sun Hotel')).toBeNull();
    expect(read('sat phone')).toBeNull();
    expect(read('may 2 guests')).toBeNull();
    expect(read('Flight EK 18:30')).toBeNull();
  });
  it('still reads a short weekday after on or next, or beside a time, and May when it is a month', () => {
    expect(read('Visit on fri')).toEqual(['2026-10-23', null, 'on fri']);
    expect(read('Visit next sat')).toEqual(['2026-10-24', null, 'next sat']);
    expect(read('Call sat 6pm')).toEqual(['2026-10-24', '18:00', 'sat 6pm']);
    expect(read('Call fri 18:30')).toEqual(['2026-10-23', '18:30', 'fri 18:30']);
    expect(read('Sunday hotel')).toEqual(['2026-10-25', null, 'Sunday']);
    expect(read('Renew 2 May')).toEqual(['2027-05-02', null, '2 May']);
    expect(read('Renew May 2')).toEqual(['2027-05-02', null, 'May 2']);
    expect(read('Renew may 2 2027')).toEqual(['2027-05-02', null, 'may 2 2027']);
    expect(read('Meet at 18:30')).toEqual(['2026-10-21', '18:30', 'at 18:30']);
  });
  it('V651 (QA-582): lowercase may is a month only with a year; a weekday beats a month; a time alone is not a date', () => {
    expect(read('Rooms may 2 guests Friday 6pm')).toEqual(['2026-10-23', '18:00', 'Friday 6pm']);
    expect(read('Rooms may 2 guests Fri 6pm')).toEqual(['2026-10-23', '18:00', 'Fri 6pm']);
    expect(read('Rooms may 2 guests Fri')).toBeNull();
    expect(read('Pay Friday 28 Oct')).toEqual(['2026-10-23', null, 'Friday']);
    expect(read('Renew 2 may')).toBeNull();
    expect(read('Renew may 2 guests')).toBeNull();
    expect(read('Renew 2 may 2027')).toEqual(['2027-05-02', null, '2 may 2027']);
    expect(read('Flight EK 18:30 Hotel')).toBeNull();
    expect(read('Flight EK 18:30 tomorrow')).toEqual(['2026-10-22', '18:30', '18:30 tomorrow']);
  });
  it('counts the day in Riyadh time, not the computer’s', () => {
    // 23:30 UTC on the 20th is 02:30 on the 21st in Riyadh
    expect(read('Report tomorrow', at('2026-10-20T23:30:00Z'))).toEqual(['2026-10-22', null, 'tomorrow']);
  });
});
