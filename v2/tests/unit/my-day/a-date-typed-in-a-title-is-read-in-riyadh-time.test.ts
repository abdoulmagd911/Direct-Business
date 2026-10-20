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
  it('counts the day in Riyadh time, not the computer’s', () => {
    // 23:30 UTC on the 20th is 02:30 on the 21st in Riyadh
    expect(read('Report tomorrow', at('2026-10-20T23:30:00Z'))).toEqual(['2026-10-22', null, 'tomorrow']);
  });
});
