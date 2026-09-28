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
pnpm build && pnpm test:e2e        # end to end (Playwright); in the builders' containers set
                                   # PW_CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome
pnpm sabotage       # every check and test must fail under its sabotage (V100); --kind check|lint|unit|e2e, --only <name>
```

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

ESLint adds: browser storage only through `src/core/prefs` (A13); no `setInterval` outside `src/core/` (A2).
A true exception carries `check-allow: <check> — <reason>` on its line (V100).
