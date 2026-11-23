/**
 * Landing 40 — per-member settings (the owner's approved design of 22 Nov 2026). The three extras of a person's
 * record are three capabilities; a person's own setting reads as "As their role", "Allowed" or "View only"; the
 * Finance import section is offered to an admin, and to anyone but a Viewer who holds the import extra.
 * The database decides for real (XTR-01 to XTR-04). Every value is made up.
 * Sabotages: tests/sabotage/landing-40.mjs.
 */
import { describe, expect, it } from 'vitest';
import ar from '../../../messages/ar.json';
import en from '../../../messages/en.json';
import { mayImportFinance } from '../../../src/modules/finance/may-import';
import { EXTRA_CHOICES, EXTRA_ROWS, extraChoiceOf } from '../../../src/modules/org/extra-access';

const me = (key: string | null, capabilities: string[] = []) => ({
  person: { role: key === null ? null : { key, is_admin: key === 'admin' } },
  capabilities,
});

describe('the three extras', () => {
  it('are Import, Edit someone else’s work and Change credit limits, each one capability', () => {
    expect(EXTRA_ROWS).toEqual({
      import: 'finance.import',
      edit_others: 'records.edit_others',
      credit: 'finance.credit_control',
    });
  });
  it('have three choices, As their role first', () => {
    expect(EXTRA_CHOICES).toEqual(['as_role', 'allowed', 'view_only']);
  });
  it('read a person’s own setting: none is As their role, granted is Allowed, not granted is View only', () => {
    expect(extraChoiceOf(undefined)).toBe('as_role');
    expect(extraChoiceOf(null)).toBe('as_role');
    expect(extraChoiceOf({ granted: true })).toBe('allowed');
    expect(extraChoiceOf({ granted: false })).toBe('view_only');
  });
  it('are worded in English and Arabic: the title, every row and every choice', () => {
    for (const words of [en, ar]) {
      const x = words.settings.people.extra as Record<string, string>;
      for (const key of ['title', ...Object.keys(EXTRA_ROWS), ...EXTRA_CHOICES]) expect(x[key], key).toBeTruthy();
    }
    expect(en.settings.people.extra).toMatchObject({
      title: 'Extra access for this person',
      import: 'Import files on Finance',
      edit_others: "Edit someone else's work",
      credit: 'Change credit limits',
      as_role: 'As their role',
      allowed: 'Allowed',
      view_only: 'View only',
    });
  });
});

describe('who is offered the import section', () => {
  it('an admin always', () => {
    expect(mayImportFinance(me('admin'))).toBe(true);
  });
  it('a head, a manager or a team member who holds the import extra', () => {
    for (const key of ['head', 'manager', 'member'])
      expect(mayImportFinance(me(key, ['finance.import'])), key).toBe(true);
  });
  it('nobody without it: a team member and a manager with Finance at Full are not', () => {
    for (const key of ['manager', 'member']) expect(mayImportFinance(me(key, ['tasks.assign_own'])), key).toBe(false);
  });
  it('never a Viewer, whatever they hold, nor a person with no role', () => {
    expect(mayImportFinance(me('viewer', ['finance.import']))).toBe(false);
    expect(mayImportFinance(me(null, ['finance.import']))).toBe(false);
  });
});
