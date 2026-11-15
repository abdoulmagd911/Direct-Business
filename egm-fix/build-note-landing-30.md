# Landing 30 — the People table fits its box when a TEST person is listed

15 Nov 2026 · base `8c57af1` (Landing 28 and its follow-up, live) · target `v2/main`

## What was broken

Settings → People & access, the wide People table: when a TEST person was listed, an admin's table gained an eighth
column holding a full-size "Sign in as test user" button, and the table ran past its box and scrolled sideways.
CI run 1608 caught it (the People table 880 px wide in a 722 px and an 866 px box, Arabic), the first run in which
a TEST person existed while that table was measured.

## Reproduced before the fix (local stack, made-up people, an admin signed in)

| Language | Width | TEST person listed | Box (clientWidth) | Content (scrollWidth) | Columns (px) |
| --- | --- | --- | --- | --- | --- |
| Arabic | 1280 | no | 722 | 722 | 147, 77, 141, 147, 0, 113, 96 |
| Arabic | 1280 | yes | 722 | **796** | 131, 69, 92, 92, 0, 113, 96, **203** |
| Arabic | 1440 | no | 866 | 866 | 166, 85, 196, 209, 0, 113, 96 |
| Arabic | 1440 | yes | 866 | 866 | 140, 73, 119, 122, 0, 113, 96, **203** |
| English | 1280 | no | 722 | 722 | 184, 81, 141, 104, 0, 108, 105 |
| English | 1280 | yes | 722 | **783** | 132, 81, 102, 70, 0, 108, 105, **186** |
| English | 1440 | yes | 866 | 866 | 166, 81, 128, 92, 0, 108, 105, **186** |

The cause is confirmed: the table fits without a TEST row and overflows with one, by way of the button's column
(203 px in Arabic, 186 px in English). The amount differs from CI's 880 px — here 796 px at 1280 and a bare fit at
1440 — because it depends on the rows' words and the machine's fonts. English overflows at 1280 too.

After the fix, the same measurements: 722 in 722 and 866 in 866 in both languages, with and without the TEST row,
seven columns, no button in the table.

## What changed

| Area | Change | File |
| --- | --- | --- |
| People table (wide) | the switch column — its header cell and its button cell — is gone; `anyOffer` with it. The phone cards keep their button exactly as it was | `v2/src/modules/org/screens/OrgAccess.tsx` |
| Person record | "Sign in as test user" in the admin's actions row, after Edit / Follow / Switch off: same gate (`offersSwitch`: an admin, a TEST person, not already switched), same call (`useTestSwitch().start`), same words (`testSwitch.start`), same marker (`data-test-switch-start`) | `v2/src/modules/org/screens/PersonRecord.tsx` |

Not changed: the Teams table, the access matrix, the sign-ins table, Button, Chip, Tabs, SettingsShell, any
stylesheet, the Switch off button and its dialog, any wording (no new catalog key), the database (no migration;
the generated types are unchanged).

## Tests

- QA-592 (`v2/tests/e2e/app-settings.alone.spec.ts`) now lists a TEST person before it measures; the fit assertions
  are as they were. It also checks that the wide table carries no switch button and that the TEST person's record
  offers it. The person is unmarked after each test, pass or fail.
  The button check is scoped to the table (`[data-people] table [data-test-switch-start]`): the phone cards sit in the
  same section, hidden at these widths, and keep their button.
- Sabotage `the-people-table-carries-the-test-switch-column` (`v2/tests/sabotage/settings-tables-arabic.mjs`) puts the
  column back; QA-592 goes red with "the people table fits its box in Arabic". The older sabotage in that file still
  goes red with the same words.

## Verification (this landing's head)

| Check | Result |
| --- | --- |
| Base equals the live head `8c57af1` | yes |
| Repro recorded | yes — the table above |
| `pnpm typecheck` | exit 0 |
| `pnpm lint` | exit 0 |
| `pnpm format:check` | exit 0 |
| `node scripts/checks/run.mjs` | 19 green |
| `node scripts/db/gen-types.mjs --check` | exit 0, no diff |
| Unit tests (vitest) | 1,082 passed in 184 files (1,082 at Landing 28) |
| SQL suite, a fresh `v2_test` from zero | 352 passed, 0 failed |
| `pnpm build` | exit 0 |
| `app-settings.alone.spec.ts` | 17 passed, QA-592 at 1280 and 1440 with the TEST person listed |
| Landing 28 spec and `org.spec.ts` | 12 passed (org.spec in both browser set-ups) |
| Sabotage singles | 2 of 2 red as required; the tree restored and built again |

Run in a cloud container: local Postgres 16 for the SQL suite (CI uses 17), the local Supabase stack for the browser
tests. Not run here: the whole browser suite and the whole sabotage set — CI runs both on the push.
