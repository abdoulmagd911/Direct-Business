// The credit limit of Settings → Finance (Landing 31, the owner's decision of 16 Nov 2026): one figure in whole riyals
// for every postpaid client whose record sets none of its own. Everyone reads it; a manager, a head of department and
// an admin change it; a team member and a viewer see the read-only view. The database decides (finance.credit_limit_set,
// CCL-01) — this is the same rule for the screen, so it never offers a control the database would refuse.

/** The setting behind the figure (core.setting_def). */
export const CREDIT_LIMIT_KEY = 'finance.credit_limit';

/** The roles that change it beside the admin role: manager and head of department. */
export const CREDIT_LIMIT_ROLES: readonly string[] = ['manager', 'head'];

/** The largest amount the setting's schema takes. */
export const CREDIT_LIMIT_MAX = 1_000_000_000;

/** api.finance_credit_limit's answer. */
export type CreditLimitAnswer = {
  /** Whole riyals, in force today. */
  amount: number;
  /** Whether the database lets the reader change it. */
  can_edit: boolean;
  is_default: boolean;
  set_at: string | null;
};

type WithRole = { person: { role: { key: string; is_admin: boolean } | null } };

/** Whether this person is offered the edit form: an admin, a head of department or a manager — never a team member or a viewer. */
export function mayChangeCreditLimit(me: WithRole): boolean {
  const role = me.person.role;
  return !!role && (role.is_admin === true || CREDIT_LIMIT_ROLES.includes(role.key));
}

/**
 * What was typed, as whole riyals: digits, with the thousands commas and spaces a person types or pastes
 * (`1,250,000`, `1 250 000`). Null for anything else — empty, a fraction, a sign, letters, zero, or more than the
 * setting takes: Save stays off and the box says why.
 */
export function parseCreditLimit(text: string): number | null {
  const s = text.replace(/[\s,  ]/g, '');
  if (!/^\d{1,10}$/.test(s)) return null;
  const n = Number(s);
  return Number.isSafeInteger(n) && n >= 1 && n <= CREDIT_LIMIT_MAX ? n : null;
}
