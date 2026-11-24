/**
 * Landing 47 (the small fix round) — "@" in a comment, its small rules as they answer:
 *  - A bare "@" lists the record's people AT ONCE, by name, never the writer; with one letter typed, those with a
 *    name part that starts with it, in Arabic as in English; two letters and more belong to the app's search, so the
 *    early list is empty then; a term with a space in it ("@ 5") is not a name being started.
 *  - A record with no people to offer lists nobody (a private note).
 *  - An "@Name" already picked is a finished mention: the words typed after it open no list; a second "@" does.
 *  - The comment box draws no list before anything is typed.
 * Every value is made up. Sabotages: tests/sabotage/landing-47.mjs.
 */
import { describe, expect, it } from 'vitest';
import { ROSTER_MAX, mentionQuery, rosterMatches } from '../../../src/ui/record/CommentExtras';

const roster = [
  { id: 'p3', name: 'Made-up Nawaf Ali' },
  { id: 'me', name: 'Made-up Me' },
  { id: 'p1', name: 'Lama Made-up' },
  { id: 'p2', name: 'نورة المثال' },
  { id: 'p4', name: '   ' },
];
const names = (term: string | null, people: typeof roster = roster) =>
  rosterMatches(people, term, 'me').map((s) => s.label);

describe('a bare @', () => {
  it('lists the record’s people at once, by name, never the writer and never a nameless row', () => {
    expect(names('')).toEqual(['Lama Made-up', 'Made-up Nawaf Ali', 'نورة المثال']);
  });
  it('offers each as a person to mention', () => {
    expect(rosterMatches(roster, '', 'me')[0]).toEqual({ type: 'person', id: 'p1', label: 'Lama Made-up', alt: null });
  });
  it('one letter keeps those with a name part that starts with it, whatever its case', () => {
    expect(names('l')).toEqual(['Lama Made-up']);
    expect(names('N')).toEqual(['Made-up Nawaf Ali']);
    expect(names('m')).toEqual(['Lama Made-up', 'Made-up Nawaf Ali']);
    expect(names('x')).toEqual([]);
  });
  it('in Arabic as in English', () => {
    expect(names('ن')).toEqual(['نورة المثال']);
  });
  it('two letters and more belong to the search: the early list is empty', () => {
    expect(names('la')).toEqual([]);
  });
  it('a term with a space in it is not a name being started', () => {
    expect(names(' ')).toEqual([]);
  });
  it('no @ at all, or a record with nobody to offer, lists nobody', () => {
    expect(names(null)).toEqual([]);
    expect(names('', [])).toEqual([]);
    expect(rosterMatches(undefined, '', 'me')).toEqual([]);
  });
  it('a long people list stops at its limit', () => {
    const many = Array.from({ length: ROSTER_MAX + 20 }, (_, i) => ({ id: `q${i}`, name: `Made-up ${i}` }));
    expect(rosterMatches(many, '', 'me')).toHaveLength(ROSTER_MAX);
  });
});

describe('an @Name already picked is a finished mention', () => {
  const picked = ['Made-up Nawaf Ali'];
  it('the words typed after it open no list', () => {
    const text = '@Made-up Nawaf Ali please look';
    expect(mentionQuery(text, text.length, picked)).toBeNull();
    expect(mentionQuery('@Made-up Nawaf Ali ', 19, picked)).toBeNull();
  });
  it('while the name is still being typed it is a query, as before', () => {
    expect(mentionQuery('@Made-up Na', 11, picked)).toEqual({ from: 0, term: 'Made-up Na' });
    expect(mentionQuery('@Made-up Nawaf Ali please', 25)).toEqual({ from: 0, term: 'Made-up Nawaf Ali please' });
  });
  it('a second @ after it is a query of its own', () => {
    const text = '@Made-up Nawaf Ali ask @La';
    expect(mentionQuery(text, text.length, picked)).toEqual({ from: 23, term: 'La' });
  });
  it('a bare @ is a query with nothing typed yet', () => {
    expect(mentionQuery('look @', 6, picked)).toEqual({ from: 5, term: '' });
  });
});
