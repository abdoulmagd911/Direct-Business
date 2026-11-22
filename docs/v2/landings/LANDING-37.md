# Landing 37 — Finance F-C: a Pending or Draft invoice is seen, and found, before it counts

23 Nov 2026 · base `cc77a03` (Landing 36, live) · target `v2/main` · one push.

Scope: **A6** (uncounted rows in the Ledger, the form's last-saved record — F185, the search by number, the
end-to-end check on invoice 1163000012) **+ A7** (CR-1594-23, the "Custom" period link). Nothing else: no Part B, no
Import, no Initiatives, no My day, no per-member settings.

## In plain words — what is new

1. **The Ledger lists what is not counted yet.** A Pending or Draft invoice (and an imported row that is not
   confirmed paid) is a row of its own under **"Not yet counted (N)"**: its number, its organisation, its day, its
   amount as _not yet counted_, what is _remaining_ on it, and its status word. It is in **no figure**: Revenue, Cost,
   Profit, Received, Remaining, the lines by company and the counted rows are exactly what they were. When the
   invoice is paid it leaves the list and Revenue rises by exactly its amount.
2. **The organisation's Finance tab names the same rows** in its "Not yet counted" card. Its cards do not move.
3. **The search box finds an invoice by its number — counted or not.** A hit says "Not counted yet" when it is not
   fully paid, and opens the Ledger on that invoice's day, at the list it is in.
4. **The New invoice form shows the invoice I saved last** (F185): transaction number, status, created, paid and
   total, read back from the database — at the top of the form, right after a save and every time the form is
   opened again. It is no longer a blank page with no trace of the last save.
5. **"Custom" opens on the first press** (CR-1594-23): the From / To panel appears the moment the tab is pressed,
   in English and in Arabic.

## A6 — the end-to-end check on invoice 1163000012

Read on the live database, read-only, on 22 Nov 2026 (nothing was written there):

| | |
| --- | --- |
| Number | **1163000012** — TEST Alpha, 100 SAR, Pending, created 8 Nov 2026 |
| Recording | Typed in the New invoice form on 8 Nov 2026 at 16:41 Riyadh, by an admin; one logged request (`finance.row_added`); one line; never edited since (version 1) |
| Approval | Nothing on it waits for an approval: no expense (so its cost is empty, never 0), no receipt, no tax invoice, no monthly invoice. Its status is still Pending |
| Counting | **Not counted.** 0 received of 100. It is in no figure. It has been waiting **14 days** (8 → 22 Nov) |
| Company tab | **On no organisation's tab — see the finding below** |
| After this landing | Listed on the Finance page under "Not yet counted" (amount 100, remaining 100, status Pending, "No partner"), found by the search box by its number |

**Finding — why it is on no company tab.** The invoice's Client ID box holds `DK-P-0009`. That is TEST Alpha's
_partner number_, not one of its two client IDs, so Finance matches the invoice to no organisation ("unknown client
ID"). It therefore shows on no organisation's Finance tab, today and after this landing; the Ledger lists it with
"No partner". Putting one of TEST Alpha's real client IDs on the invoice ties it — I did not change it (no live
writes from a build session).

**Duration.** The same check on a made-up twin in the browser test (a 100 SAR Pending invoice typed in the form):
saved and read back on the form in **155 ms** on this machine. The live duration could not be measured from
here (see "Live checks").

**Totals unchanged — the proof, as differences.**

- Database test `FNC-01`: with a Pending, a Draft and an unpaid imported row added, every counted total, the counted
  rows, the invoices, the lines by company and the Finance page's own figures are **equal** to the read taken
  before them (difference 0); after a part payment still 0; once paid, Revenue rises by **exactly 100**.
- Browser test 1: Revenue, Cost, Profit, Received, Remaining on the Ledger strip and the top Revenue card:
  after − before = **0** each; once paid, **+100**.
- On live this cannot move anything by construction: the counted part of the Ledger read is the statement of
  20261122090200, word for word; the list is a new, separate part of the answer. Read today for comparison after
  the deploy (year to date): **68 counted units / 350,750 SAR** recorded here and **4 / 1,900 SAR** imported.
  Expected difference after the deploy: 0.

**What the live Ledger will list after the deploy** (worked out read-only with the landing's own rule, year to
date): **11 documents, 43,700 SAR** — 10 recorded here (6 Pending, 4 Draft) and 1 imported ("Waiting for
Issuing"); 2 of them with no organisation. Both test invoices are among them: 1163000012 and TEST-20261113-01.

**TEST-20261113-01 and "Nothing matches".** The invoice was always in the database, and the database's search
always answered it. The search box never drew invoice hits at all — it read organisations, people, tasks and codes
from the answer and dropped the invoices. That is fixed; the search also finds imported rows now (it read only the
invoices recorded here).

**New test invoices.** I created **none on live**. The next named number after 1163000012 is **1163000013**; it is
not used, so there is nothing to hard-delete. The tests type made-up numbers into throw-away databases only
(`9932……`, `9903……`, `MADEUP-…`, `FC-…`).

## A7 — CR-1594-23, the "Custom" period link

**I could not re-press it on live from here** — this session's network refuses `www.directksab2b.com` (403), as in
Landings 34 and 35, and holds no TEST Admin sign-in. So the item is **not** closed as "not reproduced".

What I did instead, on a production build of this head:

- Read the cause in the code: the From / To panel was drawn only after the server had answered the new address.
  On a quick answer one press is enough; on a slow answer the first press shows nothing, and a second press is made.
- Reproduced exactly that: with the server's answer held back for 4 seconds, the old code shows no panel after one
  press (the regression test is red on it — sabotage `e2e-custom-period-waits-for-the-server`).
- **Fixed it in the same PeriodSwitch**: the pressed tab is lit and Custom's panel is open at once; the address
  stays in charge (when it answers, or on Back, the tabs follow it).
- Regression tests: unit (first press opens the panel, EN and AR) and browser (one press, answer held 4 s: panel
  open in 136 ms in English; the same in Arabic).

## Database — forward-only

| Migration | What |
| --- | --- |
| `20261123090000_finance_fc_not_yet_counted_search_last_saved.sql` | `finance.unified_ledger` (same signature and grants, `jit = off` kept): the answer gains `not_yet_counted` (the rows) and two totals, `not_yet_counted_units` and `not_yet_counted_amount`; everything else is the previous statement unchanged. `finance.search_numbers` (same signature): also finds imported rows; every hit says its status, what it means for counting, and its source. New pair `finance.last_saved()` / `api.finance_last_saved()` |

`grants.expected` gains the new pair — `api.finance_last_saved()` and `finance.last_saved()`, both for
`authenticated`. `database.types.ts` is the generator's output (CLI 2.118.0; one new line). No table, no column,
no data change: nothing is written or back-filled by this migration.

## Decisions taken (please confirm or overrule)

1. **What "not yet counted" lists:** a document that is not fully paid and is not cancelled or void. A cancelled
   one waits for nothing and is not listed. An excluded one stays under "Not counted", as before.
2. **Apart, never mixed:** the rows are a list of their own; they are never among the counted rows and never in the
   exported file (the file is the counted view).
3. **The two amounts on a row:** _Not yet counted_ is the revenue that would count; _Remaining_ is the total less
   what has arrived. For an imported row the receipts are not read, so its remaining is its amount.
4. **Size:** the list is cut at 1,000 rows per read, like the counted rows; a phone shows five and "See all".
5. **A search hit opens the Ledger** on the invoice's own day — there is no page for a single invoice.
6. **The form's "same number twice" check is as before:** an imported row with the same number refuses nothing
   (it is the same document arriving through the other door, counted once).
7. **F185, as I read it:** the saved record is shown at the top of the form (after a save, and on reopening); the
   fields stay empty for the next invoice. **Save** still returns to the Finance page; **Save + new** stays. It is
   the reader's own last save, never a colleague's, and an invoice taken back by Undo is no longer it. Say if
   "reopening shows the saved record" should instead mean the fields come back filled.
8. **The last-saved read is for Full on Finance** — the same level the form itself needs.
9. **Direct link:** an imported row carries the link its file gave and shows "Open in Direct". A row recorded here
   has no stored link, so none is shown — never an invented one.
10. **A7:** every period tab is lit on its first press, not only Custom.
11. **Arabic** (please glance): Not yet counted «لم تُحتسب بعد», Total not yet counted «إجمالي ما لم يُحتسب
    بعد», Not counted until it is paid «لا تُحتسب حتى تُدفع», Invoices «الفواتير», Open in Direct «فتح في
    دايركت».

## Rules held

Revenue, Cost, Profit only — no VAT anywhere. A missing cost, paid day or total is empty (a dash), never 0. Only
fully-paid statuses count. Transaction number first, invoice number under it. A Direct link where the record
carries one. No pushed migration edited. Imported rows are read at read time, never written into `finance.*`.

## Tests

- **SQL (373 → 376):** `FNC-01` the list, and no total moves · `FNC-02` the search finds a Draft, a Pending and an
  unpaid imported row by number; one document, one hit; no Finance level, no invoice · `FNC-03` the last-saved read:
  the reader's own, not a colleague's, not an undone one, refused below Full. **7 SQL sabotages**, each red as
  designed.
- **Unit (1,757 → 1,793):** the Ledger's list and the mapper · the Custom tab's first press (EN, AR) · the
  form's saved record · the search box's invoice hits · the organisation tab's card. **13 unit sabotages**
  (`tests/sabotage/landing-37-finance.mjs`), each red as designed.
- **Browser:** `landing-37-finance-fc.spec.ts` (6 tests: the 100 SAR Pending invoice end to end; a Draft found by
  the search; the organisation's tab; Custom on the first press; the phone; the speed gate for six roles) and
  `landing-37-arabic.alone.spec.ts` (Custom, the list and the saved record in Arabic, 1440 px and 375 px).
  **9 browser sabotages** (`tests/sabotage/landing-37-e2e.mjs`).

## Verification (this landing's head)

Run on the final tree, on this machine, before the push:

| Check | Result |
| --- | --- |
| Base equals the live head `cc77a03` before editing and again before the push | yes |
| `pnpm typecheck` · `pnpm lint` · `pnpm format:check` | exit 0 · exit 0 · exit 0 |
| `node scripts/checks/run.mjs` | 19 green |
| `node scripts/db/gen-types.mjs --check` (Supabase CLI 2.118.0) | matches the migrations |
| Unit tests (vitest) | 246 files, 1,793 tests, all pass (1,757 at Landing 36; none loosened) |
| SQL suite, a fresh `v2_test` from zero | 376 passed, 0 failed (373 at Landing 36) |
| `pnpm build` (inside the browser run) | exit 0 |
| Browser suite, whole, fresh database — all three projects | 597 passed, 11 skipped by design, 0 failed |
| Money gaps | 0 in every comparison (limit < 1 SAR) |
| Sabotage — every SQL plant | 581 plants, 584 target runs, all red as designed (the 7 new ones among them) |
| Sabotage — every unit, check and lint plant | 802 plants, 806 target runs, 0 failures (the 13 new ones among them) |
| Sabotage — browser, this landing's plants | 9 plants, 10 target runs, all red as designed (one test was first red for the wrong reason — leftovers of earlier runs on the same database — and was fixed to read its own organisation only) |

Not run on this machine: the other browser sabotage plants (CI runs every one). Where it was run: a cloud
container; local Postgres 16 for the plain SQL suite (CI uses 17) and the local Supabase stack (Postgres 17) for
the types and the browser tests.

**Speed** — limit 3 s local (8 s live). On made-up data of live-like shape but larger (60 organisations, 600
invoices recorded here, 6,000 imported rows, 1,080 documents waiting), local Postgres 16, warm, in milliseconds,
the read before this landing → with it:

| Read | Before | With Landing 37 |
| --- | --- | --- |
| Unified Ledger, the year | 150–190 | 185–230 |
| Unified Ledger, one organisation | 83–95 | 96–104 |
| Finance page figures | 65–75 | 65–75 |
| "Is it counted?" | 63–74 | 63–73 |
| Search by number (Finance) | — (recorded here only) | 27–35 |
| Top search | — | 33–55 |
| Last saved | new | 5 |

The first version of the list cost about 0.7 s more on that data (it compared the waiting rows with the counted
ones row by row). It is now one sorted pass over both lists, with no join, so its cost grows with the number of
rows and never with rows times rows. In the browser, per role, the four Finance
reads together (limit 3,000 ms):

| Role | Ledger | Finance figures | Is it counted? | Search | Total |
| --- | --- | --- | --- | --- | --- |
| Admin | 50 | 41 | 47 | 30 | 168 |
| Head | 102 | 35 | 34 | 35 | 206 |
| Manager | 67 | 25 | 27 | 25 | 144 |
| Member | 59 | 31 | 35 | 42 | 167 |
| Viewer | 47 | 43 | 63 | 43 | 196 |
| No role | refused | refused | refused | refused | — |

The live figure (limit 8 s) could not be measured from here.

## Live checks

- **Done, read-only, on the live database (22 Nov):** the facts of 1163000012 and TEST-20261113-01 above; the
  counted sums to hold; what the list will show; the last applied migration on live is `20261122150000`, the last
  one in this base, so this landing's one migration is the only one the production job will apply.
- **Not done — cannot be done from here:** opening the live site, pressing "Custom" as TEST Admin, and measuring
  the live duration. The session's network policy refuses the site (403) and it holds no sign-in.

## For the owner — after it is live (one step at a time)

1. Open Finance → Year to date. Read Revenue, Cost and Profit: they must be what they were before the deploy.
2. Scroll to "Not yet counted": 11 rows, 43,700 SAR; 1163000012 and TEST-20261113-01 are among them.
3. Press "Custom" **once**, in English and in Arabic: the From / To panel opens at once. Tell me the result and I
   close CR-1594-23 with it.
4. Type `TEST-20261113-01` in the search box: it is found, marked "Not counted yet".
5. Open New invoice: the invoice you saved last is shown at the top.
6. If 1163000012 should sit on TEST Alpha's tab, replace `DK-P-0009` in its Client ID box with one of TEST
   Alpha's client IDs.

## Found on the way

- **The search box never drew an invoice** — fixed (above).
- **1163000012 carries a partner number in its Client ID box** — reported (above), not changed.
- **The waiting list was slow at volume in its first version** — fixed before the push (above).

## Seen, not changed (small; say if you want them)

- The Ledger's counts line still says "Not fully paid imports: N". It counts every unpaid imported row of the
  period, cancelled ones included and whatever the filters; the new list is the careful one. The two can differ.
- On a search hit the Ledger opens on the invoice's day; the row is not highlighted.
- The status word on a row is the invoice's own (from Payments, English in Arabic too).
