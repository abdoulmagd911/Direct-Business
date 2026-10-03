import { describe, expect, it } from 'vitest';
import { assignablePeople } from '@/modules/org/pickers';

// Made-up people (rule 7). The account says whether a person is a team member (V444, V445).
const people = [
  { id: 'p1', name: 'Member', account: 'team_member' },
  { id: 'p2', name: 'Owner admin account', account: 'admin_account' },
  { id: 'p3', name: 'Test account', account: 'test_account' },
  { id: 'p4', name: 'Older answer without the field', account: null },
];

describe('a person picker offers team members only (V465)', () => {
  it('leaves out the admin account and the test account', () => {
    expect(assignablePeople(people).map((p) => p.id)).toEqual(['p1', 'p4']);
  });
  it('keeps the order it was given', () => {
    expect(assignablePeople([...people].reverse()).map((p) => p.id)).toEqual(['p4', 'p1']);
  });
});
