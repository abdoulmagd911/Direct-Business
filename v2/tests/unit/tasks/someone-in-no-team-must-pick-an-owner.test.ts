import { describe, expect, it } from 'vitest';
import { quickAddOwners, quickAddRefusalKey, quickAddValues } from '@/modules/tasks/rules';
import { ME, OTHER } from './fixtures';

// Made-up people (rule 7). A task's team is its owner's, else mine (V194, V464): someone in no team — the owner's
// admin account, by design (V444) — has no Default to fall back on (V277).
const TEAM = '33333333-3333-4333-8333-333333333333';
const people = [
  { id: 'p1', team_id: TEAM, account: 'team_member' },
  { id: 'p2', team_id: null, account: 'team_member' },
  { id: 'p3', team_id: null, account: 'admin_account' },
  { id: 'p4', team_id: TEAM, account: 'test_account' },
];

describe('quick add for someone in no team: no Default, an owner must be picked (V277)', () => {
  it('someone in no team gets no Default, and only people in a team are offered', () => {
    const o = quickAddOwners(null, people);
    expect(o.offerDefault).toBe(false);
    expect(o.people.map((p) => p.id)).toEqual(['p1']);
  });

  it('someone in a team keeps Default and every team member', () => {
    const o = quickAddOwners(TEAM, people);
    expect(o.offerDefault).toBe(true);
    expect(o.people.map((p) => p.id)).toEqual(['p1', 'p2']);
  });

  it('with no Default, quick add refuses until an owner is picked', () => {
    expect(quickAddValues({ title: 'A' }, ME, { ownerRequired: true })).toEqual({ error: 'owner_required' });
    expect(quickAddValues({ title: 'A', ownerId: OTHER }, ME, { ownerRequired: true })).toEqual({
      values: { title: 'A', owner_id: OTHER },
    });
    expect(quickAddValues({ title: 'A' }, ME)).toEqual({ values: { title: 'A' } });
  });

  it('the database\'s "needs a team" reads as "Pick an owner" in quick add', () => {
    expect(quickAddRefusalKey('errors.task.team_required')).toBe('pages.tasks.add.owner_required');
    expect(quickAddRefusalKey('errors.task.title_required')).toBe('pages.tasks.errors.task.title_required');
  });
});
