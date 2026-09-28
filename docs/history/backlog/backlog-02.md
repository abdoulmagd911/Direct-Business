## Routine fire #252 (2026-09-24 ~20:00 UTC) — you are called one name on a screen, and it stops flickering in Arabic

Your name appears twice on every screen: in the sidebar footer at the bottom left and in the chip
at the top right. I sampled the footer on the live app in Arabic ten times a second: **it flipped
between the Arabic name and the English legal name three times in five seconds**, showing English
most of the time. Three separate layers were each "fixing" it back to their own idea of the name.
In English the footer showed the full legal name while the chip beside it showed the nickname —
two names for one person. And the nickname feature itself was aiming at a part of the page that
does not exist, so it never reached the footer, and the chip showed the first word of everyone's
legal name rather than the nickname (10 of the 11 accounts have one, four of them two words long,
so "Abu …" became a first name there).

Now one helper decides what a person is called — nickname in the language on screen, else the
Arabic name in Arabic, else the full name — and every place that writes the signed-in name asks
it. The footer holds still, footer and chip agree in both languages, a two-word nickname shows
whole, and the chip's menu still gives the official full name and e-mail underneath, as Team &
Access does. Verified on the live app against the real database in both languages (50 samples
each, no movement, nothing written).

The full battery over the previous round's tree came back green (331 of 331; a boot-speed check
went red under load and green alone).

**One thing to know about the deploy:** this round's push reached GitHub but Vercel did not build
it for twenty minutes, where every earlier push went live in under a minute. A second push with no
file changes fired the build within seconds and the site now serves the round byte for byte. Most
likely a missed notification on Vercel's side; if it happens again, the same re-push is the fix,
and Vercel → Deployments would show whether a build was ever started.

---

## Routine fire #251 (2026-09-24 ~18:10 UTC) — the profile menu can now be worked from the keyboard

The little menu behind your name in the top bar — Team, Page access, Sign out — could be opened
with the keyboard (it is a button, so Enter opens it) but nothing else about it worked without a
mouse: the focus stayed on the chip, Tab walked straight past the menu into the page, and **the
Escape key did nothing at all**. Every other pop-up in the app closes on Escape; this was the one
that didn't, and both of the guards that should have caught it looked past it — one only reads
full-screen boxes, the other only counts boxes wider than 300 px, and this one is 230. An older
test even pressed Escape on it and then removed the menu by hand, so the press was never measured.

Now opening the menu puts the focus on its first item, ↑/↓ walk the items, Escape closes it and
puts you back on the chip, Tab closes it and carries on, and a click outside still closes it as
before. The chip also tells a screen reader that it opens a menu and whether it is open. Verified
on the live app against the real database in English and Arabic, with nothing written and no
sign-out fired by the close.

**Checked and not a defect:** the "?" tip beside each page title has an English-only pop-up, but
the "?" itself is hidden app-wide by a rule in the page, so nobody can reach it. And the data
behind People: all 45 contacts and all 65 activities point at live companies; 27 of your 28
clients have a contact on file (one does not — a data gap, not a fault).

The full test battery over the previous round's tree came back green (330 of 330). One test —
the shared-view tidy — went red under load and green on its own, the first time in nine runs;
noted here so a repeat is read as a race and not a busy machine.

---

## Routine fire #250 (2026-09-25 ~08:00 UTC) — if the team list can't be loaded, the app now says so instead of offering an old one

I made the app's read of your team roster fail on purpose — the kind of thing a bad connection
does for a few seconds — and opened a lead. The **"Assigned to"** list offered four names typed
into the code a year ago, plus "Unassigned", as if they were the team. The achievement form did
the same. **Nothing on screen said the team list hadn't loaded.** Whoever picked one of those
names would have assigned the lead to someone who isn't on the roster, and it would have vanished
from its real owner's "Mine" with no explanation — the exact trap your notes already warn about.

Now the app tells the difference between three situations. If the roster read **fails**, it retries
for about fifteen seconds and then puts a line at the top of every people list — **"⚠ The team list
did not load — these names may be out of date"** — that can't be selected, in Arabic in Arabic. If
the roster is simply **not there** (the case for the test rig), it stays quiet as before. If it
**loads**, any earlier warning disappears by itself. Verified on the live app in both languages
with the failure injected, and with the roster answering again afterwards.

One small thing fixed in passing: the "— Unassigned —" line at the top of that dropdown was
English in Arabic.

---

## Routine fire #249 (2026-09-25 ~05:00 UTC) — every form in the app, opened in Arabic

The last two rounds each found one form that had stayed English — by luck of where I clicked. So
this time I opened **every form the app has**, sixteen of them, in Arabic against your real data,
and read the labels. Most were already Arabic. Six were not, and they are now:

- **New project** — the title and its Start / End / Budget labels;
- the **service-fee offer** — its Validity label and hint;
- the **three import previews** (booking, ticket, invoice) — Booking ref, Provider / GDS, PNR,
  Passenger; Subtotal (pre-VAT), VAT rate, Buyer VAT, Line item description — and their hints;
- the airline editor's GDS label.

The English side reads exactly as before. A few things are left as they are on purpose: brand
names, codes and format names — WhatsApp, the EMD chip, PDF, PPTX — and the example codes shown
as hints, which are the same in both languages; the app already had rules saying so, and I
followed them rather than my first instinct. The booking, invoice and payment forms need a record to open and the pages that
hold them are empty, so nobody can reach those today.

**Also verified clean this round and recorded:** the log-activity, quick-edit, new-request,
corporate-profile, client-onboarding, SOP and project-proposal forms were already fully Arabic.

**Where the remaining English in the Arabic app actually is — and it is content, not code.** With
every screen and form now translated, I counted what the *data* holds, so you can see the whole
gap in one place: **19 of your 80 events** have no Arabic name; **10 of your 28 clients** (and 90
of 108 companies overall) have none; **none of the 12 SOP titles or 14 service-level metrics** has
an Arabic version; and the **139 airlines have no Arabic-name field at all** — the app shows
"Saudia" and "Emirates" in Arabic mode because there is nowhere to put «السعودية» or «طيران
الإمارات». Provider names (Amadeus, Booking.com) are brands and stay as they are. None of this is
a defect I can fix from the code side: the first three are words to be written in the app's own
editors; the airlines would need a new field first (schema-first, your rule). Say which of these
matter to you and in what order, and that becomes the next piece of work rather than a guess.

---

## Routine fire #248 (2026-09-25 ~03:00 UTC) — logging an achievement now lists your whole team, in Arabic

On the Reports page, "Log achievement" is how someone records a win against the objectives. I
opened it in Arabic against your real accounts. The title read **"Log achievement"**, seven of its
eight labels were English, and the **"Team member" list held four names typed into the code months
ago** — while the app has eleven accounts and has kept a live roster since the ownership work in
August. Seven of your people could only ever be recorded as "Other". The same four names fed the
filter on that tab and the report's "One member" scope.

Now the list is the live roster — all eleven — in the form, the filter and the report scope; the
form's title, labels and hints are Arabic in Arabic and unchanged in English; and "Other" reads
«أخرى» while what it saves stays the same, so nothing already logged stops matching. One guarantee
worth knowing: if an entry was logged under a person who is no longer on the roster, that person
**stays in the list and stays selected** on that entry — an old record is never quietly re-pointed
at whoever happens to be first in a new list.

**Also checked this round, both clean:** the **Leads export** in Arabic (15 columns, every title
Arabic, no VAT column) and the **Finance ledger export** — its columns are the invoice fields and
the six money figures, the total is titled "invoice total", and the stored VAT figure is **not**
exported, which is your rule. The Reports page's other two tabs are fully Arabic.

**One small thing I changed my own mind on:** I first wrote my own Arabic for "Whole department"
and an existing test caught it — the app already had a word for it. I used the app's.

---

## Routine fire #246 (2026-09-25 ~00:30 UTC) — press "Tenders" on Finance and the page now says what that scoped, and why

I pressed the **Tenders** chip on the Finance page against your real data. The money tiles followed
it — 120,478 SAR. The line at the top still said **"46 invoices"**, and three lines down the cost
warning said **"5 of 5 invoices in this period"**. Two counts on one screen for someone who had just
asked for one sector. The top line is the whole ledger's size, which is true and stays; what was
missing was any count beside the chip you pressed.

There was a second, quieter gap. Back on 3 September the app learned *how* it decides an invoice's
sector — from the client's profile, or from its payment terms if there is no profile, or from the
service itself — and was meant to show that so the two are never mixed silently. It never did.
Under **B2B**, one of your 41 invoices is there by default: its client has no profile and no payment
terms on file, so it fell into B2B because nothing said otherwise. Nobody could see that.

Now, beside a pressed chip: **"5 of 46 paid invoices are Tenders — decided 5 by the client's
profile"**, and under B2B: **"41 of 46 paid invoices are B2B — decided 40 by the client's profile,
1 by default (no profile, no terms)"**. The number is made from the same rows as the tiles, so it
can't drift from them. Nothing appears under "All sectors" — it answers a question, it isn't
decoration. Both languages checked live.

**Verified clean in the same round and recorded so nobody re-tests:** the split itself is exact —
41 + 5 = 46 invoices, 1,910,286 + 120,478 = 2,030,764 SAR, to the riyal — and every Tenders row is
there because its client's profile says tender, not by guesswork. Also, all five of your tender
invoices are recorded with zero cost, so "100% of that profit" is the cost gap you already know about,
wearing a sector label.

**Two more Finance surfaces measured against the database afterwards, both right:** the plan-vs-actual
card shows your 2026 target correctly — 13.5 M expected, 11.45 M confirmed, **15% achieved** — on the
default "All years" view as well as on 2026, and the Clients & collections tab's "all 15 clients" is
exact: your 18 invoice groups collapse onto 15 companies through the alias groups you set, with none
unlinked. (The 28 on the Clients page are client *records*; 15 is how many have paid invoices — the
tab's wording could say so, but it is not wrong.) **One line for you:** `finance_targets` holds a
second row for the year **1999** with 1 SAR expected and 1 SAR confirmed, no note, no author, written
48 seconds after the real 2026 row on 13 August — a test row. Nothing on screen reads it, because the
year list comes from your invoices. Say the word and I delete it; I won't remove a row from a money
table on my own.

---

## Routine fire #244 (2026-09-24 ~22:30 UTC) — your audit log could be read without signing in; closed

Your standing rules say to run the by-hand outsider check during every sweep. I ran it — the first
time this session — and it found one thing: **`record_history`, the Activity & Audit log, answered
to anyone with no sign-in.** Row-level security was switched on, so it looked closed, but its one
read rule was granted to *everyone* rather than to signed-in users. That meant the before/after
snapshots of real company records, contacts and client profiles, and the names of who changed them,
were readable by anyone holding the app's public key — which is printed in the page itself.

Supabase's own security advisor did not flag it, because it looks for protection that is off or
missing, and this was protection that was on and let everyone through. Only the outsider check saw
it. This is exactly the class of thing you asked me to fix rather than raise (your rule 5's
carve-out is about breaking the app or locking the team out — and the danger with a change like
this is precisely locking the team out of the audit page), so I checked that first:

- every writer to that log runs with the database's own authority, not the user's — a read rule
  cannot affect them;
- every reader in the app is a signed-in user;
- share links read through a function the rule doesn't bind.

Then I changed the rule to signed-in users only — one reversible line — and verified both sides:
the outsider check is green, and the Activity page, signed in, still loads its full log live (394
events, every tile and the refused-visit badge intact).

**Two honest notes.** The log has grown from 378 to 394 since it was last counted, and 16 of the new
rows are refused page visits from a test-account walk — I first wrote here that they were mine; the
log says otherwise: all sixteen are one sixty-second walk at 01:27 UTC by the parallel Build-lane
session, which has since put the block into the read-only recipe so it cannot happen again. Either
way they are a test account's, not a person's. And the outsider check had not been run since 20
September; the rule now says *every* sweep, so that gap can't quietly reopen.

**Nothing is required from you.** If you ever want it back the way it was, it is one line, written
down in DECISIONS M87.

**Measured while the closing test run was going, and deliberately not acted on** (so the next
session doesn't re-derive them): every one of the 46 live invoices is linked to a live client, and
no money sits on a lead; all 45 contacts and 65 activities in the side tables belong to live
companies and reach the cards through the bridge; the only active account off the sign-up
allowlist is the test account, by design. Two things worth one line each. `finance_reconciliation_gaps`
holds 46 rows that nothing in the app reads — a leftover of August's transactions experiment.
And **one client holds both a tender profile and an ordinary one**; the Finance sector split puts
its single invoice (33,800 SAR, 1.7% of revenue) under Tenders because that profile happens to sort
last, not because anyone decided. Which sector a client with both kinds of profile belongs to is
your call, not a code fix — say the word and it becomes a rule. Three old demo profiles were also
half-closed on 2 September (closed date set, status still "active"); they resolve to the same
sector as their live twins, so nothing on screen is wrong today.

**Also settled in this round — the six Generator document tests, and why nobody could say if they
still pass.** The bulk test list has carried a note for weeks: *"Nobody in this session has ever run
these; the Generator task should confirm they still pass."* I ran them. Each one passes its
code-reading checks and then dies waiting for the sign-in form, because the app never boots under
it: the browser-testing library was updated (it is now 1.55) and it stopped recognising the way
those six files name the addresses they intercept — a pattern starting `**` with no slash after it.
So their request for the Supabase library goes to the real internet, hits the sandbox's certificate
wall, and the sign-in form never appears. Confirmed with a five-second test of the exact pattern:
`**cdn.jsdelivr.net/**` does not match, `**/cdn.jsdelivr.net/**` does. **The fix is one character in
each intercept line** across the six files in `scripts/generator-qa/`. I have not made it — that
folder belongs to the Generator lane, whose session is landing work right now — and I've handed it
over as a task with the exact cause. Until it's done, those six tests prove only what they can read
in the code, not what the documents look like.

---

## Routine fire #243 (2026-09-24 ~21:00 UTC) — Settings now speaks Arabic all the way down

I opened every Settings sub-page in Arabic against your real database: Team & Access, Connections,
the Commercial Credit Pool, the company registry, the chain-of-command note. Team & Access is clean
— all eleven accounts, both languages. Connections is clean. Two surfaces were half done:

- **The Credit Pool dialog** read "POOL CAP (SAR)", an English hint in the reason box, and an
  English help sentence, under an Arabic title. The card behind it had the same problem in its
  sub-line, which carries the cap figure — that is why the usual translation list never caught it;
  a sentence with a number in it can't be matched word-for-word.
- **The company registry** printed an English provenance line under every one of its 29 rows —
  "Official records", "Bank accounts sheet", "Company letterhead", and so on. Every row's *name* was
  Arabic, which made the English stand out more, not less. Sixteen distinct phrases, all written by
  whoever loaded the registry.

Both are fixed. Settings in Arabic went from twelve English lines to none; the registry page to
none. Two guarantees worth knowing: the English side reads exactly as it did — I check for that —
and the registry translation is **display only**. When you edit a row, the box still holds the
stored English source, so saving can never quietly overwrite it with the Arabic word. A phrase the
list doesn't know shows in English rather than disappearing.

One honest caveat: the Credit Pool card's sub-line is translated but an existing style rule hides
that line on the live page, so you won't see it — the dialog and buttons you will.

**Checked and left alone:** the "Open Team & Access" and "Team members + roles" buttons looked dead
in my first pass; they weren't — they open an overlay my measurement couldn't see. The
"Chain-of-command" card shows a short notice pointing you to the client card, by design.

---

## Routine fire #242 (2026-09-24 ~19:00 UTC) — "Invoices" said nothing had come from Direct, while Finance held 46 invoices from Direct

I drove the pages I had not touched this session — Bookings, Tickets, Invoices, Operations,
Projects — against your real database in both languages. All are honest empty states, no errors,
nothing printed wrong. One of them, though, was honest about itself and wrong about you.

Click **Invoices** in the sidebar — the obvious place to look for an invoice — and the page opened
on **"Nothing has been brought in from Direct yet"** above **"BILLED 0 SAR"**. Two clicks away,
Finance holds **46 invoices captured from Direct Payments**, more than 2 million SAR of revenue.
A colleague reading that first sentence would reasonably conclude the app has no invoice data. It
does; it is just on a different page.

The page now says: **"This page holds nothing — the 46 invoices captured from Direct are on the
Finance page"**, with a button that takes you there. The 46 is Finance's own number, read through
the same gate Finance uses, so a deleted invoice is never counted here that isn't counted there.
If the ledger were ever empty, the original sentence comes back — because then it would be true.
Bookings and Tickets have no ledger behind them, so their wording is unchanged.

Everything else on those five pages is as it should be. Two things I checked and left alone: the
lock banner on the three Direct-owned pages shows both languages on purpose — you corrected that
yourself in August, active language first — and the Operations board's dashes sit under a line that
already explains the zeros.
## Phase 1b — the database learns the levels, page by page (2026-09-25, Claude Code)

Done on the owner's word "do what you recommend and keep going" (his rulings: the manager gets the
Generator — done, logged; the 20 unowned clients stay unowned). All five parts are live in the
database and listed in DECISIONS D2 "Phase 1b as built": A tables & files by page, B the shared
workspace section by section, C Undo asks the page, D Team → Add gives the role's grid (a real gap:
new employees would have opened Today only), E Leads/Clients owner accounts and "own work". Each
was compared old-vs-new for every live person (the only losses: writes on pages the person cannot
open, on tables no such person ever wrote), attacked live, and sabotaged. Screen: the lead card's
"Create proposal" / "New booking" follow the page; Team & Access marks View pages "buttons still show"
(true since the database refuses); "Own work" not yet choosable (see D2).
**Waiting on the owner:** merging PR #32 (1a screen + 1b screen bits); after it, the stored-word
rename (`scripts/sql/phase1a-rename-levels.sql`). The role floors listed in D2 (finance
transactions/receipts/cost lines, money-file deletes, merges) are his to lift or keep.
**Next build step:** the Leads and Clients screens withhold changes on companies the person may not
change (View, and Own on other people's companies) — which also opens "Own work" in Team & Access —
then the other "buttons still show" pages.
**Noticed, not acted on:** the admin-users function still checks passwords against 8 characters
while the Supabase policy (and `MIN_PW`) is 10 — Supabase refuses the short one anyway, so the only
effect is a less helpful message; it still writes the retired `allowed_pages` list (unread).
ksa_event_signups has a `login_password` column — a stored password for an event portal; worth a
look when Events is next touched.

---

## Phase 1a — one access check, four levels (2026-09-25, Claude Code)

Built as ruled (DECISIONS D2, "Phase 1a as built"). **Database, live now, changed nobody's access**
(220 person × page checks against the stored grids, 0 differences): `page_level` is the one check;
the three older checks answer through it; `my_page_levels` feeds the screen; `set_page_levels` is
the one way to change a grid; `team_access_list` lets the manager see the team; a guard trigger
refuses unknown pages/words and gives new people their role's starting grid. **Screen, in the pull
request:** js/52 asks the database's answer and fails closed while it loads; js/56 is the four-level
Team & Access editor for admins and the manager (20 pages; "Own work" shown, not yet choosable); js/15's
second gate and its old Access window are retired (its button now opens Team & Access); the six
Generator editors ask the shared check.
**Tests:** `scripts/qa/access-levels-attacks.sql` 31/31 (sabotaged: fails what depends on the check);
`scripts/qa/live-access-levels-drive.mjs` as admin, manager and employee against the live database;
six battery probes updated for four levels, each with the reason in the file; three sabotages of the
new screen code each caught.
**After the merge (next step, mine):** run `scripts/sql/phase1a-rename-levels.sql` (editor → full,
viewer → view) with the before/after check.
**Done 2026-09-25:** PR #32 merged (battery 342/342 on the final tree); the rename ran with 0 differences
across 220 person × page checks.
**Found on the way, fixed here:** probe-m13-remaining's refusal run was red on every run — both of its
refusal checks listened for the browser's own alert box, which js/63 replaced with an in-page notice.
The Settings card said "the level alone decides which pages they open" — untrue since the per-page
grid; reworded. The D4 entry of PR #31 cited two paths the decisions guard could not resolve.
**For 1b (not done here, on purpose):** the "enforced" lists on screen (`PAGES_VIEWER_ENFORCED` in
js/52, the green-dot list in js/56) still overstate Settings and Activity (Phase 0 §4) — they are
corrected page by page as each page is taught; js/52's refusal sentence still says "Your account covers
Leads, Clients and Finance" whatever the grid holds; the unread `allowed_pages` column can be dropped.

---

## Phase 0 review — the task manager build starts (2026-09-25, Claude Code)

The owner's oversight chat handed a brief to a new Claude Code session: record decisions D1–D6,
then review (no code) before building the task manager, the four access levels and the new design.
Done: D1–D6 are in `docs/DECISIONS.md` (after the rule 8 entry), each with what was measured; the
full review is `docs/PHASE0_REVIEW_2026-09-25.md`. **No app code changed.** The hourly QA routine
was confirmed paused before anything was written (its last run landed 09:23 UTC).
**Answered the same day** (recorded in DECISIONS D2, D4, P4): order 1a → 1b → 1c → Phase 3, with
the Reports export moved into Phase 3; Airlines/Suppliers/SOP & SLA View or Full only; Projects,
Bookings, Invoices, Tickets and Sync join the grid; storage, edge functions and triggers in scope;
live attack tests as employee and manager; the portal is the design base; DirectFont waits for the
web/marketing team's written OK; P4 suspended while one session writes.
~~**Still open:** that written OK for DirectFont (the owner brings it).~~ **Closed 2026-09-26:** the owner gave his OK
(DECISIONS D4); DirectFont goes live in its own small PR after #41 (loaded from assets.directksa.com, never copied here).
**Live (#42); the Generator's headings followed on 2026-09-26** — see D4. Found on the way and fixed in the same PR:
**neither PowerPoint button had ever worked.** Reports → PowerPoint loaded its engine from a cdnjs address that does not
exist (404), and the Projects decks loaded a build that needs a zip helper the app never loads. The harness hid both —
it answers every jsdelivr request with a stand-in. **Still open, for the owner:** the documents' BODY text lists fonts
the app never loads (Proxima Nova, Zarid Slab), so it prints in the reader's own system fonts — DirectFont for body
text too, or load Zarid Slab (its files are in `brand/fonts/`)? One answer, then a small PR.
**Answered 2026-09-26 — DirectFont for body text too, Cairo behind it; done in #45** (DECISIONS D4).

### Downloads are tested for real, and live at every release (2026-09-26, the oversight after #44)
The two PowerPoint buttons #44 found broken had passed every test for months: the harness answers every
cdn.jsdelivr.net request with the Supabase library, so the engine "loaded" and nothing ever pressed the button and
opened the file. **`scripts/qa/probe-real-downloads.mjs`** (in the battery) now presses every download a person has —
Reports → PowerPoint and → Print/PDF, the Projects proposal deck and PDF, the service-fee proposal deck and PDF, an
invoice print, the client proposal, and each Generator document's print button — with the REAL engines and fonts
(only the Supabase library is stood in), in English and Arabic, and opens what comes out: a real .pptx with slides,
a real PDF in DirectFont with its Arabic in DirectFont. Sabotage-tested: the two #44 bugs put back → 8 red.
**Every release's live check runs it against the live site:** `LIVE=1 node scripts/qa/probe-real-downloads.mjs`
(QA account, read-only — the app's writes are answered inside the page and listed at the end; files go to a temp
folder and are deleted, they carry real data). A path with nothing to print yet on the live data (no project, no
invoice) says so on screen instead of passing.
Test-harness finding worth keeping: Playwright holds back every request made by a window opened from an
intercepted page (its stylesheet arrives only when it closes) — a document window tested that way prints in a
system font for the test's reason, not the app's. The probe stops intercepting while such a window opens.

---

## Build lane — the sweep before the new pages (2026-09-24, 00:40–04:00 UTC; landed by the reviewer lane)

A new session, started by the owner to (1) sweep the app and then (2) build the task manager, the
appraisal cycle and the report registration inside it (his decision "A" of 24 Sep — CLAUDE.md rule 8
is amended in this commit). This entry is the sweep. Nothing of phase 2 is built yet; the schema goes
to him as one document first.

**What was done.** The full battery on the origin tip (`0d0c66e`), then the REAL app driven against
the REAL database read-only (every table write and `save_state*` blocked at the route — 0 table writes were
even attempted, 0 browser dialogs; the one thing that did reach the database was the app's own
refusal logging: the team-member walk made js/64 write 16 "Page access · Refused" rows — the recipe
in CLAUDE.md now blocks `log_page_denied` as well) through every page a person can reach — Today, Leads (list, card,
quick edit, Mine), Clients (list, card), the eight Finance tabs, Proposals, Events, Projects, the four
Reports tabs, Airlines, Providers, SOPs & SLAs, Operations, the six Generator families, Activity &
Audit, Archive, Settings, Connections and the three hidden legacy editors — in English then Arabic,
at 1500px then 400px, plus every address the router answers booted cold. Every count on screen was
read against the database's own `count=exact`: 108 live companies (28 clients, 80 leads of which 78
open), 46 live invoices of 91 (19 with cost 0), 80 events (43 shown, and the page says so), 139
airlines (136 shown, and the page says so), 23 providers, 12 SOPs, 14 SLAs, 378 audit rows, 4 deleted
companies, 0 generated documents, 0 proposals, 0 requests, 0 projects. **Every number agrees.**

**Found and fixed here (each with a probe and a sabotage test):**

- **The Activity & Audit page, and the "Recent changes" card on every company card, were unreadable
  on a phone** — one word per line, lines overlapping, in both languages. Every audit row was an
  inline four-column grid with a 150px first column; at 400px the text columns got a few dozen
  pixels. The grid now lives in a class that stacks under 640px (js/63; rule M88).
  `probe-audit-rows-read-on-a-phone` (9271) measures the rows at 400px and 1500px.
- **"nothing yet today — last change 3 days ago" counted refused page visits as changes** — the line
  sat directly above a 7-day tile saying "all 39 were refused page visits — no record changed". The
  last record anyone changed was 9 Sep, fifteen days earlier. The line now reads over record rows
  only and says "last record change" (js/63; M76). Same probe, both languages.
- **An empty grey pill under the company name on most cards** — `<span class="tag seg">` was drawn
  even when the company had no segment, and 98 of the 108 live companies have none (live-test item
  L8 was closed after a look at the list; the pill was on the card). Drawn only when there is a
  segment (core-02). `probe-card-pill-and-category-word` (9272).
- **In Arabic the card's Category read «الفئة» over the English "Anchor"** — a word js/21 already
  carried. Category is the app's own list (CATEGORIES), so its value is translated when it is exactly
  one of those words, and only then; a typed value is left alone (M58). Same probe.
- **Finance's held-back sentence said "the figures above" from the top of the page** — js/99 inserts
  it before the first child, above every figure it describes. It says "on this page" now, both
  languages; `probe-finance-says-what-it-held-back` gained the check.

**Measured and found correct, so nobody needs to wonder:** no `NaN` / `undefined` / `[object` on any
of the ~90 views read; no sideways scroll on any page at 400px; every route boots to its own page
(`/dashboard` → Today, `/providers` → Providers, `/operations` → Operations, nonsense → Today); the
only English left on the Arabic side is data (company and event names, city names, SOP bodies, the
airline register's fare text, provider types, the 30 KPI titles the owner has yet to word) plus the
document previews, which are in the document's own language by design.

**For the owner — facts, not requests:** (1) **nobody has changed a record through the app since
9 Sep** — every audit row since then is a QA sweep's refused page visit; the team is not using it
yet. (2) `client_profiles` rows appear in the audit log under their type ("Client profile · Edited ·
tender") because a profile has no name of its own — cosmetic, and better fixed when the profile gets a
company link on screen. (3) At 04:00 Riyadh the English greeting says "Late night" and the Arabic one
"مساء الخير" — two clocks for one moment; trivial. (4) The team-member walk was done by rewriting the role the app READS (the database still saw an
admin): the page gate behaved exactly as designed — Today, Leads, Clients and Finance open, every
other page bounces to Today with the banner — but what the database itself refuses a team member was
not exercised here; the 9 Sep way (switch the QA row in `app_users` for a drive) needs a write and
was outside a read-only sweep. (5) The owner's own list of twenty decisions at the top of this file
stands; item 11 (where KPIs live) is answered by "A" and is what phase 2 builds.

**The battery, honestly.** b1 on the untouched tip: 322 green of 324 that can fail; the two that
reproduced alone — `probe-audit-names-and-words` and `probe-history-actor-and-sync-words` — were
both red BEFORE this session touched anything: fire #230 (23 Sep) hid refused page visits behind a
badge and both probes still expected one visible. Each now asks "Show them" first only when the row
is not already on the page (fire #241 has since shown the rows by default again, so the click is a
no-op on this tip); their checks are unchanged. b2 after the fixes: 322 / 324 again — the second
stale probe (repaired after b2) and this session's own new probe, which started at the `/activity`
address and so took js/63's anonymous-boot path (fire #70's subject) and lost a race one run in
three; it starts on Today now and was run four times alone, green each time. b4, the full battery on
the Build lane's commit (rebased onto fire #238, both stale probes repaired, the new probe on its own
boot path): **325 / 325 probes that can fail, no red reproduced alone** — five went red under `-j 4`
and green by themselves (the two share-link probes, a-shared-card-keeps-our-notes-inside,
the-ops-board-says-why-it-is-empty, two-people-one-record-are-told); the machine has two cores.

**How it landed.** The Build session's `git push` was refused by the proxy ("not in this session's
authorized repository set"), so its commit was saved as a patch (Drive part 13a, project doc "BUILD
LANE — patch 24 Sep") and applied here by the reviewer lane on tip `5dcc929`, with two renames
because the watch session's fires #240–#241 landed in between: its rule M84 became **M88** (fires #240, #242, #243 and #244 took M84–M87 meanwhile) and its probes moved
to ports **9271** and **9272** (9266, 9267 and 9270 were taken by those fires). The battery was re-run on this
tip before the push (result in the commit message).

---

