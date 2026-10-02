import { describe, expect, it } from 'vitest';
import {
  defaultPastStatus,
  matchOrganisations,
  plainName,
  readHeldKeys,
  readPeopleMatch,
  statusChoices,
} from '@/modules/tasks/pastWork';
import { apiFilter, parseFilters } from '@/modules/tasks/rules';
import { STATUSES } from './fixtures';

// Made-up clients (rule 7).
const A = { id: 'a', number: 'P-1', name_en: 'Test Co A', name_ar: 'شركة تجريبية' };
const B = { id: 'b', number: 'P-2', name_en: 'Sample Travel', name_ar: null };
const B2 = { id: 'b2', number: 'P-3', name_en: 'sample  travel', name_ar: null };

describe('the Past work grid on Tasks: names matched exactly, never guessed (V276, V504, V506)', () => {
  it('a name compares whatever the case or the spacing — and nothing else on screen', () => {
    expect(plainName('  Test   CO a ')).toBe('test co a');
    expect(plainName('شَرِكة')).not.toBe(plainName('شركة'));
  });

  it('one client is a match, none is unknown, two are ambiguous — a near name is not a match', () => {
    const m = matchOrganisations(['TEST CO A', 'شركة تجريبية', 'Sample Travel', 'Test Co', 'Nobody'], [A, B, B2]);
    expect(m.get('TEST CO A')).toEqual({ kind: 'one', id: 'a' });
    expect(m.get('شركة تجريبية')).toEqual({ kind: 'one', id: 'a' });
    expect(m.get('Sample Travel')).toEqual({ kind: 'many' });
    expect(m.get('Test Co')).toEqual({ kind: 'none' });
    expect(m.get('Nobody')).toEqual({ kind: 'none' });
  });

  it("the database's people answer is read as it is; anything else is left unanswered", () => {
    const m = readPeopleMatch({
      One: { kind: 'one', id: 'p1' },
      None: { kind: 'none' },
      Two: { kind: 'many' },
      Odd: {},
    });
    expect(m.get('One')).toEqual({ kind: 'one', id: 'p1' });
    expect(m.get('None')).toEqual({ kind: 'none' });
    expect(m.get('Two')).toEqual({ kind: 'many' });
    expect(m.has('Odd')).toBe(false);
    expect(readPeopleMatch(null).size).toBe(0);
  });

  it('the keys already saved are a set; any other answer holds none', () => {
    expect([...readHeldKeys(['k1', 'k2', 3])]).toEqual(['k1', 'k2']);
    expect(readHeldKeys({}).size).toBe(0);
  });

  it('a pasted row names a live status, and one with none is Done', () => {
    expect(statusChoices(STATUSES).map((c) => c.key)).toEqual(['not_started', 'in_progress', 'done', 'cancelled']);
    expect(
      statusChoices(STATUSES.map((s) => (s.key === 'cancelled' ? { ...s, active: false } : s))).map((c) => c.key),
    ).not.toContain('cancelled');
    expect(defaultPastStatus(STATUSES)).toBe('done');
  });

  it('the Past work view asks for past work only, and the others never do', () => {
    expect(apiFilter(parseFilters({ view: 'past' }))).toEqual({ scope: 'all', past_work: true });
    for (const view of ['my_work', 'owned', 'helping', 'team'])
      expect(apiFilter(parseFilters({ view }))).not.toHaveProperty('past_work');
  });
});
