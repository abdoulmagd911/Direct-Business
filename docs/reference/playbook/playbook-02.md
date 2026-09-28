## 6 · How to not be wrong

The pattern behind the real mistakes this project has actually made, and the discipline that
now exists specifically because of each one:

- **Verify by behaviour, never by filename or by reading the code alone.** The QA harness
  serves fake data by design — a page can look completely correct in the mock and be broken
  or empty against real Supabase rows. More than one session lost real time to exactly this
  gap; the standing fix is to check the harness AND a real screenshot or real database read
  before calling anything verified.
- **A check with a blind spot is worse than no check**, because it creates false confidence.
  The Arabic-translation sweep script was built to catch untranslated English text — but its
  own design meant it structurally could not see certain gaps (a compound element mixing a
  dynamic value with static text; a pagination bar rendered a particular way). It reported
  "all clear" while a real gap sat in plain sight on screen. The fix was not just patching the
  one gap found by hand — it was rebuilding the scanner so that class of gap can't hide again.
- **When a test reports zero, ask whether it could actually see anything at all before
  trusting the zero.** The COGs Report returning "0 rows" for every filter combination tried
  looked at first like a filter-syntax problem — until it was checked from a second,
  completely independent angle (the export-run registry, which also showed 0 rows on both of
  its two actual runs). Two independent zeroes is real evidence of "empty." One zero alone is
  not — it might just mean the check couldn't see anything.
- **Reconcile every important number against a second, independent source before trusting
  it.** The two close-but-different invoice totals in §2 above (8,791,497 vs 8,909,774) are
  flagged rather than silently accepted for exactly this reason — a plausible explanation is
  not the same thing as a proven one.
- **A file in the wrong shape can silently import as nothing, and that must never look like
  success.** The invoice importer's column-mapping logic fails closed on a shape it doesn't
  recognise — it refuses the whole file with a clear message rather than guessing at columns
  and silently importing garbage or nothing. Any new import path must follow the same rule:
  an unrecognised shape is a loud refusal, never a quiet no-op that looks like it worked.
- **A real, would-have-shipped bug found by actually driving the flow end to end, not by
  reading the code:** the 2026-08-22 password-recovery work found that clicking a real
  password-reset email link would, most of the time, silently sign the person in without ever
  letting them choose a new password — a race between two pieces of code that reading either
  one in isolation would not have revealed. It only surfaced because the recovery flow was
  driven start to finish in the test harness, not reviewed as a diff.
- **The test machine's own settings are part of the test (2026-09-18, fire #94).** Every QA
  round until then had driven the app in one browser, set to English, and called the English
  side clean. Drive the same English app in a browser set to Arabic and a lead's dates come
  out as the Hijri year in Arabic-Indic digits, and a client-facing quotation prints two
  number systems at once. `toLocaleString()` and friends with no language named do not mean
  English — they mean "whatever this laptop is set to", which is never the app's business.
  When a language, a currency, a time zone or a date could come from the environment rather
  than from the app, change the environment and run it again.
- **A gate is worth adding when the class has exactly one right answer.** Escape always
  closes a dialog (fire #92); a formatter always names its language (fire #94) — both became
  rules in `check-structure` and both immediately found more instances than the hunt had.
  M1 does not have one statically visible shape, so the rule proposed for it was measured,
  found to flag correct code, and rejected (fire #93). Measure the rule against the current
  tree before adding it; a gate with a false positive on correct code is worse than no gate.
- **The sandbox runs in UTC and in English. The team does not (2026-09-18, fires #94 and #95).**
  Two rounds in a row found the environment, not the code, deciding what the app said and did:
  the browser's language chose the digits on a client-facing quotation, and the browser's clock
  chose what "today" meant — in Riyadh, UTC+3, that is yesterday from midnight to 3am, on
  comparisons, on pre-filled date boxes and on "recorded on" stamps alike. Both had been invisible
  for the whole project because every QA run used a UTC, English machine. **Vary the environment,
  not just the input:** timezone, language, clock, screen size.
- **The Arabic sweep only sees each page at rest (2026-09-19, fire #98).** `sweep-language` visits
  every nav page in Arabic and reports almost nothing, which is true and also not the whole picture:
  it never types, never filters, never sees an empty list and never sees an error state. Both of the
  last two rounds' language defects lived exactly there. When checking a language, check the states
  a page only reaches by being used.
- **A layer's name is not evidence that it works (2026-09-19, fire #101).** js/03 is called "filter
  memory each section" and keeps filters in history.state. Driven, the memory only holds while the
  page is alive — the one case where nothing needed restoring. Neutering its restore function
  changed nothing on screen, which is how the gap showed. When a probe's sabotage changes nothing,
  the suspicion belongs on the code being guarded, not only on the probe.
- **When a fix lands in one layer, grep for its twin (2026-09-19, fire #102).** js/65 fixed the
  "deleted invoice reported as already imported" bug on 2026-09-02, in the owner's own words. js/41
  held the same line, unfixed, for another 17 days. A fix written in one layer does not travel to
  the layer it wraps; the question "does any other layer still do the old thing?" is one grep, and
  it is the cheapest defect this project has.
- **Calling a function is not using the app — and one use is not using it either (2026-09-19,
  fire #102).** The twin above was found by driving js/41's preview through a test hook and written
  up as what a person sees. A single real file drop then showed js/65's answer instead, so it was
  re-written up as unreachable. **Four drops showed the truth:** js/16 attaches its drop listener
  from a `setTimeout(...,0)` that runs after js/65 has replaced the drop-zone node, so the node
  carries both handlers, every file is read twice, and the answer on screen is whichever importer
  finished last — which changed with the number of files already dropped. A hook proved nothing; one
  drop proved the wrong thing; the repeat proved it. **Drive the thing more than once, and in the
  order a person would.** State-dependent defects are invisible to a single try.
- **Sabotage a copy, not the repository (2026-09-20, fire #117).** The mock server takes `APP_DIR`,
  so a sabotage run is `cp -r index.html js <scratch>` + edit the copy + `APP_DIR=<scratch> node
  scripts/qa/probe-….mjs`. The repository is never edited, so there is nothing to restore and
  nothing to get wrong, and a battery running at the same time cannot be disturbed — which is
  exactly what happened earlier in this session, when a mid-battery sabotage put a probe red for a
  reason that had nothing to do with the tree. Use this in preference to edit-and-restore.
- **The sentence that makes a number allowed to be shown needs a guard as much as the number does
  (2026-09-20, fire #117).** 43.6% of the profit figure on the Finance page comes from nineteen
  invoices whose cost nobody has recorded; `cost_sar = 0` is permitted to stay an honest gap
  (DECISIONS M8) *only because* the page prints "N of M invoices in this period carry no recorded
  cost". That sentence was one `if` inside a several-hundred-line render function, asserted
  nowhere — a probe elsewhere even called it, in a comment, the headline that "already warns
  honestly". A comment is not a check. **Where a rule says a figure may be published as long as a
  caveat accompanies it, the caveat is part of the figure: guard it, and guard that it stays away
  when it is not true**, or "always printed" passes for "correct".
- **When a round finds a defect, spend the next one looking for its shape everywhere else
  (2026-09-20, fire #116).** #115 found one form deleting an answer it could not display. Asking the
  same question of every other fixed list in the app took one afternoon and found it in the form the
  team uses most: **all 108 companies** held a source outside the sixteen the box offered, so opening
  any lead and pressing Save rewrote where it came from. Two more boxes had it as well. The sweep
  also cleared six lists honestly, which is worth as much — it is what stops the next round
  re-checking them. A defect is rarely alone; the second search is cheaper than the first and usually
  finds more.
- **One cause can look like two defects (2026-09-20, fire #128).** pfPrompt took focus but did not trap it, and separately "Escape did not close it" — which was the SAME defect: its Escape listener was on the input, so once Tab had carried the keyboard out of the box the key had nowhere to land. Reporting two would have meant two fixes and one of them wrong. Ask what a second symptom would look like if the first cause were the only cause.
- **Clear the last box before measuring the next (2026-09-20, fire #128).** A driver that opened six boxes in turn reported all six as broken: the first Escape had not closed its box, so every later case measured the LEFTOVER. A measurement loop must prove the thing it is about to measure is new — and clean up itself rather than trusting the app to.
- **A comment that says the guard covers something is not the guard (2026-09-20, fire #127).** core-06's focus trap is introduced by a comment reading "Focus trap inside modals (#ov + #v19palette + #v20confirm)". The palette wrapper set ARIA attributes and never called the trap, and five of six tabs walked the page behind the open palette. The comment described the intention. **Read what the code does, then read what the comment claims, and treat a difference as a defect in the code until proven otherwise.**
- **Stop finding the same shape by hand — crawl for it (2026-09-20, fire #127).** Three rounds found overlays missing a protection one at a time. A crawler that clicks every visible button, notices when a full-screen box appears and measures the property found two more in one run, and covers boxes nobody has written yet. When a defect class is defined by a SHAPE rather than a place, the check should look for the shape.
- **A layer that builds its OWN overlay does not get the shared one's protections (2026-09-21, fire #126).** The focus trap, and before it the Escape key (fire #92), both reached the shared modal and missed js/09's own box — so a keyboard user opening the funnel form was typing into the card behind it. Whenever a layer appends its own full-screen element instead of using `openModal`, it has to ask for every courtesy by hand: the Escape key, the focus trap, releasing the trap, and putting the keyboard back where it was.
- **Check the app without a mouse (2026-09-21, fire #126).** Nothing in this project had ever measured where the keyboard goes when a dialog opens. It takes one driver: click the real button, read `document.activeElement`, press Tab twenty times and ask whether every stop is inside the box. It found a real defect the first time it was run.
- **Know which element the app actually toggles (2026-09-21, fire #124).** The main modal is shown and hidden by the `show` class on `#ov`, and `#modal` is REUSED. A driver that removes `#modal` breaks the next form, one that sets it to `display:none` makes the next form open invisibly, and a check that reads `#modal`'s display reports "never closes" for a box that closes every time — all three happened in one round. Before measuring whether something is open, find the line that opens it. And close a box the way a person does.
- **A DOM value can be right in a control nobody can see (2026-09-21, fire #124).** Every probe written for the seven rounds before this one read values. Added fields fail in a way values cannot show: the page scrolls sideways, or a control lands outside the window — and only at the narrower width, so a check at one size proves little. Assert the fit as well as the value, at more than one width.
- **When a defect has been found by hand three times, make the build find the fourth (2026-09-21, fire #123).** The dropdown-with-no-matching-option defect was found five times in this codebase, a round apart each time. check-structure now scans for the shape and requires a written verdict per dropdown in `scripts/qa/select-lists-judged.txt` — FILTER (nothing stored), IN-LIST (checked against the live data), or NO-ROWS (carries the defect, fix before that feature is used). The classification is worth as much as the gate: of 41, thirteen are filters that can lose nothing and five are already correct, which is a very different statement from '41 latent defects' — and correcting that overstatement, written a round earlier, was part of the work.
- **A subset check is not a presence check (2026-09-21, fire #122).** The event save was guarded by "every key sent is a real column" — which a save that stopped sending the event's PLAN would have passed, while the page's tiles went on filtering by that column. Whenever a check walks what was produced and asks whether each item is allowed, ask the other question too: **is what must be there, there** — and does it carry the value that was chosen, not the default? Same family as 'check both directions of a swap' (#112) and 'a counter belongs to a list' (#104).
- **A probe must FAIL, not explode (2026-09-21, fire #121).** With the website box removed, a check read `.value` on a null and the probe threw at the first assertion — nine other checks never ran, and the red said nothing about what was wrong. Non-zero is not enough: read every measurement through a guard that yields a value the checks can print, so a sabotage (or a real regression) produces a list of failures rather than a stack trace.
- **A field the app PRINTS but no form can write is a gap, not a design (2026-09-20, fire #120).** The contacts table has a `role` column, the lead card printed it beside the name, and the edit form had no box for it — so eleven people had a title from an import that could not be corrected and thirty-four could never be given one. When a card shows a field, ask where it is typed; if the answer is nowhere, that is the finding.
- **A fixture that invents a record the code has never seen tests nothing (2026-09-20, fire #120).** js/72 writes a contact back only if its row came from the contacts table it read, so a made-up `_tid` produced no write and a red that had nothing to do with the app. Seed the row in the store the code actually reads — and remember the app's id for a record is not the database row id, so find the record the code attached it to rather than guessing the id.
- **A `<select>` with nothing selected shows its FIRST option — this codebase has been bitten by it five times (round 30; fires #115, #116, #119).** Round 30 found the access matrix calling unknown roles "Admin"; #115 the funnel form deleting answers; #116 every company losing where it came from; #119 nineteen companies filed as ministries. It is not an incident, it is a pattern: **wherever options come from a fixed list and the selection comes from a record, ask the database how many stored values are outside that list before assuming none are.** The scan that finds them is one regex over the source plus one query per list.
- **A control that cannot show what is stored will quietly delete it (2026-09-20, fire #115).** The
  funnel form's dropdowns were built from an option list, the answers were written by the importer
  from the source files, and nobody ever made the two agree: seven live answers — "Partner" where
  the list says `partner_target`, "Won" where it says `won` — had no matching option. A `<select>`
  with no match opens on "—", and Save treats an empty control as *cleared on purpose*. So opening
  the form and pressing Save with nothing touched took three of one real lead's six answers away.
  The same shape is in every strict control: a number box refuses "about 40", a date box refuses
  "March 2026", both come up empty, both end in the same deletion. **Whenever a form is about to
  read a control back, ask first whether that control could even hold what is on file — and where
  it cannot, show the stored answer rather than a blank.** Emptiness that the person did not cause
  must never be read as an instruction.
- **An option list and the data it describes are written by different hands (2026-09-20, fire
  #115).** The templates were authored in the funnels table; the answers came in through an
  importer reading spreadsheets. Each was reasonable alone and neither ever saw the other. The
  cheap check — for every field with a fixed set of values, ask the database how many stored
  answers are outside that set — took one query and found all seven. It is the same family as
  counting the stores against each other (fire #109/#110), and it belongs in every round that
  touches a dropdown, a stage list or a status chip.
- **A deliberate hiding needs a guard as much as a feature does (2026-09-20, fire #114).** Ten
  developer cards are kept off Settings by one loop setting `display:none` — including a "Wipe test
  records" harness and a "reset for go-live" suite. Nothing asserted they stay hidden, so any change
  to that layer, to a heading's wording, or to the render wrapper would put them in front of the
  team with no failing test anywhere. Where the safety comes from something being hidden, the probe
  has to say so out loud.
- **Two things that do the same job should agree (2026-09-20, fire #113).** The command palette
  labelled a company "Client" and the top-bar search labelled the same company "Lead", because one
  read `isClient` and the other had the word hardcoded. Neither looks wrong on its own; driving both
  in the same session is what showed it. Where the app has two ways to do one thing — search, open,
  format, count — drive them side by side and compare the answers.
- **A count taken too early is indistinguishable from a real loss (2026-09-20, fire #113).** A
  measurement run the moment the first companies arrived reported "8 clients" and "this client
  cannot be found", and both were false — the list loads a page at a time. Before reporting that
  data is missing, wait for the load and take the number twice. This is the mirror image of
  "count the stores against each other": that rule finds real losses, this one stops inventing them.
- **Do the code half, leave the content half (2026-09-20, fire #112).** The Arabic report printed
  Arabic objectives over 30 English KPI lines. Two different gaps sat inside that: the code never
  looked for an Arabic KPI title, and no Arabic KPI title exists. The first is a fix; the second is
  the owner's wording for his own performance framework and must not be invented. Wiring the code
  so the translation drops straight in — and proving with a probe that it lands — turns a blocked
  finding into a one-line content edit for him.
- **Check both directions of a swap (2026-09-20, fire #112).** Switching the KPI titles to Arabic
  looked finished after four call sites: the shortfall list read Arabic. Asserting only "the Arabic
  is there" would have shipped it. Asserting *also* "the English of that same item is gone" found
  two more places still printing it, one of them on another tab. A replacement is only complete when
  the thing it replaced has disappeared.
- **A report that names its own remedy should become a check (2026-09-20, fire #111).**
  `probe-crm-attacks` had been printing, as a report rather than a failure, that one person shows
  twice when their number is written locally in one place and internationally in the other — and it
  said exactly how to fix it. It sat there for weeks because a report cannot go red. If a probe can
  describe the defect and the fix, the fix is small enough to do and the report is a check waiting
  to be written.
- **When a check fails because of a change you made, decide which one is wrong (2026-09-20,
  fire #111).** The contacts fix turned a check red, and the tempting move is to assume the code is
  wrong and revert. Here the check's fixture called two differently-named people "the same person"
  and required them to merge — which is what hid a real person. The evidence, not the failure
  itself, settles it: live data and the written doctrine beat a fixture written before either.
  Changing a check to match your own change needs that evidence, or it is just moving the goalposts.
- **A shared phone number is not the same person (2026-09-19, fire #109).** The people bridge
  decided "already on the card" by matching an email **or** a phone on its own, so two colleagues on
  one switchboard — or one `info@` mailbox — collapsed into one and the second vanished with their
  name, role, email and phone. On the live data that hid two people on one company. Identity needs
  the name to agree as well; a shared line is evidence only when there is no name to compare. The
  master brief already said it: a mismatch is flagged, never silently merged.
- **Count the stores against each other (2026-09-19, fires #104 and #109).** Both of these started
  the same way — the database holds N, the app holds fewer, so ask which ones and why. For airlines
  it was two stores nobody reconciles; for contacts it was a merge rule that was too eager. A
  one-line count comparison is the cheapest defect-finder in this project, and it works on any
  table the app mirrors.
- **A form's value is not text (2026-09-19, fire #108).** Every cell of the Service Levels table is
  an `<input>` or `<textarea>`, so `innerText` and `textContent` both read blank on a table that is
  plainly full. Reading it the ordinary way looked like a catastrophic defect for several minutes;
  the screenshot settled it. Any page built from editable cells has to be read through `.value`,
  and any check that reads it as text is asserting on emptiness without knowing.
- **Checking the shape of a table is not checking the table (2026-09-19, fire #108).** The existing
  Service Levels probe asserted no stray ✕, nothing resizable, a Delete per row, no sideways
  scroll — and every one of those would still pass with all fourteen rows rendered empty. Shape
  checks are cheap and worth having, but at least one check has to assert that the content is
  there and is the right content.
- **"It filtered to something" is not a check (2026-09-19, fire #107).** The Events probe asserted
  that clicking a tile left more than none and fewer than all of the rows. That passes on a tile
  whose number has nothing to do with the list beneath it — which is exactly how the Airlines
  buttons were wrong for months with a probe watching. Where a control shows a number, compare the
  number with what the control produces; anything looser is a check that cannot see the defect it
  is there for.
- **A background job must not redraw the whole page (2026-09-19, fire #106).** The layer that looks
  up your name and role re-rendered everything when it finished, on load, at 3s, at 8s and on every
  return to the browser tab. That is what made "Next ›" impossible to use on a 136-row list — press
  it, and a second later you are back at the top — and it is what was wiping the filter buttons in
  #105. A background refresh should update the thing it fetched and nothing else, and should do
  even that only when the value actually changed. Where a full redraw is genuinely needed, whatever
  the person had chosen — page, filter, scroll — has to be put back.
- **Symptom-level and cause-level fixes are both worth having (2026-09-19, fire #106).** #105
  taught the chips to survive the re-render; #106 removed the re-render. Sabotaging either one
  alone flips only one check, because the other still protects the reader — which is the point.
  Defence in depth is only real if each layer is verified on its own.
- **A control should only name values the data can hold (2026-09-19, fire #105).** Nine of the
  eleven filter buttons on Bookings, Invoices and Tickets named words that are in no record: the
  Tickets buttons said Issued/Voided/Refunded while booking statuses are Confirmed/Pending/
  Ticketed/Delivered/Cancelled, and Invoices offered "Unpaid", which is not a status. Checking a
  control's vocabulary against the app's own constants is a two-line test and would have caught all
  of it the day it shipped; the probe now does exactly that. Where the word people want does not
  exist in the data — real ticket-level issued/voided — say so and ask for the field, rather than
  inventing a mapping.
- **A filter that does not survive the next render is not a filter (2026-09-19, fire #105).** The
  app re-renders in the background. A list filtered to "Today" came back whole about a second
  later, under a button still lit — the screen disagreeing with itself, the exact thing fire #101
  set out to make impossible, and invisible to any check that reads once and moves on. Read the
  screen again a beat later; and whatever state a control sets has to be re-applied by whatever
  rebuilds the page, highlight included.
- **Filter the data, not the pixels (2026-09-19, fire #104).** The Airlines alliance buttons were
  applied by hiding table rows whose visible text lacked the button's word. The alliance is not a
  column on that table, so three buttons matched nothing and one matched on coincidence. This is
  the same shape as the Leads chips fixed on 2026-08-09 (hiding `.lead` cards in a table that has
  none). Any filter written against the rendered output breaks the moment the column it depends on
  is moved, renamed or hidden. Filter the list the table is built from.
- **A counter belongs to a list, not to a table (2026-09-19, fire #104).** The "Showing 1–20 of
  136" pager decorated a table once and then described that list for ever; every control that
  rebuilds the body without a full redraw — search boxes, chips — left it announcing a list that no
  longer existed, and un-paginated every hidden row on the way. If a control can replace the rows,
  the thing counting them has to be told.
- **Buckets should add up to the whole (2026-09-19, fire #104).** Making "Unaligned" mean "in none
  of the three alliances" turned four filters that overlapped-and-lost-rows into a partition:
  20+12+11+93 = 136. A set of filters whose totals do not reconcile with the unfiltered count is
  hiding something, and the reconciliation is the cheapest check there is.
- **A parser that cannot read a value should say nothing, never something (2026-09-19, fire #103).**
  The import's date reader turned `03/14/2026` into `2026-14-03` — month 14 — because it assumed
  dd/mm and never checked the calendar. A refusal is cheap: the row is held back, named, and the
  rest of the file lands. A wrong answer that still *looks* like a date reaches a real date column,
  and since one batch is one statement it takes the whole file down, while the app's own maths
  quietly reports quarter "Q5" on the way. When a reader is unsure, null beats a guess — the same
  rule the money side already follows (cost stays null rather than being filled in).
- **The same cell must not be read by two readers (2026-09-19, fire #103).** js/65 hardened its date
  reader on 2026-09-03; js/41's, which both import paths actually use, kept the old one. The money
  side had already solved this by delegating to one shared reader. Dates now do the same. Where two
  layers read the same file, one of them should be calling the other.
- **A mock that is kinder than the database is a probe that cannot see (2026-09-19, fire #102).**
  `mock-seed-live.mjs` stored every row handed to it, so a probe "proved" 3,000 invoices landing
  from three commits. The live database has `UNIQUE (invoice_no, line_no)` and commits with a plain
  INSERT in one call, so a clash lands nothing at all. A permissive mock invents failures that
  cannot happen and hides the one that does — one duplicate row costing the whole batch. When a
  probe finds something alarming in the harness, read the real constraint before believing it.
- **Two handlers on one node is a coin toss, not a fallback (2026-09-19, fire #102).** When a layer
  replaces a node to take over an interaction, anything that attaches from a timeout re-attaches to
  the new node afterwards. Both then run. If they disagree — and here one enforced the ledger's
  guards and the other did not — the visible answer is a race. A fallback has to check whether the
  thing in front of it is wired and stand down; being second is not the same as being a fallback.
- **A soft-deleted row is still in memory, and is not "there" (2026-09-19, fire #102).** `finLoad()`
  reads `finance_invoices` with no deleted filter on purpose, because the Ledger offers Restore. Any
  code that asks "do we already have this?" against `FIN.rows` must say which kind of row it means.
  Deleted is its own answer, and it has to be said out loud — never folded into "already there", and
  never quietly undone by an import.
- **A map from a label is a bug waiting for the next label (2026-09-19, fire #99).** The Clients
  health sort ranked four labels through an object literal; a fifth, 'Lost', was added to
  clientHealth() nine days earlier and nobody updated the map. The lookup gave `undefined`, which
  compares equal to everything, so the row landed anywhere — a silent wrong ORDER rather than a
  crash. Any label→number map needs a defined fallback, and the probe has to contain the label the
  map has never seen.
- **Sort by what is on the row (2026-09-19, fire #99).** The same table sorted by the stored English
  name while showing the Arabic one, so in Arabic the order matched nothing visible. If a column
  displays a derived or translated value, that is the value to sort by, compared with localeCompare
  in the language being read.
- **Sabotage is what tells you whether you wrote a check (2026-09-19, fire #98).** Two versions of
  one probe passed against the fix and could not fail without it — first because it typed into the
  wrong input, then because the harness's redraw path differs from the live one. Neither was
  visible from a green run. Run the sabotage before believing a new probe, and read WHICH checks
  flipped, not just how many.
- **Give a failing read time to fail (2026-09-19, fire #97).** supabase-js retries a 503 several
  times before reporting it, so a page that will say "could not load" says "loading…" for five to
  eight seconds first. A probe or a sweep that reads at three seconds records a defect that is not
  there. Wait on the error state itself, never on a stopwatch.
- **A measurement that disagrees with a screenshot loses (2026-09-19, fire #96).** A layout sweep
  reported Today's hero "cut off by 60px", the lists "past the right edge" and the sidebar's Finance
  and Settings "unreachable". The screenshots showed a clean page, tables that scroll inside their
  own box, and a sidebar that had correctly become a drawer. All three were the instrument. Look at
  the picture before changing anything on a number's word — and the defect that WAS real in that
  round was also found by looking.
- **A runtime-injected style beats index.html (2026-09-19, fire #96).** core-09 injects
  `.top{height:56px}` after the page's own stylesheet, so an ordinary `.top{...}` rule in index.html
  loses on order however sensible it looks. Win on specificity (`.top.top`) rather than assuming
  source order, and check the result on screen — the first version of that fix dropped a wrapped
  row through the divider onto the page.
- **A probe that asks the fix whether it is applied is not a probe (2026-09-18, fire #95).** The
  first version of the timezone probe waited for the new helper to exist, so reverting the fix made
  it time out instead of measuring anything — and reverting only the call sites, keeping the
  helper, would have left it green. Assert on what a person would see (the value in the date box,
  the row on the card), gated on that thing existing, so it fails for the right reason and catches
  a half-revert. Same family as the two rig faults found the same day, where checks passed on
  empty text.
- **A gate that reads for a WORD is satisfied by a comment about something else (2026-09-20, fire
  #129).** check-structure's overlay rule required every layer that builds its own full-screen box to
  "mention Escape" — the word, anywhere in the file. js/16 passed it on the strength of
  "Cancel/Escape" in a comment about js/57's pfPrompt twelve hundred lines above, while its own
  invoice box — the one with the Delete invoice button on it — ignored the key completely. Same
  shape as #127's command palette, where a comment claimed a trap the code never called. When a gate
  can only afford a crude test, make the crude test something a comment cannot satisfy — a real key
  comparison, a real call — and put the genuine exceptions in a judged list that gates BOTH ways.
- **A focus trap must read the box as it is NOW (2026-09-20, fire #129).** core-06's trap worked out
  the first and last control once, when it was applied. A box that fills itself in afterwards — the
  share panel lists its links when the database answers — then had a trap pinned to controls that
  were no longer its edges, and Shift-Tab off the real first control walked out of the box. Anything
  that captures the shape of a dialog at open time is wrong for every dialog that loads its contents.
- **No probe in the battery can see the database's own settings (2026-09-20, fire #131).** Every probe
  here drives the app; none of them can tell you that a table has row-level security switched off. Two
  leftover backup tables from 2026-09-09 held a full workspace snapshot readable by anyone with the
  publishable key that ships in the app's own page — no sign-in — and 250 green probes could not have
  said so. Supabase's own security advisor flagged both at ERROR level. Read `get_advisors(security)`
  during a sweep the way check-structure is read before a deploy; see DECISIONS M20.

---

## 7 · Key identifiers

| What | Value |
|---|---|
| Supabase project | `direct-business`, ref `vkxoeeoauexyfpzqufqd` (eu-central-1) |
| GitHub repo | `abdoulmagd911/Direct-Business` |
| Production branch (what Vercel actually serves) | `claude/new-session-9fhlp1` — see §4's deployment trap |
| Vercel project | `direct-business`, team `abdoulmagd911s-projects` |
| Live domains | `directksab2b.com` · `direct-business.vercel.app` |
| Core data tables | `businesses` (leads *and* clients — `is_client` flags which), `contacts`, `activities`, `requests`, `offers`, `finance_invoices`, `finance_transactions`, `client_profiles`, `master_db_companies`, `record_history`, `app_users`, `access_allowlist` |
| Reconciliation helper | `finance_reconciliation_gaps` (a database view; currently 0 rows — nothing outstanding as of the last check) |

---

*Add to this file the moment you find something new — same commit, not a follow-up.*
