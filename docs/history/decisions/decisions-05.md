**M49 — an area that absorbs a tap must do something with it.** Found 2026-09-21 (fire #191) by
driving every page this session touched at **390 px with touch**, in both languages. Most held up:
nothing scrolled sideways, the wide tables scrolled inside their own boxes as designed, no JS errors
either side. The row-selection column did not. The tick box on Leads and Suppliers is **13 × 13 px**
— the browser default, never styled, half the 26 px floor `js/04`'s pager set for itself with the
words *"these are the controls the team hits most on a long list from a phone"*. Its cell is a
comfortable **52 × 59 px** and carries `onclick="event.stopPropagation()"` so a stray tap does not
open the record — the right instinct, but stopping the row handler was **all** it did. The result is
the worst of both: an area that looks tappable, swallows the tap and produces nothing at all — no
tick, no navigation, no feedback — so a miss is indistinguishable from a slow app and you tap again.
`js/100` makes the absorbing cell perform the obvious action. Nothing moves, nothing is restyled, no
CSS is added: the effective target becomes the 52 × 59 px already there. It is **delegated on the
document**, not written into the two markup sites, so a third checkbox column inherits it — and it
declines any cell holding more than the box, because hijacking a tap meant for a link would be a
worse bug than the silence.
**Two testing lessons from the same round:**
**(a) measure the effective target, not the control.** The first reading of this was "the checkbox is
13 px", which would have led to restyling it. Measuring the *cell* — 52 × 59, stopPropagation, no
action — found the real defect and a much smaller fix.
**(b) a toggle redraws its row, so a DOM reference held across an interaction goes stale.** The
probe's first run reported an untick that had actually worked, because it was reading a detached
node. Re-find the element after every interaction.
Guard: `scripts/qa/probe-a-tap-beside-the-tick-box-counts.mjs`, whose brakes are that the record must
still not open, that a tap on the box must toggle once rather than twice, and that a cell containing
anything else is left alone.
*Date: 2026-09-21, js/100-a-tap-beside-the-tick-box-counts.js. Status: ACTIVE.*

**M50 — a probe that fights one of the app's own safety features is a broken probe, not a flaky
one.** Found 2026-09-21 (fire #192). The full battery came back **285/285 green** with one probe
red under load and green alone — `probe-export-menu-honest`, and its failing check was *"an empty
page says 'No rows to export' and downloads nothing"*. The runner's honest note says a red that does
not reproduce alone is usually a busy machine; the detail line said otherwise: under load the probe
had **downloaded a real file**, meaning the page was not empty when Export was clicked.
The probe emptied Operations with `DB.requests = []`. `js/35` carries a deliberate **re-assert
guard** that watches that array's *identity* and restores the loaded rows when something replaces it
wholesale — built in round 32 because a late blob loader was clobbering deletes, and its own comment
records the distinction: *"an edit assigns in place and keeps the identity; only a delete replaced
the array"*. So the probe's setup looked exactly like the clobber the guard exists to undo, and the
guard correctly put the rows back ~1.5 s later. On a quiet machine the click landed first; under
load it did not. **The app was right every time.**
Emptying **in place** (`length = 0`) keeps the identity, the guard stays quiet, and the check now
holds under `-j 3`. Two things go with it:
**(a) assert the precondition, not just the outcome.** The check now reads the row count at click
time and fails if the page was not actually empty — otherwise a passing run proves nothing, which is
the same fault M46 named in a different costume.
**(b) my first attempt made it worse.** "Hardening" it with a `render()` after the emptying fired
the refill on a *quiet* machine too — a fix aimed at a symptom, before the mechanism was understood.
Read the guard before out-waiting it.
Guard: `scripts/qa/probe-export-menu-honest.mjs` itself, re-run under concurrency alongside five
neighbours, 6/6 green.
*Date: 2026-09-21, scripts/qa/probe-export-menu-honest.mjs. Status: ACTIVE.*

**M51 — the browser keeps ONE copy of the workspace, and a new layer is only shipped once it is
measured doing something the app does not already do.** Found 2026-09-21 (fire #193). Driving the
app against the **real database** (108 businesses, 28 clients), a browser sitting at the sign-in
screen, having used the app before, held **2,304,723 characters** across three keys —
`directBusinessData_v29` (768,721, the live one), `_v25` (767,970, never read anywhere) and
`_v24` (767,970, read only as `load()`'s fallback when v29 is absent). Traced with a `setItem`
stack trace to js/core/core-08's v25.2 migration block, which wrote a full copy into **both** dead
keys on every page load, plus `v25TemplateLearn` writing v25 again. Nine such writes survived the
June v24 → v25 → v29 migrations; all nine are gone, and the same browser against the same database
now holds **768,783** — about **1.5 MB back**, out of a browser allowance commonly 5 MB.
It is not tidiness: `save()` in core-01 has a named failure for exactly this —
*"Storage full - changes kept in memory only"* — and when it fires a person keeps working while
nothing reaches disk. Tripling the footprint brings that moment three times closer.
**The part worth keeping as a rule is what happened next.** A cleanup layer — a js/101, written to
sweep the two dead keys out of browsers that already carried them — was written, wired, and reported
528 KB reclaimed. The probe written to guard it then failed in a way that made no sense, and measuring
properly showed why: **js/02's cloud layer already removes every `directBusinessData_v<n>` key on
every successful sign-in** (line ~416, since the v32 row-by-row load). Running the app with the
layer and without it produced **byte-identical** storage. It was deleted rather than shipped. A
layer that duplicates an existing one is not free — it is a second place to read, a second place to
break, and a claim in the repo that is not true. Measure the app with the new file removed before
believing the new file is what fixed it.
**And one more correction, worth as much as the rule:** the first version of that guard said it drove
"a signed-in session against the live database". It did not — it ran against the QA mock, whose
workspace is a quarter the size, and the header was written from the mock's numbers (711,825). The
real figure is 2,304,723. A battery probe SHOULD be hermetic; what was wrong was the claim, and the
understatement it carried. Re-measured through the real bridge, corrected everywhere, same round.
Guard: `scripts/qa/probe-one-workspace-copy-not-three.mjs` — two browsers (the sign-in screen and a
signed-in session, both on the QA mock, with the live figures recorded in its header), a
character-count ceiling rather than a key list, and
a source sweep of all of `js/`. Its brakes are that the live copy must still parse and carry the
workspace, that the auth token must survive, and that neighbouring keys are untouched; the lazy
version of this fix (`localStorage.clear()`) was run against it and failed all three.
*Date: 2026-09-21, js/core/core-08-v25.js + js/core/core-09-v26.js. Status: ACTIVE.*

**M52 — a warning about missing data names the AMOUNT at stake, not only the count of rows.**
Found 2026-09-21 (fire #195). The money page is careful about unrecorded cost — three places warn
about it, a client with no cost on any invoice prints the words *"not recorded"* and *"unknown"*
instead of a zero and a full-revenue profit, and there are per-row ⚠ marks. Every one of those
warnings named a count. On the live book that count read **"19 of 46 invoices carry no recorded
cost"**, which sounds like a minority. Those 19 contribute **214,550 SAR of a 492,623 SAR profit
total — 44% of the headline figure** — because a cost of zero makes profit equal revenue. The same
sentence would have been printed if the exposure were 2%. Invoice rows are wildly unequal in size,
so **a count cannot stand in for an amount**: name the riyals, and compute the share from the
figures on screen rather than stating it. This is M8 and M39 taken one step further — it is not
enough to refuse to invent the missing number, the reader also has to be told how much of what they
are looking at depends on it.
Guard: `scripts/qa/probe-the-cost-gap-says-how-much.mjs`, which checks all three warnings against a
sum it computes itself over exactly the rows the headline covers, in both languages. Its brakes are
that giving every no-cost row a cost makes all three warnings disappear — **having asserted they
were on screen first**, which the first version did not and which the first sabotage run exposed
(M50 in a fresh costume) — and that the amount named is the part, not the whole profit total.
*Date: 2026-09-21, js/16-finance-ledger.js. Status: ACTIVE.*

**M53 — a row-level-security refusal arrives as HTTP 200 and an empty list, so "no rows" is never
by itself a fact about the business.** Found 2026-09-21 (fire #196) by driving the live app signed
in as a **team_member** — the role 7 of the 11 real accounts have, which is what M-"test as the role
most people have" was written for, and this is the first thing that rule has caught that no admin
drive could. Finance is offered in that role's navigation. Opening it showed `0 invoices · data
through —`, Revenue/Cost/Profit/Received all `0 SAR`, a twelve-month chart of zeros, and
**"Of expected achieved · 0%" against a real, correctly-loaded target** — while the book held 46
invoices and 2,030,764 SAR. Captured on the wire during the drive: `GET finance_invoices -> 200
rows: 0 bytes: 2`, eight times, with `finance_targets` returning 2 rows, which is exactly why the
page could draw a target and report nothing achieved against it.
Nothing errored, so every M27 guard in the app was satisfied. **RLS does not refuse, it filters** —
PostgREST answers with 200 and `[]`, and a response that means "not yours to read" is byte-identical
to one that means "there are none". The page cannot tell them apart, so **it must not pick one**: it
now says both, and the attainment percentage — pure inference from an absent numerator — stands down
to "—" with its reason.
This is the signed-in twin of fire #56, which found the same empty answer being cached *before*
sign-in and fixed it by keeping `FIN.rows` null until a session exists. The trigger here is
deliberately **`FIN.rows` being an empty ARRAY** — the load finished and brought nothing — and never
"the totals are zero": a period filter matching no invoices is a true zero, and labelling an
owner's quiet quarter a permissions problem would be the same fault in the other direction.
Generally: before drawing a count, a total or a percentage from a list that came back empty, ask
whether the reader could tell an empty result from an empty permission. If not, say so.
Guard: `scripts/qa/probe-an-empty-answer-is-not-a-zero.mjs`, whose two brakes are that the notice
stays away while the rows are still loading and that a legitimately empty period never raises it.
*Date: 2026-09-21, js/16-finance-ledger.js. Status: ACTIVE.*

**M54 — a translation map is keyed against the data, not against how someone imagined the data
would look; and a database identifier never reaches a screen.** Found 2026-09-21 (fire #197) by
driving the live app **in Arabic** over the four pages every team member can open. Two copies of one
activity-type map lived in `js/core/core-02` — one inline in the Clients table, one in `_actWhat`
for the record timeline — and **both keyed on lowercase** (`{note:…, call:…, meeting:…}`) while
every activity in the live data is capitalised. Counted the same day across 38 companies:
`Note` 15, `stage_change` 28, `Won` 10, `Call` 8, `Task` 4, `Meeting` 2, `Proposal` 1 — **68 of 68
rows that could never hit a key in either map.** On screen: the Arabic Clients list read
"↪ Note: …" on 11 of 11 rows, and a client's own timeline ran Call / Task / Note / Won down its
whole length in English — the history screen, in the language half the team reads.
Three faults in one place, and each is its own lesson:
**(a) case.** A lookup keyed `note` against data that is always `Note` fails silently and
completely — it does not degrade, it never matches once. Lowercase the key, or better, measure the
distinct values in the live table before writing the map at all (`select type, count(*) … group by
1` took seconds and answered it outright).
**(b) coverage.** Four types people actually log — Won, Task, Proposal, stage_change — were in
neither map in any case, so even a case-insensitive lookup would have missed 43 of the 68.
**(c) a stored identifier is not a label.** `stage_change` is a column value, and the fallback
prints the stored value verbatim, so it would have gone to a person's screen as `stage_change` in
both languages. Anything that can fall through to raw data needs the identifiers named explicitly.
The fix is one helper, `actTypeLabel`, case-insensitive, with stage-shaped words (Won, Lost,
Proposal) taken from `window.__STAGE_AR` — the map the stage chips and the Arabic export already
share — so the same thing cannot come out worded two ways. This is M38's rule ("a second surface
searching the same records shares the first one's haystack") in its translation costume: **two
copies of a word list is one copy too many, whatever the list is for.**
Guard: `scripts/qa/probe-the-activity-words-match-the-data.mjs`, which seeds the exact shapes the
live data holds plus one nobody logs, and reads both surfaces in both languages. Its brakes are
that an unrecognised type must still fall through to its stored value rather than be guessed at,
and that the list and the timeline must word the same activity identically.
*Date: 2026-09-21, js/core/core-02-leads.js. Status: ACTIVE.*

**M55 — never offer a choice the save cannot keep; and dropping a choice is not the same as hiding
a fact.** Found 2026-09-21 (fire #198) by driving the live app with every write intercepted and
logged rather than forwarded — which is how the wire answer was read without touching a real row.
The record page offered seven stages. Picking **Negotiation** sends `in_discussion`, and
`in_discussion` reads back as **"Qualified"**: the word a person deliberately chose is replaced by
another on the next load, silently. `stageToApp`'s `prev` argument cannot save it, because the save
writes `stage` to the **column only** and never into the record's raw blob — measured, not assumed:
27 of the 108 live records carry a stage word in their blob and every one reads Won/won/Lost, never
a round-trip word. "On hold" is the same shape (`on_hold` → "Prospect"), latent only because no
live record is on hold.
The existing comment beside the two conversion maps warned that a **missing** key silently saves as
`new`. This is the sibling it did not cover: **a key that exists but whose database stage maps back
to a different word.** The question now lives beside the maps as `stageKeepable(word)`, and the
three places a person can SET a stage offer only words that pass it. `LEAD_STAGES` is deliberately
untouched — `leadSortVal` and `leadScore` both read positions out of it, so dropping an entry would
quietly move every later stage's score.
**The second half of the rule was taught by the probe's own brake, on the first run.** The first fix
filtered the dropdown without exception, so a lead actually sitting on "Negotiation" drew options
that no longer contained its own stage — the browser fell back to the first one and the screen said
**Prospect**. The control misreported the record it belonged to, which is worse than the defect being
fixed. A record's current value is always included, in its own place in the order. Restricting what
can be chosen must never change what is shown.
**Also this round, and it is M54 finishing its own sentence:** fire #197 keyed the activity words
against the `activities` TABLE, where a stage change is `stage_change`. The app writes its own into
the record's blob as `"Stage change"` — a space, not an underscore — so the fix of one round earlier
missed the very entries the app creates, and would have shown English in Arabic the first time
anyone advanced a lead. Invisible because nobody had moved a stage through the app since the data
was rebuilt. Separators are normalised now. **The same fact can be spelled differently by different
writers; keying against one writer's spelling is only half of keying against the data.**
**Completed 2026-09-22 (fire #202): two more words had the same fault, and #198 did not cover them.**
Driven over every screen word the conversion maps recognise, a record whose stage is **"New"** or
**"On hold"** drew a dropdown without its own stage, so the browser selected the first option and
the page said **"Prospect"**. Pre-existing rather than caused by #198 — neither word has ever been
in `LEAD_STAGES`, so the picker never held them before that round either; #198 fixed the instance it
found (Negotiation, which IS in LEAD_STAGES) and left these two, because the exception it added was
keyed on LEAD_STAGES membership rather than on the maps. A record's current word is now included
whenever the maps know it at all (`stageIsKnown`), placed beside the word sharing its database stage
(`stageCanon` puts "New" next to "Prospect", both `new`) so the order still reads as a pipeline, and
a word with no sibling goes last. **The lesson for the rule: when an exception is added for "the
value this record already has", scope it to every value the app can produce, not to the list you
happened to be editing.**
Guard: `scripts/qa/probe-a-stage-you-pick-is-the-stage-you-get.mjs`, whose brakes are that a record
already carrying an unkeepable word still displays it, that the pickers still offer the real stages,
that a missing `stageKeepable` makes them fall back to the full list rather than to nothing, and
that a word LEAD_STAGES never listed is shown only on the record carrying it.
*Date: 2026-09-21, js/02 + js/core/core-01 + js/core/core-02. Status: ACTIVE.*

**M56 — when a short list stands in for a long one, sort by what the reader can still act on, not
only by size of the number.** Found 2026-09-21 (fire #199). The morning card (js/88) shows at most
three company papers needing attention, most urgent first, with the count of the rest — a good
design, and it was working exactly as written. Read verbatim off the live registry, "most urgent
first" produced three certificates that had lapsed **584, 376 and 258 days ago**, and put behind
"and 2 more" the Monsha'at certificate with **49 days left** — the one item on the whole list that
could still be renewed before it lapsed. Sorting purely by days remaining means the further past
saving a document is, the more of the card it occupies. After nineteen months a lapse is a standing
state; a deadline you can still meet is news, and that card exists because *"a warning nobody
passes is not a warning."* The sort and the cap both stand; when anything on the list has not
lapsed, the nearest of those now takes the last of the three places. Nothing is hidden that was not
hidden before — the count of the rest is unchanged and the full radar is a click away.
This is a judgement about surfacing, not a defect, and it is recorded as a rule because the same
shape recurs wherever the app shows "top N of many": ask what the reader could do about each row
before deciding which N.
Guard: `scripts/qa/probe-the-renewal-you-can-still-make.mjs`, whose brakes are that nothing may be
invented when everything has lapsed, that nothing beyond the sixty-day window may be pulled in to
fill space, and that the card stays admin-and-manager only.
*Date: 2026-09-21, js/88-renewals-on-today.js. Status: ACTIVE.*

**Verified clean 2026-09-21 (fire #199), so the next session need not re-do it:** every contact
shown on a company card belongs to that company — all 36 companies that have contacts were opened
against the live database and checked row by row, with no cross-company leakage and no company
hiding contacts it holds. Two false alarms came out of that sweep, both worth knowing because they
will recur: the `contacts` table keys on the **database uuid** while `DB.businesses` keys on the
app's own id (`window.__ROWID` maps between them), so comparing the two directly "finds" 19
companies with missing contacts that are simply records you never opened; and a company's own
general address legitimately appears in its funnel details, so any address on a card that is not in
the `contacts` table is not thereby a stranger. The Events tab was driven the same day and is also
clean: 80 rows, 43 unfinished = 22 upcoming + 21 undated, the undated ones labelled as such in both
languages.

**M57 — a guard asks the app; it does not keep its own copy of the app's answer.** Earned three
times in one day (2026-09-21, fires #196, #198 and #200), each time the same way: a correct change
to the app turned a guard red, and the guard was wrong.
  · **#196** — `probe-client-profit-honest` captured each on-screen warning through a 150-character
    window. Fire #195 made the caveat longer, so the words it tested for fell outside the window.
    The sentence read correctly on screen; the ruler was short.
  · **#198** — a check asked whether the page text contained "Stage change". The fix made it read
    "Stage changed", which **contains** that string, so a working build was reported broken.
  · **#200** — `probe-client-card-ar` compared the stage picker against the literal
    `Prospect,Contacted,Qualified,Proposal,Negotiation,Won,Lost`. Fire #198 correctly stopped
    offering Negotiation, and the guard went red on a correct app.
A guard that copies a list, a length or a phrase is coupled to a decision it does not own. Where the
app exposes the answer — `pickableStages`, `stageKeepable`, `finLive`, `finInPeriod`,
`dgCredentialFacts`, `recordHay` — **ask it**, and the guard keeps testing the property while the
vocabulary is free to change. Where the literal IS the assertion (the sign-in form must read
"Email | Password | Sign in" in English) a literal is right; the test is whether the guard owns the
value or is merely repeating it. Prefer *inclusion* to *equality* for vocabulary: the four probes
that mention the stage words all use `.every(s => labels.includes(s))` and none of them went red.
Swept 2026-09-22 (fire #201): the suite has **no** probe coupled to a live-database count — the
`=== 108` hits are probes asserting rows they seeded themselves — and after #200 no exact-equality
comparison against a copied app list remains.
**Twice more on 2026-09-22 (fire #208), both caught by the full battery rather than by a sweep,
which is the lesson: a coupled guard stays quiet until someone changes the wording it copied.**
  · `probe-reports-phone-ar` required the literal «مؤشر ·» in the objectives meta line. Fire #205
    put the measured count between those two characters — "6 مؤشرات (0 مقيس) · 0 إنجاز" — and a
    fully Arabic line was reported as English. It now asks the property: every meta line names the
    strategic link in Arabic and **carries no Latin letter at all**, which is both stronger and
    immune to rewording.
  · `probe-sync-badge-honest` required the badge to say the work was "saved on this device". That
    one is different in kind and worth separating: the guard was not merely coupled, it was
    **enforcing a claim that turned out to be false** (M61 — one reload later the change is gone
    from the device). A guard can hold a defect in place. When a rule changes, the guards that
    encoded the old rule are part of the change, and the fix is to invert the assertion explicitly
    (it now fails with "it promises the change is safe on this device, and one reload later it is
    not") rather than to delete it.
*Date: 2026-09-21, scripts/qa/. Status: ACTIVE.*

**Verified 2026-09-22 (fire #201), so no session re-derives it:** the M53 class — an RLS refusal
arriving as HTTP 200 and an empty list, drawn as a fact — is **confined to Finance**. Read every
SELECT policy on the tables behind every page: only `finance_invoices`, `finance_client_links` and
the finance rows of `record_history` gate reads on `can_see_page('finance')`. Every other table
(`businesses`, `contacts`, `activities`, `airlines`, `providers`, `sops`, `slas`, `company_identity`,
`funnels`, `finance_targets`, `finance_transactions`, `generated_documents`) reads on
`app_role() IS NOT NULL` — any signed-in person — so no other page can show one role a different
count and call it the truth. **And there is no anonymous exposure**: the `qual: true` policies on
`ksa_events`, `ksa_event_signups` and `promo_codes` apply to `{authenticated}` only, confirmed both
in the policy definition and empirically — an anon request with the publishable key returns
`content-range: */0` on every one of those tables and on `businesses` and `finance_invoices` too.
A first reading of the policy text alone suggested anyone could delete the 80 real event rows; the
measurement showed otherwise, which is why the measurement is the record.
*One inconsistency found and deliberately not changed:* `finance_targets` carries two write
policies, `finance_targets_write` (admin/manager) and `fin_tgt_write` (admin/manager/**team_member**).
Policies are OR-ed, so a team member may write the revenue target while being unable to read a
single invoice. Nothing is broken — `canFinEdit()` is admin/manager, so no screen offers it — and
permissions are the owner's to set, so it is an owner note rather than a change.

**M58 — a value may be translated only when the app owns its vocabulary; a label always may.**
Found 2026-09-22 (fire #203). The funnel card that appears when you rest on a lead row read, in
Arabic: the funnel's English name, then six of six English field labels, then `No` — while the money
line beside them translated correctly. A half-finished pass, not a missing translation: somebody
localised the money mask and the two warnings and stopped. The Arabic was never missing — all 7
funnels carry a real `name_ar` and all 51 template fields a `label_ar`, counted in the table. And
`fnLabel`/`fnTitle` **already existed in the same file**, built by round 42 when it made the funnel
CARD bilingual; the popup was simply the second surface that never called them (M38's rule in its
third costume, and the reason the fix reuses them rather than inlining the same choice).
**The line the rule draws is where the fix stops.** A LABEL is the app's own word and is always
translatable. A VALUE is only translatable when the app owns its vocabulary, and that has to be
checked against the data rather than assumed:
  · the three fields the template DECLARES boolean (`has_app`, `iata`, `replied`) hold **strings**
    in the live data, so only an exact yes/no token is translated. `replied` reads
    **"Yes — same day"** — somebody's own sentence — and a prefix match would have rewritten it to
    «نعم». That is not a hypothetical: it is what the sabotage run did, and the failure line shows
    the sentence destroyed.
  · a `text` field whose value happens to read "No" is free text and is left exactly as typed.
  · `tender_status` is `select:preparing,applied,won,lost`, a closed list the app owns — but there
    is **no Arabic for those four options anywhere in the data**, so translating them means
    inventing the owner's wording. The value shows as stored and the gap is an owner note.
Generally: before translating a value, ask who wrote it. If the answer is "a person", render it
verbatim.
Guard: `scripts/qa/probe-the-lead-hover-card-speaks-arabic.mjs`, whose brakes are that a
boolean-declared field holding a sentence is left exactly as stored and that a text field's value is
never translated.
*Date: 2026-09-22, js/09-funnels.js. Status: ACTIVE.*

**M59 — sanitising is escaping, never deleting: a character removed from a heading renames it,
and the rename is what breaks the translation.** Found 2026-09-22 (fire #204) by sweeping the
HEADINGS of all 19 pages in Arabic against the live database. 18 came back clean; the Providers
page came back `Providers  GDS ?` — Latin on an otherwise fully Arabic screen, with **two spaces**
where the ampersand had been. The section head (`js/core/core-09-v26.js`, `v26_3InjectSectionHead`)
sanitised its title with `.replace(/[<>&]/g,'')`, deleting the character instead of escaping it.
Only one of its twelve titles contains one, and losing it broke the page twice over:
  · in English the heading simply read wrong — "Providers  GDS", the ampersand gone;
  · in Arabic it stayed English, alone among all 19 pages, because the Arabic pass (`js/21`) looks a
    heading up **word-for-word** and holds `'Providers & GDS'`. The deletion had renamed the heading
    to a string no dictionary anywhere has, so the lookup missed and the English stood.
The Arabic was never missing. Nobody had failed to translate this heading — the heading had been
renamed after it was translated. That is the general shape and the reason this is a rule rather
than a one-line fix: **any transform applied to a string AFTER a word-for-word map is built will
silently un-translate it**, and it fails open (English text on screen), not loudly.
So: escape (`&amp;`), never strip. And when a translation is missing for exactly one item out of
twelve, look for what edits the string before assuming the dictionary is short.
Corollary worth keeping: a **heading** is the one element where "is there Latin here?" has no data
false positives — it is always the app's own words, never a company name or an answer somebody
typed. A sweep over every text node is not safe that way (it flags supplier names and SOP titles),
and it must also respect visibility, or it flags cards `js/31` deliberately hides — both of those
were false leads in this same round before the heading sweep gave a clean answer.
Guard: `scripts/qa/probe-a-page-heading-is-never-english-in-arabic.mjs` — no Latin-only visible
heading on any of the 19 pages in Arabic, no section heading with a double space in either
language, and a brake that the English headings stay English.
*Date: 2026-09-22, js/core/core-09-v26.js. Status: ACTIVE.*

**M60 — an average is taken over what was measured, and it says how much of the plan that is; an
unmeasured item is never a zero and never a shortfall.** Found 2026-09-22 (fire #205) on the
Reports page, which carries 14 objectives and 30 KPIs whose figures are entered by hand. `rptPct()`
answers **0** for a KPI with no figure — correct for a progress bar, which cannot be drawn as null
— and three separate places read that 0 as a measurement. Driven with **one** KPI recorded at
exactly its 20,000,000 SAR target and nothing else touched:
  · the objective it belongs to read **17%** — 100 ÷ its 6 KPIs, five of which nobody had recorded;
  · the headline "Avg progress to 2026 targets" read **3%** — 100 ÷ all 30;
  · and the printed report's "Gaps & focus areas (&lt;50% of target)" listed **29 shortfalls, every
    one of them reading "no data"**, on a document that goes to management.
The author was aware of the distinction — a `withData` guard was already in the function — but the
denominator stayed the full list, so the awareness never reached the arithmetic. That is the shape
to watch for: **a null-check that guards the wrong step is worse than none, because it reads as
handled.**
The rule has two halves and both are load-bearing:
  1. average over the measured ones, and return **null** (shown "—") when none is measured;
  2. **say what the number speaks for.** A correct average over 1 of 30 KPIs is still misleading if
     it is printed as if it covered the plan, so the screen now reads "of the 1 measured, not all
     30", "1 of 6 KPIs measured", and the report states "29 of 30 KPIs have no figure recorded for
     this period and are not counted as gaps". Shortening a list without saying what was left out
     just moves the lie (same reason as M52, and the reason the gaps section is still printed when
     there are no gaps at all).
Same family as M53 (an RLS refusal is HTTP 200 + `[]`, not zero) and CLAUDE.md's standing rule
"never fabricate a number to fill a gap; leave it null and say why" — which is now three different
mechanisms producing one mistake, so treat "empty rendered as zero" as a thing to look for rather
than a thing to notice.
Guard: `scripts/qa/probe-a-kpi-nobody-measured-is-not-a-zero.mjs`, whose brake is that a KPI that
IS measured and IS below half its target must still be named a gap and still pull its objective's
average down — the failure mode a careless fix would introduce.
*Date: 2026-09-22, js/core/core-10-v29-reports.js. Status: ACTIVE.*

**M61 — the local copy is not a recovery path, so nothing on screen may promise that it is; a
refused save is remembered where a reload cannot erase it, and told.** Found 2026-09-22 (fire #206)
by driving the app against the real database with **every write answered 500**. The moment of
failure is handled well and none of it changed: red pill "Save issue: …", red badge, retry with
backoff, a browser warning on closing the tab, and the edit genuinely in localStorage
(`directBusinessData_v29`, checked at that second). **One reload later**:

    AFTER RELOAD: {"editStillInApp":false,"editStillOnDevice":false,"badge":"Synced 9h ago"}

The workspace loads from the cloud, the change is gone from the app **and** from the device, nothing
on the screen says so, and the badge is green again — because the last confirmed save really is the
last confirmed save; the badge has no way to know a change was just lost. The badge had been saying
**"Not synced — saved on this device"**, which is true at that instant and false as a promise: it
invites the one action that destroys the work.
Three parts, and they only work together:
  1. the badge says where the change actually is — "Not synced — in this tab only" (js/75 owns the
     wording; it is not restated anywhere else);
  2. js/02 records the refusal in `db_unsent_v1` — when, how many, the record names, the database's
     own reason — and **deletes it on the next confirmed save**, including the automatic retry, so
     the key exists only while a change genuinely never landed;
  3. js/102 reads it once on the way back in and says what was lost, through the app's existing
     notice card (js/63's `v63Notice`, not a second one), then deletes it so it is said once.
**What it deliberately does NOT do:** re-apply the change. This app is not the system of record, and
a change the database refused may since have been overwritten by someone else — replaying it could
destroy a colleague's work to rescue yours. It names the records instead.
The distinction to carry: *saved on this device* and *recoverable* are not the same claim, and the
app may only make the one it can keep.
Guard: `scripts/qa/probe-a-refused-save-is-not-forgotten.mjs`, whose brake is that the app's own
retry landing must FORGET the refusal — otherwise the next visit cries wolf about work that is
safe, which would be this fix causing its own kind of dishonesty.
*Date: 2026-09-22, js/02-…-shared-c.js + js/75-honest-sync-badge.js + js/102. Status: ACTIVE.*

**M62 — text cached in the DOM for a re-draw must not carry a decision another layer owns; cache
both languages, or cache the key and re-derive.** Found 2026-09-22 (fire #209) by driving the live
app in Arabic. On a fresh Leads render the eight funnel tabs read Arabic. One click on ANY filter —
Hide closed, Needs attention, Mine, a stage chip, a keystroke in the search box, all of which call
`drawLeads()` — and all eight came back **English** and stayed English (sampled at 300ms, 1s, 2.5s
and 5s). The page sat half-Arabic until the person navigated away and back.
Nobody wrote a bug. **Two correct fixes cancelled each other:** the tabs are built with `f.name_en`
and translated afterwards by the Arabic pass (js/21), and a count-refresh added 2026-09-09 (so the
numbers stop going stale on a re-draw) rebuilt each label from `data-funnel-label` — a stored copy
of the **English** name. The refresh therefore restored English over the Arabic every time, and it
did so *correctly by its own logic*.
That is the general shape, and it is why this is a rule rather than a one-line fix: a value stashed
in an attribute for later re-use freezes whatever was true when it was stashed. If another layer
owns that decision — the language, the rounding, the role-dependent wording — the stash silently
becomes the authority, and the layer that owns it never gets a say again.
The fix carries both languages (`data-label-en` / `data-label-ar`, the Arabic from the funnel's own
`name_ar` through js/09's `fnTitle`/`fnL` — the helpers the funnel card and the hover card already
use, M51) and chooses at re-draw time.
Related and worth stating once: this is the **fifth** surface where the answer already existed in
the file and a second surface did not call it (M38's family — the export, the full funnel card, the
hover card #203, the section head #204, these tabs).
Guard: `scripts/qa/probe-the-funnel-chips-keep-their-language.mjs`, whose second brake is that the
counts must still move on a re-draw — deleting the refresh would "fix" the language and quietly
restore the stale-number bug it was written for.
*Date: 2026-09-22, js/09-funnels.js. Status: ACTIVE.*

