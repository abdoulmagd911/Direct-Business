## Routine fire #189 (2026-09-21 ~07:00 UTC) — Team & Access offered "Viewer" on nine pages where it does nothing

Fire #184 fixed the Generator. This round I went to the screen where you make the choice.

Team & Access lets you set each person to **No access / Viewer / Editor** on each of fifteen pages.
The dropdown looks the same on all fifteen. It isn't: **nine of them ignore "Viewer" completely.**
Set someone to Viewer on Airlines and they can still add a carrier and type into 139 fields. On
Leads, 83 fields plus Convert. On Events they can still press **Delete**.

The only thing on that screen hinting at any of this was a small green dot whose explanation appeared
only if you hovered a mouse over it — so invisible on a phone — and it answered a different question
anyway: it named the three pages the *database* also enforces, not the nine your choice doesn't reach.

**Now it says so plainly.** A page set to Viewer that doesn't honour it is marked **"not enforced
yet"** on its own row, and one line underneath names them: *"9 of the pages set to Viewer do not check
that setting yet, so this person can still change things there: Leads, Clients, Proposals,
Operations, Reports, Events, Airlines, Suppliers, SOP & SLA. The setting is saved and will take effect
as each page is taught to honour it."*

Three things keep it from becoming noise:

- it only marks a page you have actually set to **Viewer** — Editor and No access rows stay clean;
- **on your screens today nothing is marked at all**, because nobody is currently set to Viewer. I
  drove the real Team & Access page against your live roster: 11 people, 131 page dropdowns, zero
  marks. It appears the moment you choose Viewer on one of the nine;
- the list of pages that *do* honour it lives in one place next to the code that decides, so when a
  page is fixed its warning disappears by editing one line — it cannot drift into telling you the
  wrong thing.

This replaces guesswork with a promise you can act on: **BACKLOG item 16 is now visible inside the
app, on the screen where it matters**, instead of only in this file.

**Verified and left alone in the same pass,** so you know they were looked at: the two "🧹 Wipe test
data" buttons still on Settings are harmless — they only remove records tagged as test data and
cannot touch a real one. Reports is honest (it carries its "kept in this browser only" banner and
reads zero because nothing is logged). The Events tiles add up: 43 not finished + 37 past = your 80
events.

Guarded by `scripts/qa/probe-the-access-editor-admits-what-it-enforces.mjs` (9 checks). Brakes: a page
that *does* honour the setting must not be marked, Editor rows must not be marked, and emptying the
source list must silence every mark. Sabotage-verified both ways — marking everything fails two
checks, marking nothing fails three. New rule **M47**.

---

## Routine fire #188 (2026-09-21 ~05:00 UTC) — full test run: 282 of 282 green, and it caught a fault in my own testing

Seven fixes had landed since the last full run of the whole test suite, one of them in a shared piece
of code every table on every page uses. So I ran the lot: **288 entries, 282 of them able to fail,
and all 282 green.** Nothing those seven fixes touched has broken anything else.

**But the run found something the individual checks had missed, and it was mine.**

Three tests went red when run together and green when run alone. The suite is honest about that
distinction — it automatically re-runs its own failures one at a time before reporting — and normally
"green alone" means the machine was simply busy. Not this time: their stated reason was that **two
tests were trying to use the same network port**. That is a standing fault, not a busy machine, and
it would have happened on every single run from now on.

The cause: some tests open several mock servers at once, on their own port plus the next few. The
checker that guarantees no two tests share a port only ever counted the *first* one. So **five tests
I added over the last six rounds were given ports sitting inside another test's range**, while the
checker printed "all 319 ports are unique". It had been extended twice before for exactly this kind
of blind spot and still claimed to be complete.

Fixed both halves: the five tests moved to a clear band, and the checker now counts the extra ports
too — 332 of them rather than 319. Where it genuinely cannot work a number out from the code, it
reserves a block and **says out loud that it guessed**, so the message never overstates what it
checked again. I proved it works by putting one of the old ports back: it now names both files and
fails. And I ran all nine affected tests together, under the same conditions that exposed the
problem — 9 of 9 green.

**Also tightened:** a timer I added two rounds ago kept checking every 1.5 seconds for the life of
the page. It now stops as soon as it has its answer. This is an app people leave open all day.

New rule **M46**, written as a general one: *when a check reports a clean result, its message must
describe what it actually examined.*

---

## Routine fire #187 (2026-09-21 ~02:30 UTC) — the "Today" figure on Activity & Audit was not today

Opened **Activity & Audit** against your real log — 360 changes, written by the database itself.

The three figures across the top read **Events loaded 360 · Today 21 · 7-day 91**. But it was
half past two in the morning on the 21st, and **every one of those "21 changes today" was dated the
20th.** Today's real figure was nought.

The tile said "Today" and was counting *the last twenty-four hours*. You work at UTC+3, so at nine
in the morning in Riyadh that window reaches back to nine o'clock **yesterday** — anyone checking
what changed today was reading most of yesterday's work, with nothing on screen to say so. The
7-day figure had the same fault and was reaching into an eighth day; corrected, it reads 86, not 91.

Both now count calendar days, starting at midnight, which is what both labels say.

And because a bare **0** reads as "this thing is broken", the tile now says why when there is
nothing yet: **"Today 0 — nothing yet today, last change yesterday."** When there *is* activity
today, that line doesn't appear.

**Verified clean while I was in there,** so you know it was looked at: the log correctly explains
its own gaps. 216 of the 360 entries have no name against them — they are the bulk database work
from 22 August, 2 September and 9 September — and the page already says *"unknown — changed
directly in the database, not via the app"* and *"past the 24-hour undo window"* rather than
pretending. That is right, and I left it alone.

Guarded by `scripts/qa/probe-today-on-the-audit-log-means-today.mjs` (8 checks). Brakes: a change
made today must still count, the "nothing yet" line must vanish when there is activity, and the
total must not shrink. Sabotage-verified: the old rolling windows fail five, with Today reading 1
when the only change was yesterday. New rule **M45**.

**Second round running, the same probe lesson:** my first fixture could not tell the two ways of
counting apart, so that check passed against the app I had deliberately re-broken. It now carries a
change dated seven days ago but five minutes inside a rolling window — the only shape that
distinguishes them.

---

## Routine fire #186 (2026-09-21 ~00:30 UTC) — your documents had the app's page controls printed on them, and were quietly dropping rows

Read all five produced documents against your real data, in both languages. Two things, one visible
and one silent.

**The visible one.** Your Arabic technical proposal carried this, inside the document page itself:

> Showing 1–15 of 15 · [10 / page ▾] · ‹ Prev · Next ›

That is the app's own table-paging bar — the thing that helps you flip through a long list on screen.
It had attached itself to the tables inside your client documents, in English, on an Arabic document,
and it prints. A client opening the PDF would see it.

**The silent one, which matters more.** That bar does not just display a number — it *hides rows*.
The page size is remembered in your browser, so **anyone who had ever picked "10 / page" on the Leads
list was generating documents cut down to ten rows.** A fifteen-row fee table would print ten and
drop five, and the only sign would be that English line, which a client would read as part of the
document. Nothing on screen said anything was missing.

The cause: the paging code was told to decorate *every* table on the page, and your documents are
built out of tables. It now leaves document pages alone. Your normal lists keep their pager exactly
as before — Airlines still reads "Showing 1–20 of 136".

**Also fixed in the same round:** two lines on the service-fee document ("Pick a scenario or add
services…" and the identity note) followed the *app's* language instead of the *document's*, so an
Arabic document carried English instructions. Same mistake as fire #185's footer, different lines.

Guarded by `scripts/qa/probe-a-document-is-not-a-data-table.mjs` (8 checks). Brakes: an ordinary list
must still get its pager, and that pager must still count and truncate correctly.

**Worth telling you, because it nearly went wrong:** my first version of that guard could not
actually catch this. It only looked at documents the test harness can build, and those all have short
tables — and the paging bar only appears above ten rows. It **passed against an app I had
deliberately re-broken.** A check that cannot fail is worse than no check. The guard now builds a
twelve-row quotation and measures that; re-broken, it fails four checks including the row-dropping
one. New rule **M44** records both the fix and that lesson.

---

## Routine fire #185 (2026-09-20 ~23:30 UTC) — your Arabic quotations carried an English sentence, and your English ones carried the Arabic company name

Built an actual document end to end and read what came out — the quotation, in both languages.

The footer at the bottom of every client-facing document (quotation, service fees, company profile,
contract, tender — all five share it) had two lines **typed into the code** rather than read from
your company registry:

- the **branch list**, in English only. So an Arabic quotation sent to an Arabic-speaking client
  carried one English sentence in its footer.
- the **company trade name**, in Arabic only. So an English quotation carried the Arabic name — and
  never the English one, which your registry has had all along.

Both of those are already in **Company assets & registry**, in both languages, both ticked to show on
documents. The documents simply were not looking.

**And they had gone stale.** Your registry's English branch list names **one more location than the
typed-out sentence did**. Every English document you have sent has been missing it.

Two smaller ones in the same footer: the labels around your unified number and licence number were
Arabic-only, so an English document had Arabic words wrapped around its own registered numbers.

All fixed — the footer now reads the registry, in whichever language the document is written in, and
if the registry ever has nothing for a line the line is simply left out rather than falling back to
something out of date. (That rule came from fire #160 three rounds ago, which fixed the *numbers* in
this same footer and left these two behind.)

**One thing for you to look at:** your registry's Arabic branch list does not mention that extra
location while the English one does. I have not touched either value — which is right is yours to
say, and it is two edits in Company assets & registry.

Guarded by `scripts/qa/probe-the-footer-is-not-typed-out-by-hand.mjs` (10 checks). Brakes: a registry
serving different values must change the document (so a fix cannot just be a nicer set of typed-out
words), a registry with nothing must leave no dangling label, and fire #160's numbers must still
print. Sabotage-verified: putting the typed-out lines back fails eight. New rule **M43**.

---

## Routine fire #184 (2026-09-20 ~22:30 UTC) — "Viewer" in Team & Access was not stopping anyone

Drove the **Generator** as somebody you had set to **Viewer** on that page in Team & Access.

All five document editors still offered **Save draft** and **Issue** — and "Issue" is not a draft:
it takes a document number from the server and puts a document out under Direct's name, to a client.

| Editor | offered to a Viewer | fields they could type in |
|---|---|---|
| Financial proposal | Save draft · Issue offer | 18 |
| Service fees | Save draft · Issue proposal | 17 |
| Technical + financial | Save both drafts · Issue technical · Issue financial | 54 |
| Company profile | Save draft · Issue profile | 3 |
| Contract | Save draft · Issue contract | 28 |

Nothing on screen said otherwise. Each editor was checking only the person's **role** — admin,
manager, BD or team member — and never looking at the per-person setting you made. The Generator is
one of the twelve pages where the screen is the only enforcement (the database enforces only
Finance, Settings and Activity), so that setting did nothing at all.

**Fixed.** The five editors now check your setting, and the page says one line: *"You have view-only
access to the Generator. You can open any document, print it and copy it — saving and issuing are
not yours to do. Ask an admin to change it in Team & Access."* Printing and copying stay — looking
was never what you were withholding. Admins and anyone set to Editor are untouched.

**How bad is it right now? It isn't — yet.** I counted your 11 accounts: **nobody is set to Viewer
on any page.** Every entry is Editor. So nothing was wrong on anyone's screen; the setting was
simply waiting to mislead you the first time you used it.

**But nine other pages still ignore it**, and those are for you to decide on rather than for me to
change blind. With the matrix set to Viewer everywhere, these still offer write controls:

| Page | still offered to a "Viewer" | typeable fields |
|---|---|---|
| Airlines | + New airline · Edit | **139** |
| Leads | Convert · + New business · Edit | **83** |
| Suppliers | + New provider | 26 |
| Events | + Add event · Edit · Delete | 5 |
| Clients | Edit | 4 |
| SOP & SLA | + New SOP · Edit | 1 |
| Proposals | + New proposal | 2 |
| Operations | + New request | 1 |
| Reports | Generate Report · + Log achievement | 0 |
| Projects | + New project | 1 |

Honoured correctly today: Today, Finance, Settings, Activity & Audit, Archive — and now the
Generator. **Tell me which of those nine matter and I will do them the same way.** I have not done
them unasked because each one needs driving page by page to be sure nothing legitimate is taken
away, and a blunt fix across ten pages is exactly how a working screen gets broken.

Guarded by `scripts/qa/probe-view-only-on-the-generator-means-it.mjs` (9 checks). Brakes: an admin
must still have Save, someone set to Editor must still have Save, printing must survive, and
**nothing may be withheld while the setting is still loading** — that last one caught a flaw in my
own first attempt, where the buttons vanished a moment before the explanation was allowed to appear.
New rule **M42**.

---

## Routine fire #183 (2026-09-20 ~21:30 UTC) — the "drop a file here" form was pretending to read your documents

Drove the ingest forms — the ones behind **+ Booking**, **+ Invoice** and dropping a file onto the
page. They are dressed up as a document reader. They read the **file name** and nothing else.

Three things on that form were invented:

- **A confidence percentage beside every single field.** Green above 90, amber below. Opening
  *Ingest invoice* **with no file at all** showed nine of them — including a green **"Subtotal
  (pre-VAT) 94%"** sitting over an empty box, and **"Status 100%"** over a dropdown nobody had
  touched. Every one of those numbers was typed into the source code. Nothing measured anything.
  On a money form, that is the worst possible place for a number that means "trust this".
- **"📋 Recognised: Amadeus IUR invoice template"**, with the document's language printed next to
  it. Both came from spotting the word "amadeus" in the file name. The document was never opened.
- **A fraud score rolled from a random number**, written onto every booking saved through the form.
  A round back in June found that exact line in one place, fixed it, and wrote *"nothing scores
  fraud here, so do not invent a score"* in the code — and missed the other place, which has been
  rolling a die ever since.

All three are gone. In their place the form now says one plain line at the top: **"The file is kept
exactly as you sent it. Nothing inside it has been read — every value below is yours to fill in and
check."** (Arabic likewise.) The badge now reads **"📎 The name looks like: …"**, which is what it
actually knows. And the one value the app really does take from the file — the digits it pulls out
of the name for the reference — is now marked **"taken from the file name"**, *only when that is
genuinely where it came from*: the digits in the box have to appear in the name, so a form opened
with no file gets no mark.

Nothing else on the form changed — same fields, same Save.

Guarded by `scripts/qa/probe-the-ingest-form-says-what-it-read.mjs` (10 checks). Brakes: the "taken
from the file name" mark must be **absent** with no file and absent when the name has no digits — a
mark that always shows is the same untruth in a smaller font — and the form must still have all its
fields. Sabotage-verified: putting the percentages and the random score back fails five, one of them
reporting a rolled fraud score of 11. New rule **M41**.

---

## Routine fire #182 (2026-09-20 ~20:30 UTC) — a supplier you are leaving had its name deleted from every dropdown

Drove the pages nobody had touched this session — SOPs, Service Levels, **Providers & GDS**, Tickets,
Bookings, Projects — in English and Arabic. Arabic came back clean on all of them (what English is
left is codes: SOP 1, GDS, API, EMD). The Providers page is where the defect was.

You are phasing out three suppliers, and one of them is **Dnata**, which is still in your provider
list as a normal supplier. The way the app expressed "phasing out" was to **delete the name**: on
every single redraw of any screen, it went through every dropdown in the whole page and removed any
option that matched one of the three.

What that actually did, measured on your live data:

- The **Provider / GDS** box on a new booking opened with 24 suppliers including Dnata. One redraw
  later it held 23. The supplier disappeared out of a form you had open, with nothing said.
- Worse, and this is the part that could have cost you data: **a booking already recorded against
  that supplier read back with no supplier at all.** A dropdown handed a value it has no entry for
  reports nothing — so opening such a booking and pressing Save would have written the blank over
  the real supplier. Nothing on screen would have told you.
- And the page itself never agreed with the card above it: the list showed Dnata as an ordinary
  supplier, the card said it was being phased out, and the dropdowns pretended it did not exist.
  Three answers about one supplier.

**Your intent was right and is kept** — nobody should pick a retired supplier for new work. What
changed is how it is said. The supplier now stays in the list, greyed out and unpickable, labelled
**"Dnata — being phased out"** (Arabic: «Dnata — قيد الإيقاف التدريجي»), and it stays **pickable on a
record that already holds it**, so editing an old booking cannot blank its supplier. The Providers
list now carries the same small "phasing out" mark the card above it claims.

Verified against your real database: the box stays at 24, the label and the greying are there, the
stored value is unchanged, and an existing record round-trips whole.

Guarded by `scripts/qa/probe-a-supplier-we-are-leaving-keeps-its-name.mjs` (10 checks). Two brakes: a
supplier **not** being retired must be untouched, and the retired one's **stored value must not
change** (relabelling a dropdown entry can silently change what Save writes — that trap is now
written down). Sabotage-verified: putting the old deletion back fails seven checks, including the
one that catches the blanked supplier. New rule **M40**.

**Worth knowing while you are in that list:** the 23 providers contain three near-duplicate pairs —
*Travelfusion* / *Travel Fusion*, *RateHawk* / *Rate Hawk*, and *Travelport* / *Galileo / Travelport*.
Not fixed here: merging supplier records is your call, not a session's.

---

## Routine fire #181 (2026-09-20 ~19:00 UTC) — "26 days to win" was the average of 8 clients, not 28

Opened the collapsed **📊 Insights** panels, which nobody had this session. The Leads one carries
four headline figures, and one read **"26 days · Avg time to win"**.

Checked against the database: of your **28 clients, only 8** have a conversion date on or after the
day this app first held the record. The other **20 had already become clients before the app ever
had them** — they were imported after the fact — so for them the wait genuinely *cannot* be
measured, and the code was right to skip them.

**Skipping them silently was the problem.** 26 days is the honest average of 8 records, presented as
the company's time to win. Say the sales team quotes it in a meeting: it describes under a third of
your clients.

The tile immediately beside it already learned this exact lesson on 2026-09-09 — it reads *"Became
clients · 28 of 108"* precisely so nobody has to guess what it counted. This one never got the same
treatment. It now reads **"26 days · Avg time to win · 8 of 28"**, with one line underneath:
*"20 of the 28 are not counted in that average: their conversion date is earlier than the day this
app first held the record, so the wait cannot be measured."*

Verified on your real data — the tile and the line both say exactly that.

Guarded by `scripts/qa/probe-the-average-says-what-it-averaged.mjs` (8 checks). Two brakes: **it says
nothing when nothing is excluded** (a clean dataset gets no apology), and **when nothing at all can
be measured the tile shows a dash, never a made-up 0**. Sabotage-verified: the bare label fails five.

**A bug of mine, caught by driving.** The basis line built correctly and then **vanished**, because
this card's injector inserted only the *first* element it produced and dropped everything after it.
Reading the code would not have shown that; opening the page did. Fixed so it inserts every element.

**Also checked this round:** the other Insights panels (Clients, Airlines, Sync) open and show
correct figures — Clients in view 28, Key accounts 2 — and the Leads stage chips match the database
exactly (Prospect 53 · Contacted 25 · Lost 2). "0 New this month" is also correct: nothing has been
created since 23 August.

3 gates green, battery 290 entries.

---

## Routine fire #180 (2026-09-20 ~18:00 UTC) — three searches, three different answers

Following the rule the last round earned, to every place it applies. This app searches companies
from **three** places, and each had grown its own list of fields:

| you type | Clients page | Ctrl/Cmd+K palette | top-bar box |
|---|---|---|---|
| English name | ✅ | ✅ | ✅ |
| **Arabic name** | ✅ | ✅ *(only since #179)* | ✅ |
| **legal name** | ✅ | ✅ *(since #179)* | ❌ |
| **Direct client ID** | ✅ | ✅ *(since #179)* | ❌ |
| **CR/VAT number** | ✅ | ✅ *(since #179)* | ❌ |
| a person who works there | ✅ | ✅ *(since #179)* | ✅ |

So typing a company's **Direct client ID** or **CR/VAT number** into the box in the top bar — the
one that says *"Search leads, clients, requests, airlines, providers, SOPs"* — found **nothing**,
while the very same text found it on the Clients page. Three lists drift apart; one cannot.

All three now share a single haystack (`recordHay`). The top-bar box keeps the one thing it had that
the others lacked — **matching a phone number by its digits**, whatever spacing it was stored with
(fire #113) — because that is a different mechanism, not a field.

Guarded by `scripts/qa/probe-every-search-agrees.mjs` (14 checks): the same company, found five
different ways, on both surfaces. Three brakes, because merging searches is the easiest way to break
them — **nonsense still finds nothing**, **an archived company is offered by neither**, and
**phone-digit matching still works**. Sabotage-verified: narrowing the shared haystack back to the
name alone fails all ten field checks and leaves the brakes standing.

3 gates green, battery 289 entries; six existing search and phone probes re-run.

---

## Routine fire #179 (2026-09-20 ~17:00 UTC) — the keyboard search could not read Arabic

Ctrl/Cmd+K opens a command palette that promises *"Search anything — leads, clients, bookings,
invoices, airlines, actions…"*. Driven against the real database, it matched a company on its
**English name only**.

| you type | what happened |
|---|---|
| the company's English name | found |
| the **same company's Arabic name** | **"No matches."** |
| its Direct client ID | "No matches." |
| its CR/VAT number | "No matches." |
| the name of the person you deal with there | "No matches." |

**Eighteen of your 108 companies have an Arabic name.** For an Arabic-speaking colleague, the
fastest search in the app — the one behind a keyboard shortcut — could not find them by the name
they actually use.

Fire #148 fixed exactly this for the **Clients page** search back in the day. The palette was never
given the same treatment, so the app's two searches disagreed about what a company is called, and
the better one was the slower one. The palette now uses the same haystack: English name, Arabic
name, legal name, Direct client ID, CR/VAT, and the people who work there.

Guarded by `scripts/qa/probe-the-palette-knows-the-arabic-name.mjs` (8 checks). Two brakes, because
widening a search is the easiest way to break it: **nonsense must still answer "No matches."** and
**an archived company must still never be offered**. Sabotage-verified: restoring the name-only
filter fails exactly the four new ways of finding a company.

**A note on how nearly this was missed.** The first measurement said the palette *never opened at
all* — which would have been a far bigger story. It was wrong: the overlay is positioned in a way
that makes the usual "is it visible?" test report nothing, even while it is open on screen. The app
tracks its own state, and reading that showed it opening perfectly. That is the sixth time this
session that checking before claiming stopped a false alarm.

3 gates green, battery 288 entries.

---

## Routine fire #178 (2026-09-20 ~16:00 UTC) — the full battery, and what it caught in my own work

The first complete battery run since twenty probes were added. **Three reds, and not one of them was
the app breaking on its own.**

**1 · A real regression I caused, one round earlier.** Adding the contact provenance field leaked it
into the **exported spreadsheet**: a lead's contacts cell read *"Contact 9 Manager
c9@example.com +966500000009 manual"*. This project's own notes warn about exactly this — *before
adding a field to the app object, ask what the export does with it* — and I did it anyway. The
export joins every value of a contact that is not bookkeeping. Fixed there, and it turned out **the
same leak was already waiting** for any *flagged* contact, whose cell would have read
*"… true <the reason>"*. One fix closed both, and the guard that caught it is the one written after
the last time this happened.

**2 · A label assertion I invalidated.** A probe checked for the literal words "7 Still ahead" after
I deliberately relabelled that tile to "Not finished". Its real intent — 7 unfinished of 8, the
ended one excluded — is unchanged, so the wording moved and the count assertion stayed identical.

**3 · Two years of accepted holes, now closed and guarded.** `probe-share-and-settings-attacks` was
written to **record open holes as facts**. It asserted that your agency profile, the audit trail,
the blob's invoices and the export controls **do** reach an anonymous link holder — so it passed
while the app leaked, and went red the day the holes were closed. Fires #166 and #167 closed them.
Those assertions are now **inverted into guards** against the holes returning.

Inverting them exposed a second problem worth writing down. The checks measured **key names and row
counts** — and the app seeds its own empty agency object and empty invoice arrays, so the old
assertions *and* their inversions could fail at the same time. They now key off the fixture's own
**marked values** (a seeded IBAN, Amadeus PIN, invoice number and audit line), which is the only way
to tell what the link delivered from what the app made up. Result: **73/73 checks pass**, and the
line that matters reads *"nothing the blob carried reaches the browser — no seeded invoice,
proposal, booking, IBAN, Amadeus PIN or audit line."* That is a stronger confirmation of #167 than
existed before, because the mock it runs against still hands over the whole blob on purpose.

**The honest summary: three rounds running, the guards caught me rather than the app** — a half-done
fix (#177), an export leak (#178) and a check that could never fire (#173). That is the system
working, and it is the argument for running the whole battery rather than only the probes that look
related.

3 gates green, battery 287 entries, full run confirming.

---

## Routine fire #177 (2026-09-20 ~15:00 UTC) — what we know about a person, and a fix of my own the battery caught

**Two things this round. The second matters more than the first.**

**1 · People had the same hidden fields companies had.** Fire #151 put three things on a company's
card: where the record came from, whether it needs confirming, and why. The **people** table carries
the same three, and they had never been carried across. Counted live: of your 45 contacts, **10
carry a source** — the same sentence the companies carry, *"Contact-form submission, classified with
the owner 2026-08-16"* — and **2 are flagged**, both left behind by a company merge.

What was on screen before: the source, **nothing at all** — the app never even asked the database
for that column, so ten people already vetted with you looked like a name typed in yesterday. And
the reason for a flag lived in a **hover tooltip** on a small badge: invisible on a phone, invisible
to anyone not hovering, invisible in print. #151's rule was that a warning nobody passes is not a
warning; a hover is not passing it.

`js/95` puts both in words under the person: the reason first, because it changes what someone does
next, then the quiet grey source line. The badge and its tooltip are untouched. Guarded by
`scripts/qa/probe-a-person-says-where-they-came-from.mjs` (9 checks) with three brakes — a person
with neither field gets **no** line, the badge still exists, and a share-link holder sees none of it.
Sabotage-verified: five checks fail without the layer.

**2 · The battery caught a mistake of mine from #172, and it was right.** Two probes that already
existed went red: one requires the move tiles plus the skipped ones to **add up** to the headline,
the other requires the headline to equal the count of unfinished events. My #172 change had shrunk
the headline to the 22 dated events while the tiles below still counted all 43 — so the arithmetic
broke, and anyone adding up the tiles got 43 under a headline of 22. That tile is also the
**show-everything filter**; it opens a list of 43, so its number was never free to mean something
narrower.

The diagnosis was right and the remedy was wrong. **The count stays whole; the label is what
changed** — the tile now reads **"Not finished"** with **"No date yet 21"** beside it. Both old
probes pass again, my #172 probe was rewritten to the corrected model, and **rule M34 carries the
correction in place** rather than being quietly reworded.

The general lesson, now in M34: **before changing what a number counts, find out what else on the
screen has to add up to it.**

3 gates green, battery 287 entries. A full battery run is in progress against the corrected tree.

---

## Routine fire #176 (2026-09-20 ~14:00 UTC) — five suspicions chased, five came back clean

A round spent trying to break the pipeline data and failing. **No code changed.** Written down so
the next session does not chase the same five things.

**1 · "Two leads are missing from the Leads page."** The page drew **78** rows while **80**
non-client companies exist. That is exactly the shape of #171, so I went after it — and it is
correct: both missing leads are stage **Lost**, and the page carries a **ticked "✓ Hide closed"**
control with **"Lost 2"** right beside it. The two are one click away and the page says so. Not a
defect.

**2 · The half-converted-record landmine is clean.** This project's oldest warning is that a company
is a client in two places at once — a column and a copy inside the record — and changing one without
the other leaves it half-converted. Checked all 108: **28 clients by the column, 28 by the copy, and
zero disagreements in either direction.**

**3 · Clients with real money show no money — and that is fine.** Fifteen clients are linked to
**2,030,764.29 SAR** of ledger revenue while their company record's own value field reads 0. That
sounds bad and is not: **the Clients table has no money column at all** (Client · Account manager ·
Tier · Client since · Next review · Health), and that field is used only as a fallback sort key with
no column to sort by. Nothing wrong is shown to anybody. The field is dormant, not lying.

**4 · No duplicate companies.** Three different tests — same normalised name, same website domain,
same first twelve characters — found **zero** groups across the 108. The duplicate spellings this
project fought in August are gone.

**5 · The one real oddity, for you rather than for me.** Exactly **one of your 28 clients is marked
Lost**, and it has no invoices in the ledger and no recorded value. Every other client is Won. The
app already handles it honestly — the Clients table shows its Health as "Lost" rather than hiding it
— so nothing is broken. But a client we lost, with nothing ever billed, is more likely a mis-click
than a customer. Worth thirty seconds of your eyes; I have not touched it because deciding whether a
company is a client is yours.

**Also re-run clean this round:** the click-through probe, the events-copy probe, the airline-copy
probe and the credit-pool probe, all after #175's changes. 3 gates green.

---

## Routine fire #175 (2026-09-20 ~13:00 UTC) — three pages reporting zeros in Direct's name

Bookings, Invoices and Tickets mirror records that Direct owns. Each one prints a row of confident
totals:

| | |
|---|---|
| **Invoices** | INVOICES 0 · **BILLED 0 SAR** · PAID 0 · **OUTSTANDING 0** · ZATCA CLEARED 0/0 · AR aging 0–30 days 0 |
| **Bookings** | BOOKINGS 0 · TICKETS 0 · **TOTAL SALE 0 SAR** · MARGIN — |
| **Tickets** | TICKETS 0 · OPEN 0 · USED 0 · REFUNDED 0 · ADM-FLAGGED 0 |

…under a banner that read **"🔒 Live from the Direct system — read-only."**

**Nothing is live.** Your own Sync page says it in plain words: *"Live two-way sync arrives with the
hosted backend phase."* There is no connection to Direct. Those three lists are empty because
nothing has ever been brought into them — and the app's own finance ledger holds 46 invoices, so
"BILLED 0 SAR" was not even this app's answer, let alone Direct's.

So somebody opening Invoices was told the figures come live from the system that holds your money,
and that that system has billed **nothing**. Both halves wrong, and the second is the kind of thing
that gets repeated in a meeting.

**Fixed in two places, because there were two faults.** "Live" is a claim about a connection, so the
banner now says what is true either way — **"Direct is the system of record — read-only here"**. And
`js/94` puts one line **above the totals** on each of the three pages while they hold nothing: the
zeros are this page's own count of what it has, which is nothing, and they are **not Direct's
figures** — open Direct for the real ones.

Guarded by `scripts/qa/probe-empty-mirrors-do-not-speak-for-direct.mjs` (8 checks). The brake: **the
line disappears the moment a page holds records**, so it cannot become furniture when an import or a
real sync finally arrives — and a second check stops the banner fix from throwing out the useful
half with the false half. Sabotage-verified: unhooking js/94 *and* restoring the old banner fails
six checks. **New rule M36.** 3 gates green, battery 286 entries.

**How this was found, since it matters:** reading the three mirror pages alone would have shown
nothing wrong — they look consistent. It only came apart when the Sync page was read next to them
and said the opposite. When two screens in the same app disagree about whether something is
connected, one of them is lying to somebody.

---

