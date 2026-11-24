# Excessive-test plan — follow-up round, head `f158ee8` (Landing 46)

Written 24 Nov 2026 by the planning session. Planning only: no code, no push to `v2/main`, no live change.
`test_plan_draft.md` (the frozen record of round one, head `5764f84`) is not edited and not replaced by this file.

## 0 · Read this first — what this plan could and could not see

- **Seen (read-only, from a fresh fetch of `v2/main` at `f158ee80`):** every route file, the page registry, the
  role defaults, the 66 commits `5764f84..f158ee8`, and the landing notes `docs/v2/landings/LANDING-28…46.md`.
- **Not reachable from this session:** `test_plan_draft.md`, Amendments 1–4, and the triage list of the 246 fixes
  (77 blocks-work, 57 wrong-data, 112 cosmetic). They are not on `v2/main` (its `egm-test/` holds only the two seed
  scripts), not on any branch of the repository, and not in the Drive this session can search.
- **What follows from that:**
  1. The numbers **1,150**, **77**, **57**, **112** are taken as given in the brief.
  2. New cells are numbered here (`F2-…`). Round-one cell IDs are **not** quoted, because they could not be read.
  3. F1 and F3 are laid out **by fix group** (the `FIX-nn` groups named in the landing commits), with what to
     re-test and as whom. The column "finding IDs" is left to be filled from the triage list — the only open step.
  4. Four families of round-one cells may now overlap a new F2 cell (section 3.3). Each overlap found when the
     IDs are mapped lowers M by one.

## 1 · Route inventory at `f158ee8`

50 route files (48 at `5764f84`). Roles: Admin, Head, Manager, Member, Viewer.

| # | Address | Built | Who starts with access (role defaults at this head) |
|---|---|---|---|
| 1 | `/` → the person's start page | yes | everyone |
| 2 | `/my-day` | yes | A Full · H Full · G Full · M Own · V View |
| 3 | `/my-day/week` | yes | as My day |
| 4 | `/my-day/notes/[id]` | yes | as My day |
| 5 | `/tasks` (list, board, calendar, team) | yes | A/H/G Full · M Own · V View |
| 6 | `/tasks/new` | yes | as Tasks |
| 7 | `/tasks/[number]` | yes | as Tasks |
| 8 | `/partners` (list) — **moved** from `/clients` | yes | A/H/G/M Full · V View |
| 9 | `/partners/[id]` (tabs: workspace, people, related, files, codes, finance, activity, discussion) | yes | as Partners; Finance tab: A/H/G/M Full · V View |
| 10 | `/suppliers` (list) — second tab of Partners | yes | A/H/G/M Full · V View |
| 11 | `/suppliers/[id]` | yes | as Suppliers |
| 12 | `/clients`, `/clients/[id]` — now **redirects** to Partners, filters kept | yes | as Partners |
| 13 | `/files` | yes | A/H/G Full · M Own · V View |
| 14 | `/files/[id]/download` — **new** | yes | re-checks the file's own access on every download |
| 15 | `/finance` (Overview, Ledger, Collections, "Is it counted?", Achievements in this period) | yes | A/H/G/**M Full** · **V View** |
| 16 | `/finance/new` | yes | as Finance |
| 17 | `/codes` | yes | A/H Full · G/M/V View |
| 18 | `/kpis`, `/kpis/achievements`, `/kpis/achievements/new`, `/kpis/achievements/[id]`, `/achievements` | yes | A/H/G Full · M Own · V View |
| 19 | `/reports` | yes | A/H Full · G/M/V View |
| 20 | `/activity` | yes | A Full · H View · G View · **M none · V none** |
| 21 | `/people/[id]` | yes | per Settings → People & access |
| 22 | `/profile` | yes | everyone, own |
| 23 | `/recently-deleted` | yes | admin |
| 24 | `/settings`, `/settings/[group]` (org, partners, performance, finance, work, app) | yes | Admin only |
| 25 | `/settings/performance/[id]` — **new** (plan detail, targets, categories) | yes | Admin only |
| 26 | `/overview`, `/pipeline`, `/projects`, `/appraisal` | **not built** | in no menu; the address answers "Being built" |
| 27 | `/kit` | yes | internal design page |
| 28 | `/sign-in`, `/set-password` | yes | signed-out |
| 29 | `/auth/sign-out`, `/auth/admin/*` (11 doors) | yes | Admin doors |
| 30 | any other address | — | Not found (404) inside the shell |

### What changed in the route list since `5764f84`

| Change | Landing | Effect on cells |
|---|---|---|
| `/clients` list → `/partners`; `/clients…` kept as redirects | 23, 24 | cells re-addressed, none struck; new redirect + 404 cells (F2-D) |
| `/suppliers` list moved under the shared list frame | 24 | no change to cells |
| `/settings/performance/[id]` added | 6 | new cells (F2-K) |
| `/files/[id]/download` added | 2 | new cells (F2-L) |
| No route removed | — | **0 cells struck for a removed route** |

## 2 · Cell inventory — what changed at this head

A cell is one surface, as one role, with one thing to see. Role letters: **A** Admin · **H** Head · **G** Manager ·
**M** Member · **V** Viewer. All cells are run with the TEST accounts on TEST-marked data.

| Head change (brief's list) | Landings | New cells | Group |
|---|---|---|---|
| Per-member settings | 40 | 22 | F2-A |
| Finance achievements list | 41 | 14 | F2-B |
| Activity Comment filter | 44 | 9 | F2-C |
| Partners rename | 22, 23, 24 | 13 | F2-D |
| "Responsible", not "Owner" | 36, 37 | 6 | F2-E |
| Bulk-assign | 3, 4, 37 | 10 | F2-F |
| Finance F-C | 38 | 11 | F2-G |
| The F179 overturn (Members Full, Viewers View on Finance) | 7, 34, 34b | 14 | F2-H |
| Small-fixes | 11, 19, 30, 34, 34b, 35 | 23 | F2-I |
| The 5 CI #1577 failure areas | 7 | 10 | F2-J |
| Test-data enrichment | 42, 45 | 0 (a pre-flight, section 5) | — |
| **Sub-total, the brief's list** | | **132** | |
| *Found at head, not on the brief's list:* | | | |
| Targets screen, built from scratch | 6 | 6 | F2-K |
| File download door | 2 | 5 | F2-L |
| Finance F-B (counted / not counted, the two lists) | 32 | 9 | F2-M |
| Task features (decision, links, mentions, hand-over, deputy, steps) | 33 | 12 | F2-N |
| The re-skin: five themes on six key screens | 31 | 30 | F2-O |
| **Sub-total, found at head** | | **62** | |
| **All new cells** | | **194** | |

Unchanged: Amendment 4 stands. Member starts at none on `/activity` at this head, so its 7 cells stay struck.

## 3 · M for the follow-up round

### 3.1 The sum

| | Cells |
|---|---|
| Round one after Amendment 4 | 1,150 |
| Struck at this head (no route or surface was removed) | − 0 |
| New cells, the brief's list (F2-A … F2-J) | + 132 |
| New cells, found at head (F2-K … F2-O) | + 62 |
| **M** | **1,344** |

If the five found groups are left out, M = 1,282.

### 3.2 Batch totals — what is actually run in this round

| Batch | What | Cells |
|---|---|---|
| F1 | re-test of the 77 blocks-work fixes, one cell per fix, by fix group | 77 |
| F2 | new surfaces since `5764f84` | 194 (132 + 62) |
| F3 (stretch) | re-test of the 57 wrong-data + 112 cosmetic fixes, one cell per fix | 169 |
| **Run in this round** | | **440** (271 without the stretch) |
| Carried from round one, not re-run | 1,150 − 246 | 904 |
| **M** | 904 + 246 + 194 | **1,344** |

Assumption: each fix is re-tested on the one round-one cell that failed. A fix that covered several failing cells
adds re-runs to F1/F3 but does not change M.

### 3.3 Overlaps to check when the round-one IDs are mapped (each one found lowers M by 1)

1. **Member and Viewer on Finance.** At `5764f84` Finance was refused to both (F179). If round one holds
   "refused" cells for M or V on `/finance` or a partner's Finance tab, each is replaced by its F2-H cell.
2. **Member or Manager importing on Finance.** Importing is now an extra (Landing 40). A round-one cell that
   expects a Manager to import is replaced by F2-A07.
3. **The word "Owner"** on the Tasks quick-add form, list filter or bulk box: replaced by F2-E.
4. **The old Clients address or the word "Clients"** in a cell's expectation: re-addressed to `/partners`, same cell.

## 4 · The batches

### F1 — the 77 blocks-work fixes, by fix group

Order of work: money first, then access, then the daily pages. Each fix is re-run on its original cell, as the role
that found it, on a phone and on a desktop if the finding named one. The fix groups below are the ones named in
the landing records; which of the 246 findings sits in which group comes from the triage list.

| Order | Fix group | Landing | What to re-test | As | Finding IDs |
|---|---|---|---|---|---|
| 1 | FIX-09 Finance: period, as-of, past imports, status spellings | 2, 18, 25 | Overview, Ledger and a partner's Finance tab show the same totals for the same period | A, H | from triage list |
| 2 | FIX-07 crash and read hardening; Finance levels | 1, 7 | no page crashes on a failed read; Try again reads again | A, M | from triage list |
| 3 | FIX-34 stale reads | 1, 15 | a change shows without a manual reload | A, M | from triage list |
| 4 | FIX-03 commercial restrictions (own-task hand-over) | 3, 4 | a Member hands over only their own task | M, H | from triage list |
| 5 | FIX-39 file visibility; FIX-16 download door; FIX-08 Files list; FIX-38 file names; FIX-46 uploader | 2, 4, 5 | a restricted file is not listed and not downloadable; names are kept | A, M, V | from triage list |
| 6 | FIX-30 / FIX-31 partner remove and archive; FIX-14 primary contact | 4 | remove, archive, restore; one primary contact | A, H | from triage list |
| 7 | FIX-45 partner page: one read, list speed | 5, 34, 35 | record and its Codes and Finance tabs load inside the limit | M | from triage list |
| 8 | FIX-23 targets screen | 6 | plan detail, targets, categories editor | A | from triage list |
| 9 | FIX-02 date and month pickers | 1, 3 | pick, clear, type; the 2024 floor | A, M | from triage list |
| 10 | FIX-04 codes detail | 1 | a code's detail opens and totals agree | A, H | from triage list |
| 11 | FIX-18 Activity timeline and row clicks; FIX-15 agreement review date; FIX-24 tab alias | 2, 14 | rows open their record; the date shows; old tab links open the right tab | A | from triage list |
| 12 | FIX-06 post-save dialog; FIX-27 Deferred; FIX-29 Done count | 4 | save closes cleanly; counts agree with the list | M | from triage list |
| 13 | FIX-25, FIX-37 bell: kinds, counts, link | 0, 4, 5, 14 | the bell number equals the unread list; each opens its record | M, H | from triage list |
| 14 | FIX-41 access list closed by default; FIX-43 questions | 5 | Settings → People & access opens closed; a question is asked and answered | A | from triage list |
| 15 | FIX-10, 11, 19, 20, 21, 22, 42 | 4 | per the triage list | — | from triage list |
| 16 | Groups not named in any landing record: FIX-01, 05, 12, 13, 17, 26, 28, 35, 36, 40, 44 | — | per the triage list | — | from triage list |
| | **F1 total** | | | | **77** |

### F2 — new surfaces since `5764f84` (194 cells)

**F2-A · Per-member settings (22)** — Settings → People & access → a person → "Extra access for this person".

| ID | As | See |
|---|---|---|
| A01 | A | a Member's record shows three rows: Import files on Finance, Edit someone else's work, Change credit limits |
| A02 | A | setting Import to Allowed asks for a reason and saves |
| A03 | M | with Import Allowed: the import section shows on Finance |
| A04 | M | as their role: no import section on Finance |
| A05 | H | as their role: the import section shows |
| A06 | H | set to View only: the import section is gone |
| A07 | G | as their role: no import section |
| A08 | M | Edit someone else's work Allowed: can change a colleague's task they can see |
| A09 | M | as their role: cannot change a colleague's task |
| A10 | M | Edit someone else's work Allowed opens nothing they could not see before |
| A11 | M | Change credit limits Allowed: changes a client's limit |
| A12 | H | Change credit limits View only: cannot change a client's limit |
| A13 | G | as their role: changes the company-wide limit in Settings → Finance |
| A14 | A | a Viewer's record: one sentence, no picker |
| A15 | A | "Allowed" on a Viewer is refused in words |
| A16 | A | an Admin's record says an admin has everything |
| A17 | A | under a set row: who set it and when |
| A18 | A | undoing a change puts the row back |
| A19 | H | a Head cannot change any of the three rows |
| A20 | A | each change is in Activity with its reason |
| A21 | A | the section in Arabic, right to left |
| A22 | A | the section on a 375-wide phone |

**F2-B · Achievements in this period, on Finance (14)**

| ID | As | See |
|---|---|---|
| B01 | A | the card sits under "Is it counted?", newest first |
| B02 | A | no amount is shown on any row |
| B03 | A | changing the period changes the list; an empty period says "No achievements in this period." |
| B04 | A | Revenue, Cost and Profit read the same before and after an achievement is logged |
| B05 | A | a title opens the achievement's own record |
| B06 | H | lists what the Head sees on Achievements |
| B07 | G | lists the Manager's team's |
| B08 | M | lists the Member's own team's |
| B09 | V | lists what the Viewer sees on Achievements |
| B10 | M | an organisation is named only where the reader may open it |
| B11 | A | more than fifty: says how many are shown |
| B12 | A | a failed read shows Try again, and it reads again |
| B13 | A | Arabic |
| B14 | M | phone |

**F2-C · Activity → What → Comment (9)** — Member stays struck (Amendment 4).

| ID | As | See |
|---|---|---|
| C01 | A | under Comment every entry reads Comment; none is named "Organisation added" |
| C02 | A | the choice is in the address and survives a reload |
| C03 | A | clearing the choice brings the full list back |
| C04 | A | "Show earlier" under the filter loads more and does not loop |
| C05 | A | another kind (Task) narrows inside each entry the same way |
| C06 | H | Comment filter at View level |
| C07 | G | Comment filter at View level |
| C08 | A | Arabic |
| C09 | A | phone |

**F2-D · Partners rename (13)**

| ID | As | See |
|---|---|---|
| D01 | A | the menu says Partners |
| D02 | M | the menu says Partners |
| D03 | V | the menu says Partners |
| D04 | M | `/clients?…` lands on `/partners` with the same filters |
| D05 | M | `/clients/[id]` lands on the partner's record |
| D06 | M | Suppliers is the second tab of Partners |
| D07 | A | one company with two roles is on both lists |
| D08 | M | a partner number that does not exist: Not found, inside the shell |
| D09 | M | a supplier number that does not exist: Not found, inside the shell |
| D10 | A | the duplicate-name message reads correctly |
| D11 | M | the Arabic label |
| D12 | M | Ctrl K finds "Partners" |
| D13 | A | record header, tabs and create form say partner, never client |

**F2-E · "Responsible", not "Owner" (6)**

| ID | As | See |
|---|---|---|
| E01 | M | the quick-add form |
| E02 | M | the Tasks list filter |
| E03 | H | the bulk-assign box |
| E04 | A | the task record |
| E05 | M | the Arabic wording in the same three places |
| E06 | A | a sweep of Tasks, My day and Team view: the word "Owner" appears nowhere |

**F2-F · Bulk-assign on the Tasks list (10)**

| ID | As | See |
|---|---|---|
| F01 | H | pick several tasks, assign to one person: all change |
| F02 | G | the same, inside the Manager's team |
| F03 | M | only the Member's own tasks can be picked |
| F04 | M | a colleague's task cannot be bulk-assigned |
| F05 | V | no tick boxes, no bulk box |
| F06 | A | assigning to someone who cannot see the task's partner is refused in words |
| F07 | H | each change is in the task's history |
| F08 | H | undo puts every task back |
| F09 | H | Arabic |
| F10 | H | phone |

**F2-G · Finance F-C (11)**

| ID | As | See |
|---|---|---|
| G01 | A | the Ledger lists Pending and Draft invoices under "Not yet counted" |
| G02 | A | those rows are in no total |
| G03 | A | the partner's Finance tab names the same rows in its "Not yet counted" card |
| G04 | A | search finds an invoice by number and says "Not counted yet" |
| G05 | A | a search hit opens the Ledger on the invoice's day |
| G06 | A | the New invoice form shows the invoice saved last |
| G07 | A | "Custom" opens its From / To panel on the first press |
| G08 | M | "Not yet counted" shows |
| G09 | V | "Not yet counted" shows, read-only |
| G10 | A | Arabic |
| G11 | M | phone: five rows and "See all" |

**F2-H · The F179 overturn — Finance for Members and Viewers (14)**

| ID | As | See |
|---|---|---|
| H01 | M | Finance is in the menu |
| H02 | M | the Overview loads and settles |
| H03 | M | the Ledger loads |
| H04 | M | "What needs attention" settles |
| H05 | M | `/finance/new` opens |
| H06 | M | a partner's Finance tab opens |
| H07 | M | no import section (unless Allowed — F2-A03) |
| H08 | V | Finance is in the menu |
| H09 | V | the page loads, nothing can be changed |
| H10 | V | New invoice is not offered |
| H11 | V | a partner's Finance tab opens, read-only |
| H12 | A | Settings → Access: lowering Member to None refuses the Member in words |
| H13 | A | raising it back restores the page |
| H14 | M | Arabic |

**F2-I · Small-fixes (23)**

| ID | As | See |
|---|---|---|
| I01 | M | Today's three: up to 3 Important, 3 Short, 3 Maintenance |
| I02 | M | the same nine after a reload |
| I03 | H | My team tab lists the team's streaks |
| I04 | A (real admin) | the admin notice, not Today's three |
| I05 | V | Today's three from the Viewer's own tasks |
| I06 | M | the Board: one column per status, side by side |
| I07 | M | dragging a card to another column changes its status |
| I08 | M | phone: a column snaps into place; the drag works |
| I09 | M | Arabic: columns run right to left |
| I10 | M | Tasks search filters while typing |
| I11 | M | global search opens its result on click and on Enter |
| I12 | M | an organisation's name opens its record on the first click |
| I13 | M | a refused Add task says why and keeps what was typed |
| I14 | A | Arabic On in Settings → App: the language choice appears |
| I15 | M | choosing Arabic saves and reloads the app in Arabic |
| I16 | V | the organisation's Arabic setting switches a person who has not chosen |
| I17 | A | Settings does not crash after a save |
| I18 | A | People & access search: any part of a name, words in any order |
| I19 | A | the People table fits its box with a TEST person listed |
| I20 | M | a partner record, then its Codes and Finance tabs, each load |
| I21 | M | a client's achievements are on its Related tab |
| I22 | A | Clear resets a custom period to the year to date |
| I23 | A | the Month filter keeps its width; `/files` opens |

**F2-J · The five CI #1577 failure areas (10)** — areas read from the Landing 7 change set; confirm against the CI record.

| ID | As | See |
|---|---|---|
| J01 | M | employee view: the menu holds exactly the pages the Member's access opens |
| J02 | V | employee view: the same for the Viewer |
| J03 | M | Finance Overview opens at the Member's level |
| J04 | V | Finance Overview opens at View |
| J05 | M | a page out of the menu still answers by address at the person's level |
| J06 | V | the same for the Viewer |
| J07 | M | My profile saves |
| J08 | V | My profile saves |
| J09 | M | the shell: top bar, bell and profile menu after a page change |
| J10 | V | the same for the Viewer |

**F2-K · Targets screen (6)** — `/settings/performance/[id]`

| ID | As | See |
|---|---|---|
| K01 | A | a plan's detail opens |
| K02 | A | a target is added, edited and deleted |
| K03 | A | the achievement-categories editor saves |
| K04 | H | refused |
| K05 | M | refused |
| K06 | A | Arabic |

**F2-L · File download door (5)**

| ID | As | See |
|---|---|---|
| L01 | A | a file downloads under the name the setting asks for |
| L02 | M | an own file downloads |
| L03 | M | a restricted file's link is refused |
| L04 | V | a visible file downloads |
| L05 | signed out | the link asks for sign-in |

**F2-M · Finance F-B (9)**

| ID | As | See |
|---|---|---|
| M01 | A | every Ledger row says whether it counts |
| M02 | A | Exclude takes a row out of the totals; Include puts it back |
| M03 | A | Settings → Finance: the exclusion list and the merge list save |
| M04 | H | the two lists are not offered |
| M05 | A | "Is it counted?" per month and per year adds up to the Ledger |
| M06 | A | a code's discount follows the dates and organisation chosen |
| M07 | A | cost shows a dash when none is known, never 0 |
| M08 | M | no Exclude button |
| M09 | V | no Exclude button |

**F2-N · Task features (12)**

| ID | As | See |
|---|---|---|
| N01 | M | a comment marked as the decision is pinned above the thread |
| N02 | M | a comment's link chip opens the partner, project, invoice or code |
| N03 | M | a mention makes the person a helper |
| N04 | M | a hand-over with no reason is refused; 120 characters at most |
| N05 | M | hand-over is offered only to the task's Responsible |
| N06 | A | the same rule holds for an Admin |
| N07 | M | a deputy is named and can act on the task |
| N08 | H | a hand-over to someone who cannot see the partner is refused |
| N09 | M | the task page lists every hand-over with its reason |
| N10 | M | steps done on a task show on the achievement's Evidence tab |
| N11 | V | none of these changes is offered |
| N12 | M | the Arabic wording |

**F2-O · The re-skin (30)** — five themes × six key screens, as Member, one look each: My day, Tasks list, Task
record, Partners list, Partner record, Finance. IDs `O-<theme 1–5>-<screen 1–6>`. Pass = readable text, no
clipped control, the chosen theme survives a reload.

### F3 — stretch: the 57 wrong-data + 112 cosmetic fixes (169)

Run only after F1 and F2 are closed. Same fix groups and order as F1; wrong-data first.

| Part | What | Cells |
|---|---|---|
| F3-a | 57 wrong-data fixes, one cell each — a number or name is compared with the Ledger or the record, never with memory | 57 |
| F3-b | 112 cosmetic fixes, one cell each — mostly FIX-32 wording, FIX-33 Arabic, FIX-47 drawer reflow, FIX-48 theme switch | 112 |
| | **F3 total** | **169** |

## 5 · Pre-flight (not counted in M)

1. The workspace is at `f158ee8`, and the TEST Admin, Head, Member and Viewer logins work. A TEST Manager is
   needed for 6 cells (A07, A13, B07, C07, F02 and any F1 cell found as Manager); without one, they run through
   the owner's switch.
2. The enrichment script (Landings 42 and 45) is run by the holder of the TEST Admin login: first plain (it
   writes nothing and says what it would add), then `--write`. Every record it makes starts with "TEST · ".
3. Each TEST person has at least nine open tasks (Today's three and the Board need them).
4. Nothing in this round is run on a record that does not start with "TEST · ".

## 6 · Pass rule

A cell passes when the thing named is seen, as that role, with a screenshot. A batch closes when every cell in it
is passed or carries a finding number. F1 must close before the round is reported; F3 may stay open.
