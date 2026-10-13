/**
 * QA-245 (7 Oct), V605 (5), QA-521: Task is left out of the + for someone in no team who may not give tasks to others
 * (no `tasks.assign`) — Add task would only say "You're not in a team yet". A team, or `tasks.assign`, brings it back;
 * Task at View was never offered. Every value is made up. Sabotage: tests/sabotage/screens.mjs
 * "plus-offers-task-with-no-team-to-work-in".
 */
import { describe, expect, it } from 'vitest';
import type { Me } from '../../../src/core/auth/me';
import { createActionsFor } from '../../../src/ui/shell/CreateMenu';

function me(over: { team_id?: string | null; capabilities?: string[]; tasks?: string }): Me {
  return {
    person: { team_id: over.team_id ?? null },
    capabilities: over.capabilities ?? [],
    levels: { tasks: over.tasks ?? 'own', clients: 'none', suppliers_partners: 'none', kpis: 'none', finance: 'none' },
  } as unknown as Me;
}
const keys = (m: Me) => createActionsFor(m).map((a) => a.key);

describe('the + (QA-245)', () => {
  it('leaves Task out for someone in no team without tasks.assign', () => {
    expect(keys(me({ team_id: null })), 'Task is not offered to someone with no team to work in').not.toContain('task');
  });
  it('offers Task to someone in a team', () => {
    expect(keys(me({ team_id: 't1' }))).toContain('task');
  });
  it('offers Task to someone who gives tasks to others, team or not', () => {
    expect(keys(me({ team_id: null, capabilities: ['tasks.assign'] }))).toContain('task');
  });
  it('never offers Task at View', () => {
    expect(keys(me({ team_id: 't1', tasks: 'view' }))).not.toContain('task');
  });
});
