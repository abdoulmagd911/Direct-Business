import { describe, expect, it } from 'vitest';
import { achievementStrip, delegateTargets, delegateValues, refusalKey } from '@/modules/tasks/rules';
import en from '../../../messages/en.json';
import { ME, OTHER } from './fixtures';

// Made-up people (rule 7). Delegate (Phase 1, CUJ 5) picks from the same people as Escalate — never me, never the
// admin or test account — and sends a person and a note, both required. The strip (CUJ 7) shows on a done,
// nudge-eligible task closed after this build ships, until its achievement is logged or it is dismissed.
const people = [
  { id: ME, account: 'team_member' },
  { id: OTHER, account: 'team_member' },
  { id: 'p3', account: 'admin_account' },
  { id: 'p4', account: 'test_account' },
  { id: 'p5', account: null },
];

const base = {
  meaning: 'done' as const,
  closed_at: '2026-11-07T10:00:00.000Z',
  partner_id: 'partner-1',
  priority: 'medium',
  dismissed_from_nudge: false,
  has_achievement: false,
};

describe('Delegate names someone else, with a note (Phase 1)', () => {
  it('offers everyone who can be given work except me', () => {
    expect(delegateTargets(people, ME).map((p) => p.id)).toEqual([OTHER, 'p5']);
  });

  it('a person and a note are both required, and never myself', () => {
    expect(delegateValues({ note: 'Take this over' }, ME)).toEqual({ error: 'to_required' });
    expect(delegateValues({ to: ME, note: 'Take this' }, ME)).toEqual({ error: 'to_yourself' });
    expect(delegateValues({ to: OTHER, note: '   ' }, ME)).toEqual({ error: 'note_required' });
    expect(delegateValues({ to: OTHER, note: '  Take this over ' }, ME)).toEqual({
      values: { p_to: OTHER, p_note: 'Take this over' },
    });
  });

  it("the door's refusals read in the Tasks catalog's words", () => {
    for (const k of ['delegate_note_required', 'delegate_to_yourself', 'delegate_cannot_see'] as const) {
      expect(refusalKey(`errors.task.${k}`)).toBe(`pages.tasks.errors.task.${k}`);
      expect(en.pages.tasks.errors.task[k]).toBeTruthy();
    }
  });
});

describe('The achievement strip shows until logged or dismissed (Phase 1)', () => {
  it('shows on a done task linked to a partner, closed after the build ships', () => {
    expect(achievementStrip(base)).toBe('show');
  });

  it('shows on a done top-priority task with no partner', () => {
    expect(achievementStrip({ ...base, partner_id: null, priority: 'high' })).toBe('show');
  });

  it('hides on a routine task with no partner', () => {
    expect(achievementStrip({ ...base, partner_id: null, priority: 'medium' })).toBe('hide');
  });

  it('hides on a task closed before the build ships', () => {
    expect(achievementStrip({ ...base, closed_at: '2026-11-06T10:00:00.000Z' })).toBe('hide');
  });

  it('hides on a cancelled task, and on one still open', () => {
    expect(achievementStrip({ ...base, meaning: 'cancelled' })).toBe('hide');
    expect(achievementStrip({ ...base, meaning: 'in_progress', closed_at: null })).toBe('hide');
  });

  it('hides once an achievement links to it, and shows its Undo line when dismissed', () => {
    expect(achievementStrip({ ...base, has_achievement: true })).toBe('hide');
    expect(achievementStrip({ ...base, dismissed_from_nudge: true })).toBe('dismissed');
  });
});
