# Rebuild handover 2: the second builder's work

Written 28 Sep 2026 on the owner's order of 14:05 (stop, write a blueprint, rebuild as one linked system). **Nothing below
is live.** I applied no database change, merged nothing after the stop, and left every PR open as a draft. There is no real
data in any of it: the tests use made-up IDs, names and amounts (rule 7).

## 1. Proven, and worth porting

Each item below is on a branch in this repo. The tests named beside it passed on that branch.

| What | Where (branch @ commit, PR) | Proof |
|---|---|---|
| **Readers for the three Payments cost files**: Transaction Expense Export, Expense Invoice Export, Revenue Report | `js/121-cost-import.js`, `scripts/sql/cost-import.sql`, `cost-fallback.sql` (and their rollbacks), `scripts/sql/checks/cost-acceptance.sql` · `claude/clever-franklin-vukl22-cost` @ f7dde2f · #58 | SQL COST-01…11 (164/164 in the suite) · `probe-cost-import` 15/15 with sabotage · two full batteries green except the 4 known network reds. A third battery on f7dde2f was stopped by the order. |
| **Readers for the corporate clients and promo codes lists**, built to the real 27 Sep header rows | `js/122-payments-lists.js`, `scripts/sql/clients-promo-import.sql` · `…-clients` @ fea129e · #61 | SQL CP-01…07 (171/171) · `probe-payments-lists` 9/9; sabotages A–E each caught |
| Company identifiers and live matching (**work in progress**) | `scripts/sql/company-identifiers.sql`, `js/123-company-identifiers.js` · `…-ident` @ 2a89240 · #65 | SQL IDN-01…14 (185/185) · `probe-company-identifiers` 1–12, 14 and 15 green; check 13 is red (a screen repaint, not the data) |
| Plan for the KPI engine (a plan only, no code) | `docs/reference/d27-kpi-engine.md` · `…-kpi` @ d2413f9 · #63 | — |

**Column maps.** Headers are compared after removing spaces, `_ - . : ( ) /` and case.
- **Transaction Expense Export** (the cost): Invoice# · Amount (SAR) · Expense Type · Status · Created At · Submission Date ·
  Approval/Rejection Date · Merchant · ID Reference · Submitter · Approver/Rejector. The line key is ref + expense type +
  created-at. Cost is the sum of the **Approved** lines only. Pending, Under Review, Cancelled and Rejected never count.
- **Expense Invoice Export**: Invoice # / Ref # · Request Number · Invoice Product · Invoice Amount · Invoice Status ·
  Invoice Type · Expense Assignments · Overdue · Invoice Created By · Invoice Created At.
- **Revenue Report**: Invoice # / Ref # and **Total Expense Amount only**. That figure is the submitted expenses, shown as a
  flagged estimate until approved lines arrive. Its revenue and VAT columns are never read, because they overstate profit (M1).
- **Corporate clients** (29 columns, exact): ID · Legal Name · Legal Name (Arabic) · Trading Name · Customer Type · Client
  Payment Configuration · Payment Mode · Billing Cycle · Tender No. · Registration Numbers · Has VAT Number · ID Type ·
  ID Number · VAT Number · Contact Information · Contact Full Name · Contact Email · Contact Phone · Credit Limit · Credit
  Term Days · Block On Overdue · Tender Amount · Expected COGS · Expected GP · Pricing Setting · Created By · Updated By ·
  Created At · Updated At.
- **Promo codes** (13 columns, exact): Code · Promocode Type · Client Name · Type · Discount · Product · Status · Total Sales
  · Total Discount · Valid From · Valid To · Created At · Created By. A new code needs a readable Type (percentage or fixed),
  or it is left out. Client Name is kept only as a suggestion.

**Big files.** The full cost export is about 258,000 rows (23 MB). The page reads a CSV in 1 MB slices and an Excel file in
a background worker that sends 5,000 rows at a time, so the tab never freezes. It writes in batches of about 1,500 lines,
and a reference's lines are never split across two batches. If an import stops partway, what was written stays, and
dropping the same files again finishes the rest.

**Sabotage method (keep it).** Every browser test has a `SABOTAGE=X` switch. It swaps in a deliberately broken copy of one
app file, served from the test's own intercepted request, and the named checks must go red. A test that never fails when
the code is broken proves nothing. The SQL suite does the same with `TM_AFTER` (apply a broken migration and watch the
matching tests fail). Harness: `scripts/qa/phase3/run.sh` (local Postgres) and `scripts/qa/mock-supabase.mjs` (the stand-in).

**Go-live reset list** (added to `scripts/sql/golive-reset.sql`): `finance_expense_lines`, `finance_invoice_lines`,
`finance_payments_facts`, `payments_clients`. The identifiers branch still needs `company_identifiers` and
`company_name_aliases` added.

## 2. What the new design must respect

1. **Import rules** (owner, Drive 04 §5): any file, in any order, at any time. The newer export wins. The export time is
   read from the file name (`2026-09-27_18-49-34…`) in Riyadh time (D20). An older file only fills blanks, a blank never
   wipes a value, and the same file twice changes nothing. Payments' dates are day first ("30/07/2026 03:31:59 PM") or
   Excel serial numbers.
2. **The key** is Invoice Reference # (the Payments reference = our invoice number). Invoice Number is the DPIN (the
   ZATCA tax-invoice number). A reference with no money row is **held and listed**. It is never stored and never becomes
   an invoice.
3. **Cost** = approved expenses only, and it stays empty until one arrives (D21, M1). An estimate is always flagged and
   ranked: submitted expenses first, then pass-through lines (D23). Never estimate a commission, a hand-entered row, or a
   reference that has several money rows.
4. **Matching a company is a live view, never a stamp** (owner, 28 Sep). Identifiers are typed, and each value belongs to
   one company only (the database enforces it). The order is client ID → VAT/CR → discount code (inside its dates) → email
   → phone → name. The first level that finds anything decides. Two companies at the same level means **Needs a decision**,
   never a guess.
   - A staff email (`@directksa.…`), the dummy test VAT 311111111111113, and any value under an exclusion rule are never
     identifiers.
   - A removed identifier comes back only while no other company holds it.
5. **Name comparison**: fold Arabic letter forms (أإآٱ→ا, ىئ→ي, ة→ه, ؤ→و), convert Arabic-Indic digits, remove diacritics
   and tatweel, join dotted letters (L.L.C. = LLC), and drop form words (شركة, مؤسسة, company, co, ltd, llc…). Keep
   **one** copy of this logic, used by the database, the page and the test stand-in. Here it had to be written three
   times and kept identical by hand.
6. **Database traps.**
   - A generated column is not recalculated when its function changes. Rebuild it instead.
   - `create or replace view` can only add columns at the end, and a function's return type is fixed.
   - Row-level security makes a refused delete succeed silently with 0 rows. Revoke delete, and test for "permission
     denied".
7. **Two builders clashed three times**: over decision numbers (D24–D26, twice) and over the file number js/120.
   Hand out ranges before work starts.
8. **Screen traps.**
   - Repaint a block only when its HTML changes, or a click lands on a button that is being replaced.
   - A redraw of the whole Finance page removes a block that was added separately (the red check 13 above).
   - The stand-in gives new companies non-uuid ids (the test switch `window.__v117AnyId`).
9. **Tests.**
   - Give each probe its own ports.
   - Don't run probes while the battery runs.
   - A live read-only walk must also block `log_page_denied`.
   - Whether this environment can reach the live site varies. Test with curl before blaming the code.
