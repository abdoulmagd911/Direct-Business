# Landing 40 — per-member settings: three extras on a person's record

23 Nov 2026 · base `9d491c2a` (Landing 39, CI #1623 all green) · target `v2/main` · one push.

The owner's approved design of 22 Nov (`egm-fix/per-member-settings-design-2026-11-22.md` on the notes branch), with
the reading confirmed on 23 Nov: a role's basics stay as they are; the three rows only add or restrict the extras.

## What a person sees

Settings → People & access → a person's record → **Extra access for this person**: three rows.

| Row                      | As their role                                                                      | Allowed                                                       | View only                            |
| ------------------------ | ---------------------------------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------ |
| Import files on Finance  | an admin and a head of department import                                           | this person imports too                                       | this person does not, even a head    |
| Edit someone else's work | what the role's levels give                                                        | this person also changes a colleague's work that they can see | nothing the role gives is taken away |
| Change credit limits     | a head (a client's limit); a manager, a head and an admin (the company-wide limit) | this person changes them too                                  | this person does not                 |

- An admin changes a row; every change asks for its reason, is logged, and can be undone like any access change.
- Under a row that is set, the record says who set it and when.
- A **Viewer's** record shows the section with one sentence and no picker: a Viewer stays view-only; to give more,
  the role changes. An admin's record says an admin has everything.

## What changed underneath

- A choice is a row of `core.person_capability` — the per-person setting the database already had (none = as their
  role, granted = Allowed, not granted = View only). No new table. The doors that write it already ask for a reason
  and log it.
- **Import** is now a specific extra (`finance.import`). Until this landing the import ran for anyone with Finance at
  Full — since Landing 34b that was every team member and every manager. The import doors now ask for the extra, and
  the import section on Finance is drawn only for a person who holds it.
- **Credit limits.** The company-wide limit of Settings → Finance follows the person's own setting when there is one,
  and the role rule of Landing 31 otherwise (a manager, a head, an admin — unchanged). A client's own limit already
  followed the same capability (`finance.credit_control`).
- **Edit someone else's work** is a new capability (`records.edit_others`) that no role holds by default. Set to
  Allowed, a person at Own on a page writes what they can see there as a person at Full does: tasks, achievements,
  an organisation's side, pipeline cards, notes, files and logged activity. It opens nothing the person cannot see.
- **A Viewer** never holds an extra: one reading (`core.extra_access`) says no for a Viewer whatever a row holds, and
  "Allowed" on a Viewer is refused in words.
- One forward-only migration (`20261123100000_per_member_extra_access.sql`) and the registry sync
  (`20261123100100`). No data is changed. One new grant: `work.import_require()` to signed-in people.

## Three things the reader should know

1. **Members and managers stop importing with this landing** unless their record is set to Allowed. That is the
   design ("importing is extra, not for every member"), but it differs from what the app did until now. A person who
   imports today and is not an admin or a head needs "Allowed" set by an admin after the landing.
2. **Finance entries are not touched.** A person with Finance at Full still adds and edits every Finance entry
   (the owner's ruling of 21 Nov, Landing 34b). "Own clients only" is not a rule the Finance page has; making it one
   is its own piece of work, not part of these three rows.
3. **Managers keep the company-wide credit limit** (the owner's decision of 16 Nov, Landing 31). The design's table
   says "only Admin + Head"; the agreed rule is that role basics do not change, so nothing was taken from managers.

## Tests

- Database: `XTR-01` import, `XTR-02` credit limit, `XTR-03` edit someone else's work (with the manager reading),
  `XTR-04` a Viewer stays view-only. Four database sabotages, one for each.
- Unit: the three rows and their choices, the wording in both languages, who is offered the import section; the
  credit-limit card's rule updated (a team member the database allows gets the form; a Viewer never).
- Browser: `landing-40-per-member-settings.spec.ts` — an admin sets a row with its reason; the member gains and loses
  the import section; a colleague is unaffected; a manager set to View only loses the credit-limit form; a Viewer's
  record offers no picker.
- Sabotage: eight new plants (`tests/sabotage/landing-40.mjs`); the Landing 31 credit-limit plants follow the new rule.

## Verification

On the builder's machine on 23 Nov, local stack, made-up data only:

- types, lint, formatting: clean; the 19 house checks: green; generated types and the registry agree with the database
- database tests: 380 passed (4 new: XTR-01 to XTR-04)
- unit tests: 1,802 passed
- the full browser suite: 602 passed, 11 skipped. The first full run found one fault in the new section — a sentence
  drawn inside a list of fields on an admin's record (an accessibility rule) — fixed before this commit
- sabotage: database 585, unit / check / lint 806 — every one turned its target red
- browser sabotage: the four new plants and the Landing 31 credit-limit plant, each red as it must be
- every edit-plant in `tests/sabotage` finds its text exactly once (1,384 checked)

Live: the migration applies in the production job. The browser check is the owner's side: on a team member's record,
set Import to Allowed with a reason, and the member finds the import section on Finance.
