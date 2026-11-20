// V656: who is offered "Sign in as test user" on the People page: an admin, on a TEST row (the data's own mark,
// core.person.is_test) — never on a real colleague's row, never to a non-admin, and never while this device is already
// switched (me.test_switch is set): the server always refuses a second switch (QA-615), so the button is not drawn.
// The server decides for real (test_switch.not_allowed, test_switch.not_a_test_user, test_switch.already_switched);
// this only keeps the button from being drawn where it cannot work.
import type { Me } from '@/core/auth/me';

export function offersSwitch(
  me: Pick<Me, 'test_switch'> & { person?: Me['person'] },
  row: { is_test?: boolean },
): boolean {
  return !me.test_switch && !!me.person?.role?.is_admin && row.is_test === true;
}

/**
 * Landing 34 (item 29): while this device IS switched to a TEST user, the way to another TEST user is direct — offered
 * on every other TEST row (never the one the device already is, never a real colleague). Only someone who started a
 * switch has `me.test_switch` set, and the database let them start it; it decides again at each step (it ends the
 * switch and starts the next as the real signed-in person: test_switch.not_allowed, test_switch.not_a_test_user).
 */
export function offersSwitchOver(
  me: Pick<Me, 'test_switch'> & { person?: Pick<Me['person'], 'id'> | null },
  row: { id?: string; is_test?: boolean },
): boolean {
  return !!me.test_switch && row.is_test === true && !!row.id && row.id !== me.person?.id;
}

/** The TEST people a switched device can go straight to, by name: everyone marked TEST but the one it already is. */
export function switchTargets<P extends { id: string; is_test?: boolean; full_name_en: string }>(
  me: Pick<Me, 'test_switch'> & { person?: Pick<Me['person'], 'id'> | null },
  people: readonly P[],
): P[] {
  return people.filter((p) => offersSwitchOver(me, p)).sort((a, b) => a.full_name_en.localeCompare(b.full_name_en));
}
