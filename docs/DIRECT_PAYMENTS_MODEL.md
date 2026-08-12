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
| Provider/3rd-party fee lines | aggregated into `cost_sar` |
| Service-fee lines (pre-VAT) | ≈ `profit_sar` (Direct's income) |
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
