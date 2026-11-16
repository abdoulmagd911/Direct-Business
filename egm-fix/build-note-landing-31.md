# Landing 31 — the re-skin (part 1 of 2: the new look, five themes, six key screens)

16 Nov 2026 · base `492d3a4` (Landing 30, live) · target `v2/main`

**This landing was split, as the brief allows.** This part is the re-skin (the brief's build steps 1 to 4, and the
verification for them). The task features (step 5: comments with a pinned decision, mentions that add a helper,
delegation with a deputy, Today's three with the streak, and the board with drag) follow as the next landing on top
of this one. Nothing of step 5 is half-built in this push; what exists today (comments, mentions, hand-over, checklist,
board, calendar) keeps working as before, in the new look.

## What is new, in plain words

1. **One set of design values, exported as a file.** `v2/src/ui/tokens.json` holds every colour, size, corner, shadow
   and timing; `v2/scripts/tokens/build.mjs` writes `tokens.css` from it (a test fails if the two differ). Fonts were
   already self-hosted (Readex Pro, IBM Plex) — unchanged.
2. **Five themes: Light (default), Dark, Direct, Turquoise (opt-in), System** (follows the device, live). Colourful is
   not back. The switcher is in three places: My profile → Look (five cards with a small drawing each), the profile
   menu on a PC, and More → Theme on a phone. A pick changes the whole app at once and is saved to the profile. The
   sign-in page wears the theme last used on the device, or the device's own on a first visit. Admins still choose the
   default for new people from Light, Dark and Direct (Settings → App); Light stays the default.
3. **Colour rules.** Primary buttons are `#C8460C` with white words in every theme (never white on `#F06820`). Revenue
   green is `#127A3D` in Light and Direct and a lifted green (9:1 or better) in Dark and Turquoise. Contrast of every
   text and control pair is tested per theme (WCAG AA).
4. **The shared pieces** (buttons, fields, pills, tabs, cards, KPI cards with the orange start border and peach icon
   circle, tables, dialogs, menus, toasts, drawer, top bar, phone bar and its More sheet) are restyled once, so every
   page changes with them. Icons draw a 1.5 px line at every size. Motion: dialog 240/160 ms, sheet 320/240, menu
   160/120, toast 200/160, press 80, skeleton after 400 ms with a 1.6 s shimmer, theme change 200 ms cross-fade.
5. **Six key screens rebuilt:** Sign-in (layout A), My day, Partners list, Finance (with the partner's Finance tab and
   Discount codes), Tasks, Settings → People & access. Each has its empty, loading, failed and no-access state, in
   English and Arabic, on a PC and a phone.
6. **Two real additions that the screens needed:**
   - **The Quiet card on Partners counts for real** and filters the list (it was not available to the list before).
   - **The company credit limit** in Settings → Finance (default SAR 1,250,000): changed by a manager, a head
     (director) or an admin, with a reason, and logged; everyone else reads it.

## Screen by screen

| Screen | What it is now |
| --- | --- |
| Sign-in | Slate panel with the logo (a band under 1024 px), a white card, the heading "Commercial **Workspace**" with the last word in the orange pill, pill fields 44 px, a 50 px orange button, Show/Hide as words. |
| My day | Gradient banner with the date as the heading ("Sun 15 Nov 2026"), one line "My work · N open tasks", Wrap up and Capture; white cards with icon circles; × on Capture's date, link and organisation chips (44 px on a phone). |
| Partners list | Pill tabs; four KPI cards — Active, Prospects, Stale, Quiet — that filter the list (the choice is in the address); the table drops columns by its own width instead of scrolling sideways; phone follows the 13 Nov board. |
| Finance | Four cards "Revenue / Cost / Profit — Recorded here" and Provisional; Months (Open / Closed pills), By service, and the Ledger card with saved views, the "— Unified ledger" strip of five (Revenue, Cost, Profit, Received, Remaining) and source tags; Import card; New invoice form; Close month with a single confirming button and a receipt. A "Credit limit" link leads to Settings → Finance. |
| Partner → Finance tab | Four KPI cards (Revenue green, Cost, Profit, Bookings), the "Imported" switch, one rows card that stacks instead of scrolling. |
| Discount codes | List as a table card; a code opens as its own view with five KPI cards and one ledger table with Counted / Not counted pills. The failed state still shows the error's kind and code beside Try again (Landing 28). |
| Tasks | Pill tabs (My work, Owned, Helping, Team, Past work), a count line under them, filters as pills, List / Board / Calendar switch that keeps tab, filters and place; one status pill per row and card; overdue is a red date, not a pill; the board has a count per column and a Blocked column. The calendar view is exactly as it was. |
| Settings | Menu with icon circles (a column from 1280 px, pills below); People / Teams / Access as pill tabs; phone list per the 13 Nov board; the credit limit card. |

## Database (forward-only, three new migrations after the tip `20261115100000`)

| Migration | What it does |
| --- | --- |
| `20261116090000_core_profile_themes_turquoise_system.sql` | lets a profile hold `turquoise` and `system` |
| `20261116100000_settings_finance_credit_limit.sql` | the setting `finance.credit_limit`; `api.finance_credit_limit()` (anyone signed in reads) and `api.finance_credit_limit_set(amount, reason)` (admin, head, manager; a team member or viewer is refused; logged as a setting change) |
| `20261116110000_partners_list_quiet.sql` | `finance.quiet_clients()` — the quiet rule lifted word for word out of the existing alert, which now reads it; `partner.partners_list` (same signature) understands `quiet` and `counts` and flags quiet rows |

**The quiet rule:** a partner whose latest counted (fully paid) invoice is `finance.quiet_client_days` (60 by default)
or more days old. Never quiet: archived, merged, never-paid or only-unpaid partners. It is hidden from anyone below
View on Finance (no flag, no count), so the list never tells a reader who has not paid.

`supabase/grants.expected` gains the four new execute grants; `database.types.ts` is the generator's output (CLI
2.118.0); `supabase/registry.json` gains the one setting.

## Decisions taken (please confirm or overrule)

1. **No Google sign-in.** Not drawn, and the word is banned on screen. (Owner confirmed, 16 Nov.)
2. **The heading's last word sits in an orange pill** (the owner's brief), although the board draws orange text.
3. **Money format: kept exactly as the live app shows it** — whole riyals, thousands comma, Latin digits, the currency
   word after the number ("1,500 SAR" / «1,500 ريال»); the New invoice form's line totals keep two decimals. The boards
   put a Latin "SAR" before the number; not adopted, so nothing on screen changes meaning. (M1.)
4. **Credit limit:** manager, head and admin edit; team members and viewers read. Whole riyals only.
5. **Close month:** one confirming button (plus Cancel), no second approver, no Undo — as the app already worked.
6. **My day's banner says "My work · N open tasks"** and takes N from the Tasks screen's own read and counting
   function, so the banner and the My work tab always agree.
7. **Finance top cards:** the four "Recorded here" cards are on top; Received and Remaining are in the Ledger's strip,
   because they exist only in the unified-ledger read (which follows the ledger's filters) — mixing them with the
   "Recorded here" figures on one row would put two sources side by side under one period.
8. **Capture on the My day banner (640 px and up)** — the 15 Nov board. This replaces the older rule "My day has no
   Capture button of its own"; on a phone the + stays the one add control.
9. **Screen names stay the app's** ("Partners", not the boards' "Clients"; "Total collected", "Invoices", "People &
   access", MTD / QTD / YTD).
10. **Phone Create stays in the bottom bar** (now a 56 px orange circle) and does not float — the standing ruling of
    15 Oct; the board draws a floating button.
11. **Toasts stay at the bottom-end corner**; dialogs stay centred on a phone (only More is a sheet).
12. **Tasks:** a tab shows its number only for the open tab (no extra reads); the list is grouped by status; the task
    number left the rows (it is the title's tooltip); an empty board shows the empty state.
13. **Reduced motion:** everything is instant (the app's existing rule); the board's "fade ≤ 120 ms" is the other
    allowed choice.
14. **Menus close at once** (they fade in over 160 ms): the board's 120 ms closing fade swallowed a quick second
    press, so it was left out. Nothing bounces, scales or slides page-wide.
15. **Compact density keeps its row heights** (32 / 36 px); the boards draw 40 px rows for the comfortable setting only.
16. **Settings for non-admins:** `/settings/finance` shows the credit-limit card only; the rest of Settings still says
    "Settings is for admins". Managers reach it from the Finance page's "Credit limit" link (Settings is not in their
    menu, and the menu was not changed).

## Three finance rules — what the app does today (not changed; please confirm)

1. **Which month a row belongs to:** the month of its created date; an imported row uses its record date. A payment
   that lands after a month is closed is a dated "late change"; the closed month's figures do not move.
2. **Who closes a month:** one person with Full on Finance, once; only an ended month; no second approver; no Undo.
3. **Profit:** counts only rows that have a cost; a row with no cost is Provisional and stays out of Profit.

## Arabic

Every Arabic string on the boards was copied exactly. Places to look at:

- **Plainly inconsistent on the boards (copied as drawn, or the app's existing word kept — listed, not silently changed):**
  Try again is «حاول مرة أخرى» on the boards and «أعد المحاولة» in the app (app's kept); "More filters" «عوامل أخرى»
  vs the app's «مرشحات أخرى» (app's kept); Expired chip «منتهٍ» vs the app's «منتهي» (app's kept); «الإيرادات» vs the
  app's «الإيراد» (app's kept); Provisional is «مبدئي» on the new card (board) while existing rows say «مؤقت»; Ledger
  is «السجل الموحّد» on new labels (board) while the existing card title is «دفتر الحسابات»; the credit limit's lock
  line names only «المديرون ورؤساء الإدارات» though admins can change it too; "admin" is «المسؤولين» in one place and
  «مسؤولي النظام» in another; partner-tab strings still say «الشركة».
- **Not drawn — written for this landing (please review):** «رجوع»; My day: «إزالة {name}», the count's plural forms;
  Partners: «موردون نعمل معهم الآن», «لا يوجد موردون بعد.», «مدة طويلة بلا نشاط», «مدة طويلة بلا فاتورة مدفوعة»,
  «تصفية سريعة», «اضغط مرة أخرى لعرض الكل», «هادئة», «الهادئة فقط»; Finance: «التكلفة — السجل الموحّد», «أُغلق
  بواسطة», «تاريخ الإغلاق», «خطوات الاستيراد», the close warning lines; Codes: the count plurals; Tasks: «الشريك أو
  المشروع» (the board says «الشريك أو الصفقة»; the app has projects, not deals), «الأولوية: {priority}», «عرض أقل»;
  Settings: «تغيير حد الائتمان؟», «أدخل مبلغًا صحيحًا بالريال، أكبر من صفر.», «تم حفظ حد الائتمان».
- **Changed to the boards' words:** Tasks tabs «أملكها», «أساعد فيها», «أعمال سابقة»; «قوائم المهام»; «العرض».

## Drawn on the boards, not built (no data or behaviour behind it today)

- Finance: Received / Remaining as top cards with their sub-lines; Cost and Profit per service; a Service column in the
  ledger; "Last import" line; import Merge / Exclude-with-reason / Undo as separate steps; a page-level Close month
  button (it is per ended month); New invoice linking out to Direct Payments (the in-app form is kept).
- Codes: "Edit code" / "Add code" linking out (no such address exists; the in-app actions are kept); Terms, Review
  date, Approved by; a sort picker; campaign-code rows.
- Partners: day numbers in the Stale / Quiet card notes (they are admin settings the list cannot read); the phone's
  "Needs attention" counts Stale only.
- My day: the second count line (owned · helping · due today · overdue); the names of admins on the no-access card;
  a route-level loading skeleton (see "What the first browser run found").
- Tasks: numbers on all five tabs; a loading skeleton on every visit; dragging cards on the board (part 2).
- Settings: admins named on the no-access card; a loading skeleton; Role / Team dropdown chips; the "Import rules" row.
- Kit: the tab pill gliding between tabs; dragging a sheet closed; list stagger.
- **Q17 (reminders at a time of day): not built, as instructed.**

## Next landing (part 2)

B1 comments thread with one pinned decision · B2 a mention always adds the person as a helper · B3 one Responsible and
an optional deputy, hand-over with a reason of 120 characters at most, the O-3 refusal, history · B4 Today's three
(3 important + 3 short + 3 maintenance), the streak and the manager's My team tab, checklist step dates · B5 board
with drag. After that: the **calendar view** as its own step (it exists today and was left exactly as it is).

## Tests added or moved

- Unit: 1,082 → 1,295 (none loosened). New files cover the tokens file and its CSS, the five themes and the switcher,
  the banner count, the four partner cards and their counts, the Finance cards and receipt, the codes view, the tasks
  look (one pill; overdue is a date), the settings menu and the credit limit.
- SQL: 352 → 356: `THEME-01`, `CCL-01` (credit limit), `QUIET-01`, `QUIET-02`.
- Browser: new `landing-31-themes.spec.ts`, `landing-31-look.spec.ts` (six screens × five themes × PC and phone),
  `landing-31-look-arabic.alone.spec.ts` (the same in Arabic, and sign-in in Arabic),
  `landing-31-settings-credit-limit.alone.spec.ts`; older specs follow the theme cards and the new My day button.
- Sabotage: `tests/sabotage/landing-31-*.mjs` (themes, my-day, partners-list, finance, finance-tab-codes, tasks-look,
  settings) and the SQL plant `a-member-changes-the-credit-limit.sql`; older plants whose target text moved were
  re-pointed at the same promise (no plant was dropped without a replacement).
- QA-592 (People and Teams tables fit their box in Arabic with a TEST person listed) is carried and green.

## Verification (this landing's head)

| Check | Result |
| --- | --- |
| Base equals the live head `492d3a4` before editing and again before the push | yes |
| `pnpm typecheck` | exit 0 |
| `pnpm lint` | exit 0 |
| `pnpm format:check` | exit 0 |
| `node scripts/checks/run.mjs` | 19 green |
| `node scripts/tokens/build.mjs --check` | `tokens.css` matches `tokens.json` |
| `node scripts/db/gen-types.mjs --check` (Supabase CLI 2.118.0) | exit 0 — the types file is the generator's output |
| Unit tests (vitest) | 1,295 passed in 202 files (1,082 at Landing 30; none loosened) |
| SQL suite, a fresh database from zero | 356 passed, 0 failed (352 at Landing 30) |
| `pnpm build` (inside the browser run) | exit 0 |
| Browser tests, the whole `chromium` project | 481 passed, 0 failed, 10 skipped (skips written in older specs) |
| Browser tests that run alone (Arabic, app settings, QA-592, credit limit) | 27 passed, 0 failed |
| Finance browser tests (`finance-overview`, `-reads`, `-new-button`, `-new-invoice`, `-month-helper`, `company-finance-tab`) | green, inside the run above |
| Look bar: six screens × five themes × English and Arabic × 1,440 px and 375 px | green — every page wears its theme, reads in the right direction, nothing scrolls sideways, no word under 12 px |
| Contrast (WCAG AA) per theme; Revenue green; the button colours | green (tokens test; axe on the kit and the screens) |
| 44 px tap areas on a phone, every page, dialogs and menus, English and Arabic | green (`tap-sizes-everywhere`, `tap-targets`, the Arabic walk) |
| Sabotage — every unit, check and SQL plant the change could touch | 433 plants, 437 target runs, 0 failures (each red as required) |
| Sabotage — browser plants that are new or were re-pointed, and those on the specs that changed | 29 of 29 red as required (four needed a sharper break first; a plant was never dropped) |
| No page opens empty for lack of data | each of the six screens has its empty state; walked in the look bar on a fresh person |

Where it was run: a cloud container; local Postgres 16 for the plain SQL suite (CI uses 17) and the local Supabase
stack for types and the browser tests. **Not run here:** the other 350 or so older browser sabotage plants (hours of
machine time) and the `utc-arabic-browser` project — CI runs both on the push.

## What the first browser run found (fixed before the push)

- A menu that faded out still held the page's clicks for a moment, so a press on its own button right after closing
  it was lost. Menus now close at once (they still fade in). Dialogs and the phone sheet keep their closing motion.
- Opening motions grew the box from 96–98 %, so a control measured during the motion read 43 px, not 44. Motions now
  move and fade only; nothing changes size.
- A loading file added for My day left two headings on the page for a moment and kept the weekly review hidden in a
  browser that draws no frame. It was removed: My day has no route-level skeleton (its banner and cards draw with
  the page, as before).
- Compact density keeps the row heights it had (32 px table rows, 36 px list rows); only the look changed.
- The count beside a tab's name lost its dimmed colour (it failed contrast).

## Still to do after it is live

- Walk the six screens as the real Admin in English and Arabic, in each theme, and check the figures on Finance,
  the partner Finance tab and Discount codes against the live data (test data only).
- Open Partners with real numbers of rows and watch the list's time: the Quiet count costs about half a second on a
  made-up set of 600 partners and 3,000 invoices. If it is slow live, the lever is named in the migration's notes.
- Confirm the sixteen decisions and the three finance rules above.
