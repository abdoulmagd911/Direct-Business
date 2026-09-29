# v2 Commercial app — technical specification

Written on 28 Sep 2026 by the architect session from the owner-approved
blueprint (`BLUEPRINT.md`, v0.7), the old app's rules (`docs/DECISIONS.md`, `docs/LANDMINES.md`), the second builder's
handover (`docs/REBUILD-HANDOVER-2.md` on `claude/clever-franklin-vukl22`) and the code on the production branch. The main
builder's handover was never written (V48); that builder's work was read from the production branch's code.

Kept in step with `DECISIONS.md` (V1 to the current decision): where the two differ, the decision wins and this file is
fixed in the next docs PR. Who reads what: builders A and B build from this file; `BUILD-PLAN.md` says in which order; `OPEN-QUESTIONS.md` holds
what the owner still has to decide, each with a recommended answer that this spec assumes until he answers.

Words used here: **must** = required; **should** = the default unless a written reason says otherwise. "§n" points to
the blueprint's sections. Old-app rules are cited by their IDs (D21, M1 …) — they stay binding where this spec ports them.

**Rule 7 holds here too.** This repository is public. No real company, client, person-contact, amount, invoice number or
VAT number is ever committed — not in fixtures, tests, seeds, docs or comments. Tests use made-up values (`Test Co A`,
`INV-T-0001`, `a@test.example`, the dummy VAT the Payments system itself uses for testing may be named only by shape).

---

## 0. Architecture rules — the old app's root causes, and what replaces them

The old app worked, but most of its cost went into the same few failures. Each rule below exists because of one of
them, and each is enforced by something that runs, not by good intentions (P5).

| # | Old root cause (evidence) | v2 rule | Enforced by |
|---|---|---|---|
| A1 | One shared JSON row (`app_state`) used as the database; last writer wins | Every fact is a row in a typed table with a key. No blobs of business data. JSON only for per-category custom fields, validated on write | Schema review; `check-no-blob-tables` |
| A2 | 120 script layers patching each other and `render()` | Modules own their pages. A change is an edit to the owner file, never a wrapper. No global mutable state, no timers that poll app state | Folder ownership + lint (`no-restricted-globals`, no `setInterval` outside `core/`) |
| A3 | A page needed 3–5 registrations (JS list, `access_pages()`, sidebar, admin function, defaults) | **One registry** (TypeScript) generates navigation, the access matrix, Ctrl K, the Create menu, search providers, and the database's page list | `registry-in-sync` test (TS registry = `core.page` rows) |
| A4 | Five Supabase clients fought over refresh tokens and signed people out | One browser client (singleton in `core/db`), one server client per request | Lint: `createClient` only inside `src/core/db/` |
| A5 | Screens drawn before the app knew who you were; boot races; polling for the role | The server checks the session and loads `me` (person, levels, preferences) **before** the first paint of any app page | E2E: deep link while signed out → sign-in → lands on the deep link; no flash of content |
| A6 | A refused write returned 200 and 0 rows; screens said "Saved" (CP1, M13) | Tables are **not writable** by signed-in users. Every write is one `api.*` function that either returns the written row's id and version or raises a named error. A refusal is always an error | SQL test: every table refuses direct INSERT/UPDATE/DELETE with `permission denied`; client lint: no `.insert/.update/.delete/.upsert` on tables |
| A7 | PostgREST's 1,000-row cap silently truncated totals | Totals are computed **in the database** (views/functions), never by summing a fetched list. Lists and exports page through `fetchAll()` | Unit test of `fetchAll` against a capped stand-in; E2E export of 2,500 rows |
| A8 | Grants reset by function re-creation; new functions executable by `anon` by default | `alter default privileges … revoke execute … from public`; every function's grants are declared in its migration; a **grants snapshot** test compares every function and table grant with `supabase/grants.expected` | SQL test `GRANTS-*` |
| A9 | Schema and server code patched in place, some never in the repo; functions edited by string replace | Forward-only, timestamped migrations in `v2/supabase/migrations/`. CI builds the database **from zero** on every PR. No `pg_get_functiondef` + replace, ever | CI job `db-from-zero`; lint on migrations |
| A10 | Several copies of one rule (name folding written three times: SQL, preview JS, mock) | Each rule has one home. Name/identifier folding, money, periods and scoring live **in SQL**; the browser asks the database (previews run the real function in dry-run mode) | Review + `one-copy` grep check for folding tables in TS |
| A11 | Owners stored as free-text names | People are referenced by id everywhere; a name is only a label | FK constraints |
| A12 | Screen and database enforcement drifted apart | The database decides; the screen reads the same `api.me()` levels and only hides what the database would refuse anyway | Access attack suite runs every command as every role |
| A13 | Business numbers kept only in one browser (M32) | Nothing but UI preferences (theme, pinned drawer, last filter) lives in the browser | Lint: `localStorage` only via `core/prefs` with an allow-list of keys |
| A14 | No row versioning — the later save silently replaced the earlier (LANDMINES B1, M77) | Every editable row has a `version`. A save sends the version it read; if someone else changed **the same field** since, the save is refused with who/when and a merge dialog; changes to other fields merge silently | SQL test `CONC-*`, E2E two-tab test |
| A15 | A hand-written 2,300-line mock drifted from the real database; ~100 fixed waits; probes that could not fail | Tests run against the **real schema** (plain Postgres or local Supabase), never a mock of it. Web-first waits only. Every test file lists its sabotage and CI runs them | `sabotage` CI job |
| A16 | Undo overwrote the whole row, silently reverting later edits to other fields | Undo is per request and per field, and refuses when a later change touched the same field (names who and when) | SQL test `UNDO-*` |
| A17 | Generated columns and expression indexes silently stale after their function changed; `create or replace view` can only append columns | Stored normalized keys carry `norm_version`; any migration that changes a `norm.*` function must call `norm.rebuild()`; views are dropped and re-created in the migration that changes them (dependents re-created too) | CI check `norm-rebuild-called`; SQL test `NORM-DRIFT` |
| A18 | Two builders collided on decision numbers and file numbers | Migrations are timestamped (no numbers to collide). v2 decision IDs: architect/oversight V1–V99, builder A V100–V199, builder B V200–V299, builder C V300–V399, owner decisions V400–V499 (V410; the QA session records none). Test ports: A 9300–9399, B 9400–9499, C 9500–9599, the QA session 9600–9699 | `check-v2-ids` |
| A19 | Screens full of explanations, notes and warnings (the owner's biggest complaint about the old app) | Screens carry data and controls only; every entity is a link (§2.5) | UI kit without banner/callout/hint components; `ui-no-hints` check; `UI-entity-links` walk |
| A20 | Names typed into records went stale when a person or partner was renamed | Every person and partner reference is an ID rendered with the current name — frozen reports keep entity tokens (V58) | FLOW-10; a check that no table stores a person or partner name as text outside the person and partner tables |

Standing product rules that shape every section below: nothing stores a copy of a figure (§1a) — the only stored
figures are **frozen snapshots** (issued reports, locked appraisals) and they say so; nothing is hard-deleted by the app;
every change is logged and undoable (§0); every remove asks first in the app's own box, naming the item, Cancel focused
(D19); dates are Riyadh's calendar (D20); money is never typed where Finance has it (D1, §10); VAT amounts are never
stored or shown (M1); a failed read is never drawn as an empty result (M27); "not measured" is never 0 (M60).

---

## 1. Stack (a)

The oversight's suggestion is confirmed, with the guardrails that make it safe for this app.

| Layer | Choice | Why | Rejected, and why |
|---|---|---|---|
| Framework | **Next.js (App Router) + React + TypeScript (strict)**, pinned at P3 start | Server-side session gate before first paint (A5); route handlers for the OAuth callback and the few server-only admin actions; per-record URLs; Vercel-native | Vite SPA: would need Edge Functions for admin actions and a client-side auth gate (the old boot race); Remix: fewer builders know it |
| How Next.js is used | Server components **only** for the shell and the auth gate. All record data is fetched in the browser through one data layer (TanStack Query + the Supabase client with the person's session). `dynamic = 'force-dynamic'` on app routes; no Next data cache for app data | One data path and one invalidation rule ("after any write, refetch what is on screen") make "a change shows everywhere at once" true by construction. Mixing server-cached and client-cached data is how stale screens happen | Server actions for data: two caches to keep coherent |
| Database | **Supabase Postgres 17** (same major as today), RLS on every table, versioned migrations with the Supabase CLI | Proven here; RLS keeps the database the judge (A12) | — |
| API surface | PostgREST exposes **one schema, `api`**: read views (`security_invoker = on`) and write functions. Business tables live in private schemas (`core`, `partner`, `finance`, …) | A6, A8: a single, testable door | Exposing tables directly (the old app's silent-refusal problem) |
| Auth | Supabase Auth: **the emailed 6-digit code is the door** (a device stays signed in until sign-out; 30 idle days → a new code — V74); Google (`.com`) and Zoom (`.net`) OAuth as later shortcuts; **no password provider**; sign-ups off; allow-list of emails per person (`core.person_email`) | §0 sign-in decision | Passwords (owner ruled out); email-only (impersonation, §10) |
| Files | Supabase Storage, one private bucket `files`, signed URLs of 600 s (M21) | Proven | Public buckets |
| Jobs | `pg_cron` (in Supabase free) for the two scheduled things: recurring tasks at 00:05 Riyadh, and nightly consistency checks | No extra service, no cost | Vercel cron (Hobby: once a day, no retries) |
| Styling | **Tailwind CSS v4** driven by CSS variables (design tokens), switched by a `data-theme` attribute on `<html>` (light, dark, colorful or direct) and a `data-density` attribute (comfortable or compact); components from **shadcn/ui** (Radix primitives, copied into the repo) | Tokens → four themes from one set (§0 design, V60); Radix gives focus, Escape and ARIA right (M93) | CSS-in-JS: runtime cost, harder RTL |
| Tables | TanStack Table + TanStack Virtual (44–52 px rows comfortable, 32 px compact; sticky header; virtualized) | Dense tables with thousands of rows stay smooth | Heavy data-grid libraries |
| Forms | react-hook-form + zod; **each dialog creates its own form instance** and drops it on close (§0) | The old app's shared form state leaked between dialogs | Global form stores |
| Other UI | cmdk (Ctrl K), sonner (toasts with Undo), lucide icons, Recharts (tiles/sparklines only) | Small, maintained | — |
| i18n | next-intl, message catalogs `messages/en.json` and `messages/ar.json`; `dir="rtl"` from day one; Arabic hidden behind a setting until tested (§0); `ar.json` is builder C's — a key with no Arabic yet shows its English until P6-7 (V410) | Arabic-ready without shipping untested Arabic | Hand-rolled dictionaries (the old js/21) |
| Dates | date-fns + `@date-fns/tz`, zone `Asia/Riyadh`; `Intl` formats always with `calendar: 'gregory'` and `numberingSystem: 'latn'` | **`ar-SA` defaults to the Islamic calendar** — Gregorian must be forced explicitly (§0 "never Hijri") | Moment |
| Files in/out | Import: SheetJS CE 0.20.x inside a Web Worker — the official tarball **vendored** under `v2/vendor/` with its published checksum (the npm `xlsx` package is stuck at 0.18.5 without later security fixes, and `cdn.sheetjs.com` is refused by the builders' network policy, measured 28 Sep; a one-off GitHub Actions job fetches it and opens the PR); a streaming CSV reader (ported from js/121). Export: ExcelJS (styled KPI sheet), CSV with BOM | Ported and proven on the 258k-row file | Reading big XLSX on the main thread (old backlog item) |
| Documents | PDF: `@react-pdf/renderer` from the frozen snapshot for English — its Arabic letter-joining and right-to-left support are weak, so an **Arabic PDF and PPTX spike runs early, in P3** (plan P3-10, V86) and the choice it records stands — the fallback is the browser's print-to-PDF of the report page; PPTX: the department's own template (V34) **filled** by editing its XML (JSZip: placeholders replaced, repeating slides duplicated) — pptxgenjs cannot open an existing file, so it is used only for slides the template lacks; fonts embedded (Readex Pro, IBM Plex Sans/Arabic/Mono — all SIL OFL, self-hosted with `next/font`) | Deterministic re-rendering of a frozen report; no font CDN (the old DirectFont trouble) | Server-side headless Chrome (too heavy for Vercel Hobby) |
| Tests | Vitest (unit), a SQL test runner (ported from `scripts/qa/phase3`), Playwright (E2E, against the real local Supabase stack) | See §9 | A mock of Supabase (A15) |
| Hosting | **Vercel** (new project) + **Supabase** (new project), both on free plans for the build (§10) | Owner: nothing that costs money | — |
| CI | GitHub Actions (free for public repositories) | The repo is public (owner's ruling) | — |
| Package manager | pnpm, Node 22 | Already in the builders' containers | — |

---

## 2. Code and module structure (b)

### 2.1 Where v2 lives

- **Same repository, folder `v2/`** (V47). The old app stays untouched at the root. v2's integration branch is
  **`v2/main`** (created from the default branch on 28 Sep — V12; v2 never merges into the default branch); feature PRs go into `v2/main`; the new Vercel project builds `v2/` only and its
  production branch is `v2/main`. Nothing in `v2/` imports anything from the old app.
- The old app's checks (`scripts/qa/*`, `check-structure`) do not scan `v2/`. v2 has its own checks under `v2/scripts/`.
- **Ownership by folder** (P4, the handover's lesson; V410): builder A owns `v2/supabase/**` (except `tests/qa/`),
  `v2/src/server/**`, `v2/src/modules/*/data.ts`, `v2/src/modules/*/module.ts`, `v2/tests/db/**`; builder B owns
  `v2/src/app/**`, `v2/src/ui/**` (except `grid/`), `v2/src/modules/*/screens/**`, `v2/messages/en.json`,
  `v2/tests/e2e/**` (except `arabic/`, `export/` and `grid/`); **builder C** owns `v2/messages/ar.json`,
  `v2/src/core/export/**` (list exports), `v2/src/core/print/**` (PDF and PPTX), `v2/src/ui/grid/**` (the Past work
  grid), `v2/tests/e2e/arabic/**`, `v2/tests/e2e/export/**`, `v2/tests/e2e/grid/**`, `v2/tests/unit/export/**` and
  `v2/tests/unit/grid/**`; **the QA session** owns `docs/v2/QA-LOG.md` and `v2/supabase/tests/qa/**`. Shared files
  (`v2/package.json`, the rest of `v2/src/core/**`) change only in a PR that says so in its title, and the other
  builder reviews it. A screen mounts builder C's components (`PastWorkGrid`, `ExportButton`, the report export
  actions) by import, never by copying them. **No two sessions touch the same files.**

### 2.2 Folder tree

```
v2/
  package.json  pnpm-lock.yaml  next.config.ts  tsconfig.json  eslint.config.mjs
  messages/en.json  messages/ar.json            # wording catalogs (keys, never sentences in code)
  public/fonts/                                  # self-hosted OFL fonts
  src/
    app/                                         # Next.js routes (thin: layout + one screen component each)
      (auth)/sign-in/page.tsx  auth/callback/route.ts
      (app)/layout.tsx                           # server gate: session + api.me() before first paint
      (app)/my-day/  overview/  partners/[[...id]]/  pipeline/[[...id]]/  finance/[[...tab]]/  projects/[[...id]]/  tasks/[[...id]]/
      (app)/kpis/[[...id]]/  reports/[[...id]]/  appraisal/[[...id]]/  settings/[group]/  r/[entity]/[id]/
    core/
      db/        client.ts (singleton) server.ts fetchAll.ts command.ts (calls api.*, maps errors)
      auth/      session, me-context, sign-out
      access/    levels, useCan(page, level), <Gate>
      registry/  defineModule.ts, index.ts (imports every module.ts)
      i18n/ format/ (money, dates, numbers, Riyadh time) periods/ export/ import/ prefs/ errors/
    ui/          design tokens (tokens.css), shell (drawer, top bar), DataTable, DetailPanel, Chips, Dialog,
                 Confirm (D19), Toast (with Undo), DataState (loading/failed/empty/no access/not measured)
    modules/
      org/ settings/ partners/ pipeline/ (tenders, partnerships) overview/ finance/ projects/ tasks/
      perf/ (plans, KPIs, achievements, challenges) reports/ appraisal/ my-day/ search/
        module.ts          # the module's registry entry (pages, capabilities, entities, settings, exports, …)
        data.ts            # typed calls to api.* views and functions for this module
        screens/           # the module's screens and components
  supabase/
    config.toml
    migrations/            # YYYYMMDDHHMMSS_<module>_<what>.sql, forward-only
    grants.expected        # the grants snapshot (A8)
    tests/                 # SQL tests: <module>/<ID>.sql ; sabotage/<name>.sql
    fixtures/              # made-up trial data (rule 7)
  scripts/                 # registry-sync, check-*, stress-data generator, sabotage runner
  tests/
    unit/                  # Vitest
    e2e/                   # Playwright specs, one promise per file, named as a sentence
```

### 2.3 The module contract — one registry drives everything

Every module exports one `defineModule({...})`. The registry (`core/registry/index.ts`) imports all of them. This is
the only place a page, capability, entity, setting, export or search provider is declared.

```ts
export default defineModule({
  key: 'tasks',
  pages: [
    { key: 'tasks', route: '/tasks', label: 'nav.tasks', icon: 'check-square', nav: { group: 'main', order: 40 },
      levels: ['none', 'view', 'own', 'full'],
      defaults: { admin: 'full', head: 'full', manager: 'full', member: 'own', viewer: 'view' } },
  ],
  capabilities: [   // access rows that are not pages (shown in the access matrix under their page)
    { key: 'tasks.assign', page: 'tasks', label: 'cap.tasks.assign', defaults: { admin: true, head: true, manager: true } },
  ],
  entities: [
    { table: 'work.task', key: 'task', label: 'entity.task', url: (r) => `/tasks/${r.number}`,
      search: 'api.search_tasks', owners: 'work.task_owners' },   // owners → who is told of changes
  ],
  settings: [ { key: 'work.no_update_days', group: 'settings.work', schema: z.number().int().min(1).max(60), default: 7 } ],
  exports:  [ { key: 'tasks.list', view: 'api.task_list', columns: taskColumns } ],
  createActions: [ { key: 'task.quick_add', label: 'create.task', shortcut: 't' } ],
  myDay: [ 'tasks.my_open', 'tasks.my_overdue' ],
  measures: [ 'work.tasks_on_time', 'work.action_items_on_time', 'work.weekly_updates', 'work.meeting_notes_on_time' ],
});
```

What reads the registry:

- **Navigation** — the drawer lists pages with `nav`, filtered by the person's level (`none` hides it).
- **Access matrix** (Settings → Organization & access) — rows = pages + capabilities, columns = roles, cells = defaults;
  per-person overrides on the person's card.
- **Database** — `pnpm registry:sync` writes a migration that upserts `core.page`, `core.capability`,
  `core.setting_def` and the role defaults from the registry. CI test `registry-in-sync` fails if the registry and the
  migrated database disagree in either direction (the "three registrations" failure cannot recur).
- **Ctrl K, Create, search** — commands, create actions and search providers come from the same entries.
- **Record links** — the change log, notifications and search open any record through `/r/<entity>/<id>`, which the
  registry resolves to the entity's URL.

### 2.4 Data layer rules (the only way screens touch data)

1. **Reads** go to `api.*` views or read functions through `core/db`. Lists use `fetchAll()` (pages of 1,000, stable
   order, stops on a short page); detail uses one row. Every total shown on a screen comes from a database view or
   function — screens never add up rows they fetched (A7). Every read pages to the end, and a probe with 1,001 made-up
   rows fails any read that stops at 1,000 (OA8, V428).
2. **Writes** go through `command(fn, args)` in `core/db/command.ts`, which calls one `api.*` function and returns
   `{ id, version, requestId }` or throws a typed error (`PermissionDenied`, `Conflict`, `RuleBroken(key)`, `NotFound`,
   `Unavailable`). A command that returns no id is treated as a failure (A6).
3. After any successful command: show the toast (with Undo when the command is undoable), then **invalidate every query**
   (`queryClient.invalidateQueries()`); open screens refetch. At this app's scale (tens of people, one screen at a time)
   this costs little and removes "one screen forgot to refresh" as a class of bug. Window focus also refetches.
4. Other people's changes: the bell (Realtime subscription to the person's own notifications) and focus-refetch. A
   Realtime "something changed" signal for open lists is an optional later step (P6), not a correctness need.
5. Every read renders through `<DataState>`, which has five distinct states: **loading**, **failed** (says which read
   failed, with Try again — M27/M71), **empty** (a true zero), **no access** (the level says so — M53), and **not
   measured** (for figures — M60). A figure that failed to load is never drawn as 0.
6. No `localStorage` except `core/prefs` (theme, drawer pinned, last-used view per page).

### 2.5 The shell, the design tokens, density and the screen rules

**Source of truth for the look** (V82 as amended on 29 Sep): the design system page ("Commercial Design System",
https://claude.ai/artifact/LhgpWwKiMxQtQiQmXjco64) and the screens canvas
(https://claude.ai/artifact/QRysGjaefjvGbDxNvfYbLW, 18 artboards), both owned by the **Design lead session**, which
updates them; builder B reads them before each screen step. The build plan's token table is the design system page's
values as ruled. Where this section and the design source differ, the design source wins on look, this spec on
behaviour.

- **Shell.** Side drawer **232 px pinned / 56 px collapsed** (V85 — what the owner was told; the artboards' 248 px is
  not used): collapsed, it is an icon rail with tooltips, and the content **reflows into the freed width**; unpinned it
  opens as an overlay on hover or focus and closes on Esc. Order: My day, Overview, **Clients**, **Suppliers & partners** (V98), Pipeline, Projects, Tasks, Finance, KPIs,
  Reports, Appraisal, Activity (V97); **Settings only for admins** (V97) at the foot above the person's profile (avatar,
  nickname, badge). Top bar
  60 px: search (Ctrl K), Create, bell, the profile chip (avatar and nickname) — no page titles in it. Page header:
  breadcrumb, title, one primary button, at most two secondary, the rest in a ⋯ menu. Each area is one page: list on
  the start side, **detail panel 480 px** on the end side (full page under 900 px); every record has its own URL; at
  most one tab row, its state in the URL; filters are chips above the list (dashed = available, solid = applied with
  "field: value" and ✕; a chip keeps or drops rows and shows its count — M102/M89).
- **Layout rules** (V85). Breakpoints and page margins (the gutter on each side of the content): **phone** < 640 px —
  16 px; **tablet** 640–1,023 px — 24 px; **desktop** 1,024–1,439 px — 32 px; **wide** ≥ 1,440 px — 40 px. Content
  max-widths: lists, boards and tables use the full width up to **1,600 px**; a full-page record's main column up to
  **960 px** beside its **300 px** properties rail (V81); forms and settings pages up to **720 px**; the report editor's
  text column up to **880 px**; wider screens centre the content. The drawer: pinned from 1,024 px, the 56 px rail on
  tablets (opening as an overlay), replaced on phones by the bottom bar. The detail panel is 480 px from 1,024 px;
  below 900 px a record opens full page.
- **Phones** (V85): a **bottom bar** — My day · Tasks · Clients · KPIs · More (More opens every other page as a
  sheet) — replaces the drawer; the top bar keeps search, the bell and the profile chip; records open **full screen**
  with a back arrow; tables show as **two-line cards** (line 1: the title and its key figure; line 2: two or three
  secondary fields and the status chip); a **floating +** above the bottom bar (end side) opens quick add — task, Log
  call, achievement. The same data and actions as on a desktop; nothing is phone-only.
- **Four themes** (owner, 28 Sep): **Light**, **Dark**, **Colorful** (the blueprint's values, unchanged) and **Direct**
  — **the official brand palette** (V60, replacing the first Direct values): bg #F6F7F9, surface #FAFBFC, raised
  #FFFFFF, border #E6E8EC, strong #858E99, text #303848, muted #646D79, link #B5490E; **accent #F06820 for marks, tabs
  and bars only — never a text colour or a label background**; accent hover #FF6B00, accent-soft #FFF3EC; **primary
  #C94C14 (filled buttons, white label 4.64:1)**, primary hover #B5430F; focus #2563EB; success #1F7A4D, warning
  #7D6200, danger #C0233F, info #2563B0 and their soft tints; navigation slate #323E48, nav text #E6E8EC, active item
  #3E4B56 with an #FF6B00 active mark. Every theme gains **`--primary` / `--primary-hover` / `--on-primary`** (in Light,
  Dark and Colorful they equal accent, accent-hover and on-accent). Each person chooses their theme (My profile); an
  admin sets the default. **The logo** is the official file — slate wordmark on light, white wordmark on dark or slate —
  never recoloured (the files come to builder B from the owner).
- **Tokens.** One file `src/ui/tokens.css` declares, for each `[data-theme="light|dark|colorful|direct"]`, the full
  set of the build plan's token table: `--bg`, `--surface`, `--raised`, `--border`, `--border-strong`, `--text`,
  `--muted`, `--link`, `--accent`, `--accent-hover`, `--accent-soft` (selected row), `--on-accent`, `--primary`,
  `--primary-hover`, `--on-primary`, `--focus`, `--success`, `--warning`, `--danger`, `--info` and their `-soft`
  tints, `--nav-bg`, `--nav-text`, `--nav-active`, `--nav-active-mark`, chart colours `--c1`…`--c6`, `--shadow-1`,
  `--shadow-2`; plus the scale (type 11.5/13/14/16/20/24/30 px, spacing on a 4 px grid, radius 4/6/10/pill, three
  elevations). Tailwind maps utilities to the tokens; **no hex or Tailwind palette colour appears in components**
  (lint). Rules the lint checks: filled buttons use `--primary` with `--on-primary`; `--accent` never colours text or
  sits under a label (text in that hue uses `--link`); colour never carries meaning alone (a status chip always shows
  its word).
- **Record pages — one template** (owner, 29 Sep — V95, reshaping V81). **List pages stay lean.** One record page for
  Organisation, KPI, Project, Tender, Task, Person, Report, Achievement and Challenge: a **header** with the record's
  name, up to **five key figures** and the **main actions** (admins pick the figures per type — the setting
  `record.header_figures.<type>`, a list of measure or field keys; the hover card and the phone card reuse the same
  five); **tabs Overview · Activity · Related · one type tab** (the registry declares each type's tab — Organisation:
  Finance when the Client side is on; KPI: Results; Project: Tasks; Tender: Bid; Task: Action items; Person: Appraisal,
  visible under V96; Report: Lines; Achievement: Evidence; Challenge: Resolution); a **details rail** (about 300 px, the
  end side) holding **every custom field** (the side's fields, the category's fields, references, identifiers) and the
  properties. **Overview** = the main column: the record's own content and the last few of everything with **Show
  all**; **Activity** = the timeline with Undo (V61) and the logged activities (V401); **Related** = every linked record
  by type. Empty fields hide behind **+ Add**; the 480 px panel shows the same header and Overview in one column with
  the rail folded into the header; every record can **Open full page**. Nothing is removed by the template, only
  placed.
- **Shared patterns** (V61), each one component used everywhere: **hover cards** for people and partners; **Follow**
  on any record; the record's **activity timeline** with Undo; **saved views** per list (personal or shared; the view is
  in the URL); **bulk actions** on multi-select; **"Since your last visit"** marks on My day and lists
  (`core.person_last_seen`); the **notification centre** (§3.3).
- **Density** (owner, 28 Sep). **Comfortable is the default**: 14 px body, 40 px controls, table rows 44–52 px,
  24–32 px between sections, hit targets ≥ 40 px (44 px touch). **Compact** is a per-person choice (13 px, 32 px table
  rows) that tightens tables only. Nothing is cramped — My day least of all. Implemented as a `data-density` attribute
  beside `data-theme`, switching a small set of size tokens.
- **Type.** Readex Pro for headings and key figures; IBM Plex Sans / IBM Plex Sans Arabic for text; IBM Plex Mono for
  IDs and money (tabular figures, SAR suffix muted). Arabic runs one step larger at small sizes, with more line
  height, never letter-spaced or upper-cased.
- **Screens carry data and controls — nothing else** (owner, 28 Sep; the old app's biggest complaint). No hint text,
  explanatory notes, banners, callouts or demo annotations inside screens. What the old rules said "in words" (what
  is held back, why a figure is missing, that a report was superseded) is shown **as data**: a tile, a count chip, a
  status chip, a row in a list, a figure's own "—, not measured" — each one a link to the records behind it. The only
  sentences are an empty state's one line with its one action, a failed read in the place of the data it spoiled
  (M27), confirm dialogs (D19) and toasts. The UI kit has no banner, callout or hint component, and a check refuses
  one.
- **Everything links.** Every partner, invoice, task, achievement, KPI, report line and person shown anywhere is an
  `<EntityLink>` to its own record (names in running text in `--link`, titles in lists in text colour with a light
  underline, IDs in mono inside an entity chip); a UI test walks each page and fails on an entity shown as plain text.
- **Right-to-left.** Only logical CSS (`ms-/me-/ps-/pe-/start-/end-`, `text-start`); lint refuses physical left/right
  utilities; direction-bearing icons flip under `dir="rtl"` (never logos, check marks, time axes or numbers); digits
  stay Latin in both languages (`ar-SA-u-nu-latn`, Gregorian — V40).

**Screen house rules from the old app** (V426): a form always shows the stored value — a retired or unknown value as it
is — and sends only the fields that changed, so an untouched Save changes nothing (OA15); a network failure keeps the
typed values and says "not saved, retry", and nothing says "saved" unless the server confirmed it (OA17); nothing on
screen is invented, and a failed read is never drawn as empty or as 0 — `DataState` shows its failed state (OA18); every
period slot is drawn, and a chart's parts sum to its tile (OA19); one bad record costs one row, and the list says how
many were skipped (OA21); printing or exporting never drops a column silently (OA23); opening or reading a page writes
nothing except the person's own bookkeeping, and an E2E walk counts the writes (OA16).

### 2.6 Growth without rebuilding

| To add | What changes | Code? |
|---|---|---|
| A department | Settings → Organization: department, its teams, people, their roles; a Plan for its year; its report editors | No |
| A team, a person, a role | Settings → Organization (roles set default levels; a person may be overridden page by page) | No |
| A KPI, objective, achievement category or field, target | Settings → Plan & performance (yearly plan) | No |
| A status, priority, service, map entry, exclusion, report section order, grade scale | Settings | No |
| A new kind of **computed** KPI source (a new measure) | One SQL function `measure.<module>_<name>` (e.g. `measure.finance_revenue` for the key `finance.revenue`) + its registry line + its tests | Yes — a small PR |
| A module (Leads, Suppliers, Events …) | New `modules/<key>/` with its `module.ts`, migrations and screens; the registry wires nav, access and search | Yes — its own PRs; nothing existing is rewritten |

Every business table carries `department_id` from day one (a person's own department, plus any extra department an
admin grants in `core.person_department (person_id, department_id)` for cross-department visibility; partners are the exception: one partner record serves the
whole firm. Row-level visibility is "rows of the departments I belong to" — with one department in v1 that is
everyone in Commercial, and a second department later is separated without a migration of old rows.

---

## 3. Data model (c)

### 3.0 Conventions

- **Schemas.** `core` (organization, people, access, settings, files, notes, numbering), `audit`, `notify`, `partner` (organisations: clients, suppliers, strategic partners),
  `finance`, `pipeline` (tenders, partnership opportunities — V80), `work` (projects, tasks), `perf` (plans, KPIs, achievements, challenges, period targets), `report`,
  `appraisal`, `io` (imports), `norm` (pure folding functions), `measure` (KPI sources), `authz` (access helpers), and
  **`api`** — the only schema PostgREST exposes. `test` exists only in test databases.
- **Keys.** `id uuid primary key default gen_random_uuid()`. People-facing numbers are separate columns
  (`TSK-2026-0042`, `PRJ-2026-007`) from `core.next_number(kind, year)` (a locked counter row per kind and year).
- **Standard columns** (written `STD` below): `id`, `created_at timestamptz not null default now()`,
  `created_by uuid not null → core.person`, `updated_at`, `updated_by → core.person`, `version int not null default 1`
  (bumped by trigger on every update — A14). **Soft removal** (`SOFT`): `deleted_at`, `deleted_by`, `delete_reason`;
  every read view filters removed rows; no role has `DELETE` on any table. **Department** (`DEPT`):
  `department_id uuid not null → core.department`.
- **Link tables** — every table written below as `(a, b) pk` is a link table and **really** has `id`, `created_at`,
  `created_by`, `deleted_at`, `deleted_by`, `delete_reason`, with the `(a, b)` pair as a partial unique index on live
  rows. Unlinking (removing a helper, a KPI lead, an invoice from a project or a report line) is a soft removal, so it
  is logged and undoable like everything else.
- **"unique … where …"** below always means a partial unique index (not a constraint); where a uniqueness must hold
  across a status change (issuing a correction), the function changes the old row first, in the same transaction.
- **A foreign key to a table built in a later step** (e.g. `audit.request.batch_id → io.batch`, P7) is added by that
  later step's migration with `alter table … add constraint`, so every migration applies in order on a database built
  from zero.
- **Setting lists** (`LIST`): `key text unique` (stable code), `name_en text not null`, **`name_ar text not null`**
  (V76: every list — categories, KPI names, segments, statuses, roles, stages, reasons, outcomes — carries its Arabic
  label, so reports can be written in Arabic), `sort int`, `active bool default true`. The same holds for every other
  label a report prints: objective and KPI titles, category and role field labels, select options (`{key, en, ar}`). A list entry is retired, never deleted, and stays readable where a record holds it (M40).
- **Money** `numeric(14,2)`, SAR. **Counts** `int`. **Ratios** `numeric` as fractions (1.00 = 100 %).
  **Calendar dates** `date`; **instants** `timestamptz` (stored UTC, shown in Riyadh — D20). Riyadh helpers:
  `core.riyadh_today()`, `core.riyadh_day(timestamptz)`, `core.month_of(date)`, `core.quarter_of(date)`; weeks start on
  Sunday (setting). No Hijri anywhere.
- **Names** of people: `*_en` required, `*_ar` optional; display falls back to the other language (M94). Partners
  carry official and trade names (V77, §3.4).
- **Never stored:** any sum, count, ratio, pace, score or match result — they are views or functions (§3.12). No column
  named for VAT amounts exists anywhere (M1; `check-no-vat-columns`).
- **Every table**: RLS enabled (not *forced* — the write functions, owned by the migration role, write past it after
  their own explicit checks); `select` policy only; grants: `select` to `authenticated` on tables its views read; **no
  insert/update/delete grants** (A6); `anon` gets nothing (M87). The browser client is created with
  `db: { schema: 'api' }`, and TypeScript types are generated from the `api` schema (a drift check fails CI when they
  are stale).
- **Every write function** (`api.*`): `security definer`, `set search_path = ''`, starts with `audit.begin(...)` and an
  explicit `authz.require(...)`; checks `version`; returns `jsonb {id, version, request_id}`; raises named errors
  (`42501` permission, `40001` conflict with who/when, `23505` duplicate with the holder named, `P0001` business rule
  with a message key). Grants: `revoke all … from public, anon; grant execute … to authenticated` (A8).

### 3.1 Organization, people and access

```
core.department   STD SOFT; code text unique; name_en; name_ar; head_person_id → core.person; active
core.team         STD; department_id; code; name_en; name_ar; lead_person_id → core.person; active;
                  retired_at; retired_into_team_id → core.team            unique (department_id, code)
                  -- never deleted: api.team_retire(team, move_to) moves open work and people first (D11)
core.role         LIST + is_admin bool                  -- roles only set default levels (D2)
core.person       STD SOFT; full_name_en not null; full_name_ar; nickname_en; nickname_ar; job_title_en; job_title_ar;
                  department_id; team_id → core.team; manager_id → core.person (no cycles, trigger);
                  role_id → core.role; can_sign_in bool default false; active bool default true;
                  joined_on; left_on; kind text check (kind in ('staff','system'))
                  -- 'system' persons ("Import", "System") are named non-login actors: imports and jobs are never
                  -- attributed to a real login (replaces the old QA-account attribution, D13)
core.person_team_assist (person_id, team_id) pk         -- teams a person helps besides their home team
core.page         key text pk; module; route; nav_group; nav_order; levels_allowed text[]; active      -- synced from the registry
core.capability   key text pk; page_key → core.page; active                                            -- synced
core.role_page_level    (role_id, page_key) pk; level core.level           -- defaults (synced, then editable)
core.role_capability    (role_id, capability_key) pk; granted bool
core.person_page_level  (person_id, page_key) pk; level; set_by; set_at; reason        -- per-person overrides
core.person_capability  (person_id, capability_key) pk; granted; set_by; set_at; reason
core.person_profile  person_id pk; display_name_en; display_name_ar (nickname); avatar_file_id → core.file; avatar_color
                  (one of the chart colours); badge_kind ('none','icon','zodiac'); badge_value (an icon key from a fixed set, or
                  one of the 12 zodiac signs); theme ('light','dark','colorful','direct'); density ('comfortable','compact');
                  locale ('en','ar' — ar once enabled); start_page → core.page; drawer_pinned bool;
                  notify jsonb {kind: {in_app: bool, email: bool}} — kinds as the canvas lists them: mentions and comments, tasks and
                  action items assigned to me, due today and overdue, a report submitted for my review, invoices past N days on
                  my partners (email only once the mail sender exists — V24)
                  -- "My profile": each person edits their own (full name included), logged like everything else; an admin
                  -- sets the defaults. This replaces the old D11 "a user can only sign in and out" for these fields only;
                  -- role, team, manager, emails and access stay with admins and managers
```

`core.level` is the ordered enum `none < view < own < full` (D2). Effective level = person override, else role
default, else `none`; an admin role is `full` everywhere. Rules carried over: only an admin makes an admin (D13); nobody
changes their own access; a manager can grant at most their own level (M72; the dialog asks first).

The **sign-in allow-list** is the live `core.person_email` rows of persons with `can_sign_in and active and kind =
'staff'`; a person may hold several allowed emails (a `.com` and a `.net`), each Supabase identity links to exactly
one person through `core.person_auth`, and every sign-in is logged in `core.sign_in_log` (§4).

### 3.2 Settings

```
core.setting_def  key text pk; group_page → core.page ('settings.profile', 'settings.org' … 'settings.app'); schema jsonb; default jsonb;
                  effective_dated bool; label_key                                         -- synced from the registry
core.setting      id; key → core.setting_def; department_id null (null = whole company); value jsonb;
                  valid_from date not null; set_by; set_at; reason
                  unique nulls not distinct (key, department_id, valid_from)   -- one company-wide row per date
core.wording      (locale, key) pk; text; set_by; set_at        -- Settings → App → Wording overrides the catalog
                  -- (V73 Revenue · Cost · Profit; V405 `kpi.lead` = Responsible / المسؤول)
```

- A **scalar setting** is read with `core.setting_at(key, department, date)`: the department's latest row with
  `valid_from ≤ date`, else the company-wide one, else the registry default. Rows are never updated — a change is a new
  row, so history and "as of" reads come free (§5a "mid-year changes take an effective date").
- A **list setting** is an ordinary table (statuses, priorities, services, maps, exclusion rules, categories, grade
  scales …), owned by one settings group for write access, change-logged like any record.
- **Defaults are written once, as dated rows.** When a key first appears, the registry sync writes its default as a
  `core.setting` row dated that day (reason "default"); `setting_at` never falls back to code for a key that has a
  row, so a later release that changes a default in code never rewrites a past month. (Configuration, not a business
  record — D17 is not engaged.)
- **Who changes settings** (V97): **Settings is admins-only** — its pages have two levels, none and Full; nobody else
  has a Settings entry. Everyone has **My profile** (`/profile`, from the profile chip): admins set the defaults
  (`app.default_theme`, `app.default_density`, `app.default_start_page`, `app.default_drawer`,
  `app.default_notifications`) and a person's profile overrides them. Managers act **inside records**: KPI targets on
  the KPI page (Full on KPIs), appraisals on the person's page (V96). Only admins change access or people's emails.
- **Safety rules for every setting and list** (V97):
  - **archive, never delete, a value in use** — `api.list_usage(key, id)` counts where it is used; at 0 the entry may
    be **removed** — a soft removal (`deleted_at`), shown in Recently deleted and restorable, **never a physical DELETE
    through the API** (Undo could not reverse one — V128; QA-31); else Archive (retired: hidden from pickers, kept on
    records — M40);
  - **retiring a value in use = replacing it** — `api.list_retire(key, id, replace_with, reason)` re-points every
    record in **one logged bulk change** that names the count and offers Undo;
  - **IDs, not text** — records hold the entry's id; renaming an entry renames it everywhere at once;
  - **editable names on locked meanings** — where code needs to know what an entry means (a task status's meaning, a
    pipeline stage's meaning, a side's status), the entry has a `meaning` column set once by the seed; admins rename
    freely and never change the meaning;
  - **an effective date** for anything that changes numbers (targets, definitions, thresholds, rates) — read "as of";
  - **an impact preview before saving** — `api.setting_preview(key, value, valid_from)` runs the change in a rolled-back
    transaction and answers with what would change (records re-pointed, figures that move, alerts that would fire);
  - **one settings log, kept forever, with Revert** — every settings and list change is in the change log (§3.3) under
    kind `setting`; it is never pruned, and **Revert** re-applies the previous value as a new dated row without the
    24-hour Undo window;
  - **seeds never overwrite an admin's edit** — the registry sync inserts a missing entry or default and never updates
    one that exists;
  - **an Arabic label is required** (V76).
- Starting scalar settings: `audit.undo_window_hours` 24
  (D7) · `work.no_update_days` 7 · `work.week_starts_on` sunday · `work.meeting_note_on_time_days` 1 ·
  `partner.match_order` [client_id, vat_cr, discount_code, email, phone, name] · `partner.name_stop_words` (the form
  words list of §3.5) · `partner.credit_date` revenue_date (which date decides whose credit an invoice is — V27) ·
  `finance.revenue_definition` (§3.6) · `finance.collection_due_days` 30 · `finance.unpaid_alert_days` 45 · `partner.contract_reminder_days` 60 · 30 · 7 · `partner.contract_expiring_from_days` 30 · `partner.contract_notify` (account manager ✓, followers ✓, commercial manager ✗) · `partner.contract_renewal_task` ✓ · `partner.id_format` DK-P-0000 · `partner.logo_fallback` monogram · `core.file_keep_original_name` ✓ · `core.file_download_display_name` ✓ · `finance.unbilled_after_days` 30 (a transaction with no billing invoice after
  that is flagged) ·
  `finance.cost_estimate` on (D23) · `perf.pace_bands` {on_track 1.00, at_risk 0.85} (a plan setting — V401) ·
  `report.due_day` 5 · `app.arabic_enabled` false · `app.default_theme` direct (Q32) · `app.default_density` comfortable · `auth.device_idle_days` 30 ·
  `work.reminder_days_before_due` 1 · `notify.kinds_enabled` (every kind on) · `app.export_formats` [csv, xlsx] ·
  `files.max_mb` 20 · `partner.one_code_per_partner` ✓ · `report.cases_per_quarter` 1 · `appraisal.cycle_label` "2026-27"
  (the default from the cycle's years) · `work.pipeline_weekly_target` 1 · `perf.kpi_checkin_day` 15 (V93) · `work.late_days` 14 and `app.go_live_on` (V400) ·
  `partner.stale_after_days` 21 · `finance.quiet_client_days` 60 · `work.project_update_days` 14 ·
  `core.recently_deleted_days` 30 (V401) · `record.header_figures.<type>` (V95).

### 3.3 Change log, undo and notifications

```
audit.request  id uuid pk; at; actor_id → core.person; kind ('ui','import','job','system','undo');
               label_key; label_args jsonb (e.g. 'task.closed' {number}); reason; batch_id → io.batch;
               undo_of → audit.request; undone_by → audit.request; undone_at
audit.change   id bigserial pk; request_id not null; at; table_name; row_id uuid; action ('insert','update','remove','restore');
               fields text[]; before jsonb; after jsonb; version_after int
               index (table_name, row_id, id desc); index (request_id)
notify.notification  id; person_id; kind ('assigned','helper_added','mentioned','changed_by_other','followed_change',
               'decision_needed','report_issued','report_for_review','appraisal_step','import_done',
               'alert_contract_expiring','alert_kpi_behind','alert_invoice_unpaid','alert_kpi_checkin',
               'escalated','alert_quiet_client','alert_project_no_update','alert_activity_stale','alert_file_review'); entity_table; entity_id; request_id;
               actor_id; alert_key (unique per person per day for alerts); created_at; read_at; snoozed_until
               index (person_id, read_at nulls first, created_at desc)
notify.follow  (person_id, entity_table, entity_id) pk      -- Follow / Watch on any record (V61); owners follow their own
core.person_last_seen  (person_id, page_key) pk; seen_at     -- "Since your last visit" on My day and in lists
core.saved_view  STD SOFT; page_key; owner_id; name; query jsonb (filters, columns, sort, grouping); shared bool; sort
               -- personal, or shared with everyone who can open the page; a shared view opens by its URL
core.person_default_view  (person_id, page_key) pk; saved_view_id    -- the view a page opens on for that person (V78)
```

- **One request per person action.** `audit.begin()` creates the request and sets `app.request_id` for the transaction;
  the generic trigger `audit.capture()` (after insert, update **and delete**, every business table — deletes cannot
  happen through the API, but a stray one is still logged) writes one `audit.change` per row
  with **only the changed fields** (before and after), skipping no-op updates. A write that arrives without a request
  (a migration, psql) is logged under an automatic `system` request — never under a real person.
- **Imports** do not log every inserted fact row (a 258k-row file would bloat the log); the rows carry
  `first_batch_id`/`last_batch_id`. Every **changed field** of an existing row is logged, so what an import changed is
  visible and undoable.
- **Reading history.** `api.record_history(entity, id)` gives the change list of a record the caller can see (money
  fields' values only with Finance view); the whole log (Settings → Activity) is for admins and managers (D13, M25).
- **Undo** — `api.undo(request_id)`:
  - Who: the person who made the change, within `audit.undo_window_hours`; the owner of a changed record within the
    same window (D7); admins and managers with Full on the page, any time.
  - How: in reverse order, per field — an update is reverted only where the field still holds the `after` value; an
    insert (including a link) is soft-removed; a removal is restored. **All or nothing**: if any field was changed again later, nothing is
    undone and the answer names the field, who changed it and when (A16). A restore that a uniqueness rule now blocks
    (an identifier another partner holds) is refused and names the holder.
  - Undo is itself a request (`kind 'undo'`, `undo_of`); undoing it is redo. The toast's Undo button calls this with
    the request id the command returned.
  - An import is undone as one request: facts it inserted are removed, fields it changed are restored — refused if a
    later import changed the same rows (it names them: "undo the later import first").
- **Notifications.** Assignment, helper, mention, report issued and appraisal steps are pushed by the API function
  that caused them. "Changed by someone else" is fanned out by `audit.end()` to the owners of every record the request
  touched (the entity's `owners` function in the registry), one notification per person per request, never to the
  actor, and to everyone who **follows** the record. Due and overdue items are **computed live** (bell count and My
  day), not stored. In-app only in v1 (email once the mail sender exists — V45).
- **Alerts are notifications** (V61), made by a daily `pg_cron` job (`notify.generate_alerts()`, 06:00 Riyadh =
  `0 3 * * *` UTC), idempotent by `alert_key`: a contract inside its notice days; a KPI whose pace is Behind (to its leads — V401); a
  counted invoice unpaid for more than `finance.unpaid_alert_days` (to the client's account manager, with its follow-up
  task); a quiet client; a project without a health update; an organisation gone stale; a file past its review date. Each threshold is a setting; each alert links to its record.
- **The notification centre** (the bell): tabs **All · Mentions · Assigned to me**, grouped by day, **Mark all read**,
  **Snooze until** (a date or "tomorrow 08:00"), each item a link; the canvas's NotificationsPanel is the layout.
- **Names are always live** (owner rule — V58). Every reference to a person or a partner is stored as its **ID** and
  shown with its **current** display name — in tasks, helpers, activity, notifications, file names and report
  screens. Nothing stores a person's or partner's name as text, except the frozen wording of an issued report, which
  keeps IDs in it as entity tokens (§3.9). A test renames a helper and checks the task, the activity and a report view.
- **Activity timeline per record** (the record's detail): the record's changes, newest first, each with who, when, what
  changed, and **Undo** where allowed (§ above).
- **Bulk actions**: lists allow multi-select; a bulk action (assign, change status, add a follower, link, remove) is
  **one** API call and one request, so one Undo reverts all of it.
- **Recently deleted** (V401): `api.recently_deleted()` lists the records removed in the last `core.recently_deleted_days`
  (30) that the caller could see, each with **Restore** — the removal's undo, allowed past the 24-hour window for this
  one action; after 30 days a removed record stays in the change log but leaves the list.
- **Escalate** (V401) on a task, a challenge or an organisation: `api.escalate(entity, id, to_person, note)` notifies the
  person (`escalated`), makes them a follower, and writes the note to the timeline and the change log in one request;
  a challenge also records `escalated_to` / `escalated_on` (V69).
- **A follow-up task from an alert** (V401): when the 45-day unpaid-invoice alert fires, the job also creates one task
  for the client's account manager (origin `alert`, linked to the invoice), once per invoice.

### 3.4 Organisations — Clients, and Suppliers & partners; identifiers, contacts, contracts, files

**One record per organisation, with two sides fixed in code** (owner, 29 Sep — V98, replacing V52/V62/V78): the
**Client** side and the **Supplier & partner** side. An organisation has one side on, or both. On screens the words are
**Clients** and **Suppliers & partners** — two list pages over the one table — and a record is "an organisation";
the menu entry "Partners" is gone. In this spec and in code, `partner` still names the schema and the record (as built
in P3-8a; renaming it would churn a merged migration for nothing): read "partner" here as "the organisation record".
Where this spec says "company" in a rule quoted from the old app, it means the same record.

```
partner.partner   STD SOFT; number unique (the organisation ID, e.g. DK-P-0142: format and next number from
                  `partner.id_format`); trade_name_en not null; trade_name_ar; official_name_en; official_name_ar
                  (V77: the trade name is the display name everywhere; the official names are used where it is legal —
                  contracts, tenders, tax matching — and all four are kept as name identifiers);
                  key_partner bool (V72: gets the recurring feedback and QBR tasks);
                  website; city; country; address; notes; archived_at; merged_into_id → partner.partner;
                  logo_file_id → core.file (uploaded from the header; a monogram of the initials when none);
                  client_since date   -- typed; until Payments history is imported, marks a client as not new (V31)
                  -- SHARED by both sides (V98): names, logo, identifiers (below), contacts, notes, files of kind other
                  -- no VAT, CR, client ID, discount code or email columns: those live only in partner.identifier (one home)
partner.side      fixed in code, never a table: 'client' | 'supplier_partner'   (V98)
partner.side_type LIST per side (V98): CLIENT types = the segments of V64, one list (Government · Corporate ·
                  Agencies · Individuals … — the banned words apply to list values too, V404);
                  SUPPLIER & PARTNER types: Supplier · Strategic partner · Sales channel ·
                  Integration · Payment solution … — admins edit both lists
partner.side_tier LIST per side
partner.side_field  STD SOFT; side; key; label_en; label_ar; type (as perf.category_field); required; options; sort
                  -- each side's own custom fields, shown in the record's details rail (V95); a field named like a
                  -- password or secret is refused (V98: cards hold references, never passwords)
partner.partner_side  STD SOFT; partner_id; side; type_id → partner.side_type; tier_id → partner.side_tier;
                  field_values jsonb; since date; until date          unique (partner_id, side) where live
                  -- the side switch: a row = the side is on. Switching the Client side on offers the Corporate
                  -- onboarding checklist (V89)
partner.side_status_reason  LIST per status (at risk and lost: e.g. price, service issue, competitor, no response)
partner.side_status_change  STD; partner_id; side; status ('prospect','active','at_risk','lost'); effective_on date not null;
                  reason_id → partner.side_status_reason (required for at_risk and lost); note; set_by
                  -- V62's history, now per side; never updated: a side's status on a day is the latest change on or
                  -- before it (view partner.side_status). Onboarded in the pipeline sets Active (V99)
partner.side_owner  STD SOFT; partner_id; side; person_id; effective_from date not null; effective_to date; reason
                  exclude using gist (partner_id with =, side with =, daterange(effective_from, effective_to, '[)') with &&)
                  -- the Client side's owner is the ACCOUNT MANAGER (credit follows them — V27); the Supplier & partner
                  -- side's owner is the RELATIONSHIP OWNER. P3-8a's partner.account_manager becomes this table with side
partner.identifier  id; partner_id not null; kind ('payments_client_id','vat','cr','discount_code','email','phone','name');
                  subkind (client ID: 'prepaid'|'postpaid'|'tender'; name: 'official_en'|'official_ar'|'trade_en'|'trade_ar'|'alias');
                  value_raw not null; value_key not null; norm_version int; reason not null (§3 "each with a reason");
                  valid_from date; valid_to date (discount codes only, check to ≥ from); source ('person','decision','import','merge');
                  closed_on date (client IDs — V411: a closed ID still matches rows whose booking date is on or before it;
                  later rows stop; nothing about the past changes);
                  note; created_at; created_by; deleted_at; deleted_by; delete_reason (V133)
                  -- V422: at most one OPEN (closed_on null) prepaid and one open postpaid client ID per organisation
                  -- (partial unique index); tender IDs unlimited, never collapsed
                  -- V421: the official and trade names are kept as identifiers for search and suggestion only — they never
                  -- match money; a name matches only as an 'alias' a person typed
                  unique (kind, value_key) where deleted_at is null and kind <> 'discount_code'
                  exclude using gist (value_key with =, daterange(valid_from, valid_to, '[]') with &&)
                          where kind = 'discount_code' and deleted_at is null
                  -- a value is never rewritten or moved: remove it and add it to the right organisation (ident branch rule);
                  -- put back only while no other organisation holds it
                  -- CLIENT SIDE ONLY (V98): payments_client_id and discount_code need the Client side on (trigger); the
                  -- rest are shared
partner.code_terms  STD SOFT; identifier_id → partner.identifier (kind discount_code) or campaign_code_id; fee_percent
                  (percent of the service fee); services uuid[] → finance.service; countries text[]; tiers jsonb
                  [{from_bookings, fee_percent}]; review_on date; approved_by → core.person; approved_on; effective_from   -- V65
partner.campaign_code  STD SOFT; code_raw; code_key; name; valid_from; valid_to; owner_id; reason
                  -- V65: a short-trial code credited to no organisation, listed apart like individuals (V30); a code key is
                  -- live on one organisation or one campaign at a time (trigger across both, date ranges included)
partner.credit_limit  STD SOFT; partner_id (Client side on — trigger); amount_sar; effective_from date not null;
                  approved_by → core.person; reason
                  -- V70: the limit Payments already enforces, mirrored with its history; current = latest ≤ today
                  -- V92: a refused credit is a row with amount 0 — shown as "Prepaid only" — whose approver and reason
                  -- are required like any other limit
partner.identifier_block  STD SOFT; kind; match ('exact','domain'); value; reason
                  -- values that can never be identifiers: staff email domains, the Payments test VAT, test customers
partner.individual_name   STD SOFT; name_raw; name_key unique      -- "Individual (not an organisation)" (D25)
partner.contact_role  LIST (V401: e.g. decision maker · travel coordinator · finance · operations · technical)
partner.contact   STD SOFT; partner_id; name_en; name_ar; job_title; role_id → partner.contact_role; email; phone; notes;
                  is_primary; sides text[] (which side(s) this contact belongs to; both by default)   -- shared (V98)
partner.reference STD SOFT; partner_id; side (null = shared); system_id → work.ref_system; value not null; url
                  -- V98: references to Direct's systems only — client ID, ticket number, portal link; a value that
                  -- looks like a secret is refused. V409: a supplier's or partner's portal (Supplier & partner side)
                  -- keeps the portal link in `url` and the username in `value` — never the password
partner.merge     STD; kept_id; merged_id; reason not null; request_id; undone_at
partner.contract  STD SOFT; partner_id; side not null; kind ('contract','agreement'); title; start_on date; end_on date
                  (null = open-ended); reminders_on bool default true; reminder_days int[] (null = the
                  `partner.contract_reminder_days` setting, 60 · 30 · 7); renewal_task_id → work.task; notes   -- V56, per side (V98)
partner.contract_term  STD SOFT; contract_id; term_id → partner.term (LIST: corporate rate, free cancellation, payment
                  terms, peak allotment …, each with its unit); value_before numeric; value_after numeric;
                  achievement_id → perf.achievement (null = "Not logged")   -- the "Terms · before → after" block
                  -- its document(s) are core.file rows linked with purpose 'contract' / 'agreement'
partner.activity_type  LIST (V401): call · meeting · demo · visit · note — admins add more
partner.activity_outcome  LIST per activity type (V63, V88, V401): call — no answer · answered · meeting set · demo set ·
                  not interested · call back later · wrong number; demo — demo held · demo cancelled; meeting — held ·
                  postponed …; `counts_as_demo` on demo set and demo held
core.file         STD SOFT; bucket; path unique; original_name; kind → core.file_kind; mime; size_bytes; sha256;
                  status ('pending','stored'); sensitivity ('normal','restricted');   -- restricted: IBAN letters, agreements (D10)
                  review_on date (V401: a travel policy's review date; the alerts job raises 'alert_file_review')
core.file_kind    LIST: invoice · contract · agreement · rate sheet · certificate · meeting note · travel policy (V401) ·
                  tender document · evidence · report · legacy_report · logo · avatar · other;
                  name_pattern_en; name_pattern_ar                                    -- V55, a setting per kind
core.file_link    STD SOFT; file_id; entity_table; entity_id; purpose ('evidence','contract','agreement','attachment',
                  'iban_letter','render','logo','avatar','travel_policy'); side (organisations only — V98)
                  unique (file_id, entity_table, entity_id, purpose)
core.note         STD SOFT; entity_table; entity_id; kind ('comment','update','activity','meeting_note','escalation');
                  body; happened_on date not null (V400: default Riyadh today, any past date, never after the logged day);
                  logged_at timestamptz not null default now();
                  activity_type_id → partner.activity_type (activity only); outcome_id → partner.activity_outcome;
                  next_step text; next_step_on date; next_step_task_id → work.task (V401); edited_at
core.mention      (note_id, person_id) pk
```

- **The record page** follows the template of V95 (§2.5): the header shows the trade name, the sides as chips (Client ·
  Supplier & partner, each with its type and status), up to five figures (for a client: Revenue YTD, Profit YTD,
  outstanding, open tasks, last activity — admins choose) and the main actions (New task, Log activity, Log
  achievement, New project); the tabs are **Overview · Activity · Related · Finance** (Finance only when the Client
  side is on — client IDs, codes, credit, invoices, figures: **client side only**, V98); the details rail holds both
  sides' fields, the identifiers, the contacts with their roles and the Direct references. The panel and the full page
  share the header.
- **Sides, in words.** Switching a side on adds its row (type required, owner required); switching it off ends the row
  with a date and keeps everything (nothing is removed). A supplier that becomes a client gets the Client side switched
  on — one record, two sides, one history. "Strategic partner", "Sales channel", "Integration", "Payment solution" are
  **types on the Supplier & partner side**; on the Client side the type **is** the segment (V64), so every money view
  splits by it.
- **Status with history, per side** (V62 kept, V98): **Prospect · Active · At risk · Lost**, each change with an effective
  date and, for at risk and lost, a reason from the settings list; the history is on the Activity tab. The **last
  feedback date** (the latest feedback note or feedback task done) shows beside it. Who sets it: the side's owner and
  managers. An organisation with both sides has two statuses; the row chip shows the worse one.
- **One status chip per row**: **At risk** or **Lost** when so; else the most urgent computed flag — **Stale** (no
  activity and no open next step for `partner.stale_after_days`, 21 — V401), **Contract expiring**, **Collection due**
  (an unpaid invoice past `finance.collection_due_days`), **Quiet** (no Fully Paid invoice in `finance.quiet_client_days`,
  60 — V401, clients only), **Sent to legal**, **Tender open**; else the side's status (Prospect, Active).
- **Log activity** (V401, replacing "Log call"): one click on the record, the row and the hover card — pick the **type**
  (call · meeting · demo · visit · note — a settings list), its **outcome** (a settings list per type), `happened_on`
  (today by default), an optional line, and an optional **next step** with a date, which becomes a **task** on the
  person's My day (origin `next_step`, linked to the organisation and the activity) in the same request. The outcome
  **demo set** (V406) asks for the demo's date and creates the **demo task** on that date in the same request — assigned
  to the person logging it, their manager as helper, origin `next_step`, linked to the organisation and the activity;
  one Undo reverts both, and **demo held** logged later on the same organisation offers to close that task. It needs no
  open task: the activity lands on the organisation's Activity tab (`api.activity_log`). Activities, calls and demos per
  person per week feed the appraisal items (measures `work.pipeline_updates`, `partner.calls`, `partner.demos`).
- **Light prospecting, no Leads module in v1** (V63, V99). A prospect is an organisation whose side has status Prospect. A
  manager selects a list and assigns **owner and priority in one action** (`api.partner_bulk_assign`, one request, one
  Undo; a side with no status becomes Prospect). Owner here is the side's owner: a manager may assign one where no
  revenue is counted; changing the Client side's owner where revenue exists stays with the head and admins (V26, V27).
  Leads from the corporate landing form stay in Direct's ticket system and are referenced by ticket number only (a
  Direct reference on the organisation or the opportunity — V99); a Leads inbox may come later if volume needs it.
- **Segment** (V64): each partner has a default segment; a project and an invoice may override it. A unit's segment =
  the invoice's own, else its project's (one linked project), else the partner's; an individual's is Individuals; else
  "No segment". Revenue, margin and every computed KPI can split by segment (a measure parameter).
- **Discount codes carry terms** (V65): fee percent of the service fee, scope (services, countries), volume tiers,
  review date and who approved them, with history. **One live code per partner** by default
  (`partner.one_code_per_partner`); a second needs a manager and a reason. A **campaign code** belongs to no partner:
  its invoices are credited to nobody and listed apart, like individuals. Finance shows **sales by code by month**.
- **Partner finance** (V70) on the Finance tab: the credit limit (with history and who approved it) and outstanding
  against it; the **prepaid (wallet) balance** = paid top-ups − the wallet part consumed by invoices; receivables
  flagged **Sent to legal** with a note. Out of v1: guarantees (promissory notes), supplier payables and statements,
  referral terms (§11).
- **Key clients** (V72) get the recurring **Client feedback** task and the quarterly **Business review** task (V401;
  the recurring templates of §3.7), owned by the account manager; finishing either with a feedback note moves the last
  feedback date.
- **Money on the card follows V1/V73**: the tiles are Revenue, Cost (approved expenses only, "Provisional" while
  any unit is) and Profit (revenue − cost, Final cost only), each against the same period last year; a rise in cost
  reads as bad.
- **Names** (V77). Every partner has an **official English name**, an **official Arabic name** and a **trade name** in
  English and Arabic. The **trade name is the display name everywhere** (lists, chips, hover cards, report tokens, file
  names); the **official names** are used where it is legal — contracts, tenders, tax matching, the `{partner official}`
  file-name token. All four are kept as `name` identifiers (subkinds `official_en`, `official_ar`, `trade_en`,
  `trade_ar`): editing a name removes the old identifier and adds the new one in the same request, so matching follows
  and history keeps both.
- **The two list pages** (V98, keeping V78's shape): **Clients** (`/clients`) lists organisations with the Client side
  on; **Suppliers & partners** (`/suppliers`) those with the other side on; the same record opens from either. **Saved
  views across the top** — Clients: All · Government · Corporate · Agencies · Individuals; Suppliers & partners: All ·
  Suppliers · Strategic partners · Sales channels · Integrations (shared starting views) — each person has a default
  view per page (`core.person_default_view`). **Visible filter chips: Type · Owner · Status**, plus one **KPI**
  chip opening a picker grouped by objective → KPI with a period (this quarter by default), which keeps the partners
  that contributed to that KPI through achievements or invoices (`perf.kpi_partner_contribution(kpi, from, to)`, the
  same rows as the KPI page's drill-down). Every other filter sits in a **More filters** panel. Any combination saves as
  a view. The KPI page links to the same filtered list ("partners that contributed").
- **Period view on the card** (V54): a switch **MTD · QTD · YTD · Custom**; tiles against the same period last year; a
  Q1–Q4 strip, this year against last; **Open in Finance** deep-links to the Finance list with the partner, period and
  kind in the URL. Finance keeps its full filters and **saved views** (§6).
- **Contracts** (V56). Status is computed, never stored: **Active**, **Expires in N days** (from
  `partner.contract_expiring_from_days`, 30), **Expired**, or **Not started**. On each reminder day (60 · 30 · 7 before
  the end, the contract's own days if set, none when its switch is off) the alerts job (§3.3) notifies the account
  manager, the partner's followers and, when the setting says so, the commercial manager; at the first reminder it makes
  the **renewal task** (owner: the account manager; due: the end date; linked to the contract) when
  `partner.contract_renewal_task` is on, and the card and the notification offer **Create renewal task** and **Log renewal achievement**
  (prefilled, a person presses it). Contracts appear on the partner card and in the evidence picker.
- **File names are computed, live** (V55). A file keeps its `original_name`; its display and download name comes from
  its kind's pattern and the records it is linked to, at the moment it is shown — e.g. `INV-T-0001 · {partner} ·
  {amount} SAR · {date}.pdf`, `Contract · {partner official} · {title} · {start} to {end}.pdf` (`{partner}` is the trade
  name, `{partner official}` the official name — V77) — by one SQL function,
  `core.file_display_name(file_id, locale)`. Renaming a partner renames its files everywhere. Downloads use it: the
  signed URL is created with `download: <display name>`, so the browser saves under that name (Content-Disposition).
  Characters a file system refuses are replaced; the original name stays visible in the file's details.
- **Logos and avatars** (V53): logo files SVG or PNG, at least 256 px; without one, the monogram (or a blank tile —
  `partner.logo_fallback`). A partner's logo (or its monogram) and a person's avatar, nickname and badge appear in
  rows, chips, headers and **hover cards** (`api.hover_partner(id)`, `api.hover_person(id)`: the few facts the canvas's
  HoverCards artboard shows).
- The two date-range rules above need the `btree_gist` extension (enabled in the first migration).
- A **contact's** email is not automatically an identifier (a shared or personal address would mis-match invoices);
  the contact form offers "also use as identifier", which goes through the identifier rules.
- **Merging** (`api.partner_merge(kept, merged, reason)`): the merged organisation's identifiers are removed and re-added
  to the kept one (`source 'merge'`), its sides (a side the kept one lacks is added; one it has keeps the kept one's
  status and owner), contacts, contracts, files, notes, tasks, projects and achievements are re-pointed, its account-manager history is kept on record, and it is archived with `merged_into_id`. One request, so
  one undo.
- **Pictures** (avatars, partner logos) go to a second private bucket, `images`: images only, at most 2 MB,
  resized in the browser to 256 px before upload, read through 24-hour signed URLs cached by the browser (they appear on
  every chip, so the 600 s rule for money documents does not fit them). Any signed-in person may see them.
- **Files**: `api.file_begin(entity, kind, purpose, original_name, size, mime)` registers a pending file and returns a
  path; the browser uploads to the private bucket; `api.file_finish(id, sha256)` marks it stored. Storage policies
  allow writes only to a path registered as pending by the same person, and reads only where a `storage.objects` select
  policy calls `authz.can_see_file(path)` (the person can see a record the file is linked to; restricted files for
  managers and admins); the browser then asks Storage for a 600 s signed URL (`createSignedUrl` — M21). Size cap and
  type list are settings.
- Polymorphic `entity_table`/`entity_id` (files, notes, change log, follows) are checked by a trigger against the
  registry's entity list; every business relation is a typed foreign key.

### 3.5 The partner-identifier matching engine

**Principle (owner, 28 Sep):** matching is a live view, never a stamp. Nothing writes a partner onto an invoice.
Adding, removing or moving an identifier changes every past row's partner at once, and every total with it.

**Folding (one copy, in SQL, `IMMUTABLE`, versioned).**

| Function | Rule |
|---|---|
| `norm.fold(t)` | NFKC; lower case; أ إ آ ٱ → ا; ى ئ → ي; ة → ه; ؤ → و; Persian ک → ك and ی → ي (gap in the old code); Arabic-Indic and Extended digits → 0–9; remove harakat (U+064B–U+065F, U+0670) and tatweel (U+0640); remove `.` so L.L.C. = LLC; every other non-letter/digit → space; collapse spaces |
| `norm.name_key(t, stop_words)` | `fold`, split into words, drop the form words (the setting; default: شركه, موسسه, company, co, corp, corporation, ltd, limited, llc, inc, est), join with no spaces; empty → null. The article "ال" is kept (dropping it merges distinct names) |
| `norm.email_key(t)` | lower(trim); must contain `@` |
| `norm.phone_key(t)` | digits (Arabic digits converted); strip a leading `00`, then `966`, then leading zeros, then a `966` again (fixes the old `0966…` gap); fewer than 7 digits → null |
| `norm.digits_key(t)` | VAT, CR: digits only. Payments client ID: digits, leading zeros dropped |
| `norm.code_key(t)` | `fold`, then remove every non-alphanumeric (the old `money_norm`) |
| `norm.key(kind, t)` | dispatches by kind |

Stored keys (`partner.identifier.value_key`, the invoice's match keys) carry `norm_version`. A migration that changes a
`norm.*` function must end with `perform norm.rebuild()`, which recomputes every stored key and reindexes (A17); a
change to `partner.name_stop_words` rebuilds name keys in the same request. `norm.drift()` lists any stored key that no
longer equals its recomputation; it must be empty (test and nightly job).

**Sources.** Each import source that carries partner clues exposes a keys view `(source_table, source_id, kind, key,
match_date)`; in v1 that is `finance.invoice_keys`: client ID (the row's own, else the one Payments client whose contact
email equals the row's email — ported from the ident branch, live), tax number (compared with both VAT and CR),
discount code (with the row's **booking date** — see V28), email, phone, both customer-name columns.

**The match — `partner.match` view** (one row per source row):

1. **Pin** (level 0): `partner.match_pin (source_table, source_id, partner_id, kind, reason)`, shown with a pin mark,
   logged and undoable, of two kinds:
   - `entry` — the partner a person picked while typing an invoice whose clues matched nothing. Anyone who may type
     the invoice may set it; the clue itself goes to **Needs a decision** as a *suggested identifier*, because adding an
     identifier moves money between people and needs `partners.identify`. Once someone accepts it, the invoice
     matches by itself and the pin is cleared in the same request;
   - `decision` — a manager's last resort for a true conflict.
   A pin whose invoice would now match a **different** partner without it is listed in `finance.health`.
2. **Unknown client ID** (V420): a row carrying a Payments client ID that no organisation holds stops here — state
   `unknown_client_id`, in Needs a decision; it never falls through to VAT, code, email, phone or name. A **closed**
   client ID (`closed_on`, V411) still matches rows whose booking date is on or before its close date.
3. For each level in `partner.match_order` (setting; default client ID → VAT/CR → discount code within its dates →
   email → phone → typed alias), find the partners holding a matching live identifier. Values under
   `partner.identifier_block` are ignored. An organisation's **official and trade names are never matching
   identifiers** (V421): they only *suggest* a match in Needs a decision; a name matches only as an alias a person typed,
   and an alias or a name exclusion acts only on a row with no client ID (V412).
4. **The first level that finds anything decides.** One partner → `matched`. Two or more → `conflict`, listing every
   candidate; nothing is guessed. At the discount-code level a live **campaign code** (V65) gives `campaign` — credited
   to nobody, listed apart. None at any level → `individual` if a name key is on the individuals list, else `none`.

Output: `(source_table, source_id, state, level, partner_id, campaign_code_id, candidates uuid[])`; states `matched` ·
`conflict` · `campaign` · `individual` · `unknown_client_id` · `none`. Finance exclusions are applied
separately (§3.6) — an excluded row still shows its partner.

**Needs a decision — `api.match_queue()`.** Rows in `none`, `unknown_client_id` or `conflict` grouped by customer
(same keys), each group with its row count, **the riyals at stake** (M52) and the organisations whose names resemble
the row's (a suggestion, never a match — V421). A person decides once per customer:

| Decision | Effect (one request, logged, undoable) |
|---|---|
| "This is client X" | adds the chosen clues from the group (default: the strongest — client ID, else VAT/CR, else email, else the name as a typed alias) as identifiers of X; every future row with those clues matches by itself |
| "New client" | creates the organisation with its Client side on and those identifiers |
| "Individual (not an organisation)" | adds the name to `partner.individual_name` (D25) |
| "Exclude" | opens the Finance exclusion rule form (reason required) |
| Conflict: "move identifier" / "merge A and B" / "pin these rows to A" | remove-and-add the identifier; merge; or pin with a reason (last resort) |

Staff emails and test rows never become identifiers: the block list refuses them at write time, and the queue never
proposes them. From P7, the Payments **corporate clients** import adds a matched client's IDs, names, VAT/CR, emails and phones
to its partner (source `import`, one request, undoable) and proposes a new partner for an unmatched one — it never
creates partners by itself (D17). The **promo codes** import only suggests a partner from its client name; a person
links the code.

### 3.6 Finance — the money model

**How money is shaped in Direct Payments** (the oversight's read-only sample of 28 Sep: about 25 invoices, 7 billing
invoices, 9 tax invoices — every reconcilable case matched):

- **The unit of revenue is the transaction.** A booking becomes a *transaction invoice*. Transactions are later
  gathered into a **billing invoice** (Payments marks it `is_consolidated`; each transaction then carries its
  `consolidated_proforma_id`, and its separate *B2B transaction status* reads `consolidation_invoiced`) — one
  transaction or many. A **standalone invoice** (no consolidation link either way) is its own unit. The B2B
  transaction status is kept in its own column and never read as the payment status: a transaction's payment status
  is its own *Invoice Status* (Fully Paid …), and its revenue date is its own paid date — or, when a billed
  transaction carries none, the paid date of its billing invoice.
- **Billing invoices are never revenue.** Transactions and billing invoices both show *Fully Paid* with their own
  receipts, so counting both would count the money twice. **Collections are settled on billing invoices** (and on
  standalone invoices).
- **Cost = the approved expenses on the transaction** (or on the standalone invoice). Expenses always hang on
  transactions, never on billing invoices. Invoice line names are **not** a reliable cost: in the sample, several
  products carry the markup inside the booking line, some carry the cost inside the fee line, and commissions have no
  cost at all (the examples stay in the oversight's notes, not in this public repository). The line-based
  figure stays only as a **flagged fallback estimate** (D23).
- **The tax invoice (DPIN)** is a child of the billing invoice (or of a standalone invoice) and equals its total
  minus the approved expenses — Direct's fee, with VAT on that margin. It is the **check**, never a figure in a total:
  - a transaction's cost is **Provisional** while any of its expenses is pending or none is registered (a
    commission-only invoice excepted), and **Final** once its billing (or own) invoice has a DPIN;
  - a DPIN equal to 100 % of the total on a non-commission product is flagged **"expenses missing"**;
  - a billing invoice's total must equal the sum of its transactions — any difference is flagged.
- VAT is never shown (M1); margin = revenue − cost **as recorded**.

This refines D21/D26 in one respect, recorded as **V1** in `docs/v2/DECISIONS.md`:
where the old app kept the numbered side of a one-to-one re-bill (D26), v2 counts the **transaction** and treats the
billing invoice as the zero-revenue link — the amount is the same; the month is the transaction's paid date, and the
billing invoice's dates are shown beside it (D26's "both dates shown" stays).

**How money enters v2.** At go-live the 2026 invoices are **typed in the browser** by the team (owner, 28 Sep —
decision 4), so every person and every flow is tested while the data is added; Payments file imports come in a later
phase (§3.11, P7). Both ways write the same fact tables; each row says which (`source`). An import later never touches
a hand-entered row (D21) — it lists the differences for a person, who may **adopt** the row (its `source` becomes
`import`, one logged and undoable request); from then on imports update it by the merge rules of §3.11, so late
statuses, paid dates and approved expenses still arrive (V50).

**Facts** (one home each; no revenue, cost, profit or VAT columns):

```
finance.invoice        STD SOFT; ref text unique not null (the Payments reference); kind ('transaction','standalone','billing',
                       'credit_note','wallet_topup'); customer_name; customer_name2; customer_email; customer_phone;
                       client_id_raw; tax_no_raw; discount_code_raw;
                       name_key; name2_key; email_key; phone_key; client_id_key; tax_key; code_key; norm_version;   -- match keys (§3.5)
                       status_raw (Invoice Status); status_id → finance.status_map; consolidation_status_raw (B2B transaction
                       status, e.g. consolidation_invoiced — never read as payment); created_on; generated_on; paid_on; status_at;
                       total_sar (as Payments records it); product (main product); branch; salesman_raw;
                       due_on date (V415: the invoice's own due date when typed or imported; null = the setting's fallback);
                       segment_id (V64: an override; null = the project's, else the partner's);
                       source ('manual','import'); src jsonb (per-field export time, imports only); first_batch_id; last_batch_id;
                       payments_as_of date not null (V401: the day the figures were read from Payments — typed: entered by
                       the typist, today by default; imported: the file's export time. Shown as "Payments · as of <date>")
finance.invoice_line   STD SOFT; invoice_id; line_no; product; name; qty; unit_price; discount_sar; taxable; total_sar
                       unique (invoice_id, line_no)
finance.billing_link   STD SOFT; billing_invoice_id → finance.invoice (kind billing); transaction_invoice_id → finance.invoice
                       (kind transaction) unique where live; source ('payments','person','proposal')
                       -- from consolidated_proforma_id when Payments gives it, else typed by a person; the old subset-sum
                       -- proposal (js/65) is kept only for imports that lack the field, and waits for a person's tick
finance.expense_line   STD SOFT; invoice_id → finance.invoice (kind transaction or standalone — never billing, trigger);
                       line_key unique (ref + expense type + created-at, for imports); expense_type; status ('approved',
                       'pending','under_review','cancelled','rejected'); status_raw; amount_sar (null while pending); merchant;
                       id_reference; created_at_src; submitted_at; decided_at; submitter; approver; source
finance.tax_invoice    STD SOFT; dpin text not null (unique — V417: a check that can be relaxed to (dpin, parent) if real
                       Payments data shows a DPIN repeating; the oversight looks once before P4-1 ships);
                       parent_invoice_id → finance.invoice (kind billing or standalone);
                       total_sar (as recorded — used only by the checks); issued_on; source
finance.receipt        STD SOFT; receipt_key unique; method; amount_sar; paid_on; ref_at_method; paid_by; notes; source
                       -- never revenue
finance.receipt_allocation  STD SOFT; receipt_id → finance.receipt; invoice_id → finance.invoice (billing or standalone —
                       collections); amount_sar > 0        unique (receipt_id, invoice_id) where live
                       -- V416: a receipt may be split across invoices; its allocations never exceed its amount (trigger);
                       -- a one-invoice receipt is one allocation; outstanding = total − allocated receipts
finance.payments_fact  ref pk; request_number; invoice_product; invoice_amount; invoice_status; invoice_type; expense_assignments;
                       overdue; created_by_src; created_on_src; rr_total_expense_sar; src; batch ids   -- later imports only (P7)
finance.payments_client  client_id pk; the 29 exported columns; contact_email_key; src; batch ids          -- later imports (P7)
finance.promo_code     code_key pk; the 13 exported columns (client name kept as a suggestion only); src; batch ids -- later (P7)
```

**Decisions and rules** (settings of the Finance group unless noted):

```
finance.status_map     LIST: status_key; maps_to ('paid','pending','draft','void','cancelled'); audit_required bool
                       -- starting words: Fully Paid → paid; Fully Paid (Audit Required) → paid + flag (the old app's bare "Paid" is
                       -- left out: the blueprint counts only Fully Paid, so a "Paid" is held until a person maps it); Pending, Pending Payment,
                       -- Partially Paid → pending; Draft; Void/Voided; Cancelled/Canceled. An unknown word on import → held (D21)
finance.product        LIST: the Payments products (Direct Flights, Direct Hotels …), each → a service (D24) and a
                       commission flag; the manual entry form offers this list
finance.wallet_rule    kind ('product','name_contains'); value            -- identifies wallet top-up lines (MF7)
finance.commission_word  word                                              -- a line naming it makes the invoice a commission
finance.service        LIST + counts_as_income bool                        -- D24 main services
finance.item_service   item_head_key unique → service_id                   -- D24 override on the FIRST part of a line name
finance.item_class     item_tail_key unique; class ('pass_through','fee')  -- D23, the LAST part — the fallback estimate only
finance.exclusion_rule STD SOFT; kind ('client_id','name','tax_no','discount_code','invoice','product','partner'); value_raw;
                       value_key; mode ('exclude','hide'); reason not null      unique (kind, value_key) live (D16; 'hide' = MF5)
                       -- V412: a 'name' rule applies only to rows carrying no client ID; V413: a 'tax_no' rule excludes every
                       -- row matched to the organisation holding that VAT/CR, under any of its IDs, codes or names
finance.receivable_flag STD SOFT; invoice_id (billing or standalone); kind ('sent_to_legal'); flagged_on date; note not null
                       -- V70: shown as a chip in Collections and on the partner card; still in outstanding
finance.credit_split   STD SOFT; invoice_id; person_id; share numeric(7,6); note not null
                       -- shares of an invoice sum to 1 within 0.000001; the credited amounts are rounded to the halala and any
                       -- remainder goes to the first person, so three equal shares add up exactly
```

**Views — every money figure in the app comes from these (§1a):**

| View | What it says |
|---|---|
| `finance.invoice_fact` | per invoice: kind (a top-up detected from wallet lines is confirmed as `wallet_topup`); status via `status_map`; line total; pass-through / fee / unclassed line sums (D23); commission flag (product list or commission word); the billing invoice it belongs to (for a transaction) or its transactions (for a billing invoice); its DPIN; **revenue date** = paid date (else created) |
| `finance.invoice_cost` | for a transaction or standalone invoice: approved = sum of **approved** expenses, **null when none** (empty, never 0 — D21, MF1; on screen and in every export too, OA4 — V428); pending count; estimate only when approved is null and not a commission: the Revenue Report expense total once imports exist, else the pass-through lines (D23), always flagged; `cost_basis` ∈ approved · submitted_estimate · line_estimate · commission · none; **cost status** Provisional / Final (rules above) |
| `finance.money_row` | one row per revenue unit (a transaction or a standalone invoice): partner, match state and level (§3.5); segment (V64); **payment type** (V87) — the subkind of the partner client ID the invoice carries (prepaid · postpaid · tender), else **code** when it carries a discount or campaign code, else none; month and quarter of the revenue date; **revenue** = total − wallet part (D21) for a paid unit; cost, estimate (apart and flagged — **no "profit with estimates" figure exists**, V419), margin = revenue − cost where cost is known, as recorded (V51; **negative when cost is above revenue, and the unit is flagged Loss** — V414) (a commission's margin is its revenue) — **the main margin figure counts only units whose cost is Final; Provisional margins are shown apart** (the old M9 "one pending transaction holds back the whole invoice", carried as cost status); counts = paid and not excluded; excluded/hidden with rule and reason; audit-required flag; cost status. **Billing invoices, credit notes and wallet top-ups never appear as revenue units; a credit note never reduces revenue in v1** (V423) |
| `finance.money_service_row` | D24: each counted unit's lines to one service (item map, else the product's service, else "No service yet"); lines of "not income" services shown on their own row, never in a service's sums; the rest of the difference to revenue under "Not split by line", so services + not income + not split = the revenue tile and nothing hides; approved cost split by line share, the estimate by pass-through share |
| `finance.credit_row` | counted unit × person × share: a credit split if present, else the partner's account manager **on the revenue date** (V27), else nobody ("uncredited", shown) |
| `finance.receivable` | collections: billing and standalone invoices not void/cancelled/draft, **through the same exclusion rules as `money_row`** (a hidden row never appears; an excluded one is listed apart, never in outstanding — D16, MF5); outstanding = total − allocated receipts (V416); **due** = the invoice's own `due_on` when it has one, else created date + `finance.collection_due_days`, and each row says its `due_basis` (invoice · setting · payments — Payments' own overdue flag preferred once P7 brings it, V415); ageing 0–30, 31–60, 61–90, 90+, no date, dated in the future; **days to pay** = paid date − created date of each paid unit, averaged per client and overall (V401) |
| `finance.check` | the reconciliation, per billing or standalone invoice: billing total vs sum of its transactions; DPIN total vs (total − approved expenses of its units) within 1 SAR; DPIN = 100 % of total on non-commission → "expenses missing"; expenses entered on a billing invoice (refused at write, listed if imported); transactions with no billing invoice after N days (setting) |
| `finance.partner_month` | partner × month: revenue, cost, estimate, margin, counted units, outstanding |
| `finance.partner_credit` | V70: per partner, the credit limit in force (with who approved it) and outstanding against it |
| `finance.partner_wallet` | V70: per partner, paid wallet top-ups − the wallet part of its counted invoices = the prepaid balance |
| `finance.sales_by_code` | V65: discount or campaign code × month: counted units, revenue, profit, the partner or campaign, the terms in force |
| `finance.quiet_client` | V401: organisations with the Client side Active and no Fully Paid invoice in `finance.quiet_client_days` (60) — the alert `alert_quiet_client` to the account manager, the row chip Quiet |
| `finance.not_invoiced` | V424: the Overview line **Not yet invoiced: Ready / Pending** — units not yet paid, **never in revenue** (only paid units count — V418): Ready = status maps to `draft`, Pending = status maps to `pending`; the oversight may re-point the feed (a one-line change) |
| `finance.health` | what is held back or doubtful, by reason, with the riyals at stake (M48, M52): unknown statuses, excluded/hidden rows, units with no partner or with an unknown client ID (V420), cost missing, estimates in use, Provisional units, **Losses** (V414), failed checks |

**"Commercial revenue" is a setting** (`finance.revenue_definition`, effective-dated): basis (revenue as above — the
default — or margin), which services, which partner categories, whether commissions count. The structure is built
now; **its value is decided at go-live** (owner, 28 Sep — decision 3), and nothing waits for it. The KPI source
`finance.commercial_revenue` reads it as of each month, so a changed definition recalculates every KPI, report draft
and appraisal that uses it (§1a example 6). The screen words are the owner's — **Revenue · Cost · Profit** (V73; a wording setting, `core.wording`); code keeps
`revenue` and `margin`, and the KPI sheet may call revenue GMV where the strategy sheet does.

**Ported rules that the tests must pin down:** a unit counts only when paid (Audit Required counts, flagged — MF10 read
as "only paid units count", V418) · credit notes never count and never reduce revenue (V423) · wallet top-ups never
revenue (MF7) · VOID never counts (MF9) · billing invoices never revenue; collections measured on them · cost empty
until an approved expense exists; the estimate always flagged and never in cost or margin · never estimate a commission
· income by service adds up to the revenue tile · VAT never stored or shown (DPIN totals only feed the check) ·
exclusions win over everything and apply to past rows at once (D16) · verification products are a `hide` rule typed by a
person, never a silent skip (MF5; nothing is lost).

**Known faults in the old code, fixed by design:** receipts read without paging (A7); `Voided` left in outstanding (the
status map decides everything); twin pairing only inside one 5,000-row batch (v2 links from Payments' own
`consolidated_proforma_id`, or by a person); client IDs and codes never filled from the invoice file (v2 keeps them
whenever given and derives the client ID from the contact email once the clients list is imported); approved cost
stranded on an invoice later marked as a billing link (impossible now: expenses are refused on billing invoices).

### 3.7 Projects and tasks

```
work.project_status  LIST + category ('planned','active','on_hold','done','cancelled')
work.project         STD SOFT DEPT; number unique; name not null; partner_id; owner_id not null; status_id; start_on; due_on;
                     closed_at; description; segment_id (V64: an override; null = the partner's)
work.project_invoice (project_id, invoice_id) pk; linked_by; reason       -- revenue and cost read from the linked invoices
work.task_status     LIST + meaning ('not_started','in_progress','done','cancelled') — four locked meanings, editable names
                     (V401; the seed: Not started · In progress · Done · Cancelled); is_default
work.priority        LIST + rank
work.ref_system      LIST + url_template      -- Direct system references (booking, invoice, ticket); the URL pattern is a setting
work.task            STD SOFT DEPT; number unique; title not null; notes; owner_id not null; team_id not null (active team, D11);
                     priority_id; status_id; start_on; due_on; partner_id; project_id;
                     origin ('manual','template','period_target','meeting','next_step','alert','backfill'); template_id;
                     period_target_id; assigned_by (set when owner ≠ creator); closed_at; closed_by;
                     happened_on date not null (V400: the day the task was raised; default Riyadh today, any past date,
                     never after the logged day); logged_at timestamptz not null default now();
                     blocked_reason text (V401: set while In progress = Blocked; required); blocked_on date
                     -- trigger: a task's partner equals its project's partner when both are set
work.task_helper     (task_id, person_id) pk; added_by; added_at
work.action_item     STD SOFT; task_id; text not null; owner_id not null; due_on; done_on date (V400: the happened_on of its
                     completion); done_by; happened_on date not null; logged_at timestamptz not null; sort; source_note_id → core.note
work.action_item_helper (action_item_id, person_id) pk
work.task_ref        STD SOFT; task_id; system_id; value not null        unique (task_id, system_id, value)
work.task_contact    (task_id, contact_id) pk
work.task_invoice    (task_id, invoice_id) pk
work.task_kpi        (task_id, kpi_id) pk
work.task_template   STD SOFT DEPT; title; notes; owner_id; team_id; priority_id; partner_id (one partner) or
                     for_each ('key_partner') — one task per key partner, owned by its account manager (V72);
                     checklist jsonb [{text, owner: 'task_owner'|person_id, due_offset_days}];
                     rule jsonb {freq: weekly|monthly|quarterly|yearly, interval, weekdays, month_day, lead_days}; starts_on; ends_on; active
work.task_occurrence (template_id, occurs_on, partner_id) pk; task_id    -- makes generation idempotent
work.task_status_change  STD; task_id; from_status_id; to_status_id; happened_on date not null; logged_at timestamptz not null;
                     reason (required when blocking)   -- V400: the Done change's happened_on is the completion date
work.project_health  STD; project_id; health ('on_track','at_risk','off_track'); line text not null; happened_on date not null;
                     logged_at timestamptz not null      -- V401: the health chip and its one-line update; the latest row shows
```

- The **timeline** is `core.note` on the task: `update`, `meeting_note` (with its meeting date) and `comment`, each with
  @mentions and its own `happened_on` (V400). `api.task_add_meeting(task, date, body, items[])` adds the note and its **assigned action items** in one
  request.
- **Views.** `work.task_view` adds last activity (the latest `happened_on` of a note, action item or status change),
  `stale` (in progress and no activity for `work.no_update_days`, judged on `happened_on`), `overdue` (due before Riyadh
  today and not done) and open action item counts — **flags are judged today only**: an entry dated in the past
  raises no notice and no overdue or no-update flag for the past (V400). `work.my_work(person)` = tasks I own ∪ tasks where I own an action item ∪ tasks and action items
  I help on — the blueprint's "My work". Board and calendar read the same view.
- **The dates rule** (V400). Every task, status change, action item, note and activity carries **`happened_on`** (the
  day it happened — default Riyadh today, any past date allowed, never after the day it is logged) and **`logged_at`**
  (set by the database). Weeks, months, quarters, task time (raised → done), the on-time measures and the appraisal read
  `happened_on` — **never `created_at`**. **Logged late**: after go-live (`app.go_live_on`), an entry whose `logged_at`
  day is more than `work.late_days` (14) after its `happened_on` is marked "logged late" (a computed flag, shown on the
  entry) and counts against the on-time appraisal items; entries with `happened_on` before go-live are never late, and
  `backfill` entries (the Past work grid, §3.11) are marked **Backfilled** and raise no notice.
- **Blocked** (V401): a task In progress may be marked Blocked with a required reason (`blocked_reason`, `blocked_on`;
  cleared when work resumes); the board and the list show a Blocked chip inside In progress; it is a status change with
  its own `happened_on`.
- **Files on tasks** (V401): `core.file_link` with purpose `attachment`; the task's Related tab and Overview list them
  under their computed names (V55).
- **Project health** (V401): `work.project_health` — On track · At risk · Off track with a **one-line update**; the
  latest row is the project's chip; a project with no health update for `work.project_update_days` (14) gets the
  `alert_project_no_update` reminder to its owner (the alerts job, judged on `happened_on`).
- **Who does what.** Anyone with Own on Tasks creates their own tasks and adds helpers; assigning to someone else needs
  the capability `tasks.assign` (managers, admins — §3 "managers/admins assign"); helpers add notes and tick their
  own action items.
- **Recurring tasks.** `pg_cron` at 00:05 Riyadh (the schedule is in UTC: `5 21 * * *`) runs `work.generate_recurring(core.riyadh_today())`; each occurrence
  is created once (`task_occurrence`), attributed to the template's creator with a `job` request naming the template —
  a record made on a person's standing instruction (D17's spirit). The starting template **Partner feedback** runs
  monthly for each key partner (V72); closing it asks for the feedback note, which sets the partner's last feedback
  date. The starting one-off template **Corporate onboarding** (V89) is a checklist owned by the account manager —
  agreement signed and stamped · account set up · travel policy received · Operations briefed · first request — offered
  (a person presses it) when an organisation's Client side is switched on or its partnership opportunity reaches
  Signed (V99). The starting recurring template **Quarterly business review** (V401) runs each quarter for each key
  client, owned by the account manager, with a checklist (figures reviewed · issues · next quarter's plan).
- **Team load** (V91): `work.team_load` — per person: open tasks, overdue, open action items, partners owned (account
  manager) and prospects assigned. It shows beside the person picker in every assign dialog (a task, an action item,
  the partners' bulk assign) and as a **Team load** view on Tasks for managers.
- **Closing a task** (`api.task_close`) asks what to do with open action items (close them too, or keep the task open),
  and the screen then offers "Log the achievement", prefilled from the task (partner, project, participants = owner and
  helpers, source task). Nothing is created without the person pressing it (§3 "closing a task offers").

### 3.7a Pipeline — tenders and partnership opportunities (V80)

Added to v1 (owner, 29 Sep). One **Pipeline** page with two boards — **Tenders** and **Partnerships** — plus list views.

```
pipeline.stage        LIST per kind ('tender','partnership'); meaning — locked, editable names (V97, V99); optional bool; sort
                      -- tender meanings: identified · preparing · submitted · awarded · lost · cancelled
                      --   (seed: Identified → Preparing → Submitted → Awarded / Lost / Cancelled — V80)
                      -- partnership meanings: open · signed · onboarded · lost (seed, V99: Contacted → Demo → Proposal
                      --   (optional) → Signed → Onboarded; Lost). A skipped optional stage is never recorded as passed
pipeline.source       LIST (V99: an admin list — referral · event · inbound ticket · outbound · tender portal …)
pipeline.lost_reason  LIST per kind
pipeline.tender       STD SOFT DEPT; number unique (TND-2026-014); title; partner_id not null (the government entity —
                      a Government-segment partner; another segment needs a manager and a reason); etimad_ref; tender_no
                      (the entity's own number); submission_due_on; submitted_on; value_sar; awarded_value_sar; awarded_on;
                      stage_id; owner_id; source_id → pipeline.source not null (V99); project_id; lost_reason_id; notes
                      -- files: core.file_link purpose 'tender'
pipeline.opportunity  STD SOFT DEPT; number unique (OPP-2026-031); title; partner_id not null; side ('client' | 'supplier_partner')
                      and type_id → partner.side_type (what the deal makes the organisation: a client of a segment, or a
                      supplier & partner of a type — V98); stage_id; owner_id; source_id not null (V99);
                      ticket_ref text (a lead's ticket number in Direct's ticket system — V99); expected_value_sar;
                      next_step; next_step_on; signed_on; onboarded_on; lost_reason_id; notes
pipeline.stage_change STD; entity_table; entity_id; from_stage_id; to_stage_id; happened_on date not null (V400); logged_at;
                      note   -- the history the KPIs read; moving past a required stage records each stage passed, on the
                      -- same date; an optional stage skipped is not recorded (V99)
```

- **Moving a card** (drag on the board, or the stage field) is one request with its `happened_on` (today by default,
  any past date). **Submitted** records `submitted_on`; **Awarded** needs the awarded value and date and offers **Log
  achievement** (Contract signed, prefilled with the tender) and **New project**; **Lost** and **Cancelled** need a
  reason. A partnership reaching **Signed** records `signed_on`, offers Log achievement and the Corporate onboarding
  checklist (V89); reaching **Onboarded** records `onboarded_on`, switches the organisation's side on if it is not, and
  sets that side's status to **Active** from that date (V99) in the same request — one Undo reverts all of it. **Every
  card needs a Source** (V99). **No Leads module in v1** (a Leads inbox may come later if volume needs it — V99): a
  lead from the corporate landing form is a ticket in Direct's ticket system; an opportunity carries its ticket number,
  nothing more.
- **Measures** (§3.8): `pipeline.tenders_submitted` — tenders whose history reached Submitted with an effective date in
  the period (a later Lost still counts); `pipeline.awarded_value` — the sum of awarded values of tenders awarded in the
  period (by `awarded_on`); `pipeline.tenders_by_stage` and `pipeline.opportunities_by_stage` (the funnels: count and
  value per stage, as of a date); `pipeline.partnerships_signed` and `pipeline.partnerships_onboarded` (V99). Government entity contracts is the Contract signed
  category with a Government-segment partner (§3.8). Every measure takes the `segment` parameter (V64).
- **The Commercial overview** (`/overview`, executive): Revenue · Cost · Profit, collections, new clients, tenders
  submitted, awarded value, partnerships signed, government entity contracts — for a period (MTD · QTD · YTD · Custom)
  against last year — then **both funnels**, and a **segment switch** (All · Government · Corporate · Agencies ·
  Individuals) that filters every tile and funnel. It replaces the old app's separate Finance, B2B and Tenders
  overviews; each tile links to the list behind it.
- A tender or opportunity shows on its partner's card (Work tab) and in Ctrl K; a file kind **Tender document** has the
  pattern `Tender · {partner official} · {tender no} · {date}`.

### 3.8 Yearly plans, KPIs, achievements, challenges, period targets

```
perf.unit            LIST + kind ('money','count','percent','score','duration','rating')
perf.plan            STD SOFT DEPT; year int; name; status ('draft','active','closed'); copied_from_plan_id; activated_at; closed_at
                     unique (department_id, year) where deleted_at is null
perf.objective       STD SOFT; plan_id; code ('O1'); title_en; title_ar; description; perspective; strategic_link; sort
perf.kpi             STD SOFT; plan_id; code ('K07'); sort;                 -- identity only; renumbering is logged
                     copied_from_kpi_id                                    -- continuity across years
perf.kpi_rev         id; kpi_id; effective_from date not null; objective_id; title_en; title_ar; description;
                     type ('number','money','percent_score','checklist','tracked');
                     unit_id; direction ('higher','lower'); source ('computed','achievements','manual');
                     measure_key → perf.measure_def; measure_params jsonb; aggregation ('sum','latest','average');
                     cumulative bool default true; base_year; baseline; achieved_before (achieved up to the previous year);
                     pace_bands jsonb (null = the plan's `perf.pace_bands` — V401); strategy_ref; support_tickets text[]; reason; set_by; set_at
                     unique (kpi_id, effective_from)                        -- mid-year definition changes (§5a)
perf.kpi_target      id; kpi_id; period_kind ('month','quarter','year'); period_start date; value numeric;
                     effective_from date not null; reason; set_by; set_at
perf.kpi_lead        (kpi_id, person_id) pk
perf.kpi_contributor id; kpi_id; scope ('department','team','person'); scope_id
perf.kpi_reading     STD SOFT; kpi_id; period_kind; period_start; value numeric; passed bool (checklist);
                     happened_on date not null (V400: the reading's date — it decides the period); logged_at timestamptz not null; note
                     -- V93: written by the KPI's leads (and managers with Full on KPIs); on `perf.kpi_checkin_day`
                     -- (default the 15th) each lead of a manual KPI with no reading for the month gets 'alert_kpi_checkin'
                     -- manual and percentage/score KPIs; evidence via core.file_link. Also last year's monthly figures of a
                     -- computed KPI, typed once and used only for months its source has no data for, shown as "typed" (V31)
perf.kpi_status_note STD; kpi_id; quarter_start; status ('on_track','slightly_behind','at_risk','critical','exceeded','pending');
                     note; noted_on                                          -- the status a person declares for the strategy sheet
perf.measure_def     key pk; unit_kind; params_schema jsonb; scopes text[]; label_key           -- synced from the registry
perf.achievement_category  STD SOFT; plan_id; parent_id (sub-category); code; name_en; name_ar; is_money_link bool;
                     line_template_en not null; line_template_ar not null (V76: the Arabic sentence filled from the
                     category's fields, so a report line drafts itself in Arabic); sort; active
perf.category_field  STD SOFT; category_id; key; label_en; label_ar; type ('text','number','money','amount','date','select',
                     'person','partner','boolean','computed'); required; options jsonb; formula (computed only: arithmetic over
                     the category's number and amount fields, e.g. exposure − actual_loss); sort
                     -- 'amount' = a typed SAR figure that is NOT Finance money: labelled "not revenue", never in Finance,
                     -- never on a money KPI (V66; the check below refuses the mapping)
perf.category_kpi    id; category_id; kpi_id; contribution ('count','field_sum'); field_key; condition jsonb; effective_from; effective_to
                     -- condition: only achievements whose field matches, e.g. {"field":"integration_type","in":["api"]} —
                     -- how "a promo-code-only partnership is not a technical-integration KPI" (§3) is kept without code
perf.achievement     STD SOFT DEPT; plan_id; category_id; partner_id; project_id; source_task_id; service_id → finance.service;
                     title (the person's short words); count int default 1; before_value; after_value; field_values jsonb;
                     happened_on date not null (V400: the date on the evidence — e.g. the signing date on the agreement;
                     it decides the month and quarter; never after the logged day); logged_at timestamptz not null;
                     period_moved_from date; period_move_reason; period_moved_by (V400: a manager or admin moved it into the
                     previous period — the "moved" mark); owner_id not null; use_as_example bool (V67: a report "Case");
                     origin ('person','task','report','import','backfill'); origin_report_id (V79: "added from report"); remove_reason
perf.achievement_ref  STD SOFT; achievement_id; system_id → work.ref_system; value not null; url   -- V99: a Direct ticket or
                     booking reference with its link is evidence, beside files
perf.achievement_participant (achievement_id, person_id) pk; role
perf.achievement_invoice     (achievement_id, invoice_id) pk
perf.achievement_kpi_adjust  id; achievement_id; kpi_id; mode ('include','exclude'); period_month date (for an include:
                     the month it counts in — defaults to the evidence month; set for a re-mapping into a new plan's year);
                     reason not null
perf.challenge       STD SOFT DEPT; title; details; partner_id; supplier_name; owner_id; opened_on; resolved_on; resolution;
                     critical bool; escalated_to → core.person; escalated_on date      -- V69
perf.period_target   STD SOFT DEPT; period_kind ('month','quarter'); period_start; text; owner_id; task_id not null;
                     written_in_report_id → report.report
```

**Plans (§5a).** A plan belongs to a department and a calendar year. `api.plan_copy(from, year, what)` copies
objectives, KPIs (keeping `copied_from_kpi_id`), their latest revisions (effective 1 January), leads, contributors,
categories, fields and mappings — targets optionally. Everything is then renamed, renumbered, regrouped or removed in
the browser. An achievement belongs to the plan of its `happened_on` year (V400) (trigger; no plan for that year → refused
with "no 2027 plan yet"). Old years keep their structure: a 2026 report or appraisal reads the 2026 plan and the
revisions in force then. Carrying a 2026 achievement to a 2027 KPI is an `achievement_kpi_adjust` of mode include,
with a reason — a logged person action.

**KPI values** (never stored):

1. The revision in force for a month is the latest `kpi_rev` with `effective_from ≤` the month's end.
2. Month value by source:
   - **computed** — the measure's function (key `finance.revenue` → `measure.finance_revenue`) with
     `(params, 'department', plan.department, month start, month end)`;
   - **achievements** — the sum of contributions (`count` × achievement count, or the sum of a field) of achievements
     whose `happened_on` is in the month and whose category maps to the KPI **by a mapping in force on that
     date**, plus includes whose `period_month` is this month, minus excludes, removed ones left out;
   - **manual** — the readings for that month (or the quarter reading).
3. Quarter and year to date by aggregation: `sum` — the sum of the months (year to date = the running sum); `latest`
   (percentage/score KPIs) — the latest reading in the period; `average` — the average of the **measured** months only,
   saying how many (M39).
4. Target for a period **as of a date** = the latest `kpi_target` for that period with `effective_from ≤` the date;
   a year target is explicit, else the sum of the quarter targets (`sum` KPIs).
5. **Pace** (ported from the d27 plan): what is due = the targets of past quarters in full plus the current quarter's
   target pro-rated by Riyadh days passed; ratio = year-to-date ÷ due (inverted for lower-is-better). Status: **Exceeded** (year target
   reached) · the **pace bands** (V401) **On track** (ratio ≥ on_track) · **At risk** (≥ at_risk) · **Behind** (below) ·
   **Not measured** (no target, not started, or nothing measured). A non-cumulative KPI is judged per quarter; a `latest`
   KPI compares its latest figure with the current quarter's target (the d27 rule). The bands' thresholds are a **plan
   setting** (`perf.pace_bands`, default on_track 1.00 · at_risk 0.85), overridable per KPI revision; the KPI-behind
   alert fires on Behind.
6. **Not measured ≠ 0.** A manual KPI with no reading, or a ratio with nothing to divide (no action items were due),
   returns `measured = false` and is shown as "—, not measured", never 0. A count of achievements is a real 0 once the
   period has started.

Views: `perf.kpi_month`, `perf.kpi_quarter`, `perf.kpi_ytd`, `perf.kpi_pace`, `perf.kpi_partner_quarter` (a partner's
contribution to each KPI by quarter, for the partner card); function `perf.kpi_trace(kpi, from, to)` returns the
achievements or invoices behind a figure with their partner and evidence file (the KPI page's drill-down, §1).

**Measures in v1** (each a SQL function `measure.<module>_<name>(params, scope_kind, scope_id, from, to)` — the registry
maps the dotted key to it — returning
`(value, measured, n)` plus a `_items` twin for drill-down; scopes are department, team, person, partner):
`finance.revenue` · `finance.commercial_revenue` (the setting) · `finance.margin` (says how much of the revenue had a cost)
· `finance.new_client_revenue` (partners whose first counted unit falls in the period and whose `client_since`, if
typed, is not earlier) · `finance.collected` ·
`partner.new_clients` · `perf.achievements` (categories as parameters; person scope = owner, or owner and participants)
· `perf.kpi_attainment` (params: a KPI **code**; value = the KPI's figure over the period ÷ its targets over the same
period as of the evaluation date — quarter targets pro-rated by the months inside the period; each month read from the
plan of its own year, the KPI matched by code; for appraisal items tied to a department KPI) ·
`work.tasks_on_time` · `work.action_items_on_time` · `work.weekly_updates` · `work.meeting_notes_on_time` ·
`report.on_time` · `work.pipeline_updates` (V63: per person per week, task updates + logged calls; a week counts when it
reaches the appraisal item's weekly target, default 1) · `partner.calls` (by outcome) · `partner.demos` (V88: calls with outcome demo set or demo held, per person per
week) · `partner.at_risk` (partners
turned at risk or lost, by reason) · `perf.escalations` (V69) · `pipeline.tenders_submitted`, `pipeline.awarded_value`, `pipeline.tenders_by_stage`,
`pipeline.opportunities_by_stage`, `pipeline.partnerships_signed` (V80, §3.7a). Every finance, pipeline and achievement
measure takes an optional `segment`
parameter (V64). Person scope on finance measures uses `finance.credit_row` shares. Measures name achievement
categories by their **code**, which plan copies keep, so an April–March appraisal cycle counts the same category in
both calendar years' plans.

**Achievements.** Stored as fields and rendered as one line by **one** function, `perf.achievement_line(id, locale)`,
from the category's line template — the list, the KPI drill-down, the report suggestions and the exports all call it.
A money-link category ("revenue and bookings") has no amount field: its amount is the sum of the linked invoices' revenue
from `finance.money_row`, counted once per invoice however many achievements cite it; money KPIs never read
achievements (a check refuses a `field_sum` mapping of a money or amount field onto a money KPI). No approval step: the owner and
participants edit their own; a manager (Full on KPIs) corrects, moves or removes anyone's with a required reason. **Moving into the previous period** (V400): a manager or
admin may set an achievement's `happened_on` back into the previous month or quarter, with a reason; the achievement
carries a "moved" mark (from, by, why) and the KPIs of both periods update. **Evidence** (V33, V68, V99) is a file or a
Direct reference with its link; an achievement with neither is "no evidence yet".

**Starting categories with their own fields** (V66; all settings, as the canvas's KPI artboard; example values in
tests are made up):

- **Problem solving** and **Cost savings**: exposure (amount at risk), actual loss (amount), avoided (computed =
  exposure − actual loss), counter-party (partner, or text), story (one line). Typed amounts, never Finance money,
  never feeding a money KPI.
- **MoU / strategic signing**: counter-party (partner), their signatory and title, our signatory (person), event,
  signing date, announced (yes / no), government or private. It **never counts as a new client** (`partner.new_clients`
  reads Finance only); logging it sets the partner to **Prospect** from the signing date unless it is already Active
  (one request, reason "MoU signed").
- **Awards**: an optional entry cost (amount).
- **Technical integration** (V99, V407): the partner (Supplier & partner side, type Integration), the **Direct ticket
  number** of the Product ticket (a `perf.achievement_ref` on the ticket system — the evidence, required: without it the
  achievement is not saved), `happened_on` = the **handover to Product** (the ticket raised), which is when it counts;
  `go_live_on` recorded later on the same achievement and never counted again; a tracked-only KPI follows go-lives.
- **Supplier cashback** (V90): the supplier (an organisation with the Supplier & partner side on), the amount received (amount — never
  Finance money, never on a money KPI), the date received (the evidence date: dated by receipt), a reference.
- **Contract signed** (V80): counter-party (partner), the contract (link), signing date, value (amount, optional — not
  revenue), the tender it came from (link, optional). "Government entity contracts" counts these with a
  Government-segment partner, tender or not (`perf.achievements` with the `segment` parameter).

**Challenges** stay open until resolved; their age is computed; a report lists every challenge open at its period's
end — so they carry over without retyping (§10). A challenge has its own record page (V95, V401: header figures — age,
escalations, linked tasks; type tab Resolution) and the Escalate action (§3.3). A **critical** challenge records who it was escalated to and when
(V69); `perf.escalations` counts them for the appraisal item "documenting and escalating critical client feedback".

**Next-month (and next-quarter) targets.** Writing a target in a report creates a `perf.period_target` **and its task**
(owner named, due the period's last day, origin `period_target`) in one request. The next report shows each as
**done** (task done by the period's end) or **carried over** (still open, with its age) — the task itself stays on
the owner's My work.

### 3.9 Reports

```
report.section_def   key pk; kind ('cover','kpi_tiles','kpi_month_additions','kpi_results','achievements_by_category','challenges','period_targets',
                     'operational_plan','revenue_by_service','cases','partners_at_risk','added_to_earlier_periods','free_text');
                     params_schema; label_key                                   -- synced from code
report.template      STD SOFT DEPT; kind ('monthly','quarterly','yearly'); sections jsonb [{key, title_en, title_ar, params}];
                     print_languages text[] default '{ar}' (V76, V403); effective_from          -- "sections are a setting"
report.editor        (department_id, person_id) pk                          -- named report editors
report.reviewer      (department_id, person_id) pk                          -- optional reviewers (the canvas's "Submit for review")
report.report        STD SOFT DEPT; kind; period_start; period_end; plan_id; template_id; status ('draft','in_review','issued','superseded','legacy');
                     number; issued_at; issued_by; supersedes_id → report.report; correction_note; snapshot jsonb; snapshot_sha256;
                     legacy_tiles jsonb (a legacy report's headline figures, typed when it is loaded, so it can be compared);
                     legacy_pages jsonb (section_key → page of its PDF)
                     unique (department_id, kind, period_start) where status = 'issued'
report.line          STD SOFT; report_id; section_key; kind ('achievement','note') not null (V79); category_id; text_en;
                     text_ar (V76; at least one); text_ar_draft bool (the Translate helper's draft, until the editor edits or
                     confirms it); sort; show_amount bool (note lines: always false, no citations — check);
                     amount_source ('invoices','field'); amount_field_key (V67: a non-money amount summed from a field of
                     the cited achievements, e.g. avoided — shown labelled "not revenue")
report.search_doc    report_id; section_key; line_id; tsv tsvector   -- V67: issued snapshots and their lines, `simple`
                     -- configuration over norm.fold text, entity tokens kept as ids; rebuilt at issue
report.line_achievement (line_id, achievement_id) pk
report.line_invoice  (line_id, invoice_id) pk
report.render        id; report_id; format ('pdf','pptx'); file_id; snapshot_sha256
                     -- a 'legacy' report has no snapshot: its issued PDF is linked here (kind legacy_report), marked "Legacy PDF"
```

- **A draft is live.** Every section is computed when opened: **each KPI's addition this month to its quarter**
  (`kpi_month_additions` — §3 "the monthly report shows each month's addition"), tiles (the chosen KPIs or measures for the period and
  the same period last year — "not measured" when last year has no data), achievements by category, challenges open at
  period end, period targets done/carried, the operational-plan indicators (checklist KPIs: done / carried over),
  revenue by service. `report.draft_suggestions` lists achievements of the period that no line cites yet.
- **The two report kinds** (one tab row on the Reports page: Monthly · Quarterly). The **monthly** template's sections:
  cover · each KPI's addition this month · this month vs the same month last year (tiles) · achievements by category ·
  challenges · next-month targets. The **quarterly** template's: cover · quarter vs the same quarter last year (tiles) ·
  achievements by category (lines linking to their achievements, partners and invoices) · **KPI results**
  (`kpi_results`: target, M1, M2, M3, quarter, year to date, status) · challenges (open and carried over; resolved this
  quarter) · next-quarter targets · operational-plan indicators (Done / Carried over). Both are settings; these are the
  starting templates.
- **Two kinds of line** (owner, 29 Sep — V79). **Any claim of work done is an Achievement line.**
  - **Achievement line**: cites one or more achievements (and invoices), or is **typed in the report and creates its
    achievement** in the same request (`api.report_add_achievement_line`: category, date, person, the category's
    fields; evidence optional → "no evidence yet", V33), marked **added from report** (`origin 'report'`). The
    achievement counts **once** in KPIs and appraisal however many lines cite it (appraisal still needs its date and
    evidence — V68). Its amount is the sum of the **distinct** invoices cited directly or through cited money-link
    achievements (or a labelled non-money field, V67). Citing an existing achievement never changes it.
  - **Note line**: commentary only — never counts, cites nothing, carries no amount or count; a note whose text holds
    a money figure (a number with SAR / ريال / ر.س) is refused with "use an Achievement line".
- **Arabic by default, English on request** (V76, V403). Lines draft themselves in both languages from the category's
  line templates and its Arabic labels. Staff write free text in **either language**; a **Translate** button uses the
  browser's built-in on-device Translator API (Chrome; free, nothing leaves the device) to draft the other language,
  marked Draft until the editor corrects or confirms it; the button is hidden where the API is unavailable. No paid
  translation service is used. **Reports print in Arabic**: issuing refuses a line with no text in a language the
  template prints (`report.template.print_languages`, default Arabic only), so every issued line has its Arabic. An
  **English copy** of an issued report is rendered on request from the same snapshot, from each line's English text; a
  line with no English prints in its Arabic. Arabic reports do not wait for the Arabic interface (P6-7), and their PDF
  and PPTX paths and the translator's quality are proven early by the P3-10 spike (V86, builder C); if the translator's
  drafts are judged unusable there, the button stays hidden.
- **Review (optional, a setting per template).** An editor may submit a draft for review (`status 'in_review'`); a
  reviewer returns it with comments or approves it for issue. With review switched off, editors issue directly.
- **Issue.** `api.report_issue(id, version)` builds the snapshot (every section's rendered text and figures, the plan
  structure and targets as of the issue date), stores it with its SHA-256 and a number (`<dept>-M-2026-09`,
  corrections `-C1`), and sets `issued`. The snapshot **is** the frozen report; PDF and PPTX are rendered from it in the
  browser, any time, identically.
- **After issue**, data can still be corrected (with a reason when the record's month has an issued report — V36);
  `report.drift(id)` shows which figures now differ. `api.report_correct(id, note)` opens a correcting draft; issuing it
  marks the old one `superseded` (both stay readable; the old one carries a "Superseded by <number>" status chip that
  links to the correction — no banner, §2.5).
- **Added since issue** (V400). An issued report never changes. Its page shows **"N added since issue"** — the count of
  achievements, invoices and readings whose `happened_on` falls in its period but whose `logged_at` is after
  `issued_at` (`report.added_since_issue(id)`, each a link) — and the next report's template has the section **"Added
  to earlier periods"** listing them under their real period. The V36 correction stays available when a figure was
  wrong, not merely late.
- **Live names in frozen reports** (V58). The snapshot freezes figures and wording, but every person or partner in it is
  an **entity token** (`{{partner:<id>}}`, `{{person:<id>}}`), never a typed name; the line editor inserts tokens when
  an editor picks a partner or a person. On screen, and in a PDF or PPTX rendered at download, tokens show the current
  name. The hash covers the tokens, so a rename never changes it. A test renames a partner and a helper and checks an
  issued report's screen and download.
- **The Reports landing is the archive** (V57): every issued monthly and quarterly report, newest first, filterable by
  kind and year — including the **legacy** reports of 2024–2026, loaded once from the department's issued PDFs in Drive
  (a person uploads each PDF with its kind and period; the record has status `legacy`, no snapshot, and is marked
  **Legacy PDF**). The PDFs hold real figures: they live in Storage, never in the repository (rule 7).
- **Compare** any two periods side by side (V57): tiles and sections aligned by section key, differences highlighted
  (the delta beside each figure, lines present on one side only marked); a legacy side shows its typed tiles and, per section,
  "Legacy PDF · page N" opening its PDF there. Tiles: Revenue, Profit (V73), Bookings, Collections; a
  **Differences only** switch and **Swap**. The canvas's ReportsArchive artboard is the layout.
- **New sections** (V62, V67). **Partners at risk / lost — top reasons** (monthly and quarterly): partners whose status
  turned at risk or lost in the period, grouped by reason with counts, each partner a live-name link. **Cases**
  (quarterly): the achievements flagged "use as example" — one per quarter by default (`report.cases_per_quarter`) —
  each with exposure, actual, avoided and its story.
- **Non-money amounts on a line** (V67): a line may show a sum of a field of its cited achievements (e.g. avoided),
  labelled **not revenue**; clicking it opens the achievements with their fields and evidence. Only invoice amounts are
  ever called revenue.
- **Search across issued reports** (V67): `api.report_search(q)` finds words in issued snapshots and their lines ("which
  report said X was done"), returning report, section and the line with the match; a query naming a partner or person
  also matches their entity tokens, so a renamed partner is found by its current name. Legacy PDFs are not searched in
  v1 (their text is not extracted).
- **KPI sheet export** (`api.kpi_sheet(plan, as_of)`): one row per KPI in the strategy team's columns — number,
  objective, KPI, unit, base year, baseline, achieved before this year, year target, Q1–Q4 targets, Q1–Q4 achieved,
  cumulative, status, note and its date, leads, support tickets, source (manual/computed), evidence count; written to
  their workbook layout with ExcelJS (template needed — V35).

### 3.10 Appraisal engine (§5)

```
appraisal.grade_scale   LIST;  appraisal.grade_band (scale_id, from_pct, to_pct, label, sort)   -- bands must tile without gaps
appraisal.points_table  LIST + full_marks numeric (the points worth 100 %);  appraisal.points_band (table_id, from_pct, to_pct, points)
appraisal.rating_scale  LIST + min; max                                     -- e.g. 1–5
appraisal.template      STD SOFT DEPT; name; role_id; notes; status ('draft','active','retired')
appraisal.template_node STD SOFT; template_id; parent_id; kind ('section','group','item'); code; title_en; title_ar; weight numeric; sort;
                        -- items only:
                        definition; formula_text; unit_id; target numeric; direction ('higher','lower');
                        source ('computed','manual','corporate'); measure_key; measure_params jsonb;
                        scoring ('ratio','points','rating','pass_fail'); points_table_id; rating_scale_id;
                        thresholds numeric[] default '{0.8,0.9,1.0,1.1}'; evaluated_by ('self_and_manager','manager','admin'); cap
appraisal.cycle         STD SOFT DEPT; name; starts_on (default 1 Apr); ends_on (31 Mar); evaluation_on; lock_on;
                        status ('planning','open','locked');   -- the steps live on each appraisal (V401)
                        grade_scale_id; (name defaults to the cycle's years, e.g. "2026-27" — V68);
                        attainment_cap numeric; final_from ('manager')
appraisal.cycle_node    the template tree frozen into the cycle when it opens (copy + source_node_id)   -- history keeps its structure
appraisal.corporate_actual (cycle_id, cycle_node_id) pk; actual; entered_by; entered_at      -- entered once, for everyone
appraisal.appraisal     STD DEPT; cycle_id; person_id; template_id; evaluator_id (the direct manager — V96);
                        step ('self','manager_draft','shared','locked') (V401); employee_comment; evaluator_comment;
                        employee_signed_at; evaluator_signed_at; locked_at; final_pct_locked; grade_locked
                        unique (cycle_id, person_id)
appraisal.item_param    (appraisal_id, cycle_node_id) pk; target; params jsonb      -- per-person targets (e.g. each person's GMV plan)
appraisal.score         (appraisal_id, cycle_node_id) pk; self_value; self_comment; manager_value; manager_comment;
                        override_actual; override_reason; locked_actual; locked_pct
appraisal.legacy        STD; cycle_label; person_id; source ('old_tool','excel_form','clickup'); payload jsonb; file_id   -- read-only
```

**Where the first templates come from** (owner decision 2, 28 Sep): the **online appraisal tool** is the latest
source and wins wherever the Excel form differs. Its section weights (**70 / 25 / 5**: personal KPIs / competencies /
corporate), its grade scale, its points tables and its items seed the templates, through a one-time import of an
export of the tool's data **handed over by the owner** (CLAUDE.md rule 8: that database is read once, from an export the
owner gives). The export holds real staff scores, so it stays in Drive or the scratchpad — never in a migration,
fixture or commit (rule 7) — and a person loads it through the importer (D17, DP3). The same export brings the legacy
appraisals (P6-3). Only gaps are filled from the Excel form. After seeding, every number is an ordinary setting.

**Scoring** (`appraisal.item_score` view, the same formula for the self and the manager column):

- **Actual**: computed items call their measure for the person over the cycle dates (live until lock; a manager may
  override with a reason, flagged); corporate items read `corporate_actual`; manual items take the entered value.
- **Item %**: `ratio` = actual ÷ target (target ÷ actual when lower is better), capped at the item's cap or the
  cycle's; `points` = the band's points ÷ the table's full marks (the official form's 101–110 % = 3.00 … < 75 % = 0);
  `rating` = value ÷ scale max; `pass_fail` = 100 % or 0. The threshold columns (80/90/100/110 %) are shown from the
  target (reversed when lower is better).
- **Roll-up**: a node's % = Σ(child % × child weight) ÷ Σ child weights, so the form's two ways of writing weights
  (items summing to their group's weight, or to 100 %) both work; the template editor warns when weights do not add up.
  Final % = the sections weighted (70/25/5 as seeded from the online tool — whatever the template holds); grade from the cycle's scale.
- **Self-registration** (V68), before the manager's review: each person sees **my achievements in this cycle** (owned or
  taken part in, evidence date inside the cycle), completes them, and the page flags any without a date or an evidence
  file. For appraisal figures an achievement **without a date or evidence never counts** (stricter than the KPI page,
  where V33 counts it flagged "no evidence yet"). ClickUp items with no date or evidence import only as
  `appraisal.legacy`, never as achievements.
- **Steps** (V401): **Self** (self-registration of achievements, V68, then the self column) → **Manager draft** (the
  direct manager's column, private to them and admins) → **Shared** (the person sees the draft, comments, both sign)
  → **Locked**. Each step change is logged and notifies the other party (`appraisal_step`).
- **Lock** (admin, at or after `lock_on`): every actual and % is copied into `locked_*`, final and grade stored — the
  appraisal equivalent of an issued report. Reopening is an admin action with a reason.
- **Visibility** (RLS, V96): **the person, their direct manager (`core.person.manager_id`) and admins. Nobody else**,
  whatever their page level — and the same three in search, exports, notifications, My day and the change log
  (`api.record_history` and `api.search` apply `authz.can_see_appraisal`). The appraisal lives on the person's record
  page as its type tab (V95), shown only to those three.

### 3.11 Import and export

**Imports are a later phase (P7)** — at go-live invoices are typed in the browser (§7, owner decision 4). The
framework below is specified now so the tables carry what imports will need (`source`, `src`, batch ids) and nothing
has to be reshaped later. **Export** (end of this section) is in version 1.

```
io.batch    id; source_key; file_name; file_size; file_sha256; export_time timestamptz (from the file name, Riyadh);
            started_by; started_at; finished_at; status ('previewed','applying','applied','partial','failed','undone');
            counts jsonb (read, new, changed, unchanged, held); request_id
io.chunk    (batch_id, chunk_no) pk; row_count; applied_at; result jsonb          -- makes every chunk idempotent
io.held     id; batch_id; row_no; reason_key; detail; raw jsonb (the row's own columns only)
io.held_ref (batch_id, ref) pk                                                     -- cost lines for references Finance lacks
```

**The Past work grid is in v1** (V400, P5; the component is builder C's — P5-2c, V410): a paste grid on Tasks and on
Achievements where a person types or pastes rows — title, `happened_on`, status or category, organisation, notes — and
each row becomes a task or an achievement with its **real date**, marked **Backfilled** (origin `backfill`), raising no
notices, no late flags and no overdue or no-update flags. A **one-time load of the BD Daily Tasks sheet** goes through
the same grid (the sheet's columns are mapped once by a person; it holds staff names, so it is never committed — rule
7); **its task tabs only**.

**One framework** (`core/import` in the browser, `io.*` and each source's `api.import_<source>` in the database):

1. **Recognise.** The person drops one or more files, any order (Finance → Imports). Headers are compared after
   removing a BOM, spaces and `_ - . : ( ) /` and ignoring case (handover 2). Each source declares its required and
   optional headers; a file that fits none is refused, naming what was found (LANDMINES A).
2. **Read.** CSV in 1 MB slices with a quote-aware streaming parser; Excel in a Web Worker posting 5,000 rows at a time
   (ported from js/121); the page never freezes (a 50 ms heartbeat test guards it). Dates: day-first
   `dd/mm/yyyy hh:mm:ss AM/PM`, ISO, `dd-Mon-yyyy`, Excel serials, Arabic digits; an impossible date holds the row.
   Money: `SAR`, `ر.س`, commas, parentheses as negative, Arabic digits; unreadable → held (never 0).
3. **Export time** from the file name (`YYYY-MM-DD_HH-MM-SS…`, Riyadh — D20); if absent, the preview says so and the
   file is treated as **older than anything stored** (fill-only) unless the person enters the export time.
4. **Preview** = the real database function in dry-run mode (rolled back): new / changed / unchanged / held, with
   reasons, and for invoices the decisions it will create. No second copy of the rules in the browser (A10).
5. **Apply** in chunks of at most 1,500 rows, never splitting one reference's rows; each chunk is its own transaction
   and is recorded in `io.chunk`, so a stopped import is finished by dropping the same file again.
6. **Merge rule for every fact field** (`io.merge`, one generic function): a blank never wipes; a stored blank is filled
   from any file; a stored value changes only when the file is **newer** than the export time recorded for that field
   (`src` jsonb keeps one time per field). **The same file twice changes nothing** (same SHA-256 → "already imported on
   `<date>` by `<person>`", nothing written; a partial batch resumes).
7. **Held and listed**: unknown statuses, unreadable dates or amounts, and references with no invoice are listed with
   their reason and downloadable as CSV; they never become records. When new invoices arrive whose references were held
   by an earlier cost file, `finance.health` says "drop the cost export again" (the export is cumulative).
8. **After each invoice import**, billing links come from Payments' own `consolidated_proforma_id` wherever the source
   carries it; otherwise the database proposes them (subset-sum on cents, at most 6 members, exactly one solution,
   capped steps — ported from js/65) and the proposals wait for a person's tick. The old D26 one-to-one "twins" are
   simply billing links with one transaction (§3.6).

**P7 sources:** Payments all-invoices export (first), Transaction Expense Export, Expense Invoice Export, Revenue Report
(expense total only), Corporate clients (29 columns), Promo codes (13 columns). **Later:** legacy appraisals, ClickUp.
Column maps are ported exactly: the cost, clients and promo maps are listed in `docs/REBUILD-HANDOVER-2.md` §1 (branch
`claude/clever-franklin-vukl22`); the all-invoices map, from production `js/41` and `js/65`, is:

| All-invoices header | Becomes |
|---|---|
| (detection) | the file has all of `Type`, `Invoice Reference #`, `Customer Name`, `Item Is Taxable` |
| `Type` | row type: `invoice`, `credit_note`, `item` or `payment_receipt` (a blank reference skips the row) |
| `Invoice Reference #` | `ref` — the key |
| `Invoice Number` | the DPIN, stored as a `finance.tax_invoice` row under this invoice (blank = an unnumbered transaction) |
| `Customer Name` · `Customer Email` / `Email` | customer name · customer email (lower-cased) |
| `Invoice Create Date` · `Invoice Generate Date` · `Last Payment Date` | created on · generated on · paid on |
| `Invoice Status` · `Last Status At` | status (through `status_map`) · status time (decides which copy is newer) |
| `Invoice Total` | total, as recorded |
| `Sale Branch` · `Salesman` | branch · salesman (kept raw) |
| item rows: `Product`, `Name`, `Qty`/`Quantity`/`Item Quantity`, `Unit Price`/`Item Unit Price`/`Item Price`, `Item Discount`, `Item Total`, `Item Is Taxable` (`Yes` = true) | an invoice line |
| receipt rows: `Payment Method`, `Allocation`/`Allocated Amount`/`Amount`, `Ref # At Payment Method`, `Payment By`/`Paid By`, `Notes`, `Payment Date`/`Receipt Date`/`Paid At` | a receipt |

A file the old app exported itself (its own revenue/profit columns) is refused.

**Export** (builder C's `core/export`, P3-12 — V410). Every list has Export (CSV with BOM, or Excel). It runs the list's
own query with the chips applied, paging through `fetchAll`, writes numbers as numbers, dates as Riyadh dates, IDs as
text, and passes every text cell through `csvGuard` (CP5). An E2E test proves the exported row count equals the list's
count. An export never drops a column silently — every visible column is in the file, or the export says which is
missing and why (OA23); an empty cost is an empty cell, never 0 (OA4) (V426, V428).

**An import never writes to, or revives, a deleted row** (OA12, V428): a row soft-removed in the app is skipped by
every later import and listed as skipped, never updated and never restored by a file.

### 3.12 Where every figure comes from (nothing stores a copy)

| Figure | Computed by | Stored? |
|---|---|---|
| An invoice's partner | `partner.match` | Never |
| Revenue, cost, estimate, margin, cost status, counts | `finance.money_row`, `finance.invoice_cost` | Never |
| Reconciliation (billing = its transactions; DPIN = total − approved expenses) | `finance.check` | Never |
| Income by service | `finance.money_service_row` | Never |
| A person's credited revenue | `finance.credit_row` | Never |
| Outstanding and ageing | `finance.receivable` | Never |
| Partner card totals, KPI contributions | `finance.partner_month`, `perf.kpi_partner_quarter` | Never |
| Project revenue and cost | `work.project_money` (linked invoices) | Never |
| KPI month/quarter/year values, pace, status suggestion | `perf.kpi_*` | Never |
| An achievement's amount | its linked invoices through `finance.money_row` | Never |
| A report line's amount | `report.line_amount` (distinct invoices) | Only inside an issued snapshot |
| Task stale/overdue, My work | `work.task_view`, `work.my_work` | Never |
| Appraisal actuals, %, grade | `appraisal.item_score` | Only when locked |
| A file's display and download name | `core.file_display_name` (live, from its kind's pattern and linked records) | Never |
| A contract's status | computed from its dates and notice days | Never |
| A partner's current status and last feedback date | the latest `partner.status_change` ≤ today; the latest feedback note | Never |
| A revenue unit's segment | invoice override → project → partner (`finance.money_row`) | Never |
| Credit used against the limit; the prepaid (wallet) balance | `finance.partner_credit`, `finance.partner_wallet` | Never |
| Sales by code | `finance.sales_by_code` | Never |
| A revenue unit's payment type | client ID subkind, else code (`finance.money_row`, V87) | Never |
| Team load | `work.team_load` | Never |
| A record's period (week, month, quarter), task time, "logged late", stale, overdue | from `happened_on` and `logged_at` (V400) | Never |
| A side's status; the row chip | the latest `partner.side_status_change` ≤ today; the most urgent flag | Never |
| Days to pay; quiet clients | `finance.receivable`, `finance.quiet_client` | Never |
| "N added since issue" | `report.added_since_issue` | Never |
| An achievement's avoided amount | its computed field (exposure − actual loss) | Never |
| Calls and pipeline updates per week | `work.pipeline_updates`, `partner.calls` | Never |
| A partner's display name | its trade name in the reader's language (V77) | Never — the names are typed, the choice is computed |
| Partners that contributed to a KPI | `perf.kpi_partner_contribution` | Never |
| Tenders submitted, awarded value, funnels | `pipeline.*` measures over `pipeline.stage_change` | Never |
| Import counts | `io.batch.counts` | Yes — a record of what an import did, not a business figure |

**Printed parts reconcile to the printed total** (OA5, V428): on every tile, report page and export the parts shown
add up to the total shown; a difference of 1 SAR or more is named as a difference, never called rounding.

### 3.13 Indexes and the performance budget

- Match keys: `partner.identifier (kind, value_key) where removed_at is null`; `finance.invoice` on each key column;
  `finance.expense_line (invoice_id)`; `finance.invoice_line (invoice_id)`; `finance.receipt (invoice_id)`;
  `finance.billing_link (billing_invoice_id)`; `finance.tax_invoice (parent_invoice_id)`;
  `partner.side_owner (partner_id, side, effective_from)`; `perf.achievement (plan_id, happened_on)`,
  `(category_id)`, `(partner_id)`; `work.task (owner_id) where closed_at is null`, `(due_on)`, `(partner_id)`,
  `(project_id)`; `work.action_item (owner_id) where done_at is null`; `core.note (entity_table, entity_id, created_at)`;
  `audit.change (table_name, row_id, id desc)`; trigram indexes on `norm.fold(name)` for search.
- RLS helpers are `stable` and called as `(select authz.level('x'))` so they run once per statement.
- **Budget, measured on the stress fixture** (made-up: 2,000 partners, 10,000 identifiers, 60,000 invoices, 150,000
  invoice lines, 180,000 expense lines, 5,000 tasks, 3,000 achievements): partner card ≤ 300 ms, KPI page ≤ 500 ms,
  My day ≤ 500 ms, decision queue ≤ 1 s, Finance overview ≤ 800 ms (database time, p95).
- **If the live match view misses its budget**, the only sanctioned fix is a cache table maintained **in the same
  transaction** as every identifier, pin and invoice change, with `partner.match_cache_drift()` (must be empty) run in
  tests and nightly — introduced in its own PR, with the measurement that justified it. It is still "live" in the
  owner's sense: no screen can ever see it disagree with the rules.

### 3.14 Blueprint records → tables

| §2 record | Table(s) |
|---|---|
| Company (now Partner — V52) · Company identifier · Contact · File | `partner.partner` · `partner.identifier` · `partner.contact` · `core.file` + `core.file_link` |
| Invoice (lines, payments) · Expense line | `finance.invoice` (kinds transaction, standalone, billing …), `finance.invoice_line`, `finance.receipt`, `finance.billing_link`, `finance.tax_invoice` (DPIN) · `finance.expense_line` |
| Project · Task · Action item · Task update / meeting note | `work.project` · `work.task` · `work.action_item` · `core.note` (kind update/meeting) |
| Achievement · Achievement category · Participant | `perf.achievement` · `perf.achievement_category` (+ `category_field`, `category_kpi`) · `perf.achievement_participant` |
| Challenge · Next-month target | `perf.challenge` · `perf.period_target` (+ its `work.task`) |
| Report · Report line | `report.report` · `report.line` (+ `line_achievement`, `line_invoice`) |
| Plan (year) · Objective · KPI · KPI target · KPI lead (on screen **Responsible** / «المسؤول» — V405) / contributor | `perf.plan` · `perf.objective` · `perf.kpi` + `perf.kpi_rev` · `perf.kpi_target` · `perf.kpi_lead`, `perf.kpi_contributor` |
| Appraisal cycle · template · section · item · grade scale · appraisal · line score | `appraisal.cycle` (+ `cycle_node`) · `appraisal.template` · `template_node` (kind section/group) · `template_node` (kind item) · `appraisal.grade_scale` + `grade_band` · `appraisal.appraisal` · `appraisal.score` |
| Department · Person · Team · Role · Access level | `core.department` · `core.person` · `core.team` · `core.role` · `core.level` + `core.role_page_level` / `core.person_page_level` |
| Setting · Change log | `core.setting` (+ list tables) · `audit.request` + `audit.change` |

---

## 4. Sign-in (§0, §10; V2 as amended by V59, V74, V75)

**The rule.** No passwords. **The emailed 6-digit code is the door** (owner, 28 Sep — V59): one field for the work
email, then the code. **A device stays signed in until the person signs out; a device unused for 30 days asks for a
new code** (owner, 29 Sep — V74). Google (`@directksa.com`) and Zoom (`@directksa.net`)
become optional shortcuts later, when their keys exist (V23). Every sign-in — whatever the door — lands on **one person
record**; a door never creates a person.

**The page** (owner, 29 Sep — V75) is split: the **form on the right** (left-to-right; mirrored in Arabic) and a
**brand panel on the left** — Direct slate, a subtle flight-path pattern drawn from the logo's plane, the official logo
and, under it, the **brand line**: EN "The commercial arm of the all-in-one travel app" / AR «الذراع التجاري لتطبيق
السفر الشامل». On a phone the panel collapses to a top band. The artwork comes from the Design lead session (V82). **The page says only this:** the logo and brand line; **Commercial Workspace** / **مساحة العمل
التجارية**; an **EN | ع** language toggle; **© Direct**; and the form's own words — step 1: "Work email", **Send code**;
step 2: "Enter the 6-digit code", "Sent to o•••••@d•••.com · Change" (the email masked; Change goes back), six digit
boxes, **Verify**, "Resend code" with its countdown. Nothing else — no legal line, no hint text (V11, V59). Every
refusal is one plain line in red: "This email is not on the list — ask an admin", "Your account is switched off", "The code has
expired — send a new one".

**Keeping people signed in** (V74):

```
core.device_session  id; person_id; auth_session_id uuid unique (the Supabase session — the JWT's session_id claim);
                     device_label (browser and system, from the user agent); signed_in_at; last_seen_at; signed_out_at;
                     signed_out_by; sign_out_reason ('person','admin','inactive','switched_off')
```

- A device stays signed in until sign-out. `authz.me()` answers only when the request's `session_id` maps to a live
  device session — not signed out and seen within `auth.device_idle_days` (30); the middleware touches `last_seen_at`
  at most once an hour. A device idle for longer is signed out as "inactive", and its next visit asks for a new code.
- **My profile → Devices** lists the person's signed-in devices (label, signed in, last seen, "this device"), each with
  **Sign out**, plus **Sign out everywhere else**.
- **An admin can sign anyone out** — every device or one (Settings → Organization & access → the person); logged.
- Signing out marks the row and deletes the Supabase session on the server (service key), so its refresh token dies;
  `authz.me()` refuses at once, before the short-lived access token expires. (Supabase's refresh tokens do not expire
  on the free plan; the idle rule is the app's.)

**The mail sender.** Codes need a real sender before real users: Resend's free tier with its DNS records (V24). Until
then, staging uses Supabase's built-in sender, which reaches only the Supabase account's own team — enough for the owner
to sign in to staging; CI reads codes from the stack's mail catcher.

**Words in the app's chrome** (V59): the department is **Commercial** / **الإدارة التجارية**. Never in the app's chrome or
wording: "Direct KSA", "DirectKSA", "Direct Corporate", "B2B", "B2G", "MICE" (a check scans the message catalogs and the
page templates). **The banned words cover data labels too** (V404): seed lists, settings defaults and the values admins
type into a list — the segment is **Government**, with no abbreviation after it; the check scans the seeds and the
defaults, and the list editor refuses a value carrying a banned word, naming it. Codes are IDs, not labels (a KPI code
copied from the strategy sheet stays as the sheet writes it). The logo is the official file (slate wordmark on light,
white wordmark on dark or slate), never recoloured.

**One person, several emails.**

```
core.person_email   STD SOFT; person_id → core.person; email citext unique (live) not null; is_primary bool
                    -- the admin allow-list: a person holds one or more allowed emails (e.g. their .com and their .net)
core.person_auth    auth_user_id uuid pk → auth.users; person_id → core.person; email citext; providers text[] (every door
                    this auth user has used: google, zoom, email);
                    linked_at                                    -- every Supabase identity resolves to exactly one person
core.sign_in_log    id; at; person_id (null when refused); email; provider; result ('ok','not_listed','switched_off',
                    'provider_error','code_expired'); detail; user_agent
```

`core.person` keeps `can_sign_in` and `active`; its email moves to `core.person_email` (the primary one is the display
email). `authz.me()` = the active person joined through `core.person_auth` on `auth.uid()`.

**How it works.**

1. **Sign-ups are off** in Supabase Auth; the password provider is never offered. An auth user can exist only because
   an admin allowed that email.
2. **Allowing an email** (Settings → Organization & access → the person → Emails): a server-only route handler, after
   checking through `api.me()` that the caller is an admin, creates the auth user for that email with the service key
   (`email_confirm: true`) and writes `core.person_auth`. One auth user per allowed email; all of a person's auth users
   point to the same person.
3. **Code — the door**: `signInWithOtp({ email, shouldCreateUser: false })` — only an allowed email gets a code; the
   6-digit code is verified with `verifyOtp`; then `core.person_auth` → an active person with `can_sign_in` → signed in
   and logged `ok`; anything else → signed out at once, logged with the reason, and the refusal is shown.
4. **Google / Zoom — later shortcuts** (V23): the provider returns a verified email; Supabase links the identity to the
   existing auth user with that email; the same check and log follow.
5. **Switching someone off** (a person, or one of their emails): RLS and every API function stop answering at once
   (no active person); the server bans the affected auth users so no new session starts; logged.
6. **Defence in depth**: an auth user with no active person behind it can read and write nothing.
7. **Sessions**: `@supabase/ssr`; the middleware refreshes the session cookie; the `(app)` layout calls `api.me()`
   **before rendering** (A5); one browser client (A4). A signed-out deep link returns to the same address.
8. **Every sign-in is logged** in `core.sign_in_log` (successes and refusals), readable in Settings → Activity by admins.
   Supabase's own auth audit log is kept as the second record.
9. **Tested in CI** with the Supabase stack's mail catcher for codes, including the 30-day idle rule (a test clock), a
   device signed out from another device, and an admin's sign-out taking effect on the next request. When the Google and Zoom keys arrive, each door is checked once on the cloud project
   by a real `.com` and a real `.net` account, including "the Zoom email arrives verified and links to the existing
   user" — the one behaviour the documentation does not settle.

**Mail sender for codes — options** (only authentication mail; a few dozen messages a month):

| Option | Cost | What it needs | Verdict |
|---|---|---|---|
| **Resend**, on a sending sub-domain such as `auth.directksa.com` | free tier: 3,000 mails a month, 100 a day | an account; 3–4 DNS records on the sub-domain (SPF, DKIM, a return-path MX); SMTP details into Supabase | **Recommended**: free, made for this, keeps auth mail apart from the company's own mail reputation, no staff password involved |
| Google Workspace SMTP relay (from `@directksa.com`) | free if an existing account or group sends; a new mailbox is one more Workspace seat (paid per month) | a Workspace admin setting; SMTP authentication with a Workspace account or app password | Good if IT prefers everything inside Google; depends on one account's password |
| Brevo | free tier: 300 mails a day | account + DNS records (SPF/DKIM) | Fine alternative |
| Amazon SES | about 0.10 USD per 1,000 mails | AWS account, sandbox approval, DNS records | More setup than needed |
| Supabase's built-in sender | free | nothing | **Staging only**: it delivers only to the Supabase account's own team members and is rate-limited — enough for the owner on staging, not for staff (Supabase's documentation) |

**What the owner must set up** (all free). First the mail sender (step 3) — needed before real users; the Google and
Zoom keys (steps 1–2) are optional shortcuts, deferred (V23); CI tests the code door end to end and the Google/Zoom
linking rules through identities made with the admin API:

1. **Google** (Workspace admin): Google Cloud console → a project → OAuth consent screen *Internal* → Credentials →
   OAuth client ID, type *Web application* → authorised redirect URI `https://<new-project-ref>.supabase.co/auth/v1/callback`
   → hand over the client ID and secret privately (they go into Supabase → Authentication → Providers → Google).
2. **Zoom** (Zoom account admin): marketplace.zoom.us → Develop → Build App → *General app* (OAuth), not published
   (only Direct's Zoom account can use it) → redirect URL and allow-list the same callback address → scope
   `user:read` → hand over the client ID and secret privately (Supabase → Providers → Zoom).
3. **Mail sender** (when codes are wanted): create the Resend account, add the DNS records it lists for
   `auth.directksa.com` at the domain's DNS host, then hand over the SMTP details (Supabase → Authentication → SMTP).

---

## 5. Access and row-level security

**Levels per page** (D2, unchanged in meaning): **No access** (page hidden, reads refused) · **View** (read what the
page shows) · **Own work** (read everything; create; edit and remove your own) · **Full control** (edit and remove
anyone's; managers). **Capabilities** are yes/no rows for actions that move money or people (assigning tasks, changing
identifiers, merging, importing, splitting credit) — shown in the matrix under their page.

**What "your own" means**, per record (the `authz.can_edit_*` functions, one per entity):

| Record | Yours when you are… |
|---|---|
| Task | its owner or creator; a helper may add notes and tick action items they own or help on |
| Action item | its owner (or a helper on it) |
| Project | its owner |
| Organisation | the owner of the side you are editing (account manager / relationship owner) or its creator (V26) |
| Achievement | its owner or a participant |
| Challenge, period target | its owner |
| KPI reading or status note | a lead of that KPI |
| Invoice (typed) | the person who typed it (`created_by`); managers correct anyone's (owner decision 4, V49) |
| Report draft (edit and issue) | a named report editor of its department (Full on Reports may also issue and correct) |
| Appraisal | the person (self fields), the evaluator (manager fields), admins (corporate actuals, lock) |

**Policies.** Every table: row-level security enabled; one `select` policy, for example:

```sql
create policy read on work.task for select to authenticated using (
  (select authz.level('tasks')) >= 'view'
  and authz.in_my_departments(department_id)
  and deleted_at is null );
create policy read on appraisal.appraisal for select to authenticated using (
  authz.can_see_appraisal(person_id) );      -- the person, their direct manager, admins — whatever the page level (V96)
```

No insert/update/delete policy exists, and no role holds those grants: writes happen only inside `api.*` functions,
which check the level, the capability and the row rule explicitly and raise `42501` naming the page and level needed.
The `authz.*` helpers are `security definer`, `stable`, with `search_path = ''`, so the policies on `core.person`
and the level tables never recurse into themselves. A **measure** checks access itself: without Finance view, a
finance measure returns "not measured — no access", never 0 (M53).

**Who sees what** (V96, V97): the whole team sees all work — every organisation, task, project, tender, achievement, KPI
and report of their department; an appraisal only its person, their direct manager and admins. **Settings pages have
two levels, none and Full, and only admins hold Full**; changing access or a person's emails is an admin's act.

The screen asks the same `api.me()` levels to hide what would be refused (M42) and never shows a control that the
database would refuse without saying why.

**Tested exhaustively** (§9): every `api` write function × every role × own/other row → allowed or `permission
denied`; every table refuses direct writes; `anon` gets nothing; the grants snapshot matches.

---

## 6. Screens (proposal for blueprint §7)

Common to every area: list + 480 px detail panel, own URL per record, chips with counts, Export on every list, one tab
row at most inside a detail, `<DataState>` everywhere, Undo on every toast, removal through the D19 box. Every record
page is the one template of V95 — header with up to five figures and the main actions, tabs Overview · Activity ·
Related · one type tab, a details rail — with empty fields behind "+ Add", "Show all" on long histories, and every
record opening full page (V81). Exports are unchanged for now — a data export on every list, the designed monthly and quarterly
reports — and revisited later (V83).

| Area (route) | List | Detail (one tab row) | Main actions |
|---|---|---|---|
| **My day** `/my-day` | Four blocks: **My work** (overdue, today, this week — tasks and action items I own, am assigned or help on; stale flags) · **Since your last visit** (counters, each a link: mentions, invoices paid, contracts expiring, KPIs behind pace, tasks updated; Mark all seen) · **My partners' activity** (new invoices and bookings, payments, overdue invoices, contracts expiring — since my last visit) · **My KPIs** (lead or contributor: pace light, year to date vs due, this month's addition) · **My appraisal** (private: cycle step, what is due from me) | — | Quick add task; mark action item done |
| **Overview** `/overview` (V80) | The executive view: Revenue · Cost · Profit, collections, new clients, tenders submitted, awarded value, partnerships signed, government entity contracts — period switch against last year; the tender and partnership funnels; a **segment switch** over everything and the **payment-type chip** (V87); each tile links to its list | — | Period; segment; export |
| **Pipeline** `/pipeline/tenders`, `/pipeline/partnerships` (V80) | Two boards (columns per stage, drag to move) and their list views; chips: stage, owner, partner, segment, due; saved views | Tender: partner (official name), Etimad reference, tender number, dates, value, awarded value, stage history, files, linked project and achievement. Opportunity: partner, kind, stage history, next step, expected value | New tender; new opportunity; move stage (with date; reason for Lost / Cancelled); Log achievement on Awarded / Signed |
| **Clients** `/clients/[id]` and **Suppliers & partners** `/suppliers/[id]` (V98) | Two list pages over the one organisation table, each lean: **saved views across the top** (Clients: All · Government · Corporate · Agencies · Individuals; Suppliers & partners: All · Suppliers · Strategic partners · Sales channels · Integrations; a default per person); visible chips **Type · Owner · Status** and one **KPI** chip (objective → KPI, period this quarter by default; organisations that contributed); everything else under **More filters**; any combination saves as a view. Columns: logo or monogram, trade name (V77), the side's type, status chip, owner, last activity, and on Clients YTD revenue and outstanding | **The record page of V95**: header (trade name, side chips with type and status, up to five figures, New task · Log activity · Log achievement · New project); **Overview · Activity · Related · Finance** (Finance only with the Client side on: invoices, months, collections, credit limit and outstanding against it, prepaid balance, Sent to legal, codes with their terms, days to pay, **Open in Finance** carrying the filters); the details rail: both sides' fields, identifiers with add / remove / history, contacts with roles, Direct references, contracts | New client / New supplier & partner; **Log activity** (type, outcome, next step — V401); switch a side on or off; set a side's status (with reason); add identifier; upload logo; add contract; merge; set the side's owner; Escalate; Follow |
| **Needs a decision** (a view of Clients) | Customer groups with row count and riyals at stake, candidates for conflicts | The rows, their clues | The decisions of §3.5 |
| **Finance** `/finance/[view]` | Views: Overview (tiles: Revenue, Cost, Profit (the screen words — V73), the estimate apart and flagged — never a "profit with estimates" (V419), counted units, **Not yet invoiced: Ready / Pending** (V424 — never in revenue); months; income by service; **by segment** (V64); what is held back and what fails a check) · Invoices (every kind and state; chips: **payment type** (prepaid · postpaid · code · tender — V87), Provisional, **Loss** (V414), checks failing, no partner) · Collections (ageing, who to chase — on billing and standalone invoices; each row's due basis — V415; the payment-type chip; Sent to legal chip and note — V70) · **Sales by code** (code × month, partner or campaign, terms — V65; campaign codes listed apart); every filter lives in the URL (partner, period, kind, status, service …) so **Open in Finance** from a partner card lands on the same figures; **saved views** (personal or shared) and bulk actions on every list · **New invoice** (the fast entry screen of §7) · Imports (P7) | Invoice: header, lines, expenses (transactions), transactions and DPIN and receipts (billing), cost status, checks, partner and match level, credit (split), projects/achievements/report lines citing it, history | New invoice (Save and new, Duplicate); link transactions to a billing invoice; split credit |
| **Projects** `/projects/[id]` | Number, name, partner, owner, status, dates, linked revenue and profit | Overview (linked invoices and money) · Tasks · Achievements · Files · Timeline | New project; link invoices |
| **Tasks** `/tasks/[number]` | Switch List / Board by status / Calendar by due date. Chips: My work, owned, helping, team, status, due, stale, partner, project | Header (title, status, owner, due, priority) · Action items (inline add, owner, due, helper) · Timeline (updates, meeting notes, comments, @mentions) · Links (partner, project, contacts, invoices, KPIs, Direct references) · Files | Quick add (title, owner, due — Enter); **Team load** view for managers (V91); close (offers "Log the achievement"); log meeting |
| **KPIs** `/kpis/<year>/<code>`, `/kpis/achievements/<id>`, `/kpis/challenges/<id>` | Views: **KPIs** (the year's plan grouped by objective: code, title, Responsible (the KPI leads — V405), YTD, year target, pace light, Q1–Q4, measured) · **Achievements** · **Challenges** (V37). Year chooser (the plan) | KPI: target and result by month and quarter; drill-down achievements/invoices → partner → evidence; readings; status notes; definition and target history. Achievement: its line, fields, evidence, invoices, KPIs, history | Log achievement (category first, then its own fields; mark "use as example"); add reading; declare status; escalate a critical challenge (to whom, when — V69); export the KPI sheet |
| **Reports** `/reports` (archive), `/reports/monthly/<period>`, `/reports/quarterly/<period>`, `/reports/compare?a=…&b=…` | **The landing is the archive** (V57): every issued monthly and quarterly report and every legacy PDF (2024–2026), newest first; one tab row **Monthly · Quarterly**; filters by year; **Search** across issued reports (V67); **Compare** any two | Editor: the template's sections in order, each live, with the lines editor (cite achievements/invoices, combine, reword — partners and people inserted as live-name tokens), suggestions of what is not cited yet; Preview; Submit for review (when on); Issue. Issued: snapshot, drift since issue (a count chip linking to the changed figures), PDF/PPTX, Correct. Legacy: the PDF, marked Legacy PDF. **Compare**: two periods side by side, tiles and sections aligned, differences highlighted, a legacy side showing its PDF — as the canvas's ReportsArchive. **Quarterly** (the canvas's QuarterlyReport): cover · quarter vs the same quarter last year (tiles) · achievements by category (each line linking to its achievements, partners and invoices) · KPI results (target, M1, M2, M3, quarter, year to date, status) · challenges (open, carried over, and resolved this quarter) · next-quarter targets · operational-plan indicators (Done / Carried over) | New report; Issue (freeze); PDF; PPTX; KPI sheet export; correct; load a legacy PDF; compare |
| **Appraisal** `/appraisal/[id]` | My appraisal; my direct reports' (a manager); all (admins) — V96; each one opens on the person's record page (V95) | **Self-registration** first (V68): my achievements in this cycle, each completed or flagged "no date" / "no evidence" (those never count). Then the form as the official sheet: sections → groups → items (definition, unit, target, thresholds, actual with a "from the app" badge, self, manager, weight, %), competencies, comments, sign-off, summary with grade | Self-evaluate; evaluate; sign; lock (admin) |
| **My profile** `/profile` (everyone, from the profile chip — V97) | — | Photo or initials with a colour, full name, display name / nickname, badge (none, an icon, a zodiac sign), theme of four, density, language, start page, drawer pinned or collapsed, notification choices (in-app only in v1 — V45), Devices with per-device sign-out (V74); every value starts from the admin's default | Profile changes save at once with Undo |
| **Activity** `/activity` (its own page — V97) | The whole change log with filters (who, what, when, kind), the settings log with Revert, the sign-in log; **Recently deleted** with Restore (V401) | — | Undo; Revert (settings); Restore |
| **Settings** `/settings/[group]` (**admins only** — V97) | The groups: Organization & access (people, teams, roles, the access matrix, allowed emails, admin defaults for profiles), Clients and Suppliers & partners (types per side, tiers, fields, contact roles, activity types and outcomes, sources, status reasons, credit rules, contract reminders, file-name patterns, ID format), Plan & performance (plans, KPIs, categories and fields, pace bands, appraisal cycles and templates), Finance, Work (statuses with their locked meanings, priorities, templates, recurrence, late days, no-update days), App (themes, wording, notifications, import/export, go-live date) | Each a page of forms driven by `setting_def` schemas and list tables, with **Used in** counts, Archive / Retire-and-replace, the **impact preview** before saving, and the settings log with Revert (V97) | Every setting changes with a reason and an effective date where it has one |

**Sign-in** (`/sign-in`): exactly the words of §4 — the split page of V75 (brand panel with logo and brand line; the
form with Commercial Workspace, EN | ع, email, code, © Direct). **My profile → Devices** lists signed-in devices with
per-device sign-out (V74).

Top bar: search and command palette (Ctrl K — pages, records through `api.search`, and the actions **New task · Log activity · New invoice · Go to** — V401), Create menu, bell (the notification centre: All · Mentions · Assigned to me, by day, mark all read, snooze — §3.3)
(notifications; due items counted live), profile chip (avatar, nickname, badge) opening My profile (theme, density, language once Arabic is enabled,
sign out). The drawer: My day, Overview, Clients, Suppliers & partners, Pipeline, Projects, Tasks, Finance, KPIs, Reports,
Appraisal, Activity; Settings for admins (§2.5); on phones the bottom bar My day · Tasks · Clients · KPIs · More (V85).

---

## 7. Invoice entry and imports (proposal for blueprint §8)

**Version 1: invoices are typed in the browser** (owner, 28 Sep — decision 4). **Finance → New invoice** is a
first-class, fast screen, built for someone copying from a Payments page:

- **Header** in one row: kind (Transaction · Standalone invoice · Billing invoice · Credit note · Wallet top-up),
  Payments reference, status, created and paid dates, total; the **customer as Payments shows it** (client ID, name,
  email) with the **partner match shown live** beside it (§3.5). No match → the typist **may** pick the partner
  (an entry pin, §3.5) or leave it for **Needs a decision**; either way the clue is suggested as an identifier, and
  once someone with `partners.identify` accepts it, the next invoice matches by itself.
- **Lines** grid (product from the product list, item name, quantity, price, total) — keyboard-first, and a block
  pasted from Payments (tab-separated) fills it.
- **Expenses** grid on transactions and standalone invoices (type, amount, status, merchant, reference, dates).
- On a **billing invoice**: pick its transactions (search by reference or customer); the sum is compared with the total
  as you type. **DPIN** (number, total as recorded, date) and **receipts** (amount, date, method — a receipt may be
  split across invoices, V416); a **due date** when Payments shows one (V415).
- A side panel shows, live from the database: revenue, approved cost, **cost status Provisional/Final**, the checks
  (billing = sum of transactions; DPIN = total − approved expenses; "expenses missing"), the credited person.
- Save (Ctrl+Enter), **Save and new**, **Duplicate**; every save is one request, undoable from the toast.
- One `api.invoice_save(invoice, lines, expenses, links, dpin, receipts, version)` writes it all atomically, with
  `source = 'manual'`.

**Later phase (P7): imports.** The framework of §3.11 with the Payments exports (all-invoices, Transaction Expense,
Expense Invoice, Revenue Report, corporate clients, promo codes) and, where the export lacks the consolidation link,
a reader for the Payments page data (the invoice view's JSON, in `history.state.page`, carries the expenses, the child
DPIN, `consolidated_proforma_id` and `b2b_transaction_status`; the expense report filters by `invoice_id`) — captured
in-page by a person, 10–25 rows a page, never the sync export (DP1, DP2). Imports fill blanks and never touch a
hand-entered row (D21); differences are listed for a person, who may adopt the row so imports keep it current (§3.6, V50).

---

## 8. Access defaults (proposal for blueprint §9)

Roles only set starting levels (D2); every cell can be changed per person. "✓" = capability granted.

| Page / capability | Admin | Head of department | Manager | Team member | Viewer |
|---|---|---|---|---|---|
| My day | Full | Full | Full | Own | View |
| Clients, and Suppliers & partners (details, contacts, notes, files — D7 "helpers, not locks"; V26, V98) | Full | Full | Full | Full | View |
| · change identifiers, decide matches (`partners.identify`) | ✓ | ✓ | ✓ | – | – |
| · merge organisations (`partners.merge`) | ✓ | ✓ | – | – | – |
| · set a side's status, bulk-assign owner and priority where no revenue is counted (`partners.assign` — V63) | ✓ | ✓ | ✓ | – | – |
| · credit limits and Sent to legal (`finance.credit_control` — V70) | ✓ | ✓ | – | – | – |
| · sign a person out of every device (`org.sign_out` — V74) | ✓ | – | – | – | – |
| Finance (Own = enter invoices and edit your own entries — owner decision 4) | Full | Full | Full | Own | View |
| · import files (`finance.import`, from P7) | ✓ | ✓ | – | – | – |
| · split or reassign credit (`finance.credit`) | ✓ | ✓ | ✓ | – | – |
| Overview (executive — V80) | Full | Full | View | – | View |
| Pipeline (tenders, partnerships) | Full | Full | Full | Own | View |
| Projects | Full | Full | Full | Own | View |
| Tasks | Full | Full | Full | Own | View |
| · assign to others (`tasks.assign`) | ✓ | ✓ | ✓ | – | – |
| KPIs (with achievements and challenges) | Full | Full | Full | Own | View |
| Reports (named editors edit drafts whatever their level) | Full | Full | View | View | View |
| Appraisal (always: your own; a manager: their direct reports — V96) | Full | Own | Own | Own | No access |
| My profile (everyone, always their own — V97) | Own | Own | Own | Own | Own |
| Settings — every group (admins only: none or Full — V97) | Full | – | – | – | – |
| Activity (the change log, the settings log, Recently deleted — its own page, V97) | Full | View | View | – | – |

---

## 9. Test strategy (d)

### 9.1 Layers

| Layer | Tool | Runs where | What it proves |
|---|---|---|---|
| Unit | Vitest | every PR | parsers (dates, money, headers, file-name export time), scoring maths, pace, formatting, `csvGuard`, `fetchAll`, registry consistency |
| Database | SQL test runner (ported from `scripts/qa/phase3`): each test file in its own rolled-back transaction, `test.as_user(email)` switches to `authenticated` with that person's JWT claims, `test.raises(sql, errcode)` uses a savepoint | every PR, on a database **built from zero** from the migrations — plain Postgres with the Supabase stubs (roles, `auth.uid()`, storage) in the builders' containers (Postgres 16 is installed there), and the real Supabase stack (Postgres 17) in CI | every rule of §3; access attacks; grants snapshot; concurrency; undo; import idempotency; the propagation flows at data level |
| End to end | Playwright against `next build` + the **Supabase stack started by the CLI** (`supabase start`: real Auth, real PostgREST, mail catcher) — it needs Docker, which runs in CI but **not** in the builders' containers (measured 28 Sep: the Docker client is installed, no daemon runs) | CI on every PR touching screens; nightly full. A builder whose container can start Docker may also run it locally | the same flows **typed into the browser**, figures read from the screen (§0 "trial values entered in the browser") |
| Sabotage | CI job applying `supabase/tests/sabotage/*.sql` (a broken migration) or `tests/sabotage/*.patch` (a broken screen file), then running the tests that file names | nightly and before each phase closes | every test can fail: a sabotage that leaves its named tests green fails the job |
| Performance | stress fixture generator (made-up data, §3.13) + timed queries | P4 onwards, nightly | the budget of §3.13; the 1,000-row cap never truncates |
| Checks | scripts | every PR | registry in sync; no direct table writes in app code; one Supabase client; no physical CSS; no hex colours in components; no VAT columns; no real-data patterns in fixtures (rule 7); migrations forward-only; `norm.rebuild()` called when `norm.*` changes; decision/port IDs in range |

House rules ported from the old suite: one promise per test file, named as a sentence; assert on what the person sees
(the printed figure), never on a word the fix might use; no fixed waits (web-first `expect`); test as a team member,
not only as admin (CP10); a test that recorded a hole fails once it is fixed (M37). **From the old app's lessons**
(V430): a test reads its setup back before acting on it (OA34); E2E runs vary the time zone, the locale and the clock
(OA20); an E2E walk of read-only pages counts the writes and expects none but the person's own bookkeeping (OA16); a
check or a test that could not run is red, never green (OA13).

### 9.2 The propagation flows — the six of §1a, and five more

Common trial world (made-up): department Commercial; people **Admin**, **Head**, **AM1** and **AM2** (account managers,
team members), **Editor** (report editor); partner **Test Co A** with identifiers email `a@test.example` and name
"Test Co A"; AM1 is its account manager from 1 Jan 2026; plan 2026 with KPIs **K-REV** (computed:
`finance.commercial_revenue`, Q3 target 100,000) and **K-B2B** (achievements: category "New deals" counts 1, Q3
target 3); an appraisal cycle Apr 2026–Mar 2027 with AM1's items "Sales vs plan" (`finance.revenue`, plan 400,000),
"New B2B clients" (`perf.achievements`, category code NEW-DEAL, target 4) and "Department revenue vs target"
(`perf.kpi_attainment`, K-REV). The whole department contributes to K-REV and K-B2B, and AM1 leads K-B2B (so both
show on AM1's My day). **Every flow starts from this world, reset between flows**; a flow that needs a record another
flow makes creates its own. Each flow is written twice — `FLOW-0n` in SQL and
`flow-0n-*.spec.ts` in the browser — and each ends with **Undo**, asserting every figure returns to its value before
the flow.

| # | Action | Must then show, everywhere at once |
|---|---|---|
| FLOW-01 | AM1 types transaction `INV-T-0001` in Finance → New invoice: Fully Paid, total 11,500, paid 14 Aug 2026, customer email `a@test.example`, one approved expense of 9,000 (v1; re-run with a made-up import file in P7) | match: Test Co A at level email · credit: AM1 × 1.0 · partner card: revenue Aug 2026 = 11,500, cost 9,000, margin 2,500, cost status Provisional until a billing invoice with its DPIN is entered, then Final · K-REV: August +11,500, Q3 = 11,500, pace recomputed · AM1's My day: new invoice for Test Co A and K-REV's pace · August monthly report draft: revenue tile and revenue by service include 11,500 · AM1's appraisal "Sales vs plan" actual = 11,500 (2.875 % of plan). **Then:** the status edited to Void → every figure above drops back. **In P7:** the same file twice → nothing changes; a newer file wins per field; an older file only fills blanks; the hand-entered row is never touched |
| FLOW-02 | AM1 closes task "Sign Test Co A" and logs the offered achievement "New deals", partner Test Co A, evidence file, evidence date 3 Sep 2026 | partner card: achievement listed, K-B2B Q3 contribution 1 · K-B2B: September +1, Q3 = 1, drill-down reaches Test Co A and the evidence file · September report draft: suggestion to cite it; a line citing it · AM1's appraisal "New B2B clients" = 1. **Then:** change the evidence date to 2 Oct 2026 → moves to October and Q4 everywhere |
| FLOW-03 | FLOW-01's invoice is typed; Head sets AM2 as Test Co A's account manager from 1 Sep 2026; a second invoice, paid 10 Sep, is typed | the Aug invoice stays AM1's, the Sep one is AM2's: both people's person-scope measures, My day and appraisal lines change accordingly · a manager splits the Sep invoice 50/50 with a note → both see half |
| FLOW-04 | AM1 types an invoice for the customer name "شركة تيست كو أ", no email, and picks no partner → **Needs a decision**; a manager decides "This is Test Co A" | before: no partner, in the queue with its riyals · after: the name is an identifier of Test Co A, the invoice (and any past one with that name) re-links, every total above updates · removing the identifier returns it to the queue · the same name added to a second partner is refused (one partner only) · a typed invoice whose tax number is Test Co A's VAT **and** another partner's CR (the same level) → conflict naming both · a typist who instead picks Test Co A gets an entry pin and a suggested identifier; when a manager accepts it, the pin is cleared and the match holds by itself |
| FLOW-05 | An achievement dated 3 Sep is logged; Editor issues the September report citing it; a manager then removes the achievement with a reason | K-B2B, partner card, AM1's appraisal and the **Q3 quarterly** draft update · the September report's snapshot hash is unchanged and it shows "1 figure changed since issue" · a correction is issued: new number `-C1`, the old one marked superseded, both readable |
| FLOW-06 | FLOW-01's invoice is typed; Head changes K-REV's Q3 target 100,000 → 80,000 effective 15 Sep 2026, and switches the revenue definition to "margin" effective 1 Oct | pace and status recompute; the report draft tiles recompute; AM1's "Department revenue vs target" line rises from 11.5 % to 14.4 % of target (11,500 ÷ 80,000) · reading K-REV's target "as of 14 Sep" still returns 100,000 · the change log holds both changes with their effective dates · September still uses revenue, October uses margin |

Plus five flows the blueprint, the finance finding and the owner's rules imply: **FLOW-11 a tender's life** (V80: a
made-up Government-segment partner's tender moves Identified → Submitted on 10 Sep → Awarded 500,000 on 20 Sep; Q3
"tenders submitted" rises by 1 and stays 1 if a second tender is later Lost; "awarded value" shows 500,000; Log
achievement (Contract signed) raises "government entity contracts" by 1; the Overview with segment Government shows all
three and the funnel; Undo of the award reverts every figure); **FLOW-10 live names** (V58: rename
helper AM2's display name and partner Test Co A's name → the task, its helpers, the activity timeline, the
notifications, the file names, the partner card and an **issued** report's screen and PDF all show the new names, and
the issued report's hash is unchanged); **FLOW-09 billing and the tax invoice** (two made-up
transactions of 6,000 and 4,000 with approved expenses 5,000 and 3,000; a billing invoice of 10,000 re-billing both,
its DPIN of 2,000 and a receipt of 10,000: revenue stays 10,000 — the billing invoice adds nothing; collections show
10,000 received on the billing invoice; both transactions turn Final; the check passes; a billing total of 9,500 or a
DPIN of 10,000 on a non-commission product is flagged; an expense typed on the billing invoice is refused);
**FLOW-07 year change** (copy plan 2026 → 2027, rename K-B2B, remove K-REV:
2026 reports and appraisals still show the 2026 plan; a December achievement re-mapped to 2027 is a logged include)
and **FLOW-08 two people, one task** (both edit different fields → both kept; the same field → the second is told who
changed it and when, and chooses).

### 9.3 Other suites (IDs are prefixes; each has its sabotage)

`ACC-*` access attacks (§5) · `GRANTS-*` · `CONC-*` optimistic concurrency · `UNDO-*` (per field, all-or-nothing,
redo, import undo) · `NORM-*` (folding table: every Arabic form, digits, stop words, phones with `00966`/`0966`/`+966`,
L.L.C.) and `NORM-DRIFT` · `IDN-*` (ported IDN-01…14, now against the live view; V411 a closed client ID keeps its past rows; V422 one open prepaid and one open postpaid) · `MATCH-*` (V420: an unknown client ID stops in Needs a decision and never falls through; V421: a name never matches by itself) · `FIN-*` (ported D1/D21 tests: statuses, top-ups, billing invoices never revenue, collections on billing invoices, expenses refused on billing invoices, exclusions win, credit notes never count nor reduce revenue, a split receipt adds up, Loss flagged, VAT never stored) · `CHK-*` (the reconciliation and cost status of §3.6) · `COST-*` (ported
COST-01…11, P7) · `CP-*` (ported clients/promo, P7) · `D24-*` (income by service adds up to the revenue tile) · `IMP-*` (P7: any
order, newer wins per field, blank never wipes, same file twice, resume after a stopped chunk, held rows listed) ·
`KPI-*` (sources, aggregation, cumulative pace, not measured ≠ 0, effective-dated targets and mappings) · `RPT-*`
(snapshot frozen, drift, correction numbering, legacy PDFs in the archive, compare aligns sections and marks
differences, entity tokens render live) · `PRT-*` (sides — V98: the Finance tab only with the Client side on; each side's status; the one status chip picks the most urgent flag; period switch totals equal Finance for the same filters; the Finance deep link
reproduces the card's figures) · `CTR-*` (contract status Active / Expires in N days / Expired / Not started at the
boundaries, from 30 days; a reminder on each of 60 · 30 · 7 days, none when the contract's switch is off, its own
days when set; the first reminder makes one renewal task; terms before → after compute their difference and link their
achievement) · `ALR-*` (each alert fires once per day per person, links to its record,
respects its setting; snooze hides until the time) · `FILE-*` (the display name follows the pattern and the linked
records live; a rename renames; the download carries it; unsafe characters replaced) · `VIEW-*` (saved views personal
and shared, restored from the URL) · `BULK-*` (one request, one Undo) · `DEV-*` (V74: idle 30 days → new code; per-device and admin sign-out refuse the next request) · `NAME-*` (V77: the
trade name shows everywhere; the official name on a contract file and a tender; editing a name re-points its identifier in
one request) · `ARB-*` (V76: a list entry without its Arabic label is refused; a category's Arabic template drafts the
line; the Translate button is absent when the browser has no Translator API) · `RLINE-*` (V79: an achievement typed in a
report exists once, marked added from report, and counts once; a note line with a money figure is refused and never
counts) · `PVIEW-*` (V78: the KPI chip keeps exactly the partners in the KPI's drill-down for the period; a saved
combination reopens from its URL; each person's default view) · `PAY-*` (V87: an invoice with a postpaid client ID shows postpaid, one with only a code shows code; the chip's counts add
up to the list) · `CALL-*` (V88: demo set and demo held counted once per person per week) · `CRL-*` (V92: a limit of 0
shows Prepaid only and needs its approver) · `LOAD-*` (V91: team load equals the person's open tasks and partners) ·
`KRD-*` (V93: only a lead or a manager writes a reading; the check-in alert fires once on the day for a lead with no
reading) · `PIPE-*` (V80, V99: stage history; a Source required; reasons for Lost;
Onboarded switches the side on and sets Active with one Undo; a skipped optional Proposal is not recorded; the measures
by period and segment) · `SIDE-*` (V98: a client ID or code refused on an organisation without the Client side; both
sides on, two statuses, the worse chip; a supplier gaining the Client side keeps its history; the conversion of P3-8a's
roles loses no organisation, identifier, owner or status) · `DATE-*` (V400: `happened_on` never after the logged day;
periods, task time and the on-time measures read `happened_on`; a past-dated entry raises no notice or flag; "logged late"
only after `app.go_live_on` and only past `work.late_days`; a backfill entry is never late) · `ACT-*` (V401: an activity
with a next step makes one task; stale after 21 days without either; demo outcomes counted) · `STEP-*` (V401: the four
appraisal steps in order; the manager's draft invisible to the person until Shared) · `VIS-*` (V96: an appraisal absent
from search, exports, notifications, My day and history for everyone but the three) · `SETS-*` (V97: a value in use
cannot be hard-deleted; retire-and-replace re-points every record in one request with the count; the impact preview
changes nothing; a seed never overwrites an edit; Revert works past the Undo window; a non-admin has no Settings page) · `PST-*` (V62: status history read as of a date; at risk and lost need a reason; the at-risk chip; the report section's
counts by reason) · `PROS-*` (V63: bulk assign is one request and one Undo; a manager cannot reassign a partner with
revenue; Log activity on an organisation with no task lands on its Activity tab; the week's pipeline count feeds the appraisal item) ·
`SEG-*` (V64: invoice → project → partner resolution; revenue by segment adds up to the revenue tile) · `CODE-*` (V65:
terms with history; a second live code refused without a reason; a campaign code's invoices credited to nobody and
listed apart; sales by code adds up) · `ACH-*` (V66: avoided = exposure − actual loss; an amount field mapped onto a
money KPI is refused; an MoU never counts as a new client and sets the partner to Prospect unless Active) · `CHL-*`
(V69: an escalated critical challenge is counted once) · `PFN-*` (V70: the limit in force as of a date; wallet balance =
top-ups − consumption; Sent to legal stays in outstanding) · `SRCH-*` (V67: a word in an issued line is found; a
partner renamed after issue is found by its new name) · `APR-*` (self-registration flags; an undated or evidence-less
achievement never counts in appraisal while counting flagged on the KPI page — V68; scoring against a hand-computed copy of the official form's
maths, weights both ways, cap, lock) · `PERF-*` · `UI-*` (every page in Light/Dark/Colorful/Direct, both densities, at 400 px / 1,500 px; no hint or banner component; every entity a link;
`dir="rtl"` with pseudo-Arabic has no physical-direction leaks; every string comes from the catalog).

### 9.4 Definition of done for any PR

The PR's own tests pass, each new test was seen to fail under its sabotage (named in the PR), the full SQL and unit
suites pass on a database built from zero, E2E passes for the areas touched, the checks pass, the grants snapshot is
updated on purpose if it changed, and nothing real is in the diff (rule 7). **The PR description lists the V-numbers
it implements and states "checked against DECISIONS.md at <commit>"** (V94).

---

## 10. Environments (e)

**Measured on 28 Sep (read-only):** the Supabase organisation "abdoulmagd911's Org" is on the **free plan with two
active projects** (`direct-business` — the old app — and `directksa-performance` — the appraisal tool), both
eu-central-1. Supabase allows **two active free projects per owner, across every organisation the owner administers**;
paused projects do not count. The Vercel team "abdoulmagd911's projects" holds two projects. This environment's network
refuses `*.supabase.co`, `vercel.com` and `cdn.sheetjs.com`; the Supabase and Vercel connectors work.

**Done on 28 Sep (V21, V84):** the owner does not need the old app at all. The oversight **paused `direct-business`**
(the old app's database; its data is kept and restorable from the Supabase dashboard for as long as Supabase allows a
paused free project) and **created `direct-commercial`** on the free plan — ref `kimadjvaxgiqzjaukuqg`, eu-central-1.
The appraisal tool (`directksa-performance`) stays live, so the two active free projects are `direct-commercial` and
`directksa-performance`. The **Vercel project `direct-commercial`** exists too (root `v2`, Next.js, production branch
`v2/main`, fra1, builds skipped when `v2/` is unchanged). The old app no longer runs.

| What | Exactly | Plan and cost | Who |
|---|---|---|---|
| **Supabase project** `direct-commercial` | region eu-central-1 (Frankfurt, as today), Postgres 17; Auth: sign-ups off, email OTP; Google and Zoom providers added when their keys exist (V23, deferred); **site URL and redirect URLs list the project's `vercel.app` address and, from the domain move, `https://www.directksab2b.com` (and the bare domain)**; Storage buckets `files` and `images` (private); `pg_cron` on | **Free** | created by the oversight on 28 Sep (ref `kimadjvaxgiqzjaukuqg`); settings by builder A with the Supabase connector |
| **Vercel project** `direct-commercial` | this repository, root directory `v2`, framework Next.js, production branch `v2/main`, preview deployments on every PR, builds skipped when `v2/` is unchanged, function region fra1; env vars: Supabase address and publishable key (public by design), service key (server-side only) — **pasted into Vercel by the owner only** (V84). Until the domain moves it answers on its `vercel.app` address | **Free** (Hobby — V46) | created by the oversight on 28 Sep; keys by the owner |
| **The domain** `directksab2b.com` | **the same domain** (owner, 28 Sep — V13). The old app no longer runs, so the domain moves **as soon as the first v2 deployment renders the sign-in page** (plan P3-2), not at go-live: removed from the old Vercel project, added to `direct-commercial` (Vercel → Domains), and the Supabase Auth site URL / redirect URLs list it. Until go-live only allow-listed people get past the sign-in page, and the database holds trial values only. The Google and Zoom OAuth settings need no change for the domain (their redirect is Supabase's own callback address), but Google's authorised JavaScript origins, if set, list both addresses | free | the owner or the oversight, when P3-2's sign-in page renders |
| **Google OAuth client** · **Zoom OAuth app** | §4, steps 1–2 — **deferred** (V23): until they exist, sign-in on the cloud project is by emailed code only, which itself needs the mail sender | free | Direct's Workspace and Zoom admins, later |
| **Mail sender** | §4, step 3 — Resend's free tier (V24); DNS records on `auth.directksa.com`. **Needed before real users** (the code is the door — V59); until then staging uses Supabase's built-in sender, which reaches the owner's own account only | free tier | whoever manages the DNS |
| **CI** | GitHub Actions, `.github/workflows/v2.yml`, runs only when `v2/**` changes; the full test stack, including sign-in by emailed code through the stack's mail catcher | free for public repositories | builder A |
| **Backups for real data** | the paid plan at go-live (V22) | about 25 USD a month (the organisation's plan; with two active projects, compute for the second is extra, about 10 USD) | owner decides at go-live |

**The builders' own containers**: plain Postgres (16, installed) for the SQL suite, Vitest, `next build`. No Docker
daemon runs there and the cloud hosts are refused (measured), so the full Supabase stack and E2E run in CI, the cloud
projects are reached through the connectors, and screens are looked at on each PR's Vercel preview. If an environment's
network setting is widened (the owner's click — CLAUDE.md), builders may also run `next dev` against staging.

The old Vercel project still builds a preview of the **old** app for every pushed branch, `v2/*` included. That is
harmless and costs nothing; disconnecting or removing that project is the owner's call.

**Order of steps:** (1) done 28 Sep — `direct-business` paused, `direct-commercial` created in Supabase and Vercel
(V84); (2) the owner pastes the keys into Vercel; (3) builder A applies the first migrations (P3-1) and ships the sign-in
page (P3-2) to `v2/main`; (4) **as soon as that deployment renders the sign-in page**: the domain moves to
`direct-commercial` and the Auth site URL / redirect URLs list it; (5) the mail sender before real users, then (later)
the Google and Zoom keys; (6) at go-live: backups (V22), the reset, the staged pilot.

Secrets live only in Vercel's server environment and Supabase's settings — never in the repo, and **only the owner
pastes keys into Vercel** (V84); builders never see the service key. **The Vercel project's settings are changed by the
owner in Vercel, never from the repository** (V427). No deploy secret is
stored in GitHub: builder A applies migrations to the cloud project at merge from the merged commit (checksum-checked),
after the SQL suite has passed on a database built from zero. The very first admin (the owner's account, D8) is created
once by builder A with a one-off statement the owner approves, logged under the System person — never in a migration
file (rule 7, D17).

Free-plan limits to watch: database 500 MB, file storage 1 GB, 5 GB egress, a project pauses after 7 days without any
request, no downloadable backups. The stress fixture never goes to the cloud project; only trial values do.

**Cloud and audit house rules from the old app** (V427): every deployed function's source is committed in the PR that
deploys it (OA29); nothing is created in the cloud except by a migration, and each audit runs an **outsider check** —
the publishable key, no sign-in — against every table and bucket (OA30); after every merge the live site is confirmed
to serve the merged commit through a **build ID the app shows** (the commit in the page's footer and at `/api/build`;
OA31); a live audit runs as a named QA person and cleans up after itself (OA35).

---

## 11. Go-live and moving data (f)

**Go-live = the code and the structure proven working** (owner, 28 Sep — decision 4). Then the team types the 2026
invoices in the browser; imports follow later. All data in the old app is test data (D9).

| What | How | Proof |
|---|---|---|
| People, teams, roles, allowed emails | Typed in Settings | every person signs in with the emailed code (V59) |
| Plan 2026 (objectives, KPIs, targets, categories) | Typed in Settings from the Departmental KPIs sheet | the KPI sheet export matches the strategy team's sheet cell for cell |
| Appraisal templates, grade scale, points tables | Seeded **from the online appraisal tool** (it wins over the Excel form; gaps filled from the form — owner decision 2) from an export of its data the owner hands over (rule 8), kept out of the repo (rule 7) and loaded by a person through the importer; then edited as settings | every template's weights, bands and items equal the tool's |
| Past appraisals | the same export, imported as `appraisal.legacy` (read-only, labelled legacy — 08 A14) | row count per person and cycle |
| Partners and identifiers | Typed or created while entering invoices; later the Payments corporate clients list (P7) | every identifier present once; conflicts listed, not guessed |
| 2026 invoices, expenses, DPINs, receipts | **Typed by the team** in Finance → New invoice | the owner and the oversight compare monthly revenue with Payments |
| Older history (for "same month last year") | Until the import phase loads it, last year's monthly figures are typed once as KPI readings, or the tiles say "not measured" (V31) | — |
| Tasks, achievements, reports of the old app | **Not moved** (test data, D9); ClickUp KPI records imported once if the owner wants (08 C5) | — |

**Cut-over — a staged pilot** (V71): rehearse on the staging project; reset it (a v2 `golive_reset`, backup first, only
on the owner's word — D9) — the domain already serves v2 (§10, V13); then **a small pilot group** named by the
owner signs in first — including Finance colleagues with View on Finance — and types and checks a first month; when the
owner says so, **everyone** is switched on (each person's `can_sign_in`; no code change). **Training** (V408): the pilot
group gets one live session; after it, every third or fourth update ships with a short video (minutes long, recorded
in the app on made-up data) instead of another session.

**Go-live house rules from the old app** (V428, V429): before go-live, every door that can still serve or write is
listed and closed — old hosting projects and their aliases, storage copies, edge functions, schedules, old domains
(OA28); the backup mode is confirmed and **one restore drill** is run (OA36); a backup is **never restored over live
tables** — it is restored into a separate schema, compared, and only what a person approves is applied, on the owner's
word (OA3).

**Out of v1** (recorded, not built — V70): guarantees (promissory notes), supplier payables and statements, referral
terms.

The old app has been unavailable since its database was paused on 28 Sep (V21); its data stays restorable while
Supabase allows.

---

## 12. What is ported, and from where

| Proven part | From | To | Tests to port |
|---|---|---|---|
| (P7) All-invoices export: column map, statuses, top-ups, D26 twins, billing subset-sum, date and money parsers | production `js/41`, `js/65`; `scripts/sql/d1-money-model.sql`, `d26-transaction-date.sql` | `modules/finance/import/invoices.ts`, `api.import_payments_invoices`, `finance.*` views | phase3 D1/D21/D26 tests; `probe-d1-invoice-import` scenarios |
| Money rules D16, D21, D23, D24, D25 | `e-money-rules.sql`, `d1`, `d23`, `d24` (its starting lists stay a script applied only on the owner's or oversight's word, as today — D17), `d25` | §3.6 | E-*, D23-*, D24-* |
| (P7) Cost readers (Transaction Expense, Expense Invoice, Revenue Report), big-file reading | `claude/clever-franklin-vukl22-cost`: `js/121`, `cost-import.sql`, `cost-fallback.sql`, `checks/cost-acceptance.sql` | `core/import` (reader), `modules/finance/import/cost.ts`, `api.import_payments_cost` | COST-01…11, the 258k-row freeze test |
| (P7) Corporate clients and promo codes readers | `…-clients`: `js/122`, `clients-promo-import.sql` | `modules/finance/import/clients.ts`, `promo.ts` | CP-01…07 |
| Identifiers, folding, the matcher, clients → identifiers | `…-ident`: `company-identifiers.sql`, `js/123` (the JS copy is **not** ported — A10) | §3.5 | IDN-01…14 re-pointed at the live view |
| KPI engine plan (cumulative pace, statuses, recorded figures) | `…-kpi`: `docs/reference/d27-kpi-engine.md` | §3.8 | new KPI-* |
| SQL harness (Supabase default grants, `auth.uid()` stub, per-test rollback, `as_user`, `expect_fail`) and TM_AFTER sabotage | `scripts/qa/phase3/*` | `v2/supabase/tests` runner | — |
| Browser sabotage (`SABOTAGE=X`, "…but this was sabotage X" guard) and one-promise probes | `scripts/qa/probe-*.mjs`, `scripts/qa/README.md` | `v2/tests/e2e`, `v2/tests/sabotage` | — |
| Stress world idea | `scripts/qa/stress-data.mjs` | `v2/scripts/stress-data.ts` (made-up) | PERF-* |
| `csvGuard`, one search haystack, Arabic/phone search folding | CP5, M38, M64 | `core/export`, `api.search`, `norm.*` | — |

**Old rules that stay binding in v2** (cite them in code as today): P1, P5, P6 · D7 (undo, owner told) · D9 (test data,
reset only on the owner's word) · D16 · D17 · D19 · D20 · D21 · D23 · D24 · D25 · D26 · M1 · MF1, MF5, MF7–MF11 ·
M27, M39, M48, M52, M53, M60 · CP5 · DP4 (rule 7). **Not carried** (they describe the old code): the `js/NN` layer rules,
`app_state`, the mock, the js/21 dictionary, passwords (D15, CP6), DirectFont (D4 — replaced by the v2 design), the
Finance role floors (replaced by capabilities). v2's own decisions start a new file, `docs/v2/DECISIONS.md`, with the
ID ranges of A18. **MF10 is read in v2 as "only paid units count"** (V418): the unit is the transaction (V1), and MF10's
done-but-uninvoiced split is the Finance overview's "Not yet invoiced: Ready / Pending" line (V424), never in revenue.
