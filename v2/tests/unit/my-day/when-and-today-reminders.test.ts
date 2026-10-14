/**
 * Productivity Stage 2, the screens' rules without a browser: the "When" answers of a Reminder (Riyadh time, D20; design
 * §D), what the Today block lists of reminders, and that a follow-up names its record only when the reader may see it
 * (V454). Every name and time is made up. Sabotage: tests/sabotage/stage2-capture-today.mjs.
 */
import { describe, expect, it } from 'vitest';
import { todayReminders } from '../../../src/modules/my-day/today-reminders';
import type { DueReminder, PendingReminder } from '../../../src/modules/my-day/types';
import { resolveWhen, whenLine, whenOptions } from '../../../src/modules/my-day/when';

// Riyadh is UTC+3 all year: 09:30 in Riyadh is 06:30 UTC.
const at = (riyadh: string) => new Date(`${riyadh}:00+03:00`);

describe('When: Later today, Tomorrow, Next week', () => {
  it('opens on Tomorrow at 09:00, the next working day', () => {
    const o = whenOptions(at('2026-10-13T10:00')); // a Tuesday
    expect(o.tomorrow).toBe('2026-10-14T09:00');
    expect(resolveWhen('tomorrow', o, { day: '', time: '' })).toBe('2026-10-14T09:00');
  });
  it('reads Sunday for Tomorrow on a Thursday and on a Friday (the weekend is Friday and Saturday)', () => {
    expect(whenOptions(at('2026-10-15T10:00')).tomorrow).toBe('2026-10-18T09:00'); // Thursday
    expect(whenOptions(at('2026-10-16T10:00')).tomorrow).toBe('2026-10-18T09:00'); // Friday
  });
  it('makes Next week the first Sunday after Tomorrow, so the two never name the same day', () => {
    expect(whenOptions(at('2026-10-14T10:00')).next).toBe('2026-10-18T09:00'); // Wednesday: Tomorrow Thu, next Sun
    const thu = whenOptions(at('2026-10-15T10:00'));
    expect(thu.tomorrow).toBe('2026-10-18T09:00');
    expect(thu.next).toBe('2026-10-25T09:00');
  });
  it('puts Later today three hours on, to the next five minutes, and never past 17:30', () => {
    expect(whenOptions(at('2026-10-14T09:02')).later).toBe('2026-10-14T12:05');
    expect(whenOptions(at('2026-10-14T15:10')).later, 'capped at the end of the working day').toBe('2026-10-14T17:30');
  });
  it('leaves Later today out once the working day is over', () => {
    expect(whenOptions(at('2026-10-14T17:30')).later).toBeUndefined();
    expect(whenOptions(at('2026-10-14T22:00')).later).toBeUndefined();
  });
  it('takes the day from Riyadh, not from the clock the browser keeps (23:30 UTC is already tomorrow in Riyadh)', () => {
    expect(whenOptions(new Date('2026-10-13T23:30:00Z')).day).toBe('2026-10-14');
  });
  it('never leaves Save without a time: an empty Day or Time falls back to Tomorrow and 09:00', () => {
    const o = whenOptions(at('2026-10-13T10:00'));
    expect(resolveWhen('pick', o, { day: '', time: '' })).toBe('2026-10-14T09:00');
    expect(resolveWhen('pick', o, { day: '2026-10-15', time: '15:00' })).toBe('2026-10-15T15:00');
  });
});

describe('the line that says the result', () => {
  it('writes "Wed 14 Oct · 09:00" in English and keeps Latin digits and Gregorian dates in Arabic', () => {
    expect(whenLine('2026-10-14T09:00', 'en')).toBe('Wed 14 Oct · 09:00');
    const ar = whenLine('2026-10-14T09:00', 'ar');
    expect(ar).toContain('09:00');
    expect(ar).toMatch(/14/);
    expect(ar).not.toMatch(/[٠-٩]/);
  });
});

const pending = (id: string, remind_at: string, text = id): PendingReminder => ({
  id,
  note_id: null,
  remind_at,
  text,
});
const due = (id: string, remind_at: string, notification_id: string | null = `n-${id}`): DueReminder => ({
  id,
  note_id: null,
  remind_at,
  text: id,
  notification_id,
});

describe('the Today block lists reminders due today and overdue', () => {
  const day = '2026-10-14';
  it('puts an earlier Riyadh day under Overdue and today under Today, leaving later days out', () => {
    const g = todayReminders(
      [pending('later-today', '2026-10-14T12:00:00+03:00'), pending('next-week', '2026-10-18T09:00:00+03:00')],
      [due('yesterday', '2026-10-13T09:00:00+03:00'), due('now', '2026-10-14T08:00:00+03:00')],
      day,
    );
    expect(g.overdue.map((r) => r.id)).toEqual(['yesterday']);
    expect(g.today.map((r) => r.id)).toEqual(['now', 'later-today']);
  });
  it('reads the day in Riyadh: 22:30 UTC on the 13th is already the 14th there', () => {
    const g = todayReminders([pending('late', '2026-10-13T22:30:00Z')], [], day);
    expect(g.today.map((r) => r.id)).toEqual(['late']);
  });
  it('lists a reminder once and keeps its alert, so Done clears the bell too', () => {
    const g = todayReminders([pending('x', '2026-10-14T08:00:00+03:00')], [due('x', '2026-10-14T08:00:00+03:00')], day);
    expect(g.today).toHaveLength(1);
    expect(g.today[0]?.notification_id).toBe('n-x');
    expect(g.today[0]?.time).toBe('08:00');
  });
  it('lists nothing when nothing is due', () => {
    expect(todayReminders([], [], day)).toEqual({ overdue: [], today: [] });
  });
});
