## 2026-09-02 (overnight) · Watch cycle 11 — Finance driven end to end in Arabic: nothing broken, kept as a guard

**Attack area: the whole Finance section with `LANG='ar'`**, new
`scripts/qa/probe-finance-arabic-attacks.mjs` (port 8207, 20 checks). **No defect found** —
after the Code session's several Arabic rounds this part holds, so the probe stays as the
permanent guard for a screen where a translation slip would be read as a wrong number.

Held under attack: the page is right-to-left; Performance, Clients & collections, Ledger and
Report Builder carry **no English money label** (a 34-word watchlist — Revenue, Profit, Cost,
Margin, Outstanding, Overdue, Ready to invoice, Confirmed revenue, Excel (CSV)…) and all four
really render Arabic; the monthly chart and period bar use Arabic month names; every
**reorderable** amount — signed, or printed beside a currency word — is direction-isolated, so
RTL cannot flip a minus onto the wrong end (plain digit groups are a single weak-LTR run by
Unicode's own rules and are deliberately not flagged, which is why the first version of this
check raised a false alarm on a year); a credit note still reads as −4,321 in Arabic exactly as
in English; the invoice CSV and the Ledger CSV both start with a BOM and carry an Arabic company
name unmangled with Arabic column titles; and the four honest-empty messages this watch added
are all translated — Compare-to's "that period has no invoices", the unreadable-amount warning,
the Ledger's unlinked-client note, with no NaN anywhere.

**Sabotage-verified twice** (English month names forced into the Arabic chart → red; the BOM
dropped from the invoice CSV → red). Restore byte-identical (md5); structure check green.

## 2026-09-02 (overnight) · Watch cycle 10 — a deleted invoice could be silently overwritten by a re-import

**Attack area: the importer against invoices the owner has DELETED**, new
`scripts/qa/probe-deleted-invoice-attacks.mjs` (port 8205, 10 checks).

**Real gap, fixed in `js/65`.** `finLoad()` selects `finance_invoices` with no `deleted_at`
filter — deliberately, so the Ledger can offer Restore — so `FIN.rows` carries soft-deleted
rows. The importer's `initState()` indexed **every** one of them as "already exists". Proved
end to end: soft-delete an invoice, drop a file containing it with a different total, and the
preview reported "**Updated 2**" and wrote 99,999 into a row that stays invisible on every
screen. From the owner's chair: *"I deleted it, dropped the file again, it said updated, and
the invoice never came back."* The cost-capture join had the same blind spot, and reported a
deleted invoice as "not a live invoice — likely an invoice-import gap", which is a different
problem with a different fix.

Deleted invoice numbers are now kept in their own index and **reported, never written to and
never silently resurrected** — "deleted in this app — restore it first, then re-import; nothing
was written" — on all three paths that match by invoice number (the mapped/teach-once and
Invoice-Export merge, the tax-invoice capture, and the Level-2 cost join, where it also says how
many transactions issue into it). Restoring stays the owner's decision. A number that has both a
live and a deleted row still matches the live one, exactly as before.

**Held in the same drop:** a live invoice still updates, a brand-new number still inserts, no
duplicate row is created for the deleted number, and an invoice this app has never seen is still
reported as a likely import gap — two different problems, two messages.

**Sabotage-verified** (index deleted rows as existing again → 4 red). Restore byte-identical
(md5); structure check green; eight importer-family probes re-run green.

## 2026-09-02 (overnight) · Watch cycle 9 — the targets editor was silently changing what you typed

**Attack area: Plan vs actual and its "Set targets" editor** (`js/16`), new
`scripts/qa/probe-targets-attacks.mjs` (port 8203, 18 checks).

**Real gap, fixed — four ways to type a number and get a different one stored.** The parser was
`parseFloat(String(s).replace(/[^0-9.]/g,''))||0`, so:
- **Arabic-Indic digits became 0.** In an app that is half-Arabic, typing ١٥٠٠٠٠٠ set the year's
  target to nothing, with no message. (The importer has read those digits since August —
  `asciiDigits` in `js/65` — the targets box never did.)
- **"1e6" became 16.** The "e" was stripped and "16" parsed.
- **Any text became 0** — a typo silently wiped the target.
- **"-500" became +500** — the minus was stripped, not rejected.
Now one parser reads the same digits the importer reads, accepts commas/spaces/a trailing SAR,
treats an empty box as a deliberate "clear to 0", and **refuses anything else by name** ("Not
saved — "Expected revenue" is not a readable amount: "1e6". Type a positive number… Nothing
changed."), in both languages. A target nobody typed is a fabricated number (M8).

**Also fixed:** `finSetTargets` had no permission check of its own — the button was hidden from
a viewer but the function still ran and still asked for numbers. It now guards with
`canFinEdit()` like `finDelInv` does. (`finSetOrigin`/`finSetWay` are in the same shape; their
UI is gated too — noted for a later pass rather than changed blind tonight.)

**Held under attack:** thousands separators; cancelling either prompt writes nothing; a write
the database refuses says so and leaves the old number on screen (M13); attainment = actual ÷
expected recomputed independently; a quarter pro-rates to a quarter and a month to a twelfth and
the card says it is pro-rated; past 100% it reads "above plan"; a zero target never divides by
zero.

**Sabotage-verified twice** (old lenient parser back → 4 red; permission guard removed → the
viewer check goes red). Restore byte-identical (md5); structure check and six neighbouring
probes green.
## 2026-09-02 · Round 41 — every generated document printed a blank VAT number and no CR at all

The header at the top of **every** document the app generates — tax invoice, booking
confirmation, statement, quotation — is `v21AgencyHeader()`. It read:

    CR · VAT ${AGENCY.vat} · IATA Wakeel ${AGENCY.iataWakeel} · IBAN ${AGENCY.iban} · ${AGENCY.bank}

Two faults, both on a page a **client** reads:

1. **The CR label had no value interpolated after it at all.** Not a hydration problem — the
   company's CR number has never been printed on any document, in any state.
2. **`AGENCY.vat` / `.iban` / `.bank` are deliberately empty literals** in core-06 (audit fix
   2026-08-24: the old hard-coded ones were an outdated VAT number and an IBAN matching none of
   the real accounts). The real values are hydrated **asynchronously** from the
   `company_identity` registry by js/66, on a poll that retries for about a minute. Print before
   that lands — or if it never lands — and the header rendered
   `CR · VAT  · IATA Wakeel 71238285 · IBAN  · `. **A Saudi tax invoice without the seller's VAT
   number is not a valid tax invoice, and a blank IBAN is an invoice nobody can pay.**

Each part is now emitted only when it *has* a value, the CR is printed, and when statutory
identity is missing the document says **"Company identity not loaded (VAT, IBAN, CR) — do not
send this document"** in both languages instead of leaving quiet gaps.

**Why nothing caught it, and a correction to my own round-34 work.** `company_identity` had **no
seed in the mock**, so the harness had only ever exercised the not-loaded case — the fourth time
this run that an unseeded table hid a real defect (rounds 19, 20, 33, 41). And round 34's probe
asked *whether the document rendered*, not what it said; its own captured output contains the
string `CR · VAT · IATA Wakeel 71238285 · IBAN ·` and I read straight past it. The registry is
now seeded with obvious placeholders — the real CR / VAT / IBANs are company data and never go
in this repo (rule 7); only their shape matters here.

**A weak assertion caught by its own sabotage.** The first CR check was `/CR\s+\S/` and passed
while sabotaged, because the broken header reads `CR · VAT` and the separator itself satisfies
`\S`. It now requires a digit. Live is fine either way: 29 identity rows with a VAT number, a
CR and 8 IBANs.

## 2026-09-02 · Round 40 — the same trap one level up: a page that fails dropped you on Today

Round 39 fixed a Finance **tab** that failed silently showing another tab. The identical pattern
sits between **pages**, and the same three layers are involved.

`Finance`, `Events` and `Generator` are added to `VIEWS` by later layers and have **no branch**
in the core render map. They are drawn by wrappers on `render()` that run after it returns —
each ending in `catch(e){ console.warn(…) }` — while the map's own fallback was
`(map[current] || renderToday)(v)`. So a layer that throws while drawing its page left **Today**
on screen with the nav still highlighting the page you asked for: no error, no empty state,
nothing to say the click failed.

A `current` that **is** a real nav entry but has no renderer here now gets the honest
placeholder, which the working layer overwrites in the same tick. A `current` that is **not** a
nav entry stays on Today, deliberately: that is bad input, not a failed page, and a "did not
load" message there would claim a failure that never happened. The probe asserts both directions.

**A test I had to correct.** My first version of the failing-page check broke `getElementById`
while rendering Finance — and it passed for the wrong reason. Finance has *several* wrappers
stacked, so when the earlier one failed a later one still drew the page: that is the app working
correctly, not the case under test. The check now uses **Events**, which has exactly one wrapper,
and replaces `window.renderEvents` with a thrower — a faithful stand-in for a runtime error
inside it. Sabotage then reproduces the real symptom, printing the Today page's own chips.

## 2026-09-02 · Round 39 — a Finance tab that fails silently showed you a different tab

Found while driving the Finance tabs in the previous round, and it follows from how they are
built. `js/16` owns five tabs, and its dispatcher was a chain ending in `: rOverview()`. The
other three — **Expenses, Payment proofs, Individual bookings** — are added by later layers that
**wrap** `renderFinance`: the inner call runs first and draws the Overview, then the wrapper
checks `FIN.tab` and, if the tab is its own, wipes `#view` and rebuilds it.

Every one of those wrappers ends in `catch(e){ console.warn(…) }`.

So **if a layer throws while rendering its tab, its Overview fallback simply stays on screen.**
The person clicks "Individual bookings" and gets **Performance** — no error, no empty state,
nothing to suggest the click did anything at all. This project's own notes name that failure
mode exactly: *"looks exactly like a mysterious failure"* — the pattern that cost months here.

A tab js/16 does not own now renders an honest placeholder instead. A working layer overwrites
it within the same tick, so nobody ever sees it; if it survives, the section really did fail and
it says so and says what to do. Deliberately **neutral wording rather than a guessed label** —
js/16 cannot name a tab another layer owns, because those layers inject their own buttons after
`finTabs()` has run, and inventing a lookup would be one more thing to drift.

Guarded by `scripts/qa/probe-finance-tab-honest.mjs` (8 checks). The important one does not test
the theory but the real case: it **forces the Individual-bookings layer to throw mid-render** and
asserts the person is not left looking at Performance. Sabotage restores `: rOverview()` and five
checks go red, the failing-tab one among them.

## 2026-09-02 · Round 38 — the harness's own finance fixture could never have existed

**Every finance probe in this repo has been asserting against invoices the live database could
not produce.** `finance_derive_fields()` — read straight out of Postgres, not from memory —
defines, on every insert and update:

    revenue = total_incl_vat − wallet        profit = revenue − cost

The seeded fixture stored `revenue = total − cost` and `profit = revenue` instead. **12 of 17
rows broke the profit rule and 13 broke the revenue rule.** The visible symptom, which is what
led here: driving the Finance tabs in the live shape showed **Revenue 58.4K against Cost 114.2K
with a positive Profit of 52.4K** — a cost larger than revenue and a profit that reconciles with
neither. That reads as an app bug. It was a fixture bug.

Fixed at the generator, and guarded in `check-structure.mjs` (the pre-deploy gate) rather than in
a probe: it needs no browser, and it *should* block a deploy — a fixture that cannot exist makes
every check standing on it meaningless. Both halves sabotage-verified: reverting the generator's
algebra is caught, and skewing a single literal row's profit by 999 is caught with the arithmetic
spelled out.

**One deliberate exception, left exactly as it is: `i-qa-vatclean`.** It is the VAT canary owned
by `probe-no-vat-display`, built with revenue deliberately net of VAT to prove no money figure is
VAT-contaminated (M1). The guard skips it by name and says why. I nearly "corrected" it — checking
first was the right call, and the live data settles it: **all 46 live invoices store no VAT at
all**, so the trigger never gets to disagree with that fixture in practice.

### A correction to my own investigation, recorded because the wrong version was persuasive

This round started from a real live observation — `finance_cogs_expenses` is **empty live** (0
rows) while `finance_expense_lines_capture` holds **223 rows, 183 of them Approved, 1.94M SAR** —
and I formed the theory that the captured costs were stranded, disconnected from the invoices,
and were the missing costs behind round 35's 19 zero-cost invoices.

**That theory was wrong, and the reason is instructive.** I joined `capture.transaction_ref` to
`finance_invoices.invoice_no` and got zero matches out of 75 — both are 10-digit, which made the
join look right. They are not the same thing: capture refs are Direct Payments *transaction*
refs, and a separate table, `finance_expense_gate_capture` (155 rows), maps a transaction to the
invoice it issued. Through the real chain, **63 gate rows reach invoices the app holds**, and of
round 35's 19 zero-cost invoices exactly **one** has approved expenses waiting (~29,000 SAR). The
pipeline is not broken. Two fields of the same width are not a join key.

*Worth the owner's attention, and not something a session should act on alone: that one invoice
has approved expenses recorded against it and still shows a cost of zero.*

## 2026-09-02 · Round 37 — Undo and the audit log: ninety probes and not one drove the most consequential button in the app

**Undo asks the database to put a previous version of a row back.** It is the single most
consequential thing anyone can click here. There were ninety probes in `scripts/qa/` and *not
one* of them drove it: `probe-golive` checks who may **open** Activity & Audit; nothing checked
what the page says or what the button does.

Reading js/63 first, most of it is in better shape than the sweep suggested, and that is worth
recording so nobody "fixes" it later:
- the rules live in the database (`undo_change(p_id)`), which is right — the server is the
  authority and returns a fixed set of English strings the app translates;
- a change older than 24 h **still offers the button**, with a tooltip saying it will likely be
  refused. That is deliberate: the app explains the server's rule rather than duplicating it,
  and a duplicated rule is one that can drift;
- the "Events loaded" tile was always honestly labelled — not "Total events".

`scripts/qa/probe-audit-undo.mjs` (14 checks) now holds all of it: the feed and what changed, a
create entry offering no Undo, an already-undone entry offering no second one, the 24 h warning,
and a **real Undo driven end to end** — confirmed, reported, and verified against the database
(one more `undone_at` row) rather than trusting the screen. It also asserts the layer's own claim
that its refusal list is "the exact, exhaustive set", by checking all eight strings the function
can return actually have Arabic.

**The one behaviour change: the 500-row cap now says when it was hit.** `record_history` is read
with `limit(500)`. Today that is not biting (242 rows live) and Today / 7-day are exact while the
window fits inside the cap. But at the cap nothing said so — a reader would see a round `500` in
three tiles with no reason to doubt it, and the 7-day figure would be an undercount presented as
a count. It now reads "the most recent 500 — there are older ones" and marks 7-day as "at least",
**only when true**; below the cap the page stays quiet. The literal is now a named `HIST_CAP` so
the query and the message can never drift apart.

*Note: `probe-golive` cannot run in this sandbox — it drives the real site through `emp-rig.mjs`
with the team's actual passwords from the environment, which this session correctly does not
have. It fails at navigation, before any page logic, and is unrelated to this change.*

## 2026-09-02 · Round 36 — the same caveat, carried to the Report Builder

Round 35's lesson generalised: a caveat at the top of a page does not protect a table further
down it. Swept every remaining place that displays or sums profit, and the **Report Builder**
had the same hole — it groups by client / month / quarter / service and sums `profit_sar`, so a
group whose invoices all carry cost 0 reports its entire revenue as profit, with nothing said.

Fixed with one line under the table rather than per-row markers, deliberately:
- per-row marking is **noise** here, because the report also groups by month and quarter, where
  a marker on a time bucket tells the reader nothing actionable;
- the TOTAL row must keep reconciling against the ledger (`probe-report-builder-attacks` holds
  that), so the arithmetic is untouched;
- and the line only appears when a **profit or cost metric is actually switched on** — a
  revenue-only report does not carry it, because there is no profit claim to qualify.

**Exports deliberately left alone.** The ledger CSV writes `cost_sar` / `profit_sar` as stored.
An export is raw data, and a spreadsheet that silently rewrote 0 as "not recorded" would stop
reconciling against the database it came from. The screen is where the interpretation belongs.

**A probe mistake worth recording, because two checks passed for the wrong reason.** The first
version switched tabs with `finTab('reports')` — but the switcher is `finGo(t)`. The call
silently no-opped, the probe read the *Clients* tab, and two assertions passed anyway on text
that happened to be there ("upper bound" from the round-35 note, and the absence of the report
wording in a revenue-only run). Only the third assertion failed and exposed it. The probe now
asserts `FIN.tab === 'reports'` **before** anything else, so reading the wrong screen can never
again look like a pass. A guessed function name that no-ops is worse than one that throws.

## 2026-09-02 · Round 35 — "Top clients by revenue" was presenting unrecorded costs as 100% margin (fixed)

**Found by a live read-only sweep, not by reading code** — and it is the only defect this
overnight run has found that is biting *today*, on *real money*.

Of 46 live invoices, **19 carry `cost_sar = 0` rather than NULL**, and the database trigger
derives `profit = revenue − 0`, so those 19 record their entire sale as profit. Grouped by
client that is **5 of 18 client groups with no recorded cost on any invoice**, appearing in
"Top clients by revenue" as **131,871 SAR at 100% margin**. (Counts and the aggregate only —
no names, no per-client figures, rule 7.)

The Finance overview headline was already honest about this: *"N of M invoices in this period
carry no recorded cost — margin may read higher than reality until their expenses arrive."*
That was correct and stays. But the *per-client table* is where a manager decides which client
is worth the effort, and it showed those clients a Cost of **0** and a Profit equal to their
whole revenue with nothing to mark it. **The warning was in the room; it just was not next to
the number being misread.** That is the lesson worth keeping: a caveat at the top of a page does
not protect a table further down it.

Same rule as rounds 29 / 31 / 33 (M8) — a cost nobody has recorded is not zero, and a profit
derived from it is not a profit:

- a client with **no** cost on any invoice → Cost reads "not recorded", Profit reads "unknown";
  its **revenue is still shown in full**, because that part genuinely is known
- a client with **some** → the real numbers, plus ⚠ so the reader knows they are partial
- a client with **all** costs recorded → untouched, no marker, no noise
- the Total row keeps the true arithmetic, because it must still reconcile against the ledger,
  and now says the profit total is **an upper bound, not a final figure**

Guarded by `scripts/qa/probe-client-profit-honest.mjs` (11 checks, EN + AR), sabotage verified —
reverting the row reproduces "Cost 0 · Profit 60,000" for a client nobody has costed.

**Not done, and deliberately left for the owner: the live data itself.** Those 19 rows hold `0`
where they mean "unknown". Changing them to NULL would alter every profit figure in the app and
is a real-data mutation on real invoices — his call, not a session's. The app now tells the
truth about them either way, which is the part that was reachable from here.

## 2026-09-02 · Round 34 — the five printed documents, guarded for the first time (and the "blank print" report closed)

The sweep reported "Print/PDF comes out blank in all five document generators". Driven end to
end, that is **not reproducible**: every one produces real content (3.6 KB to 48 KB of HTML),
bilingual, carrying its own record's data. The report is closed.

The reason nobody had ever checked is worth recording: all five render into a
`window.open('','_blank')` popup via `document.write`, and no probe was watching for a new page,
so the harness had never once opened one. These are the pages a **client** reads — the tax
invoice, the booking confirmation, the statement of account, the quotation, and the monthly
commercial report — and until now nothing would have noticed any of them breaking.

`scripts/qa/probe-documents-print.mjs` (14 checks) now opens each one and reads it back. It also
holds the money rules where they matter most, on the document itself:

- **M8** — a booking confirmation for a booking with no recorded cost prints
  "Cost not recorded · Margin unknown", not a zero and not a fabricated figure. This is the
  round-29/33 fix followed all the way out to the printed page: sabotaging it back reproduces
  the old "Sale 16k · **Cost 0** · Margin 16k", which would have told a manager the whole sale
  was profit.
- **M1** — and deliberately **not** a ban on the word VAT. The owner corrected that rule on
  2026-08-23: the violation was never the glyph, it was VAT entering cost / profit / revenue. A
  quotation and a tax invoice are exactly where VAT is legally expected, so the probe asserts
  the quotation's VAT line is still **present**.

Also asserted: a statement for a client with no invoices opens **no** document at all — it says
so rather than printing an empty form.

## 2026-09-02 · Round 33 — four pages had never rendered a row in the harness; driving them found a money-rule breach and a set of Arabic gaps

**The harness gap first, because it is the reusable lesson.** `app_bookings` and `app_invoices`
had **no seed at all** in `scripts/qa/mock-supabase.mjs`. js/35 lists both in its KEYS, so the
empty answer *replaced* whatever the workspace blob carried — meaning **Bookings, Invoices,
Tickets and the whole Archive screen had never rendered a single row in any QA run, ever.**
This is the third time the same shape of gap has hidden real defects (round 19 reference pages,
round 20 SOP/SLA). Both are now seeded: six bookings across the statuses, with a TTL inside 72 h,
an ADM-flagged ticket and — deliberately — one with **no cost recorded**; five invoices including
a credit note and an overdue one.

What driving them surfaced:

1. **M8 on the Bookings page, and round 29 made it live.** `bkMargin` was sale − cost through
   `onum()`, so a booking whose cost nobody had recorded reported its **entire sale as margin** —
   a 15,500 sale showing 15,500 of profit on the row, with the page's Margin total carrying it
   (27k where the evidenced figure is 11k). This was not theoretical: round 29 stopped
   `bookingFromOffer` fabricating a cost at 85% of the sale, so **"no cost recorded" is now the
   normal shape of a booking converted from a proposal.** Fixing one honesty bug exposed the
   next one downstream. The margin is now unknown, the row and the detail card say so, the
   total counts only evidenced margins and names how many it left out.
2. **Arabic words that only exist on a row.** The TTL badges carry a number, so no dictionary
   entry could ever have reached them — they are built per language now. Booking statuses were
   *half* translated: `Confirmed` sat in the main dictionary and `Ticketed` only in the
   Operations-board one, so a single column showed one row in Arabic and the next in English.
   The payment flag (`.fopflag`) sat outside every selector the Arabic layer scans. Today's
   card lines (`Dated … · dunning:`, `Stage:`, `approval:`, `due`, `EXPIRED`, the QC sentence)
   only appear when there ARE bookings and invoices, so they had never been seen either. And
   the `✅ QC checklist incomplete` heading — the one Today group that renders conditionally —
   was the single heading missing from the emoji-heading dictionary.

**Checked and NOT a defect: archiving.** The sweep's "archiving does not actually archive"
report does **not** reproduce. Driven end to end: the record leaves its list, appears under
Archive, and Restore brings it back. Closed rather than left hanging.

Guarded by `scripts/qa/probe-bookings-invoices-rows.mjs` (22 checks), three sabotages verified.

**A mistake of mine worth keeping, because it would have shipped silently.** The first version
of the Bookings "N with no cost recorded — not counted" note used class `ch-sub`, and
`index.html:522` carries `.card .ch-sub{display:none !important}` — a deliberate rule hiding grey
helper lines inside cards. The note was in the DOM, read perfectly from `textContent`, and was
**invisible to every human being**. My probe passed. A probe that only reads text cannot tell
"we told the user" from "we wrote it into a hidden element" — the note is now asserted by
`getBoundingClientRect()`, and the same check was applied back over the round-29 and round-31
notes (Ops tile and dashboard tile: both genuinely visible; the Today one sits inside a group
the v26.3 layer collapses along with **every** Today group, so it is exactly as visible as the
cards beside it — the app's existing design, not something these rounds introduced).

## 2026-09-02 · Round 32 — a request you deleted came back on screen for 20 seconds (fixed)

The "deleted request re-appears" report from the eight-area sweep, reproduced in the harness and
fixed. It was real, and the mechanism is worth understanding because it will catch the next
person too.

`js/35` reads requests / proposals / projects / bookings / invoices from real tables, then —
because the workspace-blob loader can finish **later** and put its stale copy back — re-asserts
the table copy every 1.5 s for ~20 s. The trigger is `DB.requests !== window.__v59ref`: the
array's **identity** changing. But deleting a request is
`DB.requests = DB.requests.filter(...)`, which makes a new array, so a legitimate delete looked
exactly like the clobber the guard exists to stop. Editing was never exposed, purely by luck:
an edit assigns into the array in place and keeps the identity. Only deletes replaced the array,
which is why only deletes came back.

**What actually happened was slightly different from the report, and worse in one way and better
in another.** The DELETE *did* reach the database — the row was really gone. What came back was
a **phantom on screen**, restored from the load-time response the guard closes over. So for up
to twenty seconds the person was looking at a record the database no longer had; and had they
touched it, the sync would have written it straight back.

Two changes, each guarding a different mechanism:
- `save()` now re-points `window.__v59ref`, so the guard means what it was meant to mean —
  "the array was swapped by something that did **not** go through save()", which is the blob
  loader and nothing else.
- `apply()` filters out ids deleted in this tab since load (`_GONE`, recorded where the DELETE
  is issued), so a delete holds even when the blob loader genuinely does land late and a
  re-assert is the correct response.

Guarded by `scripts/qa/probe-delete-sticks.mjs` (12 checks), including two that prove the guard
still does its original job: a swap that did not go through `save()` is still overruled, and
that overrule still does not resurrect the deleted row.

**Two corrections to my own reasoning, recorded because both were wrong in an instructive way.**
(1) I first assumed a re-assert would throw away an edit made moments earlier. It does not:
`apply()` re-maps the *same row objects*, which the app mutates in place, so the edit rides
through. The real harm is that `apply()` rebuilds the **sync baseline** over the edit, so the
next sync sees no difference and never writes it — the note is on screen and never in the
database. The probe now asserts the write, not the memory. (2) Each half of the fix alone masks
the visible symptom, so neither single sabotage goes red; the verification is the sabotage that
restores **both** halves, i.e. the original code, which does. Where two fixes are redundant for
the symptom but cover different mechanisms, say so rather than implying one sabotage proved both.

## 2026-09-02 · Round 31 — "Booked margin" counted an unrecorded cost as zero (fixed)

The same money rule the proposal editor broke in round 29, in two more places: the Operations
board's KPI row (`js/core/core-03-reference-ops.js`) and the dashboard's (`js/core/core-01-foundation.js`).
Both computed Σ(sell − cost) over **every** request, and `+r.cost||0` read a request whose cost
nobody had recorded as a cost of **zero** — so its entire sale was reported as booked margin,
and the percentage printed beside it was computed on that. Three costed requests plus one
uncosted 50,000 SAR job showed a margin of 64,000 at 58%, when the evidenced figure is 14,000
at 23%. Both numbers were fabricated, and neither was reconcilable against anything.

Now: only requests that actually record a cost count toward the margin; the percentage is taken
against those same requests' sales (against the whole pipeline it would understate it); the
requests left out are counted on the tile ("1 with no cost recorded — not counted" /
«بدون تكلفة مسجّلة — غير محتسبة»); and with nothing costed at all the tile reads "—" rather
than a confident 0 SAR. **"Pipeline value" still counts every request**, so no work is hidden —
it is only the *margin claim* that now requires evidence.

*Live today: zero rows in `requests`, so Operations is empty and the tile reads nothing — latent
until the desk is first used, which is exactly when it would have mattered.*

Guarded by `scripts/qa/probe-ops-margin-honest.mjs` (11 checks), two sabotages verified.

**Harness note worth keeping.** The first version of that probe assigned `DB.requests` in the
browser and was silently overruled: `js/35` loads requests from the real tables and then
**re-asserts that copy for ~20 seconds** whenever `DB.requests` changes identity (an anti-clobber
guard against the workspace-blob loader finishing later). A probe's assignment looks exactly like
the clobber it defends against. Fixtures for requests/proposals/projects must be **seeded into
the mock** (`start(PORT, {app_requests: […]})`), not assigned in the page. That same re-assert
window is the mechanism behind the still-unverified "request delete comes back ~20 s later"
report — worth checking next.

## 2026-09-02 · Round 30 — the access screen was calling unknown roles "Admin", and a page you cannot open was still writable

Three defects, one theme: **two parts of the app disagreed about who may do what, and every
disagreement resolved the more permissive — or more misleading — way.** None had bitten yet;
each would bite the first time the feature behind it is used. Guarded by
`scripts/qa/probe-access-truth.mjs` (13 checks), three sabotages verified.

1. **The access matrix showed `operations` and `viewer` users as "Admin."** The screen offers
   three levels (Admin / Manager / Employee), but `app_users.role` has **no check constraint**
   (verified against the live schema) and the app also understands `bd`, `operations` and
   `viewer` — js/49's own CAN table lists all six, and `app_role()` treats them apart. A user
   on one of the other three matched no `<option>`, and a `<select>` with nothing selected
   shows its **first** option — which is "Admin". So the one screen whose entire job is to
   answer "who has admin rights?" answered it wrongly, in the most dangerous direction. Worse,
   an admin who noticed and "corrected" the dropdown to Employee would have silently
   overwritten the person's real role with `team_member`. Such a role is now shown by name and
   marked "not one of the three levels" — visible instead of guessed.
   *Live today: only admin (3) / manager (1) / team_member (7), and `access_allowlist` issues
   only those three, so an off-list role currently needs a direct database write.*
2. **A page you are denied was still writable.** js/49 guards writes by **role**; js/64 bounces
   by the per-user **page matrix** (js/56). They are different models and they disagreed. A
   `team_member` whose Proposals access is set to "No access" passes `can('proposals')` — the
   role writes proposals — so Today's "New offer" tile ran `newOffer()`, which pushes a record
   and `save()`s it on the spot, and only *then* did `render()` bounce them to Today with "You
   do not have access to that page". A blank proposal was created and stored in the database by
   someone denied the page, who never saw it and could not go and delete it. Guarded actions
   now check the page before they write, at call time (js/52 loads after js/49), and never
   block while the role is still unknown.
   *Live today: all 8 non-admin accounts have a page matrix, none is restricted on Proposals —
   but that matrix is exactly what the owner built to restrict people, so this bites on first
   real use.*
3. **A stray `n` saved a blank proposal.** The shortcut opens a *cancellable* form on Invoices,
   Bookings and Leads — nothing is stored until you choose to store it. On Proposals alone it
   called `newOffer()` straight through, so one accidental keystroke while reading the list
   (focus not in a field) wrote a blank `DB-xxxxxx` draft into the database and into the
   proposal counts, with nothing to say it was an accident. It now asks first. The
   **"+ New proposal" button is unchanged** — clicking a button with that label is itself the
   intent — and the probe asserts that difference both ways.

