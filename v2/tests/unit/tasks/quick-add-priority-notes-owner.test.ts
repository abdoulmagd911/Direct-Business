import { describe, expect, it } from 'vitest';
import { mayPickOwnerOnCreate, quickAddValues } from '@/modules/tasks/rules';
import { ME, OTHER } from './fixtures';

describe('quick add: priority and notes (FIX-05, F021/F023)', () => {
  it('a priority key and notes are sent with the title', () => {
    expect(quickAddValues({ title: 'A', priority: 'high', notes: ' Call first ' }, ME)).toEqual({
      values: { title: 'A', priority: 'high', notes: 'Call first' },
    });
  });

  it('no priority and blank notes are left out — the task has none', () => {
    expect(quickAddValues({ title: 'A', notes: '   ' }, ME)).toEqual({ values: { title: 'A' } });
    expect(quickAddValues({ title: 'A' }, ME)).toEqual({ values: { title: 'A' } });
  });

  it('priority and notes travel with an owner, a due day and a partner', () => {
    expect(quickAddValues({ title: 'A', ownerId: OTHER, due: '2026-11-10', priority: 'low', notes: 'n' }, ME)).toEqual({
      values: { title: 'A', owner_id: OTHER, due_on: '2026-11-10', priority: 'low', notes: 'n' },
    });
  });
});

describe('quick add: the Owner picker on a task being created (FIX-05, F024; P1b, own tasks only)', () => {
  it('someone who may give work to others picks an owner, in a team or not', () => {
    expect(mayPickOwnerOnCreate(true, 'team-1')).toBe(true);
    expect(mayPickOwnerOnCreate(true, null)).toBe(true);
  });

  it('a Member in a team picks the owner of the task they create', () => {
    expect(mayPickOwnerOnCreate(false, 'team-1')).toBe(true);
  });

  it('a Member in no team still cannot create — the no-team refusal stands', () => {
    expect(mayPickOwnerOnCreate(false, null)).toBe(false);
  });
});
