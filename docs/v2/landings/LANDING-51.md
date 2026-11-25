# Landing 51 — per-member settings: the three extras reach every door

25 Nov 2026 · base `4b874ab5` (Landing 50) · target `v2/main` · branch `v2/a-landing-51-per-member-enforcement` · one
push, by pull request, on the owner's word.

The owner's approved design of 22 Nov 2026 (roles set the basics; a person's record carries three extras, each "As
their role", "Allowed" or "View only"). The brief: check whether the three extras are **enforced** and not only shown,
build what is missing, and build nothing twice.

## First: what was already there (checked before building)

Landing 40 did not build the screen alone. It made the three extras rules of the database, and they are on live.

| The design asks | Where it already lives | Checked how |
| --- | --- | --- |
| Import files on Finance: Admin + Head by role; "Allowed" adds one person; "View only" stops even a head | `work.import_require` in front of the three import doors the screen uses (start, confirm, expense preview) | `XTR-01` green; on live the three doors carry the check |
| Change credit limits: the person's own setting first, then the role | `finance.credit_limit_can_change` (company-wide limit); `partner.credit_limit_set` (a client's limit) | `XTR-02` green; tried by hand on a local database as a member with and without it, a head set to View only, a manager |
| Edit someone else's work: "Allowed" writes what the person can see | tasks, achievements, an organisation's side, pipeline cards, and everything that goes through `core.may_write` (notes, logged activity, contacts) | `XTR-03` green; on live each of those rules reads the extra |
| A Viewer stays view-only; "Allowed" is refused on a Viewer | `core.extra_access`, `core.access_set_person_capability` | `XTR-04` green; on live |
| An override changes that one person only | each test's "a colleague still cannot" line | `XTR-01…03` |
| Every change is written in the log, with who and when; the record says who set it | the access doors (reason required) | `XTR-01` |
| The section on a person's record, the import section offered only to who holds it | Landing 40's screens | its unit and browser tests |

So this landing is **small**: three places where a door did not yet ask for the extra.

## What was missing, and is built here

Found by listing every database rule that reads a capability or an "own" level, and trying each as a made-up team
member, head, manager and Viewer on a local database.

1. **The older import door did not hold a Viewer out.** `api.finance_import` (the first import engine; no screen
   calls it today, but it is open to any signed-in person) asked for the capability alone. A person whose role was
   changed to Viewer while their record still said "Allowed" passed it, and it never asked for Finance at Full. It now
   asks what the other import doors ask, and that one rule (`work.import_require`) also asks for Finance at Full —
   the newer doors already did, each in its own place.
2. **"Edit someone else's work — Allowed" did not reach a project.** Saving a project, saying how it is going, and
   removing it looked at the project's owner only. They now take the extra exactly as a task does.
3. **Nor a file on an organisation's side** for a person at Own on that side: the side itself took the extra, its
   files did not.

One forward-only migration, `20261125090000_per_member_extras_reach_every_door.sql`. Each function in it is the
statement the database held, word for word, with only the marked lines changed (compared before and after: eleven
lines differ, all of them the ones above). No table, no column, no grant, no data, no screen, no wording changes.
**No money figure can move:** nothing that counts is touched.

**Nobody on live loses or gains anything today** (read on live, counts only): no person has a setting on any of the
three extras yet, and everyone who imports by role (the admins and the heads) holds Finance at Full.

## Not built, on purpose

- **"Own clients only" on Finance.** It needs the owner's word and is still open. A person with Finance at Full adds
  and edits every Finance entry, exactly as before (Landing 34b). No setting was added for it: the three rows needed
  no new structure, so there was nothing to leave switched off.

## Where the app differs from the design's table — for the owner (nothing changed here)

Role basics were left as they are (the reading confirmed on 23 Nov). Three of them do not match the design's words:

1. **A team member edits any client, not only their own.** The Team member role holds Clients, Organisations and
   Suppliers & partners at Full, so "cannot edit someone else's work" holds on Tasks, Pipeline, Projects, Files and
   Achievements (where the role is at Own) but not on an organisation's record. Making it "own clients only" there is
   the same decision as on Finance. Say the word and it is one small landing: the role's level on those pages moves
   from Full to Own, and "Edit someone else's work" then covers them.
2. **"View only" on "Edit someone else's work" takes nothing away** from a manager or a head: their reach comes from
   the role's page levels, not from this extra (Landing 40, `XTR-03`). The design lists Admin + Head as holding it by
   default; if "View only" should stop a head editing a colleague's work, that is a change to build.
3. **A manager changes the company-wide credit limit** (the owner's decision of 16 Nov, Landing 31), though the
   design's table says Admin + Head. A manager does not change a client's own limit.

## Tests

- **Database (389 → 392), through the real doors, made-up data:**
  - `XTR-05` — a team member set to Allowed imports and a team member without it does not, through the older door
    and the newer one; a Viewer never, nor a person whose role became Viewer with the setting left over; a head set
    to View only does not; Allowed with Finance below Full imports through no door.
  - `XTR-06` — Allowed changes a teammate's project (fields, health, removal) and a file on a colleague's client; a
    second teammate still cannot; another department's project stays hidden; a Viewer with a setting left over
    changes nothing; "As their role" takes it away again.
  - `XTR-07` — **a Viewer edits nothing, including Finance**: 26 kinds of write (task, project, organisation,
    contact, contract, note, file, comment, achievement, pipeline, Finance entry, exclusion, deal type, month close,
    both import doors, both credit limits), each refused, for a Viewer by role and for a person whose role became
    Viewer with all three extras left on their record; both still read Finance; the log holds no change by either.
- **Database sabotage: 6 new plants**, each red as it must be — the older door asks for the capability alone;
  importing needs no level on Finance; Allowed does not reach a project / a project's health / a project's removal /
  a side's file.

## Verification (this landing's head, on the builder's machine — a cloud container)

| Check | Result |
| --- | --- |
| Base equals `v2/main` (`4b874ab5`) before editing | yes |
| SQL suite, a fresh database from zero, plain Postgres 16 | 392 passed, 0 failed |
| The 6 new SQL plants, and Landing 40's two nearest (`a-viewer-keeps-a-stray-extra`, `the-import-doors-ask-for-no-extra`) | 8 red as they must be |
| `node scripts/checks/run.mjs` | 19 green |
| Unit tests | 1,903 passed (none added: no screen or screen rule changed) |
| `pnpm typecheck` · `pnpm lint` · `pnpm format:check` | exit 0 · exit 0 · exit 0 |
| The five functions before and after | only the marked lines differ |

Said plainly — **not run here** (CI runs each): the browser suite and its sabotage plants, the SQL suite on the
Supabase stack (Postgres 17), the generated-types check, the registry check and the advisors. This container has no
Docker, so the local Supabase stack could not start. No function's name, arguments or grants change, so the generated
types and `grants.expected` are untouched (`GRANTS-01` green).

## Live checks

- **Done, read-only, on the live database (25 Nov, definitions and counts only — nothing written):** the last applied
  migration is `20261124110000`, so this landing's one is the only one the production job applies. Landing 40's rules
  are all there. The three gaps above are there too, as found locally. What the live rules answer today, by role
  (TEST people and real people alike): admins and heads import and change both credit limits; the manager changes the
  company-wide limit only; no team member and no Viewer holds any of the three; every role but the Viewer holds
  Finance at Full, the Viewer at View. No person has a setting on any of the three extras.
- **Not done from here:** the check in the browser as a TEST member with a row set. It needs the Workspace Admin
  sign-in, which this session does not hold, and setting a row on live is a write.

## After it is live — the browser check (one step at a time)

1. Settings → People & access → the TEST Team member → "Extra access for this person" → set **Import files on
   Finance** to Allowed, with a reason.
2. "Sign in as test user" as that member → Finance: the import section is there. As the other TEST member: it is not.
3. Back as the admin: set the row to "As their role" again. The log shows both changes, with who and when.
4. "Sign in as test user" as the TEST Viewer → Finance opens and reads; there is no import section and no button
   that adds or changes anything.
5. Finance → Year to date: Revenue, Cost and Profit are what they were before the deploy.
