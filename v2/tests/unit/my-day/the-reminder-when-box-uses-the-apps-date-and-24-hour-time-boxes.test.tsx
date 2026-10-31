/**
 * Turn into → Reminder: the When is the app's own date box and 24-hour time box (as the Due box after #308), not one
 * browser date-and-time text box with AM/PM. Names are made up. Sabotage: tests/sabotage/reminder-when-box.mjs.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const src = readFileSync('src/modules/my-day/screens/TurnDialogs.tsx', 'utf8');
const reminder = src.slice(
  src.indexOf('export function ReminderDialog'),
  src.indexOf('export function ChecklistItemDialog'),
);

describe('the Reminder When box', () => {
  it('has a date box and a 24-hour time box, not one datetime-local box', () => {
    expect(reminder).toContain('data-reminder-day');
    expect(reminder).toContain('<TimeInput');
    expect(reminder).not.toContain('datetime-local');
  });
  it('is saved in Riyadh time from the day and the typed time', () => {
    expect(reminder).toContain('`${f.day}T${f.time}:00+03:00`');
  });
  it('cannot be saved while the typed time is not a time', () => {
    expect(reminder).toContain('onReadable={setTimeOk}');
  });
});
