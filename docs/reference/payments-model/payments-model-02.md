## ROUND 11 — both open items closed by Abdulrahman; Phase 1 built (2026-08-21)

**Tender display — answered, no exception.** *"If you mean that this series under show on the
client page, no... the client here is the whole company... for the finance reports and page
we are building, it should show one company only, and the rest under it. So we can clarify if
this invoice is tender or prepaid or postpaid."* Settles Round 10's open question in full:
- **Clients page = identity only, full stop.** Tender amount, Expected COGS, Expected GP —
  and, Abdulrahman confirmed unprompted, **no other money either**: no revenue, cost, profit,
  deal value, wallet or outstanding figure anywhere on it. The page is the company record
  (identity, agreement, documents); profiles sit under it as identity rows — type badge +
  Direct client ID + payment terms — never a figure. This is stricter than Phase 2's original
  design (BLUEPRINT.md), which had put a billed/received/outstanding/cost/profit/margin/credit
  strip on the client card — that strip is now removed from the Clients page as a direct
  consequence of this ruling, not a separate decision.
- **Finance page = company is the primary row, profiles nest under it, every row labelled.**
  "One company only, and the rest under it" — so the company-grouped view (already the default
  in the Spec 2 planning) is not merely the default, it is the shape; a profile-level
  drill-down may stay as a secondary view if cheap. Every invoice/transaction row must carry a
  visible prepaid/postpaid/tender label, in every view and every export — not optional.

**Overdue aging threshold — answered: mirror, never invent.** Abdulrahman, from the live
Corporate Expenses page: it already has its own **Overdue column** — a live countdown while a
deadline is running ("8 hours left" etc.) and a breached flag once it passes ("1 Overdue"; 11
of 72 corporate expense invoices showed it live). So Direct Payments already computes both the
deadline and the breach — Round 8's "app-side aging judgement" framing is **wrong and
retracted**. The rule, same principle as Expense Status `Ready` and "Direct Payments stays the
system of record": **where the source already computes a state, we mirror it, we never
recompute it.**
1. Import the overdue flag as a mirrored field — never derive it from a days-since-created rule
   of our own.
2. **No hardcoded N-day constant, anywhere.** An invented threshold will silently disagree with
   what Direct Payments shows the same person on the same invoice — exactly the class of bug
   that erodes trust in a finance page.
3. Until the import path for this field exists, model it and leave it **null** — null means
   "not yet mirrored," never "not overdue." Do not default it to false/zero.
4. The countdown text is presentation, not data. If the deadline timestamp itself isn't in the
   export, mirror the boolean flag alone and show it without a countdown rather than
   recomputing one.

**Both items Round 8/9/10 left open are now closed.** Phase 1 (Company/Client-Profile schema,
linking, Clients page rebuild, Corporate Clients import) was built the same session — see
`docs/BACKLOG.md` for the schema shape, the real import (24 profiles / 19 companies from the
verified Corporate Clients registry, Takamol excluded), and what got removed from the Clients
page to match this ruling.

## ROUND 12 — Phase 2: the Ledger rebuilt on the corrected model (2026-08-21)

Owner (via the reviewer's independent-verification pass) authorised Phase 2 the same session,
with explicit guardrails: stage it alongside `finance_invoices` rather than rip it out; company
is the shape, not a toggle; confirmed-only in the KPI strip; Overdue stays a mirror; production
promotion stays Abdulrahman's alone.

**Schema, staged, not a replacement.** Three new tables (migration
`finance_transactions_ledger_rebuild`): `finance_transactions` (one row per Corporate
Transaction — Round 2's "a transaction IS an invoice record, one row, invoice number attaches
once issued" — `business_id`+`client_profile_id` FK, `amount_sar` = revenue per Round 5,
`cost_confirmed_sar` kept in sync by a database trigger off its own approved expense lines,
`cost_estimate_sar` for the pending-row "est." display only, `overdue` nullable and never
defaulted to false); `finance_cogs_expenses` (mirrors the COGs Report, one row per expense
line, `cog_approved`/`cog_under_review`/etc.); `payment_receipts` (receipt-level, `allocations`
jsonb holding the invoice/transaction split rather than a fourth table). `finance_invoices`
itself is untouched — Performance, Clients & collections, Report Builder and Expenses all still
read it exactly as before; only the Ledger tab now points at the new tables.

**The Ledger tab (`rLedger()` in `js/16-finance-ledger.js`) is now company-grouped, not
invoice-grouped.** Each company (`businesses` row) is its own section with a confirmed-only
rev/cost subtotal; every transaction row under it carries a visible Prepaid/Postpaid/Tender
badge plus the Direct client ID, sourced from `client_profiles` — never invented, never a
free-text toggle. The CSV export carries the same company + profile-type columns on every row.
Stage is Round 8's two-field derivation (`invoice_no` set → Invoiced; else `expense_status`
ready/pending) plus Round 11's Overdue mirror layered on top when `overdue===true`. The KPI
strip (Confirmed revenue/cost/profit) only ever sums rows that are Ready or Invoiced — a
Pending row shows its `cost_estimate_sar` at row level, muted and tagged "est.", and is excluded
from every total, exactly as Round 7 specifies. No VAT column, no VAT anywhere.

**Demo data, kept out of the real 19 companies on purpose.** The 11 synthetic `world30` test
clients (not the real Corporate Clients import from Phase 1) got their own `client_profiles`
rows and 33 `finance_transactions` — 28 promoted from their existing `finance_invoices` rows
(Issued stage, `cost_confirmed_sar` backed by real `cog_approved` lines the trigger sums, not a
copied number) plus 5 new rows built to exercise Pending/Ready/Overdue and all three profile
types. Real company data and demo financial data are kept in separate rows on purpose, same
principle as Phase 1's import decision — a real company's identity should never carry invented
transaction amounts.

**Verified in the harness, EN+AR, screenshots:** company grouping, profile badges, stage badges,
the confirmed-only KPI (hand-checked: 42,000+9,500 revenue / 35,000+7,600 cost from only the
Ready+Invoiced rows, the Pending and Overdue rows correctly excluded), the "est." tag, zero VAT
mentions, zero console errors, Overview tab unaffected (still reading `finance_invoices`).
`check-structure.mjs` clean.

**Known small rough edge, not fixed this round:** the "Open in Finance ledger ↗" link on a
non-client lead's Finance snapshot (`js/38-client-card.js`) still sets the old `FIN.f.client`
filter, which the new Ledger no longer reads — it navigates to the tab correctly but doesn't
pre-filter to that company. The "Top clients" drill-down from Clients & Collections (which DOES
stay on `finance_invoices`) was fixed to carry across (`finClient()` now also sets
`TXN.f.business`). Low-traffic path; left for a follow-up rather than widening this pass.

## ROUND 13 — the COGs Report holds zero rows; Corporate Expenses is THE cost source, not a fallback (2026-08-21)

Closes the oldest open item in the project. The reviewer worked the COGs Report's own filter UI
directly rather than waiting on a URL: **the working parameters are `status_key[]=cog_approved`
("Cogs - Approved" in the UI) and `submission_range`/`approval_range`, both
`YYYY-MM-DD to YYYY-MM-DD`.** Full example:
`/en/admin/stats/cog-report?status_key[]=cog_approved&submission_range=2025-01-01 to 2026-12-31`.
**Every combination tested — status alone, status + a two-year range, either date range alone
over 2024–2026 — returned "Total Results: 0 / There are no records to show."** The page renders
its full column set correctly and the server is healthy (other reports return data), so this is
neither a filter-parameter problem nor a timeout: **the COGs Report itself is unpopulated.**

**Consequences, settled, not tentative:**
1. The COGs Report is not the primary cost-import path and "cost is pending until COGs lands" is
   not a temporary state — on current evidence it will not resolve on its own.
2. **Corporate Expenses (per-invoice "Total Submitted Expenses" + the per-line statuses from
   View Assignments) is now THE verified cost source, not a fallback.** Everything Round 7
   verified 6-for-6 stands and is now the only proven path — gated on Expense Status = Ready at
   the transaction level for confirmed cost, exactly as Round 8 already specifies.
3. **`finance_cogs_expenses` (Phase 2's schema) stays import-ready for a COGs feed, but nothing
   depends on it arriving.** Corrected the same session: the status vocabulary was originally
   modelled on the COGs Report's own values (`cog_approved` etc.) — normalised to a
   source-agnostic `pending/under_review/approved/rejected/cancelled`, with a new
   `source_system` column (`corporate_expenses` default, `cogs_report` still accepted) so a row
   records which literal screen it came from. `finance_transactions.cost_confirmed_sar` is
   unaffected in shape — still the trigger-maintained sum of that transaction's `approved` lines
   — only the vocabulary changed, and existing rows/the sync trigger were migrated in place.
4. Worth Abdulrahman raising independently with Direct's developers: their own COGs Report
   returns nothing for any filter or date range — either a broken report or a feature nobody
   populates. Useful for him to know regardless of this app.

**Nothing here changes Phase 2's guardrails — it simplifies them: one verified cost source, not
two competing ones.** The Ledger's stage/confirmed-cost logic (`js/16-finance-ledger.js`) reads
`expense_status` and the trigger-synced `cost_confirmed_sar`, never queries `finance_cogs_expenses`
directly, so no UI code changed — only the underlying expense-line vocabulary and its
provenance column.

## ROUND 14 — Corporate Transactions/Invoices carry NO client field at all; the exclusion
design's durable shape (2026-08-21)

Checked directly against the live views (not inferred): **Corporate Transactions**
(`/en/admin/corporate_clients/transactions`, 150 rows) columns are exactly Receipt Ref. ·
Product · Amount (SAR) · Invoice Issuing · Created At · Expense Status. **Corporate Invoices**
(`/en/admin/corporate_clients/invoices`, 63 rows) columns are exactly Invoice Number · Issue
Date · Due Date · Amount (SAR) · Status. **Neither carries a client ID or a client name** — on
the Transactions screen the client is one of four *filters* ("Corporate Client", alongside
Product/Creation Range/Receipt ID), never a field on the row.

**Consequence for Spec 4 item 2's `matchNames` bridge: it only works on files that actually
carry a customer-name column.** Today's live importer (`js/41-money-in.js`, the 5551 "Invoice
Export" shape) does — `Customer Name` is a real per-row column there, so the Round 13/Spec-4
fix is correct and unaffected for that format. But if an importer for Corporate
Transactions/Invoices is ever built, name-matching (or ID-matching) against the row itself is
structurally impossible — the field doesn't exist to match against. Checked that this is not a
live bug today: both `js/41`'s and the legacy CSV path's header checks fail closed on an
unrecognised format (refuse the whole file with an explicit message) rather than importing rows
with exclusions silently skipped — so a dropped Corporate Transactions file is refused outright
today, not silently passed through clean.

**The durable shape for when this gets built (item 4 territory, not built yet):** exclusion
should resolve against the Corporate Clients registry — the one file confirmed to carry a real
ID column (ids seen 1–96, Takamol at id 7, matching the Phase 1 import and the Spec 4 seed
exactly) — via `client_profiles.direct_client_id`, not by each import file trying to match a
name or ID it may not contain. A transaction/invoice row should inherit its exclusion through
whatever join the importer builds to reach its `client_profile_id` (the same FK
`finance_transactions` already carries, Phase 2), not through per-file text matching. **Explicit
design rule for any future importer of a client-column-less file:** if no client identifier of
any kind is present on the row, say so loudly in the preview ("this file carries no client
column; exclusion rules were not applied to its N rows") — zero-because-clean and
zero-because-inapplicable must never render identically.

**Open question for Abdulrahman, not guessed at:** whether Corporate Transactions/Invoices'
"Filter & Download Excel" output carries more columns than the on-screen table (a client column
could be Excel-only) — checkable in one click from his side; not downloaded here on purpose.

## ROUND 15 — the real export catalogue: eleven types, not six; COGs confirmed empty on a
second independent line of evidence (2026-08-21)

Direct Payments has an Excel Exports registry (`/en/admin/excel-exports`) — every export ever
run, with id/name/filename/**row count**/status/timestamps, 100 rows of history. Not seen before
this round (an earlier read of this page was a false negative — checked before it finished
rendering, same proxy-check family as this session's other corrections).

**The catalogue, by row count, with run count:** Invoice Export 544,541 (66 runs) · Revenue
Report Export 72,875 (1) · Transaction Expense Export 70,682 (2) · Expense Export 70,679 (4) ·
Expense Invoice Export 52,445 (4) · GMV Transaction Breakdown 20,889 (3) · Corporate Client
Dashboard Invoices Export 44 (8) · Corporate Clients Export 43 (5) · Promo Code Invoice Export
27 (3) · Expense GMV Export 13 (2) · **COG Report Export 0 rows, both times it was run (2).**

**Two consequences:**
1. **COGs-empty is now settled on two independent lines of evidence** — Round 13's live filter
   test (every combination returned zero) and this registry (the export itself has produced
   zero rows on both actual runs). Not a filter-parameter or session artefact; the report is
   genuinely empty. Corporate Expenses (View Assignments) stays the one verified cost source
   (Round 13) — unchanged by this round, just more certain.
2. **The expense ledger exists in bulk, just never needed the Corporate Expenses UI as its
   long-term source.** Transaction Expense Export and Expense Export each carry ~70,000 rows —
   real bulk exports of exactly the data Round 6/7/13 have been reasoning about one screen at a
   time. Column sets are **not yet verified** (the registry lists filenames and row counts only,
   not headers, and downloading a file was deliberately not done this round) — Transaction
   Expense Export is a strong-hint name for the transaction↔expense relationship the cost model
   needs, not a confirmed mapping.

**For the future import engine (item 4 territory — not being built yet):** the real catalogue
is **eleven export types**, not the six originally assumed for the column-signature registry.
Design against what exists, not the earlier assumption. Invoice Export is the workhorse at
544,541 rows / 66 runs — any bulk importer must stream or chunk, never assume a small file.
Revenue Report Export (72,875 rows, never modelled before) may be the cleanest revenue source
and is worth a header check too.

**Standing rule, owner-set:** do not ask Abdulrahman to open or check anything that can be
tested first — verify from the reachable UI, then report, never guess. Column-set verification
for Transaction Expense Export / Expense Export / Revenue Report Export is next, from the
reachable UI, without downloading files, before any import code is written against them.
