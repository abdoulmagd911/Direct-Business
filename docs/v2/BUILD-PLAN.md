# v2 build plan — phases P3 to P7

Status: **draft for the oversight's review**, 28 Sep 2026. P1 was the blueprint (`BLUEPRINT.md`), P2 is this
architecture (`TECH-SPEC.md`, "the spec" below). This file cuts P3–P7 into PR-sized steps for two builders (P7, the imports, comes after go-live):

- **Builder A — data, server, tests:** migrations, `api.*` functions and views, the SQL suite, imports, CI, cloud setup.
- **Builder B — screens:** the design system, the shell, every page, the E2E suite, wording catalogs.

English first; every step is Arabic-ready (every string in `messages/en.json`, the same key present in
`messages/ar.json`, logical CSS only — spec §2.5). Arabic is switched on only in P6-7, after it is tested.

## How the two builders work together

- **Branches.** `v2/main` is v2's integration branch (created 28 Sep — V12; v2 never merges into the default branch). Each step is a branch `v2/a-<step>` or
  `v2/b-<step>` and one draft PR into `v2/main` (a step marked "2 PRs" is split where it says). The oversight reviews
  every PR before merge; once a kind of change is approved, a green run of the same kind merges without asking again
  (P6).
- **Folders** (spec §2.1): A owns `v2/supabase/**`, `v2/src/server/**`, `v2/src/modules/*/data.ts`,
  `v2/src/modules/*/module.ts`, `v2/tests/db/**`, `.github/workflows/v2.yml`; B owns `v2/src/app/**`, `v2/src/ui/**`,
  `v2/src/modules/*/screens/**`, `v2/messages/**`, `v2/tests/e2e/**`. A shared file (`v2/src/core/**`,
  `v2/package.json`) changes only in a PR titled `[shared]`, reviewed by the other builder.
- **Handing over.** A's step lands first with its `api.*` functions, generated types and SQL tests; B builds the screen
  against it (a B step lists the A step it needs). Where B must start earlier, B works against A's open branch and
  rebases when it merges.
- **Numbers that must not collide:** migrations are timestamped; v2 decision IDs V100–V199 (A), V200–V299 (B),
  V1–V99 (architect/oversight) in `docs/v2/DECISIONS.md`; local test ports 9300–9399 (A), 9400–9499 (B).
- **Every PR** meets the spec's definition of done (§9.4): its tests pass and were each seen to fail under a named
  sabotage; the SQL and unit suites pass on a database built from zero; E2E passes for the areas touched; the checks
  pass; nothing real is in the diff (rule 7).
- **Links to tables built later** (for example `audit.request.batch_id → io.batch`, `work.task_kpi → perf.kpi`,
  `perf.period_target.written_in_report_id → report.report`) are added by the later step's migration with
  `alter table … add constraint` (spec §3.0), so every step's migrations apply on a database built from zero.
- **Nothing costs money** and nothing touches the old app, its database or its Vercel project.

## Design tokens and screens

Source: the owner's design system page (https://claude.ai/artifact/LhgpWwKiMxQtQiQmXjco64); table below as ruled by the
oversight on 28 Sep. P3-3 writes it into `src/ui/tokens.css` and a test checks the file against this table. It replaces
the old single `--drawer` token with the navigation set.

**Base (all themes).** Fonts: ui `"IBM Plex Sans", "IBM Plex Sans Arabic"`; display `"Readex Pro"`; data
`"IBM Plex Mono"`. Type xs 11.5 · sm 13 · base 14 · md 14 · lg 16 · xl 20 · 2xl 24 · 3xl 30 (px). Space 4 · 8 · 12 · 16
· 20 · 24 · 32 · 40. Radius sm 4 · md 6 · lg 10 · pill 999. **Density:** Comfortable by default (40 px controls,
44–52 px table rows, 24–32 px between sections); Compact per person (32 px rows, tables only).

| Token | Light | Dark | Colorful | Direct (official palette — V60) |
|---|---|---|---|---|
| bg | #F2F3EF | #161B1B | #EDF4F6 | #F6F7F9 |
| surface | #F9FAF7 | #1C2322 | #F7FBFC | #FAFBFC |
| raised | #FFFFFF | #242C2B | #FFFFFF | #FFFFFF |
| border | #DADDD5 | #33403E | #C9DDE3 | #E6E8EC |
| border-strong | #858F88 | #6B7A76 | #718F99 | #858E99 |
| text | #1A1F1C | #E4EAE7 | #0F2A33 | #303848 |
| muted | #566059 | #9AA7A3 | #46636D | #646D79 |
| link | #0B6B66 | #3FC1B4 | #C4314A | #B5490E |
| accent (marks, tabs, bars; a fill in Light/Dark/Colorful) | #0B6B66 | #3FC1B4 | #C4314A | #F06820 — never text, never under a label |
| accent-hover | #08524E | #66D3C8 | #A3243A | #FF6B00 |
| accent-soft (selected row) | #DDEDEA | #1D3836 | #FBE3E6 | #FFF3EC |
| on-accent | #FFFFFF | #0D2422 | #FFFFFF | — (no label on accent) |
| primary (filled buttons) | #0B6B66 | #3FC1B4 | #C4314A | #C94C14 |
| primary-hover | #08524E | #66D3C8 | #A3243A | #B5430F |
| on-primary | #FFFFFF | #0D2422 | #FFFFFF | #FFFFFF (4.64:1) |
| focus | #2B63D9 | #7FA8FF | #6A4FD8 | #2563EB |
| success | #1D7543 | #4CC38A | #17794A | #1F7A4D |
| warning | #8F5500 | #E6A94B | #935200 | #7D6200 |
| danger | #B42318 | #F27A6F | #B3261E | #C0233F |
| info | #1F5FAD | #6FAAF2 | #1D5FB8 | #2563B0 |
| success-soft | #E1F0E6 | #193328 | #DDF1E6 | #E2F2EA |
| warning-soft | #F6EAD6 | #3A2E17 | #FBEBD3 | #FBF3D6 |
| danger-soft | #F8E1DE | #3D2220 | #FADFDC | #FBE4E8 |
| info-soft | #E0EAF6 | #1B2C40 | #DDE9F8 | #E3ECF8 |
| nav-bg | #E8EAE5 | #121717 | #0F4C5C | #323E48 |
| nav-text | #2A302D | #C9D2CF | #E8F4F6 | #E6E8EC |
| nav-active | #FFFFFF | #242C2B | #1B6475 | #3E4B56 |
| nav-active-mark | — (accent) | — (accent) | — (accent) | #FF6B00 |
| c1 | #0B6B66 | #3FC1B4 | #C4314A | #F06820 |
| c2 | #C8741E | #F0A35E | #0E8A8C | #FBAE16 |
| c3 | #5552C9 | #A3A1F7 | #B8740A | #323E48 |
| c4 | #B8407A | #EC80B3 | #5B45C8 | #2563B0 |
| c5 | #3C8A3A | #86CF78 | #2A78D6 | #1F7A4D |
| c6 | #7A6A1E | #D9BC5C | #6E9A2E | #858E99 |

Shadows (`--shadow-1` / `--shadow-2`):

| Theme | shadow-1 | shadow-2 |
|---|---|---|
| Light | `0 1px 2px rgba(26,31,28,.06), 0 0 0 1px rgba(26,31,28,.04)` | `0 8px 24px -8px rgba(26,31,28,.18), 0 0 0 1px rgba(26,31,28,.05)` |
| Dark | `0 0 0 1px rgba(255,255,255,.04)` | `0 12px 28px -10px rgba(0,0,0,.55), 0 0 0 1px rgba(255,255,255,.06)` |
| Colorful | `0 1px 2px rgba(15,42,51,.07), 0 0 0 1px rgba(15,42,51,.04)` | `0 10px 26px -10px rgba(15,76,92,.30), 0 0 0 1px rgba(15,42,51,.05)` |
| Direct | `0 1px 2px rgba(48,56,72,.06), 0 0 0 1px rgba(48,56,72,.04)` | `0 10px 26px -10px rgba(48,56,72,.22), 0 0 0 1px rgba(48,56,72,.05)` |

Rules the lint and tests check: filled buttons use `primary` with `on-primary`; `accent` never colours text and never
sits under a label (text in that hue uses `link`); colour never carries meaning alone; no hex outside `tokens.css`.
The **logo** is the official file (slate wordmark on light, white wordmark on dark or slate), handed to builder B by the
owner and never recoloured.

**Screens.** The canvas https://claude.ai/artifact/QRysGjaefjvGbDxNvfYbLW ("Commercial App Screens", 18 artboards) is the
layout source; each B step builds to its artboard and attaches both side by side to its PR:

| Artboard | Step | Notes for the builder |
|---|---|---|
| 1 Sign-in · email, 1b Sign-in · code | P3-2 / P3-3 | the code is the door (V59): Work email → Send code; the 6 boxes, "Sent to … · Change", keep me signed in on this device, Verify, Resend with a countdown; only the logo, "Commercial Workspace" / "مساحة العمل التجارية", EN / ع and © Direct |
| 2 My day, 2b My day · Direct | P5-7 | "Since your last visit" counters (each a link) and Mark all seen; tasks and action items grouped Overdue / Today / This week / Helping, with saved view and filter chips; rail: my partners' activity, my KPIs' pace, my appraisal (private) |
| 3 Partner card, 3b Dark, 3c Colorful, 3d Direct | P3-9, P4-5 | list with logo or monogram, role chips, one status chip, owner, YTD; role filter chips; bulk bar (Owner · Role · Follow · Export); panel: Following with follower avatars, Change logo, roles, owner since; tabs Overview · Finance · Contracts & files · Work · Achievements; Overview: period switch MTD · QTD · YTD · Custom with Revenue / Cost / Profit against last year (V73) and Q1–Q4 bars, Open in Finance, the role's section (e.g. strategic partner · Integration), open tasks, activity with Undo |
| 3e Partner · Contracts & files | P3-9 | contracts (name, start, end, computed status, reminder switch, download); Terms before → after linked to achievements; files by type with the computed name and the original name under it; Renewal card with its task; activity |
| 4 Task detail | P5-2 | action items with helpers, timeline with meeting notes and @mentions, links, people (owner, helpers, followers), "Log achievement" |
| 5 KPI page | P5-6 | KPI list; tabs Overview · Achievements · Contributors · Plan history; the evidence trail KPI › achievement › partner › file › report |
| 6 Monthly report, 6b Quarterly report | P6-2 | one tab row Monthly · Quarterly; section outline; lines editor with live-name tokens; suggestions of unused achievements; Issue, PDF, PPTX, KPI sheet |
| 6c Reports archive · compare | P6-2 | the landing: reports grouped by year with status Draft / Issued / Legacy PDF, "Import legacy PDF"; select two → Compare side by side (tiles with the change, section rows, Differences only, Swap) |
| 7 Settings · My profile | P3-5 | My profile (Profile, Appearance, Notifications) first, then the groups |
| 7b Settings · Partners | P3-9 | Roles (Arabic name, the sections the card shows, active), File naming (pattern and live preview per kind), Contract reminders (60 · 30 · 7, expiring from 30, who is notified, renewal task), Logos and IDs (monogram or blank, ID format) |
| 8 Notifications | P3-7 | the notification centre over My day: tabs All · Mentions · Assigned to me; Today / Yesterday / Earlier; unread dot; Snooze on each; inline action (Open renewal task) |
| 9 Hover cards | P3-3 | partner (logo, roles, owner, status, YTD · open tasks · contract ends, New task, Log achievement, Follow) and person (job title · team, partners · open tasks · due this week, Assign task, Mention, View profile) |

The artboards contain demo placeholders and sample states (placeholder values in brackets, two steps shown at once, a
frozen edit state, sample counts that disagree, a canvas label) — **none of these is built**; the product shows real
data or an honest empty state (V11).

---

## P3 — Foundation

**Goal:** a person on the allow-list signs in with the emailed code (V59), sees the shell with the
drawer built from the registry, and an admin manages people, access and settings; partners exist with their
identifiers; every change is logged and can be undone.

| Step | Who | Needs | Scope | Acceptance (all must pass) |
|---|---|---|---|---|
| **P3-0** Skeleton and CI | A | this spec merged | `v2/main` already exists (created 28 Sep from the default branch — V12; never merge v2 into the default branch); `v2/` Next.js + TypeScript (strict) + pnpm; ESLint/Prettier; Vitest; Playwright config; `.github/workflows/v2.yml` (path-filtered to `v2/**`); the checks of spec §9.1 as stubs that already fail on a planted violation; builders add their rules to the existing `docs/v2/DECISIONS.md` in their ID ranges | CI green on the empty app; each check goes red on its planted violation (one-client, no-table-writes, no-physical-CSS, no-hex, rule-7 scanner, forward-only migrations) |
| **P3-1** Database foundation (2 PRs) | A | P3-0 | Schemas; default privileges revoked; `core.level`, Riyadh date helpers, numbering; `audit.request/change`, `audit.capture/begin/end`; `core.department/team/role/person/page/capability`, levels, overrides; `core.setting_def/setting/wording`; `core.person_profile`; the System and Import persons; `api.me()`; the SQL test runner (ported from `scripts/qa/phase3`: Supabase stubs, `as_user`, `raises`, per-test rollback) running on plain Postgres in the container **and** on the Supabase stack in CI; `supabase/grants.expected` | `GRANTS-*` (sabotage: grant execute to anon → red) · every table refuses direct writes with `permission denied` · `AUD-*`: only changed fields logged, no-op updates skipped, a write without a request is attributed to System, never a login · database builds from zero in CI |
| **P3-2** Cloud and sign-in | A | P3-1; the cloud half after 1 Oct, when the oversight has created `direct-commercial` (V21) | **The emailed code is the door (V59)**: email, 6-digit code, keep me signed in 30 days (app-enforced), the page copy of spec §4 and a check refusing the words "Direct KSA", "DirectKSA", "Direct Corporate", "B2B", "MICE" in the catalogs; sign-in first against the CI stack (needs nothing from the owner), then the cloud half: create the Vercel project `direct-commercial` (the Supabase project is created by the oversight on 1 Oct — spec §10), set the Auth site and redirect URLs to the `vercel.app` staging address; Auth: sign-ups off, email OTP (CI mail catcher; on staging Supabase's built-in sender reaches the owner; the Resend sender (V24) before any real user); the **Google** (`.com`) and **Zoom** (`.net`) providers only as later shortcuts, when their keys arrive (V23); `core.person_email`, `core.person_auth`, `core.sign_in_log` (spec §4); `@supabase/ssr` middleware; `(app)` layout gate calling `api.me()` before paint; server route that creates/bans auth users for the allow-list (service key server-side only); a plain sign-in page (B styles it in P3-3 to artboards 1 and 1b) | E2E (CI stack): an allowed email signs in with the code from the mail catcher; a listed-but-switched-off person is refused at once with the message; an unlisted email is refused; a signed-out deep link returns to the same address after sign-in; no content flashes before `me` is known; ticked "keep me signed in", the session ends 30 days after sign-in (test clock) and asks for a new code; unticked, it ends with the browser session · check: the forbidden words fail the build when planted in a catalog · check: one Supabase client · the Google and Zoom linking rules are tested in CI through identities made with the admin API (no real Google or Zoom); **on the cloud project they wait for their keys (V23)** — when the keys arrive, a real `.com` account signs in with Google and a real `.net` account with Zoom (recorded by the oversight): each lands on its one person, the Zoom email arrives verified and links to the pre-created user · a person with a `.com` and a `.net` email is one person whichever door they use · every attempt, allowed or refused, is in `core.sign_in_log` |
| **P3-3** Design system and shell (2 PRs) | B | P3-0 | `tokens.css` for Light/Dark/Colorful/**Direct** from the token table above (V60), with `data-density` (Comfortable default, Compact); `--primary` / `--on-primary` for filled buttons; the official logo (from the owner; never recoloured); `EntityLink`, `PartnerLogo` (logo or monogram), `HoverCard` (people, partners), `FollowButton`, `SavedViewsBar`, `BulkBar`, `ActivityTimeline`, `PersonChip` and `AvatarStack` (photo or initials in the chosen colour, nickname, badge; owner first, helpers after, three then "+n"); no banner/callout/hint component in the kit; self-hosted fonts; Tailwind v4 mapped to tokens; base components (Button, Input, Select, Dialog with its own form state, Confirm per D19, Toast with Undo, Chips with counts, DataTable virtualized with the row height from density (44–52 px Comfortable, 32 px Compact — V8), DetailPanel 480 px, DataState with its five states); drawer 248/56 (as the artboards) with pin preference; top bar (Ctrl K, Create, bell, profile with theme switch); `dir="rtl"` switch in development; i18n with next-intl; styled sign-in page | `UI-*`: every component in 4 themes × 2 densities at 400 px and 1,500 px, matching the design system page; `tokens.css` equals the page's values (test); `ui-no-hints` check refuses a banner or hint (sabotage); the Direct accent never colours text or sits under a label, and filled buttons use primary (lint) (screenshots reviewed); axe finds no serious issue; pseudo-Arabic RTL page has no physical-direction leak; Escape closes and returns focus (M93); Confirm has Cancel focused and names the item; lint refuses a hex colour and `ml-2` (sabotage) |
| **P3-4** Registry and access | A | P3-1 | `defineModule`, registry index, `pnpm registry:sync` (writes the page/capability/setting/role-default migration); `registry-in-sync` test; `authz.level/can/require/in_my_departments/reports_to`; rules: only an admin makes an admin, nobody changes their own access, a manager grants at most their own level; `api.access_*` | `ACC-base`: every rule above as allowed/refused pairs · a page added to a `module.ts` without syncing fails CI (sabotage) · levels of a switched-off person read as none |
| **P3-5** Settings framework and Organization & access | B | P3-2, P3-3, P3-4 | Generic setting forms from `setting_def` schemas (with reason and effective date); list-setting editor; **My profile first** (photo upload or initials with a colour, full name, display name, badge — none / icon / zodiac, theme of four, density, language, start page, drawer, notification choices), then People (add, their allowed emails, allow sign-in, switch off, manager, team, role; the sign-in log), Teams (retire with move-to), Roles, the access matrix (roles × pages/capabilities) and per-person overrides; Settings → Activity (change log, filters, Undo) | E2E: a team member edits their own profile (photo, nickname, badge, theme Direct, Compact) and sees it at once in the top bar, the drawer foot and their task chips, but cannot open another person's profile; admin adds a person → that person signs in; switching them off signs them out on next request; a manager trying to make an admin sees the refusal in words; a changed default level shows in the person's drawer after reload; every change appears in Activity and undoes |
| **P3-6** Undo, concurrency, notifications | A | P3-1 | `api.undo` (per field, all-or-nothing, redo, names who/when); `version` checks with field-level merge; `notify.notification` (with snooze), `notify.follow`, `core.person_last_seen`, `core.saved_view`, `api.notifications_*`, `audit.end` fan-out to owners and followers, the daily alerts job (`notify.generate_alerts`, one alert kind per later step), bulk commands as one request | `UNDO-*`, `CONC-*`, `NTF-*`; sabotage "undo writes the whole row" → `UNDO-02` red |
| **P3-7** Commands, toasts, conflicts, bell | B | P3-3, P3-6 | `command()` wiring: toast with Undo, global refetch, typed errors in words; the conflict dialog (theirs / mine per field); the **notification centre** (tabs All · Mentions · Assigned to me, by day, mark all read, snooze — artboard 8) with Realtime on own notifications; saved views and bulk actions wired to the list kit | E2E: two tabs edit different fields → both kept; same field → the second sees who changed it and chooses (FLOW-08) · Undo from the toast restores the screen · a refused command shows the level it needs |
| **P3-8** Partners data (2 PRs) | A | P3-4, P3-6 | `partner.*` (V52: partner, **multi-select roles with their own fields** (V62), **status history** with reasons and the last feedback date (V62), segment and priority (V64, V63), key partner flag, credit limit history (V70), discount-code terms and campaign codes (V65), sub-kinds, category, tier, contact, identifier with blocks and individual names, account-manager history, merge, **contract** with reminders); `core.file` with `original_name`, `core.file_kind` name patterns and `core.file_display_name` (live), `file_link`, storage buckets `files` and `images` (logos, avatars) and their policies, `api.file_*` (downloads carry the display name); `core.note` (with call and feedback kinds and call outcomes), mentions; `api.partner_log_call` and `api.partner_bulk_assign` (one request) (V63); `norm.*` with `rebuild()` and `drift()`; `api.search`, `api.hover_partner` / `api.hover_person`; the contract-expiring alert and its renewal task | `NORM-*`, `NORM-DRIFT`, `IDN-01…05`, `MRG-*` · `PRT-*` roles and the tabs they give · `PST-*` · `PROS-*` (the SQL half) · `CODE-*` terms and one-code-per-partner · `CTR-*` contract status at each boundary; the alert fires once per reminder day · `FILE-*` the name follows its pattern and changes when the partner is renamed; the download carries it · files: another person's pending path refused; a restricted file refused to a team member |
| **P3-9** Partners screens (2 PRs) | B | P3-5, P3-7, P3-8 | Partners list (logo or monogram, role chips and role filter, status / segment / priority / key partner chips, saved views, bulk bar with **Assign owner and priority**, export); **Log call** on the card, row and hover card; status with reason and its history; the partner card with **one tab row by role** — Overview (period switch MTD · QTD · YTD · Custom, tiles against last year, Q1–Q4 bars, the role's section, open tasks, activity), Contracts & files (artboard 3e), Work, Achievements (Finance arrives in P4-5); logo upload; Settings → Partners (artboard 7b); hover cards; Follow; Ctrl K finds partners by any identifier, Arabic spellings folded | E2E: create a partner with two roles and see the right tabs; a manager assigns 20 made-up prospects to AM1 with priority High in one action and one Undo reverts it; Log call "no answer" on a partner with no task shows on its timeline; set At risk without a reason is refused; add an Arabic name and find it by another spelling; a staff email refused with the reason; a contract ending in 30 days shows "Expires in 30 days" and its notification; renaming the partner renames its files; merge then Undo; export row count = list count (2,500 made-up rows) |

**P3 exit:** sign-in works on the cloud project; people, access, settings and partners are managed in the browser;
Undo works on every change; CI runs the full suite from zero with its sabotages.

---

## P4 — The money circuit (typed invoices)

**Goal:** the team can type every kind of Payments invoice quickly (owner decision 4); every invoice finds its partner
or asks for a decision; every money figure (partner card, Finance) comes from the ported rules and the finance finding
of 28 Sep (spec §3.6). Flows **FLOW-01** (up to the partner card and the finance measures), **FLOW-03**, **FLOW-04**
and **FLOW-09** pass in SQL and in the browser.

| Step | Who | Needs | Scope | Acceptance |
|---|---|---|---|---|
| **P4-1** Finance facts and `api.invoice_save` | A | P3-6, P3-8 | `finance.invoice` (kinds transaction, standalone, billing, credit note, wallet top-up), `invoice_line`, `billing_link`, `expense_line` (never on a billing invoice), `tax_invoice` (DPIN), `receipt`; `segment_id` override (V64), `receivable_flag` (Sent to legal, V70); `status_map`, `product`, `wallet_rule`, `commission_word`; match keys; `api.invoice_save` writing header, lines, expenses, links, DPIN and receipts in one request (`source 'manual'`), with version checks | `FIN-*`: every status word; Audit Required flagged; top-up detected from wallet lines; an expense on a billing invoice refused; a transaction linked to two billing invoices refused; one request = one undo restoring every part; no VAT column exists (check) |
| **P4-2** Money views, checks, Finance settings data | A | P4-1 | `finance.invoice_fact`, `invoice_cost` (approved, estimate ranking, **cost status Provisional/Final**), `money_row` (revenue units only), `money_service_row`, `credit_row`, `receivable`, `check`, `partner_month`, `health`; services, item maps, item classes, exclusion rules (exclude/hide); `finance.revenue_definition`; `money_row` with segment; `partner_credit`, `partner_wallet`, `sales_by_code` (V65, V70); every finance measure with the `segment` parameter; measures `finance.revenue`, `commercial_revenue`, `margin`, `collected`; the invoice-unpaid alert (`finance.unpaid_alert_days`) | `D24-*` (income by service equals the revenue tile); `E-*` (exclusions win, apply to past rows at once, `hide` hides everywhere but Rules); `EST-*` (estimate only without approved cost, never for a commission); `CHK-*` (billing total = sum of its transactions; DPIN = total − approved expenses within 1 SAR; DPIN = 100 % on non-commission → "expenses missing"; Provisional → Final when the DPIN arrives); `COL-*` (collections on billing and standalone invoices; ageing; Voided never outstanding) · FLOW-09 (SQL) · `SEG-*` · `PFN-*` · `CODE-*` sales by code adds up |
| **P4-3** Matching engine and credit | A | P4-2 | `finance.invoice_keys`, `partner.match` (order from the setting, first level decides, conflict lists all, a campaign code gives `campaign` — V65), pins, `api.match_queue` and the decision functions; the "add this clue to the partner" path used by the entry form; stress fixture generator; `PERF-MATCH` | `IDN-06…14` re-pointed at the live view · `CODE-*` a campaign code's invoices credited to nobody and listed apart · FLOW-01 (SQL, to the partner card and the finance measures), FLOW-03, FLOW-04 (SQL) · performance budget of spec §3.13 met on the stress fixture (or the cache pattern with its drift test, in its own PR) |
| **P4-4** New invoice — the fast entry screen (2 PRs) | B | P4-1, P4-2, P4-3 | Finance → New invoice (spec §7): kind, header, customer with the live match, lines grid with paste from Payments, expenses grid, billing: pick transactions, DPIN, receipts; the live side panel (revenue, cost, cost status, checks, credited person); Save and new, Duplicate, keyboard-first | E2E: FLOW-01 and FLOW-09 typed entirely in the browser; a 10-line invoice pasted from a made-up Payments block in one go; a typed invoice for an unknown customer adds the clue to the chosen partner and the next one matches by itself; timing: a practised person enters a 3-line transaction in under a minute (measured with the oversight) |
| **P4-5** Finance screens (2 PRs) | B | P4-2, P4-3 | every Finance filter in the URL and saved views, so **Open in Finance** from a partner card lands on the same figures; Overview (tiles, months, income by service, "what is held back", failing checks); Invoices (every kind; chips Provisional, checks failing, no partner) and the invoice detail; Collections; credit split dialog; Settings → Finance (services, products, item maps, item classes, exclusions, status words, revenue definition); the partner card's Finance tab and the period switch figures, with credit limit and outstanding against it, wallet balance and Sent to legal (V70); **Sales by code**; Overview by segment (V64); Partners → Needs a decision | E2E: FLOW-03 and FLOW-04 in the browser; `VIEW-*`: Open in Finance from a partner card shows the same YTD total as its tile; a failed read is never drawn as 0 (M27/M53); every Finance list exports its exact count |

**P4 exit:** flows 01 (money part), 03, 04 and 09 green in SQL and in the browser; performance budget met; the
team can type a month of made-up invoices on the staging project and the figures match a hand count.

---

## P5 — Work and performance

**Goal:** tasks are used daily; plans, KPIs and achievements make the circuit close. Flows **FLOW-02**, **FLOW-06**,
**FLOW-07** pass, and FLOW-01's My day step.

| Step | Who | Needs | Scope | Acceptance |
|---|---|---|---|---|
| **P5-1** Projects and tasks data | A | P3-8 | `work.*`; `api` for create, update, assign (capability), helpers, action items, meeting notes with assigned items, Direct references, links, close (open action items asked about); `work.task_view` (stale, overdue), `work.my_work`; recurring templates (one partner, or each key partner — the **Partner feedback** template, V72) and the `pg_cron` job; project segment override (V64); notifications (assigned, helper, mention); measures `work.tasks_on_time`, `action_items_on_time`, `weekly_updates`, `meeting_notes_on_time`, `pipeline_updates` (V63), `partner.calls` | `TSK-*`: a team member cannot assign to someone else; a helper can tick only their own items; my work = owned ∪ assigned ∪ helping; stale after N days using a test clock; recurring generation runs twice and creates one task; measures return "not measured" when nothing was due |
| **P5-2** Tasks screens (2 PRs) | B | P5-1, P3-7 | List / Board / Calendar; quick add; detail (action items, timeline with mentions, links, references with their URLs, files, helpers); close flow offering "Log the achievement"; Settings → Work (statuses, priorities, templates, recurrence, no-update days) | E2E: a task's whole life; @mention reaches the bell; stale flag appears after the setting's days (test clock); the board and the list count the same tasks |
| **P5-3** Projects screens | B | P5-1 | Projects list and detail (linked invoices and their money, tasks, achievements, files, timeline); partner card Work tab | E2E: link two invoices → project revenue equals their revenue; removing a link updates it |
| **P5-4** Plans, KPIs, achievements data (2 PRs) | A | P4-2, P5-1 | `perf.*`; `api.plan_copy`; KPI revisions and targets "as of"; categories, fields (incl. typed amounts and computed fields — V66), mappings with conditions and dates; the starting categories Problem solving, Cost savings, MoU / strategic signing (sets Prospect, never a new client) and Awards (entry cost); "use as example"; achievement API (fields validated against the category), `perf.achievement_line`; challenges with critical, escalated to and on (V69); period targets with their tasks; measures `perf.escalations`, `partner.at_risk`, `perf.achievements`, `perf.kpi_attainment`, `partner.new_clients`, `finance.new_client_revenue`; the KPI-behind-pace alert; `perf.kpi_*` views, `kpi_trace`, `kpi_sheet` | `KPI-*`: each source; sum/latest/average; cumulative pace and each status threshold; not measured ≠ 0; a target changed "effective 15 Sep" read as of 14 Sep returns the old one; a mapping condition keeps a promo-only partnership out of the integration KPI; money categories cannot feed money KPIs · FLOW-02, FLOW-06, FLOW-07 (SQL) · `ACH-*` · `CHL-*` |
| **P5-5** Plan & performance settings | B | P5-4, P3-5 | Plan editor: objectives, KPIs (revisions with effective dates), targets grid by month/quarter, leads and contributors, categories and their fields, mappings; copy a plan to next year | E2E: copy 2026 → 2027, rename and remove KPIs; 2026 screens unchanged |
| **P5-6** KPIs area (2 PRs) | B | P5-4, P5-5 | KPIs scorecard; KPI detail (by month and quarter, drill-down to achievements/invoices → partner → evidence, readings, status notes, history); Achievements (list, detail, create: category first, then its fields; typed amounts labelled "not revenue"; "use as example"); Challenges (critical, escalate to whom and when); KPI sheet export (template — V35); partner card Achievements tab and KPI contributions | E2E: FLOW-02, FLOW-06, FLOW-07 in the browser; the exported KPI sheet's figures equal the scorecard's; a Cost savings achievement with exposure 50,000 and actual loss 8,000 shows avoided 42,000 labelled "not revenue" and moves no Finance figure; an MoU achievement sets its partner to Prospect |
| **P5-7** My day | A + B | P4-3, P5-1, P5-4 | `api.my_day()` (my work, my partners' new invoices and balances, my KPIs and pace); the page, built to the canvas's MyDay artboard (Comfortable, nothing cramped) — the private "my appraisal" block is added in P6-4, once appraisals exist | E2E: FLOW-01's My day step for AM1; FLOW-03 moves the new invoice from AM1's My day to AM2's |

**P5 exit:** flows 01–04, 06, 07 and 08 green in the browser except their report and appraisal steps.

---

## P6 — Reports, appraisal, readiness

**Goal:** reports and appraisals close the circuit; every flow passes end to end, including Undo; the app is ready for
real data on the owner's word.

| Step | Who | Needs | Scope | Acceptance |
|---|---|---|---|---|
| **P6-1** Reports data | A | P5-4 | `report.*` with **live-name entity tokens** in lines and snapshots (V58), `legacy` reports holding their PDF (V57) and a compare function aligning two reports by section key; sections **Cases** and **Partners at risk / lost — top reasons**, lines with a non-money amount from a field, `report.search_doc` and `api.report_search` (V62, V67); templates and sections as settings; editors; lines citing achievements/invoices with the distinct-invoice amount; suggestions; issue (snapshot, hash, number); drift; correction and superseding; measure `report.on_time` | `RPT-*`: a snapshot never changes after issue (hash); drift lists exactly the changed figures; a correction gets `-C1` and supersedes; a line citing one invoice twice counts it once; renaming a partner after issue changes the rendered name, never a figure or the hash (FLOW-10, SQL); compare aligns sections by key and a legacy report compares by its tiles · FLOW-05 (SQL); report steps of FLOW-01/02 (SQL) · `SRCH-*` · the Cases section shows the flagged achievement with exposure, actual and avoided; a non-money line never adds to a revenue tile |
| **P6-2** Reports screens (2 PRs) | B | P6-1 | Reports landing = **the archive** with **Search** across issued reports (V67) (artboard 6c: grouped by year, Draft / Issued / Legacy PDF, Import legacy PDF, Compare side by side); Reports page with **one tab row, Monthly · Quarterly**; the quarterly report as the canvas's QuarterlyReport (cover, quarter vs same quarter last year, achievements by category with linked lines, KPI results — target, M1, M2, M3, quarter, YTD, status — challenges open/carried and resolved, next-quarter targets, operational-plan indicators Done / Carried over; Issue, PDF, PPTX, KPI sheet export); editor (sections in order, live content, lines editor, suggestions), preview, issue; issued view with drift and Correct; PDF and PPTX rendered from the snapshot (department templates — V34); Settings → report sections and editors | E2E: FLOW-05; the monthly report shows challenges carried over with their age and next-month targets done/carried; two renderings of the same snapshot are identical; FLOW-10 in the browser; a legacy PDF loaded with its period appears under its year and opens; two reports selected → Compare shows both with the change |
| **P6-3** Appraisal data (2 PRs) | A | P5-4, P6-1 | `appraisal.*`; scales, points tables, templates tree; cycle opening freezes the tree; the **self-registration** step and its flags (V68: undated or evidence-less achievements never count; cycle label default "2026-27"; ClickUp items without date or evidence only as legacy); measures behind "weekly pipeline / task updates" and "documenting and escalating critical client feedback"; per-person targets; scores; `appraisal.item_score` roll-up; lock; visibility policy; `appraisal.legacy`; the one-time import — by a person, through the importer — of the online appraisal tool's export **handed over by the owner** (rule 8; kept in Drive or the scratchpad, never committed — rule 7), which **seeds the templates** (weights 70/25/5, grade scale, points tables, items — the tool wins over the Excel form, gaps filled from the form; owner decision 2) and loads past appraisals as legacy | `APR-*`: the official form's maths reproduced from a hand-computed made-up example (both weight conventions, points table, rating, lower-is-better, cap); only the person, evaluator, reporting line and admins can read; lock freezes every value · the seeded templates equal the tool's weights, bands and items, checked item by item · appraisal steps of FLOW-01/02/03 (SQL) |
| **P6-4** Appraisal screens | B | P6-3 | Settings: templates, scales, points tables, cycles; **Self-registration — my achievements in this cycle** (complete them; "no date" / "no evidence" flags); the appraisal form (as the official sheet), team view, sign-off, summary and grade; My day's private "my appraisal" block | E2E: appraisal steps of FLOW-01, 02, 03; a team member cannot open a colleague's appraisal by its address; an achievement without evidence shows flagged on self-registration and adds nothing to the score |
| **P6-5** Readiness | A | all above | Full sabotage run; performance budget; Supabase security advisor clean; grants snapshot; v2 `golive_reset` (backup first, owner's word only — D9); nightly consistency job (`norm.drift`, any cache drift); the importer source for the owner-provided appraisal-tool export (spec §3.10, §11) | every sabotage caught; every flow FLOW-01…10 green end to end including its Undo; reset rehearsed on staging and reversed from its backup |
| **P6-6** Every page, every theme | B | all above | A walk of every page in Light/Dark/Colorful/Direct, Comfortable and Compact, at 400/1,500 px, beside its canvas artboard; empty/failed/no-access/not-measured states on each; keyboard only; export on every list | `UI-*` complete; no page shows hint text or a banner; every entity on every page is a link (`UI-entity-links`); `export-count` on every list |
| **P6-7** Arabic, when approved | B | P6-6; owner's Arabic wording (08 A1) | `ar.json` complete; RTL walk of every page; Gregorian dates and Western digits in Arabic (V40); Arabic PDF/PPTX check; switch `app.arabic_enabled` on only after the owner approves | every page in Arabic has no English leftovers and no direction leak |
| **P6-8** Go-live | A + B + owner | P6-5; owner's go | Go-live = the code and structure proven working (owner decision 4): reset staging to production state (backup first, owner's word — D9), people and plan typed in, appraisal templates seeded; then a **staged pilot** (V71): a small group named by the owner — Finance colleagues with View on Finance included — signs in first and types and checks a first month, and on the owner's word everyone is switched on; the team **types the 2026 invoices** in the browser, which tests every person and flow as it goes; the domain `directksab2b.com` moves from the old Vercel project to the new one, and the Supabase Auth site URL and redirect URLs switch to it (spec §10); the old app has been unavailable since 1 Oct (V21) | the owner's sign-off of the pilot, then of the full switch-on · `https://www.directksab2b.com` serves v2 and sign-in works through it |

---

## P7 — Imports (after go-live)

**Goal:** the Payments files and pages fill the same tables the team types into, in any order, never touching a
hand-entered row (D21). Started only when the owner says so (decision 4: "import stays a later phase").

| Step | Who | Needs | Scope | Acceptance |
|---|---|---|---|---|
| **P7-1** Import framework | A | P3-6 | `io.batch/chunk/held/held_ref`, `io.merge` (per-field export time, blank never wipes, older fills blanks, same file twice), batch undo; browser `core/import`: CSV 1 MB slices, Excel in a Web Worker (5,000-row posts), header recognition (BOM, spaces, `_ - . : ( ) /`, case), export time from the file name, dry-run preview, chunks ≤ 1,500 never splitting a group, resume | `IMP-*` on a made-up test source: any order gives the same result; newer wins per field; a blank never wipes; same SHA-256 → "already imported", nothing written; a chunk killed midway → re-drop finishes; undo refused while a later batch touched the rows · heartbeat test: a 250,000-row made-up CSV never blocks the page > 1.5 s |
| **P7-2** All-invoices import | A | P7-1 | `api.import_payments_invoices` with the exact column map (spec §3.11) into the same fact tables (`source 'import'`); billing links from `consolidated_proforma_id` where given, else the old subset-sum proposal for a person to tick; never touches a hand-entered row (D21) — differences listed, and a person may **adopt** a typed row so later imports keep it current (spec §3.6, V50) | ported phase3 D1/D21/D26 tests; the same file twice writes nothing; a newer file wins per field; a hand-entered invoice with the same reference is listed, not changed |
| **P7-3** Cost imports | A | P7-2 | into the existing `finance.expense_line` and the new `finance.payments_fact`; the three cost sources (Transaction Expense, Expense Invoice, Revenue Report — expense total only); held references; `invoice_cost` switches to approved lines | `COST-01…11` ported · approved-only, empty never 0, a cancelled line removes its cost, the same file twice writes nothing, a 258,000-row made-up export imports within the heartbeat budget |
| **P7-4** Corporate clients and promo codes | A | P7-1, P4-3 | `finance.payments_client` (29 columns), `finance.promo_code` (13); derived client ID from a unique contact email; clients → identifiers (one import request: added / taken / refused / unmatched / conflicts), promo codes as suggestions | `CP-01…07` ported · running the clients import twice adds nothing · a staff email in the clients file never becomes an identifier |
| **P7-5** Payments page reader | A + B | P7-2 | Reads the invoice view's JSON (`history.state.page`: expenses, child DPIN, `consolidated_proforma_id`, `b2b_transaction_status`; expense report filtered by `invoice_id`) captured in-page by a person, 10–25 rows a page, never the sync export (DP1, DP2) | a captured page fills the same facts as typing them; nothing is fetched in bulk |
| **P7-6** Imports screens | B | P7-1…P7-5 | Finance → Imports: drop zone, recognised files, preview, progress, batches, held rows, Undo import; the clients → identifiers result screen; promo-code linking on the partner card | E2E: drop the three cost files and the clients file in reverse order → the same totals as in order |

---

**Out of v1** (recorded, not planned — V70): guarantees (promissory notes), supplier payables and statements, referral
terms. Each becomes a step when the owner asks for it.

## Order at a glance

```
A: P3-0 → P3-1 → P3-4 → P3-6 → P3-8 → P4-1 → P4-2 → P4-3 → P5-1 → P5-4 → P6-1 → P6-3 → P6-5 → (go-live) → P7-1 → P7-2 → P7-3 → P7-4
          └─ P3-2 (local half at once; cloud half when the owner's approvals arrive) ─┘
B:        P3-3 ───────────→ P3-5 → P3-7 → P3-9 → P4-4 → P4-5 → P5-2 → P5-3 → P5-5 → P5-6 → P5-7 → P6-2 → P6-4 → P6-6 → P6-7 → (go-live) → P7-6
```

B starts with the design system while A lays the database; from P3-5 on, each B step follows the A step it needs.
