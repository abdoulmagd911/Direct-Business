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
| Provider/3rd-party fee lines | aggregated into `cost_sar` — exact rule: sum of item lines where `is_taxable=false` (Round 4) |
| Service-fee lines (pre-VAT) | ≈ `profit_sar` (Direct's income) — exact rule: sum of item lines where `is_taxable=true`, using `total_after_discount` (excl. VAT) (Round 4) |
| Line VAT (15% on service fees) | `vat_sar` (added 2026-08-12) |
| Total after VAT | `total_incl_vat_sar` |
| Payment receipts applied | `amount_received_sar` / `amount_remaining_sar` |
| Buyer company | `client_group` (+ link via `finance_client_links`) |

In the app, the invoice card now groups lines under **Transaction** headers (with
per-transaction subtotals) whenever `transaction_ref` is present, and shows the
**Included VAT** row when `vat_sar` is present.

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

## ROUND 4 — exact revenue formula, consolidation verified at scale, receipts model (2026-08-20)

Verified by reading Direct Payments' live JSON model directly — every admin page ships its
full row data in a `data-page` attribute (the tech shape Round 2 already noted), so this reads
the real backend fields, not a rendered table. **No client names below — company identities
stay database-only, per the standing public-repo rule.**

1. **The fee-pair model is confirmed with exact field names, and gives us a precise formula —
   not just "≈".**
   - `is_taxable` (bool) is the discriminator on every item line. `total_after_discount` is
     the line's amount **excluding VAT**; `tax_amount` is the VAT on that line (15% only on
     taxable lines); `total_incl_vat` is the transaction/invoice header total.
   - **REVENUE = Σ item lines where `is_taxable=true`, using `total_after_discount`.**
   - **PASS-THROUGH COST = Σ item lines where `is_taxable=false`.**
   - **GROSS BILLED = `total_incl_vat`. Never call this figure revenue** — it's cost + fee + VAT.
   - Proof pair (real transaction, name withheld): total `303,255.11` SAR, exactly two items —
     a non-taxable line `213,409.99` (no VAT) and a taxable line `78,126.19` excl. VAT +
     `11,718.93` VAT = `89,845.12` incl. VAT. `213,409.99 + 89,845.12 = 303,255.11` exactly.
2. **Consolidation (Round 2 point 1) is real and verified at scale, not just in structure.**
   `consolidated_proforma_id` on a transaction holds the tax invoice number it rolled into.
   One proof: a single invoice consolidating **8 transactions summing to exactly 75,578.00
   SAR**, which equals that client's own `tender_amount` on file. Checked across 28 clients:
   invoice-linked transactions total **8,791,497 SAR gross**, matching each client's invoice
   list to the riyal, with all 61 parent invoice ids resolving cleanly. This is the same
   transaction→invoice relationship our `transaction_ref` column already models (Round 2/3) —
   now confirmed correct against real, large-scale data, not just the one proof pair.
3. **`zatca_invoice_number` is the field behind the DPIN** (e.g. `DPIN-315074`) — confirmed as
   the exact same DPIN shown to users in the Corporate B2B Admin Panel. One field, consistent
   across both systems; nothing separate to reconcile.
4. **Payment receipts attach at the INVOICE level, never per-service.** `payment_receipts`
   links to invoices through a pivot that carries the *allocated amount* — a receipt can be
   split across several invoices, and an invoice can be paid by several receipts (partial
   payment supported both ways). There is no per-line/per-service payment record at all. This
   matters for how our `amount_received_sar` / `amount_remaining_sar` should ever be modeled
   from a real receipts import: invoice-level allocation, not something derivable per item
   line.
5. **Real aggregate numbers, verified on the fee basis** (excluding Takamol/Techtic Support and
   wallet top-ups, per the standing exclusion rule): gross billed **2,433,977 SAR**,
   pass-through **2,136,268 SAR**, **REVENUE 258,878 SAR** (243,158 already invoiced + 15,719
   still pipeline/transaction-only), blended take rate **10.6%**. By service (revenue / take
   rate): Course 78,127 (18.5%) · no-product 74,445 (9.9%) · Support 52,100 (83.7%) · Other
   Income 32,500 (87%) · Visa 11,983 (9%) · Packages 6,143 (5.5%) · Hotels 2,363 (2.2%) ·
   **Flights 1,217 (0.2%)** — this last one is the real number behind the "thin service-fee
   margin on travel" pattern already noted above (Section 1), now with an exact figure.
6. **A data-quality issue found, and ruled out as a financial-accuracy risk.** 124 duplicate
   records exist in `expenses[]`. They do **not** affect revenue or profit, because cost is
   derived from the non-taxable **item** line (point 1 above), never from `expenses[]` — this
   is consistent with, and a real-data confirmation of, the standing rule that expenses are
   record-only and never move a stored cost or profit figure (see `js/45-expenses.js`'s own
   three rules, and S5's roll-up-never-merges design). Stays open as an audit-trail
   data-quality item for Finance to clean up on the Direct Payments side — not a bug in
   anything this app computes.

**Not yet changed:** this round is docs only. `finance_derive_fields` (the trigger that
actually computes `revenue_sar`/`cost_sar`/`profit_sar` in our own tables) still runs on
whatever the importer hands it — it has not been touched to enforce the exact `is_taxable`
formula above. That's implementation work for when the real-data importer is next revisited,
not something to change ahead of the Finance page spec.
