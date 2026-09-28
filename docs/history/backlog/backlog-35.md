## 8 · Arabic — on hold by request

- **135 pieces of UI text** stay English when the app is switched to Arabic (list produced
  by `scripts/qa/sweep-language.mjs`).
- `applyLang()` hardcodes `document.documentElement.dir='ltr'`, so Arabic never lays out
  right-to-left — **and the brand guide says Arabic is always RTL**, so the app is off-brand
  here, not merely inconsistent. Flipping it on a 1.2 MB file needs care.

## 9 · Two people editing the same section

Saves are per-section since 2026-08-08, so different sections are safe. Two people editing
*the same* section at the same moment is still last-write-wins. Real fix: move bookings,
invoices, offers and requests out of the single JSON row into proper tables.

## 10 · Corporate website leads — waiting on launch

`corporate.directksa.com` has not launched. When it does: its form feeds the same funnels,
default Inbound / stage `new`, with a source stamp. Decide whether website-onboarded leads
need an onboarding phase of their own.

## 11 · Stage wording — deferred deliberately

Screen words (`Prospect`, `Qualified`) differ from the locked database words (`new`,
`in_discussion`). Filters and badges now agree, so nothing is broken. Renaming the display
words means touching `LEAD_STAGES`, `LSTAGE_COLOR`, `STAGE_PROB`, `STATUS_TO_STAGE`, `C2S`,
`S2C` and two seed importers together — a miss leaves a stage with no colour. Own pass.

---

## 11b · Two words for one stage — normalise when convenient

Live data carries **740 leads reading "New"** and **202 reading "Prospect"**. Both are
database stage `new`. `stageToApp` keeps a record's original wording when it maps to the
same database stage, so both survive. Both now have a chip, so nothing is hidden — but two
chips meaning the same thing is confusing.

Fix when convenient: set `raw->>'stage'` to one word across those 942 records, then drop the
spare chip. Reversible via `businesses_snapshot_20260808`. Low risk, cosmetic, not urgent.

## 11c · A company can arrive through more than one door

`funnel_id` holds a single funnel, but Client B was reached by outreach **and** has invoice
history. On 2026-08-08 the invoice record was merged into the outreach record and the
duplicate archived — the invoice fields now sit in the same `funnel_details`, but the record
shows only one funnel.

Before loading the remaining invoice companies, decide: does a lead need a **list** of
sources rather than one funnel? This affects the whole consolidation job.

## 1b · ⚠️ The invoice-mining work has been started twice, and duplicated itself

Found 2026-08-08 by a full-database duplicate sweep. **Eleven records carry
`source = 'Invoice history'`, in two clusters that overlap:**

| Earlier attempt (Outreach & Network funnel) | Later attempt (Past Invoices funnel) |
|---|---|
| `b_client_bt` Client BT | `inv_aug06_client_bt` Client BT |
| `b_client_mn` Client Mn | `inv_aug06_client_mn` Client Mn |
| `b_client_q` Client Q | `inv_aug06_client_q` + `inv_5504` |
| `b_client_k`, `b_client_ml`, `b_takamol`, `b_client_u` | |

A session on **2026-08-06** loaded invoice leads without checking what was already there, and
on **2026-08-08** this session did the same again. Client B duplicated the same way and has
been merged.

**Do not load the remaining 14 invoice files until a matching step exists.** Loading them
blind would produce a third layer of duplicates.

**And do not merge on name similarity.** `b_imp_95` "a travel bureau" and `b_wf_47`
"a second, unrelated company sharing the family name" share a family name and are **different companies**.
The locked rule stands: CR number, then verified root domain, then exact normalised name,
then phone prefix. All duplicate candidates are flagged with
`needs_manual_confirmation` and a reason naming the other records, so they surface on the
Needs Attention list rather than being merged silently.

Other flagged pairs: `b_imp_133`/`b_imp_60` (Alnoorwings / Al Noor Wings) and
`b_imp_244`/`b_imp_245` (Elite Holidays / Eliteholidays).

**Database integrity is otherwise clean** — 0 orphaned contacts, 0 orphaned activities,
0 broken funnel links, 0 duplicate ids, 0 nameless records.

## 11d · Page-by-page content audit — **DONE 2026-08-08 → `docs/CONTENT_AUDIT.md`**

The full audit is written up in **`docs/CONTENT_AUDIT.md`**. All 15 pages were driven with
`scripts/qa/` in English **and** Arabic, signed in as the QA admin, and every heading, column,
button and helper sentence was captured from the live screen with a keep / reword / remove
call. Nothing was changed — it is a review list for Abdulrahman, because most items are
business-wording calls (per the "do not delete copy unilaterally" rule).

Confirmed live, with root causes found:

- **The Tickets filter tabs are objectively broken** — `Push to sourced`,
  `Mark for void in sourceed`, `Request refund → Direct Paymented`. They should be
  `Issued / Voided / Refunded` (Arabic already shows these correctly). Cause: two run-time
  relabelers (`v21RelabelVerbs` + a second "plain-English" pass) find-and-replace button text
  on **fragments** after every render, so `Issued`→`Push to source`+`d`, etc. This is the
  `CLAUDE.md` "layered find-replace" pattern, and it re-mangles any wording fix unless the
  relabelers are made whole-word / retired. **This is the #1 fix.**
- `Open in Direct` column is a dash on every row on Leads **and** Clients (dead column).
- `Has app` is a filter ("show only companies with an app"), mislabelled and over-injected —
  it even appears on SOPs and Operations where it means nothing.
- `▸ From Direct (read-only)` is a **working** collapsible nav group (Bookings/Invoices/
  Tickets live inside it) — it just looks like a dead label.
- Finance "Top 10 clients" really does show 11 rows; the "Saved to cloud" toast sits on the pager.
- Doubled/garbled headings: `AR aging — AR aging buckets` (Invoices),
  `Objective progress avg of each objective's KPI progress` (Reports); empty `Today · <date>` card.
- **Arabic** is a half-translation with a left-to-right layout (page headings, most column
  headers, and the whole Events + Finance pages stay English; `dir` is hard-coded `ltr`).
  This is backlog item 8 and the audit's Part C expands it.

Audit ends with a suggested order of work: bug-fixes first (§20 relabeler, dead columns,
broken headings — all safe to do on Abdulrahman's OK), then the de-jargon / consolidation
items that need his wording calls, then the Arabic pass.

## 12 · Small things

- Delete leftover test edge functions **`hi`** and **`gstest`**.
- App orange is `#F47A1F`; the brand is `#F06820`. The events page uses the brand value.
- **Escape does not close modals.**
- "▸ From Direct (read-only)" is a section heading that behaves like a clickable button.
- Finance "Top 10 clients" lists 11 rows; its pager hides behind the "Saved to cloud" toast.
- Confirm point-in-time recovery is on for the Supabase plan — the app is versioned in git,
  the database is not.
- `manual-confirm` runs with no login and can edit any lead or contact. Fine while it is
  unknown, worth an auth check before it is shared around.

## 13 · Brand identity system — DONE 2026-08-12 (this unlocks branded output work)

Built in the "Company brand identity" session from every real source (official profile
PDFs, logo masters, `brand-assets` Drive kit, the three live Direct systems, this app, the
events page, earlier sessions' designs). Result — one brand, **three identities**:
**A · Classic** (client-facing documents), **B · Editorial** (internal reports/readouts,
with dark mode), **C · Product** (app/dashboards/tools). The three oranges are documented
as deliberate: `#F06820` documents · `#FF6C00` logo mark · `#F47A1F` app.

- Files: `brand/IDENTITY.md` (full brief + provenance + Drive asset IDs),
  `brand/tokens.css` (all three identities as CSS variables), `brand/identity.html`
  (visual showcase, EN+AR), plus the logo files (vector SVG, white PNG, slate PNG).
- Showcase artifact: https://claude.ai/code/artifact/4d5c57f1-45ed-4b67-8f40-6b94600b8546
- Next users of this: branded proposals, the report/offer generators, and the Arabic/RTL
  pass (backlog item 8 — the brand says Arabic is always RTL).

**Extended 2026-08-12 (same session), phases built and verified in the harness:**
- **Brand Hub** `brand/index.html` — employees download HD transparent logos, copy color
  codes (HEX + RGB for PowerPoint), font guidance, do/don't. Served at `/brand/`
  (vercel.json rewrites added ABOVE the `/(.*)` catch-all — that catch-all would
  otherwise swallow the path).
- **Proposal Studio** `brand/proposal.html` — bilingual (EN + real RTL AR) price-offer
  generator matching the house pattern (orange cover → pill-header table + computed
  VAT 15% totals + terms → orange thank-you page with the real contacts). Pure
  client-side, drafts in localStorage, print = PDF. Structure verified against
  `Price offer Directksa.pdf`, the Arabic quote PPTXs, and `offer-proposal.html`.
- **App nav** — `v46` layer in `index.html` adds a "Brand/الهوية" button (v44b injection
  pattern, survives re-renders, 0 JS errors in the harness with the test login).
- **WENT LIVE 2026-08-12:** PR #15 merged to `main`, then `main` merged into the
  production branch (conflict with the events session's vercel.json resolved: /events
  rewrites stay removed, /brand rewrites kept; v46+v47+v64 layers verified coexisting
  in the harness — 0 JS errors, bridge working, Arabic label الهوية correct). Production
  deployment READY; live files verified byte-identical to the tested repo files
  (sha256 on 7 files including fonts). Still recommended: point the Vercel production
  branch at `main` (Settings → Git) to end the two-branch dance.
- **Enhancement round 2026-08-13 (post-go-live):** the app had been SPLIT into `js/NN-*.js`
  by the parallel session while the brand layers were still inline in `index.html` — and
  they were numbered v46/v47/v48, which **collide with the app's own real v46/v47/v48**.
  Extracted and renumbered to `js/43-v67-brand-hub-nav-link.js`,
  `js/44-v68-offer-to-branded-studio.js`, `js/45-v69-app-identity-shell.js` (house
  new-file pattern; index.html keeps only the three script lines + the favicon links).
  This also removes the repeated index.html merge conflicts.
  Studio gains: **amount in words** EN + AR with real counted-noun grammar (the رقم/كتابة
  convention from the HRC financial offer), **multiple saved offers** in the browser
  (save / open / delete / new), **Copy for WhatsApp / Email**, line **move up/down +
  duplicate**, and **sequential offer numbers** (OFR-YYYY-001…) instead of random ones
  that could collide. Hub gains **live font specimens** rendered in the actual hosted
  files. The built-in unbranded export is now labelled "Plain copy (internal)" from the
  v68 layer, so it can't be mistaken for the client document.
- **Pre-launch attack round 2026-08-13 (16 scenarios, an employee's day):** found and fixed
  **a data-loss bug** — an offer arriving from the app's "Branded offer" button inherited the
  saved-record id of whatever offer was open, so pressing Save overwrote that saved offer
  (reproduced: two offers saved, one survived). A handoff is now always a NEW record. Also
  fixed: a negative line (a discount row) printed "Zero" in the amount-in-words instead of
  the negative figure; and the new buttons had no keyboard focus ring. Verified safe:
  60 large saved offers fit in storage, private/blocked storage does not brick the page,
  corrupt storage recovers, cancelling New/Reset keeps the draft, Delete with no selection
  is a no-op, six rapid Saves make one record, two tabs stay independent, long custom terms
  flow onto extra sheets, Arabic print is RTL with correct grammar, and print hides the form.
- **Heavy testing round 2026-08-13:** five full example offers produced as real PDFs
  (EN corporate, AR discount, VAT-inclusive decimals, 20-line stress, extreme-length
  Arabic names) — found and fixed a real clipping bug: the printed content page was a
  fixed height, so offers beyond ~14 lines lost their last rows, totals and terms; long
  offers now flow onto extra sheets with rows kept whole. Studio placeholders switched
  from a real prospect's name to fictional examples. All hub links verified against
  existing files. Main↔production divergence ended by syncing main to the production tip
  (the retired events page and its rewrites finally leave main too).
- **Post-go-live attack round (same day):** XSS attempts via client/service/terms fields
  all render as text (nothing executes); empty state clean; drafts persist; found and
  fixed a 1-halala display-rounding mismatch (figures are now rounded at computation so
  printed Subtotal + VAT always equals printed Total). Open item from the May v0 brand
  notes: confirm palette against the official email signature (needs a screenshot).
- **DONE same session — v47 bridge:** the Offer Builder detail now has a
  "Branded offer (PDF)" button. It hands the offer (ref, client, pax, ticket/partner/
  service fees, validity, remarks) to the Studio via localStorage (same origin, nothing
  in the URL) and opens it pre-filled. Verified end-to-end in the harness: offer
  DB-418335 → studio showed the client, the ref in the title, and exact totals
  (3,245.00 + 486.75 VAT = 3,731.75), 0 JS errors. The cycle is now:
  lead → offer (linkedLeadId) → **branded document** → booking (offerId) → invoice →
  finance. Still open: write the "sent/accepted" status back from Studio to DB.offers,
  and an "Accepted → create booking" shortcut.
- The Brand Hub now lists font sources (Drive internal copies + official foundries +
  free substitutes with direct Google Fonts links) and extra assets (QR to directksa.com,
  Drive links to logo masters and both official profiles).
- Still to open on Drive (session expired mid-survey): `techincal offer final 1.pdf`,
  `TECHNICAL PROPOSAL- SGC`, `Business Proposal Direct 02 2025.pdf`, `offer-B2B-110991.pdf`,
  `technical-profile.html`, `company-profile.html`, `Logo Direct .pdf` (transparent vector
  extraction), core font files for the hub.

## 13a · New B2B landing page (b2b.devdksa.com) — logo wall & partner launch (2026-08-13)

Reviewed the new corporate-travel landing page (AR+EN). Findings and the verified
client list: `docs/B2B_LANDING_PAGE_REVIEW.md` and `docs/HANDOVER-B2B-LOGO-WALL.md`
(the handover carries the logo-verification and pre-launch test findings — read it before
touching logos).

- **Logo wall — ready.** 8 of the 9 floating logos on the page are companies Direct has
  never invoiced; only Client Mn is real. Replacement list of 32 verified companies, ordered
  by Saudi market/cultural weight, with 20 logo files verified and packaged.
  Artifact: https://claude.ai/code/artifact/d77adddd-053e-4235-8318-6084dfd8d673
- **Partner launch brief** for the 31 Aug conference (discount codes, revenue share,
  finance-partner integrations, the service-fee margin rule, per-partner attribution):
  https://claude.ai/code/artifact/403a8403-9e40-4c6a-82f2-742f94ca2216
- **Open — Abdulrahman/product team:** collect artwork for the 12 companies with no public
  logo; get written consent per client (government bodies need formal approval); remove the
  8 fake SVGs from `/partners/`; replace the watermarked stock persona photos; fix the
  unverifiable testimonials and "500+ clients" claim; add OG tags + an Arabic <title>.
- **Open — dev:** promo/partner code field at signup + per-partner attribution report,
  live and tested before any partner newsletter goes out (target 21 Aug).

## 14 · Payment proofs — audit document register — DONE 2026-08-19 (refines the Round 7 wallet purge)

Round 7 (2026-08-12) purged wallet top-ups from Finance because they are not Direct's
revenue — deleted from the ledger, importer skips them, the Wallet KPI card removed.
**That stands, confirmed again by the owner on 2026-08-19: wallet top-up numbers/details
must NEVER return to Finance reports, dashboards or KPIs.** What Round 7 didn't cover: the
owner still needs the bank-transfer proof FILES kept somewhere findable for an audit or
strategy-team hand-off. Direct Payments itself has no upload field on its own wallet-top-up
form, and its Payment Receipts ledger (B2C-scale, 500k+ rows) is a separate system from the
per-client wallet flow — the same fragmentation problem, one level up.

Built: `proof_documents` table (Supabase) + `payment-proofs` storage bucket, gated behind
the same `can_see_page('finance')`/`can_edit_page('finance')` RLS as `finance_expenses` —
finance-adjacent audit material, but the table carries **no revenue/cost/profit columns**
and is read by nothing else in the app. A row tags one uploaded file with: type
(`payment_proof` / `wallet_top_up` / `other`), client, invoice/tax-invoice number,
wallet-top-up number (optional — present for tagging and filename only), amount, date.
UI lives as a new "Payment proofs" tab on the Finance page (`js/57-payment-proofs.js`),
next to Expenses — upload, preview, single/bulk (select-then-download) download, and a CSV
manifest export, following the S5 Expenses pattern exactly.

**Naming scheme** (the concrete recommendation asked for, applied here and matching the
existing Expenses names): `{TYPE}_{Client}_{Ref}_{Amount}SAR_{Date}_{last4ofID}.{ext}` —
`TYPE` is `PAY`/`WTU`/`DOC`, `Ref` is the invoice number and/or wallet-top-up number
(dash-joined when a row carries both), Latin-only (same reason as Expenses: locked-down
Windows machines).

Verified hands-on against the real backend (`scripts/qa/diag-proofs.mjs`, real Supabase,
QA admin account): a wallet-top-up proof saves with its file, the generated name is exactly
right, preview/single-download/select-then-bulk-download/CSV export all work and use the
generated name, and — the point of the whole exercise — every money figure on Overview,
Ledger, Clients and Reports is byte-identical before and after, and the wallet-top-up
reference appears nowhere in `FIN.rows`. Probe cleans up its own test row.

Separately fixed in passing: `docs/BLUEPRINT.md` said "Ahmed's review" in two places — the
decision-maker is Abdulrahman Hasan Abu Al Majid, not a person named Ahmed (a persistent
misnaming, corrected by the owner directly on 2026-08-19; also noted years earlier in
`DIRECT_MASTER_BRIEF.md`: "he is Abdulrahman, not Ahmed"). Fixed where caught in passing,
not chased as its own task.

**Next up (not built yet, deliberately sequenced after this):** the Aug-16 Decision 2 work
— revenue recorded as individual records across the five real patterns (invoice / pending
transaction / commission / promo code / B2C manual) with a `cash_state` field, and
transactions stored as real DB records from creation rather than only at invoice time. That
touches the core ledger and deserves its own money-fingerprinted sitting, same discipline as
every other Finance change in this project — not folded into this one.

## 15 · S3 (part 1) — the fifth revenue pattern, schema-complete — DONE 2026-08-19/20

Owner went green on S3–S5, 2026-08-20. Started with a money fingerprint of every Finance
headline figure (Revenue 917,040 / Cost 730,750 / Profit 186,290 / Received 708,975 /
Outstanding 216,115 / 28 invoices, `deleted_at is null`, excluding `excluded` rows).

`revenue_way` widened to allow a fifth value, `b2c_manual` — the one pattern that is
inherently manual by definition (an individual/personal booking Direct made as a team, with
no corporate-client Direct Payments export to import it from, unlike the other four).
**No existing row changed** — pure widen, migration `s3_complete_five_revenue_patterns`.
Fingerprint re-checked identical after. Also settled, not built: **`cash_state` from the
Aug-16 conversation is NOT a new column** — `integrity_status` (verified_paid / pending /
excluded / credit_note) already is that field, already wired into every Received/Outstanding
number. Adding a second column with the same meaning would have been the exact "raw JSONB vs
real column" split-field trap this project has been bitten by twice before (`is_client`,
`assigned_to`); documented on the columns instead via `comment on column`.

**Flagged rather than built:** a data-entry UI that lets someone create a `b2c_manual` row.
2026-08-08's own history explicitly folded away the general "New invoice" manual-entry card
because it duplicated real Direct Payments data — "the closest thing we have to duplicated
work against the real Direct system." Individual/personal bookings may ALSO already exist in
Direct Payments' own B2C-scale Payment Receipts ledger (500k+ rows, per the Aug-12 capture) —
so a naive manual form here risks reopening exactly the duplication trap that was closed
before, just for B2C instead of B2B. **Needs an owner decision before any UI gets built**:
does Direct Payments' B2C Payment Receipts export become an importer source (same shape as
the corporate importer), or is a lightweight manual form genuinely the only way these ever
get recorded? Schema is ready either way — `record_type='b2c'` and `revenue_way='b2c_manual'`
already both exist and were probe-tested (insert → correct auto-derived revenue/profit →
rolled back, zero rows left behind). Confirmed while probing: `finance_invoices.client_group`
is NOT NULL, so any future manual form needs a client/individual name field, not a blank.

**Methodology correction, caught by the owner's own independent check:** the fingerprint
above (917,040 / 28 invoices) came from a plain "every non-excluded row" SQL query, but the
Performance tab the owner actually looks at only counts `integrity_status='verified_paid'`
rows for Revenue/Cost/Profit/Received (709,475 / 566,650 / 142,325 / 708,975 at the time,
19 invoices), with Outstanding computed separately over ALL live invoices, not just verified
ones. Same underlying data, different filter — the SQL fingerprint wasn't wrong, it just
didn't match what's on screen. Fixed for every fingerprint from here on: read the figures the
same way the Overview tab itself computes them (`live()`/`verified()` + `finInPeriod`), not
an independent re-derivation of the same logic.

## 15b · S3 (part 2) — individual bookings, the manual form — DONE 2026-08-20

Owner's call: build the manual form now (his words: "Finalize it and have it live and I will
add them manually or share them with you to add them once I collect them") rather than wait
on a Direct Payments B2C-export importer.

Built `js/58-b2c-manual.js` — "Individual bookings" tab on Finance, gated the same as every
other Finance-editing action (`canFinEdit`). Writes a real `finance_invoices` row
(`revenue_way='b2c_manual'`, `record_type='b2c'`) through the same `finance_derive_fields`
trigger every other pattern already uses — no second computation of revenue/profit anywhere
in this file. Not the same door as the folded-away "New invoice" card: `record_type` is
fixed to `'b2c'`, not a free choice, so this can't become a side entrance for a corporate
invoice.

Two real bugs found by the hands-on diagnostic (`scripts/qa/diag-b2c.mjs`) before this
shipped, both fixed:
1. **`year` is a GENERATED column**, derived from `invoice_date` — the very first live save
   attempt failed outright ("cannot insert a non-DEFAULT value into column 'year'") because
   the form set it explicitly. Removed; the column derives itself, same as the importer
   already relies on.
2. **A blank reference number would have silently undercounted Overview's "Invoices" tile**
   — that tile counts DISTINCT `invoice_no` among verified rows, and multiple null references
   collapse into a single entry instead of one each. A reference (`B2C-YYYYMMDD-xxxx`) is now
   always generated when the field is left blank.

Verified hands-on against the real backend, reading the figures the same way the Overview
tab itself computes them (the 15a methodology fix, applied): a Paid individual booking of
500 SAR / 100 cost moved Revenue +500, Cost +100, Profit +400, Received +500, Outstanding
+0, Invoices +1 — exactly and only those numbers — and removing it through the real ✕ button
(in-page confirm, not `window.confirm()`) returned every figure to the exact baseline
(708,975 / 566,650 / 142,325 / 708,975 / 216,115 / 19), matching the owner's own live check.

One self-inflicted near-miss caught and fixed: the diagnostic's own first draft matched its
probe row by a fixed name, so a leftover from an earlier interrupted debug run got confused
for the fresh insert — the test deleted the OLD row and left the NEW one live in the real
ledger for a few minutes before it was caught and hard-removed. Fixed by giving every probe
run a unique, timestamped marker so it can never collide with a leftover again. Lesson for
every future money-fingerprint probe in this project: match your own test's row by the id
the insert actually returned, never by a name that could repeat.

## 15c · URGENT — wallet top-up closed as a Finance service label — DONE 2026-08-20

Owner's own hands-on testing of the brand-new Individual-bookings form (15b) found "Wallet
top-up" selectable in its Service dropdown. He saved a test row (50 SAR, Paid) and confirmed
on the live Performance tab that it moved Revenue/Profit/Received/Invoices, then deleted it
and confirmed the figures returned to exact baseline. Direct violation of his explicit rule
from the payment-proofs conversation: "I don't want any wallet top up details at all. I don't
want them on any reports."

Root cause: `SVC_CATALOG` in `js/16-finance-ledger.js` — the ONE shared list every Service
dropdown in the app reads from — still carried a `'Wallet top-up'` entry, left over from
before the Aug-12 purge. Removed it there (fixes Individual bookings, Expenses, and any
future dropdown that reads the same list, in one place) and dropped it from `SVC_GROUPS`'
"Other services" rollup too.

**Checked for reuse elsewhere, as asked, and found a second, independent, pre-existing gap**:
the legacy CSV importer (`rImport`/`finParse`, still the live "Import" tab) had no guard
against a row whose products/notes mention "wallet"/"top-up" — unlike the newer Direct
Payments Excel importer (`js/41`), which already skips these before a row is even built.
Added a matching reject rule (same shape as the existing "verification services are
accounted for elsewhere" rejection), and removed the now-dead `'Wallet top-up'` branch from
`svcType()` itself so the function can never hand that label to any future caller that
forgets the guard — belt-and-braces, not just closing the one reported hole.

Verified hands-on against the real backend (`scripts/qa/diag-wallet-guard.mjs`): the option
is gone from both the Individual-bookings and Expenses dropdowns, a wallet-mentioning CSV row
is flagged and rejected rather than offered for import, and every Finance figure is
byte-identical before/after (708,975 / 566,650 / 142,325 / 708,975 / 216,115 / 19) — this was
a pure UI/classifier fix; confirmed zero existing rows anywhere in `finance_invoices` or
`finance_expenses` carried a wallet-labeled service before it shipped, so nothing needed
cleaning up.

## 15d · Finance export buttons + Ledger delete confirm — DONE 2026-08-20

**Export.** `exportCurrent()` (`core-05-records.js`) had no `'finance'` entry in its per-page
column map, so all four labeled buttons ("CSV - summary", "CSV - full details", both Excel
buttons) fell through to `exportData()` — the full app-state JSON backup, same file as the
"Full backup (JSON)" button, just mislabeled. Found by the owner round-tripping real exports
(hooked `URL.createObjectURL`, compared blob content — same 752,714-byte JSON every click).
Fixed by adding a `finance` entry reading `FIN._csvRows` (the currently-filtered Ledger rows
— same source the already-working `finCSV()` button uses) with a curated summary column
list; the existing generic CSV/Excel logic every other page uses now covers Finance too.
Verified hands-on: all four buttons produce their own real format (CSV, HTML-table `.xls`,
never JSON), full genuinely has more columns than summary (20 vs 11), Finance figures
untouched. One unrelated stray test row (`TEST-QA-0002`, 115 SAR — the owner's own manual
CSV-import round-trip test) was live in the ledger during this check; owner confirmed it on
his end too, cleaned up, verified back to exact baseline (708,975/566,650/142,325/708,975/
216,115/19).

**Ledger delete.** The invoice detail modal's "Delete invoice" button (`finDelInv`) and the
row-level `finDel` both used `window.confirm()` — the same failure mode Payment proofs had
before `js/57`'s `pfConfirm`. The owner's own hands-on QA froze on it (had to close/reopen
the tab; the delete never went through). Both now route through a shared `finConfirm()`
helper that reuses `pfConfirm` when loaded. Verified hands-on: the in-page box opens, not a
native dialog; deleting drops Revenue/Profit by the exact invoice amount; restoring returns
to the exact with-row state; cleanup returns to the exact original baseline. Caught and fixed
a bug in the diagnostic itself along the way: a direct DB insert/delete bypasses the app, so
`window.FIN.rows` stays stale until `finLoad()` is forced — worth remembering for any future
probe that manipulates `finance_invoices` directly rather than through the UI.

## 15e · Two regressions found by spot-checking 15d, one fixed, one open — 2026-08-20

**Fixed — pfConfirm z-index collision.** After 15d shipped, the owner's hands-on QA found
"Delete invoice" on the Ledger completely unresponsive — no confirm box, no error, no
deletion, on a real click, a ref-click, and a raw dispatched click. Root cause: `pfConfirmBox`
(`js/57`) used `z-index:99998`, but the invoice detail modal it opens inside (`js/16`'s `ov`)
uses `z-index:999999` — the confirm box was rendering correctly, just entirely hidden BEHIND
the modal, invisible and unclickable. **The 15d diagnostic never caught this** because it
called `finDelInv()` directly via `page.evaluate()`, which never actually creates that modal
— the stacking conflict simply didn't exist in that test. Fixed by raising `pfConfirmBox` to
`z-index:1000000000` in both `js/57`'s real implementation and `js/58`'s fallback copy —
comfortably above every modal found in the app (highest other value: 999999) and still below
the ~2.1e9 tier reserved for session/permission system banners. The diagnostic now opens the
REAL modal and clicks the REAL button, with an explicit visibility check on Confirm, so a
regression like this fails loudly next time. Lesson: a diagnostic that calls a function
directly instead of going through the actual click path can miss any bug that only exists in
the DOM/rendering layer — worth remembering for every future confirm-dialog probe in this app.

**Open — export freeze, not reproduced.** Separately, the owner hit a 30-45s frozen tab
clicking "CSV - full details" on the 15d export fix, twice, including once via a raw
dispatched click (bypassing any UI timing issue). Stress-tested the actual export code with
3000 synthetic rows carrying nested JSONB (worse than any real dataset) — completed in 76ms,
no performance cliff. Could not reproduce the freeze and don't have enough signal to name a
cause with confidence. Fixed one real, independent gap found while investigating:
`downloadCSV`/`downloadXLS` never revoked their blob object URLs, leaking a live URL for the
rest of the page session on every export — low risk regardless of whether it's connected.
**If this recurs**, worth checking: browser download-prompt settings (a native "Save As"
dialog can block a CDP-driven session the same way a native `confirm()` does), and whether
the owner's own test instrumentation (he mentioned hooking `URL.createObjectURL` to compare
export output) was still attached when the freeze happened.

## 15f · S4 — cross-import transaction/invoice twin resolution — DONE 2026-08-20

Four of the five revenue patterns already exist as individual `finance_invoices` rows —
"transaction-created-first, invoice-issued-later" isn't a rebuild, it's about a real gap in
the existing lifecycle. `parseDP()`'s twin-pairing (a numbered invoice matched to its
unnumbered transaction twin, same customer+total) only works WITHIN one imported file. The
normal way this app gets used: import an export today (transaction still pending, no tax
invoice yet), import a NEWER export weeks later where that transaction now has its invoice.
The twin at that point is a row ALREADY IN THE DATABASE from the first import — the existing
pairing never sees it, so both rows would sit in the ledger forever, double-counting the same
money.

Fixed in `runDP()` (`js/41-money-in.js`): before building the import preview, every live
pending `transaction` row is looked up by the same key the intra-file pairing already trusts
(client + total). A matching incoming invoice gets `transaction_ref` linked to it (same
convention as the intra-file case) and the old row is queued to retire. `finCommit()`
(`js/16`) is wrapped — same additive pattern this file already uses for `finParse` — to
soft-delete the queued rows once the import lands. The preview now says up front how many
transactions are about to be superseded, before anything is confirmed.

Verified hands-on against the real backend with the actual two-stage scenario: insert a
pending transaction (as import #1 would leave it), then run a real CSV through the real
preview→commit pipeline for the same amount now invoiced (as import #2 would show it).
Preview correctly flags 1 superseded row; after commit the old transaction is soft-deleted,
the new invoice carries `transaction_ref` back to it, and the Invoices count moves by exactly
+1, not +2.

**Found along the way, not a bug in this sitting:** confirmed against 10 real existing
invoice rows that `finance_derive_fields` (the DB trigger) has always enforced
`revenue_sar = total_incl_vat_sar - wallet_portion_sar` for every row. "Revenue" in this app
has meant **gross billed** (cost + fee) the whole time, not the fee-only pre-VAT figure
`parseDP()` computes client-side and the trigger silently overwrites. Long-standing,
pre-existing behavior — `profit_sar` is where the true margin lives, matching
`docs/DIRECT_SYSTEMS_MAP.md`'s own distinction ("Gross billed = cost + service fee. Direct's
real revenue is the service fees, not the gross"). Not touched here; flagged because a wrong
assumption about it nearly shipped a passing-for-the-wrong-reason probe.

## 15g · S5 — expenses rolled up next to their invoice, display only — DONE 2026-08-20

The owner's wording sounded self-contradictory at first — "expense roll-up into invoice cost,
record-only/audit-trail" — until read as two figures shown side by side, never merged into
one. Decision 1 (weeks old, unchanged since it was first confirmed for the original Expenses
chapter): a recorded service cost must never touch an invoice's `cost_sar`/`profit_sar`.
"Roll-up" here means: open an invoice in the Ledger, see what Direct Business has on file as
the real cost behind it — right next to the invoice's own Direct Payments numbers, clearly
two different things, never one.

Built `js/59-s5-expense-rollup.js` — wraps `finRow()` (the invoice detail modal) and injects a
read-only panel querying `finance_expenses` by `transaction_ref`, matched against either the
invoice's own `invoice_no` (an expense logged once the tax invoice existed) or its own
`transaction_ref` (logged back when it was still the pending transaction — S4's twin
resolution already carries that reference forward onto the invoice, so one lookup catches
both stages of the same money). Nothing here ever writes to `finance_invoices`.

Verified hands-on against the real backend: inserted an invoice (300 SAR, cost 200) with one
linked 180 SAR expense, opened the real modal, confirmed the panel shows the expense and its
amount, confirmed `cost_sar`/`profit_sar` stayed exactly 200/100 (not 380/-80), and confirmed
the Finance-wide Cost fingerprint moved by exactly the invoice's own +200 — never +200+180.
One self-inflicted diagnostic bug caught along the way: the loading placeholder and the
finished panel need to share one CSS class, since `outerHTML` replaces the marker element
entirely — a check that only looks for the marker's class right after the swap wrongly
concludes the panel never rendered, when it actually worked the whole time.

## 15h · Last native confirm() in Finance closed — 2026-08-20

The owner's own hands-on re-verification of S4/S5 confirmed everything held (export fix
genuinely fixed, S4 duplicate-skip confirmed, S5 roll-up confirmed) — but cleaning up his own
S5 test expense hit the Expenses page's row ✕ button, still on `window.confirm()`, and froze
the tab exactly like the three already-fixed buttons before their fixes. `expDel()` and
`expDownloadAll()` (`js/45-expenses.js`) now both route through the same shared `pfConfirm`
box the other three already use. Verified hands-on: real ✕ click opens the in-page box with
a visible Confirm button, confirming removes the row, and `expDownloadAll`'s bulk-download
confirm also uses the box and a real download fires after confirming. The owner's own
leftover test row ("QA S5 Verify - Translation service cost", 100 SAR, linked to
INV-2026-1380) removed directly — it never touched any Finance total or invoice cost/profit,
confirmed before removal.

**Every native `confirm()` in Finance is now accounted for** — Payment proofs, Individual
bookings, Ledger delete, and Expenses all share the one in-page box.

