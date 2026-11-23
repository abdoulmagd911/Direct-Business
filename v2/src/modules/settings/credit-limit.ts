// The credit limit of Settings → Finance (Landing 31, the owner's decision of 16 Nov 2026): one figure in whole riyals
// for every postpaid client whose record sets none of its own. Everyone reads it; a manager, a head of department and
// an admin change it by role, and so does a person whose own record says "Allowed" on Change credit limits (Landing 40);
// a person set to "View only" there does not. The database decides (finance.credit_limit_can_change, CCL-01, XTR-02) and
// says so in its answer (`can_edit`); the screen adds one rule of its own: a Viewer is never offered the form.

/** The setting behind the figure (core.setting_def). */
export const CREDIT_LIMIT_KEY = 'finance.credit_limit';

/** The roles never offered the form, whatever the answer says: a Viewer stays view-only. */
export const CREDIT_LIMIT_NEVER: readonly string[] = ['viewer'];

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

/**
 * Whether this person may be offered the edit form at all — the database's `can_edit` then decides who is. Anyone
 * with a role but a Viewer: a manager, a head and an admin by role, a team member when their record says "Allowed".
 */
export function mayChangeCreditLimit(me: WithRole): boolean {
  const role = me.person.role;
  return !!role && (role.is_admin === true || !CREDIT_LIMIT_NEVER.includes(role.key));
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
