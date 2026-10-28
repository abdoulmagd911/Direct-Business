// V656: who is offered "Sign in as test user" on the People page: an admin, on a TEST row (the data's own mark,
// core.person.is_test) — never on a real colleague's row, never to a non-admin. The server decides for real
// (test_switch.not_allowed, test_switch.not_a_test_user); this only keeps the button from being drawn where it cannot work.
import type { Me } from '@/core/auth/me';

export function offersSwitch(me: { person?: Me['person'] }, row: { is_test?: boolean }): boolean {
  return !!me.person?.role?.is_admin && row.is_test === true;
}
