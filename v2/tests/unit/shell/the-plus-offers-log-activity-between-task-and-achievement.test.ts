/**
 * V646: the + offers Log activity between Task and Log achievement, to anyone who may log activities (Own or Full on a
 * client or supplier page) and to no one else. Every value is made up.
 * Sabotage: tests/sabotage/log-activity-entry.mjs "plus-has-no-log-activity", "plus-offers-log-activity-to-anyone".
 */
import { describe, expect, it } from 'vitest';
import type { Me } from '../../../src/core/auth/me';
import { createActionsFor } from '../../../src/ui/shell/CreateMenu';

const me = (levels: Record<string, string>): Me =>
  ({
    person: { team_id: 't1' },
    capabilities: [],
    levels: { my_day: 'own', tasks: 'own', clients: 'none', suppliers_partners: 'none', kpis: 'own', ...levels },
  }) as unknown as Me;
const keys = (m: Me) => createActionsFor(m).map((a) => a.key);

describe('the + and Log activity (V646)', () => {
  it('puts it between Task and the achievement', () => {
    expect(keys(me({ clients: 'own' }))).toEqual(['capture', 'task', 'activity', 'achievement']);
  });
  it('offers it to someone with Own or Full on a supplier page only', () => {
    expect(keys(me({ suppliers_partners: 'own' }))).toContain('activity');
    expect(keys(me({ suppliers_partners: 'full' }))).toContain('activity');
  });
  it('leaves it out for someone who may not log activities (View or none)', () => {
    expect(keys(me({ clients: 'view', suppliers_partners: 'view' }))).not.toContain('activity');
    expect(keys(me({}))).not.toContain('activity');
  });
});
