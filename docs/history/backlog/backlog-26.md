## 2026-09-02 · Round 29 — the app was inventing costs it did not have, and counting VAT as profit (fixed)

Four money-rule breaches, all found by reading the source during the eight-area sweep and all
confirmed hands-on before being touched. They matter because they all point the same way: the
app was quietly filling in a number nobody had researched, and then showing it as if it were
fact. Guarded by `scripts/qa/probe-no-invented-cost.mjs` (13 checks), sabotage-verified twice.

1. **VAT was sitting inside every quoted margin.** The proposal editor's margin read
   `total − cost`, but `o_calc` builds `total` as ticket + partner + service + **VAT** + DIP.
   So the margin shown to whoever was pricing the work included tax the company never keeps.
   On a 12,520 quote carrying 1,620 of VAT against a 9,000 cost, the editor said the margin
   was 3,520 when it is 1,900. That is the M1 rule — VAT never enters cost, profit or revenue
   — broken on the screen where deals actually get priced. The margin is now taken net of VAT.
2. **A blank cost was being read as zero, so an uncosted proposal printed its whole sale as
   profit.** `onum('')` is 0, so a proposal nobody had costed yet showed 100% margin. A margin
   with no recorded cost is now *unknown*: the editor says "Cost not recorded" /
   «التكلفة غير مسجّلة» instead of printing a figure. This is M8 — cost is approved expenses
   only, never a number invented to fill a gap.
3. **Today's "Low-profit offers" chip judged offers on a cost it made up.** The test was
   `onum(o.cost) || base*0.85` — with nothing recorded it assumed cost was 85% of base and
   then reported on that assumption. A proposal with no cost and a 1,200 giveaway came out as
   a 3% margin, on a deal nobody had costed. The same test also OR-ed in
   `approvalStatus === 'Pending'`, so a healthy 60%-margin deal waiting for sign-off was
   reported as *low profit* — two different things wearing one label. Both are gone. Awaiting
   approval and no-cost-recorded are now counted as their own categories and named in a
   sub-line on the group ("2 awaiting approval · 1 with no cost recorded (margin unknown —
   not counted as low margin)"), so nothing is silently dropped; the hero total is
   de-duplicated by record id so one proposal in two categories is one item, not two.
4. **Converting a proposal to a booking wrote a fabricated cost into the record.**
   `bookingFromOffer` set `totalCost: Math.round(fareTotal*0.85)` — the booking was born
   carrying a made-up number that from then on looked researched, and fed everything
   downstream. It now carries the recorded cost, or none at all plus a `costNotRecorded` flag
   so the gap stays visible.

**Probe weakness worth recording, because it nearly let a fix pass unverified:** the first
sabotage of #3 came back *green*. The fixture (no cost, 10,000 base, no freebies) gave an
invented cost of 8,500 — a 15% margin, healthy either way — so it never exercised the path.
The probe was wrong, not the fix. A `QA-FREE` fixture with a 1,200 giveaway was added, which
does trip it, and the re-run went red as it should. A sabotage that passes means the probe is
too weak, and is worth more attention than one that fails.

## 2026-09-02 · Round 28 — Arabic was corrupting stored data through value-less dropdowns (fixed); the round-26 fix was incomplete

Found by the eight-area sweep (a fan-out of agents driving areas the 27 rounds had never
covered) and confirmed in source before anything was touched.

**The rule.** An `<option>` with NO `value` attribute is stored BY ITS TEXT — `select.value`
returns the label. Translating that text therefore SAVES an Arabic word as data.

**Round 26 got this half right.** It wrapped the dialog opener and applied the rule there,
trusting the comment then in `js/21` that in-page options are "filter values, not data". That
assumption was wrong twice over:

1. **The proposal editor is a FORM rendered inside `#view`.** Its bundle-item type, status,
   policy, approval and refundable selects are all value-less
   (`<option ${it.type===t?'selected':''}>`, js/core/core-04-proposals.js). With `'Other'` in the
   dictionary, an Arabic user picking it stored **"أخرى" as the service-bundle type** — in the
   form the commercial team uses to price work.
2. **Even a genuine filter was broken by it.** The sabotage run showed the Clients page tier
   filter setting `clFilter.tier` to "رئيسي" / "قياسي" — Arabic words that can never match the
   English "Key" / "Standard" stored on the records. **Filtering clients by tier did nothing in
   Arabic**, silently.

**Fix:** the rule is now universal in `js/21` — a value-less option is never translated, in any
scope. A dropdown whose wording should read Arabic must carry an explicit `value`, which is how
the proposal Type select already works (shows "أخرى", stores `Other`).

New `scripts/qa/probe-option-values-are-data.mjs` sweeps all 14 pages for a value-less option
carrying Arabic text, checks the proposal editor's four value-less selects specifically, proves
picking "أخرى" stores `Other`, and proves value-carrying selects still read Arabic so the UI is
not flattened. Sabotage (rule back to dialogs-only) → red, naming the Clients tier filter.
Arabic battery re-run green: modals-ar, client-card-ar, reports-phone-ar, projects-ar, ops-board.

**Still unverified — do NOT act on these yet.** The same sweep returned ~82 further candidate
findings across Proposals, Operations, Today, Documents, keyboard shortcuts and Archive
(including claims that VAT reaches proposal margin, that converting a proposal to a booking
invents an 85% cost, that Print/PDF is blank in all five generators, and that archiving does not
actually archive). They are UNVERIFIED: this box has 4 CPUs, so the workflow's verification stage
was still queued when the run was harvested. Two were confirmed by hand from source and are
recorded below; the rest need a verification pass before anyone changes code on them.

**Confirmed by hand from source, not yet fixed (`js/core/core-06-v18-v21.js:473`):**
`const cost = onum(o.cost) || base*0.85;` — when a proposal has NO cost recorded, Today's
"low-profit offers" count invents a cost at 85% of base and judges the offer on the invented
number. That breaks the standing rule that cost is approved expenses only and a gap is never
filled with a guess. The same line ORs in `approvalStatus==='Pending'`, so anything merely
awaiting approval is counted as low-profit whatever its real margin. Left for a Finance-lane
decision because it changes a number the owner reads daily.

## 2026-09-02 · Watch cycle 8 — alias grouping, the exclusion twin and the company merge/undo attacked; everything held

**Attack area: M14 alias grouping + M18 duplicate companies** (`js/62-finance-guardrails.js`),
new `scripts/qa/probe-alias-dedupe-attacks.mjs` (port 8201, 34 checks). **No defect found —
the probe is kept as a permanent guard for a part of the app where a silent mistake would
move one client's money under another client's name.**

Held under attack: `finGroupCheck` matches on a normalised name, folding case, surrounding and
doubled spaces, punctuation, and the Arabic variants (ة↔ه both directions, ى↔ي, أإآ↔ا, tatweel
inside a word, diacritics, NFKC forms) — while a genuinely different word ("Ma-dar") is still
not folded into a match; an inactive/undone group is ignored; empty and null match nothing; an
alias that appears in two active groups resolves to the same group every time (a data fault must
not shuffle money between renders). `finExclusionCheck` behaves as its exact twin, and
**exclusion wins**: a company that is both excluded and grouped never reaches Finance at all.
The duplicate finder pairs records on a shared Direct client ID, on CR/VAT digits written
differently (310-123456-7 = 3101234567), and on a normalised name (Co/Company stripped); it
treats three records on one domain as a portal rather than duplicates; it never offers an
archived record; "Not a duplicate" stores that pair and "show dismissed again" clears the list.
The merge moves invoice links, billing profiles and contacts, archives (never deletes) the
dropped record, refuses a company merged into itself, and the undo puts every moved record back
and un-archives the company — with `finance_invoices` **byte-identical** before the merge, after
the merge and after the undo: a merge never moves or recomputes money.

**Sabotage-verified twice** (Arabic folding removed from `norm62` → 4 red; the `active===false`
skip removed → the inactive group starts matching). Restore byte-identical (md5); structure
check OK.

**Probe note for whoever extends it:** `save()` + `render()` reloads `DB.businesses` from the
server, so synthetic companies injected in-page do not survive a re-render — the dismissal
check therefore asserts the stored list rather than a second render.

## 2026-09-02 · Round 27 — the two stale attack scripts brought back, and TWO probes caught contradicting an owner ruling

`attack-wave3` and `attack-day` had been red for weeks and were classified as "selector drift".
Both are green again — **wave3 0 fails / 20, attack-day 0 fails / 41** — and nothing was wrong
with the app. What was wrong was the probes, in four ways worth remembering:

1. **A probe demanded something the owner had switched off — twice.** Both scripts asserted the
   promo-code card must be PRESENT on the Finance overview. The owner ruled on 2026-08-22 that
   promo codes come OFF that page ("for now"), because the registry's own numbers were not
   trustworthy — 114 of 134 used codes were flagged `active` and `expired` at the same time.
   Both assertions predated the ruling. Left as they were, the next session to run them would
   have read two red probes as "the promo card is broken" and switched back on exactly what the
   owner turned off. **Both now guard the ruling instead** (card absent AND its wording absent,
   even with promo rows loaded). This is the failure mode `docs/BACKLOG.md` already warned about
   at the "promo card ABSENT by rule" note — a probe must guard the decision that REPLACED a
   feature, never the feature the decision removed.
2. **A fixture that can never exist.** wave3's Direct Payments import section needed
   `shots/dp-export-test.csv`. `shots/` is gitignored on purpose, and a real Direct Payments
   export carries real company names and amounts, which rule 7 forbids in this public repo — so
   the file cannot exist in a clean clone and that section can never run here. It is now
   SKIPPED OUT LOUD, pointing at `probe-importer-attacks.mjs`, which builds its own synthetic
   file. A missing fixture must never read as a passing import.
3. **A crash threw away the whole log.** attack-day printed its results only on the final line,
   so any mid-run crash produced nothing but a stack trace — which is why "attack-day is red"
   carried no information for weeks. The log now survives a crash (`process.on('exit')` plus an
   uncaughtException hook that records where it stopped).
4. **Stale magic numbers and stale labels.** Sign out moved into the v68 profile chip by owner
   order, so clicking the raw hidden button timed out; the leads export button is called
   "↓ Export this view (CSV)", which never matched a regex looking for "Export CSV"; the
   rebuilt Ledger has exactly three filters (profile type / stage / company) while the old
   assertion demanded four or more. All re-pointed at what the app actually is, and the ledger
   check now names the three filters so a real removal is still caught.

**Harness debt found, not fixed (needs a decision):** both legacy scripts run on
`scripts/qa/mock-seed-live.mjs`, a seed that predates the Phase-2 `finance_transactions`
tables — so `TXN.rows` is 0 there and the whole rebuilt Ledger renders nothing. That section is
skipped out loud for now. Either seed-live gains the Phase-2 tables, or these two scripts move
to the maintained `mock-supabase.mjs`. Until then the Ledger is covered only by
`probe-ledger-attacks.mjs`.

## 2026-09-02 · Watch cycle 7 — Compare-to and the sector scope attacked; an empty period no longer prints as zero

**Attack area: "Compare to" (blueprint step 5) and the sector chips**, new
`scripts/qa/probe-compare-attacks.mjs` (port 8199, 33 checks) on a controlled in-page fixture
so every figure is recomputed by the probe's own period matcher and sector rule, never the
app's. Period arithmetic checked at **every** shape in both modes — a whole year, H1, H2,
Q1–Q4, January, a mid-year month, and "All years" (20 assertions): Q1 wraps back to the prior
year's Q4, H1 to the prior year's H2, January to December of the prior year, and "same period
last year" is always the same part with year − 1. `finCompPeriodOf` is now exposed on `window`
so that arithmetic can be checked directly instead of only through a rendered label.

**Real gap, fixed in `js/16` (Finance's lane): an empty period was printed as a zero.** Comparing
a quarter against one that holds no invoices at all drew "Revenue 0 SAR · Δ +0 SAR (+0%)", and
comparing an empty current period against a real one drew a **−100% collapse that never
happened** — plus a "cost is incomplete" warning about a period with no rows. That is a
fabricated number (M8), the same shape as the A1 collections fix in August. The card now names
whichever side is empty ("No invoices in the comparison period (2025 · Q2) — there is nothing
to compare against. That is not a zero: the period has no data.") in English and Arabic, and
draws no Δ table. Both directions, and the both-empty case, are covered.

**Held under attack:** both columns match an independent recount of their own period; Δ is
current − comparison in money and in percentage **points** for margin; a comparison period with
rows but zero revenue shows the money Δ and no percentage (never ∞ or NaN); a negative base
gives a finite signed percentage; the sector chips scope BOTH sides (tenders 600 vs 300, B2B
1,200 vs 500 on the fixture) and each sector is a real subset; the cost-incomplete warning names
which side; Arabic throughout; no page errors.

**Sabotage-verified three ways** (empty-period guard removed → 5 red; Q1 no longer wrapping to
Q4 → arithmetic and figures red, and a nonsense "2026 · Q0" label appears; `sector` dropped from
the period shift → both sector checks red). Restore byte-identical (md5); structure check and
nine neighbouring probes green.

**Noted for a ruling, unchanged here:** the sector classifier reads `/tender/i` against the
linked business's free-text **payment terms** (`finSectorOf`), so "Net 30 after tender award" on
an ordinary B2B client would classify it as a tender. `client_profiles.profile_type` is the
proper key (M18 put it there); this is the third cycle to note it — it needs the owner's word
before changing how sectors are decided.

## 2026-09-02 · Watch cycle 6 — Clients & collections attacked; three small honesty gaps fixed

**Attack area: Finance → Clients & collections** (`rFinClients` in `js/16`), new
`scripts/qa/probe-clients-attacks.mjs` (port 8197, 25 checks). Every "Top clients" row
recomputed independently from the verified-paid invoices behind it; the seed link pair (two
spellings → one company) and an injected M14 alias group (an English name + its Arabic
spelling) each fold into ONE row with the exact sum — nothing double counted, grand total
unchanged; Collections & ageing recomputed (Outstanding, % overdue by due date, the four
buckets by invoice date); drill-down from a linked and an unlinked client; hostile rows (null
client_group → its own "—" row, HTML name escaped, the excluded partner never shown, a
credit-note-only group never in the verified table, no "Lifetime billed" wording, no NaN).

**Held:** the sums, the folding, the exclusion, the credit-note gate, the escaping.

**Three gaps, fixed in `js/16` (Finance's lane), each sabotage-verified red then restored
byte-identical:**
1. **Ageing invented an age.** Outstanding money on a row with NO invoice date was aged from
   "today" and shown as 0–30 days. It now sits in its own "No invoice date" amount — still
   inside Outstanding, never in a bucket (M8: never fabricate a number to fill a gap).
2. **A "Total" larger than the rows above it.** The Top-clients table shows 10 rows but its
   Total row sums every client; with more than 10 clients a reader adding the rows gets a
   different number and nothing said why. The Total row now reads "Total — all N clients, top
   10 shown" whenever that is the case (and stays plain "Total" when everything is visible).
3. **A silent full ledger.** Clicking a client that has no linked company (or is an alias
   group) opened the Ledger with no company filter and no explanation — every company's rows
   under a heading that never mentioned the client you clicked. The Ledger now carries a note
   ("You asked for X — no linked company yet, so all companies are shown; link it on the
   Clients page"), dismissable, and cleared automatically the moment a company is chosen in
   the filter.

Neighbouring probes (ledger, outstanding-split, overview, invariants, sector, compare-to,
report-presets) re-run green. Structure check OK.

**Noted, not changed:** the harness seed's `finance_invoices` carry `revenue_sar = total −
cost` (i.e. revenue = profit), which the live trigger would never store — the probes are
internally consistent with it, but a future seed refresh should follow the trigger
(`revenue = total − wallet`) so the mock's read path matches its write path, which since
cycle 5 mirrors the trigger.

## 2026-09-02 · Watch cycle 5 — Importer attacked; the harness now applies the real database trigger, and that exposed a re-import gap on the mapped path (fixed)

**Harness made honest first.** The live table has `finance_derive_fields()` (BEFORE INSERT OR
UPDATE — read from `pg_trigger` today, not assumed): month/quarter from the date, revenue =
total − wallet, profit = revenue − cost, remaining = 0 on excluded/credit rows. The mock stored
whatever the client sent, so any importer that derived money differently from the database
looked idempotent here and was not on the real table. `scripts/qa/mock-supabase.mjs` now runs
the same derivation on every finance_invoices insert/update (RPC, POST, PATCH). Every probe that
writes invoices through the mock was re-run afterwards — all green.

**Real gap, fixed in `js/65` (Finance's lane):** the teach-once (mapped) path built each row
with `revenue_sar = profit`. On disk the trigger silently corrected it, but the preview's
new/updated/unchanged diff compares the client's row against the stored one — so **every
mapped row with a cost re-imported as "updated" for ever** (Confirm offered on an unchanged
file, a write and a `record_history` "edit" entry per invoice per re-drop, for nothing), and
"re-importing the same file twice changes nothing the second time" was untrue. Now the row is
derived exactly as the trigger stores it (revenue = total, profit = revenue − cost); a mapped
profit column is still honoured. Also: the binary-file refusal (landmine L6) only guarded the
streamed-file route — the pre-parsed route (`v65IngestText`, xlsx) showed a binary header with
control bytes as "Columns found" and offered Teach; one shared `looksBinaryHeader()` now guards
both. New `scripts/qa/probe-importer-attacks.mjs` (port 8195, 27 checks): doctrine on a mapped
row, idempotent re-drop with no Confirm offered, one edited total = exactly 1 updated, the
excluded partner named and never written, a date-less row lands with no guessed period, a
reference-less row creates nothing, `(200)` stays negative through all three money fields,
binary refused, preview counts = database counts (M13).

**Sabotage-verified three ways:** revenue back to profit → 6 red; the pre-parsed binary guard
removed → 1 red; the mock's trigger mirror removed → 2 red (the harness would go blind again).
Restores byte-identical (md5). Structure check OK.

**For decision 9 (VAT / revenue), not changed here — `js/41` is outside Finance's lane:** the
Invoice Export path (`js/41` `toRows`) computes `revenue = total − vat`, while the live trigger
stores `total − wallet`. The 46 live rows all carry `vat_sar = 0`, so today they agree; the
moment an export with real per-line VAT is imported, every taxable invoice will re-import as
"updated" on each drop for the same reason as above, and the screen's revenue will be the
trigger's (VAT inside), not js/41's (VAT stripped). Whichever way decision 9 goes, the trigger
and the two importers must derive revenue the same way — one rule, three places.

## 2026-09-02 · Watch cycle 4 — Ledger attacked; one real gap fixed (invoiced + overdue rows were hidden from the Overdue count)

**Attack area: the Ledger tab (`finance_transactions`)**, new `scripts/qa/probe-ledger-attacks.mjs`
(port 8193, 50 checks). Stage derivation across the seed's four rows; the confirmed-only KPI
strip recomputed independently under hostile rows (string amounts with thousands separators,
null confirmed cost on a Ready row, unknown `business_id`, missing `client_profile_id`, a
duplicate `transaction_ref`, HTML in a ref, a formula-looking ref); the Overdue mirror (null and
false show nothing, no "not overdue" wording anywhere); profile/stage/company filters composing
with search (regex specials never throw; a stale company filter gives the honest empty state);
company grouping and collapse (headers are confirmed-only and say so; the KPI strip ignores
collapse state); and the Ledger CSV against the table (row count follows the filter, company +
profile + stage + overdue on every row, `csvGuard` on the formula ref, BOM present, HTML
exported verbatim because a spreadsheet is not a browser).

**Real gap, fixed in `js/16` (Finance's lane):** `txnStage()` lets `invoice_no` win, so a
transaction Direct Payments had flagged `overdue===true` *after* it was invoiced showed as
"Invoiced" only — the **Overdue tile did not count it and the Overdue stage filter did not list
it**. That is exactly the row a collections person needs to see. Fix: a `txnOverdue(r)` reader
of the flag; the tile, the filter and a second badge on the row ("Invoiced" + "Overdue") all
use it. `txnStage()` precedence is untouched, so confirmed revenue/cost/profit did not move;
the CSV already exported `overdue=true` on such rows, so the export was right and the screen
was wrong. Also: the CSV's BOM was a literal invisible byte in the source — now the escaped
`'\ufeff'`, same as the invoice export.

**Sabotage-verified both ways:** reverting the one-line tile count makes the probe fail (1 red),
restore byte-identical (md5); `SABOTAGE=1` (the injected row loses its flag) fails the CSV
mirror check. Structure check OK; outstanding-split, finance-invariants and overview-attacks
still green after the change.

**Held under attack (no change needed):** confirmed totals never blend pending estimates;
`"1,250"` as a string counts as 0 on the confirmed tiles (visible in the row as 0, never NaN —
the Overview sanitiser's parse rule is a candidate to share here later, noted below); orphan
rows get their own group under the raw id; duplicate refs stay visible as two rows.

**Follow-ups (not done, owner's call):** (a) Ledger rows could reuse `finSanitizeMoney`'s
parse rule so `"1,250"` reads as 1,250 with a warning instead of 0 — a one-line change once he
confirms the Ledger should be lenient like Overview; (b) a duplicate `transaction_ref` could
carry a small "duplicate ref" marker — data fault surfaced, not hidden.

## 2026-09-02 · Watch cycle 3 — Report Builder attacked, held everywhere; probe kept as a permanent guard

**Attack area: Report Builder**, new `scripts/qa/probe-report-builder-attacks.mjs`. Six
attacks across four grouping/metric configurations: every group total must equal the sum of
the invoice rows the app keeps behind it (the drill-down can never disagree with the row it
opened from); sub-groups must sum to their group and groups to the grand total; the grand
total must equal an independent sum over every base row (nothing dropped, nothing double
counted); the CSV export must be the table — same groups, sub-groups, numbers, order — with
no unguarded formula-leading cell; a hostile client name (`<img onerror>`, `=HYPERLINK(...)`)
must render as text and be formula-guarded in the file; a row with null quarter/month must
never become a "null" dropdown option and must still group under "—". **All held.** Two
sabotages proved the probe bites: doubling one metric in the aggregator → 5 failures;
dropping sub-group rows from the CSV → failures. Files restored byte-identical.

Regression after the Code session's rounds 10–14 (which touched `js/16`, `js/25`, `js/65`):
finance-invariants · report-presets · outstanding-split · overview-attacks ·
silent-write-refusal · compare-to · sector-scope · finance-export · import-hostile-shapes ·
m13-remaining — all green. Cycle 2 (`0b007cd`) landed.

## 2026-09-02 · Watch cycle 2 — one malformed row could show Revenue = 0.00 for the whole company

**Attack area: Finance Overview**, new `scripts/qa/probe-overview-attacks.mjs` — six hostile row
shapes the importer or another layer could plausibly hand to `FIN.rows`, with every tile
recomputed independently from raw rows and compared to the rendered `title="<exact> SAR"`.

**Real landmine found and fixed (A1/A2).** Every total in `js/16` did `sum += +r.revenue_sar`.
One row with the money key *absent* (`+undefined`), or a string with a thousands separator
(`"1,000.00"`), turns the running sum into NaN — and `money()`/`moneyS()` coerce NaN to 0. So a
single bad row made Revenue, Cost and Profit read a clean **0.00** for the entire company, with
nothing on screen saying why — the exact "looks cleaner than expected" shape P5 warns about.
The Supabase path was safe (numeric columns arrive as numbers or null); rows pushed by an
import preview or another layer are not guaranteed to be. Fix at the one chokepoint: `live()`
now passes every row through `finSanitizeMoney()` — absent/null → 0, `"1,250.50"` → 1250.5,
anything still non-numeric → 0 **and the row is flagged**, and the Overview says "N rows in
this period carry an unreadable amount — counted as 0 here. Check the import." Sticky flag on
purpose (a second pass sees a clean 0 and would otherwise erase the evidence). Sabotage
(skip the sanitiser) → tiles read 0.00 again, probe fails in 6 places. Full finance battery green.

**Held under attack, no change needed:** a row with no year/month/quarter counts under All
years and drops under a concrete year (A3); a period with zero revenue and real cost renders a
finite margin on Performance/Compare-to, no NaN/Infinity (A4); the Invoices tile counts distinct
invoice numbers, not lines (A5). A6 (month stored in a different case vanishes from `M:August`)
is real but only reachable by direct SQL — the importer normalises month names; rule D3 covers it.

**Noted, not changed — needs a ruling:** `finSectorOf()` classifies a client as Tenders when its
`paymentTerms` text matches `/tender/i`. Today's values are "Tender", "Post-paid · Monthly",
"Pre-paid (wallet)", so it's correct, but a future value like "Non-tender" would flip a client
into the Tenders sector silently. The proper key now exists — `client_profiles.profile_type`
('tender'), from M18 — worth switching to once the owner confirms that's the intended source.

**Cycle 1 follow-through:** the Code session applied cycle 1 (`d047b8d`), then fixed the seven
silent-write sites in its own lane (round 6) and made the lead save path itself confirm rows
(round 7). Still the old shape, outside both Finance and the audit's scope, for whoever owns
them: `js/15` :76 (allowed_pages), `js/27` :65 (client_profiles insert), `js/31` :407
(client-links upsert), `js/35` :65/:66/:72 (section upserts/deletes/app_settings), `js/45` :103
(expenses), `js/57` :115 (proof_documents), `js/66` :249 (company_identity).

