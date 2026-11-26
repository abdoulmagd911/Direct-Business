# Landing 56 — "Own clients only" on Finance

26 Nov 2026 · base `20b69233` (Landing 54) · target `v2/main` · branch `v2/a-landing-56-finance-own-clients` · by pull
request.

Approved by the owner on 26 Nov 2026 ("Turn on 'Own clients only' so a Member can only edit Finance entries for
their own clients … go with your recommendations"). It closes the item Landings 40, 51 and 55 each left open, under
the per-member design of 22 Nov: "Member: sees Finance, adds and edits Finance for their **own** clients."

This landing is built beside Landing 55 (organisations: a team member changes their own only), not on top of it;
neither needs the other. See "When both are merged" below.

## What changes

1. **The Team member role starts at Own on Finance** and on an organisation's Finance tab (it was Full since
   Landing 34b). A manager, a head and an admin keep Full. A Viewer keeps View.
2. **Own still reads all of Finance** — every figure, the Ledger, every card. Nothing is hidden.
3. **At Own a person adds and changes a Finance entry only for a client whose Client side they own:**
   a new invoice with its lines, expenses and receipts; an edit; a removal; an invoice's channel and commission; a
   Ledger row's deal type; a tender's client ID. For a colleague's client each is **refused by the database**, in
   words ("You add and change Finance entries for your own clients only"), and nothing of it is kept.
4. **An entry that matches no organisation is nobody's own**: it stays with Full.
5. **"Edit someone else's work — Allowed"** (a person's record) opens a colleague's client's entries to that one
   person — "editing others' inputs stays a specific access".

## Not affected — as asked

- **Importing** stays its own extra (Import files on Finance: an admin and a head by role, or a person set to
  Allowed). One thing had to change so that it *stays* unaffected: the import doors also asked for Finance at
  Full, which a team member no longer holds. They now ask for Own or above, so **a member set to Allowed on Import
  still imports** — for any organisation, as before. A member without the extra imports nothing.
- **Credit limits** stay their own extra (Change credit limits).
- **The exclusion and merge lists, Exclude / Include a row**: admins, as before.

## Decisions taken (please confirm or overrule)

1. **What asks for Full stays with Full, so a team member no longer does it:** closing a month, the Finance word
   lists (channels, import columns), the "no supplier cost" mark on a product, and the follow-ups of the older
   import (billing proposals, import differences). None of these is an entry of one client. If a team member should
   keep any of them, say which.
2. **An invoice that matches no organisation cannot be typed by a team member.** The form says so in words when
   the client ID typed is not one of their clients'. A manager types it.
3. **A client's owner is the owner of its Client side.** An organisation with only a Supplier & partner side is no
   one's client.
4. **Arabic** (please glance): «تضيف وتعدّل قيود المالية لعملائك أنت فقط».

## Who is affected on live (read-only, 26 Nov, counts only)

- 12 people hold the Team member role; each is at Full on Finance today and will be at Own.
- 154 invoices are recorded here: 152 match an organisation, and every one of those organisations has an owner on
  its Client side. 2 match no organisation — a manager, a head or an admin changes those.
- No person and no team holds a level of their own on Finance, and nobody is set to Allowed on Import yet.

## Underneath — forward-only

| Migration | What |
| --- | --- |
| `20261126120000_finance_own_clients_only.sql` | The one rule `finance.may_write_partner` (Full, or Own and the owner of the Client side, or the extra), its refusals `finance.require_own` / `finance.require_own_partner`, and the read `api.finance_my_clients` (which clients are theirs — asked once by the screen). `finance.row_add`, `row_edit`, `rows_remove` (and their kept `_core` statements), `channel_set`, `commission_set`, `deal_type_set`, `tender_client_id_set`, `last_saved`, and the five import functions are the statements the database held, word for word, with only the marked lines changed. The Team member role's two rows go from Full to Own — only the role's own rows, only where they still read Full. |
| `20261126120100_core_registry_sync.sql` | The registry's starting level for the role on the two pages. |

`grants.expected` gains two lines (`api.finance_my_clients` and its inner function); `database.types.ts` gains one
(the generator's output). **No figure can move:** nothing that counts is touched, and `OWN-02` pins that the Ledger's
totals are the same before and after every refusal.

Screens: one rule file, `src/modules/finance/own-clients.ts`. "New invoice" (the page, the Create menu, the phone +)
is offered at Own; the deal-type control is drawn on the rows of the clients that are theirs; the import section is
drawn for whoever holds the Import extra, at Own or above; "Close month" stays with Full.

## Tests

- **Database, `OWN-02`** — through the real doors, made-up data: a team member starts at Own and reads the figures
  and the Ledger; types an invoice for their own client with its expense, commission and deal type, edits it and
  removes it; is refused an invoice for a colleague's client, one that matches no organisation, and an edit that
  would move their invoice onto a colleague's client — nothing kept; a colleague is refused six kinds of change on
  it and the Ledger's totals do not move; a Viewer is refused all six; Allowed opens it to one person only; a member
  set to Allowed on Import imports at Own and one without it does not; no month close at Own; a manager changes
  every entry. **Nine database sabotages**, each red as it must be.
- **Older database tests:** `FIX03-02` now pins "a member starts at Own" (renamed to say so); `XTR-01`, `ROW-04` and
  `TND-01` follow the new level and the new words.
- **Unit** — the screen rule, the role's starting levels and the wording in both languages (8 tests); **five unit
  sabotages**. Six older sabotages that named a changed line follow it.
- **Browser, `landing-56-finance-own-clients-only.spec.ts`** — on the real stack: a team member reads both rows of
  the month, is offered New invoice and its form, and the deal-type control on their own client's row only; **an
  invoice sent straight to the database is kept for their own client and refused (403, `finance.own_clients_only`)
  for a colleague's, with nothing kept**; a manager is offered the control on every row. **Three browser sabotages.**

## Verification (this landing's head, on the builder's machine — a cloud container, local stack, made-up data)

| Check | Result |
| --- | --- |
| Base equals `v2/main` (`20b69233`) before editing | yes |
| SQL suite, a fresh database from zero, plain Postgres 16 | 398 passed, 0 failed (397 + `OWN-02`) |
| The 9 new SQL plants, and the three nearest older ones (`importing-needs-no-level-on-finance`, `a-member-starts-with-none-on-finance`, `a-viewer-starts-at-full-on-finance`) | 12 red as they must be |
| Unit tests | 1,957 passed (1,949 + 8) |
| The 5 new unit plants, and `l47-anyone-is-offered-the-deal-type-control` after its line moved | red as they must be |
| `pnpm typecheck` · `pnpm lint` · `pnpm format:check` · `node scripts/checks/run.mjs` | exit 0 · exit 0 · exit 0 · 19 green |
| Generated types (`gen-types`, Supabase CLI 2.118.0 on the local stack) · registry | one new line · synced |
| The new browser test, on a production build against the local Supabase stack | passed |

Said plainly — **left to CI at the time of the first push:** the whole browser suite and its sabotage plants, and
the full sweep of every older SQL and unit plant.

## When both are merged (Landing 55 and this one)

Each was built from the same base. Whichever merges second is levelled with `v2/main` first: both add a line to
`registry.json` and to the Create menu's list, and each brings its own registry-sync migration. Together they give
the design's Member in full: their own organisations, and their own clients' Finance.

## Live checks

- **Done before the push, read-only:** the counts above.
- **After it is live — for Rocky (one step at a time; cancel without saving wherever a dialog opens):**
  1. "Sign in as test user" as the TEST team member → Finance opens with every figure and the whole Ledger.
  2. On the Ledger: the control that sets a row's deal type is on the rows of that member's
     own clients and on no other row.
  3. Finance → New invoice opens. (To prove the refusal without leaving data: type a colleague's client's ID and
     press Save — the form says "You add and change Finance entries for your own clients only" and nothing is saved.)
  4. "Close month" is not offered to the member; as the TEST manager it is.
  5. As the admin: set the member's "Import files on Finance" to Allowed (with a reason) → as the member, the import
     section is on Finance. Set it back to "As their role".
  6. Finance → Year to date: Revenue, Cost and Profit are what they were before the deploy.
