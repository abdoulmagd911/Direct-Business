// Per-member settings (Landing 40, the owner's approved design of 22 Nov 2026): the three extras on a person's record.
// Each is one capability; the person's own setting on it is a row of core.person_capability — none ("As their role"),
// granted ("Allowed") or not granted ("View only"). The database decides what each one lets the person do.

/** The three rows, in the order the record shows them, and the capability behind each. */
export const EXTRA_ROWS = {
  import: 'finance.import',
  edit_others: 'records.edit_others',
  credit: 'finance.credit_control',
} as const;

export type ExtraRow = keyof typeof EXTRA_ROWS;

/** The three choices of a row. */
export const EXTRA_CHOICES = ['as_role', 'allowed', 'view_only'] as const;

export type ExtraChoice = (typeof EXTRA_CHOICES)[number];

/** The choice a person's own setting stands for: none is "As their role". */
export function extraChoiceOf(own: { granted: boolean } | undefined | null): ExtraChoice {
  return own ? (own.granted ? 'allowed' : 'view_only') : 'as_role';
}
