# D26 — Payments client list and promo codes

ACTIVE · 2026-09-28 · second builder · guard `scripts/qa/probe-payments-lists.mjs`, phase3 CP-01…07.

- **What reads them.** `js/122-payments-lists.js` reads two small Direct Payments exports on Finance → Import, through
  js/121's reader: the Corporate clients export and the Promo codes export. Both are written by a person pressing Import
  (D17), through `fn_payments_clients_import` and `fn_promo_codes_import` (`scripts/sql/clients-promo-import.sql`), which need
  Full control of Finance.
- **The client list** is kept as a mirror of Payments' client register (`payments_clients`, keyed by the Payments client ID).
  Its one job in the money: the **contact email** gives an imported invoice row its Payments client ID — the invoice export
  carries none — which is what the client-ID merges and exclusions on Finance → Rules match (D16). An email counts only when
  exactly one client carries it and it is not a Direct staff address (those invoices are linked by a person). Only an EMPTY
  client ID is filled; a hand-entered row is never touched (D21). An invoice imported after the list takes its ID at once.
  The preview says how many invoices get an ID, and how many of those your client-ID rules then leave out.
- **Nothing links a Payments client to a company in the app** — that stays a person's act on the company card (D10).
- **The promo codes** go into the existing registry (`promo_codes`), matched by code in any case: Payments owns each code's
  dates, totals, type, discount and status. A new code whose type is neither percentage nor fixed is left out and listed —
  never guessed. The export's Client Name is kept only as a suggestion (`payments_client_name`); a person links the code to
  its company.
- **The columns** are matched to the real header rows of the 27 Sep exports, exactly (the oversight, 28 Sep): all 29 of
  the client list (Has VAT Number, Contact Information, Block On Overdue, Pricing Setting and Payments' own Created/Updated
  By/At included) and all 13 of the promo codes. A column a later export no longer has is named in the preview and left as
  it is.
- **Any order.** A newer export (its Payments export time, from the file name) wins field by field; an older one only fills
  blanks; a blank never wipes; the same file twice changes nothing. Every change is in the change log.
- **Go-live.** `payments_clients` is wiped by the go-live reset (D9); the promo registry is kept, as before.
