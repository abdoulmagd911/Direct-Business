/**
 * The reminder alert's pure rules (productivity stage 2): the one timer waits for the next reminder's time (plus a
 * moment for the job that tells it) and never repeats; a time that has come but is not yet told is asked again soon;
 * Snooze offers the When chips' answers in Riyadh time; a browser notification is shown once per reminder id.
 */
import { describe, expect, it } from 'vitest';
import {
  alertDelay,
  snoozeChoices,
  snoozeInstant,
  unannounced,
  type DueReminder,
} from '@/modules/my-day/reminder-alert';

const at = (iso: string) => new Date(iso);
const due = (id: string): DueReminder => ({
  id,
  note_id: `n-${id}`,
  text: `Made-up ${id}`,
  remind_at: '2026-10-14T07:00:00Z',
  notification_id: `x-${id}`,
});

describe('the one timer', () => {
  it('waits for the next reminder, a few seconds past its time', () => {
    expect(alertDelay('2026-10-14T10:00:00Z', at('2026-10-14T09:00:00Z'))).toBe(3_600_000 + 5_000);
  });
  it('is not set when no reminder is waiting', () => {
    expect(alertDelay(null, at('2026-10-14T09:00:00Z'))).toBeNull();
  });
  it('asks again soon when the time has come and the job has not told it yet', () => {
    expect(alertDelay('2026-10-14T08:59:50Z', at('2026-10-14T09:00:00Z'))).toBe(15_000);
  });
});

describe('Snooze', () => {
  it('offers Later today, Tomorrow and Next week in Riyadh time', () => {
    // Wed 14 Oct 2026, 10:00 Riyadh
    const now = at('2026-10-14T07:00:00Z');
    expect(snoozeChoices(now).map((c) => [c.key, c.when.day, c.when.time])).toEqual([
      ['later_today', '2026-10-14', '13:00'],
      ['tomorrow', '2026-10-15', '09:00'],
      ['next_week', '2026-10-18', '09:00'],
    ]);
  });
  it('leaves Later today out late in the working day, Tomorrow skips the weekend, and Next week is the Sunday after it (QA-566)', () => {
    // Thu 15 Oct 2026, 17:30 Riyadh
    const now = at('2026-10-15T14:30:00Z');
    expect(snoozeChoices(now).map((c) => [c.key, c.when.day])).toEqual([
      ['tomorrow', '2026-10-18'],
      ['next_week', '2026-10-25'],
    ]);
  });
  it('sends the Riyadh day and time as an instant at UTC+3', () => {
    expect(snoozeInstant({ day: '2026-10-15', time: '09:00' })).toBe('2026-10-15T09:00:00+03:00');
  });
});

describe('the browser notification', () => {
  it('is shown once per reminder id', () => {
    const seen = new Set<string>(['a']);
    expect(unannounced([due('a'), due('b')], seen).map((r) => r.id)).toEqual(['b']);
  });
});
