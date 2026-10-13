/**
 * 13 Oct sweep: an avatar's initials are the first letters of the first and last name — a word that starts with a digit
 * ("13Oct", "8Oct") is a date or a number, never a name. Every name is made up.
 * Sabotage: tests/sabotage/new-button.mjs "initials-take-the-digit".
 */
import { describe, expect, it } from 'vitest';
import { initialsOf } from '../../../src/ui/Avatar';

describe('initialsOf', () => {
  it('skips words that are not names', () => {
    expect(initialsOf('TEST Sweep Supplier 13Oct')).toBe('TS');
    expect(initialsOf('TEST phone check 8Oct')).toBe('TC');
    expect(initialsOf('Sara Omar - 3')).toBe('SO');
  });
  it('keeps the plain cases', () => {
    expect(initialsOf('Sara Omar')).toBe('SO');
    expect(initialsOf('Sara')).toBe('S');
    expect(initialsOf('  ')).toBe('');
  });
  it('falls back to what there is when no word starts with a letter', () => {
    expect(initialsOf('13 8')).toBe('18');
  });
});
