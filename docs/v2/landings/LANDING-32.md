# Landing 32 — Finance F-B (who counts, the lists, the code ID, the discount filter, the empty cost)

Base `e53e9b7` (Landing 31 follow-up, CI #1612 all green) · target `v2/main` · one push.

Scope: **A2 + A3 + A4 + A5 + the finding-9 check.**

## In plain words — what is new

1. **Every Ledger row says whether it counts.** A read-only "Counted?" column; a row that does not count is
   listed apart under "Not counted (N)" with its reason, and is in no total.
2. **The Admin can take one row out and put it back** (Exclude / Include on the Ledger row and on a code's
   page). A reason is required both ways, and both are logged with who and when. The row is never removed.
3. **Two lists in Settings → Finance, for admins:** the **exclusion list** (by client ID, name, discount code,
   VAT / CR number) and the **merge list** (a client ID or a discount code counted under a named organisation).
   Both lists are EMPTY: nothing is seeded, pre-filled or suggested by the code. The owner types them in the
   browser.
4. **"Is it counted?" table** on the Finance page: per month and per year — counted, not counted, and why not
   (excluded · not fully paid · promo pool).
5. **An imported row records which code it carries** (the code's own ID, its type and the import time). A code
   text that matches no code says "Code has not been found" on the row and in the import preview — never silent.
   A text that more than one code row carries is held for a person, never guessed.
6. **A code view's discount follows the filters**: the dates and the organisation asked for. Only that figure
   is shown.
7. **The Ledger's cost shows a dash when no cost is known** — never 0. Profit follows. The same on each
   organisation's line.
8. **Finding 9 — a real fault, fixed.** See below.

## Finding 9 — fixed

The test `FND-09` puts two different documents that share one number in front of both reads. On the base it
failed: **the Finance page's top figures counted 5 documents, the Ledger 6.** Cause: the Overview's guard against
a document arriving through both doors matched on the number alone, so a transaction recorded here and an
imported standalone invoice that merely share a number were treated as one. The guard now matches the document —
organisation, kind and number — exactly as the Ledger's own dedup does. On the live data the old guard and the
new one drop the same rows (0 of 2 today), so no live figure moves.

## The lists — the decision the brief asked to record

**The lists live in `finance.exclusion_rule` and a new `finance.merge_rule`. `partner.identifier_block` is not
used.** Reasoning:

- `partner.identifier_block` only gates *adding an identifier to an organisation*. No money read consults it —
  not the import engine, not the Ledger, not the Overview. A list there would exclude nothing.
- `finance.exclusion_rule` already existed as the Finance exclusion list (by client ID, name, VAT/CR, code,
  invoice, product, partner), with admin-only, logged doors — but **no screen**, and it was consulted only for
  rows recorded here. Imported rows were never asked. That is the gap: an excluded client's imported invoices
  still counted.
- So this landing gives that list a screen, applies it to imported rows in **every** Finance read through one
  shared view (`finance.import_unit`), and adds the merge list beside it. One list, one place where "does this
  row count?" is decided, for both stores — the Overview and the Ledger cannot disagree.

**How the lists behave**

- *Exclusion excludes what was typed and keeps everything else.* An imported row carries no client ID of its own
  (the organisation is chosen at upload), so a client-ID rule catches the rows of the organisation holding that
  ID — and **only when every client ID that organisation holds is on the list**. An organisation holding one
  excluded ID and one kept ID keeps its imported rows; nothing is guessed. (Tested: `LST-01`.) Rows recorded
  here carry their own client ID and are matched exactly.
- *Merging merges only what was named.* A merged client ID counts its organisation's rows under the named
  organisation, and only when every client ID it holds is merged into that same organisation.
- *A code merged into an organisation leaves the promo pool automatically* and counts under that organisation.
- *The import preview's "Left out by rule" count includes the exclusion list*: when the organisation (or the
  file's code) is on the list, the preview says so, names the rule, and counts those rows. They are still
  stored — the list is applied when figures are read, so removing a rule counts them again at once.
- The Admin's Exclude on one row is a rule for that one number at that one organisation; Include takes it away.
  A row a *list* rule catches offers no Include — the list is changed in Settings.

## The values — NOT in the code

No migration, seed, fixture or test contains the owner's values. Tests use made-up organisations, client IDs
`9901xx–9907xx` and codes `MADEUP…`. The owner enters the lists himself in Settings → Finance after this lands.

**Expected effect when the owner applies them (to be recorded then):** before the exclusion the Finance page
overstated BD revenue by **6,724,291.12 SAR**. Procedure: note the Finance page's Revenue / Cost / Profit for the
period *before* typing the lists; type them; note the same three *after*. The difference in Revenue should be the
overstatement. Each rule's row in Settings shows what it catches ("N rows · SAR amount"), and the "Is it
counted?" table shows the excluded amount per month — the two must add up to the same difference. **Before /
after totals: not yet recorded — the lists are empty today.**

## Database — forward-only

| Migration | What |
| --- | --- |
| `20261119090000_finance_counted_lists_and_toggle.sql` | A2: a rule may be for one row (`exclusion_rule.partner_id`); `finance.merge_rule`; the views `finance.import_exclusion` / `finance.import_unit`; the three Overview reads read them (and the finding-9 guard); doors: `finance_row_exclude` / `_include`, `finance_merge_rules` / `_save` / `_remove`, `finance_counted_by_month`, `finance_import_rule_check`; `finance_exclusion_rules` counts imported rows too |
| `20261119100000_work_import_record_code_id.sql` | A3: `work.import_record.code_id` (→ `partner.identifier`), `code_type`, `code_at`, `code_state`; a trigger sets them at import; the stored rows are filled by the same match; `import_code_check` for the preview |
| `20261119110000_finance_unified_ledger_counted_merges_filters.sql` | A2 + A4 + A5 in the unified Ledger (same signature and grants); the code detail carries what the toggle needs |
| `20261119202043_core_registry_sync.sql` | the merge list registered as an entity (generated) |

`grants.expected` gains the new doors (each `api.*` with its inner function — both grants). `database.types.ts`
is the generator's output (CLI 2.118.0). Every redefined function re-applies `jit = off`.

**A3 backfill — before / after.** Read on the live database before the push (read-only): **5** imported rows;
**2** carry a code text (one distinct text); **0** carry a code ID (the column is new). After the migration, by
the same match: **0 found, 2 "Code has not been found", 0 held.** Those two rows now say so on the Ledger. (The
migration raises the same counts as a NOTICE in the production job's log.) Tested: `CID-01`.

**"Code type" — an interpretation, please confirm.** A discount code has no type of its own in the database
today. The import records `promo` for a row that came as the code's own use (a promo holding or an attributed
row) and `discount` for a money row that only carries a code text.

## Decisions taken (please confirm or overrule)

1. The lists reuse and extend `finance.exclusion_rule`; a new `finance.merge_rule`; not `identifier_block`.
2. A client-ID rule on imported rows needs every client ID of that organisation to be on the list (above).
3. "Not counted" rows listed in the Ledger are the ones a rule or the Admin excluded. Rows not fully paid stay
   summarised as before (and are counted in the "Is it counted?" table); listing every unpaid row would bury
   the Ledger.
4. The Ledger's by-organisation lines are now built from the same rows as the totals (so they follow the merge
   list). The row list is capped at 1,000 rows recorded here per read, as before; past that the screen already
   says the list is cut.
5. A4 and A5 are in the same Ledger redefinition as A2 (one function, three migrations in all) — redefining the
   same function three times in three files would only hide the diff.
6. The Overview's Cost card is unchanged (its Provisional rule is its own); A5 is the Ledger's tile and lines.
7. Promo holding rows (kind `promo`) whose code is merged leave the pool list; they were never money rows and
   are not added to totals — the code's money rows are.
8. The "Left out by rule" pill in the preview = rows held + rows the list catches; the other pills are
   unchanged, so the five can add up to more than the file's rows.
9. Arabic for Include is «احتساب», Exclude «استبعاد», Counted? «هل يُحتسب؟», promo pool «رصيد أكواد الخصم»
   (please glance).

## Rules held

Revenue, Cost, Profit only — no VAT anywhere. A missing cost is empty, never 0. Only fully-paid statuses count.
Refunds are untouched. NET by invoice number is untouched. Imported rows are read at read time, never written
into `finance.*`. No pushed migration edited.

## Tests

- SQL (356 → 363; `LST-01` also pins that a database built from the migrations holds NO exclusion and NO merge
  rule): `FND-09` finding 9 · `TGL-01` the toggle (exclude → totals drop by exactly that row, the row
  is listed not counted with its reason, include reverses exactly; both stores; admin only; reason required;
  logged) · `LST-01` the lists on imported rows, the merges, the promo pool, the counted table, the preview
  check · `CID-01` the code ID and the backfill count · `DSC-01` the code discount respects dates + organisation
  · `CST-01` the cost is empty (null) when none is known · `UNI-07` the organisation tab equals the Finance
  page's line, difference 0, with and without imported rows, with the lists applied. `UNI-02` still green.
- SQL sabotage: 10 new files under `supabase/tests/sabotage/`, each red as required.
- Unit (1,295 → 1,405): the Ledger says what is counted, Exclude / Include need a reason, the counted table,
  the import preview counts the exclusion list, the Settings lists (nothing pre-filled, admin only), the code
  page's toggle, the organisation tab counts only counted rows. Sabotage: `tests/sabotage/landing-32-*.mjs`.
- Browser: `landing-32-finance-fb.spec.ts` (8 tests: the toggle end to end, a head sees no buttons, the empty
  cost, the Settings lists and their effect, the tab equals the page line, the code page's toggle, the import
  preview with a made-up file, the six-role speed gate) and `landing-32-sweep.alone.spec.ts` (the sweep).
  Sabotage: `tests/sabotage/landing-32-e2e.mjs` (6 plants).

## Verification (this landing's head)

| Check | Result |
| --- | --- |
| Base equals the live green head `e53e9b7` before editing and again before the push | yes |
| `pnpm typecheck` · `pnpm lint` · `pnpm format:check` | exit 0 · exit 0 · exit 0 |
| `node scripts/checks/run.mjs` | 19 green |
| `node scripts/db/gen-types.mjs --check` (Supabase CLI 2.118.0) | matches the migrations |
| Unit tests (vitest) | 1,405 passed in 211 files (1,295 at Landing 31; none loosened) |
| SQL suite, a fresh `v2_test` from zero | 363 passed, 0 failed (356 at Landing 31) |
| `UNI-02` (the Overview equals the unified Ledger totals) | green |
| Organisation-level assert `UNI-07` (tab totals = Finance page line, difference 0, with and without imported rows) | green in SQL; the same in the browser (2,700 / 300 / 1,200; imported hidden 1,500) |
| Finding-9 test `FND-09` | green (red on the base: 5 vs 6) |
| `pnpm build` (inside the browser run) | exit 0 |
| Browser tests, the whole `chromium` project | 487 passed, 0 failed, 11 skipped (skips written in older specs) — 485 in the full run, and the 2 that failed there green after their fix, with the 33 other affected tests, on a fresh build |
| Browser tests that run alone (Arabic, the sweep, credit limit, app settings) | 33 passed, 0 failed |
| Money gaps | 0.00 in every comparison (limit < 1 SAR) |
| Sabotage — every SQL plant | 530 of 530 red as required (one older plant, `codes-detail-loses-jit-off`, re-pointed: the setting now lives in two migrations) |
| Sabotage — unit and check plants the change could touch | 243 plants, 244 target runs, 0 failures |
| Sabotage — browser plants the change could touch | 160 of 160 red as required, among them the 6 new ones (one older plant, `clients-plus-on-the-list-opens-nothing`, sharpened: it had stopped proving its point since Landing 31) |

**Speed gate** — limit 3 s local (8 s live). On 6,000 made-up imported rows, 60 organisations, 5 exclusion rules and
2 merges (local Postgres 16): Finance page figures 157 ms · unified Ledger 253 ms · "Is it counted?" 52 ms · By
service 252 ms · organisation tab 105 ms · exclusion list 16 ms · merge list 92 ms. In the browser, per role (ms):

| Role | Ledger | Finance figures | Is it counted? |
| --- | --- | --- | --- |
| Admin | 168 | 170 | 144 |
| Head | 128 | 132 | 188 |
| Manager | 180 | 153 | 255 |
| Member | 125 | 110 | 140 |
| Viewer | 169 | 191 | 156 |
| No role | refused (no access) | refused | refused |

(The first version of the two list reads took about 2 s on that data set; the exclusion view was rewritten to work
per rule instead of per row before the push.)

**Sweep** — PC (1,440 px) and phone (375 px), English and Arabic, six roles; per page: no sideways scroll, no word
under 12 px, the right direction, no crash, no bare "0" where a cost is unknown, 44 px buttons on a phone, the
right buttons for the role. Rows tested / rows with an issue:

| Role | 1440 EN | 375 EN | 1440 AR | 375 AR |
| --- | --- | --- | --- | --- |
| Admin | 21 / 0 | 21 / 0 | 21 / 0 | 21 / 0 |
| Head | 16 / 0 | 16 / 0 | 16 / 0 | 16 / 0 |
| Manager | 16 / 0 | 16 / 0 | 16 / 0 | 16 / 0 |
| Member | 16 / 0 | 16 / 0 | 16 / 0 | 16 / 0 |
| Viewer | 16 / 0 | 16 / 0 | 16 / 0 | 16 / 0 |
| No role | 0 / 0 (no-access state) | 0 / 0 | 0 / 0 | 0 / 0 |

**Total: 404 rows tested, 0 with an issue.**

**Live baselines to hold** — Finance YTD 8,550 / 870 / 3,480, Provisional 4,200. Checked read-only on the live
database before the push: no exclusion or merge rule exists, and the finding-9 guard drops the same rows as the
old one (0 of 2), so no figure can move with this landing. To confirm on the live page after the deploy.

Where it was run: a cloud container; local Postgres 16 for the plain SQL suite (CI uses 17) and the local Supabase
stack (Postgres 17) for types and browser tests.

## Found on the way and fixed in this landing

- **Finding 9** (above): the Overview and the Ledger disagreed on two documents sharing a number.
- **A code's page showed "Cost 0" and Profit = Revenue** for a use whose invoice has no approved cost yet — the
  "missing cost is empty, never 0" rule, broken since before this landing. The code detail now answers an empty
  cost and profit for such a unit.
- **The organisation tab's "Not yet counted" card** missed excluded imported rows (it read the rows recorded here
  only). It now counts both stores.
- **Settings lists on a phone** are drawn as cards (no table markup), per the standing rule for Settings.

## Seen on screen, not changed (small; say if you want them)

- On a code's page a not-counted use reads "Fully Paid · reason" — the status word is the invoice's own (raw from
  Payments, English in Arabic too).
- On the tab's Not counted list, an excluded invoice recorded here shows a dash as its big reference, the number
  on the small line.
- Phone Ledger: the counts line wraps with a stray "·"; the Cost column is hidden under 600 px (Profit shows).
- A merge that catches nothing yet reads "0 rows · SAR 0" (a real zero).

## For the owner — after it is live

1. Open the Finance page and check the YTD figures still read 8,550 / 870 / 3,480 and Provisional 4,200.
2. Note Revenue / Cost / Profit for the period you care about. Then Settings → Finance → type the exclusion list
   and the merge list. Note the three figures again. Send me the two sets and I will record them here (expected
   Revenue difference: 6,724,291.12 SAR once the real import is in).
3. Confirm the decisions above, and the "code type" interpretation.
