# Landing 55 — a team member changes their own organisations only

26 Nov 2026 · base `20b69233` (Landing 54) · target `v2/main` · branch `v2/a-landing-55-own-partners-only` · by pull
request.

A fix on top of Landing 51 (per-member settings enforcement), under the owner's approved design of 22 Nov 2026:
"Member: can add, edit and delete anything for their **own** clients. Cannot edit someone else's work."

## What was found on live

After Landing 51, the browser check as a TEST team member with no extra access found, on organisations owned by
other people (one owned by TEST Commercial, one by the Admin): the Edit button with a fully editable dialog, "+ Add",
Archive / Remove, and the file picker on Partner files. Whether a save would go through was not tested.

**It would have gone through.** The buttons were telling the truth about the database: the Team member role held the
Partners page and the Suppliers & partners page at **Full**, and Full changes every organisation. Landing 51's note
listed this as the first of three places where the app differs from the design, waiting for the owner's word. This
landing is that word carried out.

## What changes

1. **The Team member role starts at Own on the two organisation pages** (it was Full). A manager, a head and an
   admin keep Full. A Viewer keeps View.
2. **At Own, a person changes the organisations whose side they own** — details, contacts, client IDs, contracts,
   references, files, status, the side itself, archive and removal. Before this landing the shared part (names,
   details, contacts, client IDs, archive, removal) asked for Full even from the owner, so lowering the role alone
   would have taken a member's own organisations away too.
3. **An organisation a team member adds is theirs.** "New" stays on the list for them; they cannot add one in a
   colleague's name.
4. **On a colleague's organisation every save is refused by the database**, whatever the screen shows, and the
   screen no longer offers it: no Edit, no "+ Add", no Archive / Remove, no file picker, no row actions on the list.
5. **"Edit someone else's work — Allowed"** (Settings → People & access → a person's record) opens a colleague's
   organisation to that one person, as it already opened a colleague's task.
6. **Reading is not changed.** A team member still opens and reads every organisation.

## Decisions taken (please confirm or overrule)

1. **A note or a logged activity on a colleague's organisation stays open.** Logging a call, a meeting or a note
   adds the writer's own entry and changes nothing of the organisation's, and members log against organisations
   they do not own every day. So "Log activity" and "Add note" are still offered to a team member on any
   organisation. If the owner wants those closed as well, it is two lines to take back.
2. **Finance is not touched.** The Finance page and an organisation's Finance tab keep their own levels (a team
   member at Full, Landing 34b). "Own clients only" on Finance is still **not built** — it needs the owner's word.
3. **An organisation with two sides** (client and supplier) is changed, in its shared part, by the owner of either
   side; each side's own rows stay with that side's owner.
4. **An organisation with no owner on any side** is changed only by a manager, a head or an admin (or a person
   with the extra). Live has none today.
5. **A client's credit limit**: a person set to "Allowed" on Change credit limits changes it on a client they own
   (or any client, at Full) — no longer on a colleague's.

## Who is affected on live (read-only, 26 Nov, counts only)

- 12 people hold the Team member role. From the merge on, each changes only the organisations whose side they own.
- 96 sides are on; **every one has an owner**; 28 are owned by a team member. So no organisation is left that
  nobody below a manager can change by accident of having no owner.
- No person and no team holds a level of their own on the two pages, so the role's change is the whole change.

## Underneath — forward-only

| Migration | What |
| --- | --- |
| `20261126110000_partner_own_organisations_only.sql` | The one rule `partner.may_change` (Full on a side that is on, or Own and its owner, or the extra) and its refusal `partner.require_change`. `partner.writable`, `partner_remove`, `partner_unarchive`, `partner_create`, `side_set`, `side_off`, `credit_limit_set`, `bulk_assign`, `activity_log` and `core.note_add` are the statements the database held, word for word, with only the marked lines changed. The Team member role's two rows go from Full to Own — only the role's own rows, only where they still read Full. |
| `20261126110100_core_registry_sync.sql` | The registry's starting level for the role on the two pages (written by `pnpm registry:sync`). |

No table, no column, no grant changes (the two new functions are reached only through the doors that existed).
No money figure can move: nothing that counts is touched.

Screens: one rule file, `src/modules/partners/may-change.ts`, read by the record and the list, so a button is
offered exactly where the database allows the save.

## Tests

- **Database, `OWN-01`** — through the real doors, made-up data: a team member starts at Own (Finance still Full);
  on a colleague's organisation eleven kinds of save are each refused (details, add / change / remove a contact, a
  contract, a file, status, the side, a new side, archive, removal) and nothing is written; the colleague still
  reads it, writes a note and logs a call; a Viewer is refused all eleven; the owner does all of it; a team member
  adds an organisation and it is theirs, and removes their own; Allowed opens a colleague's to one person only and
  "As their role" closes it again; a manager keeps Full. **Six database sabotages**, each red as it must be.
- **Nine older database tests** had a team member changing a colleague's organisation by the role's Full level.
  Each still pins what it pinned: its member is given Full by a person's own setting (or the extra), and each says so.
- **Unit** — the screen rule and the role's starting levels (14 tests); **seven unit sabotages**. Four older
  sabotages that named a changed line follow it.
- **Browser, `landing-55-own-organisations-only.spec.ts`** — on the real stack: the owner is offered Edit, + Add,
  the file picker and Archive; a colleague reads the organisation, may log an activity, and is offered none of
  them; **a save sent straight to the database as the colleague is refused (403, `access.needs_level`)** for the
  details, a contact and an archive; a manager is offered Edit. **Three browser sabotages.**

## Verification (this landing's head, on the builder's machine — a cloud container, local stack, made-up data)

| Check | Result |
| --- | --- |
| Base equals `v2/main` (`20b69233`) before editing | yes |
| SQL suite, a fresh database from zero, plain Postgres 16 | 398 passed, 0 failed (397 + `OWN-01`) |
| Sabotage — every SQL plant (641, the 6 new ones among them) | all red as they must be, after one older plant followed its line (below) |
| Unit tests | 1,963 passed (1,949 + 14) |
| The 7 new unit plants | red as they must be |
| `pnpm typecheck` · `pnpm lint` · `pnpm format:check` · `node scripts/checks/run.mjs` | exit 0 · exit 0 · exit 0 · 19 green |
| The new browser test, on a production build against the local Supabase stack | passed |

## CI run on the first push — two red jobs, and their fixes (second and third commits)

- **The browser suite: 623 passed, 2 failed** — one test in both languages (`app-settings.alone.spec.ts`, "the other
  items are still there"): the Create menu offered New client and New supplier at Full only, so a team member at Own
  lost them, though adding an organisation is theirs. The menu now offers both at Own and Full.
- **The database sabotage job: one older plant, `anyone-logs-an-activity`**, takes the write check out of
  `partner.activity_log` by its exact text, and this landing changed that line. The plant follows the new text; it
  is red for its own reason again (`a viewer logs nothing`).

## Live checks

- **Done before the push, read-only:** the counts above; the last applied migration is `20261126100100`, so this
  landing's two are the only ones the production job applies.
- **After it is live — for Rocky (one step at a time; cancel without saving wherever a dialog opens):**
  1. "Sign in as test user" as the TEST team member (no extra access) → open an organisation owned by someone else
     (Al Qassim Business Travel, DK-P-0045). It opens and reads. There is **no Edit button**, no "+ Add" on
     contacts or client IDs, no Archive / Remove in the ⋯ menu, and Partner files shows no "Choose files".
     "Log activity" is still there.
  2. Same person → an organisation they own: Edit, "+ Add" and the file picker are there.
  3. Same person → Partners list: "New" is there; the ⋯ on a colleague's row offers only Open.
  4. As the admin: set that member's "Edit someone else's work" to Allowed (with a reason) → as the member, DK-P-0045
     now offers Edit. Set it back to "As their role".
  5. Finance → Year to date: Revenue, Cost and Profit are what they were before the deploy.
