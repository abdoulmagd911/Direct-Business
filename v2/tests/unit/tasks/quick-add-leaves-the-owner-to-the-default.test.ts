import { describe, expect, it } from 'vitest';
import { canTick, quickAddValues, refusalKey } from '@/modules/tasks/rules';
import { ME, OTHER, row } from './fixtures';

const P = '11111111-1111-4111-8111-111111111111';
const J = '22222222-2222-4222-8222-222222222222';

describe('quick add: title, owner, due, partner or project (V464, V466, V194)', () => {
  it('a title is needed, at most 300 characters, trimmed', () => {
    expect(quickAddValues({ title: '  ' }, ME)).toEqual({ error: 'title_required' });
    expect(quickAddValues({ title: 'x'.repeat(301) }, ME)).toEqual({ error: 'title_too_long' });
    expect(quickAddValues({ title: ' Call the hotel ' }, ME)).toEqual({ values: { title: 'Call the hotel' } });
  });

  it('the owner is sent only when it is someone else — left out, the database names it (V464)', () => {
    expect(quickAddValues({ title: 'A', ownerId: ME }, ME)).toEqual({ values: { title: 'A' } });
    expect(quickAddValues({ title: 'A', ownerId: OTHER }, ME)).toEqual({ values: { title: 'A', owner_id: OTHER } });
  });

  it('a project wins over a partner: the task takes the project’s organisation (V194)', () => {
    expect(quickAddValues({ title: 'A', partnerId: P }, ME)).toEqual({ values: { title: 'A', partner_id: P } });
    expect(quickAddValues({ title: 'A', partnerId: P, projectId: J }, ME)).toEqual({
      values: { title: 'A', project_id: J },
    });
  });

  it('a due day is a calendar day', () => {
    expect(quickAddValues({ title: 'A', due: '2026-10-18' }, ME)).toEqual({
      values: { title: 'A', due_on: '2026-10-18' },
    });
    expect(quickAddValues({ title: 'A', due: '18/10/2026' }, ME)).toEqual({ error: 'due_invalid' });
  });
});

describe('the checklist: who ticks an action item (V438, V190)', () => {
  it("the task's editors, the item's owner, or a helper on it — nobody else", () => {
    const item = { owner_id: OTHER, helpers: [] as string[] };
    expect(canTick(item, row({ can_edit: true }), ME)).toBe(true);
    expect(canTick(item, row({ can_edit: false }), ME)).toBe(false);
    expect(canTick({ owner_id: ME, helpers: [] }, row({ can_edit: false }), ME)).toBe(true);
    expect(canTick({ owner_id: OTHER, helpers: [ME] }, row({ can_edit: false }), ME)).toBe(true);
  });
});

describe("the task doors' refusals are worded in the Tasks catalog", () => {
  it('task and action-item keys move under pages.tasks.errors; others stay shared', () => {
    expect(refusalKey('errors.task.open_action_items')).toBe('pages.tasks.errors.task.open_action_items');
    expect(refusalKey('errors.action_item.not_yours')).toBe('pages.tasks.errors.action_item.not_yours');
    expect(refusalKey('errors.person.unavailable')).toBe('pages.tasks.errors.person.unavailable');
    expect(refusalKey('errors.person.full_name_required')).toBe('errors.person.full_name_required');
    expect(refusalKey('errors.kind.RuleBroken')).toBe('errors.kind.RuleBroken');
  });
});
