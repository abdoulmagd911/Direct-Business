# The localhost preview gallery (for QA)

**Run:** `GALLERY=1 pnpm test:e2e tests/e2e/gallery.spec.ts --workers=1` from `v2/` with the local stack up
(`scripts/e2e/stack-env.mjs`, then `pnpm build && pnpm start`). It writes `test-results/gallery/index.html` and one
PNG per role × route × state × width (1,500 and 400 px). Nothing real: every person, team and value is made up
(`test.e2e-…@example.test`). The run adds its made-up rows to the local stack; `supabase db reset` clears them.

**Roles:** `admin`, `head`, `manager`, `member`, `viewer` (the registry's roles) and `none` — a made-up role with no
level on any page, which is how every page's no-access state is shown.

**States** (what the spec can put a screen into from outside, and how it names them):

| State       | How it is reached                                                                | Which screens show it                                                                                       |
| ----------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `empty`     | a fresh stack, nothing of that kind yet                                          | every area page until its step lands; lists with no rows                                                    |
| `filled`    | three made-up people with a job title, one team, the seeded person's own profile | Organization & access (people, teams, access), a person's record, Activity (the seed's changes), My profile |
| `own`       | the signed-in person's own record                                                | `/people/<own id>`                                                                                          |
| `no-access` | the role's level is none on the page                                             | every area page as `none`; Settings for every non-admin; the access rail for non-admins                     |
| `failed`    | the browser's own reads are cut (`page.route` aborts `/rest/v1/rpc/**`)          | My profile's save (the failed toast), the bell                                                              |
| `invalid`   | the form submitted empty                                                         | the door (field errors, the focus on the first)                                                             |

**Routes** (one row per role):

| Route                                                                                      | What to look at                                                    |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| `/my-day`                                                                                  | the greeting, the empty state                                      |
| `/overview`, `/finance`, `/kpis`, `/reports`, `/appraisal`                                 | empty for an allowed role; **no access** for `none` (PRF-002/123)  |
| `/partners?view=clients`, `/partners?view=suppliers`                                       | the list shells (P3-9 fills them)                                  |
| `/pipeline`, `/projects`, `/tasks`                                                         | empty until their steps                                            |
| `/activity`, `/activity?tab=settings`                                                      | the change log; no access below the role's level                   |
| `/profile`                                                                                 | every role's own; the `failed` save                                |
| `/settings`, `/settings/org` (+ `?tab=teams`, `roles`, `access`, `lists`), `/settings/app` | admins only; no access for the rest                                |
| `/people/<id>`                                                                             | a colleague's record (filled) and the person's own                 |
| `/kit`                                                                                     | the component kit (the test build serves it)                       |
| `/sign-in`                                                                                 | the door, empty and with the field errors (`invalid`) — signed out |

**Not reachable from outside** (a server read that fails): the person page's per-read failed states and the door's
"server not reached" banner are proven by `tests/e2e/door.spec.ts` and `tests/unit/org/…` instead; when the gallery
needs them, a Playwright `route` cannot cut a server-side fetch, so a stopped stack is the way to see them by hand.

Every route that lands in the registry later is added to `ROUTES` in `tests/e2e/gallery.spec.ts` and to the table
above in the same PR (V213's rule for screens: the gallery is how QA sees a page before it is reviewed).
