# Commercial v2 — screens

The rebuild of the Commercial app (`docs/v2/`). This folder is the whole v2 application; the old app at the
repository root is frozen and nothing here imports from it.

## Run it

```
pnpm install
pnpm dev            # http://127.0.0.1:9400 — a made-up development person is signed in (V2_DEV_ME)
pnpm build && pnpm start
```

Until builder A's sign-in (P3-2) lands, `getMe()` serves the development person whenever no Supabase URL is
configured; the sign-in screen runs against a stand-in that accepts any address on the two staff domains and
the code `000000`.

## Prove it

```
pnpm check          # no hex outside tokens.css · logical CSS only · no hint/banner · accent is a fill · catalogs in step
pnpm typecheck && pnpm lint && pnpm format
pnpm test:unit      # tokens equal the design system table; prefs; formats; every check goes red on a planted violation
pnpm test:e2e       # builds, starts on 9400, runs Playwright: 4 themes × 2 densities × 400/1,500 px, axe, RTL, dialogs, shell, sign-in
node scripts/sabotage.mjs            # applies each tests/sabotage/*.mjs, expects its named test to fail, restores
E2E_DEV=1 pnpm test:e2e              # against a running `pnpm dev` (faster while building)
```

Screenshots the suite takes land in `tests/e2e/screenshots/` and are committed with the PR for review.

## Where things are

- `src/ui/tokens.css` — the only file with colour values; `src/ui/globals.css` maps Tailwind to them.
- `src/ui/` — the kit (Button, Input, Select, Dialog, Confirm, Toast, Chip, Tabs, DataTable, DetailPanel,
  DataState, EntityLink, Avatar, PersonChip, AvatarStack, KpiTile, PageHeader, BrandLogo) and `shell/`.
- `src/core/prefs` — the only browser storage (theme, density, drawer, locale, a development direction override).
- `messages/en.json`, `messages/ar.json` — every string, same keys in both.
- `/kit` — the component gallery (development and test builds only).
- `scripts/check-*.mjs`, `scripts/sabotage.mjs`, `tests/sabotage/` — the checks and what proves they bite.
