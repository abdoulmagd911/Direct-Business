/**
 * V605: Tasks is built, so the + offers Task to whoever may add one — Own or Full on Tasks — and never to a Viewer. The
 * levels are each role's defaults from the module registry, as a new person gets them. Turn into on My day still offers
 * no task until the note → task door and its dialog land (`tasks.turn_into`), whatever `built` says.
 * Sabotages: tests/sabotage/tasks.mjs "tasks-page-not-built", "tasks-built-offers-a-turn-into-nobody-can-take".
 */
import { describe, expect, it } from 'vitest';
import type { Me } from '../../../src/core/auth/me';
import { modules } from '../../../src/core/registry';
import { liveKinds } from '../../../src/modules/my-day/logic';
import { BUILT, createActionsFor } from '../../../src/ui/shell/CreateMenu';

function asRole(role: 'admin' | 'head' | 'manager' | 'member' | 'viewer'): Me {
  const levels = Object.fromEntries(
    modules.flatMap((m) =>
      (m.pages ?? []).map((p) => [p.key, (p.defaults as Record<string, string>)?.[role] ?? 'none']),
    ),
  );
  return { levels, person: { role: { key: role, is_admin: role === 'admin' } } } as unknown as Me;
}
const plus = (role: Parameters<typeof asRole>[0]) => createActionsFor(asRole(role)).map((a) => a.key);

describe('the + offers Task (V605)', () => {
  it('to a member, a manager, a head and an admin — first in the list', () => {
    for (const role of ['member', 'manager', 'head', 'admin'] as const) {
      expect(plus(role)[0], `${role}: the + offers Task first`).toBe('task');
    }
  });
  it('never to a viewer, who may not add a task', () => {
    expect(plus('viewer')).not.toContain('task');
  });
});

describe('Turn into never grows a dead item (V605)', () => {
  it('offers no task or action item while only the Tasks page is built', () => {
    expect(BUILT.has('tasks'), 'the Tasks page is built').toBe(true);
    expect(liveKinds(BUILT)).not.toContain('task');
    expect(liveKinds(BUILT)).not.toContain('action_item');
  });
});
