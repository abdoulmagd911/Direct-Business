## Routine fire #94 (2026-09-18 ~20:30 UTC) — the employee's own browser was deciding the digits
Fire #92's Escape rule and fire #93's M1 hunt both asked the same question: is there a class of defect
with exactly one right answer, so a gate can catch the next one? This round found another.

`toLocaleString()`, `toLocaleDateString(undefined, …)` and `toLocaleTimeString([], …)` **do not mean
English.** They mean "whatever language this laptop is set to". The app has its own language switch
(the EN/AR button), and the two had nothing to do with each other.

**Driven against the real database, app in ENGLISH, browser set to Arabic:**

* a lead's detail page printed its dates as **«٣٠ … ١٤٤٨»** — the **Hijri** year, in Arabic-Indic
  digits, on an English screen, beside Gregorian dates printed by other layers;
* `fmtDate` returned «٢٥ رمضان ١٤٤٧ هـ» and `fmtTime` «٠٩:٠٥ ص»;
* the **client-facing quotation** printed its option totals and its per-passenger figure as
  «١٬٢٣٤٬٥٦٧٫٥» while the headline Total on the same document stayed Western, because that one is
  printed straight from what was typed. **One price document, two number systems**, decided by whose
  machine opened it — and the same split reached the WhatsApp text an agent copies out to a client.

Everything else on screen was already clean, because money elsewhere goes through `moneyShort` or an
`'en-US'` formatter. Ten bare calls in the proposal layer and two printers in the foundation layer were
the whole leak.

**Fixed.** `core-04` got one `omoney()` helper and every price now goes through it; `core-01`'s `fmtDate`
and `fmtTime` name `'en-GB'` in English — what the Today header, Team & Access, Archive and the share
panel had already settled on, the last three after the same Hijri surprise on 2026-09-17 — and both
branches plus the fallbacks now state `calendar:'gregory'`, so no browser setting can put a Hijri year on
a screen again. English dates now read "14 Mar 2026", day first, the same order Arabic already used. Four
smaller fallbacks named their language too (js/07, js/14, core-06, core-08).

**Not changed, and why:** `core-08`'s two `toLocaleDateString('en')` calls sit inside English-only
sentences ("Generated …", "Last learned …"), so naming English there is correct, not a leak. The
quotation's **VAT column stays** — VAT is legally expected on a client-facing document; M1 forbids it
entering cost, profit or revenue, which is a different thing.

**Gate added** to `check-structure`: no file under `js/` may call `toLocaleString` /
`toLocaleDateString` / `toLocaleTimeString` without naming a locale. Unlike the M1 rule measured and
rejected last round, this one has no false positive to worry about — correct code always names a
language. Sabotage-checked by putting one bare call back: the gate fails and names the line.

**Probe:** `probe-dates-and-money-name-their-language` (port 9071, 12 checks) loads the app twice in
English — once in a browser set to `en-US`, once set to `ar-SA` — and requires the two to agree on the
lead page, the quotation and the copy-out text, checks the Arabic app is still Arabic and still
Gregorian, and asserts the gate still exists. Its first check proves the Arabic browser really was
Arabic, so a run that proves nothing cannot read as a pass. Sabotage-verified: 7 FAIL with the fixes
stashed. Three gates green.

**And the full battery re-run found a fault in the QA rig itself, not the app.**
`probe-today-no-money` — the one guarding the 2026-08-21 owner ruling that money belongs to Finance
only — failed three checks at HEAD and at the commit before it. It was not the app: the probe slept a
fixed 5 seconds after signing in, and with 77 script files the app no longer reaches
`__bizTableLoaded` in five seconds, so js/14 had not built the card yet. **The worse half:** its two
real checks — no amount, no currency — were reading a card that did not exist, so they **passed on
empty text**. The ruling would have looked enforced while nothing was being looked at. Both fixed:
the sleeps are now waits on the real conditions, and the money checks are gated on the card having
rendered. Re-sabotaged by putting the value and currency back in js/14's row: 2 FAIL.

**A second one of the same shape, found by the clean re-run:** `probe-period-partition` switched the
Finance period and read the Revenue card after a flat 900ms. It caught the card still showing the
PREVIOUS period — the four quarters summed to the unfiltered total — and failed on a healthy app. It
now reads until the same number comes back twice in a row, and prints the four quarter figures so the
check can be seen to be real (Q1 93,951 · Q2 72,634 · Q3 0 · Q4 0, summing exactly to the year's
166,585). **Full battery at the final tree: 218 / 218.**

**Open for a later round — 108 of the 224 probes sign in and never wait on a condition**, only on a
fixed number of seconds. They all pass today. They are the same shape as the one that just broke, and
they will break the same way as the app grows — quietly, and possibly by passing on absence rather
than by failing. Worth converting to `waitForFunction` on what each one actually needs, and worth
checking each one's assertions cannot pass when the thing under test is missing.

## Routine fire #93 (2026-09-18 ~18:30 UTC) — the importer computed revenue with the VAT taken out of it
Fire #92's static-rule approach worked, so this round went looking for another class a rule could catch,
starting with the highest one this project has: **M1 — cost, profit and revenue must always be clean; VAT
must never enter or be mixed into any of the three.**

Searching every layer for a write that carries the derived money fields turned up two. One is js/65,
**the oversight lane — read, never edited** — and its arithmetic was checked and is **correct**
(`revenue = total`, `wallet_portion = 0`, and `vat_sar: 0` with an explicit comment that it is recorded as
unknown rather than guessed at 15%). The other was js/41.

**DEFECT — js/41 computed `revenue = total − VAT`.** That is M1's prohibition, written out. The doctrine,
the database trigger `finance_derive_fields` (BEFORE INSERT **OR UPDATE**) and js/65's own importer all
say **revenue = total − wallet**. This was the only place in the whole app that subtracted VAT instead.

**It has never produced a wrong stored figure, for two independent reasons**, and both were verified
rather than assumed: every VAT value in the live ledger is 0.00, so the two formulas returned the same
number; and the trigger rewrites revenue whenever it differs from total − wallet by more than a
hundredth. The live ledger is still exactly 46 invoices, revenue 2,030,764.29, cost 1,538,141.70, profit
492,622.59, VAT 0.00, with **0 revenue violations and 0 profit violations**.

**But it is a live path, not dead code.** js/65's importer calls js/41's row builder through
`window.__v65_toRowsDP` — the header of js/41 says it plainly: "these are the only two layers in the app
that CREATE finance rows". A Direct Payments export carrying real VAT, which every DPIN invoice does,
would have had the app's own arithmetic disagree with the ledger it was writing into. **A doctrine that
holds only because a trigger silently corrects it is not being followed**, and it would stop holding the
moment anyone touched the trigger.

**NOT changed, and now asserted so:** a few lines above, the fee-pair maths divides a VAT-inclusive
taxable total by 1.15 to get Direct's net service fee and records the VAT separately. That **removes** VAT
rather than mixing it in, which is exactly what the doctrine wants. **The static rule this round set out
to add was measured against the real code, would have flagged that correct line, and was rejected for
that reason** — a gate with a false positive on correct doctrine code is worse than no gate, because it
teaches people to bypass it. Fire #92's rule worked because Escape has one right answer; M1 does not have
one statically-visible shape. Recorded so nobody adds it later for symmetry.

`probe-import-revenue-has-no-vat-in-it` added (11 checks) and sabotage-verified: with the js/41 edit
stashed, 2 go FAIL, exit 1. It feeds the **real parser** a synthetic export carrying a **real 15% VAT
line** — the case live data cannot produce — so the two formulas finally disagree (1,850 against 1,700)
and the right one is asserted. Everything in the fixture is invented; no real company, invoice or amount
appears. Three gates green; 19 money, import and printed-arithmetic probes re-run at HEAD: 19 of 19 green.

One self-correction inside the round: the probe's first version ended with a check that read `true ===
true`, which can never fail — the exact tautology the integrity gate exists to catch. It now asserts the
real thing beside it: the wallet top-up in the fixture is still skipped entirely and never becomes a row.

## Routine fire #92 (2026-09-18 ~16:30 UTC) — stopped hand-picking boxes and made it a rule; the rule found five more
Fire #91 left one named gap: the share-links panel, the one box of twelve not reached. Closed it — js/77
exposes its opener as `window.shareLinksPanel` (two earlier passes had guessed a name that does not exist
and looked for a button by its wording) — and it was **the third overlay ignoring the Escape key**.

Three in two rounds is not three accidents, so this round stopped guessing at boxes and **added the rule
to `check-structure`**: any file in `js/` that builds a fixed, full-screen element must mention Escape. It
is deliberately a crude test — the word, in the same file — because the alternative is no test and a
fourth round finding a fourth box. It ran once and **named five more**:

- **js/09** — the funnel-details editor for a lead. A real form. Fixed.
- **js/15** — the admin page-access overlay. Fixed.
- **js/49** — the permission message box. Fixed. It legitimately refuses a stray backdrop click, because
  its whole job is to be acknowledged; Escape and its own OK both work, which is enough.
- **js/58** — the fallback confirm box. js/57 loads first and defines the real one, so this never runs in
  practice, but it is the same shape confirming the same destructive things. Fixed the same way: Escape
  **cancels**, and the yes-callback is never called.
- **js/50** — the sign-out banner, which **must not be dismissible**. It is not a dialog: it has no
  button at all, and a real sign-out follows a moment later. Letting Escape hide it would leave somebody
  at a login screen with no idea why. It satisfies the rule by saying exactly that in a comment — the
  escape hatch the check was built with — and the probe asserts both halves: the rule still exists, and
  this exception is still explained.

Driven live after each fix: **fourteen boxes, both languages, every one closes on Escape**, and all but
the acknowledge-box also on a click outside. Read-only; nothing written.

**A pre-existing bug found while doing it and fixed:** `check-structure` derived the repo root from the
*current directory* — it looked for index.html in `.` then `..`, so running it from anywhere else died on
`ENOENT: /index.html` before checking a single rule. A pre-deploy gate that only works from one directory
is a gate that can be skipped by accident. It now resolves the root from its own file location, the way
its two sibling gates already did, and was verified from `/tmp`.

`probe-escape-closes-every-box` extended to 12 checks covering fourteen boxes plus both halves of the new
rule, and sabotage-verified: with all seven edits and the structure rule stashed, 4 go FAIL, exit 1. Three
gates green; 15 dialog, share, role and structure probes re-run at HEAD: 15 of 15 green.

Two instrument corrections, both named in the scripts: the "is there a way out" test did not count an
**OK** button, so js/49's box — which offers OK and nothing else — was reported as having none; and the
first version of the new rule read `js/` by a path relative to the working directory, which the
probe-integrity gate caught as CWD_PATH and which is now resolved from the file's own location.

## Routine fire #91 (2026-09-18 ~14:30 UTC) — could you get out of every box? Two of them ignored the Escape key
Area chosen after checking BACKLOG first, per the rule fire #90 added: **keyboard escape from dialogs.**
js/10 has carried a comment since 2026-09-10 saying "the missing-Escape gripe is app-wide; at least this
dialog obeys", and nobody had driven it. Reading the code explains why it would be: js/35 added a global
Escape handler on 2026-08-08, but it only ever looks at `#modal` and calls `closeModal()` — so every
overlay any layer builds outside that one element is on its own.

Driven with the **real Escape key** against every box a person can open, in both languages, read-only
against the real database with every write blocked. Nothing was saved.

CLEAN: the nine boxes built on the shared dialog (lead form, log activity, corporate profile, chain of
command, client onboarding, new supplier, new SOP, the snapshot browser) all obey Escape AND a click
outside — js/35's handler doing its job — and so does the events form, which wired its own in September.

**DEFECT — two overlays ignored the key**, identically in English and Arabic:
- **`#pfConfirmBox`** — the in-page confirm box, which is the box behind **every "are you sure" in the
  app**. It exists because a native `confirm()` freezes the whole tab, so everything destructive routes
  through it. Escape did nothing.
- **`#v48ov`** — the Team & Access overlay. Its sibling `#v53ov` in the same file had the same gap and
  was fixed with it.

Both already closed on a click outside, so nobody was ever trapped — Escape is simply the reflex, and on
a confirm box it is the universal one. Escape now takes exactly the path the Cancel button and the
outside click already took, and each listener is removed with its own box so it cannot outlive it or
stack when the box is reopened. `#v53ov`'s close also reloads the ledger, so Escape goes through `close()`
rather than just removing the element — otherwise leaving by keyboard would skip the refresh that leaving
by button does.

**The check that matters most is not that Escape closes the confirm box — it is that Escape CANCELS it.**
Since pfConfirm gates every destructive action, an Escape that confirmed instead of cancelling would be
far worse than one that did nothing. The probe presses Escape on a live confirm box and asserts the
yes-callback never ran, twice in a row.

`probe-escape-closes-every-box` added (9 checks) and sabotage-verified — with both edits stashed, 3 go
FAIL, exit 1. Three gates green; 21 dialog, confirm, delete and role probes re-run at HEAD: 21 of 21
green, with the excluded list subtracted.

Two self-errors, both the instrument, both caught by the result being implausible: the first pass read
"is there a visible way out" from `document.body` **after** the box had already been dismissed, and duly
reported that almost every dialog in the app has no ✕ and no Cancel — which `openModal` visibly renders;
and the share-links panel was opened by a guessed function name (`v77Open`, which does not exist), so it
never opened. **Honest gap: the share-links panel was not reached in either pass** and is the one box of
the twelve still unmeasured for this.

## Routine fire #90 (2026-09-18 ~12:30 UTC) — a fully green battery, and a round that correctly found nothing
**THE BATTERY, AT HEAD: 215 of 215 probes that can fail exited 0 — and not one went red even under
load.** No probe needed re-running alone; the "did not reproduce" line never printed. That is the
cleanest run of this session. 221 entries, 6 of them declared reports with no assertions.

This run carries **no caveat**, unlike fire #85's: it started at `05bbe06` with a clean tree, so it
includes every change of fires #85–#89 — js/10, js/56, js/21 (three rounds of it), six core files and the
new js/84 — and all six probes added in those rounds. The only edit since it started is this document and
the playbook.

**The area picked for this round — Reports — turned out to be already covered, and that is the finding.**
Driven live in both languages across all four tabs (Overview, Achievements, Objectives & KPIs, Generate
Report), against the real ledger: 46 invoices, revenue 2,030,764.29, cost 1,538,141.70, profit 492,622.59,
VAT 0.00 on every row. The page is clean: both languages show the same numbers and the same cards, nothing
is written by opening it, the tab bar and every objective card read Arabic, and the generated report's
"Actual (year to date)" column shows **—** rather than inventing a figure, which is the cost rule working
exactly as written.

Three things worth recording:
1. **Rule 8 was checked and is not violated.** Reports shows objectives, KPI progress and achievements —
   the appraisal project's vocabulary — which looked alarming. It is this app's own small feature:
   `DB.achievements` in this app's own workspace blob, and **nothing anywhere in the repo references
   `byhxnmafaumersoaiybq` or `directksa-performance`**. Checked without reading that project.
2. **The KPI table being English is an OWNER DECISION, already recorded.** Fire #59 drove this same page
   on 2026-09-16, fixed 37 Arabic strings, and deliberately left the 42 KPI names and their 126 focus
   lines in English because they are the owner's own plan wording — BACKLOG line 1053, and a comment
   directly above the code says so. I re-found it as a "defect" and was one step from overwriting a
   recorded decision. **Two lessons went into the playbook:** grep BACKLOG for an area before calling it
   untested, and read the comment above the function before changing it.
3. **Two findings this round were my instrument, not the app**, and are named as such: KPI *targets*
   (20,000,000 and 6,000,000 SAR, labelled «الهدف») read as money larger than the whole ledger, and a
   digit-run regex that welded separate numbers into "71,238,285".

Coverage is now genuinely broad — fires #45–#89 have driven every page, every role, both languages, the
phone widths, print, deep links, share links, the write paths, the money doctrine and the dialogs. A round
that finds nothing is a result; the playbook now says so rather than leaving the next session to invent
work.

**The two decisions still waiting on the owner, re-measured today rather than repeated from memory:**
- **19 invoices carry no cost** (all of them a stored `0`, none null) and between them hold
  **214,550.00 SAR** of profit that nobody has verified. Clearing those to null is reversible and changes
  no screen — the screens already read 0 and null the same way.
- **The promo registry contradicts itself:** 200 codes, of which **165 are marked active AND expired**,
  and 29 active only. The card that would show them is switched off by the owner's own ruling, so nothing
  is displayed wrongly today.

## Routine fire #89 (2026-09-18 ~10:30 UTC) — Today's money chips count an empty box
**First, a correction to fire #88's own closing note.** It said the Team-access overlay was entirely
English and needed a round. Driven for real: **the panel a person actually gets is fully Arabic.** Its 72
strings include 22 English ones, and every single one is a real staff name or email address — data, which
must never be translated. The panel I had looked at is js/02's `openTeam` (`#teamModal`), and its own
comment says js/31 repoints the Team button to `v48Users()` within 1.5 s of load, which is why clicking
that button never produced it. The legacy one is a dormant fallback. It is **deliberately left alone**:
it is normally unreachable, and js/02 is the sign-in layer, where a mistake locks the whole team out —
not a file to edit for a panel nobody reaches.

**Then Today, the first thing every employee sees each morning**, driven against the real database in both
languages with every write blocked. Nothing was saved.

CLEAN, and worth saying: the app's own memory matches the database exactly (108 live companies, 80 leads,
28 clients); both languages show identical numbers and the same three cards; the page writes nothing when
opened; and the only English left on the Arabic version is "Direct Payments" and "Ctrl", which are a
system's name and a keyboard key.

**THE FINDING — four of the five chips count a box that is always empty.** core-06's `renderToday` reads
`DB.bookings`, `DB.invoices` and `DB.offers` — the workspace blob. Measured live, in both languages:
**invoices 0, bookings 0, offers 0, requests 0.** The real money is in the `finance_invoices` table — 46
invoices — which Today never looks at. So "0 Overdue invoices", "0 Tickets due soon", "0 Being chased" and
"0 Low-profit offers" are not measurements; they are an empty box being counted, under a hero line reading
"Nothing urgent right now — all clear."

It reads correctly **today** — all 46 invoices are fully received and nothing is outstanding, so zero is
the true answer — which is exactly why this had gone unnoticed. The moment one is not, Today will still
say zero.

**What was NOT done, on purpose.** Today was not rewired to read `finance_invoices`. What counts as
overdue, which due date applies and how aging is read are money decisions with rules attached; the Finance
page already does all of it properly; and it is the owner's call, not the side effect of a QA round.

**What was done:** a new layer, `js/84`, adds one line under the chips — in both languages — saying they
count records kept in this app, that invoices and bookings are minted in Direct Payments, and where the
real ledger is. No number changes and nothing is hidden. **It takes itself away the moment any of those
collections holds a record**, so if the app ever does start keeping them the note stops appearing without
anyone removing it — that second half is what stops the note becoming a permanent untruth of its own, and
the probe checks it.

`probe-today-chips-say-their-source` added (9 checks) and sabotage-verified: with js/84's contents
neutered, 4 go FAIL. (Deleting the file scores 5, but the fifth is only the 404 from index.html's script
line — the header says so rather than claiming the higher number.) Three gates green; 16 other probes
re-run at HEAD: 16 of 16 green, this time with `battery-excluded.txt` subtracted automatically, which is
the habit fire #88 added to the playbook after tripping over it twice.

## Routine fire #88 (2026-09-18 ~09:00 UTC) — the coverage gap, corrected; and every error message spoke only English
Fire #87 ended by naming eight dialogs that "did not open". Running that gap down showed **four of the
eight were my own list being wrong, not the app** — worth writing down, because a wrong list reads exactly
like missing coverage:
- `findDuplicate(kind, fields)` is a LOOKUP that returns a record. It is not a dialog at all.
- `editCorporate` wants a LEAD id, `genStatementOfAccount` a client, `v40Hold`/`v40Touch` a lead. All four
  had been called with an empty string.
- "New invoice" and "New booking" are `newInvoice` / `newBooking`, not `editInvoice('')` — and those, with
  `recordPayment` and a dozen more, sit in core-08's v25 HIDE list. They are hidden **on purpose**,
  because Direct Payments is the system of record for money. Not a gap; the doctrine working.

**Fixed: the Corporate profile.** The last reachable dialog still in English — 8 labels, 4 prose hints and
its title, identical whether opened from a client's card or a lead's. Both entry points now read Arabic.
The **Statement of account** needed one more title prefix, visible only once it opens, which it never does
against live data (0 invoices — it says "no invoices for this client" and returns before building itself).

**And that sentence is what opened the second half of this round.** It is what a person actually gets when
they ask for a statement, and it was English, in an Arabic session. Counting the class found **seventeen
English-only messages** across core-01, core-04, core-06, core-08, core-10 and js/02 — a blocked pop-up, an
unlinked proposal, a file that would not import, no invoices selected, a missing email address, "pick a
project", "generator unavailable". These are the last thing somebody reads when something does not work,
and every one of them spoke only English. All seventeen are now bilingual, in the app's own established
inline form. **This is about the words, not the box:** a native `alert()` is this app's house style for a
message and is used about 150 times; what was banished, and stays banished, is native `confirm()`, which
freezes the tab. Nothing here changes which box is used, and probe-no-native-dialogs still passes.

Two probes: `probe-arabic-dialogs-complete` extended to 24 dialogs (14 checks, sabotage 5 FAIL), and
`probe-messages-bilingual` added (5 checks, sabotage 3 FAIL). That second one **reads the source rather
than driving, and says so in its own header rather than implying otherwise**: each of these messages sits
behind a state that cannot be manufactured honestly — a browser that really blocks a pop-up, a file that
really fails to parse — and three separate drives against the seeded data produced not one of them. The
defect itself IS the source, so the source is what is checked, across all eleven core and login files,
which catches every message including the ones no drive could reach.

Three gates green. 24 other Arabic, dialog and attack probes re-run at HEAD: 24 of 24 green.

**Repeat self-error, now written into the playbook:** `probe-golive` exited 1 in that sweep and looked like
a regression. It is credential-gated and listed in `battery-excluded.txt` — it signs in as a real member of
staff and the rig refuses without the password. This is the **second** time an ad-hoc re-run list has swept
up an excluded probe (fire #85 did it with `probe-freeze`), so the playbook now says to subtract
`battery-excluded.txt` before hand-picking probes, and to look there first when one fails.

Named for a later round, not done here: js/02's own Team-access overlay (`#teamModal` — "Team access",
"Add a teammate", "Full name", "Close") is built as inline HTML outside `#view`, `.top` and `#modal`, so
js/21's passes cannot reach it at all — the same shape as the skip-links note already in that file. It
needs its own bilingual pass in js/02, which has an `L()` helper already.

## Routine fire #87 (2026-09-18 ~07:00 UTC) — the half-translated form was a class, not one form
Fire #86 fixed the lead-edit form. Every dialog in the app goes through the same translator, so the same
three failures were waiting everywhere: it matches whole strings, it skips any label that wraps an input,
and it had never touched a placeholder. So all 23 dialogs were opened in Arabic, against the real database
with every write blocked at the network edge, and what was still English in each was counted. Nothing was
stored — no dialog wrote anything just by being opened.

**Found and fixed, beyond #86:**
- **Client onboarding** — the form v36 deliberately collapsed as a duplication of Direct's own client
  master. Hidden is not deleted: it is still reachable, and it was **entirely** English — 19 labels, 3
  hints, 3 buttons and its title.
- **Chain of command** — 7 labels (several repeated per row), 4 buttons and its title.
- **The snapshot browser** — its heading, and **117** English "Restore" buttons.
- **The Sync log** and the **ZATCA hash-chain report** — their headings.
- **New supplier** — its "New provider" heading. **New request** — its one prose hint.
- **A fourth failure this file had no mechanism for at all:** a dialog title of the shape
  `<English prefix> — <the record's own name>`. The whole string can never match a dictionary (it carries
  live data) and the existing helper only strips a TRAILING decoration, so "Log activity — «company»" and
  "Chain of command - «company»" stayed English on every dialog that names its record. Only the prefix is
  translated now, and the name after it is never touched.

**Three more that the live database cannot reach at all** — it holds 0 invoices, 0 bookings and 0 requests,
and all three forms look their record up and return early — so they were opened on the mock, which has
them seeded: **Edit invoice** (11 labels), **Edit booking** (19 labels and 2 hints) and **Record a
payment** (3 labels, 1 hint), plus the `Edit INV-3001` / `Edit BK-2001` title shape, which is a prefix and
a reference separated by nothing but a space. The word "Edit" alone is far too common to translate on
sight, so the remainder has to LOOK like a reference — capitals, digits and dashes — which leaves "Edit
client profile (full form)" and anything else wordy alone.

**Deliberately left English, and the probe asserts they are STILL there** so nobody "tidies" them later:
WhatsApp and the supplier form's EMD (names, not words); a lead's or client's own dialog title, which IS
the company name; the supplier form's own vocabulary — `320ms`, `P1 < 1h`, `BSP / card / credit / wallet`,
`GDS / NDC / Direct portal / Aggregator (Travel Fusion)`, `60% NDC / 30% EDIFACT / 10% LCC`; the invoice
and booking examples `300xxxxxxx00003`, `GDS / NDC / OTA / Direct` and `SV-1234567 / EY-5555` (a VAT-number
shape, a GDS list, and two real airline prefixes — SV Saudia, EY Etihad); `SA…` and `https://…`; and the
activity types, whose text IS what gets stored. Every industry acronym was kept and only the words around
it translated — PNR, RBD, FFN, ADM, BSP, IATA SIS, ZATCA. **No field's meaning or stored value changed;
these are labels only, and M1 is untouched — the invoice form's VAT-rate and pre-VAT-total labels were
translated as they read, nothing was added to or removed from any money figure.**

**End state, measured twice:** all 18 dialogs that open are clean on the mock, and every English string
left against live data is one of the deliberate keeps.

`probe-arabic-dialogs-complete` added (12 checks, covering all 20 dialogs including the three live data
cannot reach) and sabotage-verified — with the fix stashed, 5 go FAIL, exit 1. Three gates green. Because
this round added broad words to the shared dictionary (Email, Phone, Fare, Taxes, Method, Validity …),
**30 Arabic, dialog, table and export probes were re-run at HEAD: 30 of 30 green**, the
option-values-are-data probe among them.

Honest coverage gap: 5 dialogs opened in neither pass — New invoice and New booking (both return early
without a record, by design), Corporate record, Statement of account, Find a duplicate and the two v40
request actions. Worth a round of their own with the mock seeded for each.

## Routine fire #86 (2026-09-18 ~05:00 UTC) — the lead form was half in Arabic and half in English
Untested area this round: the **contacts** write path, and with it the lead-edit form it lives in. 45 real
contacts across 36 companies (one has 4, six have 2); js/72 attaches 32 of them to their cards. Driven
live in both languages with every write intercepted — nothing stored, confirmed after: still 45 contacts,
still 2 flagged, no QA phone number, and the "removed from the card" flag still never fired.

**The write path is CLEAN.** Opening a company's real edit form, changing one contact's phone and pressing
the real Save sends exactly one contact write, filtered to that one contact, carrying only name / email /
phone; nothing the person did not touch is rewritten; nobody is flagged as removed when nobody was
removed; and no table-sourced contact is written back into the company's own row, which would have made it
exist twice. Layout is correctly right-to-left in Arabic.

**DEFECT — the form read in two languages at once.** Measured in the Arabic form: **11 of 24 labels and
all 8 placeholders were English**. A half-translated form is worse than an untranslated one; somebody
filling it in Arabic met English half way down. Three structural causes, not one oversight:
- the communication-channel chips are `<label><input type=checkbox>Email</label>`, and js/21's label pass
  deliberately skips a label that wraps an input — that rule is what stops free text being flattened. The
  chips are a fixed list whose STORED value is the value attribute, never the text, so they now get their
  own narrow pass, found by their own class. WhatsApp keeps its own name.
- placeholders are attributes, and this file had only ever patched one of them (the global search box, by
  id). There is now a pass for them, with the English remembered for a clean switch back.
- the contact rows are the one part of a dialog rebuilt **after** the dialog's own pass: `openModal` calls
  `drawContacts()`, core-02 calls it again with the company's people, and adding or deleting a row calls it
  again. Each rebuild replaced the inputs with fresh English ones. Identified as timing rather than
  matching by calling the translator by hand right afterwards, which produced the Arabic correctly. js/21
  now wraps the redraw, so it also holds after somebody adds or removes a row.

After: 24 labels with **one** English left — WhatsApp, which is right — and **zero** English placeholders.
The English form is untouched.

**Deliberately NOT changed:** the activity types (Call / Meeting / Note …) stay English. They carry no
`value` attribute, so their text IS what gets stored — js/21's own universal rule, written there after a
2026-09-02 round found an Arabic word saved as a service-bundle type. The probe asserts they stay English,
so nobody "fixes" this later.

`probe-arabic-lead-form` added (11 checks) and sabotage-verified — with the fix stashed, 7 go FAIL, exit 1.
Three gates green. 20 other Arabic, dialog and translation probes re-run at HEAD: 20 of 20 green.

Self-errors this round, all in the instrument: blocking the load RPCs left the app on its 65-record demo
seed and made a first reading worthless; `readContacts()` takes no argument (it reads the edit form's
working list, not a company's), so a per-company measurement of it meant nothing; and the probe first
called `openLeadForm`, which does not exist — the real opener is core-02's `editBusiness` — and reported
an empty form as a translation failure. Each was caught by the result being implausible on its face.

## Routine fire #85d (2026-09-18 ~04:30 UTC) — full battery green, plus a hand re-run of everything this round touched
**209 of 209 probes that can fail exited 0**, run with the repo's own `run-battery.sh` (the trustworthy
one — it writes each probe's output to a file, takes the real exit code, and re-runs every red on its own
before printing a number). 6 entries are declared reports with no assertions. One probe went red under
`-j 3` and **did not reproduce alone**: `probe-today-no-money`. That is counted green because it passed
with the machine to itself, which is the honest reading of one run — but the runner's own warning applies:
a probe that lands there run after run is a race, not a busy machine. First appearance for this one; worth
watching, not chasing.

**The honest caveat:** that run started at `8ad14af`, before this round's two fixes (js/10, js/56) and
before the two new probes existed. So everything the changes touch was re-run by hand at HEAD — every
probe in `scripts/qa/` that mentions the events layer, the access matrix, roles, page access, native
dialogs or the Settings panel: **21 of 21 green**, including both new probes.

One self-error in that re-run, worth writing down because it looked exactly like a regression for a
minute: `probe-freeze` exited 1. It is not a regression and not a defect — it is listed in
`battery-excluded.txt` as credential-gated (it signs in as a real member of staff, and `emp-rig` reads
those passwords from `DB_PW_*`, which are never in this repository, so the rig correctly refuses rather
than testing nothing). My blanket re-run swept up an excluded probe. The exclusion list is the answer to
"why did this one fail", and checking it should come before reaching for a bisect.

Also checked read-only this round and needing no work: the **share-link** write (`insert({scope,
created_by})` — the 64-character token is generated by the database, `active` defaults true, and the
design is revoke-not-expire with js/77 as the panel for it, which is deliberate, not a gap); and the
**client-profile** write, which carries no money field at all and says on screen that the numbers are
entered on Finance — M1 respected, and the M13 silent-refusal wording is already there.

