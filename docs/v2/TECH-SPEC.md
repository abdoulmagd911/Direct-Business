# v2 Commercial app — technical specification

Status: **draft for the oversight's review**, 28 Sep 2026. Written by the architect session from the owner-approved
blueprint (`BLUEPRINT.md`, v0.7), the old app's rules (`docs/DECISIONS.md`, `docs/LANDMINES.md`), the second builder's
handover (`docs/REBUILD-HANDOVER-2.md` on `claude/clever-franklin-vukl22`) and the code on the production branch. The main
builder's handover was never written (V48); that builder's work was read from the production branch's code.

Who reads what: builders A and B build from this file; `BUILD-PLAN.md` says in which order; `OPEN-QUESTIONS.md` holds
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
| A18 | Two builders collided on decision numbers and file numbers | Migrations are timestamped (no numbers to collide). v2 decision IDs: architect/oversight V1–V99, builder A V100–V199, builder B V200–V299. Test ports: A 9300–9399, B 9400–9499 | `check-v2-ids` |
| A19 | Screens full of explanations, notes and warnings (the owner's biggest complaint about the old app) | Screens carry data and controls only; every entity is a link (§2.5) | UI kit without banner/callout/hint components; `ui-no-hints` check; `UI-entity-links` walk |

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
| API surface | PostgREST exposes **one schema, `api`**: read views (`security_invoker = on`) and write functions. Business tables live in private schemas (`core`, `company`, `finance`, …) | A6, A8: a single, testable door | Exposing tables directly (the old app's silent-refusal problem) |
| Auth | Supabase Auth: Google (Workspace, `.com`) and Zoom (`.net`) OAuth + emailed one-time code; **no password provider**; sign-ups off; allow-list of emails per person (`core.person_email`) | §0 sign-in decision | Passwords (owner ruled out); email-only (impersonation, §10) |
| Files | Supabase Storage, one private bucket `files`, signed URLs of 600 s (M21) | Proven | Public buckets |
| Jobs | `pg_cron` (in Supabase free) for the two scheduled things: recurring tasks at 00:05 Riyadh, and nightly consistency checks | No extra service, no cost | Vercel cron (Hobby: once a day, no retries) |
| Styling | **Tailwind CSS v4** driven by CSS variables (design tokens), switched by a `data-theme` attribute on `<html>` (light, dark, colorful or direct) and a `data-density` attribute (comfortable or compact); components from **shadcn/ui** (Radix primitives, copied into the repo) | Tokens → three themes from one set (§0 design); Radix gives focus, Escape and ARIA right (M93) | CSS-in-JS: runtime cost, harder RTL |
| Tables | TanStack Table + TanStack Virtual (44–52 px rows comfortable, 32 px compact; sticky header; virtualized) | Dense tables with thousands of rows stay smooth | Heavy data-grid libraries |
| Forms | react-hook-form + zod; **each dialog creates its own form instance** and drops it on close (§0) | The old app's shared form state leaked between dialogs | Global form stores |
| Other UI | cmdk (Ctrl K), sonner (toasts with Undo), lucide icons, Recharts (tiles/sparklines only) | Small, maintained | — |
| i18n | next-intl, message catalogs `messages/en.json` and `messages/ar.json`; `dir="rtl"` from day one; Arabic hidden behind a setting until tested (§0) | Arabic-ready without shipping untested Arabic | Hand-rolled dictionaries (the old js/21) |
| Dates | date-fns + `@date-fns/tz`, zone `Asia/Riyadh`; `Intl` formats always with `calendar: 'gregory'` and `numberingSystem: 'latn'` | **`ar-SA` defaults to the Islamic calendar** — Gregorian must be forced explicitly (§0 "never Hijri") | Moment |
| Files in/out | Import: SheetJS CE 0.20.x inside a Web Worker — the official tarball **vendored** under `v2/vendor/` with its published checksum (the npm `xlsx` package is stuck at 0.18.5 without later security fixes, and `cdn.sheetjs.com` is refused by the builders' network policy, measured 28 Sep; a one-off GitHub Actions job fetches it and opens the PR); a streaming CSV reader (ported from js/121). Export: ExcelJS (styled KPI sheet), CSV with BOM | Ported and proven on the 258k-row file | Reading big XLSX on the main thread (old backlog item) |
| Documents | PDF: `@react-pdf/renderer` from the frozen snapshot for English — its Arabic letter-joining and right-to-left support are weak, so an Arabic PDF spike runs early in P6-2 and falls back to the browser's print-to-PDF of the report page; PPTX: the department's own template (V34) **filled** by editing its XML (JSZip: placeholders replaced, repeating slides duplicated) — pptxgenjs cannot open an existing file, so it is used only for slides the template lacks; fonts embedded (Readex Pro, IBM Plex Sans/Arabic/Mono — all SIL OFL, self-hosted with `next/font`) | Deterministic re-rendering of a frozen report; no font CDN (the old DirectFont trouble) | Server-side headless Chrome (too heavy for Vercel Hobby) |
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
- **Ownership by folder** (P4, the handover's lesson): builder A owns `v2/supabase/**`, `v2/src/server/**`,
  `v2/src/modules/*/data.ts`, `v2/src/modules/*/module.ts`, `v2/tests/db/**`; builder B owns `v2/src/app/**`,
  `v2/src/ui/**`, `v2/src/modules/*/screens/**`, `v2/messages/**`, `v2/tests/e2e/**`. Shared files (`v2/package.json`,
  `v2/src/core/**`) change only in a PR that says so in its title, and the other builder reviews it.

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
      (app)/my-day/  companies/[[...id]]/  finance/[[...tab]]/  projects/[[...id]]/  tasks/[[...id]]/
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
      org/ settings/ companies/ finance/ projects/ tasks/ perf/ (plans, KPIs, achievements, challenges)
      reports/ appraisal/ my-day/ search/
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
   function — screens never add up rows they fetched (A7).
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

**Source of truth for the look:** the owner's design system page ("Commercial Design System",
https://claude.ai/artifact/LhgpWwKiMxQtQiQmXjco64) and the screens canvas (https://claude.ai/artifact/QRysGjaefjvGbDxNvfYbLW,
12 artboards). Where this section and those pages differ, the pages win; builder B reads them before P3-3.

- **Shell.** Side drawer 232 px pinned / 56 px collapsed (an icon rail with tooltips; unpinned it opens as an overlay
  on hover or focus and closes on Esc; below 1,024 px an off-canvas sheet). Order: My day, Companies, Projects, Tasks,
  Finance, KPIs, Reports, Appraisal; Settings at the foot above the person's profile (avatar, nickname, badge). Top bar
  60 px: search (Ctrl K), Create, bell, the profile chip (avatar and nickname) — no page titles in it. Page header:
  breadcrumb, title, one primary button, at most two secondary, the rest in a ⋯ menu. Each area is one page: list on
  the start side, **detail panel 480 px** on the end side (full page under 900 px); every record has its own URL; at
  most one tab row, its state in the URL; filters are chips above the list (dashed = available, solid = applied with
  "field: value" and ✕; a chip keeps or drops rows and shows its count — M102/M89).
- **Four themes** (owner, 28 Sep): **Light**, **Dark**, **Colorful** (the blueprint's values, unchanged) and **Direct**
  (orange and charcoal: drawer and top bar #23221F, nav text #ECE8E1, nav muted #A8A298, active nav text #F08A45;
  bg #F6F4F0, surface #FBFAF7, raised #FFFFFF, border #E4DFD6, strong #857E73, text #1F1E1C, muted #5E5A53; accent
  fill #E4702A, accent hover #F07E36, **label on accent #1F1E1C — never white**; link / orange text #A64B12;
  selected-row tint #FBE6D6; success #2E7540, warning #7A5E00, danger #B3203A, info #2D5FA8 — every text pair AA).
  Each person chooses their theme (My profile); an admin sets the default.
- **Tokens.** One file `src/ui/tokens.css` declares, for each `[data-theme="light|dark|colorful|direct"]`, the full
  set of the design system page: `--bg`, `--surface`, `--raised`, `--border`, `--border-strong`, `--text`, `--muted`,
  `--link`, `--accent`, `--accent-hover`, `--on-accent`, `--accent-soft` (selected row), `--focus`, `--success`,
  `--warning`, `--danger`, `--info` and their `-soft` tints, `--nav-bg`, `--nav-text`, `--nav-muted`,
  `--nav-active-bg`, `--nav-active-text`, chart colours `--c1`…`--c6`, `--shadow-1`, `--shadow-2`; plus the scale
  (type 11.5/13/14/16/20/24/30 px, spacing on a 4 px grid, radius 4/6/10/pill, three elevations). Tailwind maps
  utilities to the tokens; **no hex or Tailwind palette colour appears in components** (lint). Two rules the lint
  also checks: `--accent` is a **fill only** — text in the accent colour uses `--link`, and a label on an accent fill
  uses `--on-accent`; colour never carries meaning alone (a status chip always shows its word).
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
- **Everything links.** Every company, invoice, task, achievement, KPI, report line and person shown anywhere is an
  `<EntityLink>` to its own record (names in running text in `--link`, titles in lists in text colour with a light
  underline, IDs in mono inside an entity chip); a UI test walks each page and fails on an entity shown as plain text.
- **Right-to-left.** Only logical CSS (`ms-/me-/ps-/pe-/start-/end-`, `text-start`); lint refuses physical left/right
  utilities; direction-bearing icons flip under `dir="rtl"` (never logos, check marks, time axes or numbers); digits
  stay Latin in both languages (`ar-SA-u-nu-latn`, Gregorian — V40).

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
admin grants in `core.person_department (person_id, department_id)` for cross-department visibility; companies are the exception: one company record serves the
whole firm. Row-level visibility is "rows of the departments I belong to" — with one department in v1 that is
everyone in Commercial, and a second department later is separated without a migration of old rows.

---

## 3. Data model (c)

### 3.0 Conventions

- **Schemas.** `core` (organization, people, access, settings, files, notes, numbering), `audit`, `notify`, `company`,
  `finance`, `work` (projects, tasks), `perf` (plans, KPIs, achievements, challenges, period targets), `report`,
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
- **Setting lists** (`LIST`): `key text unique` (stable code), `name_en text not null`, `name_ar text`, `sort int`,
  `active bool default true`. A list entry is retired, never deleted, and stays readable where a record holds it (M40).
- **Money** `numeric(14,2)`, SAR. **Counts** `int`. **Ratios** `numeric` as fractions (1.00 = 100 %).
  **Calendar dates** `date`; **instants** `timestamptz` (stored UTC, shown in Riyadh — D20). Riyadh helpers:
  `core.riyadh_today()`, `core.riyadh_day(timestamptz)`, `core.month_of(date)`, `core.quarter_of(date)`; weeks start on
  Sunday (setting). No Hijri anywhere.
- **Names** of people and companies: `*_en` required, `*_ar` optional; display falls back to the other language (M94).
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
                  my companies (email only once the mail sender exists — V24); seen jsonb
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
- Starting scalar settings: `audit.undo_window_hours` 24
  (D7) · `work.no_update_days` 7 · `work.week_starts_on` sunday · `work.meeting_note_on_time_days` 1 ·
  `company.match_order` [client_id, vat_cr, discount_code, email, phone, name] · `company.name_stop_words` (the form
  words list of §3.5) · `company.credit_date` revenue_date (which date decides whose credit an invoice is — V27) ·
  `finance.revenue_definition` (§3.6) · `finance.collection_due_days` 30 · `finance.unbilled_after_days` 30 (a transaction with no billing invoice after
  that is flagged) ·
  `finance.cost_estimate` on (D23) · `perf.pace_thresholds` {on_track 1.00, slightly_behind 0.90, at_risk 0.70} ·
  `report.due_day` 5 · `app.arabic_enabled` false · `app.default_theme` direct (Q32) · `app.default_density` comfortable · `auth.email_code_enabled` false ·
  `work.reminder_days_before_due` 1 · `notify.kinds_enabled` (every kind on) · `app.export_formats` [csv, xlsx] ·
  `files.max_mb` 20.

### 3.3 Change log, undo and notifications

```
audit.request  id uuid pk; at; actor_id → core.person; kind ('ui','import','job','system','undo');
               label_key; label_args jsonb (e.g. 'task.closed' {number}); reason; batch_id → io.batch;
               undo_of → audit.request; undone_by → audit.request; undone_at
audit.change   id bigserial pk; request_id not null; at; table_name; row_id uuid; action ('insert','update','remove','restore');
               fields text[]; before jsonb; after jsonb; version_after int
               index (table_name, row_id, id desc); index (request_id)
notify.notification  id; person_id; kind ('assigned','helper_added','mentioned','changed_by_other','decision_needed',
               'report_issued','appraisal_step','import_done'); entity_table; entity_id; request_id; actor_id;
               created_at; read_at          index (person_id, read_at nulls first, created_at desc)
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
    (an identifier another company holds) is refused and names the holder.
  - Undo is itself a request (`kind 'undo'`, `undo_of`); undoing it is redo. The toast's Undo button calls this with
    the request id the command returned.
  - An import is undone as one request: facts it inserted are removed, fields it changed are restored — refused if a
    later import changed the same rows (it names them: "undo the later import first").
- **Notifications.** Assignment, helper, mention, report issued and appraisal steps are pushed by the API function
  that caused them. "Changed by someone else" is fanned out by `audit.end()` to the owners of every record the request
  touched (the entity's `owners` function in the registry), one notification per person per request, never to the
  actor. Due and overdue items are **computed live** (bell count and My day), not stored. In-app only in v1.

### 3.4 Companies, identifiers, contacts, files

```
company.category  LIST          company.tier  LIST
company.company   STD SOFT; name_en not null; name_ar; legal_name_en; legal_name_ar; trading_name; category_id; tier_id;
                  website; city; country; address; notes; status ('active','archived'); merged_into_id → company.company;
                  logo_file_id → core.file (uploaded from the company header);
                  client_since date   -- typed; until Payments history is imported, marks a client as not new (V31)
                  -- no VAT, CR, client ID, email or code columns: those live only in company.identifier (one home)
company.identifier  id; company_id not null; kind ('payments_client_id','vat','cr','discount_code','email','phone','name');
                  subkind (client ID: 'prepaid'|'postpaid'|'tender'; name: 'en'|'ar'|'trading'|'alias');
                  value_raw not null; value_key not null; norm_version int; reason not null (§3 "each with a reason");
                  valid_from date; valid_to date (discount codes only, check to ≥ from); source ('person','decision','import','merge');
                  note; created_at; created_by; removed_at; removed_by; remove_reason
                  unique (kind, value_key) where removed_at is null and kind <> 'discount_code'
                  exclude using gist (value_key with =, daterange(valid_from, valid_to, '[]') with &&)
                          where kind = 'discount_code' and removed_at is null
                  -- a value is never rewritten or moved: remove it and add it to the right company (ident branch rule);
                  -- put back only while no other company holds it
company.identifier_block  STD SOFT; kind; match ('exact','domain'); value; reason
                  -- values that can never be identifiers: staff email domains, the Payments test VAT, test customers
company.individual_name   STD SOFT; name_raw; name_key unique      -- "Individual (not a company)" (D25)
company.account_manager   STD SOFT; company_id; person_id; effective_from date not null; effective_to date; reason
                  exclude using gist (company_id with =, daterange(effective_from, effective_to, '[)') with &&)
company.contact   STD SOFT; company_id; name_en; name_ar; job_title; email; phone; notes; is_primary
company.merge     STD; kept_id; merged_id; reason not null; request_id; undone_at
core.file         STD SOFT; bucket; path unique; name; mime; size_bytes; sha256; status ('pending','stored');
                  sensitivity ('normal','restricted')          -- restricted: IBAN letters, agreements (managers/admins — D10)
core.file_link    STD SOFT; file_id; entity_table; entity_id; purpose ('evidence','agreement','attachment','iban_letter','render')
                  unique (file_id, entity_table, entity_id, purpose)
core.note         STD SOFT; entity_table; entity_id; kind ('comment','update','meeting'); body; occurred_on date; edited_at
core.mention      (note_id, person_id) pk
```

- The two date-range rules above need the `btree_gist` extension (enabled in the first migration).
- A **contact's** email is not automatically an identifier (a shared or personal address would mis-match invoices);
  the contact form offers "also use as identifier", which goes through the identifier rules.
- **Merging** (`api.company_merge(kept, merged, reason)`): the merged company's identifiers are removed and re-added to
  the kept one (`source 'merge'`), its contacts, files, notes, tasks, projects and achievements are re-pointed, its
  account-manager history is kept on record, and it is archived with `merged_into_id`. One request, so one undo.
- **Pictures** (avatars, company logos) go to a second private bucket, `images`: images only, at most 2 MB,
  resized in the browser to 256 px before upload, read through 24-hour signed URLs cached by the browser (they appear on
  every chip, so the 600 s rule for money documents does not fit them). Any signed-in person may see them.
- **Files**: `api.file_begin(entity, purpose, name, size, mime)` registers a pending file and returns a path; the
  browser uploads to the private bucket; `api.file_finish(id, sha256)` marks it stored. Storage policies allow writes
  only to a path registered as pending by the same person, and reads only where a `storage.objects` select policy calls `authz.can_see_file(path)` (the person can see a record
  the file is linked to; restricted files for managers and admins); the browser then asks Storage for a 600 s signed
  URL (`createSignedUrl` — M21). Size cap and type list are settings.
- Polymorphic `entity_table`/`entity_id` (files, notes, change log) are checked by a trigger against the registry's
  entity list; every business relation is a typed foreign key.

### 3.5 The company-identifier matching engine

**Principle (owner, 28 Sep):** matching is a live view, never a stamp. Nothing writes a company onto an invoice.
Adding, removing or moving an identifier changes every past row's company at once, and every total with it.

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

Stored keys (`company.identifier.value_key`, the invoice's match keys) carry `norm_version`. A migration that changes a
`norm.*` function must end with `perform norm.rebuild()`, which recomputes every stored key and reindexes (A17); a
change to `company.name_stop_words` rebuilds name keys in the same request. `norm.drift()` lists any stored key that no
longer equals its recomputation; it must be empty (test and nightly job).

**Sources.** Each import source that carries company clues exposes a keys view `(source_table, source_id, kind, key,
match_date)`; in v1 that is `finance.invoice_keys`: client ID (the row's own, else the one Payments client whose contact
email equals the row's email — ported from the ident branch, live), tax number (compared with both VAT and CR),
discount code (with the row's **booking date** — see V28), email, phone, both customer-name columns.

**The match — `company.match` view** (one row per source row):

1. **Pin** (level 0): `company.match_pin (source_table, source_id, company_id, kind, reason)`, shown with a pin mark,
   logged and undoable, of two kinds:
   - `entry` — the company a person picked while typing an invoice whose clues matched nothing. Anyone who may type
     the invoice may set it; the clue itself goes to **Needs a decision** as a *suggested identifier*, because adding an
     identifier moves money between people and needs `companies.identify`. Once someone accepts it, the invoice
     matches by itself and the pin is cleared in the same request;
   - `decision` — a manager's last resort for a true conflict.
   A pin whose invoice would now match a **different** company without it is listed in `finance.health`.
2. For each level in `company.match_order` (setting; default client ID → VAT/CR → discount code within its dates →
   email → phone → name), find the companies holding a matching live identifier. Values under
   `company.identifier_block` are ignored.
3. **The first level that finds anything decides.** One company → `matched`. Two or more → `conflict`, listing every
   candidate; nothing is guessed. None at any level → `individual` if a name key is on the individuals list, else
   `none`.

Output: `(source_table, source_id, state, level, company_id, candidates uuid[])`. Finance exclusions are applied
separately (§3.6) — an excluded row still shows its company.

**Needs a decision — `api.match_queue()`.** Rows in `none` or `conflict` grouped by customer (same keys), each group
with its row count and **the riyals at stake** (M52). A person decides once per customer:

| Decision | Effect (one request, logged, undoable) |
|---|---|
| "This is company X" | adds the chosen clues from the group (default: the strongest — client ID, else VAT/CR, else email, else name) as identifiers of X; every future row with those clues matches by itself |
| "New company" | creates the company with those identifiers |
| "Individual (not a company)" | adds the name to `company.individual_name` (D25) |
| "Exclude" | opens the Finance exclusion rule form (reason required) |
| Conflict: "move identifier" / "merge A and B" / "pin these rows to A" | remove-and-add the identifier; merge; or pin with a reason (last resort) |

Staff emails and test rows never become identifiers: the block list refuses them at write time, and the queue never
proposes them. From P7, the Payments **corporate clients** import adds a matched client's IDs, names, VAT/CR, emails and phones
to its company (source `import`, one request, undoable) and proposes a new company for an unmatched one — it never
creates companies by itself (D17). The **promo codes** import only suggests a company from its client name; a person
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
                       source ('manual','import'); src jsonb (per-field export time, imports only); first_batch_id; last_batch_id
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
finance.tax_invoice    STD SOFT; dpin text unique not null; parent_invoice_id → finance.invoice (kind billing or standalone);
                       total_sar (as recorded — used only by the checks); issued_on; source
finance.receipt        STD SOFT; invoice_id (billing or standalone for collections); receipt_key unique; method; amount_sar;
                       paid_on; ref_at_method; paid_by; notes; source                      -- never revenue
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
finance.exclusion_rule STD SOFT; kind ('client_id','name','tax_no','discount_code','invoice','product','company'); value_raw;
                       value_key; mode ('exclude','hide'); reason not null      unique (kind, value_key) live (D16; 'hide' = MF5)
finance.credit_split   STD SOFT; invoice_id; person_id; share numeric(7,6); note not null
                       -- shares of an invoice sum to 1 within 0.000001; the credited amounts are rounded to the halala and any
                       -- remainder goes to the first person, so three equal shares add up exactly
```

**Views — every money figure in the app comes from these (§1a):**

| View | What it says |
|---|---|
| `finance.invoice_fact` | per invoice: kind (a top-up detected from wallet lines is confirmed as `wallet_topup`); status via `status_map`; line total; pass-through / fee / unclassed line sums (D23); commission flag (product list or commission word); the billing invoice it belongs to (for a transaction) or its transactions (for a billing invoice); its DPIN; **revenue date** = paid date (else created) |
| `finance.invoice_cost` | for a transaction or standalone invoice: approved = sum of **approved** expenses, **null when none** (empty, never 0 — D21, MF1); pending count; estimate only when approved is null and not a commission: the Revenue Report expense total once imports exist, else the pass-through lines (D23), always flagged; `cost_basis` ∈ approved · submitted_estimate · line_estimate · commission · none; **cost status** Provisional / Final (rules above) |
| `finance.money_row` | one row per revenue unit (a transaction or a standalone invoice): company, match state and level (§3.5); month and quarter of the revenue date; **revenue** = total − wallet part (D21) for a paid unit; cost, estimate (apart), margin = revenue − cost where cost is known, as recorded (V51) (a commission's margin is its revenue) — **the main
margin figure counts only units whose cost is Final; Provisional margins are shown apart** (the old M9 "one pending
transaction holds back the whole invoice", carried as cost status); counts = paid and not excluded; excluded/hidden with rule and reason; audit-required flag; cost status. **Billing invoices, credit notes and wallet top-ups never appear as revenue units** |
| `finance.money_service_row` | D24: each counted unit's lines to one service (item map, else the product's service, else "No service yet"); lines of "not income" services shown on their own row, never in a service's sums; the rest of the difference to revenue
under "Not split by line", so services + not income + not split = the revenue tile and nothing hides; approved cost split by line share, the estimate by pass-through share |
| `finance.credit_row` | counted unit × person × share: a credit split if present, else the company's account manager **on the revenue date** (V27), else nobody ("uncredited", shown) |
| `finance.receivable` | collections: billing and standalone invoices not void/cancelled/draft, **through the same exclusion rules as `money_row`** (a hidden row never appears; an excluded one is listed apart, never in outstanding — D16, MF5); outstanding = total − receipts; due = created date + `finance.collection_due_days`; ageing 0–30, 31–60, 61–90, 90+, no date, dated in the future |
| `finance.check` | the reconciliation, per billing or standalone invoice: billing total vs sum of its transactions; DPIN total vs (total − approved expenses of its units) within 1 SAR; DPIN = 100 % of total on non-commission → "expenses missing"; expenses entered on a billing invoice (refused at write, listed if imported); transactions with no billing invoice after N days (setting) |
| `finance.company_month` | company × month: revenue, cost, estimate, margin, counted units, outstanding |
| `finance.health` | what is held back or doubtful, by reason, with the riyals at stake (M48, M52): unknown statuses, excluded/hidden rows, units with no company, cost missing, estimates in use, Provisional units, failed checks |

**"Commercial revenue" is a setting** (`finance.revenue_definition`, effective-dated): basis (revenue as above — the
default — or margin), which services, which company categories, whether commissions count. The structure is built
now; **its value is decided at go-live** (owner, 28 Sep — decision 3), and nothing waits for it. The KPI source
`finance.commercial_revenue` reads it as of each month, so a changed definition recalculates every KPI, report draft
and appraisal that uses it (§1a example 6). The screen words ("Revenue" vs "Sales (GMV)" and "Margin") are V25.

**Ported rules that the tests must pin down:** a unit counts only when paid (Audit Required counts, flagged) · credit
notes never count · wallet top-ups never revenue (MF7) · VOID never counts (MF9) · billing invoices never revenue;
collections measured on them · cost empty until an approved expense exists; the estimate always flagged and never in
cost or margin · never estimate a commission · income by service adds up to the revenue tile · VAT never stored or
shown (DPIN totals only feed the check) · exclusions win over everything and apply to past rows at once (D16) ·
verification products are a `hide` rule typed by a person, never a silent skip (MF5; nothing is lost).

**Known faults in the old code, fixed by design:** receipts read without paging (A7); `Voided` left in outstanding (the
status map decides everything); twin pairing only inside one 5,000-row batch (v2 links from Payments' own
`consolidated_proforma_id`, or by a person); client IDs and codes never filled from the invoice file (v2 keeps them
whenever given and derives the client ID from the contact email once the clients list is imported); approved cost
stranded on an invoice later marked as a billing link (impossible now: expenses are refused on billing invoices).

### 3.7 Projects and tasks

```
work.project_status  LIST + category ('planned','active','on_hold','done','cancelled')
work.project         STD SOFT DEPT; number unique; name not null; company_id; owner_id not null; status_id; start_on; due_on;
                     closed_at; description
work.project_invoice (project_id, invoice_id) pk; linked_by; reason       -- revenue and cost read from the linked invoices
work.task_status     LIST + category ('todo','in_progress','waiting','done','cancelled'); is_default
work.priority        LIST + rank
work.ref_system      LIST + url_template      -- Direct system references (booking, invoice, ticket); the URL pattern is a setting
work.task            STD SOFT DEPT; number unique; title not null; notes; owner_id not null; team_id not null (active team, D11);
                     priority_id; status_id; start_on; due_on; company_id; project_id;
                     origin ('manual','template','period_target','meeting'); template_id; period_target_id;
                     assigned_by (set when owner ≠ creator); closed_at; closed_by
                     -- trigger: a task's company equals its project's company when both are set
work.task_helper     (task_id, person_id) pk; added_by; added_at
work.task_watcher    (task_id, person_id) pk                            -- follows a task's notifications without working on it
work.action_item     STD SOFT; task_id; text not null; owner_id not null; due_on; done_at; done_by; sort; source_note_id → core.note
work.action_item_helper (action_item_id, person_id) pk
work.task_ref        STD SOFT; task_id; system_id; value not null        unique (task_id, system_id, value)
work.task_contact    (task_id, contact_id) pk
work.task_invoice    (task_id, invoice_id) pk
work.task_kpi        (task_id, kpi_id) pk
work.task_template   STD SOFT DEPT; title; notes; owner_id; team_id; priority_id;
                     checklist jsonb [{text, owner: 'task_owner'|person_id, due_offset_days}];
                     rule jsonb {freq: weekly|monthly|quarterly|yearly, interval, weekdays, month_day, lead_days}; starts_on; ends_on; active
work.task_occurrence (template_id, occurs_on) pk; task_id                -- makes generation idempotent
```

- The **timeline** is `core.note` on the task: `update`, `meeting` (with its meeting date) and `comment`, each with
  @mentions. `api.task_add_meeting(task, date, body, items[])` adds the note and its **assigned action items** in one
  request.
- **Views.** `work.task_view` adds last activity (latest note, action item change or status change), `stale`
  (in progress and no activity for `work.no_update_days`), `overdue` (due before Riyadh today and not closed) and open
  action item counts. `work.my_work(person)` = tasks I own ∪ tasks where I own an action item ∪ tasks and action items
  I help on — the blueprint's "My work". Board and calendar read the same view.
- **Who does what.** Anyone with Own on Tasks creates their own tasks and adds helpers; assigning to someone else needs
  the capability `tasks.assign` (managers, admins — §3 "managers/admins assign"); helpers add notes and tick their
  own action items.
- **Recurring tasks.** `pg_cron` at 00:05 Riyadh (the schedule is in UTC: `5 21 * * *`) runs `work.generate_recurring(core.riyadh_today())`; each occurrence
  is created once (`task_occurrence`), attributed to the template's creator with a `job` request naming the template —
  a record made on a person's standing instruction (D17's spirit).
- **Closing a task** (`api.task_close`) asks what to do with open action items (close them too, or keep the task open),
  and the screen then offers "Log the achievement", prefilled from the task (company, project, participants = owner and
  helpers, source task). Nothing is created without the person pressing it (§3 "closing a task offers").

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
                     thresholds jsonb (null = the `perf.pace_thresholds` setting); strategy_ref; support_tickets text[]; reason; set_by; set_at
                     unique (kpi_id, effective_from)                        -- mid-year definition changes (§5a)
perf.kpi_target      id; kpi_id; period_kind ('month','quarter','year'); period_start date; value numeric;
                     effective_from date not null; reason; set_by; set_at
perf.kpi_lead        (kpi_id, person_id) pk
perf.kpi_contributor id; kpi_id; scope ('department','team','person'); scope_id
perf.kpi_reading     STD SOFT; kpi_id; period_kind; period_start; value numeric; passed bool (checklist); as_of date; note
                     -- manual and percentage/score KPIs; evidence via core.file_link. Also last year's monthly figures of a
                     -- computed KPI, typed once and used only for months its source has no data for, shown as "typed" (V31)
perf.kpi_status_note STD; kpi_id; quarter_start; status ('on_track','slightly_behind','at_risk','critical','exceeded','pending');
                     note; noted_on                                          -- the status a person declares for the strategy sheet
perf.measure_def     key pk; unit_kind; params_schema jsonb; scopes text[]; label_key           -- synced from the registry
perf.achievement_category  STD SOFT; plan_id; parent_id (sub-category); code; name_en; name_ar; is_money_link bool;
                     line_template_en; line_template_ar; sort; active
perf.category_field  STD SOFT; category_id; key; label_en; label_ar; type ('text','number','money','date','select','person',
                     'company','boolean'); required; options jsonb; sort
perf.category_kpi    id; category_id; kpi_id; contribution ('count','field_sum'); field_key; condition jsonb; effective_from; effective_to
                     -- condition: only achievements whose field matches, e.g. {"field":"integration_type","in":["api"]} —
                     -- how "a promo-code-only partnership is not a technical-integration KPI" (§3) is kept without code
perf.achievement     STD SOFT DEPT; plan_id; category_id; company_id; project_id; source_task_id; service_id → finance.service;
                     title (the person's short words); count int default 1; before_value; after_value; field_values jsonb;
                     evidence_date date not null; owner_id not null; remove_reason
perf.achievement_participant (achievement_id, person_id) pk; role
perf.achievement_invoice     (achievement_id, invoice_id) pk
perf.achievement_kpi_adjust  id; achievement_id; kpi_id; mode ('include','exclude'); period_month date (for an include:
                     the month it counts in — defaults to the evidence month; set for a re-mapping into a new plan's year);
                     reason not null
perf.challenge       STD SOFT DEPT; title; details; company_id; supplier_name; owner_id; opened_on; resolved_on; resolution
perf.period_target   STD SOFT DEPT; period_kind ('month','quarter'); period_start; text; owner_id; task_id not null;
                     written_in_report_id → report.report
```

**Plans (§5a).** A plan belongs to a department and a calendar year. `api.plan_copy(from, year, what)` copies
objectives, KPIs (keeping `copied_from_kpi_id`), their latest revisions (effective 1 January), leads, contributors,
categories, fields and mappings — targets optionally. Everything is then renamed, renumbered, regrouped or removed in
the browser. An achievement belongs to the plan of its evidence date's year (trigger; no plan for that year → refused
with "no 2027 plan yet"). Old years keep their structure: a 2026 report or appraisal reads the 2026 plan and the
revisions in force then. Carrying a 2026 achievement to a 2027 KPI is an `achievement_kpi_adjust` of mode include,
with a reason — a logged person action.

**KPI values** (never stored):

1. The revision in force for a month is the latest `kpi_rev` with `effective_from ≤` the month's end.
2. Month value by source:
   - **computed** — the measure's function (key `finance.revenue` → `measure.finance_revenue`) with
     `(params, 'department', plan.department, month start, month end)`;
   - **achievements** — the sum of contributions (`count` × achievement count, or the sum of a field) of achievements
     whose evidence date is in the month and whose category maps to the KPI **by a mapping in force on the evidence
     date**, plus includes whose `period_month` is this month, minus excludes, removed ones left out;
   - **manual** — the readings for that month (or the quarter reading).
3. Quarter and year to date by aggregation: `sum` — the sum of the months (year to date = the running sum); `latest`
   (percentage/score KPIs) — the latest reading in the period; `average` — the average of the **measured** months only,
   saying how many (M39).
4. Target for a period **as of a date** = the latest `kpi_target` for that period with `effective_from ≤` the date;
   a year target is explicit, else the sum of the quarter targets (`sum` KPIs).
5. **Pace** (ported from the d27 plan): what is due = the targets of past quarters in full plus the current quarter's
   target pro-rated by Riyadh days passed; ratio = year-to-date ÷ due (inverted for lower-is-better). Status: Exceeded
   (year target reached) · On track (≥ 1.00) · Slightly behind (≥ 0.90) · At risk (≥ 0.70) · Critical · Pending (no
   target, not started, or not measured). A non-cumulative KPI is judged per quarter; a `latest` KPI compares its latest figure with the current quarter's
   target (the d27 rule). Thresholds come from the KPI revision, else the `perf.pace_thresholds` setting.
6. **Not measured ≠ 0.** A manual KPI with no reading, or a ratio with nothing to divide (no action items were due),
   returns `measured = false` and is shown as "—, not measured", never 0. A count of achievements is a real 0 once the
   period has started.

Views: `perf.kpi_month`, `perf.kpi_quarter`, `perf.kpi_ytd`, `perf.kpi_pace`, `perf.kpi_company_quarter` (a company's
contribution to each KPI by quarter, for the company card); function `perf.kpi_trace(kpi, from, to)` returns the
achievements or invoices behind a figure with their company and evidence file (the KPI page's drill-down, §1).

**Measures in v1** (each a SQL function `measure.<module>_<name>(params, scope_kind, scope_id, from, to)` — the registry
maps the dotted key to it — returning
`(value, measured, n)` plus a `_items` twin for drill-down; scopes are department, team, person, company):
`finance.revenue` · `finance.commercial_revenue` (the setting) · `finance.margin` (says how much of the revenue had a cost)
· `finance.new_client_revenue` (companies whose first counted unit falls in the period and whose `client_since`, if
typed, is not earlier) · `finance.collected` ·
`company.new_clients` · `perf.achievements` (categories as parameters; person scope = owner, or owner and participants)
· `perf.kpi_attainment` (params: a KPI **code**; value = the KPI's figure over the period ÷ its targets over the same
period as of the evaluation date — quarter targets pro-rated by the months inside the period; each month read from the
plan of its own year, the KPI matched by code; for appraisal items tied to a department KPI) ·
`work.tasks_on_time` · `work.action_items_on_time` · `work.weekly_updates` · `work.meeting_notes_on_time` ·
`report.on_time`. Person scope on finance measures uses `finance.credit_row` shares. Measures name achievement
categories by their **code**, which plan copies keep, so an April–March appraisal cycle counts the same category in
both calendar years' plans.

**Achievements.** Stored as fields and rendered as one line by **one** function, `perf.achievement_line(id, locale)`,
from the category's line template — the list, the KPI drill-down, the report suggestions and the exports all call it.
A money-link category ("revenue and bookings") has no amount field: its amount is the sum of the linked invoices' revenue
from `finance.money_row`, counted once per invoice however many achievements cite it; money KPIs never read
achievements (a check refuses a `field_sum` mapping of a money field onto a money KPI). No approval step: the owner and
participants edit their own; a manager (Full on KPIs) corrects, moves or removes anyone's with a required reason.

**Challenges** stay open until resolved; their age is computed; a report lists every challenge open at its period's
end — so they carry over without retyping (§10).

**Next-month (and next-quarter) targets.** Writing a target in a report creates a `perf.period_target` **and its task**
(owner named, due the period's last day, origin `period_target`) in one request. The next report shows each as
**done** (task done by the period's end) or **carried over** (still open, with its age) — the task itself stays on
the owner's My work.

### 3.9 Reports

```
report.section_def   key pk; kind ('cover','kpi_tiles','kpi_month_additions','kpi_results','achievements_by_category','challenges','period_targets',
                     'operational_plan','revenue_by_service','free_text'); params_schema; label_key      -- synced from code
report.template      STD SOFT DEPT; kind ('monthly','quarterly','yearly'); sections jsonb [{key, title_en, title_ar, params}];
                     effective_from                                          -- "sections are a setting"
report.editor        (department_id, person_id) pk                          -- named report editors
report.reviewer      (department_id, person_id) pk                          -- optional reviewers (the canvas's "Submit for review")
report.report        STD SOFT DEPT; kind; period_start; period_end; plan_id; template_id; status ('draft','in_review','issued','superseded');
                     number; issued_at; issued_by; supersedes_id → report.report; correction_note; snapshot jsonb; snapshot_sha256
                     unique (department_id, kind, period_start) where status = 'issued'
report.line          STD SOFT; report_id; section_key; category_id; text not null; sort; show_amount bool
report.line_achievement (line_id, achievement_id) pk
report.line_invoice  (line_id, invoice_id) pk
report.render        id; report_id; format ('pdf','pptx'); file_id; snapshot_sha256
```

- **A draft is live.** Every section is computed when opened: **each KPI's addition this month to its quarter**
  (`kpi_month_additions` — §3 "the monthly report shows each month's addition"), tiles (the chosen KPIs or measures for the period and
  the same period last year — "not measured" when last year has no data), achievements by category, challenges open at
  period end, period targets done/carried, the operational-plan indicators (checklist KPIs: done / carried over),
  revenue by service. `report.draft_suggestions` lists achievements of the period that no line cites yet.
- **The two report kinds** (one tab row on the Reports page: Monthly · Quarterly). The **monthly** template's sections:
  cover · each KPI's addition this month · this month vs the same month last year (tiles) · achievements by category ·
  challenges · next-month targets. The **quarterly** template's: cover · quarter vs the same quarter last year (tiles) ·
  achievements by category (lines linking to their achievements, companies and invoices) · **KPI results**
  (`kpi_results`: target, M1, M2, M3, quarter, year to date, status) · challenges (open and carried over; resolved this
  quarter) · next-quarter targets · operational-plan indicators (Done / Carried over). Both are settings; these are the
  starting templates.
- **Lines.** An editor writes a line in their own words, citing one or more achievements and/or invoices; its amount is
  the sum of the **distinct** invoices cited directly or through cited money-link achievements. The achievements
  themselves never change (§3 Reports).
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
                        status ('planning','open','self_review','manager_review','sign_off','locked'); grade_scale_id;
                        attainment_cap numeric; final_from ('manager')
appraisal.cycle_node    the template tree frozen into the cycle when it opens (copy + source_node_id)   -- history keeps its structure
appraisal.corporate_actual (cycle_id, cycle_node_id) pk; actual; entered_by; entered_at      -- entered once, for everyone
appraisal.appraisal     STD DEPT; cycle_id; person_id; template_id; evaluator_id; status; employee_comment; evaluator_comment;
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
- **Lock** (admin, at or after `lock_on`): every actual and % is copied into `locked_*`, final and grade stored — the
  appraisal equivalent of an issued report. Reopening is an admin action with a reason.
- **Visibility** (RLS): the person, their evaluator, anyone above them in the reporting line, and admins. Nobody else,
  whatever their page level (§3 "appraisal private").

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

**Export.** Every list has Export (CSV with BOM, or Excel). It runs the list's own query with the chips applied,
paging through `fetchAll`, writes numbers as numbers, dates as Riyadh dates, IDs as text, and passes every text cell
through `csvGuard` (CP5). An E2E test proves the exported row count equals the list's count.

### 3.12 Where every figure comes from (nothing stores a copy)

| Figure | Computed by | Stored? |
|---|---|---|
| An invoice's company | `company.match` | Never |
| Revenue, cost, estimate, margin, cost status, counts | `finance.money_row`, `finance.invoice_cost` | Never |
| Reconciliation (billing = its transactions; DPIN = total − approved expenses) | `finance.check` | Never |
| Income by service | `finance.money_service_row` | Never |
| A person's credited revenue | `finance.credit_row` | Never |
| Outstanding and ageing | `finance.receivable` | Never |
| Company card totals, KPI contributions | `finance.company_month`, `perf.kpi_company_quarter` | Never |
| Project revenue and cost | `work.project_money` (linked invoices) | Never |
| KPI month/quarter/year values, pace, status suggestion | `perf.kpi_*` | Never |
| An achievement's amount | its linked invoices through `finance.money_row` | Never |
| A report line's amount | `report.line_amount` (distinct invoices) | Only inside an issued snapshot |
| Task stale/overdue, My work | `work.task_view`, `work.my_work` | Never |
| Appraisal actuals, %, grade | `appraisal.item_score` | Only when locked |
| Import counts | `io.batch.counts` | Yes — a record of what an import did, not a business figure |

### 3.13 Indexes and the performance budget

- Match keys: `company.identifier (kind, value_key) where removed_at is null`; `finance.invoice` on each key column;
  `finance.expense_line (invoice_id)`; `finance.invoice_line (invoice_id)`; `finance.receipt (invoice_id)`;
  `finance.billing_link (billing_invoice_id)`; `finance.tax_invoice (parent_invoice_id)`;
  `company.account_manager (company_id, effective_from)`; `perf.achievement (plan_id, evidence_date)`,
  `(category_id)`, `(company_id)`; `work.task (owner_id) where closed_at is null`, `(due_on)`, `(company_id)`,
  `(project_id)`; `work.action_item (owner_id) where done_at is null`; `core.note (entity_table, entity_id, created_at)`;
  `audit.change (table_name, row_id, id desc)`; trigram indexes on `norm.fold(name)` for search.
- RLS helpers are `stable` and called as `(select authz.level('x'))` so they run once per statement.
- **Budget, measured on the stress fixture** (made-up: 2,000 companies, 10,000 identifiers, 60,000 invoices, 150,000
  invoice lines, 180,000 expense lines, 5,000 tasks, 3,000 achievements): company card ≤ 300 ms, KPI page ≤ 500 ms,
  My day ≤ 500 ms, decision queue ≤ 1 s, Finance overview ≤ 800 ms (database time, p95).
- **If the live match view misses its budget**, the only sanctioned fix is a cache table maintained **in the same
  transaction** as every identifier, pin and invoice change, with `company.match_cache_drift()` (must be empty) run in
  tests and nightly — introduced in its own PR, with the measurement that justified it. It is still "live" in the
  owner's sense: no screen can ever see it disagree with the rules.

### 3.14 Blueprint records → tables

| §2 record | Table(s) |
|---|---|
| Company · Company identifier · Contact · File | `company.company` · `company.identifier` · `company.contact` · `core.file` + `core.file_link` |
| Invoice (lines, payments) · Expense line | `finance.invoice` (kinds transaction, standalone, billing …), `finance.invoice_line`, `finance.receipt`, `finance.billing_link`, `finance.tax_invoice` (DPIN) · `finance.expense_line` |
| Project · Task · Action item · Task update / meeting note | `work.project` · `work.task` · `work.action_item` · `core.note` (kind update/meeting) |
| Achievement · Achievement category · Participant | `perf.achievement` · `perf.achievement_category` (+ `category_field`, `category_kpi`) · `perf.achievement_participant` |
| Challenge · Next-month target | `perf.challenge` · `perf.period_target` (+ its `work.task`) |
| Report · Report line | `report.report` · `report.line` (+ `line_achievement`, `line_invoice`) |
| Plan (year) · Objective · KPI · KPI target · KPI lead / contributor | `perf.plan` · `perf.objective` · `perf.kpi` + `perf.kpi_rev` · `perf.kpi_target` · `perf.kpi_lead`, `perf.kpi_contributor` |
| Appraisal cycle · template · section · item · grade scale · appraisal · line score | `appraisal.cycle` (+ `cycle_node`) · `appraisal.template` · `template_node` (kind section/group) · `template_node` (kind item) · `appraisal.grade_scale` + `grade_band` · `appraisal.appraisal` · `appraisal.score` |
| Department · Person · Team · Role · Access level | `core.department` · `core.person` · `core.team` · `core.role` · `core.level` + `core.role_page_level` / `core.person_page_level` |
| Setting · Change log | `core.setting` (+ list tables) · `audit.request` + `audit.change` |

---

## 4. Sign-in (§0, §10; owner decision 1 of 28 Sep)

**The rule.** No passwords. Staff have two mail systems: `@directksa.com` is Google Workspace, `@directksa.net` is Zoom
Workplace mail. Every sign-in — whatever the door — must land on **one person record**; a door never creates a person.

**What a person sees.** One screen with three doors:

| Door | For | Needs |
|---|---|---|
| **Continue with Google** | `@directksa.com` | a Google OAuth client made in Direct's Workspace, type *Internal* |
| **Continue with Zoom** | `@directksa.net` | a Zoom OAuth app made on the Zoom App Marketplace in Direct's Zoom account (Supabase supports Zoom as a provider — confirmed in its documentation; scope `user:read`) |
| **Email me a code** | anyone on the list, as a fallback | a proper mail sender (custom SMTP — see below). Hidden until it exists (`auth.email_code_enabled`) |

After a successful door, the person lands on the page they asked for and **stays signed in on that device** until they
sign out. Every refusal is said plainly: "This email is not on the list — ask an admin", "Your account is switched
off", "The code has expired — send a new one", "Zoom signed you in as x@…, which is not on the list".

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
3. **Google / Zoom**: the provider returns a verified email; Supabase links the identity to the existing auth user with
   that email. The callback route then checks `core.person_auth` → an active person with `can_sign_in` → signed in and
   logged `ok`; anything else → signed out at once, logged with the reason, and the refusal is shown.
4. **Code**: `signInWithOtp({ email, shouldCreateUser: false })` — only an allowed email gets a code; verified the same
   way.
5. **Switching someone off** (a person, or one of their emails): RLS and every API function stop answering at once
   (no active person); the server bans the affected auth users so no new session starts; logged.
6. **Defence in depth**: an auth user with no active person behind it can read and write nothing.
7. **Sessions**: `@supabase/ssr`; the middleware refreshes the session cookie; the `(app)` layout calls `api.me()`
   **before rendering** (A5); one browser client (A4). A signed-out deep link returns to the same address.
8. **Every sign-in is logged** in `core.sign_in_log` (successes and refusals), readable in Settings → Activity by admins.
   Supabase's own auth audit log is kept as the second record.
9. **Tested in CI** with the Supabase stack's mail catcher for codes; the Google and Zoom doors are checked once on the
   cloud project by a real `.com` and a real `.net` account (P3-2), including "the Zoom email arrives verified and links
   to the existing user" — the one behaviour the documentation does not settle.

**Mail sender for codes — options** (only authentication mail; a few dozen messages a month):

| Option | Cost | What it needs | Verdict |
|---|---|---|---|
| **Resend**, on a sending sub-domain such as `auth.directksa.com` | free tier: 3,000 mails a month, 100 a day | an account; 3–4 DNS records on the sub-domain (SPF, DKIM, a return-path MX); SMTP details into Supabase | **Recommended**: free, made for this, keeps auth mail apart from the company's own mail reputation, no staff password involved |
| Google Workspace SMTP relay (from `@directksa.com`) | free if an existing account or group sends; a new mailbox is one more Workspace seat (paid per month) | a Workspace admin setting; SMTP authentication with a Workspace account or app password | Good if IT prefers everything inside Google; depends on one account's password |
| Brevo | free tier: 300 mails a day | account + DNS records (SPF/DKIM) | Fine alternative |
| Amazon SES | about 0.10 USD per 1,000 mails | AWS account, sandbox approval, DNS records | More setup than needed |
| Supabase's built-in sender | free | nothing | **Not usable**: it only delivers to the Supabase account's own team members and is rate-limited — not for production (Supabase's documentation) |

**What the owner must set up** (all free; the Google and Zoom keys are **deferred** — V23 — so the cloud project starts
with the emailed code alone, once the mail sender exists, and CI tests the code door end to end and the Google/Zoom linking rules through identities made with the admin API):

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
| Company | its current account manager or its creator (V26) |
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
  authz.can_see_appraisal(person_id) );      -- self, evaluator, reporting line, admins — whatever the page level
```

No insert/update/delete policy exists, and no role holds those grants: writes happen only inside `api.*` functions,
which check the level, the capability and the row rule explicitly and raise `42501` naming the page and level needed.
The `authz.*` helpers are `security definer`, `stable`, with `search_path = ''`, so the policies on `core.person`
and the level tables never recurse into themselves. A **measure** checks access itself: without Finance view, a
finance measure returns "not measured — no access", never 0 (M53).

The screen asks the same `api.me()` levels to hide what would be refused (M42) and never shows a control that the
database would refuse without saying why.

**Tested exhaustively** (§9): every `api` write function × every role × own/other row → allowed or `permission
denied`; every table refuses direct writes; `anon` gets nothing; the grants snapshot matches.

---

## 6. Screens (proposal for blueprint §7)

Common to every area: list + 480 px detail panel, own URL per record, chips with counts, Export on every list, one tab
row at most inside a detail, `<DataState>` everywhere, Undo on every toast, removal through the D19 box.

| Area (route) | List | Detail (one tab row) | Main actions |
|---|---|---|---|
| **My day** `/my-day` | Four blocks: **My work** (overdue, today, this week — tasks and action items I own, am assigned or help on; stale flags) · **My companies** (new invoices since my last visit, unpaid balances by age) · **My KPIs** (lead or contributor: pace light, year to date vs due, this month's addition) · **My appraisal** (private: cycle step, what is due from me) | — | Quick add task; mark action item done |
| **Companies** `/companies/[id]` | Name, category, tier, account manager, revenue this year, outstanding, open tasks, last activity, match issues. Chips: mine, category, tier, has outstanding, needs a decision | Overview (tiles revenue / cost / margin this year, income by service, open tasks, recent achievements, linked records, identifiers with add / remove / history, KPI contributions by quarter) · Finance (invoices, months, collections) · Tasks (and projects) · Achievements · Files (and contacts) — as the canvas's company card | New company; add identifier; merge; set account manager (Settings rights) |
| **Needs a decision** (a view of Companies) | Customer groups with row count and riyals at stake, candidates for conflicts | The rows, their clues | The decisions of §3.5 |
| **Finance** `/finance/[view]` | Views: Overview (tiles: revenue, cost, estimate apart, margin, counted units; months; income by service; what is held back and what fails a check) · Invoices (every kind and state; chips: Provisional, checks failing, no company) · Collections (ageing, who to chase — on billing and standalone invoices) · **New invoice** (the fast entry screen of §7) · Imports (P7) | Invoice: header, lines, expenses (transactions), transactions and DPIN and receipts (billing), cost status, checks, company and match level, credit (split), projects/achievements/report lines citing it, history | New invoice (Save and new, Duplicate); link transactions to a billing invoice; split credit |
| **Projects** `/projects/[id]` | Number, name, company, owner, status, dates, linked revenue/margin | Overview (linked invoices and money) · Tasks · Achievements · Files · Timeline | New project; link invoices |
| **Tasks** `/tasks/[number]` | Switch List / Board by status / Calendar by due date. Chips: My work, owned, helping, team, status, due, stale, company, project | Header (title, status, owner, due, priority) · Action items (inline add, owner, due, helper) · Timeline (updates, meeting notes, comments, @mentions) · Links (company, project, contacts, invoices, KPIs, Direct references) · Files | Quick add (title, owner, due — Enter); close (offers "Log the achievement"); log meeting |
| **KPIs** `/kpis/<year>/<code>`, `/kpis/achievements/<id>`, `/kpis/challenges/<id>` | Views: **KPIs** (the year's plan grouped by objective: code, title, leads, YTD, year target, pace light, Q1–Q4, measured) · **Achievements** · **Challenges** (V37). Year chooser (the plan) | KPI: target and result by month and quarter; drill-down achievements/invoices → company → evidence; readings; status notes; definition and target history. Achievement: its line, fields, evidence, invoices, KPIs, history | Log achievement (category first, then its own fields); add reading; declare status; export the KPI sheet |
| **Reports** `/reports/monthly/<period>`, `/reports/quarterly/<period>` | **One tab row: Monthly · Quarterly**; each lists its periods with status and number | Editor: the template's sections in order, each live, with the lines editor (cite achievements/invoices, combine, reword) and suggestions of what is not cited yet; Preview; Issue. Issued: snapshot, drift since issue (a count chip linking to the changed figures), PDF/PPTX, Correct. **Quarterly** (the canvas's QuarterlyReport): cover · quarter vs the same quarter last year (tiles) · achievements by category (each line linking to its achievements, companies and invoices) · KPI results (target, M1, M2, M3, quarter, year to date, status) · challenges (open, carried over, and resolved this quarter) · next-quarter targets · operational-plan indicators (Done / Carried over) | New report; Issue (freeze); PDF; PPTX; KPI sheet export; correct |
| **Appraisal** `/appraisal/[id]` | My appraisals; my team's (reporting line); all (admins) | The form as the official sheet: sections → groups → items (definition, unit, target, thresholds, actual with a "from the app" badge, self, manager, weight, %), competencies, comments, sign-off, summary with grade | Self-evaluate; evaluate; sign; lock (admin) |
| **Settings** `/settings/[group]` | **My profile first** (every person, their own: photo or initials with a colour, full name, display name / nickname, badge — none, an icon from a set, or a zodiac sign — theme of four, density, language, start page, drawer pinned or collapsed, notification choices in-app / email), then the six groups of §4, each a page of forms driven by `setting_def` schemas and list-setting tables; Activity (the change log, filter and undo; the sign-in log) | — | Every setting changes with a reason and an effective date where it has one; profile changes save at once with Undo |

Top bar: search and command palette (Ctrl K — pages, records through `api.search`, create actions), Create menu, bell
(notifications; due items counted live), profile chip (avatar, nickname, badge) opening My profile (theme, density, language once Arabic is enabled,
sign out). The drawer: My day, Companies, Projects, Tasks, Finance, KPIs, Reports, Appraisal, Settings (§4).

---

## 7. Invoice entry and imports (proposal for blueprint §8)

**Version 1: invoices are typed in the browser** (owner, 28 Sep — decision 4). **Finance → New invoice** is a
first-class, fast screen, built for someone copying from a Payments page:

- **Header** in one row: kind (Transaction · Standalone invoice · Billing invoice · Credit note · Wallet top-up),
  Payments reference, status, created and paid dates, total; the **customer as Payments shows it** (client ID, name,
  email) with the **company match shown live** beside it (§3.5). No match → the typist **may** pick the company
  (an entry pin, §3.5) or leave it for **Needs a decision**; either way the clue is suggested as an identifier, and
  once someone with `companies.identify` accepts it, the next invoice matches by itself.
- **Lines** grid (product from the product list, item name, quantity, price, total) — keyboard-first, and a block
  pasted from Payments (tab-separated) fills it.
- **Expenses** grid on transactions and standalone invoices (type, amount, status, merchant, reference, dates).
- On a **billing invoice**: pick its transactions (search by reference or customer); the sum is compared with the total
  as you type. **DPIN** (number, total as recorded, date) and **receipts** (amount, date, method).
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
| Companies (details, contacts, notes, files — D7 "helpers, not locks"; V26) | Full | Full | Full | Full | View |
| · change identifiers, decide matches (`companies.identify`) | ✓ | ✓ | ✓ | – | – |
| · merge companies (`companies.merge`) | ✓ | ✓ | – | – | – |
| Finance (Own = enter invoices and edit your own entries — owner decision 4) | Full | Full | Full | Own | View |
| · import files (`finance.import`, from P7) | ✓ | ✓ | – | – | – |
| · split or reassign credit (`finance.credit`) | ✓ | ✓ | ✓ | – | – |
| Projects | Full | Full | Full | Own | View |
| Tasks | Full | Full | Full | Own | View |
| · assign to others (`tasks.assign`) | ✓ | ✓ | ✓ | – | – |
| KPIs (with achievements and challenges) | Full | Full | Full | Own | View |
| Reports (named editors edit drafts whatever their level) | Full | Full | View | View | View |
| Appraisal (always also: yourself and your reporting line) | Full | Own | Own | Own | No access |
| Settings — My profile (always your own; cannot be switched off) | Own | Own | Own | Own | Own |
| Settings — Organization & access | Full | View | – | – | – |
| Settings — Companies (incl. account managers, credit rules) | Full | Full | View | – | – |
| Settings — Plan & performance (plans, KPIs, categories, appraisal cycles/templates) | Full | Full | View | View | View |
| Settings — Finance (services, maps, exclusions, revenue definition) | Full | Full | View | View | – |
| Settings — Work | Full | Full | View | – | – |
| Settings — App | Full | View | – | – | – |
| Activity (the whole change log) | Full | View | View | – | – |

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
not only as admin (CP10); a test that recorded a hole fails once it is fixed (M37).

### 9.2 The propagation flows — the six of §1a, and three more

Common trial world (made-up): department Commercial; people **Admin**, **Head**, **AM1** and **AM2** (account managers,
team members), **Editor** (report editor); company **Test Co A** with identifiers email `a@test.example` and name
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
| FLOW-01 | AM1 types transaction `INV-T-0001` in Finance → New invoice: Fully Paid, total 11,500, paid 14 Aug 2026, customer email `a@test.example`, one approved expense of 9,000 (v1; re-run with a made-up import file in P7) | match: Test Co A at level email · credit: AM1 × 1.0 · company card: revenue Aug 2026 = 11,500, cost 9,000, margin 2,500, cost status Provisional until a billing invoice with its DPIN is entered, then Final · K-REV: August +11,500, Q3 = 11,500, pace recomputed · AM1's My day: new invoice for Test Co A and K-REV's pace · August monthly report draft: revenue tile and revenue by service include 11,500 · AM1's appraisal "Sales vs plan" actual = 11,500 (2.875 % of plan). **Then:** the status edited to Void → every figure above drops back. **In P7:** the same file twice → nothing changes; a newer file wins per field; an older file only fills blanks; the hand-entered row is never touched |
| FLOW-02 | AM1 closes task "Sign Test Co A" and logs the offered achievement "New deals", company Test Co A, evidence file, evidence date 3 Sep 2026 | company card: achievement listed, K-B2B Q3 contribution 1 · K-B2B: September +1, Q3 = 1, drill-down reaches Test Co A and the evidence file · September report draft: suggestion to cite it; a line citing it · AM1's appraisal "New B2B clients" = 1. **Then:** change the evidence date to 2 Oct 2026 → moves to October and Q4 everywhere |
| FLOW-03 | FLOW-01's invoice is typed; Head sets AM2 as Test Co A's account manager from 1 Sep 2026; a second invoice, paid 10 Sep, is typed | the Aug invoice stays AM1's, the Sep one is AM2's: both people's person-scope measures, My day and appraisal lines change accordingly · a manager splits the Sep invoice 50/50 with a note → both see half |
| FLOW-04 | AM1 types an invoice for the customer name "شركة تيست كو أ", no email, and picks no company → **Needs a decision**; a manager decides "This is Test Co A" | before: no company, in the queue with its riyals · after: the name is an identifier of Test Co A, the invoice (and any past one with that name) re-links, every total above updates · removing the identifier returns it to the queue · the same name added to a second company is refused (one company only) · a typed invoice whose tax number is Test Co A's VAT **and** another company's CR (the same level) → conflict naming both · a typist who instead picks Test Co A gets an entry pin and a suggested identifier; when a manager accepts it, the pin is cleared and the match holds by itself |
| FLOW-05 | An achievement dated 3 Sep is logged; Editor issues the September report citing it; a manager then removes the achievement with a reason | K-B2B, company card, AM1's appraisal and the **Q3 quarterly** draft update · the September report's snapshot hash is unchanged and it shows "1 figure changed since issue" · a correction is issued: new number `-C1`, the old one marked superseded, both readable |
| FLOW-06 | FLOW-01's invoice is typed; Head changes K-REV's Q3 target 100,000 → 80,000 effective 15 Sep 2026, and switches the revenue definition to "margin" effective 1 Oct | pace and status recompute; the report draft tiles recompute; AM1's "Department revenue vs target" line rises from 11.5 % to 14.4 % of target (11,500 ÷ 80,000) · reading K-REV's target "as of 14 Sep" still returns 100,000 · the change log holds both changes with their effective dates · September still uses revenue, October uses margin |

Plus three flows the blueprint and the finance finding imply: **FLOW-09 billing and the tax invoice** (two made-up
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
L.L.C.) and `NORM-DRIFT` · `IDN-*` (ported IDN-01…14, now against the live view) · `FIN-*` (ported D1/D21 tests: statuses, top-ups, billing invoices never revenue, collections on billing invoices, expenses refused on billing invoices, exclusions win, credit notes, VAT never stored) · `CHK-*` (the reconciliation and cost status of §3.6) · `COST-*` (ported
COST-01…11, P7) · `CP-*` (ported clients/promo, P7) · `D24-*` (income by service adds up to the revenue tile) · `IMP-*` (P7: any
order, newer wins per field, blank never wipes, same file twice, resume after a stopped chunk, held rows listed) ·
`KPI-*` (sources, aggregation, cumulative pace, not measured ≠ 0, effective-dated targets and mappings) · `RPT-*`
(snapshot frozen, drift, correction numbering) · `APR-*` (scoring against a hand-computed copy of the official form's
maths, weights both ways, cap, lock) · `PERF-*` · `UI-*` (every page in Light/Dark/Colorful/Direct, both densities, at 400 px / 1,500 px; no hint or banner component; every entity a link;
`dir="rtl"` with pseudo-Arabic has no physical-direction leaks; every string comes from the catalog).

### 9.4 Definition of done for any PR

The PR's own tests pass, each new test was seen to fail under its sabotage (named in the PR), the full SQL and unit
suites pass on a database built from zero, E2E passes for the areas touched, the checks pass, the grants snapshot is
updated on purpose if it changed, and nothing real is in the diff (rule 7).

---

## 10. Environments (e)

**Measured on 28 Sep (read-only):** the Supabase organisation "abdoulmagd911's Org" is on the **free plan with two
active projects** (`direct-business` — the old app — and `directksa-performance` — the appraisal tool), both
eu-central-1. Supabase allows **two active free projects per owner, across every organisation the owner administers**;
paused projects do not count. The Vercel team "abdoulmagd911's projects" holds two projects. This environment's network
refuses `*.supabase.co`, `vercel.com` and `cdn.sheetjs.com`; the Supabase and Vercel connectors work.

**The owner's answer (V21, 28 Sep):** the free way — **the old app's database (`direct-business`) is paused on 1 Oct**,
after the Q3 close of 30 Sep, by the oversight. From then on **the old app is unavailable** (its data is kept and the
project can be restored from the Supabase dashboard; Supabase limits how long a paused free project stays restorable,
so a restore, if ever wanted, is done early). The appraisal tool (`directksa-performance`) stays live. The oversight then
creates `direct-commercial` on the free plan with the Supabase connector.

| What | Exactly | Plan and cost | Who |
|---|---|---|---|
| **Supabase project** `direct-commercial` | region eu-central-1 (Frankfurt, as today), Postgres 17; Auth: sign-ups off, email OTP; Google and Zoom providers added when their keys exist (V23, deferred); **site URL and redirect URLs list the Vercel staging address now and `https://www.directksab2b.com` (and the bare domain) from go-live**; Storage buckets `files` and `images` (private); `pg_cron` on | **Free** | the oversight, with the Supabase connector, after the pause on 1 Oct |
| **Vercel project** `direct-commercial` | this repository, root directory `v2`, framework Next.js, production branch `v2/main`, preview deployments on every PR, an *ignored build step* so pushes that do not touch `v2/` build nothing, function region fra1; env vars: Supabase address and publishable key (public by design), service key (server-side only). **Staging lives on its `vercel.app` address** | **Free** (Hobby — V46) | builder A with the Vercel connector, on the owner's approval (V6) |
| **The domain** `directksab2b.com` | **the same domain** (owner, 28 Sep — V13). Until go-live it stays on the old Vercel project; at go-live (P6-8) it is removed from the old project and added to the new one (Vercel → Domains), and the Supabase Auth site URL / redirect URLs switch to it. The Google and Zoom OAuth settings need no change for the domain (their redirect is Supabase's own callback address), but Google's authorised JavaScript origins, if set, list both addresses | free | the owner or the oversight, at go-live |
| **Google OAuth client** · **Zoom OAuth app** | §4, steps 1–2 — **deferred** (V23): until they exist, sign-in on the cloud project is by emailed code only, which itself needs the mail sender | free | Direct's Workspace and Zoom admins, later |
| **Mail sender** | §4, step 3 — Resend's free tier (V24); DNS records on `auth.directksa.com` | free tier | whoever manages the DNS |
| **CI** | GitHub Actions, `.github/workflows/v2.yml`, runs only when `v2/**` changes; the full test stack, including sign-in by emailed code through the stack's mail catcher | free for public repositories | builder A |
| **Backups for real data** | the paid plan at go-live (V22) | about 25 USD a month (the organisation's plan; with two active projects, compute for the second is extra, about 10 USD) | owner decides at go-live |

**The builders' own containers**: plain Postgres (16, installed) for the SQL suite, Vitest, `next build`. No Docker
daemon runs there and the cloud hosts are refused (measured), so the full Supabase stack and E2E run in CI, the cloud
projects are reached through the connectors, and screens are looked at on each PR's Vercel preview. If an environment's
network setting is widened (the owner's click — CLAUDE.md), builders may also run `next dev` against staging.

The old Vercel project also builds a preview of the **old** app for every pushed branch, `v2/*` included. That is
harmless, costs nothing, and cannot be switched off without touching the frozen project — so it stays until go-live.

**Order of steps:** (1) 30 Sep Q3 close in the old app; (2) 1 Oct the oversight pauses `direct-business` and creates
`direct-commercial`; (3) builder A creates the Vercel project and applies the first migrations; (4) later: the mail
sender, then the Google and Zoom keys; (5) at go-live: backups, the domain move, the Auth URLs.

Secrets live only in Vercel's server environment and Supabase's settings — never in the repo. No deploy secret is
stored in GitHub: builder A applies migrations to the cloud project at merge from the merged commit (checksum-checked),
after the SQL suite has passed on a database built from zero. The very first admin (the owner's account, D8) is created
once by builder A with a one-off statement the owner approves, logged under the System person — never in a migration
file (rule 7, D17).

Free-plan limits to watch: database 500 MB, file storage 1 GB, 5 GB egress, a project pauses after 7 days without any
request, no downloadable backups. The stress fixture never goes to the cloud project; only trial values do.

---

## 11. Go-live and moving data (f)

**Go-live = the code and the structure proven working** (owner, 28 Sep — decision 4). Then the team types the 2026
invoices in the browser; imports follow later. All data in the old app is test data (D9).

| What | How | Proof |
|---|---|---|
| People, teams, roles, allowed emails | Typed in Settings | every person signs in through their door |
| Plan 2026 (objectives, KPIs, targets, categories) | Typed in Settings from the Departmental KPIs sheet | the KPI sheet export matches the strategy team's sheet cell for cell |
| Appraisal templates, grade scale, points tables | Seeded **from the online appraisal tool** (it wins over the Excel form; gaps filled from the form — owner decision 2) from an export of its data the owner hands over (rule 8), kept out of the repo (rule 7) and loaded by a person through the importer; then edited as settings | every template's weights, bands and items equal the tool's |
| Past appraisals | the same export, imported as `appraisal.legacy` (read-only, labelled legacy — 08 A14) | row count per person and cycle |
| Companies and identifiers | Typed or created while entering invoices; later the Payments corporate clients list (P7) | every identifier present once; conflicts listed, not guessed |
| 2026 invoices, expenses, DPINs, receipts | **Typed by the team** in Finance → New invoice | the owner and the oversight compare monthly revenue with Payments |
| Older history (for "same month last year") | Until the import phase loads it, last year's monthly figures are typed once as KPI readings, or the tiles say "not measured" (V31) | — |
| Tasks, achievements, reports of the old app | **Not moved** (test data, D9); ClickUp KPI records imported once if the owner wants (08 C5) | — |

**Cut-over:** rehearse on the staging project; reset it (a v2 `golive_reset`, backup first, only on the owner's word —
D9); the domain moves to the new Vercel project (§10); the team starts entering. The old app has been unavailable since
its database was paused on 1 Oct (V21); its data stays restorable while Supabase allows.

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
ID ranges of A18.
