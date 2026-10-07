import { describe, expect, it } from 'vitest';
import { escalateTargets, escalateValues, refusalKey } from '@/modules/tasks/rules';
import en from '../../../messages/en.json';
import { ME, OTHER } from './fixtures';

// Made-up people (rule 7). Escalate (V401) tells someone else about a task, with a note: never myself, never the admin
// or test account (V465), and both the person and the note are required — the door refuses the same.
const people = [
  { id: ME, account: 'team_member' },
  { id: OTHER, account: 'team_member' },
  { id: 'p3', account: 'admin_account' },
  { id: 'p4', account: 'test_account' },
  { id: 'p5', account: null },
];

describe('Escalate names someone else, with a note (V401)', () => {
  it('offers everyone who can be given work except me', () => {
    expect(escalateTargets(people, ME).map((p) => p.id)).toEqual([OTHER, 'p5']);
  });

  it('a person and a note are both required, and never myself', () => {
    expect(escalateValues({ note: 'Stuck on the client' }, ME)).toEqual({ error: 'to_required' });
    expect(escalateValues({ to: ME, note: 'Stuck' }, ME)).toEqual({ error: 'to_yourself' });
    expect(escalateValues({ to: OTHER, note: '   ' }, ME)).toEqual({ error: 'note_required' });
    expect(escalateValues({ to: OTHER, note: '  Stuck on the client ' }, ME)).toEqual({
      values: { p_to: OTHER, p_note: 'Stuck on the client' },
    });
  });

  it("the door's refusals read in the Tasks catalog's words", () => {
    for (const k of ['not_here', 'note_required', 'to_yourself', 'cannot_see'] as const) {
      expect(refusalKey(`errors.escalation.${k}`)).toBe(`pages.tasks.errors.escalation.${k}`);
      expect(en.pages.tasks.errors.escalation[k]).toBeTruthy();
    }
  });
});
