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
| The APPROVED expense Finance verified against proof of payment | `cost_sar` — falls back to the non-taxable item estimate only while the expense isn't yet finalised (Round 5) |
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
366,771 not yet invoiced) · **COST 2,136,268 SAR** · **PROFIT 297,709 SAR** · **margin 12.2%.**
By service (profit on revenue / margin): Course 89,846 / 423,347 (21.2%) · no-product 85,612 /
750,552 (11.4%) · Support 59,915 / 62,230 (96.3%) · Other Income 37,375 / 37,375 (100%) · Visa
13,781 / 133,012 (10.4%) · Packages 7,065 / 111,467 (6.3%) · Hotels 2,718 / 106,312 (2.6%) ·
**Flights 1,399 / 809,683 (0.2%)** — the thin-margin-on-travel pattern holds under the
corrected definition too. Transaction counts: 65 invoiced, 47 with a finalised approved
expense, 46 still expense-pending.

Note the REVENUE and COST totals (2,433,977 / 2,136,268) are numerically identical to what
Round 4 called "gross billed" and "pass-through" — only the labels and the profit/margin built
on top of them were wrong. Profit under the corrected definition (297,709, 12.2%) is
meaningfully higher than Round 4's mistaken 258,878/10.6%, because the item-level fee estimate
understated what Finance actually approved.

**Supporting finding — the importer must deduplicate approved expenses before summing them
for cost.** 22 transactions have approved-expense records whose raw sum *exceeds* the
transaction total — something Finance could never have legitimately approved, since an
approved expense must be lower than the transaction total by rule. That's proof those are
duplicate records, not real double-spending. (This also **supersedes** Round 4's now-struck
point 6, which had ruled the 124 duplicate `expenses[]` records harmless on the theory that
cost came from the item estimate, not from `expenses[]` — under the corrected model cost *is*
built from approved expenses, so those duplicates matter and must be deduplicated by item name
+ amount before computing cost, or `cost_sar` will be overstated and `profit_sar` understated.)

**Not yet changed:** this round is docs only, same as Round 4. `finance_derive_fields` (the
trigger that computes `revenue_sar`/`cost_sar`/`profit_sar` in our own tables) has not been
touched — it still runs on whatever the importer hands it, under whatever formula the importer
currently uses. Wiring the real-data importer to this corrected definition (transaction total
as revenue, approved-and-deduplicated expense as cost) is implementation work for later, not
something to change ahead of the Finance page spec.
