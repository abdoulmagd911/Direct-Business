# v2 — the Commercial app

The rebuild of Direct's Commercial app (spec: `docs/v2/`). Nothing here imports anything from the old app at the
repository root. Integration branch `v2/main`; one branch and one draft PR per step (`docs/v2/BUILD-PLAN.md`).

## Run it

```sh
pnpm install
pnpm dev            # http://127.0.0.1:9300 (builder A's ports are 9300–9399, builder B's 9400–9499)
pnpm checks         # the architecture checks (TECH-SPEC §9.1)
pnpm lint && pnpm typecheck && pnpm format:check
pnpm test           # unit tests (Vitest)
pnpm build && pnpm test:e2e        # end to end (Playwright), against the Supabase stack — see below
pnpm sabotage       # every check and test must fail under its sabotage (V100); --kind check|lint|unit|e2e, --only <name>
```

The app reads three settings (V119): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and, on the
server only, `SUPABASE_SECRET_KEY`. On Vercel the owner pastes them (V84); never into a file here.

## End to end, against the local Supabase stack (V120)

Sign-in is tested for real: the specs make made-up people in the stack's database and read the emailed codes from its
mail catcher. In a builder's container (no Docker running at first; the default image registry is refused):

```sh
dockerd --data-root <scratch>/docker &                        # once
SUPABASE_INTERNAL_IMAGE_REGISTRY=docker.io supabase start \
  -x studio,imgproxy,edge-runtime,logflare,vector,supavisor,postgres-meta,realtime,storage-api
export $(node scripts/e2e/stack-env.mjs)                      # the stack's fixed local addresses and keys
export PW_CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome
pnpm build && pnpm test:e2e && node scripts/sabotage.mjs --kind e2e
node scripts/db/gen-types.mjs            # after a migration changes the api schema: src/core/db/database.types.ts
```

## The registry (V123)

Pages, capabilities and settings are declared in `src/modules/<module>/module.ts`. After changing one:

```sh
pnpm registry:sync          # writes a new supabase/migrations/…_core_registry_sync.sql and supabase/registry.json
pnpm registry:sync --check  # fails when a module changed without a sync (the unit test does the same)
```

## The database (`supabase/`)

Migrations are forward-only (`supabase/migrations/YYYYMMDDHHMMSS_<module>_<what>.sql`, V103). The SQL suite
(`supabase/tests/<area>/<ID>-<promise>.sql`, V106) runs on a database built from zero:

```sh
node scripts/db/test.mjs                    # plain Postgres (PGHOST/PGPORT/PGUSER/PGPASSWORD; default 127.0.0.1:5432)
node scripts/db/test.mjs --only GRANTS-01   # one test
node scripts/db/test.mjs --write-grants     # rewrite supabase/grants.expected — on purpose only, and say why
node scripts/db/test.mjs --target supabase  # after `supabase start` (CI)
node scripts/sabotage.mjs --kind sql        # every SQL test fails under its sabotage (supabase/tests/sabotage/)
```

In the builders' containers: `pg_ctlcluster 16 main start`, and give the `postgres` role the password `postgres` once.

## The checks (`scripts/checks/`, `node scripts/checks/run.mjs --list`)

| Check                     | Refuses                                                                                                     |
| ------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `rule-7`                  | real-looking data and secrets anywhere under `v2/` — made-up values have fixed shapes (V101)                |
| `one-client`              | a Supabase client made outside `src/core/db/` (A4)                                                          |
| `no-table-writes`         | `insert/update/upsert/delete` on a `.from()` table chain in app code (A6)                                   |
| `no-physical-css`         | left/right utilities, properties and inline styles — logical CSS only (§2.5)                                |
| `no-hex`                  | a colour outside `src/ui/tokens.css`: hex, `rgb()`/`hsl()`…, named colours, Tailwind palette colours (§2.5) |
| `one-copy`                | an Arabic/identifier folding table in app code — folding lives in SQL (A10)                                 |
| `forward-only-migrations` | a misnamed, edited, deleted or out-of-order migration; `pg_get_functiondef` (A9, V103)                      |
| `no-vat-columns`          | an identifier named for a VAT or tax amount in SQL (M1)                                                     |
| `no-blob-tables`          | a json/jsonb column not listed with its reason in `scripts/checks/jsonb-columns.txt` (A1)                   |
| `norm-rebuild-called`     | a change to a `norm.*` function with no `norm.rebuild()` after it (A17)                                     |
| `v2-ids`                  | a duplicate or out-of-range decision ID; a port outside the builders' blocks (A18)                          |
| `forbidden-words`         | "Direct KSA", "DirectKSA", "Direct Corporate", "B2B", "MICE" in the catalogs or page text (V59)             |

ESLint adds: browser storage only through `src/core/prefs` (A13); no `setInterval` outside `src/core/` (A2).
A true exception carries `check-allow: <check> — <reason>` on its line (V100).

## The screens (builder B)

```sh
pnpm dev                      # the shell with a made-up development person signed in (src/core/auth/me.ts, V2_DEV_ME)
open http://127.0.0.1:9300/kit  # every kit component, development and test builds only (V202)
pnpm build && pnpm test:e2e   # 4 themes × 2 densities × 400/1,500 px screenshots into test-results/screenshots/, axe, RTL,
                              # dialogs, the shell, sign-in; PW_CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome here
SCREENSHOT_DIR=tests/e2e/screenshots pnpm test:e2e   # refresh the committed screenshots the PR shows
node scripts/dev/shot.mjs direct comfortable 1500 /kit   # one screenshot (theme density width path [dir] [name]) into $OUT
```

- `src/ui/tokens.css` is the only file with a colour value (V60; `tests/unit/tokens.test.ts` holds the table);
  `src/ui/globals.css` maps Tailwind v4 to the tokens and removes the stock palette.
- `src/ui/` is the kit — Button, IconButton, Input, Select, Checkbox, Switch, Field, Dialog (its own form state),
  Confirm (D19), Toast with Undo, StatusChip and FilterChip, Tabs (one row), EntityLink, Avatar, PersonChip,
  AvatarStack, Money, KpiTile, PageHeader, DataState (five states), DetailPanel (480 px), DataTable (virtualized,
  48/32 px rows), BrandLogo — and `src/ui/shell/` (drawer 232/56, the phone's bottom bar, top bar, Ctrl K, Create,
  profile menu; V207).
- `src/core/prefs` is the only browser storage: theme, density, drawer, locale and a development direction override,
  as cookies the server reads before the first paint (V201).
- `messages/en.json` and `messages/ar.json` carry every string, the same keys in both (`i18n-catalogs`).

The screen checks (in `scripts/checks/`, run with the rest): `ui-no-hints` (V11 — no banner, callout or hint anywhere),
`accent-fill-only` (V60 — the accent is never text and never under a label), `i18n-catalogs` (catalogs in step, no
hard-coded sentence in a screen), `screen-words` (V52/V73 — never Company or Margin on screen; V59's names, Google,
Zoom, "Keep me signed in" and GMV are A's `forbidden-words`). Their sabotages: `tests/sabotage/screens.mjs`.
The drawer, the bottom bar and Ctrl K read the module registry (`src/ui/shell/nav.ts`, V209): a page shows for a
level above none, Settings for admins only, and a page may declare several drawer entries (`nav.entries`).

P3-5 (V210): `src/ui/record/` is the one record-page template (header with key figures, one tab row, the details rail,
the activity timeline with Undo); `src/modules/settings/` holds the settings framework (schema-drawn setting cards with
the database's own preview, the list editor with the Arabic name required and Used in N before an archive, Activity
with Undo and Revert over the settings log) and `src/modules/org/` My profile, Organization & access and the Person
record. `core/commands/run.ts` runs one write with its toast and Undo.

The password door (V212): `core/auth/password-actions.ts` signs a person in with their work email and password, sends a
person whose password must change to `/set-password` first, and changes a password from My profile; an admin generates a
temporary one from the person's record (`/auth/admin/password`, V441). The emailed-code door stays behind
`SIGN_IN_METHOD=code`.
