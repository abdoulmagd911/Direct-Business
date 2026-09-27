**M33 — when a screen draws from a copy, it must say how far behind the copy is; and two backup
schemas that look wide open are not.** Found 2026-09-20 (fire #171).
**The copy.** Airlines exist in two places: `app_state.data.airlines` (**136 airlines, 26 with
contact people**) and the `airlines` table (**139 airlines, 30 with contact people**, contacts
stamped 2026-06-28). **No code in the app fetches the table.** Measured live: `DB.airlines` holds
136 and the register holds 139, so three airlines have never reached a screen — Sereen Air (6Y), the
legacy XX bucket row, and **Air Sial (PF), which the register marks as operating in Saudi Arabia**.
A list that ends early in silence is worse than a short list, because the reader cannot tell "we
have no deal with them" from "they are not in here". Same family as M32 and #159's Events rule: a
copy is fine; a copy presenting itself as the whole truth is not.
Not moved onto the table, deliberately — the page's Edit button writes to the copy, so moving the
read without the write breaks saving, and "move these into real tables" is already a known
structural job. js/92 makes the page state the gap instead, with both numbers and the missing names.
**The guard's brake is that the line must vanish when the two agree**, so the fix cannot rot into
decoration once the real move happens: `scripts/qa/probe-the-airline-list-admits-it-is-a-copy.mjs`
adds the missing airlines mid-run and requires the line to disappear.
**The backup schemas, so nobody raises this twice.** `bak_20260725` and `bak_20260805` hold ten
tables of real company data with **RLS off and zero policies**. A sweep that checks `relrowsecurity`
alone will call that an exposure; it is not. Neither `anon` nor `authenticated` has schema USAGE or
table SELECT on them, so nothing reachable through the API or the app can read them. **The GRANT is
the lock there, not RLS** — check both before reporting a table as open.
*Date: 2026-09-20. Status: ACTIVE.*

**M34 — "no date on file" is its own answer everywhere, not just on the renewals radar.**
Found 2026-09-20 (fire #172), applying #163's rule to the screen that was breaking it hardest. The
Events page's headline counted everything that had not ended, and `hasEnded` answers **false** for
an event with no `start_date`, because `relDay` returns null when there is nothing to compare. Live:
80 events — 22 dated in the future, 37 finished, **21 with no date at all** — and the headline read
**43**. One of the 21 carried its own note saying there is no 2026 edition and the next confirmed
one is March 2027.
The general form: **a null date is a third state, not a quiet member of either other one** — and it
usually names a real job (chase the organiser for dates), so it needs somewhere to live rather than
hiding. Undated records are never removed to make a headline smaller: they keep their place in the
list and get a tile that is a real filter, since a tile that looks clickable and is not would be its
own defect.

> **CORRECTED the same day (fire #177), by the battery.** The first version of this rule said to fix
> such a count by asking whether the record **has a date and that date is ahead**. Applied to this
> tile that was the wrong remedy, and two existing probes caught it within the hour:
> `probe-events-scale` requires that **the move tiles plus the skipped ones add up to the headline**,
> and `probe-audit-events-search-attacks` requires the headline to equal the count of unfinished
> events. Shrinking the headline to the dated ones while the tiles below still counted all of them
> broke that arithmetic — a reader adding up the tiles got 43 under a headline of 22.
> **The tile is also the "show everything" filter, so its number has to stay the whole live list.**
> What was actually wrong was the **word**: "Still ahead" is false for 21 events with no date. So the
> count stays whole and the label tells the truth ("Not finished"), with the undated ones given their
> own tile beside it. The lesson is narrower and more useful than the first draft: **before changing
> what a number counts, find out what else on the screen has to add up to it** — a headline that is
> also a filter is not free to mean something narrower than the list it opens.
Guard: `scripts/qa/probe-undated-events-are-not-counted-as-coming.mjs`. Three brakes: the two counts
must still account for every live record, the undated ones must still be listed, and **the tile must
not be drawn at all when every record has a date**, so it can never settle into a permanent "0".
*Date: 2026-09-20. Status: ACTIVE.*

**M35 — a money figure must name the store it was counted from, and a loader must never cache an
empty answer as the answer.** Found 2026-09-20 (fire #173), in two halves that belong together
because the second was created while fixing the first.
**The figure.** The Today page injects a "Commercial Credit Pool" card whose EXTENDED / RECEIVED /
OUTSTANDING / UTILIZATION, aging panel and green bar all come from `v25PoolCompute`, which counts
**`DB.invoices`** — the invoices array inside the settings record. That array is **empty**; the
company's invoices are in `finance_invoices` (46 live). Stated exactly: the card is **not wrong
today** — the ledger's outstanding really is 0.00 SAR — but it cannot be right on purpose, and would
show the same green 0.0% with a million riyals outstanding. A green all-clear on receivables that is
true by coincidence is what M32 exists to stop.
Not wired to the ledger here: "extended credit" must be defined against the finance doctrine (which
invoices count, what a wallet deduction does, which integrity statuses are real) and that is the
owner's definition, M1 territory where a confident wrong number is worse than none. js/93 names the
source and prints the ledger's own figure beside it, marked when the two diverge, and — per M25 /
fire #141 — shows **no amount at all** to anyone who may not open Finance.
**The loader.** js/93's first version stored whatever its first query returned and set a flag so it
never asked again. That query fires **before the session is ready**, the database answers `[]` with
no error, and the card then reported the ledger as holding **zero** invoices while it holds 46 —
fire #71's registry bug, rebuilt from scratch by the session fixing a different bug. The rule, now
twice-earned: **an empty or failed result is not an answer — never store it, always allow a retry,
and bound the retries so a genuinely empty table cannot spin.**
**And a third thing, for guards:** the first version of the probe detected "the line is marked" by
matching the hex colour in the element's `style`. The browser rewrites a hex colour into its rgb
form when it serialises that attribute, so that check could never fire. A guard tests a **stated fact** — the layer now sets
`data-v93-diverged="1"` — not a rendered colour.
Guard: `scripts/qa/probe-the-credit-pool-names-its-source.mjs`, whose third check (the ledger's real
count, soft-deleted rows excluded) is the one that catches the caching bug coming back. Brake: the
card's own figures must still be drawn.
*Date: 2026-09-20. Status: ACTIVE.*

**M36 — a page never reports a number in another system's name, and "live" is a claim that must be
true.** Found 2026-09-20 (fire #175). Bookings, Invoices and Tickets mirror records Direct owns.
Each printed a row of confident totals — "INVOICES 0 · BILLED 0 SAR · PAID 0 · OUTSTANDING 0 · ZATCA
CLEARED 0/0", "BOOKINGS 0 · TOTAL SALE 0 SAR", "TICKETS 0 · OPEN 0 · REFUNDED 0" — under a banner
reading **"Live from the Direct system — read-only."**
Nothing was live. The **Sync page of this same app** says so in plain words: *"Live two-way sync
arrives with the hosted backend phase."* There is no connection to Direct; those lists are empty
because nothing has ever been brought in. The company's own finance ledger holds 46 invoices, so
"BILLED 0 SAR" was not even this app's own answer. A person opening Invoices was told the figures
came live from the system of record, and that the system of record had billed nothing — both false,
and the second is the sort of thing somebody repeats in a meeting.
Two halves, because the defect had two. **The word "live" is a factual claim about a connection**:
the banner now says Direct is the system of record and this page is read-only, which is true whether
or not anything is ever connected. And **an empty mirror must say it is empty before it shows a
total**, so a zero cannot be read as the other system's answer (js/94, above the totals, naming the
exact wrong conclusion — "these are not Direct's figures").
The general rule: **when one screen in the app contradicts another about whether something is
connected, at least one of them is lying to somebody.** The Sync page's honesty is what exposed this;
a sweep that only read the three mirror pages would have found nothing wrong.
Guard: `scripts/qa/probe-empty-mirrors-do-not-speak-for-direct.mjs`. The brake is that **the line
disappears once the page holds records**, so it cannot become furniture the day an import or a real
sync arrives; and a second check keeps the useful half of the banner from being thrown out with the
false half.
*Date: 2026-09-20. Status: ACTIVE.*

**M37 — a probe that records a hole must be written so it fails when the hole is fixed, and a
"did this reach the browser?" check must measure VALUES, never key names or row counts.**
Found 2026-09-20 (fire #178), by the first full battery run since twenty probes were added.
**The inverted probe.** `probe-share-and-settings-attacks` contained a block that asserted the
agency profile, the audit trail, the blob's invoices and the export controls **DO** reach an
anonymous share-link holder — labelled "EXPOSED:" and "OWNER DECISION recorded:". It passed while
the app leaked and went red the day fires #166 and #167 closed those holes. Recording an accepted
hole is legitimate; asserting it as a passing check is not, because the probe then defends the hole.
**Write such a record as a note, or as a check that holds the fix** — the block is now inverted and
guards against the holes coming back.
**The measurement.** Inverting it was not enough: the checks asked whether `DB.agency` **has the key
`iban`** and whether `DB.invoices.length > 0`. The app seeds its own empty `agency` object and empty
money arrays, so those answer about the app's defaults, not about what the link delivered — and
the old assertions and their inversions could **both fail at once**, which is exactly what happened.
A "did it reach the browser?" check must look for a **value only the sender could have supplied**:
the fixture's own marked IBAN, Amadeus PIN, invoice number and audit line. This is the second time
the same trap has been met (fire #167 solved it with markers in a new probe; this one had it in an
old probe), so it is a rule now, not an anecdote.
**And the third, from the same run:** adding a field to an app object changes what the CSV/Excel
export prints, because the export joins every non-bookkeeping value of a nested object. The contact
provenance added in #177 came out in a lead's contacts cell as a bare trailing word. Fixed in
`exportFlat` with a named set of record-note keys — which also closed the identical leak waiting for
any flagged contact. CLAUDE.md already carried this warning; it was read and not applied.
*Date: 2026-09-20. Status: ACTIVE.*

**M38 — every search over the same records shares ONE haystack, and "is it visible?" is not
`offsetParent`.** Found 2026-09-20 (fire #179), and completed by #180 the next round.
**The search.** The Ctrl/Cmd+K command palette matched a company on `b.name` alone, so the same
company found by its English name answered "No matches." to its **Arabic** name — 18 of the 108 live
companies have one — and was equally deaf to the Direct client ID, the CR/VAT number and the contact
person. Fire #148 had already widened the **Clients page** search to exactly those fields; nobody
widened the palette, so the app's two searches disagreed about what a company is called and the
faster one was the worse one. The rule: **when a second surface searches the same records, it shares
the first one's haystack** — one helper, not two lists that drift. Widening is guarded at both ends:
nonsense must still answer "No matches." and an archived company must still never be offered.
**The measurement.** The first run of the new probe reported that the palette **never opened**,
which would have been a much larger finding. It was false: the overlay is `position:fixed`, and a
fixed element reports `offsetParent === null` **whether it is open or not**, so the usual visibility
test cannot see it. Its real state is the `show` class the app sets. Generally: **before reporting
that a control does not work, confirm the test can see it working** — check the state the app itself
keeps, and be suspicious of a negative result that would be a bigger story than the bug you went
looking for.
**Completed 2026-09-20 (fire #180): there was a THIRD surface.** The top-bar box — "Search leads,
clients, requests, airlines, providers, SOPs" — searched name, Arabic name, segment and the people,
but **not** the legal name, the Direct client ID or the CR/VAT number. So that ID found the company
on the Clients page and nothing in the top bar. All three now call one helper, `recordHay`
(core-01); the rule is not "widen the one that is wrong" but **"there is one haystack"**, because
two correct lists still drift on the third change. What does NOT go in it: the top-bar box's
phone-DIGIT matching (fire #113), which is a mechanism rather than a field and is guarded
separately so the merge cannot quietly drop it.
Guards: `scripts/qa/probe-the-palette-knows-the-arabic-name.mjs`, whose header carries the
`offsetParent` note so the next person does not lose the same hour; and
`scripts/qa/probe-every-search-agrees.mjs`, which asks both surfaces for the same company five
different ways and holds three brakes — nonsense finds nothing, an archived company is offered by
neither, and phone-digit matching still works.
**Finished 2026-09-21 (fire #194): there was a FOURTH surface, and it was the busiest one.** #180
unified three boxes and did not touch the **Leads page filter** — `matchLead` in core-02 — which had
carried its own field list the whole time. Measured against the live database (108 records), the two
lists disagreed in both directions, and each gap has a count: a word from a company's own **notes**
(100 of 108) and the **person it is assigned to** (88) were searchable on the Leads page and
**nowhere else**; its **CR/VAT** (20) was searchable everywhere **except** the Leads page; and its
own **website domain** (25 records whose domain word is not already in their name, of 78 carrying a
website) was in neither list, so a company could not be found by its domain anywhere in the app —
the one thing you hold when a stranger writes to you from a company address. `recordHay` now carries
source, assignedTo, notes and website; `matchLead` calls it, which also ends that box's private copy
of the run-together bug #180 fixed here (contacts joined as name+email+phone with no spaces).
**The thing to take from #180 and #194 together: unifying three of four is not unifying.** When this
rule is applied, count the surfaces first and name the ones left out, in the commit, or the fourth
one sits there for a round wearing the rule as a badge.
Guard: `scripts/qa/probe-one-haystack-for-every-search-box.mjs`, which seeds one record carrying a
unique token per field and asks all four boxes for each token, with two brakes — a word in no field
finds nothing anywhere (a haystack that matched everything would otherwise pass), and name, Arabic
name and a contact e-mail must still work (adopting a shared list must not drop what a box had).
*Date: 2026-09-20, extended 2026-09-21. Status: ACTIVE.*

**M39 — an average must say how many records it averaged, and a card that drops rows must say how
many it dropped.** Found 2026-09-20 (fire #181). The Leads page's headline read **"26 days · Avg
time to win"**. It is computed over won records whose conversion date is on or after `created_at`,
and on the live data that is **8 of the 28 clients** — the other 20 converted *before* this app ever
held them (imported after the fact), so their wait is genuinely unmeasurable and skipping them is
correct. **Skipping them silently is not:** the figure describes under a third of the clients and
reads as the company's number.
The precedent was already in the same card — its neighbour was given "Became clients · 28 of 108" on
2026-09-09 for exactly this reason. So the rule generalises: **when a computed figure excludes rows,
the count it used goes in the label and the count it dropped is explained once underneath.** Two
brakes, always: **silence when nothing is excluded** (a clean dataset must not be apologised for),
and **a dash rather than 0 when nothing can be measured** — 0 days is a claim, "—" is the truth.
Guard: `scripts/qa/probe-the-average-says-what-it-averaged.mjs`.
**And a mechanical trap worth knowing:** this card's injector inserted only the FIRST node its
builder produced, so the explanatory line was built and silently dropped. An injection layer that
emits more than one element must insert them all — and this is invisible to reading, found only by
opening the page.
*Date: 2026-09-20. Status: ACTIVE.*

**M40 — retire a choice by MARKING it, never by deleting the word for it; and a record already
holding that choice keeps it.** Found 2026-09-20 (fire #182). Direct is phasing out three
suppliers, and the app expressed that by deleting their names: `js/core/core-10` wrapped
`render()` and, on every render, walked **every `<select>` in the whole document** and removed any
option whose text matched one of the three. Driven live: the "Provider / GDS" box opened with 24
suppliers and held 23 one render later — the supplier vanished out of an open form with nothing
said — and a booking already recorded against it **read back as an empty provider**, because a
`<select>` handed a value with no matching option reports nothing, so a Save would have written the
blank over the real supplier. The intent was right and is kept; the mechanism was not. The option
now stays, `disabled` and labelled "— being phased out" / «— قيد الإيقاف التدريجي», and stays
**enabled** when it is the value the record already holds. Three traps that go with it:
**(a)** never `hidden` — the OS dropdown shows hidden options anyway (check-structure already
forbids it); **(b)** an `<option>` with no `value` attribute takes its value *from its text*, so
relabelling one changes what a Save writes — pin the value first; **(c)** one source for the list
(`window.DT_PROVIDERS_PHASING_OUT`, exported by the layer that owns the verdicts) so the dropdown,
the Providers list and the verdict card cannot give three different answers about one supplier.
Guard: `scripts/qa/probe-a-supplier-we-are-leaving-keeps-its-name.mjs`, whose brakes are that a
supplier NOT being retired is untouched and that the retired one's stored value is unchanged.
*Date: 2026-09-20, js/96 + js/core/core-10-v29-reports.js. Status: ACTIVE.*

**M41 — a confidence score, a match, a risk score: if nothing measured it, do not print it.** Found
2026-09-20 (fire #183). The ingest forms were dressed as a document reader and read nothing but the
file NAME. Three fabrications, all on screen or in the record:
**(a)** every field label carried a colour-coded percentage from `confidencePill(p)`, with `p` a
literal typed at each call site — driven live, "Ingest invoice" **with no file at all** showed nine,
including a green *"Subtotal (pre-VAT) 94%"* over an empty box and *"Status 100%"* over an untouched
dropdown; **(b)** *"📋 Recognised: Amadeus IUR invoice template"*, and the document language beside
it, came from matching a word in the file name; **(c)** every booking saved through the form was
stamped `fraudScore: Math.floor(Math.random()*15)`.
This is the same rule the money doctrine already states for cost — *never fabricate a number to fill
a gap* — and it generalises to every number that asserts evidence. Say what was actually derived and
where from (`js/97` marks the reference "taken from the file name", **and proves it**: the digits in
the box must appear in the file name, so with no file there is no mark), and say plainly what was
not read. Two traps that come with it: **a half-fixed fabrication is still a fabrication** — round 65
fixed (c) in the migration path, left a comment saying nothing here scores fraud, and the creation
path kept rolling the die for four months; and **a mark that always appears is the same untruth in a
smaller font**, which is why the probe's brakes are the two cases where the mark must be absent.
Guard: `scripts/qa/probe-the-ingest-form-says-what-it-read.mjs`.
*Date: 2026-09-20, js/97 + js/core/core-06-v18-v21.js. Status: ACTIVE.*

**M42 — a permission the owner sets has to be the permission the screen applies, and a screen that
withholds something must say so.** Found 2026-09-20 (fire #184). "Generator" is one of the fifteen
pages in the Team & Access matrix, with a Viewer/Editor setting per person. Driven live with the
matrix saying **Viewer**, all five document editors still offered **"Save draft" and "Issue …"** —
and "Issue" is not a draft: it takes a document number from the server and puts a document out
under Direct's name. Each editor gated on the coarse role (`admin/manager/bd/team_member`) and
never asked the matrix. The database does not enforce this page — only Finance, Settings and
Activity are enforced there, which `js/56`'s own header states — **so on the other twelve pages the
screen IS the enforcement**, and a control that gates on role alone silently voids the owner's
setting. `js/66`–`js/71` now ask `mayEditPage('documents')` too, and `js/98` says why in one line.
Two things this round taught, both worth more than the fix:
**(a) the gate and the explanation must agree about WHEN the matrix counts.** The matrix lands
*after* the page has drawn. The first version took the buttons away as soon as `mayEditPage`
answered while the banner waited for `__pageAccessLoaded===true` — a page that refuses in silence.
Both now wait; not loaded means no opinion. This is the same shape as the `__roleKnown` rule above.
**(b) withhold the write, never the read.** Print / PDF and Copy stay for a Viewer, and the probe
holds that as a brake alongside "an admin still has Save", "an Editor still has Save" and "nothing
is withheld while the matrix is in flight".
**Measured the same day:** of the 11 live accounts, **nobody is set to Viewer on any page** — every
matrix entry is Editor — so nothing was wrong on anyone's screen; the setting was waiting to
mislead the first time it was used. **Nine other pages still ignore `mayEditPage`** (Leads, Clients,
Proposals, Operations, Reports, Events, Airlines, Suppliers, SOP & SLA — Airlines offering 139
editable fields to a Viewer, Leads 83). That is recorded for the owner in `docs/BACKLOG.md` rather
than fixed blind. Guard: `scripts/qa/probe-view-only-on-the-generator-means-it.mjs`.
*Date: 2026-09-20, js/98 + js/66–js/71. Status: ACTIVE.*

**M43 — when a value is in the registry, no document may type it out; and a bilingual document
takes BOTH languages from it.** Found 2026-09-20 (fire #185), in the same footer M-rule #160 had
already been through. #160 removed the invented unified-number and licence literals and left two
more behind, identical in all five client-facing documents: the **branch list as an English
sentence** and the **trade name as an Arabic one**. Both are `company_identity` rows with
`value_en` *and* `value_ar`, both flagged `show_on_documents` — the registry was being ignored for
exactly the two values it holds. Read off the produced document: the **Arabic quotation carried an
English branches sentence**, and the **English quotation carried the Arabic trade name and never the
English one**. The two numeric labels beside them were Arabic-only for the same reason, so an
English document printed Arabic words around its own registered numbers.
Three things worth keeping:
**(a)** the cost is not only language — the registry's English branch value names **one more site**
than the hand-typed sentence did, so the documents had silently gone stale; a value typed into five
files does not change when the owner changes it in the registry;
**(b)** the footer follows the **document's** language (`S.cur.lang`), never the app's — those are
different, and the Contract and the Tender deliberately open in Arabic while the app is in English;
**(c)** #160's doctrine holds — **no literal fallback.** If the registry is silent the line is left
out, label and all. A gap somebody notices beats a stale name nobody checks.
A note for whoever writes the next source-level guard: strip comments before scanning. This round's
own check flagged all five files because the fix's comment quotes the literals it removed — the same
trap check-structure's money rule already documents. Guard:
`scripts/qa/probe-the-footer-is-not-typed-out-by-hand.mjs`, whose brakes are that a registry serving
different values must change the footer, that a silent registry must leave no dangling label, and
that #160's numbers must still print.
*Date: 2026-09-20, js/67–js/71. Status: ACTIVE.*

**M44 — a client-facing document is not a data table: nothing that helps you browse a list may
attach to one, and a document must show every row it has.** Found 2026-09-21 (fire #186). js/04's
pager decorates tables via `document.querySelectorAll('table')` — *every* table on the page — and
the Generator's five documents are built out of tables. Read off the live database, the **Arabic
technical proposal carried "Showing 1–15 of 15", a "10 / page" dropdown, "Show all", "‹ Prev" and
"Next ›" inside `div.td-page.ar`** — English controls on an Arabic document, on the copy a client
receives, and they print. The worse half is silent: page size lives in `localStorage.db_pageSize`,
so anyone who once chose "10 / page" on the Leads list had **every document they generated cut to
ten rows**, the only clue an English line a client would read as part of the document. js/04 now
excludes the document page containers (`#poPages` … `#tdPages`, `.po-page` … `.td-page`,
`[data-doc-page]`), which is the seam to add to if another document family is ever built.
Alongside it, the same round's smaller lesson, which is #185's rule again: **a string inside a
document builder must not use the app-language helper.** Two empty-state lines in `js/68` used
`fl()`, which reads the app's `LANG`, so an Arabic document carried an English instruction. Inside a
document the language is the document's (`S.cur.lang`), always.
**And the probe lesson, which is the important one:** the first version of this guard judged only the
documents the harness can build, whose tables are all under eleven rows — and the pager only
attaches above ten. It **passed against a deliberately re-broken app.** A check that cannot fire is
worse than no check, and the only reason it was caught is that sabotage-testing is mandatory here.
The guard now builds a twelve-row quotation and judges that. Brakes: an ordinary data table must
still get its pager, and that pager must still count and still truncate.
Guard: `scripts/qa/probe-a-document-is-not-a-data-table.mjs`.
*Date: 2026-09-21, js/04-ui-basics.js + js/68-service-fees-tab.js. Status: ACTIVE.*

**M45 — "Today" means today. A figure labelled with a calendar word is counted from local
midnight, never as a rolling window.** Found 2026-09-21 (fire #187). Activity & Audit's Today and
7-day tiles were both `Date.now() - at < N` rolling windows. Read off the live log at 02:30 UTC on
the 21st, **the Today tile said 21 and every one of those 21 changes was dated the 20th** — it
claimed today while today's real figure was nought. Direct works at **UTC+3**, so at 09:00 in
Riyadh a rolling twenty-four hours reaches back to 09:00 *yesterday*: somebody asking "what changed
today" was reading most of yesterday's work with nothing to say so. The 7-day figure had the same
shape and fell from 91 to 86 once corrected, because the rolling version was reaching into an
eighth day. Both are now calendar days from local midnight. Two things that travel with it:
**(a)** a bare `0` under a figure reads as *the thing is broken*, so when nothing has happened today
and the log is not empty the tile says **"nothing yet today — last change yesterday"**, and says
nothing when there IS activity (M39's brake, again);
**(b)** the honest window must not shrink the TOTAL — "Events loaded" still counts every row.
**Probe lesson, the second round running:** the first fixture could not tell the two readings apart —
its rows fell the same side of both windows — so **check 3 passed against the deliberately re-broken
app**. It now carries a row dated *seven days ago but five minutes inside a rolling 168 hours*,
which is the only shape that discriminates. Build the fixture from `Date.now()` at run time, not
from written dates, or the guard goes stale by the calendar.
Guard: `scripts/qa/probe-today-on-the-audit-log-means-today.mjs`.
*Date: 2026-09-21, js/63-undo-and-real-audit.js. Status: ACTIVE.*

**M46 — a port a probe binds by OFFSET is a port it owns, and a gate whose success line overstates
its coverage is worse than no gate.** Found 2026-09-21 (fire #188) by the **full battery**, not by
the gate that was supposed to prevent it. `check-probe-integrity`'s port collector recorded only
literal numbers — `PORT = 9169` and ports written into a `start(…)` call — and never expanded
`start(PORT + 1, …)`. Four probes bind extra mocks that way, one of them reaching seven ports. So
**five probes added across rounds #182–#187 were given base ports sitting inside another probe's
offset range** (9170, 9171, 9172 inside 9169–9172; 9174 and 9175–9177 inside 9173–9179), the gate
printed *"all 319 ports across 296 probes are unique — ternaries and call-site ports included"*, and
the battery reported three reds whose stated reason was **EADDRINUSE, not contention**. The runner's
own honesty note was what made them readable: it re-runs reds alone and says so, and a red that
"did not reproduce alone" for a *resource* reason is a standing fault, not a busy machine.
The collector now expands literal offsets, and for a computed one (`PORT + 4 + i`, whose step cannot
be read from the source) it **reserves a conservative block and says out loud that it did** — over-
reserving can only cause a false clash, never a false clean. A probe can replace the guess with an
exact `PORTS_RESERVED: <lo>-<hi>` declaration; `probe-the-footer-is-not-typed-out-by-hand` carries
one. The count went from 319 to 332, and putting one old port back now fails the gate by name.
**The general lesson, which is why this is a rule and not just a fix:** when a check reports a clean
result, its message must describe what it actually examined. This one had been extended twice before
for exactly this reason (ternaries, then call-site ports) and still claimed completeness it did not
have. New probes now belong in the **9200+** band.
Guard: the gate is its own guard — `node scripts/qa/check-probe-integrity.mjs`, verified by
re-introducing a collision and watching it name both files.
*Date: 2026-09-21, scripts/qa/check-probe-integrity.mjs. Status: ACTIVE.*

**M47 — a control that offers a setting is promising the setting works; where it does not yet, the
control says so in words.** Found 2026-09-21 (fire #189), following #184. Team & Access offers
**No access / Viewer / Editor** on each of fifteen pages, and fire #184 measured that **nine of the
fifteen ignored "Viewer" entirely** — Airlines still offering 139 typeable fields and `+ New airline`
to a Viewer, Leads 83 fields plus Convert, Events even offering **Delete**. The only hint on the
editor was a green dot whose meaning lived in a **`title` tooltip**, naming the three pages the
*database* enforces — invisible on a phone, and answering a different question from the one the admin
is asking. A warning trapped in a hover has already been a defect here once (fire #95).
The editor now marks a Viewer row that is not honoured, in visible text, and names the whole set in
one sentence underneath. Three things make it right rather than merely louder:
**(a) one source** — the list of pages that DO hold lives in `js/52` beside `mayEditPage`, the thing
that decides, and the editor reads it; teaching a page to honour the setting clears its warning by
editing one array (the M40 lesson);
**(b) only where it is relied on** — a page set to Editor or No access is not marked, and a screen
with no Viewer anywhere says nothing at all. On the live roster today that means **no marks appear**,
because nobody is set to Viewer; it arrives the moment one is;
**(c) silence on ignorance** — if `js/52` has not published the list, nothing is marked, because
warning on a guess is its own untruth.
**Also recorded:** the same round confirmed the two "🧹 Wipe … test data" buttons still sitting on
Settings are safe — they filter on `_v22test`/`_v23test` flags and cannot touch a real record — and
that Reports and the Events tiles are honest as they stand (Reports carries its browser-only banner
from fire #91; the Events tiles' arithmetic checks out at 43 live + 37 past = 80).
Guard: `scripts/qa/probe-the-access-editor-admits-what-it-enforces.mjs`, whose brakes are that an
honoured page must NOT be marked, that Editor rows must not be marked, and that emptying `js/52`'s
list must silence every mark rather than leave a stale second copy.
*Date: 2026-09-21, js/52-v76-access-model.js + js/56-access-matrix.js. Status: ACTIVE.*

**M48 — M39 applies to the money page, and "held back" is said out loud with the reason split.**
Found 2026-09-21 (fire #190). The Finance header read **"46 invoices · data through 2026-08-20"**.
Driven live, the page had **91 rows in memory and was dropping 45 of them** — from revenue, cost,
profit, the client tables and the report builder alike — and the words *excluded*, *held back* and
*deleted* appeared **nowhere on it**. `FIN.showDeleted` existed in the state object and was wired to
nothing. Of the 45: **10 carry a recorded `exclusion_reason`** (the Takamol / Techtic verification
revenue CLAUDE.md says belongs to another system — correctly held back) and **35 carry none**,
soft-deleted during the August data work; a month past the 24-hour undo window, with the Archive page
covering companies only, nothing in the app said they existed. `js/99` now says the count at the top
of Finance, **split by whether a reason was recorded**, and adds that the rows are still in the
database so a held-back row is never read as a loss. It costs no query — the loader already fetches
every row and filters afterwards, so this only reports what the page knew and was not saying.
Three things deliberately NOT done: no restore button (money records; the owner's call, not a
session's), no change to any figure, and no sentence when nothing is held back.
**And a probe lesson worth more than the fix:** the sabotage that lumps all 45 into "no reason
recorded" still **passes** the adds-up check, because 0 + 3 sums to 3 exactly as 2 + 1 does.
**Arithmetic that adds up is not arithmetic that is right** — a total and its parts need separate
checks, or a guard proves only that someone did the addition.
Guard: `scripts/qa/probe-finance-says-what-it-held-back.mjs`, whose brakes are that a clean ledger
gets no sentence, that the page's own figures are unchanged, and that the sentence does not follow
you to another page.
*Date: 2026-09-21, js/99-finance-says-what-it-held-back.js. Status: ACTIVE.*

