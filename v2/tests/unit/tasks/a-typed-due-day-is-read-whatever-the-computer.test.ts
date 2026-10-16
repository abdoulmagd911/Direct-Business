import { describe, expect, it } from 'vitest';
import { parseDueDay, quickAddValues } from '@/modules/tasks/rules';
import { ME } from './fixtures';

describe('a due day typed into the task form is read the same on every computer (V286)', () => {
  it('reads digits only, year first: 20261020 is 20 Oct 2026', () => {
    expect(parseDueDay('20261020')).toBe('2026-10-20');
    expect(parseDueDay(' 20261020 ')).toBe('2026-10-20');
  });

  it('reads the day with dashes, slashes or dots, year first or day first, and Arabic-Indic digits', () => {
    expect(parseDueDay('2026-10-20')).toBe('2026-10-20');
    expect(parseDueDay('2026/1/5')).toBe('2026-01-05');
    expect(parseDueDay('20/10/2026')).toBe('2026-10-20');
    expect(parseDueDay('5.1.2026')).toBe('2026-01-05');
    expect(parseDueDay('٢٠٢٦١٠٢٠')).toBe('2026-10-20');
  });

  it('a half-typed or impossible day is no day', () => {
    for (const bad of ['2026', '202610', '2026102', '20261320', '20260230', '20250229', '1020-02-02', 'tomorrow', ''])
      expect(parseDueDay(bad), bad).toBeNull();
    expect(parseDueDay('20280229'), 'a leap day').toBe('2028-02-29');
  });

  it('quick add sends a read day; something typed that is not a day is refused as due_invalid, said under Due', () => {
    expect(quickAddValues({ title: 'A', due: '2026-10-20' }, ME)).toEqual({
      values: { title: 'A', due_on: '2026-10-20' },
    });
    expect(quickAddValues({ title: 'A', due: '2026' }, ME)).toEqual({ error: 'due_invalid' });
    expect(quickAddValues({ title: 'A' }, ME), 'Due is optional').toEqual({ values: { title: 'A' } });
  });
});
