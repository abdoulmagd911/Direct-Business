# Phase 0 review — before the task manager is built (2026-09-25)

Review only. **No app code was changed.** Written for the owner and the oversight chat, in answer
to the brief of 2026-09-25 (sections 0–2). The binding decisions it measured against are D1–D6 in
`docs/DECISIONS.md`. The raw captures (screenshots, token dumps, decoded Drive snapshots) stay in
the session's scratchpad because some of them hold real client data (rule 7).

How it was measured: the two public websites were driven in a real browser (public pages only;
nothing signed in to, no form sent); the portal's inside and the Executive CRM were read **only**
from the owner's Drive folder "Direct Websites - Backend"; the app was read file by file and its
live database read with SELECT-only queries (policies, functions, counts). Nothing was written
anywhere except this file and `docs/DECISIONS.md`.

---

## 1 · What the brief said vs what is true

| The brief said | Measured |
|---|---|
| Only one writer on the branch after the hourly routine stops | ✅ The routine is paused (switched off, settings kept). Its last in-flight run landed at 09:23, an hour after the brief's "08:23"; nothing since. |
| directksa.com: DirectFont 100–800 from assets.directksa.com, open cross-site access | ✅ Confirmed, and it has full Arabic. **But** the font file itself says "All rights reserved" and flags embedding as restricted — the owner's licence check is a real gate. |
| directksa.com orange 500 = `#F86D0A`, corners 4/6/8, pill 2rem | ✅ Confirmed. (Its contact form uses a second orange, `#FF8000`.) |
| directksa.com toolkit: PrimeVue + Direct's own component library | ⚠️ Partly. The page is a Quasar app; PrimeVue sits inside the component bundle. The "library" holds four widgets only (site header, footer, services, one more) — no buttons, inputs or tables. |
| corporate.directksa.com: Inter + DirectFont, taupe `#5C4D42 → #FCF5F0` + orange `#FF8000`/`#FF6B00`, corners .35/.45/.75rem, PrimeVue (Nuxt) | ✅ All confirmed — with one thing the brief didn't say: **the portal's main colour is the taupe (`#AB9A8E`), not orange.** Orange appears only on its main call-to-action button and links. |
| The app today: Cairo / Inter, orange `#F47A1F` | ⚠️ Cairo yes (Google Fonts; Inter is never loaded). The app's orange is `#FF6B00` (110 uses); `#F47A1F` survives in 10 places. |
| `brand/tokens.css` is loaded by nothing | ❌ Out of date. The Generator layer (js/66) adds it to every page since the F1 fix. **But** its values only switch on inside `data-identity="…"`, which the app never sets — so in practice it styles the document previews only. P5's point still stands for the app itself. |
| View is enforced on 6 of 15 pages (`PAGES_VIEWER_ENFORCED` in js/52) | ❌ Overstated. The list names six. On screen, View actually holds on **four** (Today, Finance, Generator, Archive). In the database it holds fully on **none**. Details in §4. |
| Executive CRM has a "report for review" flow | ❌ That link is the footer of Manus (the platform the CRM was built on) for reporting abusive content. **The CRM has no review or approval step at all.** |
| Portal snapshots are of corporate.directksa.com | ⚠️ They are of the **admin** site (`corporate-admin.directksa.com`), English only. No client-side screens and no Arabic screens were saved. |

---

## 2 · Design (D4)

### What the two websites actually look like

| | directksa.com | corporate portal |
|---|---|---|
| Font | DirectFont (English and Arabic in one file) | Inter first, then DirectFont (Arabic falls to DirectFont) |
| Main colour | orange `#F86D0A` (hover `#D35D09`, pressed `#AE4C07`) | taupe `#AB9A8E` (hover `#968578`, pressed `#827164`) |
| Accent | — | orange `#FF6B00` on the main call-to-action |
| Text | warm grey-brown `#524B45`, muted `#786F67` | warm brown `#5C4D42`, muted `#827164` |
| Background / borders | white, borders `#F0E9E4` | cream `#FFFCFA`, borders `#EDE2DA` |
| Status colours | green `#019B4E`, red `#F34230`, blue `#0067FF` | teal `#006666`, red `#D90B0B`, blue `#007B8A`, purple `#5925DC` on pale washes |
| Corners | 6px (fields, cards), 12px dialogs, 2rem pill buttons | .45rem fields, .75rem cards, 1.25rem dialogs, pill buttons |
| Field height | 42px | 42px |
| Tables | none on public pages | header row cream `#FCF5F0` with brown text, row hover `#F2E8E1` |
| Filters | — | grey pills that turn orange when on; an "All / Active / Inactive" toggle with counts; **an orange dot when a filter is changed but not yet applied** |
| Pagination | — | current page `#F2E8E1` with `#6E5D51` text |
| Arabic | whole page mirrors right-to-left | inner area mirrors; outer page does not |

The app today: Cairo font, `#FF6B00` orange (the same as the portal's call-to-action),
background `#FBF5F0` (almost the portal's `#FCF5F0`), **cool slate text `#303848`** where both
sites use warm browns, corners mostly 8–12px. It is closer to the portal than to directksa.com
already — the biggest visible gaps are the **font** and the **text colour**.

### Can the app load Direct's component library instead of copying it? **No.**

1. **directksa.com refuses to serve it to another site.** Tested in a real browser: blocked, the
   widgets never appeared. (Checked again by hand: the file carries no cross-site permission, the
   font files do.)
2. **It is the wrong thing.** It holds the consumer site's header, footer and services widgets —
   no buttons, fields, tables, filters or dialogs, which is everything the app needs.
3. **It can change under us.** No licence, no version, cached for two minutes; ~1.3 MB with its
   own copy of Vue inside. A copy hosted on our side did run, but mis-drawn.

So P1's durable route here is not the library: it is **one design file of our own carrying the
measured values**, with a probe that fails if a page doesn't load it or drifts from it.

### A choice D4 needs made (one line)

"Follow both sites" has to say which wins where, because they disagree on the main colour.
**Recommendation:** the **portal** is the base (it is Direct's B2B product and already has the
tables, filters and pagination the app needs; the app is already close to it) — taupe surfaces,
warm-brown text, taupe for secondary controls, **orange `#FF6B00` for the one main action on a
screen**, portal status colours, **DirectFont for both languages** — and directksa.com only where
the portal has no example (e.g. pill-shaped hero controls). Printed documents keep Identity A.

### DirectFont

Renders in a browser from `assets.directksa.com` with cross-site access allowed, all eight
weights, full Arabic with proper joining. **Not yet shown inside the app** (no app change was
allowed in Phase 0) — that is the first check of Phase 1. Licence: the font says "All rights
reserved"; the owner's written OK (or the web team's) is needed before it goes live.

---

## 3 · The Executive CRM Dashboard (D5) — what it is and what to fix

A Manus-generated app, right-to-left, four tabs: **Dashboard · B2B · Tenders · Finance 26**.

- **Dashboard** — headline revenue (actual 2025, confirmed and expected 2026), cost, net profit,
  growth; filters by year and revenue type (Tenders / B2B / Academies commission / Provider
  incentive); tables by sector and entity; fixed checklists of what counts as "confirmed" and
  "potential" revenue.
- **B2B Updates 2026 / Tenders Updates 2026** — the same page twice. Add an entity (name only),
  quarter cards Q1–Q4, month tabs, a table (update text · value · cost · profit · attachments),
  and an "Add update" form with four hand-typed fields. Export to Excel.
- **Finance 26 – Project Management** — contract · type · status (Won / Applied only) ·
  receivable · total · cost · markup · received · remaining · collection date · attachments.

**What went wrong — each one a rule for our pages:**

| In the CRM | Our pages must |
|---|---|
| Profit and markup typed by hand; some rows don't add up | read money from Finance, never type it (D1, M1) |
| The same deal entered twice (Tenders and Finance 26) with different numbers | one record per deal, linked, never re-entered (M18, D6) |
| Clients are free-typed names, Arabic in one place and English in another | link to the company record, never a typed name |
| No owner, no history, delete is permanent | an owner account on every row, audit trail, archive not delete (M25) |
| One shared password, checked only in the browser; no roles | personal sign-ins and D2 levels, enforced by the database |
| Figures and ~30 entity names written into the code; a fixed header date | everything from the database; "as of" dates that are real |
| Totals ignore the filter; export's total row mislabelled | totals follow the filter and say so (M39, M89) |
| English-only pages next to Arabic-only pages, no switch | both languages everywhere (M91) |
| Attachments almost all empty | proofs optional (D3) — but visible when missing |
| Data lives only on the platform's servers | data lives in our database |

The owner's own earlier notes list the same ten problems (`Dashboard_Blueprint_v1.md`, 5 Aug).

---

## 4 · Every existing page against D2 (four levels) and D4 (design)

### How access works today

- Each person has a page grid in `app_users.page_access`: a page is **editor**, **viewer**, or
  missing (= no access). Admins sit outside the grid and see everything.
- **Every live entry is editor.** The 3 admins are outside the grid, the 1 manager has 10 pages,
  and all 7 employees have the same 4 pages (Today, Leads, Clients, Finance). Nobody is on View.
  → **Seeding D2 from today is simple and changes nobody's day:** editor → Full control,
  missing → No access.
- **An older, second gate still runs** (`allowed_pages`, js/15, every 2 seconds). It agrees with
  the grid today; it should go.
- **The screen fails open:** while the grid is still loading, "may this person edit?" answers
  yes (js/52:71). D2 must fail closed for changes.
- **Hiding a page is screen-only.** On most pages the database checks the person's role, not
  their page level. Events accept any signed-in writer. The shared `app_state` blob (airlines,
  suppliers, SOPs, settings, and copies of proposals and requests) is saved section by section
  on role alone.
- **"Own work" does not exist yet.** Owners are stored as names (`assigned_to`, `account_manager`,
  `created_by`), which the database cannot check. "Mine" works on screen (it matches names
  reliably), but nothing in the database knows who owns a row.

### Page by page

| Page | View holds on screen today? | …in the database? | Where it saves | Change needed for D2 | Size |
|---|---|---|---|---|---|
| Today | n/a (reads only) | n/a | — | levels only decide visibility | S |
| Leads | no | no (role) | `businesses`, `contacts`; activities inside the company row | View gate on every control; database check by page; **owner account column** for Own work; decide whether logging a call on someone else's lead is "their work" | L |
| Clients | no | no (role) | `businesses`, `client_profiles` | same as Leads — do together | L |
| Proposals | no | no (role) | `app_offers` + a copy in the blob | View gate; database check; owner column; stop the blob copy | M |
| Generator | **yes** | no (role) | `generated_documents`, registry tables | database check; owner = issuer for Own work | M |
| Operations | no | no (role) | `app_requests` + blob copy | as Proposals | M |
| Reports | no | **impossible today** | **each person's browser only** (M32) | export first (Phase 2), then replaced by the new Reports/Achievements pages | L |
| Finance | **yes** | mostly — 5 tables check role only | finance tables | bring the 5 tables in line; Own work = the recorder of an expense/booking | M |
| Settings | no | one row only | `app_settings`, the blob, backups table | View / Full only (no "own" settings); close the blob route | M |
| Events | no | **no — any signed-in writer** | `ksa_events` | database check; owner column | M |
| Airlines | no | no | the blob (136 of the 139 real rows) | **move to the real `airlines` table first**, then levels | L |
| Suppliers | no | no | the blob | move to the real `providers` table first | L |
| SOP & SLA | no | no | the blob | move to the real `sops` / `slas` tables first | L |
| Activity & Audit | no — its Undo ignores the grid | no | `record_history`, `undo_change` | Undo asks the level; View / Full only | S–M |
| Archive | **yes** | no (restore is a plain update) | `businesses` | database check on restore | S–M |

Projects, bookings, invoices, tickets and sync are not in the grid (admin-only) — they either join
the grid or stay admin-only; the owner decides when each is touched.

### Design work on every page

All pages share one set of classes in `index.html` (`.btn`, `.card`, `.chip`, `.tag`, `.field`,
`.inp`, `.modal`, `.tbl-wrap`), so **changing those classes reskins most of the app at once**. The
long tail is ~2,500 hard-coded colours and ~2,300 inline styles across the layers (heaviest:
core-06, index.html, js/16 Finance, js/10 Events, core-10 Reports). Those are moved to the design
file's names page by page, when each page gets its D2 work — not in one big rewrite.

### Reports — the data at risk

Everything on the Reports page lives in each person's browser under `directReportsData_v1`: a
list of achievements (date, member, title, description, objective, KPI, value, client) plus KPI
overrides. **An export function already exists (`rptExportJSON`) but no button calls it.** A
browser clean-up or a new laptop erases it for good. Each person must export from **every browser
they used**, because each browser holds its own copy.

---

## 5 · Order — as ruled by the owner, 2026-09-25

*(The review proposed the Reports export first; the owner moved it into Phase 3. His rulings are
recorded in `docs/DECISIONS.md` under D2, D4 and P4.)*

1. **1a — one access check.** Four levels; seeded editor → Full control; the screen fails closed
   while loading; the old js/15 gate retired; Team & Access shows four levels. Projects, Bookings,
   Invoices, Tickets and Sync join the grid in the same pass.
2. **1b — the database learns the levels, page by page,** including owner **accounts** instead of
   names on Leads and Clients; storage buckets, edge functions and triggers checked against D2;
   Airlines, Suppliers and SOP & SLA get View / Full control only and stay in the shared block.
   Proven by live attack tests as an employee and as the manager, each sabotage-verified.
3. **1c — the design file:** the corporate portal as the base, orange for the one main action,
   DirectFont for both languages — live only after the web/marketing team's written OK; fallback
   Inter plus a licensed Arabic face.
4. **Phase 3 — the new pages,** including the new Reports pages, which carry the export and the
   move of the old browser-held achievements as one job.

Every phase lands by pull request and is reviewed before it goes live.

## 6 · Risks, most serious first

1. **Reports data loss** — until the Phase 3 export, one browser clean-up erases real work. The owner accepted that timing.
2. **Tightening the database can lock people out.** Every rule change is tested as an employee and
   as the manager, not only as admin, and seeded so nobody's day changes (D2).
3. **Font licence.** DirectFont's own file restricts embedding; without a written OK, the fallback
   is Inter + a licensed Arabic face.
4. **The websites can change without notice.** A copied design drifts; the probe should compare
   against the saved values and flag it, not silently follow.
5. **"Own work" needs owners as accounts, not names** — an import that writes an unfamiliar name
   would drop a row out of its owner's reach (CLAUDE.md, "Ownership is free text").
6. **Blob pages** cannot be protected per record until moved to real tables.
7. **Two older rules name other owners:** P4 gives `docs/DECISIONS.md` to the finance/oversight
   pairing and `/brand/*` (including `tokens.css`) to the Proposal & Documents task. The brief makes
   this session the only executor; D1–D6 were recorded on that basis. P4 should be marked
   superseded by the owner's word, so the design file can live under `/brand/` without a turf rule
   in the way.

## 7 · Not verified

- DirectFont drawn **inside the app** (Phase 1's first check).
- Anything behind the corporate portal's sign-in beyond the admin snapshots: no client-side
  screens, no Arabic screens, no dialogs or toasts seen open; table/pagination styles come from its
  style settings, not from a drawn table.
- Hover and pressed colours of directksa.com's orange button (from its settings, not observed).
- The database side of each page was read from its policies and functions, not attacked live; the
  screen side from the code and earlier measured rounds (M42, M47), not re-driven today.
- Whether Today has no editing controls anywhere (believed, not proven).
- Storage buckets, edge functions and triggers were not reviewed for D2.
