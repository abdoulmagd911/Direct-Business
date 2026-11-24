# Landing 48 — Finance Part B: every figure checkable (the ten addendum items)

24 Nov 2026 · base `f158ee80` (Landing 46) · target `v2/main` · by pull request 401.

This work was built as "Landing 47"; while it was being checked, the small-fix round opened its own Landing 47 (pull
request 400, ten minutes earlier), so this one takes the next number. Its first commit, its migrations' comments, its
test files and its sabotage files keep "Landing 47" / `landing-47` / `l47` in their words and names — as Landing 38
kept "37". The two changes share no file.

Built from the Finance finalisation spec of 14 Nov 2026 (pasted into the build session by the oversight; it is **not**
committed — it names real clients and client IDs, and this repository is public).

Scope: **Part B of the spec — A3, A4, A5, A11, A10, A6, A12, A7, A13, A14.** Nothing else: not the enrichment script, not
the small-fix round, not the test-data run, no Initiatives, no number links to Direct payment (the spec's B1, a later
landing).

## First: what the spec asked for that was already there

Checked on this tree before building, item by item, so nothing is built twice:

| Spec item | Where it already lives | Checked how |
| --- | --- | --- |
| A1 — organisation Finance tabs read the unified ledger, show/hide imported, "as of" stamp, saved view + file, speed | Landing 25 (and 27, 34, 35) | `UNI-04…07`, `EXC-03`, `JIT-01…03` green on the base |
| A2 — Counted? column, Exclude / Include, "Is it counted?" | Landing 32 | `TGL-01`, `LST-01` green |
| A3 (Part A) — code ID at import | Landing 32 | `CID-01` green |
| A4 (Part A) — a code view's discount follows the dates and the organisation | Landing 32 | `DSC-01` green |
| A5 (Part A) — the cost tile is a dash when no cost is known | Landing 32 | `CST-01` green |
| A6 (Part A) — a Pending or Draft invoice is listed as not yet counted; the last-saved record; search by number | Landing 38 | `FNC-01…03` green |
| A7 (Part A) — "Custom" opens on the first press | Landing 38 | its unit and browser tests green |
| Part B item 1 — the exclusion and merge lists as settings, nothing seeded | Landing 32 | `LST-01` pins that a database built from the migrations holds no rule |
| B2 — the department credit limit as an editable setting | Landing 31 / 40 | `CCL-01` green |

So this landing is the **ten remaining items of Part B**.

## In plain words — what is new

1. **A cost is tied to its transaction, never to a tax invoice (A3).** An expense line whose reference is a tax invoice
   number (it starts with DPIN or TTIN, or it is the tax number a stored row carries) is held, with the reason in
   words, and becomes nobody's cost.
2. **One expense is counted once (A4).** Two expense lines are the same expense when they share the transaction
   number, the amount, the approval time and the expense type; lines that differ on any of the four are all counted.
   This holds inside one file and from file to file: a later file that carries only some of a transaction's expenses
   **adds** them — it no longer replaces the stored cost with its own sum. The import preview shows the cost that
   Confirm will store. A credit on an expense is a line with a negative amount: it lowers the cost and rewrites nothing
   else on a Fully Paid row.
3. **Every Ledger row says its deal type (A5):** Prepaid, Postpaid, Tender or Promo code — or "Deal type not set",
   as a warning, never a blank. "By deal type" adds the listed rows up per type, and filters and sorts the list. A
   person with Full on Finance can set a row's deal type, with a reason (logged). The file export carries the deal
   type as its last column.
4. **A postpaid row says "Paid · receivable" (A12)**, and a postpaid organisation's Finance tab shows **no wallet
   top-up** — only what was invoiced, and that it is settled by hand with the Finance team.
5. **A row with a DPIN says "Tax invoice issued" (A14).** Hand edits and removals stay at the transaction's level: a
   monthly (billing) invoice is refused by both hand doors, in words. A re-import never touches a row typed by hand.
6. **A commission typed by hand names itself (A7):** Airlines, Provider, Cashback, Study abroad or Other, with its
   proof (required). Its Ledger row says which commission it is. Only a row typed by hand takes it.
7. **"Does Finance agree with itself?" (A10)** — a new card on the Finance page: the page's figures beside the
   Ledger's totals, and every gap between and inside them. No gap is "Agrees". A gap of 1 SAR or more is marked as a
   failure; a smaller one is still listed.
8. **"Outstanding and how old" (A6)** — a new card: what is still owed, by organisation and by invoice, with its age
   in days and its bucket (0–30, 31–60, 61–90, over 90). It opens as the pursue list for postpaid (postpaid rows and
   rows whose deal type is not set); one press lists every deal type. The same card, for one organisation, is on its
   Finance tab.
9. **"Held — to tie" (A11)** — a new card: the rows Finance cannot tie firmly — no partner matched, no client ID, or
   one number under more than one partner — each with its amount. They stay in the Ledger and count as before; the
   card is where they are held in view until a person ties them.
10. **Contract payments (A13)** — on an organisation's Finance tab, each client-side contract lists its payments by
    month or by quarter: the period's total, and each invoice under it.

**No figure moves with this landing.** The counted statement of the Ledger is kept word for word (see "Database");
the marks, the cards and the lists read beside it.

## A11 — the three number rules, stated together

So a reader can tell them apart:

- **The same document through both doors** — the same organisation, the same kind of document, the same number,
  once typed here and once imported — is **one row**, and the row recorded here is the one kept (Landing 18,
  `UNI-03`).
- **Two documents that only share a number** — another organisation, or another kind of document — are **two rows**,
  both kept and both counted (`FND-09`, still green). They are now also listed under "One number under more than one
  partner", so a person can look.
- **A number repeated inside one file** is one document written twice: the first is kept and the repeat is skipped
  unless the person chooses otherwise (the import preview's own rule since the engine was built; the engine's keys
  allow one row per number and organisation).

## Database — forward-only

| Migration | What |
| --- | --- |
| `20261124090000_finance_cost_keys_and_dedupe.sql` | A3 + A4. `work.import_record.expense_keys` (the expense lines already inside the cost); `work.expense_key`, `work.expense_settle`; the preview's read `api.import_expense_preview`. `work.import_apply` keeps its name, arguments and grants: the statement of 20261109000009 is kept whole as `work.import_apply_core`, and the function under the old name settles the expense rows first. |
| `20261124100000_finance_deal_type_commission_tax_invoice.sql` | A5, A7, A12 (the row's side), A14. Three typed facts: `deal_type` on `work.import_record` and on `finance.invoice`; `commission_type` + `commission_proof` on `finance.invoice`. The rule `finance.deal_rule`. `finance.unified_ledger` keeps its name, arguments and grants: the statement of 20261123090000 is kept whole as `finance.unified_ledger_core`, and the function under the old name adds the marks to its answer (`finance.ledger_marks`). Doors: `api.finance_deal_type_set`, `api.finance_commission_set`. The two hand doors (`finance.row_edit`, `finance.rows_remove`) keep their names; their statements are kept as `…_core` and a monthly invoice is refused before them. |
| `20261124110000_finance_reconciliation_ageing_held_contracts.sql` | A11, A10, A6, A13 — four reads of their own: `api.finance_held_rows`, `api.finance_reconciliation`, `api.finance_ageing`, `api.finance_contract_payments`. No existing function is touched. |

- **No data is changed, written or back-filled.** No list value is seeded. The three new columns are empty on every
  existing row.
- `grants.expected` gains 14 lines: the seven new doors, each `api.*` with its inner function. The four kept
  statements (`…_core`) are reachable only through the function that kept the name.
- `database.types.ts` is the generator's output (CLI 2.118.0; 13 new lines). No registry change.
- Every heavy read keeps `jit = off` (JIT-01…05 green).
- **Existing rows with a cost** were written before the keys existed. Their cost is replaced by the next expense
  file's own sum — exactly as before this landing — and is keyed from then on.

## Decisions taken (please confirm or overrule)

The addendum's own wording (`egm-gaps/claude-backup-addendum-2026-11-07.md` §2) was not available to the build
session; these are built from the spec's sentences. Each is small to change.

1. **A5 — where a deal type comes from.** A row recorded here: the kind of the client ID on its invoice, else promo
   when it carries a code, else its organisation's kind when every client ID the organisation holds is of one kind.
   An imported row carries no client ID of its own (the organisation is chosen at upload): promo when it carries a
   code, else the organisation's kind. An organisation holding two kinds settles nothing: the row is "not set" until
   a person sets it. What a person sets wins.
2. **A5 — a promo-code sale and the promo pool.** The row is flagged promo and shown with its own revenue, cost and
   profit. **What counts was not changed:** an imported code row whose code is not merged into an organisation is
   still kept apart in the promo pool (Landing 32's rule). If the owner wants a promo-code sale counted under its
   organisation's account manager without a merge rule, that is a change to what counts — say so and it is built as
   its own landing, with before / after totals.
3. **A5 — who sets a deal type:** anyone with Full on Finance (the level that types an invoice). It is a label; it
   moves no figure.
4. **A12 — "postpaid organisation":** it holds a postpaid client ID and no prepaid one. One that holds both keeps
   its wallet card.
5. **A12 — "paid but receivable"** is said on every counted row of a postpaid deal.
6. **A14 — "edit only at transaction level":** the hand doors refuse a monthly (billing) invoice; a transaction and a
   standalone invoice (its own unit) are edited as before. No screen offers hand edit or removal today, so nothing on
   screen changes.
7. **A14 — the indicator** is the DPIN itself: a row recorded here that has a tax invoice record, or an imported row
   whose tax number starts with DPIN. A TTIN alone does not say "issued".
8. **A7 — the five commissions are fixed** (the spec names them); they are not a Settings list. A commission type does
   not change how an invoice counts — the existing rule (a commission product, or a line named for one) still decides.
9. **A7 — the proof** is a line of text (where the statement or the transfer is kept), up to 500 characters. A file
   upload on the form can follow.
10. **A10 — what a gap is:** a figure the Finance page and the Ledger disagree on; a counted row whose profit is not
    its revenue less its cost; an imported row whose cost is not the sum of its expense lines; partners' lines that do
    not add up to the Ledger's total. The older per-invoice checks (monthly invoice against its transactions, DPIN
    against total less expenses) stay where they are, in Health — on live they are not empty, and the spec asks for an
    empty list when Finance agrees with itself.
11. **A6 — what is owed:** a document not fully paid. Recorded here: `finance.receivable` as it stood (total less
    receipts). Imported: a row not confirmed paid owes its amount (its receipts are not read). Age is counted from
    the day it was issued. Paid, cancelled, void and draft documents are never owed.
12. **A6 — the pursue list keeps rows whose deal type is not set**, so a missing flag hides nothing.
13. **A11 — held rows still count.** "Held, never dropped" is built as: listed, with amounts, in a place of their
    own — not taken out of the totals. Taking them out would move live figures; say so if that is what is meant.
14. **A13 — a contract's payments** are the Ledger's rows of its organisation dated inside the contract's term. No
    invoice is tied to a contract by hand. Two contracts of one organisation whose terms overlap both list the same
    invoices (they are in no total twice — each contract shows its own list).
15. **Arabic** (please glance): Deal type «نوع التعامل», Prepaid «مسبق الدفع», Postpaid «آجل الدفع», Tender
    «مناقصة», Promo code «كود خصم», Paid · receivable «مدفوعة · مستحقة التحصيل», Tax invoice issued «صدرت الفاتورة
    الضريبية», Does Finance agree with itself? «هل تتطابق أرقام المالية؟», Outstanding and how old «المستحقات
    وأعمارها», Held — to tie «معلّقة — بانتظار الربط», Contract payments «دفعات العقود».

## Rules held

Revenue, Cost, Profit only — no VAT anywhere. A missing cost is empty (a dash), never 0. Only fully-paid statuses
count. Refunds and credit notes rewrite no Fully Paid record. Transaction number first, invoice number under it.
Imported rows are read at read time, never written into `finance.*`. No business record is created by code; no list
value is seeded. No pushed migration edited. Settlement is not shown.

## Tests

- **SQL (381 → 389), each through the real doors, on made-up data:**
  `CKY-01` an expense line is counted once by its four-part key, a later file adds, a credit lowers the cost, a tax
  invoice number is held · `DTY-01` every Ledger row carries its deal type, a person sets it, no total moves ·
  `DPN-01` a DPIN says the tax invoice is issued, a monthly invoice is not edited or removed by hand, a re-import
  leaves the typed row as it was, field for field · `CMN-01` a commission names itself with its proof · `HLD-01` the
  held list, and the three number rules · `RCN-01` Finance agrees with itself, **and a seeded disagreement is
  listed** (a row's profit, a row's expense lines; under 1 SAR listed but not failing) · `AGE-01` what is owed, its
  age, its bucket, by invoice and by organisation · `CPY-01` a contract's payments equal the Ledger for the same
  organisation and term, difference 0. `UNI-02`, `UNI-07` and `FND-09` still green.
- **SQL sabotage: 31 new plants**, each red as it must be (`supabase/tests/sabotage/`).
- **Unit (1,821 → 1,880; 4 new files, 59 tests):** the expense file settled by the database · the Ledger's marks, "By
  deal type", who sets a deal type, the file's last column · the three cards (agreement, ageing, held) · the
  commission on the form, a contract's payments, the postpaid wallet rule. **29 unit sabotages**
  (`tests/sabotage/landing-47-finance.mjs`, `landing-47-imports.mjs`).
- **Browser:** `landing-47-finance-part-b.spec.ts` (6 tests: the marks and a deal type set by a person with no figure
  moved; what is owed, on the page and on the tab; the tab's wallet and contract payments; a commission and its proof;
  an expense file end to end through the preview and Confirm; the six-role speed gate) and
  `landing-47-arabic.alone.spec.ts` (the same screens in Arabic at 1440 px and 375 px: right to left, the same
  Western digits, nothing scrolls sideways, no word under 12 px). **8 browser sabotages**
  (`tests/sabotage/landing-47-e2e.mjs`).

## Verification (this landing's head)

Run on the final tree, on the builder's machine (a cloud container), before the push:

| Check | Result |
| --- | --- |
| Base equals `v2/main` (`f158ee80`) before editing and again before the push | yes |
| `pnpm typecheck` · `pnpm lint` · `pnpm format:check` | exit 0 · exit 0 · exit 0 |
| `node scripts/checks/run.mjs` | 19 green |
| `node scripts/db/gen-types.mjs --check` (Supabase CLI 2.118.0) · `registry:sync --check` | matches the migrations · nothing to sync |
| Unit tests (vitest) | 253 files, 1,880 tests, all pass (1,821 at Landing 46; none loosened) |
| SQL suite, a fresh `v2_test` from zero, plain Postgres 16 | 389 passed, 0 failed (381 at Landing 46) |
| SQL suite on the local Supabase stack (Postgres 17) | 389 passed, 0 failed |
| `supabase db advisors --local --type all --level warn` | no issues found |
| `UNI-02` (the Overview equals the unified Ledger totals) · `UNI-07` (the tab equals the page's line) · `FND-09` | green · green · green |
| `pnpm build` | exit 0 |
| Browser suite, whole, all three projects, on the final build | 612 passed, 10 skipped by design, 0 failed (23 minutes) |
| Money gaps | 0 in every comparison (limit < 1 SAR): the Ledger's totals equal the kept statement's, figure for figure (`DTY-01`); a contract's periods equal the Ledger for the same organisation and term (`CPY-01`) |
| Sabotage — every SQL plant | 619 plants, all red as they must be (the 31 new ones among them) |
| Sabotage — every unit, check and lint plant | 839 plants, 843 target runs, 0 failures; the 29 Landing 47 unit plants run again after the last change, all red |
| Sabotage — browser, this landing's plants | 8 plants, all red as they must be |

Said plainly:

- **Not run on this machine:** the browser sabotage plants of earlier landings (CI runs every one).
- The two full sabotage sweeps each ended with the runner's notice "the tree was not restored", naming files the
  builder was editing while the sweep ran (the row marks made faster; the agreement card's dash; the Arabic spec) —
  not a plant left behind. Every plant line is red; the 31 new SQL plants and the 29 new unit plants were run again
  on the finished, clean tree: 0 failures, clean exit.
- One browser plant was first red for the wrong reason (it did not compile) and was rewritten; one SQL plant's
  expected words were corrected to the assertion that really fails first.
- The live site could not be opened from here (see "Live checks").

**Speed** — limit 3 s local (8 s live). On made-up data larger than live (60 organisations, 600 invoices recorded
here, 6,000 imported rows of which 1,000 not paid; local Postgres 16, warm, fresh statistics), in milliseconds:

| Read | Before this landing | With Landing 47 |
| --- | --- | --- |
| Unified Ledger, the year (2,000 listed rows) | 305–335 | 380–390 (the marks add about 70) |
| Unified Ledger, one organisation | about 135 | about 145 (the marks add 8) |
| Finance page figures | 94–96 | 94–96 (untouched) |
| "Does Finance agree with itself?" | new | 395–410 |
| "Outstanding and how old" | new | 285 (postpaid) · 165 (every deal type) · 180 (one organisation) |
| "Held — to tie" | new | 285–295 |
| Expense preview, 200 transactions of 3 lines | new | 42 |

In the browser, per role, the four reads together (limit 3,000 ms):

| Role | Ledger | Agreement | Ageing | Held | Total |
| --- | --- | --- | --- | --- | --- |
| Admin | 99 | 100 | 44 | 50 | 293 |
| Head | 72 | 136 | 80 | 31 | 319 |
| Manager | 113 | 129 | 45 | 49 | 336 |
| Member | 90 | 201 | 40 | 37 | 368 |
| Viewer | 80 | 145 | 38 | 32 | 295 |
| No role | refused | refused | refused | refused | — |

The three new cards wait their turn after the page's figures, so the top of the Finance page is as fast as it was.

**Sweep** — the Landing 32 sweep (PC 1,440 px and phone 375 px, English and Arabic, six roles) ran inside the
browser suite and is green with the three new cards on the page. This landing's own Arabic spec checks the new
screens at both widths: right to left, the same Western digits as in English, nothing scrolls sideways, no word
under 12 px. The builder also looked at the pictures of each new card, wide and narrow, in Arabic.

**Live baselines to hold** — Finance YTD 8,550 / 870 / 3,480, Provisional 4,200. By construction no figure can move:
the counted statement is kept word for word and the new reads are beside it. To confirm on the live page after the
deploy.

Where it was run: a cloud container; local Postgres 16 for the plain SQL suite (CI uses 17) and the local Supabase
stack (Postgres 17) for the types, the advisors, the second SQL run and the browser tests.

## CI run 1633 — one red job, and its fix (third commit, tests only)

The first CI run on this work was red in one job: an older browser sabotage,
`finance-aborted-read-overwrites-the-answer`, went red in a neighbouring test and not with the words it names. It was
not run on the builder's machine before the push (the older browser plants were left to CI, as said above).

The cause is in the old test, uncovered by this landing: "going back to a period just seen never leaves a block
stuck on loading" (QA-549) leaned on three fixed waits. With three more cards on the Finance page they stopped
holding — the page was called settled before its lower cards had asked anything, so their reads were still going out
when MTD was pressed; 300 ms later the page had often sent nothing for MTD yet; and the last wait was shorter than
the queue. With no stale answer landing, the plant stayed green (2 runs in 3 on the builder's machine).

The test now waits for the reads themselves: the page is quiet (no read out, no block loading, twice half a second
apart), it is loaded a second time warm, MTD's own reads are seen to be out before going back, and every held read is
answered before the check. No assertion is loosened and no product code changes. Proven on the builder's machine:
the spec 3 runs green on the clean tree; the plant **5 runs of 5 red** with its own words; the five other plants of
that spec red.

## Live checks

- **Done, read-only, on the live database (24 Nov, counts only — nothing was written):** the last applied migration
  is `20261123110000`, the last one in this base, so this landing's three are the only ones the production job
  applies. 5 imported rows, 3 of them with a cost (none has expense keys yet — see "Database"); all 5 carry a DPIN and
  will say "Tax invoice issued"; none has a profit that is not its revenue less its cost, so that check starts
  empty. 148 invoices recorded here, all typed by hand; **no monthly (billing) invoice**, so the A14 refusal meets
  nothing today. No exclusion or merge rule. 25 client-side contracts. One organisation is postpaid-only (its tab
  loses the top-up rows); 36 organisations hold client IDs of more than one kind or with no kind set — their imported
  rows will read "Deal type not set" until the kind is set on the client ID or on the row.
- **Not done — cannot be done from here:** opening the live site. This session's network refuses
  `www.directksab2b.com` (403). The live browser check is Rocky's.

## For Rocky — after it is live (one step at a time)

1. Finance → Year to date. Revenue, Cost and Profit must be what they were before the deploy (8,550 / 870 / 3,480;
   Provisional 4,200 on the spec's baseline).
2. "Does Finance agree with itself?" must say **Agrees**.
3. The Ledger rows: each says a deal type or "Deal type not set"; the five imported rows say "Tax invoice issued".
4. "Outstanding and how old": the Pending invoices are listed with their age. Press "All deal types" once.
5. "Held — to tie": the invoice typed with a partner number in its Client ID box (Landing 38's finding) is listed
   under "No partner matched".
6. Open the postpaid test organisation → Finance tab: no "Topped up" row; the ageing card; "Contract payments" →
   "Show payments" on a contract, then "By quarter".
7. Finance → New invoice: choose a commission, leave the proof empty, press Save — the proof is asked for. (Stop
   there, or save a TEST one with the next named number and record it for the hard delete.)
8. The decisions above: confirm or overrule, most of all 2 and 13.

## Found on the way

- **An imported row with no status word is missing from "Not yet counted"** (Landing 38's list): the list's test for
  "cancelled or void" answers "unknown" for a blank status, so such a row — a transaction from the transaction list
  whose invoice has not arrived — is left off, though "N not confirmed paid" still counts it. Live has no such row
  today (0). **Not changed here**: it sits inside the counted statement this landing keeps word for word. It is a
  two-word fix for its own small landing; the new ageing card and held list already treat a blank status correctly.
- **The first version of the row marks cost more than the Ledger itself** on 2,000 listed rows (about 450 ms). It
  looked each row up one at a time. It now works on the whole list in one pass: about 70 ms.

## Seen, not changed (small; say if you want them)

- The Finance page is now long: three more cards under "Is it counted?". They wait their turn after the figures, so
  the top of the page is as fast as before.
- A row's deal-type chip says what decided it only as a hover title (person · client ID · code · partner).
- On the contract payments list a period with only not-yet-counted invoices shows a total of 0 with the invoices
  marked under it.

## CI runs 1633 and the next — a second red job, and its fix (fourth and fifth commits, tests only)

In both runs shard 5/5 of the browser sabotage job was red on this landing's own plant
`e2e-l47-the-ledger-draws-no-deal-type`: the test went red, but not with the words the plant names. It could not be
made to on the builder's machine — not on a clean database, not after the eleven Finance plants that ran before it,
not with CI's settings.

The cause is the month the test took for itself. The other Finance specs draw a free far-past month from a counter
(`tests/e2e/support/finance-month.ts`, 1960 onward, one step a draw); on a clean database its 26th draw is March 1962,
the month this spec named as its own — and `ownMonth` clears imported rows only, not a typed invoice. In the shard,
enough draws ran first; the typed invoice moved the month's Revenue, and the test stopped at "the month counts the
three rows", before the line the plant breaks.

This spec's three page-wide months are now in 1958, before the counter's range (the fifth commit); the fourth commit
(the Ledger's figures are waited for, not read once) was made before the cause was found and is kept as a harmless
tightening. The same latent clash exists for the months `landing-32-finance-fb.spec.ts` names (1962-05, 1962-08,
1963-02, 1964-03): not touched here — reported.
