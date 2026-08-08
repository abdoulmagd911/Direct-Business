# Page-by-page content audit (Backlog item 11d)

**Done:** 2026-08-08 · **By:** Claude session `content-audit-pages-f4lenf`
**How it was produced:** the real `index.html` was driven page by page in a headless
browser through `scripts/qa/`, in **English and Arabic**, signed in as the QA admin
(`test@directksa.com`). Every heading, table column, button, filter and helper sentence
on all **15 pages** was captured from the live screen (not guessed from the code) and
screenshotted. Raw capture: `scripts/qa/` output + the `audit/` extract.

## About the "new session" branch
There is nothing to reconcile there. The production branch is named
`claude/new-session-9fhlp1`, and on 2026-08-08 it, `main`, and this audit branch all point
to the **same commit** (`a3b9bd5`). So this audit is against exactly what is live on
`directksab2b.com` today.

---

## How to read this

Every item gets one of three calls. **Nothing here has been changed yet** — this is the
list for you to approve, because most of it is business wording that is your call, not mine.

| Badge | Means |
|---|---|
| ✅ **Keep** | Reads well, belongs here. No action. |
| ✏️ **Reword** | The thing belongs, but the words are unclear, jargony, or wrong. Suggested wording given. |
| 🗑️ **Remove** | Doesn't belong / is dead / is leftover build noise. |
| 🐞 **Broken** | Not a wording opinion — it is literally mangled text or a dead control. Safe to fix. |

I've only marked 🐞 **Broken** where the text is objectively wrong (typos a find-and-replace
created, columns that are empty on every row). Those I can fix on your say-so without needing
your judgement. Everything ✏️ **Reword** is a suggestion you can accept, change, or reject.

**The single biggest structural finding is at the bottom (§18): the app rewrites its own
button text after every screen draw, and that machinery is what produces most of the broken
wording.** Fixing that one thing fixes several pages at once.

---

# PART A — Things that appear on *every* page

These are worth deciding once, because a change fixes all 15 pages together.

## 1. The top bar

| Element | Call | Note |
|---|---|---|
| `Search everything` box | ✅ Keep | Clear. |
| `● Live · 27s` | ✏️ Reword | It means "last synced 27 seconds ago", but reads like a countdown. Suggest `● Synced 27s ago`. |
| `?` (help) | ✅ Keep | Opens the keyboard-shortcut sheet. |
| `⌘K` | ✅ Keep | Command palette. |
| `العربية` / `English` | ✅ Keep | Language toggle. |
| `Export ▾` | ✅ Keep | |
| `Share (view-only)` | ✏️ Reword | Fine, but say *what* is shared. Suggest `Share this view (read-only link)`. |
| `Sign out` · `Team` · `Access` | ✅ Keep | Three separate buttons; consider grouping under one menu later (not urgent). |

## 2. The left sidebar

| Element | Call | Note |
|---|---|---|
| Logo · `Direct Business` / `دايركت أعمال` | ✅ Keep | |
| `WORKSPACE` section label | ✅ Keep | |
| Nav items (Today … Settings) | ✅ Keep | Names are mostly good; per-page notes below. |
| `▸ FROM DIRECT (READ-ONLY)` | ✏️ Reword / restyle | It is a real collapsible group — Bookings, Invoices and Tickets live inside it — but it looks like a dead grey label, so people don't realise it opens. Give it an obvious "click to expand" look, and consider the plainer label `From the Direct system (view only)`. |
| User card (name · role) | ✅ Keep | |

## 3. The "Saved to cloud" toast (bottom-right)

- ✏️ **Reword / auto-hide.** It is correct, but it **lingers and sits on top of the page
  pager** — most visibly on Finance, where it covers "Showing 1–11 of 11". Make it fade
  after a couple of seconds so it stops covering buttons. (This is the same complaint noted
  in the backlog under item 12.)

## 4. The `?` next to every page title

Every page shows its name as a big heading with a small orange `?` beside it
(e.g. `Today ?`, `Leads ?`, `Clients ?`). That `?` is a **second** copy of the help button
already in the top bar.
- ✏️ **Reword / remove.** Drop the inline `?` next to page titles; keep the one in the top
  bar. It currently makes every heading read as a question ("Today?").

## 5. The `Has app` button (appears on 7 pages)

It shows up bare, with no label context, on Leads, Clients, Offer Builder, Airlines,
Providers & GDS, SOPs & SLAs and Operations. It is actually a **filter**: when you click it,
it turns blue and shows only companies that have a mobile app / app-store link / integration.
- ✏️ **Reword** to say what it does: `📱 Has app only` (or `Show only with app`).
- 🗑️ **Remove it from pages where it is meaningless:** SOPs & SLAs and Operations (procedures
  and internal requests don't have "an app"). It's being injected everywhere by one late
  script rather than only where it makes sense.

---

# PART B — Page by page

Legend as above. "Title" = the big heading on the page. "Sub" = the grey line under it.

## 6. Today

- **Title / Sub:** `Today` · *"What needs your attention right now — TTLs · overdue ·
  dunning · low-margin offers"*
  - ✏️ **Reword sub.** `TTLs` and `dunning` are trade jargon. Suggest:
    *"What needs your attention right now — ticket deadlines, overdue invoices, collections,
    thin-margin quotes."*
- **Greeting card** `Good evening, QA Test Account — Nothing urgent. Today is calm.` — ✅ Keep. Nice.
- **Two action cards** `Open my queue` / `Find a client` — ✅ Keep.
- **Middle card** `Today · Aug 8, 2026` — 🐞 **Broken (empty).** The card shows only the date
  with nothing beneath it. Either put the day's agenda in it or remove the empty card.
- **`Inbox-zero ✓ — nothing urgent…` card** — ✅ Keep.
- **Five stat tiles** `TTL ≤ 48H`, `Overdue inv.`, `In dunning`, `Low-margin offers`,
  `My queue (7d)` — ✏️ **Reword** the jargon ones: `TTL ≤ 48H → Ticket deadlines ≤ 48h`,
  `In dunning → In collections`.
- **`💰 Commercial Credit Pool`** (heading, also on Settings) — ❓ **Decision needed.**
  The backlog asks whether this feature is still wanted. If yes, keep; if not, remove from
  both Today and Settings.
- **`Backup destination: Your browser Downloads folder` + `Backup now to destination`**
  — ✏️ **Reword button** to just `Backup now` ("to destination" is redundant).
- **Bottom quick-actions** `New invoice / New booking / New offer / Search commands`
  — ✅ Keep. Good.

## 7. Leads

- **Title / Sub:** `Leads` · *"Funnels · one business · many contacts · assignable pipeline"*
  - ✏️ **Reword sub** — plainer: *"Companies that might book with us — grouped into funnels,
    each with its own contacts and owner."*
- **Top banner** `⚠ 43 worked leads with no owner …` — ✅ Keep. This is the real
  ownership gap (backlog item 7); the warning is doing its job.
- **Columns:** `Business · Stage · Funnel · Last activity · Next action · Owner ·
  Open in Direct`
  - `Open in Direct` — 🐞 **Broken / dead column.** It is a dash `-` on **every** row because
    no per-lead Direct link exists. **Remove the column** until it's wired (on Bookings/
    Invoices/Tickets the same idea *is* a working link — see §14–16).
  - Others — ✅ Keep.
- **Stage chips:** `All · New · Prospect · Contacted · Qualified · Proposal · Won · Lost`
  - 🐞 **Two chips mean one stage.** `New` and `Prospect` are both database stage `new`
    (this is backlog item 11b). In the live data `New` shows a count of 0 while `Prospect`
    holds them. Collapse to one chip. Same issue appears in Arabic (`جديد` vs `مرتقب`).
- **Redundant filters.** The page offers the *same* filter twice:
  - a **stage chip row** *and* an `All stages ▾` dropdown,
  - a **funnel chip row** (`All · 60` / `Default · 0`) *and* an `All funnels ▾` dropdown,
  - `⚠ Needs attention` as **both** a chip (`· 60`) and a separate toggle button.
  - ✏️ **Reword / consolidate:** pick one control per filter. Right now it's three rows of
    overlapping buttons and two dropdowns doing the jobs the chips already do.
- **Category chips** `All · Anchor · Convert · Re-engage · Dormant · Vendor · Partner`
  — ❓ **Decision needed:** confirm these categories are still used. `Anchor`, `Convert`,
  `Re-engage`, `Dormant` are internal labels most staff won't recognise without a tooltip.
- **`Table / Dashboard` toggle, `Export CSV`, `+ New business`, `✓ Hide closed`** — ✅ Keep.
- **`Owner` column shows `Unassigned` in red on every row** — ✅ Keep as-is (it's telling the
  truth — 0 leads have a real owner yet; backlog item 7).

## 8. Clients

- **Title / Sub:** `Clients` · *"Won accounts — your managed book of business"* — ✅ Keep.
- **Stat chips** `Total clients · Key accounts · Total won (SAR) · Reviews overdue` — ✅ Keep.
- **Columns:** `Client ▲ · Account manager · Area · Tier · Client since · Won (SAR) ·
  Channels · Next review · Open in Direct`
  - `Open in Direct` — 🐞 **Broken / dead column** (dash on every row). Remove until wired.
  - `Tier` — ✏️ optional: spell out A/B if that's what it holds, or tooltip it.
  - Others — ✅ Keep.
- **`← Leads pipeline` button** — ✅ Keep (nice cross-link).
- **`Has app`** — see §5.

## 9. Offer Builder

- **Nav label vs page heading mismatch.** The sidebar says **`Offer Builder`**, the page
  heading says **`Offers`**. ✏️ **Reword** — pick one name and use it in both places
  (recommend `Offers`, since that's what the list is).
- **Sub:** *"Turn request details into a Direct-branded quote for email / WhatsApp"* — ✅ Keep.
- **Drop zone** `Drop offer files — or click to add · Offer / quote PDF · multiple files OK`
  + `paste a link, Enter` — ✅ Keep.
- **Filters** `All · Draft · Sent · Won · Lost` — ✅ Keep.
- **Columns** `Ref · Status · Client · Subject · Airline · Total · Valid` — ✅ Keep.
- **`+ New offer`** — ✅ Keep. **`Has app`** — see §5 (belongs less here; consider removing).

## 10. Events

- **Title / Sub:** `Events` · *"KSA events radar — sales & partnership opportunities calendar"*
  — ✅ Keep (clear).
- **Columns** `Event · Vertical · Status · Dates · City · Venue · Opportunity · Pri · Notes`
  - `Pri` — ✏️ **Reword** to `Priority` (don't abbreviate to `Pri`).
  - `Vertical` — ✏️ optional: `Sector` is plainer for non-marketers.
  - Others — ✅ Keep.
- **Buttons** `+ Add event · Share view-only link · Edit · Del`
  - `Del` — ✏️ **Reword** to `Delete` (matches every other page).
- **Arabic:** this page does **not translate at all** — title, subtitle and every column stay
  English in Arabic mode. See §17.

## 11. Airlines

- **Title / Sub:** `Airlines` · *"Carrier accounts — sourcing, portals, ADMs & contacts"* — ✅ Keep.
- **Alliance filters** `All · Star Alliance · oneworld · SkyTeam · Unaligned` — ✅ Keep.
- **Columns** `# · Airline ▲ · IATA · Stock · KSA BSP · Authority · NDC · Void · Refund to`
  - `Stock` — ✏️ **Reword**. In Arabic this is translated as `رمز التذاكر` ("ticket stock
    code"), so in English it should read `Ticket stock` not just `Stock`.
  - `KSA BSP`, `NDC`, `Void`, `Refund to` — ✅ Keep (these are correct airline-desk terms
    your ticketing staff will know).
- **`+ New airline`** — ✅ Keep. **`Has app`** — see §5.

## 12. Providers & GDS

- **Nav label vs heading:** nav says `Providers & GDS`, page heading renders `Providers GDS`
  (the `&` is dropped). ✏️ **Reword** — restore `Providers & GDS` in the heading.
- **Sub:** *"Suppliers — sourcing, logins, ADMs, process & contacts"* — ✅ Keep.
- **`Provider verdicts` card** — *Keep: Travelfusion, Akbar, Babylon · Upgrade in progress:
  Kiwi, SkyScanner, Trip.com · Deprecated (phasing out): FR24 Flights, flynas24, Dnata*
  - ✏️ **Reword** `Deprecated (phasing out)` → `Being dropped` (plain English; "deprecated"
    is developer-speak).
  - Otherwise ✅ Keep — it's a genuinely useful at-a-glance verdict.
- **Filters** `All · Hotels · GDS · Aggregators · Other` — ✅ Keep.
- **Columns** `# · Provider ▲ · Type · API · Availability source · Portal · Contacts` — ✅ Keep.

## 13. SOPs & SLAs

- **Title / Sub:** `SOPs & SLAs` · *"Procedures and service-level standards"* — ✅ Keep.
- **Headings** `Desk procedures (Saudi base · elevated)` and `★ Extended procedures`
  — ✏️ **Reword** `(Saudi base · elevated)` — unclear. Suggest
  `Desk procedures (Saudi standard, raised to global level)`.
- **Sub-nav buttons** `SOP Library · Service Levels` — ✅ Keep.
- **`+ New SOP`** — ✅ Keep.
- **`Has app`** — 🗑️ **Remove here.** A procedures page has no "app" filter to offer.

## 14. Operations

- **Title / Sub:** `Operations` · *"Request intake → fulfilment → handover"* — ✅ Keep.
- **Page heading** `Projects board` — ✅ Keep.
- **Stat tiles** `Open requests · SLA overdue · Awaiting client · Pipeline value ·
  Booked margin · Delivered / closed` — ✅ Keep. Clear.
- **Kanban columns** `NEW · QUOTING · AWAITING CLIENT · BOOKED · TICKETED · DELIVERED ·
  CLOSED` — ✅ Keep. Good, clean board.
- **`+ New request`** — ✅ Keep. **`Has app`** — 🗑️ **Remove here** (internal requests, no app).

## 15. Reports

- **Title / Sub:** `Reports` · *"Objectives 2026 - achievements - KPI progress -
  report generator"* — ✅ Keep.
- **Tabs** `Overview · Achievements · Objectives & KPIs · Generate Report` — ✅ Keep.
- **Stat chips** `Achievements logged · This month · KPIs with data · Avg progress to
  2026 targets` — ✅ Keep.
- **Heading** `Objective progress avg of each objective's KPI progress` — 🐞 **Broken run-on.**
  A grey helper is glued onto the heading with no separator, so it reads as one garbled line.
  Fix to: **`Objective progress`** with a proper sub-line *"average of each objective's KPI
  progress."*
- **The 14 objectives themselves** — ✅ Keep, with **one ✏️ reword you should look at:**
  objective **#7** reads *"Explore new travel services "support services" and increase the
  number of embassies for visas business"* — the second half is unclear. This is your own
  wording, so I've left it; suggest tightening to something like *"…and grow the visa
  business by adding more embassy accounts."*
- **`＋ Log achievement`** — ✅ Keep.

## 16. Finance

- **Title / Sub:** `Finance` · *"Master invoice ledger · report builder · audited H1 2026 data"*
  — ✅ Keep.
- **Tabs** `Overview · Ledger · Report Builder · Import` — ✅ Keep.
- **Period line** *"Totals count verified-paid invoices only · wallet top-ups excluded from
  revenue by definition"* — ✏️ **Reword** — plainer: *"Totals count only paid, verified
  invoices. Wallet top-ups are not counted as revenue."*
- **Stat tiles** `Revenue · Cost · Profit · Received · Outstanding · Wallet (excluded) ·
  Invoices` — ✅ Keep. Clear and professional.
- **`Monthly revenue & profit` chart** — ✅ Keep.
- **`Top 10 clients by revenue` table** — 🐞 **Broken heading vs count.** The pager reads
  **"Showing 1–11 of 11"** — eleven rows under a "Top 10" heading (backlog item 12). Fix:
  either cap at 10, or rename to **`Top clients by revenue`**.
- **Columns** `Client · Inv · Revenue · Profit` — ✏️ `Inv` → `Invoices` (or `# inv`).
- **Arabic:** this page does **not translate at all** (see §17).

## 17–19 below cover the read-only "From Direct" pages, Arabic, and the root cause.

## 17. Bookings  *(inside the "From Direct — read-only" group)*

- **Title / Sub:** `Bookings` · *"Every fulfilment — tickets, hotels, visas, transfers ·
  linked to client, offer & invoice"* — ✅ Keep.
- **Read-only banner** `🔒 Live from the Direct system — read-only. Create, edit & billing
  happen in Direct.` + Arabic + `Open in Direct ↗` — ✅ Keep. **This is the good pattern** —
  it names the system that owns the data.
- **Contradiction to fix:** the empty state says *'No bookings yet — drop a confirmation or
  click "+ Booking"'* and a **`+ Booking`** button exists — on a page that just told the user
  it's **read-only**. 🐞 **Broken (mixed message).** Either drop the create affordance here,
  or change the banner. Recommend: remove `+ Booking` and the "click +Booking" text from a
  read-only page.
- **Columns** `Ref · PNR · Client · Airlines · Provider · Source · Tickets · TTL · QC · Sale ·
  Margin · Status · FOP · Date`
  - `TTL`, `QC`, `FOP` — ✏️ **Reword / tooltip** these abbreviations
    (`TTL → Ticket deadline`, `QC → Quality check`, `FOP → Payment method`).
- **Filters** `All · Today · This week · This month` + `▾ More metrics` — ✅ Keep.

## 18. Invoices  *(read-only group)*

- **Title / Sub:** `Invoices` · *"Billing — line items linked to bookings & tickets"* — ✅ Keep.
- **Read-only banner** + `Open in Direct ↗` — ✅ Keep.
- **Helper** `Live from Direct Payments` — ✅ Keep (names the right system).
- **Columns** `Invoice # · Type · Client · Subtotal · VAT · Total · ZATCA · Dunning ·
  Status · Date · Hijri`
  - `Dunning` — ✏️ **Reword** to `Collections`.
  - `ZATCA` — ✅ Keep (correct, everyone in KSA billing knows it).
- **Filters** `All · Unpaid · Paid · Overdue` + `+ Invoice` — same read-only contradiction as
  Bookings if `+ Invoice` creates here; confirm it only drafts-then-pushes.
- **`AR aging — AR aging buckets` heading** — 🐞 **Broken (doubled).** The words "AR aging"
  appear twice in one heading. Fix to `AR aging buckets` (or plain `Invoice age`).

## 19. Tickets  *(read-only group)*

- **Title / Sub:** `Tickets` · *"Ticket register — every PNR / e-ticket across all bookings"*
  — ✅ Keep.
- **Filter tabs:** `All · Push to sourced · Mark for void in sourceed · Request refund →
  Direct Paymented`
  - 🐞 **Broken — this is the clearest example of the root-cause bug (§20).** These three
    tabs are meant to be ticket **statuses**, and in **Arabic they render correctly** as
    `مُصدرة / مُلغاة / مستردة` = **Issued / Voided / Refunded**. In English a find-and-replace
    mangled them:
    - `Issued` → `Push to sourced`
    - `Voided` → `Mark for void in sourceed`   *(note the impossible "sourceed")*
    - `Refunded` → `Request refund → Direct Paymented`   *(note "Paymented")*
  - ✅ **Fix is known and safe:** the English tabs should read **`Issued · Voided · Refunded`**
    to match the Arabic. See §20 for why it broke and where.
- **Read-only banner** + `Open in Direct ↗` — ✅ Keep.
- **Stat tiles** `Tickets · Open · Used · Refunded · ADM-flagged` — ✅ Keep.
- **Columns** `Airline · PNR · e-ticket · Pax · Route · RBD · Coupons · Status · EMD ·
  Fare+tax · Provider · Booking · Flags` — ✅ Keep (correct ticketing terms).

---

# PART C — Arabic

You asked for Arabic to be covered. Here is the honest state (this expands backlog item 8).

**The nav and the primary chips are translated, but most of each page is not, and the whole
layout stays left-to-right.** For an Arabic-first Saudi company this is the weakest part of
the app right now.

### What *is* translated
- The **left-nav** items (اليوم، العملاء المحتملون، العملاء …).
- Each page's **grey subtitle**.
- The **primary stage chips** on Leads (الكل/جديد/مرتقب/تم التواصل/مؤهل/عرض مقدم/مكسوب/مفقود).
- **Tickets status tabs** — correctly `مُصدرة / مُلغاة / مستردة` (this is the proof for §20).
- Most **Settings** action buttons.

### What is **not** translated (stays English while in Arabic)
- **Every page's big heading** — `Today ?`, `Leads ?`, `Clients ?`, `Offers ?`, `Airlines ?`,
  `Bookings ?`, `Invoices ?`, `Tickets ?`, `Settings ?`. So an Arabic user sees the Arabic
  name in the top bar and the **English** name again as the heading right below it.
- **Two whole pages: Events and Finance** — title, subtitle, headings and columns all English.
- **Most table column headers** — e.g. on Clients: `Account manager · Tier · Client since ·
  Won (SAR) · Channels · Next review` all stay English; only `القسم` translates. Providers,
  Bookings, Invoices, Tickets are all half-and-half.
- **The secondary filter/action buttons on Leads** — `Table · Dashboard · By stage ·
  By category · By funnel · Export CSV · Needs attention · Hide closed · + New business ·
  Has app · Edit · Prev · Next` — all English.
- **The 4 KPI tiles** on Today/Clients/Reports — the labels stay English (`TTL ≤ 48h`,
  `Total clients`, `Key accounts` …).
- **The read-only banner headline** `Live from the Direct system — read-only.` stays English.

### Layout
- **The page never flips to right-to-left.** `applyLang()` hard-codes
  `document.documentElement.dir = 'ltr'`, so in Arabic the sidebar stays on the left and text
  stays left-aligned. **Your own brand guide says Arabic is always RTL**, so the app is
  off-brand here, not just inconsistent.

### Recommendation
Treat Arabic as one dedicated pass (it is item 8 in the backlog): (1) flip to RTL when
`LANG==='ar'`, (2) translate the page headings and column headers, (3) finish Events and
Finance. It touches a 1.2 MB file so it needs care, but it is the highest-value item for an
Arabic-first team after the broken-text fixes.

---

# PART D — §20. The one structural thing behind most of the broken wording

Most of the mangled English above is **not** typed wrong in the source — it is **rewritten
live by the app after every screen draw.** Two layers walk the page and find-and-replace
button text every time a page renders:

- `v21RelabelVerbs()` — swaps whole workflow phrases (e.g. any button containing `Issue`
  becomes `Push to source`).
- a second "plain-English" relabeler that swaps them *again* (e.g. `Request refund → Direct
  Payment` becomes `Ask Finance to refund`).

Because they match on **fragments** of words, they hit text they shouldn't:
`Issue**d**` → `Push to source` + leftover `d` = **`Push to sourced`**;
`Void**ed**` → `Mark for void in source` + `ed` = **`Mark for void in sourceed`**;
`Refund**ed**` → `Request refund → Direct Payment` + `ed` = **`Request refund → Direct
Paymented`**. The Arabic path skips these relabelers, which is exactly why Arabic shows the
correct `Issued / Voided / Refunded`.

**Why this matters beyond three tabs:** this is the same "layered find-and-replace scripts
fighting each other" pattern that `CLAUDE.md` warns about as the source of past dead ends.
As long as the app keeps rewriting its own text on every render, wording fixes won't stick —
a later pass will re-mangle them.

**Recommended fix (safe, one place):** make the relabelers match **whole words only** and
skip filter tabs, or better, retire the run-time relabelers and set each label correctly in
the source once. That single change un-breaks the Tickets tabs and prevents the next round of
mystery wording.

---

# PART E — Suggested order of work

Ranked by "cost to the team today" vs effort, per the house rules (fix what's actually
broken before what's theoretically untidy).

1. **Fix the self-rewriting text (§20)** — un-breaks the Tickets tabs and stops future
   re-breakage. Highest leverage, one place. *(Safe — I can do this on your OK.)*
2. **Remove the two dead `Open in Direct` columns** on Leads & Clients (dash on every row).
   *(Safe.)*
3. **Fix the small broken bits:** the doubled `AR aging` heading, the `Objective progress`
   run-on, the empty `Today · <date>` card, the `Top 10` that shows 11. *(Safe.)*
4. **De-jargon the labels you approve** from Parts A–B (`Has app`, `dunning`, `TTL`, `Del`,
   `Pri`, `Stock`, the read-only "+create" contradiction). *(Needs your yes/no per item.)*
5. **Consolidate the duplicated Leads filters** (chips + dropdowns doing the same job).
6. **Collapse the two chips that mean one stage** (`New`/`Prospect`) — backlog 11b.
7. **The Arabic pass (Part C / backlog 8)** — RTL + finish translation. Biggest job, biggest
   payoff for an Arabic-first team, best done on its own.

Items 1–3 are objective bug-fixes I can make immediately once you say go. Items 4–7 are your
wording and product calls — that's what this document is for.
