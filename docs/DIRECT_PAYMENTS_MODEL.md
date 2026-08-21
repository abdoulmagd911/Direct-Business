# Direct Payments — the REAL data model (verified from the live system)

> Built 2026-08-12 from screenshots of payments.directksa.com ("Direct Desk") that the
> owner captured while signed in, plus real URLs. This supersedes guesses. More detail
> (Excel exports, promo screens) arrives via the Drive folder `Direct-Payments-Capture-2026-08`.
> **No real client data goes into this public repo — structure only.**

## The chain, confirmed end to end

**TRANSACTION → INVOICE → SERVICE LINES (fee pairs) → PAYMENT RECEIPTS**

Proof pair from the real system: transaction `1163601785` ("Direct Flights, Direct Hotels,
Direct Packages", 507,800.00 SAR, status *Issued → 1163605527*) became invoice reference
`1163605527` / **DPIN-284070**, whose six lines sum to exactly 507,800.00 SAR.

### 1 · Transaction (per corporate client)
| Field seen | Notes |
|---|---|
| Receipt ref | e.g. `1163735256` — its own number series |
| Product(s) | one or SEVERAL: "Direct Hotels, Direct Packages, Direct Support" |
| Amount (SAR) | transaction total |
| Invoice issuing | `Need to issue` → `Issued` + the invoice reference it became |
| Created at · Expense status | timestamp · `Ready` etc. |

An invoice can bundle several transactions; a transaction can span several services.

### 2 · Invoice
Header: Reference Number (`1163605527`) · tax number **DPIN-xxxxx** or **TTIN-xxxxx**
(Fatoora/ZATCA badge) · Receipt date in Gregorian AND Hijri · Salesman · Branch
(e.g. Buraidah Branch) · Seller (شركة المسافر المباشر للسفر و السياحة) · Buyer block
(company, email, phone, address, VAT number e.g. 310404215200003) · status badges
(`Fully Paid`, `Receivables`) · Expiry.

### 3 · Service lines — the FEE-PAIR pattern (the key insight)
Each service appears as **two lines**:
| Line type | Example | VAT |
|---|---|---|
| Provider / 3rd-party fee ("Flight Booking", "Hotel Booking - 3rd Party Fee", "Activity Booking - Provider Fee") | 237,542.00 | **No VAT** (pass-through cost) |
| **Service Fee** ("Flight Booking - Service Fees") | 26,086.96 | **15% VAT** (Direct's income — the taxable part) |

Line columns: Nature of goods/services · Unit price · Qty · Total before discount ·
Discount · Total after discount · Tax amount · Total after VAT.
Totals: Before VAT · Total VAT · After VAT · **Remaining Amount** (0.00 when settled).

### 4 · Payment receipts
`PR-427355` · Payment method (e.g. "MDD Company" wallet) · Amount · Remaining after ·
Status `Fully Applied` · Payment by (person) · created timestamp.

## URL patterns (real)
- Admin invoice page: `https://payments.directksa.com/en/admin/invoices/view/{uuid}`
- Customer-facing invoice: `https://payments.directksa.com/en/invoice/{uuid}`
- The `{uuid}` is NOT the reference number or DPIN — it's a separate id. Our app stores it
  as `finance_invoices.direct_uuid` when known; "Open in Direct ↗" deep-links with it and
  falls back to the admin invoices list otherwise. Templates live in settings
  (`pdInvoiceViewUrl` with `{uuid}`).

## Mapping — Direct Payments ↔ our app (finance_invoices)
| Direct Payments | Our column |
|---|---|
| Invoice reference number | `invoice_no` |
| DPIN-x / TTIN-x (ZATCA) | `zatca_dpin` |
| Transaction receipt ref | `transaction_ref` (added 2026-08-12) |
| Admin page uuid | `direct_uuid` (added 2026-08-12) |
| Transaction/invoice total (what the customer pays) | `total_incl_vat_sar` — **this is `revenue_sar`** (Round 5; supersedes the Round 4 fee-line reading below) |
| The APPROVED expense Finance verified against proof of payment | `cost_sar` — falls back to the non-taxable item estimate only while the expense isn't yet finalised (Round 5). **The authoritative source is the COGs Report's `cog_approved` rows, each with their own `amount_sar` — not the nested `expenses[]` array, which does not carry a real per-expense amount (Round 6).** |
| Provider/3rd-party fee lines (`is_taxable=false`) | the transaction-time **estimate** of cost, superseded by the approved expense once Finance finalises it (Round 4/5) |
| Service-fee lines (`is_taxable=true`, pre-VAT) | an internal **estimate** only — not stored as `profit_sar` and never shown (Round 5) |
| Line VAT (15% on service fees) | `vat_sar` (added 2026-08-12) — stored for import fidelity only, **never displayed, never mentioned, at any stage, in any view or report** (strengthened Round 5: this also rules out ever showing a fee-excluding-VAT figure) |
| Total after VAT | `total_incl_vat_sar` |
| Payment receipts applied | `amount_received_sar` / `amount_remaining_sar` |
| Buyer company | `client_group` (+ link via `finance_client_links`) |

In the app, the invoice card groups lines under **Transaction** headers (with
per-transaction subtotals) whenever `transaction_ref` is present. **Stale note:** the line
below used to say the card "shows the Included VAT row when `vat_sar` is present" — that row
was in fact already removed app-side (BACKLOG.md Round 4, 2026-08-12, "VAT is never shown
anywhere"); this doc just hadn't been corrected to match. Round 5 restates the rule more
strongly still: no VAT-derived figure of any kind, including a fee-excluding-VAT number.

## Menu map of Direct Payments (from the captured page)
Stats (GMV Confirmed / All / Receivable / Metrics) · Expense Reports · Metrics ·
Excel Exports · Expenses · Refund Requests · View All Invoices · Credit Notes ·
Proformas · Payment Receipts · Corporate Clients: Dashboard / Pricing / Settings /
Settlements / Corporate Expenses / COGs Report / **Transactions / Invoices /
Configurations / Cards** · per-service Expenses (Visa, Hotels, Course, Support,
Flights, Packages).

## Still to capture (Cowork Drive folder)
COGS report structure · Excel export column names (drives the future real-data import
mapping) · promo/discount-code screen (drives the promo-revenue table design) ·
credit notes / proformas / settlements shapes · pricing & configurations.

## ROUND 2 — corrections & completions from the Cowork Drive capture (2026-08-12)

The Drive folder `Direct-Payments-Capture-2026-08` (00-DATA-MODEL.md, 7 Excel exports,
19 full-page screenshots, saved pages incl. the B2B Admin Panel and Executive CRM) refines
the model. **Corrections to the section above:**

1. **There is no separate transaction table.** A "Corporate Transaction" IS an invoice
   record — one table serves Invoices / Credit Notes / Proformas / Transactions,
   discriminated by flags (`is_invoice`, `is_credit_note`, `is_tax_proforma`,
   `is_consolidated`, `is_wallet_top_up_invoice`, …). The workflow field
   `b2b_transaction_status` moves `consolidation_pending` → `consolidation_ready` →
   `consolidation_invoiced` (UI: "Need to issue" → "Ready" → "Issued"), and
   `consolidated_proforma_id` links a transaction to the consolidated invoice it entered.
   Our `transaction_ref` column = that source-record reference. Compatible as built.
2. **Tech shape (matters for the future importer):** Laravel + Inertia + Vue 2; every
   page embeds its FULL data as JSON in `<div id="app" data-page="...">` —
   `props.data.data` rows + `props.data.meta` paging (`per_page` capped at 100).
   No separate API needed; saved pages carry complete row data.
3. **Fee-pair confirmed with exact fields** (`02-invoice-example-expanded.csv`):
   `is_taxable false/true`, `tax_rate 15`, `taxable_amount`, `tax_amount`, bilingual
   service names (`name_en`/`name_ar`), product keys (`direct_flights`, `direct_hotels`,
   `direct_visa`, `direct_support`, `direct_course`, `direct_packages`, `direct_wallet`).
   VAT sits on the Service-Fee line only — invoice 1163735256: total 127,911.98 but
   VAT just 105.39.
4. **Discounts/promos live at LINE-ITEM level** (`is_discountable`, `discount_type`
   ("fixed"), `discount_value`, `discount_value_incl_vat`) — not on the header, and
   there is no Promotions screen. The authoritative promo view is the Excel export
   **"Promo Code Invoice Export"**: columns Invoice Number · Before Discount · Discount ·
   After Discount · Product · Payment Status. So **promo usage DOES carry invoice
   numbers** and fits our ledger as normal rows + `discount_sar` (column exists since
   08-10). OPEN QUESTION for the next capture: where the export names the CODE itself
   (per-code export? a column not shown?) and how a code maps to the partner company.
5. **The real-data import source is decided:** export **5551 "Invoice Export"**
   (line-item level, 123,924 rows in the capture; columns include Type, Product,
   Customer, Invoice Reference #, Invoice Number, dates, statuses, item name/qty/
   taxable/unit price/discount/tax/total, Invoice Total, Payment Status). The go-live
   importer maps THAT file. Also useful: 5659 GMV Transaction Breakdown (20,889 rows,
   not yet downloaded).
6. **The design-tone phase has its source:** `design-notes.txt` — Inter font,
   brand orange #FF7A00/#F97316, text #6E6B7B, page bg #F8F8F8, table head #F3F2F7,
   hairline #EBE9F1, 5px radius, fixed 230px sidebar, Feather icons, full RTL
   (Vuexy admin lineage) — plus 19 retina full-page screenshots and the compiled CSS.

## ROUND 3 — promo registry + the four revenue ways (2026-08-12, owner session)

1. **The promo-code open question is ANSWERED.** The owner supplied the Promotions
   export: one row per CODE — Slug · Code · From/To · % · Total Sales · Total Discount ·
   Country counts · Active/Expired · Created By. 198 codes, 134 with sales, 27.3M SAR
   total sales, 2.3M SAR discounts. Codes are named after the partner (the code name IS
   the partner mapping). Mirrored into our `promo_codes` table; the "Promo Code Invoice
   Export" (per-invoice) remains the future source for per-code invoice detail.
2. **The four ways revenue arrives** (owner-defined, stored as
   `finance_invoices.revenue_way`):
   `invoice` — an actual tax invoice (report on this);
   `transaction` — created the moment a service is confirmed, works until its tax
   invoice is issued (expenses/refunds/payment can take time; we store it from creation);
   `commission` — held or received at a SUPPLIER's wallet (never reaches Direct's bank);
   entered manually with details + our invoice number, or as an actual invoice when
   official proof exists;
   `promo_code` — B2B2C code totals (no invoice number needed for now).
   Settlements (postpaid) are deliberately OUT of scope for now.
3. **Transaction→invoice twins confirmed at scale**: the per-customer exports show every
   consolidated tax invoice paired with an unnumbered twin of identical total (the source
   transaction). Our loader keeps the tax invoice and stores the twin's reference in
   `transaction_ref`.
4. **VAT display ban**: VAT is never mentioned in any view or report (owner rule).
   `vat_sar` is stored for import fidelity only. Profit = the WHOLE taxable amount.
5. **Corporate-clients registry captured** (43 records, ~25 real): legal names EN/AR,
   customer type, Prepaid/Postpaid/Tender + billing cycle, CR/VAT ids, contact, credit
   limit/terms, tender amounts with expected COGS/GP. This seeded the real-data world
   (batch `real-2026-08-12`) together with the 18 per-customer invoice exports.

## ROUND 4 — consolidation verified at scale, DPIN, receipts model (2026-08-20)

Verified by reading Direct Payments' live JSON model directly — every admin page ships its
full row data in a `data-page` attribute (the tech shape Round 2 already noted), so this reads
the real backend fields, not a rendered table. **No client names below — company identities
stay database-only, per the standing public-repo rule.**

> **The revenue/cost formula this round originally proposed here (an `is_taxable`-line
> fee-pair split) was wrong, and is fully superseded by Round 5 below — do not use it.**
> The item-level taxable/non-taxable split is only the ESTIMATE made at transaction time; the
> real cost is whatever Finance actually approved against proof of payment, which can differ
> from that estimate in either direction. Kept below (struck through in spirit, not deleted)
> only so the correction in Round 5 has something concrete to point at.
>
> ~~1. The fee-pair model gives an exact formula: REVENUE = Σ item lines where
> `is_taxable=true` (`total_after_discount`); PASS-THROUGH COST = Σ item lines where
> `is_taxable=false`; GROSS BILLED = `total_incl_vat`, never revenue.~~ **See Round 5 —
> this whole point is wrong. `total_incl_vat` (what was called "gross billed" here) IS
> revenue; cost is the approved expense, not the item estimate.**
>
> ~~5. Real aggregate numbers on the fee basis: gross billed 2,433,977 / pass-through
> 2,136,268 / REVENUE 258,878 SAR, 10.6% take rate, by-service breakdown.~~ **Superseded —
> see Round 5's corrected numbers. The 2,433,977 and 2,136,268 figures turn out to still be
> right, just relabelled: they are REVENUE and COST respectively, not "gross" and
> "pass-through." The 258,878 "revenue" and 10.6% take rate were wrong and are discarded.**

Still valid, unaffected by the correction:

1. **Consolidation (Round 2 point 1) is real and verified at scale, not just in structure.**
   `consolidated_proforma_id` on a transaction holds the tax invoice number it rolled into.
   One proof: a single invoice consolidating **8 transactions summing to exactly 75,578.00
   SAR**, which equals that client's own `tender_amount` on file. Checked across 28 clients:
   invoice-linked transactions total **8,791,497 SAR gross**, matching each client's invoice
   list to the riyal, with all 61 parent invoice ids resolving cleanly. This is the same
   transaction→invoice relationship our `transaction_ref` column already models (Round 2/3) —
   now confirmed correct against real, large-scale data, not just the one proof pair.
2. **`zatca_invoice_number` is the field behind the DPIN** (e.g. `DPIN-315074`) — confirmed as
   the exact same DPIN shown to users in the Corporate B2B Admin Panel. One field, consistent
   across both systems; nothing separate to reconcile.
3. **Payment receipts attach at the INVOICE level, never per-service.** `payment_receipts`
   links to invoices through a pivot that carries the *allocated amount* — a receipt can be
   split across several invoices, and an invoice can be paid by several receipts (partial
   payment supported both ways). There is no per-line/per-service payment record at all. This
   matters for how our `amount_received_sar` / `amount_remaining_sar` should ever be modeled
   from a real receipts import: invoice-level allocation, not something derivable per item
   line.

## ROUND 5 — the real revenue/cost model, corrected against Abdulrahman's own rule (2026-08-20)

Abdulrahman clarified directly, same day: the taxable/non-taxable item pair created when a
transaction is opened is only an **estimate**. The number that actually counts is the
**approved expense** — what Finance verified against real proof of payment (bank transfer,
credit-card statement, the expense-management system) before allowing the transaction's tax
invoice to be issued at all. Finance will only approve an expense that is lower than the
transaction total and matches its proof exactly; if the numbers don't reconcile, they reject
it and no tax invoice follows. Re-verified against live data under this corrected definition.

**The definitions this app must use:**
- **REVENUE = the transaction/invoice total — what the customer pays.** (This is the same
  figure Round 4 mislabelled "gross billed" and said to never call revenue. That instruction
  is withdrawn: it IS revenue.)
- **COST = the APPROVED expense** Finance verified against proof of payment. Falls back to
  the non-taxable item estimate only for transactions whose expense isn't finalised yet.
- **PROFIT = REVENUE − COST.**
- **VAT stays banned everywhere, full stop** — never shown, never mentioned, at any stage, in
  any view or report, including as a fee-excluding-VAT figure. A thin margin is fine and
  correct when the approved expense is accurate; VAT visibility was never the fix for that.

**Real numbers on this corrected definition** (same exclusions as before — Takamol/Techtic
Support and wallet top-ups out): **REVENUE 2,433,977 SAR** (2,067,206 already invoiced +
366,771 not yet invoiced). By service (revenue): Course 423,347 · no-product 750,552 ·
Support 62,230 · Other Income 37,375 · Visa 133,012 · Packages 111,467 · Hotels 106,312 ·
Flights 809,683. Transaction counts: 65 invoiced, 47 with a finalised approved expense, 46
still expense-pending.

**COST and PROFIT are pending a correct source — removed here, not replaced (Round 6).** The
figures this round originally gave (COST 2,136,268 / PROFIT 297,709 / 12.2% margin, plus a
per-service profit/margin breakdown) were computed from a misread field and are deleted below,
not struck through — see Round 6's retraction. Do not use any cost/profit number from this
document until a corrected one is verified against the COGs Report.

**Not yet changed:** this round is docs only, same as Round 4. `finance_derive_fields` (the
trigger that computes `revenue_sar`/`cost_sar`/`profit_sar` in our own tables) has not been
touched — it still runs on whatever the importer hands it, under whatever formula the importer
currently uses. Wiring the real-data importer to this corrected definition (transaction total
as revenue, approved expense as cost) is implementation work for later, not something to
change ahead of the Finance page spec.

## ROUND 6 — retraction: the expenses[] amount was misread; the real expense ledger is the COGs Report (2026-08-20)

**Two things Round 5 stated are wrong, retracted here in full — not struck through, deleted,**
because leaving them visible even as crossed-out text risks a future session building a
"deduplicator" against a field that was never real in the first place, corrupting real cost.

- **There are no duplicate approved expenses, and no importer deduplication step is needed.**
  On one transaction, three `expenses[]` records each showed the same amount (213,409.99) and
  were read as three copies of one expense. Checked properly: all three point to the *same*
  invoice item (`item.id 1600909`) but carry *different* `expense_template_key` values (one
  `institution_fees`, two `transaction_fee`). The 213,409.99 is the **parent item's amount,
  echoed onto every expense record that references that item** — it is not each expense's own
  amount. **The nested `expenses[]` array does not carry a real per-expense amount at all, and
  any sum taken over it is meaningless.** The "124 duplicate records" and "22 transactions
  whose approved-expense sum exceeds the transaction total" findings from Round 5 are both
  false and are deleted, not kept as a lesson — there was never a real duplicate to find.
- **The cost/profit numbers built on that misread field are wrong and are removed above** (not
  replaced yet) — COST 2,136,268, PROFIT 297,709, 12.2% margin, and every per-service
  profit/margin figure. The REVENUE numbers are unaffected (they were never derived from
  `expenses[]`) and stay as given above.

**The real expense ledger is the COGs Report** (`admin.stats.cog-report`), not the nested
`expenses[]` array on a client/transaction payload. It holds **one row per expense**, each with
its own `amount_sar` — the field that should actually be summed for cost — plus `reference_id`,
`invoice_id`, `expense_template_type`, `status_key`, `merchant`, `card_details`,
`submitted_by`, `approved_rejector`.

- **Status values:** `cog_pending` → `cog_under_review` → `cog_approved` / `cog_rejected` /
  `cog_cancelled`. **Only `cog_approved` rows count as cost.** Everything else is not yet real
  money spent, or was refused.
- **Expense template types seen:** Institution Fee · Hotel Cost · Provider Price · Airline
  Fees · Embassy Expenses · Exam Fee · Manual Booking · Submission · Appointment · Insurance ·
  e-Sim Cost · Railway Ticket Cost · App Filling · SEVIS · Miscellaneous.

**Standing rule from Abdulrahman: read expense status to decide whether cost counts — never
transaction status.** A draft or cancelled transaction never reaches the expense stage at all,
so there is nothing to misread there; the risk is the other direction — a transaction that *is*
finalised (invoiced) but has no registered `cog_approved` expense yet. That is not a zero-cost
transaction and not a data gap to paper over with an estimate: it goes **OVERDUE**, which is a
Finance chase item, not a number to compute anything from. `cost_sar` for such a transaction
should stay unset/flagged, not defaulted to zero or backfilled from the item estimate.

**Not yet changed:** docs only, same as every prior round. The corrected cost/profit
computation — sum `cog_approved.amount_sar` per transaction, apply the overdue-not-zero rule
above — is implementation work for the real-data importer, still pending, not something to
build ahead of the Finance page spec.

## ROUND 7 — a second real cost source found, and the confirmed-only rule settles how to use it (2026-08-20)

A second, independent view of expense data exists inside Direct Payments and was checked
line-by-line against several invoices before being trusted: Admin → Corporate Clients →
Corporate Expenses, and on any row there, the 3-dot menu → "View Assignments" opens every
expense line under that invoice (product, amount, status, submitter, approver, timestamps,
proof link), with a server-computed header total: **"Total Submitted Expenses."**

**Do not use that total raw as cost.** It counts expense lines whose status is either
*Approved* **or** *Under Review* — not `cog_approved` only. On any invoice with lines still
awaiting Finance sign-off, the raw total overstates confirmed cost. (It excludes *Cancelled*
and *Pending*; why *Pending* specifically is excluded is observed, not explained — possibly
those lines simply carry no amount yet — so treat that exclusion as unconfirmed, not a rule to
build on.)

**Abdulrahman settled how every confirmed figure must be built, in his own words:** *"The
profit is being calculated by the total amount of the transaction or the tax invoice minus the
actual sum of the actual costs... the confirmed ones."* Three things follow directly from that:

1. **The transaction total and the tax invoice total are the same money** ("the transaction OR
   the tax invoice") — this is the same twin relationship Round 2/3 already established
   (`consolidated_proforma_id` / `transaction_ref`). One row per transaction, the invoice
   number attaches to that same row once it exists, and revenue is never summed at both levels
   at once — anchoring the Finance page on the transaction (Spec 2's shape) is correct as long
   as nothing double-counts against the invoice.
2. **"The actual SUM of the actual costs"** — every approved expense line on a transaction is
   summed in full. This is an independent confirmation of Round 6's retraction from a
   completely different angle: if summing every approved line is the rule, a dedup step would
   silently throw real approved cost away. There is still no dedup step, and there must never
   be one.
3. **"...the confirmed ones" is a confirmed-only rule for every number that feeds
   Revenue/Cost/Profit.** Concretely, against the two real cost sources this doc now
   describes:
   - **COGs Report:** only `status_key='cog_approved'` rows may ever be summed into `cost_sar`.
     `cog_under_review` is real work in flight, not yet confirmed — it must stay visible as its
     own separate figure (**"pending Finance review"**) and must never be blended into the
     confirmed cost or profit numbers.
   - **Corporate Expenses "Total Submitted Expenses":** never usable raw, for the reason
     above — if it's ever surfaced at all, it must first be split back into its Approved and
     Under Review parts, with only the Approved part treated as confirmed cost.
   - **The transaction-time item estimate** (the `is_taxable=false` line, Round 4/5's fallback)
     may still render at row level, greyed with an "est." tag, so a viewer can see the gap
     between estimate and confirmed cost — but it must never be summed into `cost_sar` or into
     any KPI total. Estimate is a display aid, not a number to compute with.
   - **This also answers the Finance-page KPI-strip question this doc's own Round 5/Spec-2
     discussion had left open:** the top-line Revenue/Cost/Profit strip is **confirmed figures
     only** — Approved cost, never blended with Under Review or the item estimate. The default
     assumed in the Spec 2 planning conversation ("blend estimates in, labelled") is overridden
     by this rule and should not be built that way.

**Not yet changed:** docs only. Still open, waiting on Abdulrahman directly (not something to
guess at): which field marks a transaction "finalised" for the Overdue stage. **The tender
capacity-vs-money question below turned out not to be capacity tracking at all — see Round 9,
which corrects this assumption rather than confirming it.**

## ROUND 8 — Stage is a two-field read off Corporate Transactions, verified 6-for-6 (2026-08-21)

Answers the "finalised" open item from Round 7 — and the answer is not the field this doc had
guessed at. Corporate Transactions carries its own columns, and **Stage is a two-field
derivation, not one:**

- **Receipt Ref · Product · Amount (SAR) · Invoice Issuing · Created At · Expense Status.**
- **Invoice Issuing** = `Need to issue` or `Issued <invoice number>`.
- **Expense Status** = `Pending` or `Ready` — and **goes blank once the row is Issued.**

**Stage:**
- Expense Status `Pending` → **Expenses pending** — cost is the item estimate only, excluded
  from confirmed totals.
- Expense Status `Ready` + Invoice Issuing `Need to issue` → **Ready to invoice.**
- Invoice Issuing `Issued <n>` → **Invoiced** — show that invoice number on the row.

**Verified 6-for-6 against the per-line Corporate Expenses data** (Round 7's source), not
assumed: every transaction whose expense lines were still Under Review showed Expense
Status `Pending`; every transaction whose non-cancelled lines were all Approved (regardless of
how many separate Cancelled lines sat alongside them) showed `Ready`; the one Issued
transaction checked had Expense Status blank, as the field definition says it should. **The
rule that falls out: a transaction goes Ready only when every non-cancelled expense line on it
is Approved — one line still Under Review or Pending holds the whole transaction at Pending;
Cancelled lines are ignored and never block readiness.**

**This makes Expense Status the transaction-level equivalent of `cog_approved`, and Round 7's
confirmed-cost gate should be read off THIS field, not off the line-level COGs/Corporate
Expenses data directly:** only `Ready` or `Issued` transactions contribute cost/profit to the
confirmed KPI strip; `Pending` transactions render their "est." row and stay out of the
totals, exactly as Round 7 already specified — this round just supplies the correct field to
gate on, superseding the `b2b_transaction_status` guess this doc had been carrying as an
unconfirmed placeholder.

**Free extras on the same page:** the header strip already computes **Total Transactions**,
**Pending Transaction No.**, and **Pending Transaction amount** — and the pending amount was
confirmed to count only Pending-status rows, i.e. it's measured at transaction level, the same
level Stage now reads off. **Consolidation is literally driven from this screen**: row
checkboxes plus a "Select All Ready Transactions" action — a human selects Ready transactions
and consolidates them into one tax invoice, which is the real-world action behind
`consolidated_proforma_id` (Round 2/4).

**Open question this raises, not yet answered — the Overdue stage has no field to read.**
Direct Payments itself only ever shows `Pending` — it does not distinguish "just opened,
nothing wrong yet" from "sitting too long, go chase it." Spec 2's Overdue stage is therefore
an **app-side aging judgement on top of Expense Status=Pending** (e.g. a days-since-`Created
At` threshold), not something mirrored from a Direct Payments field. The threshold itself
still needs a decision before Overdue can be built — not guessing at a number here.

**Not yet changed:** docs only. Still open, waiting on Abdulrahman directly: the Overdue aging
threshold just raised above. **The tender question is answered in Round 9 — not the way this
round and Round 7 assumed.**

## ROUND 9 — the tender "capacity, not money" reading was wrong; retracted (2026-08-21)

Retraction, checked against the real, live Corporate Clients list (44 clients) rather than
assumed. **Both the original reading in the Spec 1 planning conversation and this doc's own
"still open, but probably capacity-tracking" framing in Rounds 7/8 were wrong.**

**A Tender client's payment configuration does not store a neutral capacity number.** It
stores three fields together: **Tender amount, Expected COGS, Expected GP.** Real examples
(different tender clients): `75,578.00 / 75,000.00 / 578.00`; `33,800.00 / 29,697.00 /
4,103.00`; `11,100.00 / 10,600.00 / 500.00`. Expected COGS is cost. Expected GP is profit.
**This is P&L sitting directly on the client record — it collides head-on with the hard rule
that the Clients page shows no revenue, cost, profit, deal value, wallet, or outstanding
figure anywhere.** It is not the capacity-tracking exception both this doc and the original
plan assumed it must be, since the two rules were written in the same breath.

**There is also no "consumed" or "remaining" field anywhere in the source — only those three.**
So a "budget / consumed / remaining" display, as originally spec'd, was never going to be
mirrored data in the first place: **consumed would have to be computed by summing that
profile's invoices/transactions, and remaining derived from the subtraction** — meaning the
Clients page would be *generating* a live money figure, not mirroring an identity field. That
is a bigger violation of the money-free rule than simply displaying a stored number would have
been.

**Do not build tender budget/consumed/remaining on the Clients page until Abdulrahman rules on
it.** Already put to him directly, with this evidence. No default assumption stands in the
meantime — the honest state is "undecided," not "probably fine because it's not literally
revenue."

**Three more facts confirmed on the same page, useful independent of the tender question:**

1. **The Company → many Client Profiles model is confirmed in real data, not just theory.**
   Real examples: one company appears as a Pre-paid row and a separate Post-paid row under
   near-identical legal names; a government body appears twice as two Tender rows with
   *different* Expected COGS/GP on each; two further companies each appear twice. This
   validates `direct_client_id` as the immutable join key and Company-above-Profile as the
   right shape (Spec 1). **It also sharpens the linking-waterfall risk already named in Spec
   1**: near-identical legal names can be genuinely different profiles of the same company,
   not duplicates to merge into one profile — the waterfall's job is linking a profile to its
   *company*, never collapsing two real profiles into each other.
2. **Client Status is a real, mirrored field, not always "Active."** At least one client in
   the live list is `Suspended`. The Client Profile schema (Spec 1) must carry the real status
   value rather than assuming every mirrored client is active.
3. **Takamol appears as an ordinary row in Corporate Clients.** ~~The standing exclusion rule
   is about its money, not its existence — import it as a Client Profile (identity only) and
   exclude everything financial about it.~~ **Wrong, overridden by Round 10 — Abdulrahman does
   not want Takamol to exist in this app at all, identity included. See Round 10.**

**Not yet changed:** docs only. Still open, waiting on Abdulrahman directly: the tender
capacity-vs-money ruling this round surfaces (not resolves), and the Overdue aging threshold
from Round 8. **Point 3 above is corrected in Round 10, not still open.**

## ROUND 10 — Takamol excluded at every layer (correcting Round 9); the tender-grain model is fully specified (2026-08-21)

**Correction — Round 9 point 3 above was wrong, and it was wrong advice this doc itself gave
in the previous round, not just a stale assumption.** Abdulrahman's own words: *"As for the old
rules for Takamol and wallet top ups, I don't want them to appear anywhere."* **Takamol and
wallet top-ups are excluded at every layer, not just the money layer — not a client, not a
row, not a profile, not a line in any list, export, filter, dropdown, or count, in Clients and
in Finance alike.** Exclude at **import time**, so the row never enters the data at all —
never filter it out at display while it still sits in the table. **If excluding it leaves an
unlinked reference somewhere downstream, drop the reference too — never resurrect the excluded
row just to satisfy a join.** Wallet top-ups already had this full-exclusion treatment (Round
1's original wallet-top-up rule, and the app-side purge already shipped); Takamol now gets the
identical treatment, not the softer "identity-only" reading Round 9 wrongly proposed.

**The Company/Client-Profile grain is now fully specified, and it confirms Spec 1 with one
sharp addition.** One Company sits above many Client Profiles; **profile type decides the
grain**:
- **Pre-paid** — **one profile** for the company, covering all its prepaid invoices.
- **Post-paid** — **one profile**, covering its postpaid invoices under that one credit limit
  and term.
- **Tender — one profile PER TENDER, never one per company.** Abdulrahman's reasoning is the
  load-bearing part: a tender carries a fixed, certain amount ("not necessarily one invoice,
  but at least the amount of it is certain"). Once that amount is consumed and its COGS/
  expenses are issued, **it cannot be added to and its value cannot be adjusted** — the only
  way forward is a brand-new tender for the same client. One client can hold three or more
  tenders over time, each its own profile, all linked under the same company "so it reflects
  all of their work together."

This is the exact mechanism behind two of Round 9's real-data observations: the government
body with two Tender rows carrying *different* Expected COGS/GP is two separate tenders, not a
duplicate — and the company with one Pre-paid row and one Post-paid row is the same
one-profile-per-grain pattern, just across two different payment types instead of two tenders.

**Hard consequence for the linking waterfall (Spec 1): two Tender profiles for the same client
must never auto-merge, even when CR, VAT, domain, and normalised name all match identically —
which is precisely the situation where the waterfall's own logic would otherwise want to merge
them.** New rule, ahead of any of the CR/VAT/domain/name checks: **if both candidate profiles
are type Tender, they are always distinct profiles under one company, never collapsed into
one.** `direct_client_id` stays the immutable key per profile; `company_id` is what groups
them. A closed tender profile is also effectively immutable — its amount is **append-only
history, never an editable field** once the tender is done.

**Still genuinely unanswered — do not infer it from the mechanics above:** whether Tender
amount / Expected COGS / Expected GP may ever *render* on the Clients page at all, given the
no-money-on-Clients rule. Abdulrahman described how tenders work, not what's allowed on
screen. **Keep it off the Clients page until he says otherwise** — the mechanics explanation
is not itself a display permission.

**Not yet changed:** docs only. Still open, waiting on Abdulrahman directly: whether tender
figures may render on the Clients page at all, and the Overdue aging threshold from Round 8.
