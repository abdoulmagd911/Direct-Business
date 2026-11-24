# Follow-up test round plan — Commercial Workspace, re-issued for head `f158ee8` (Landing 46)

* **Re-issue, 24 Nov 2026.** This re-points `followup-test-round-plan-2026-11-10.md` (M = 1,150, last re-issued for the
  Landing 13 head `c41bc5d`) at the live head `f158ee80` (Landing 46). Planning only: no code, no push to `v2/main`,
  no live change, no test run. **It replaces `test_plan_followup_f158ee8.md` (M = 1,344), which is WITHDRAWN and
  must not be placed anywhere.**
* **Frozen record:** `test_plan_draft.md` (head `5764f84`, M = 1,157) is not edited. This plan keeps its method: a
  cell is one control × each acting role at 1440 px, plus state, visibility and the named classes; phone is a
  separate track (42 cells), never in M; Arabic is the B cells; six roles (AD, CO, HE, MG, ME, VW).
* **Sources read:** `test_plan_draft.md`, `followup-test-round-plan-2026-11-10.md`, `batch0-note-2026-11-08.md`,
  `reissue-amendment-3-consolidated-review-report.md`, `per-member-settings-design-2026-11-22.md`,
  `reskin-task-enhancement-brief-2026-11-15.md`, `batch4-session3-note-2026-11-08.md`,
  `followup-glitch-list.md` — in full. `consolidated-fix-list.md`, `glitch-list.md`, `round-status.md` — headers, terms, the per-group headings, §7,
  the §8 index (all 248 findings, parsed by script: 77 / 57 / 112 / 2, each exactly once) and the status entries for
  both rounds; the long decision and finding bodies were not read line by line. Code: `v2/main` at `f158ee80`
  against `5764f84` (66 commits, route files, page registry, role defaults, `docs/v2/landings/LANDING-28…46.md`).
* **Counts used:** 248 findings = 77 blocks work + 57 wrong data + 112 cosmetic + 2 not provable (the fix list's
  corrected count; "246" was wrong).

## 1 · M

| | Cells |
|---|---|
| Frozen M (head `5764f84`) | 1,157 |
| Struck per P2 — the 7 Member R24 cells (`/activity`), fix list §7 #4–10 | − 7 |
| Follow-up M as last issued (10 and 12 Nov) | 1,150 |
| Struck at `f158ee8` (no route, screen or control group was removed) | − 0 |
| New cells at `f158ee8` (§3 below) | + 56 |
| **M for this round** | **1,206** |

* **The seven struck cells, by ID** (`batch4-session3-note-2026-11-08.md`, lines 8, 18 and 82 — "the TEST Member R24
  controls"). The frozen plan gives control cells no serial number, so the ID is screen · control · role:

  | # (fix list §7) | Cell |
  |---|---|
  | 4 | R24 · person filter (Who) · ME |
  | 5 | R24 · kind filter (What) · ME |
  | 6 | R24 · date filter (Since) · ME |
  | 7 | R24 · row → record · ME |
  | 8 | R24 · Try again · ME |
  | 9 | R24 · empty state · ME |
  | 10 | R24 · Undo entries · ME |

  The eighth Member cell, **R24 · search · ME, is not struck**: the session tested it (global search works for a
  Member without the page) and it stays in M. The order of #4–10 follows the note's own list; the fix list numbers
  the seven only as a range. (The seven manager-dependent cells of the frozen plan §8 — A3, N4, K3, K8, J3, R7, N1 —
  are a different seven and are not struck.)
* **Still struck at this head:** Member starts with no access to `/activity` at `f158ee8` (Admin Full, Head View,
  Manager View), so P2 stands.
* **M freezes at the end of this round's Batch 0**, as in the frozen plan §3.4: the 56 new cells are counted from the
  landing notes and the code, and Batch 0 confirms each control at first open. A control that is not there is a
  finding, not a silent cut.
* **Phone track:** 42 cells, unchanged, reported apart.

## 2 · Route inventory at `f158ee8` — changes to the frozen R1–R40

| Route | At `5764f84` | At `f158ee8` | Landing | Cells |
|---|---|---|---|---|
| R8 Partners list | `/clients` | `/partners` | 23, 24 | re-addressed, same cells |
| R9 Partner record | `/clients/[id]` | `/partners/[id]` | 23, 24 | re-addressed, same cells |
| R12 | `/partners` → `/clients` | `/clients` → `/partners`, filters kept | 23 | G5 re-pointed |
| R13 | `/partners/[id]` old link | `/clients/[id]` old link | 23 | G3 re-pointed |
| R10 / R11 Suppliers | own list | second tab of Partners, same addresses | 24 | same cells |
| R32 | `/settings/performance` | + `/settings/performance/[id]` (plan detail, targets, categories) | 6, 7 | inside R32's 14 controls |
| R14 `/files` | row download by signed link | + `/files/[id]/download`, re-checks access each time | 2 | inside R14 and X1 |
| R20 `/finance` | refused to Member and Viewer | Member Full, Viewer View; import is a per-person extra | 7, 34, 34b, 40 | state cell replaced (Amendment 4), +14 new |
| R24 `/activity` | Member gated | unchanged | — | 7 stay struck |
| R35–R38 | Being built | unchanged | — | same cells |
| Themes | Light, Dark, Direct | Light, Dark, Direct, Turquoise, System | 31 | E1–E9: 9 cells, 45 looks (was 27) |
| Signed-out S3 | `/clients` | `/partners` | 23 | re-pointed |

50 route files at `f158ee8` (48 at `5764f84`); none removed. The frozen plan's tripwire ("a new theme name appears")
has fired by design: the re-skin landed in Landing 31, which is why every design-class cell is re-looked (§4, F3-c).

## 3 · Cell inventory — the 56 new cells

| Set | Where | New cells | Count |
|---|---|---|---|
| Per-member settings (Landing 40) | R26 Person record, "Extra access for this person" | control ×AD: Import files on Finance; Edit someone else's work; Change credit limits (each: set, reason asked, who-and-when line, Undo) | 3 |
| | R26 | state: a Viewer's record (one sentence, no picker); an Admin's record ("an admin has everything") | 2 |
| | agreement | A13 Import Allowed / View only ↔ the import section shows / is gone on R20 for that person; A14 Edit someone else's work ↔ a colleague's visible task becomes editable, and nothing unseen opens; A15 Change credit limits ↔ a client's limit and the company-wide limit on R30 | 3 |
| | refusal | X5 "Allowed" on a Viewer is refused in words | 1 |
| Finance F-B, F-C, achievements list (Landings 32, 38, 41) | R20 | control ×AD, CO: "Achievements in this period" row → record; "Not yet counted" list (rows, See all); "Is it counted?" table (month / year) | 6 |
| | R20 | control ×AD: Exclude / Include on a Ledger row | 1 |
| | R20 | visibility: Viewer opens Finance read-only | 1 |
| | finance reconciliation | F7 logging an achievement moves no Revenue, Cost or Profit figure, and the card shows no amount; F8 "Not yet counted" rows are in no total, and the partner's Finance tab names the same rows; F9 Exclude moves the totals by exactly that row and Include restores them; F10 "Is it counted?" adds up to the Ledger; F11 a partner's Finance tab equals the Finance page filtered to that partner | 5 |
| | route | G9 a search hit for an invoice number opens the Ledger on that invoice's day and says "Not counted yet" where true | 1 |
| Partners rename (Landings 23, 24) | route | G10 a partner number that does not exist answers Not found inside the shell; G11 the same for a supplier | 2 |
| Own-task rule on bulk assign (Landings 3, 4, 37) | refusal | X6 a Member bulk-assigning a colleague's task is refused | 1 |
| Task features (Landing 33) | R7 Task record | control ×MG, ME: mark a comment as the decision; link chip on a comment (partner, project, invoice, code); mention on a task; deputy picker | 8 |
| | R5 Tasks board | control ×MG, ME: drag a card to another column | 2 |
| | agreement | A16 decision pinned above the thread; A17 mention → the person is a helper and has the task under Helping; A18 the deputy can act; A19 board drag ↔ status on the record and the list | 4 |
| | refusal | X7 a hand-over with no reason, or over 120 characters, is refused; X8 hand-over is offered only to the task's Responsible, an Admin included | 2 |
| | notification | N9 a mention on a task sends one notice | 1 |
| My day (Landings 34, 34b, 35) | R2 | control ×MG, ME: Today's three (three groups of up to three; row → task; the same nine after a reload) | 2 |
| Client achievements (Landing 35) | R9 Related tab | control ×MG, ME: an achievement row → its record | 2 |
| The re-skin (Landing 31; brief of 15 Nov) | R8 Partners list | control ×MG, ME: the four cards Active, Prospects, Stale, Quiet, each filtering the list | 2 |
| | R9 Finance tab | control ×MG, ME: the "Imported" switch | 2 |
| | Shell | control ×MG, ME: theme switcher in the profile menu | 2 |
| | theme look | E10 sign-in (R39) and E11 Tasks list (R5) in every live theme — the two rebuilt screens E1–E9 do not cover | 2 |
| Task features, access rule (brief B3) | refusal | X9 a hand-over to someone who cannot see the task's partner is refused | 1 |
| **Total** | | | **56** |

By class: 30 control, 2 state, 1 visibility, 7 agreement, 5 finance reconciliation, 5 refusal, 3 route, 1
notification, 2 theme look.

**Head changes that add no cell** (they change what an existing cell must show, and are re-pressed in F2):

| Head change | Existing cells re-pressed | Cells |
|---|---|---|
| F179 overturn — Finance follows the access set in Settings; Member starts at Full, Viewer at View | the R20 state cell (Amendment 4 verification); Shell drawer entries ×MG, ME; Shell visibility ×CO, VW | 5 |
| Activity "What" filter shows only the chosen kind (Landing 44) | R24 kind filter ×AD, MG, with Comment | 2 |
| "Responsible", not "Owner" (Landings 36, 37) | C5 Tasks list, C6 new-task form, C7 task record | 3 |
| Bulk-assign box on Tasks | R5 bulk bar ×MG, ME | 2 |
| Finance "Custom" opens on the first press; attention strip settles (Landings 34b, 38) | R20 period picker ×AD, CO; attention checks ×AD, CO | 4 |
| The five CI #1577 failure areas: `settings-targets:52`, `long-titles:63` at 375 and 320 px, `pilot-fixes:54`, `the-bell-closes:15` (Arabic) | R32 target add / edit ×AD and categories editor ×AD; L8 long partner title; Shell bell ×MG in Arabic; the two phone items in the phone track | 4 + 2 phone |
| Settings → Finance exclusion and merge lists, credit-limit card (Landings 31, 32) | R30 list-editor controls and setting-card group ×AD, new lists named as options | 2 |
| Arabic setting switches the app; People & access search (Landings 34, 34b) | R29 setting-card group ×AD; R28 search ×AD | 2 |
| Five themes (Landing 31) | E1–E9, every live theme | 9 |
| Partners re-address | G3, G5, S3 | 3 |
| **Changed cells re-pressed in F2** | | **36** |

## 4 · The batches

| Batch | What | Count |
|---|---|---|
| **F1** | re-test of the 77 blocks-work findings, by fix group | 77 fixes |
| **F2** | new surfaces since `5764f84`: 56 new cells + 36 changed cells | 92 cells |
| **F3** (stretch) | re-test of the 57 wrong-data + 112 cosmetic findings | 169 fixes |
| not provable | the 2 not-provable findings, re-attempted with their groups | 2 |
| **Findings re-tested** | F1 + F3 + 2 | **248** |

A fix is re-tested on the cells its Verification line names in `consolidated-fix-list.md` (by first-round session,
shown in the last column). The number of cells pressed is tallied from the batch notes at run time and reported as
"tested N of 1,206", as in the 10 Nov plan; cells named by no Verification line and not in F2 are covered by CI on
the head, and the round note says so.

### F1 — the 77 blocks-work findings (72 in fix groups + 5 with no product fix)

Order of work: FIX-09 and FIX-17 (money) first, then FIX-03 (access), then in FIX number order.

| Fix group | What it is | Fixes | Findings (* = held leg) | First-round sessions to re-press |
|---|---|---|---|---|
| FIX-01 | Lists: sort, filters, columns, bulk | 11 | F050, F051, F052, F053*, F075, F099, F100*, F101, F129, F138*, F159* | B2s2, B2s4, B3s1, B3s3, B3s5 |
| FIX-02 | Native date/month pickers: typed dates do not commit, day-click dismisses | 6 | F002, F080, F116, F186, F214, F236 | B1s1, B2s4, B3s2, B4s2, B5s3, B6s1 |
| FIX-03 | Role access and Commercial restrictions | 6 | F088, F174, F195, F243, F244*, F245 | B2s5, B4s1, B4s3, B6s2 |
| FIX-04 | Discount-code detail fails / missing controls | 5 | F156, F157, F160, F161, F196 | B3s5, B4s3 |
| FIX-05 | New-task form is missing fields | 4 | F021, F022*, F023, F024* | B1s2 |
| FIX-06 | Log-achievement form is missing fields and drops data | 4 | F077, F078, F079, F091* | B2s4, B2s5 |
| FIX-07 | Transient server errors and app crashes | 3 | F126, F131, F163 | B3s2, B3s3, B3s5 |
| FIX-08 | /files filters, sort and paging do not work | 3 | F146, F148, F151 | B3s4 |
| FIX-09 | Finance page controls: saved views, ledger, import | 2 | F170, F177 | B4s1 |
| FIX-10 | Undo does not undo | 2 | F056, F057 | B2s3 |
| FIX-11 | Recently Deleted: no filters, Member sees everything, reasons cut off | 1 | F225 | B5s5 |
| FIX-12 | Saved views do not behave as saved | 2 | F048, F049 | B2s2 |
| FIX-13 | Search finds nothing | 2 | F158, F194 | B3s5, B4s3 |
| FIX-14 | Partner record writes do not save or do not show | 2 | F114, F115 | B3s2 |
| FIX-15 | Review date cannot be set at upload | 1 | F162 | B3s5 |
| FIX-16 | Signed download URL is not obtainable | 1 | F064 | B2s3 |
| FIX-17 | Saved invoice 1163000012 is invisible everywhere — HELD | 1 | F185* | B4s2 |
| FIX-18 | /activity list is capped and rows do not open | 1 | F193 | B4s3 |
| FIX-19 | Sign-in has no set-password link and no language control | 2 | F204, F205 | B5s1 |
| FIX-20 | /profile: no start-page picker, profile facts disappear, no mismatch message | 1 | F207 | B5s2 |
| FIX-21 | Switch off cannot complete | 1 | F213 | B5s3 |
| FIX-22 | People list cannot be filtered by department | 1 | F216 | B5s3 |
| FIX-23 | Targets screen does not open at all | 1 | F224 | B5s5 |
| FIX-24 | ?tab=comments does not open Discussion | 1 | F230 | B5s6 |
| FIX-25 | alert_weekly_unlogged kind is listed nowhere | 1 | F233 | B5s6 |
| FIX-26 | Need-help flag: flagger cannot see it, manager cannot read the note | 1 | F031 | B2s1 |
| FIX-27 | Reminders and deferred notes are orphaned | 1 | F037 | B2s1 |
| FIX-28 | "Try again" is untriggerable or absent — VERIFY-ONLY, STANDALONE | 2 | F054, F076 | B2s2, B2s4 |
| FIX-29 | Weekly review: no dismiss, logged tasks still listed | 1 | F029 | B2s1 |
| FIX-30 | Partners list filters: bare switches, no "All", mixed priority words | 1 | F097 | B3s1 |
| FIX-31 | Partner Remove / Archive do not exist | 1 | F098 | B3s1 |
| §3 (no product fix) | No product fix — confirm the recorded state only | 5 | F011, F038, F068, F136, F206 | B1s1, B2s1, B2s3, B3s3, B5s1 |
Notes for F1:
* **Held legs (*)** are re-pressed only as far as the hold was lifted (P1b own-task hand-over landed in Landings 3–4;
  FIX-17 was decided by Landing 38: invoice 1163000012 is now listed under "Not yet counted" — F8 is its proof).
* **FIX-03's F179 legs are overturned** — verified by the F2 access cells, not as a refusal.
* **FIX-28 (F054, F076)** close only on a live induced error showing the control, as the 10 Nov plan ruled.
* **§3 findings** have no product fix: the re-test records whether the state is as the fix list left it.

### F2 — new surfaces (92 cells)

The 56 new cells of §3 and the 36 changed cells listed under it. Run after F1's money and access groups, in this
order: R20 Finance (14 new + 9 changed) → R26 per-member settings (9) → R7 / R5 task features (18 + 5) → R2, R8, R9
(8) → routes (2 + 3) → settings and shell (11) → themes (11) → #1577 areas (4 + 2 phone).

### F3 — stretch: wrong data, then cosmetic

**F3-a · the 57 wrong-data findings**

| Fix group | What it is | Fixes | Findings (* = held leg) | First-round sessions to re-press |
|---|---|---|---|---|
| FIX-02 | Native date/month pickers: typed dates do not commit, day-click dismisses | 1 | F187 | B4s2 |
| FIX-03 | Role access and Commercial restrictions | 5 | F089, F127, F137, F179, F215 | B2s5, B3s2, B3s3, B4s1, B5s3 |
| FIX-06 | Log-achievement form is missing fields and drops data | 1 | F247 | B6s2 |
| FIX-08 | /files filters, sort and paging do not work | 2 | F149, F150 | B3s4 |
| FIX-09 | Finance page controls: saved views, ledger, import | 4 | F171, F173, F182, F188 | B4s1, B4s2 |
| FIX-10 | Undo does not undo | 1 | F118 | B3s2 |
| FIX-11 | Recently Deleted: no filters, Member sees everything, reasons cut off | 1 | F226 | B5s5 |
| FIX-12 | Saved views do not behave as saved | 1 | F046 | B2s2 |
| FIX-14 | Partner record writes do not save or do not show | 1 | F119 | B3s2 |
| FIX-17 | Saved invoice 1163000012 is invisible everywhere — HELD | 1 | F184* | B4s2 |
| FIX-18 | /activity list is capped and rows do not open | 1 | F192 | B4s3 |
| FIX-20 | /profile: no start-page picker, profile facts disappear, no mismatch message | 1 | F208 | B5s2 |
| FIX-26 | Need-help flag: flagger cannot see it, manager cannot read the note | 1 | F006 | B1s1 |
| FIX-27 | Reminders and deferred notes are orphaned | 2 | F010, F036 | B1s1, B2s1 |
| FIX-29 | Weekly review: no dismiss, logged tasks still listed | 1 | F030 | B2s1 |
| FIX-31 | Partner Remove / Archive do not exist | 2 | F103, F130 | B3s1, B3s3 |
| FIX-32 | Wording: raw keys, jargon, wrong labels, defensive notes | 1 | F005 | B1s1 |
| FIX-33 | Arabic: names translated, "Co." full stop displaced, language switch does not re-render | 1 | F123 | B3s2 |
| FIX-34 | #399 stale-after-write: lists, counts, badges and headers show the pre-write state until reload | 12 | F001, F003, F043, F045*, F059, F102, F104, F128, F132, F133, F134, F135 | B1s1, B2s2, B2s3, B3s1, B3s3 |
| FIX-35 | Achievement record shows no link to its task | 5 | F007, F009, F044, F074, F087 | B1s1, B2s2, B2s4, B2s5 |
| FIX-36 | Achievement display: double prefix, Evidence count, empty Participants | 2 | F073, F086 | B2s4, B2s5 |
| FIX-37 | Notifications: asker gets no answer notice; bell shows different unread sets; counts disagree | 3 | F008, F237, F238 | B1s1, B6s1 |
| FIX-38 | Uploaded files are renamed, several sharing one identical name | 2 | F025, F144 | B1s2, B3s3 |
| FIX-39 | Partner files: Members/Viewers/Commercial see different files; Download silently does nothing | 2 | F117, F248 | B3s2, B6s2 |
| FIX-40 | Delegating manager is not in the Helpers list | 1 | F004 | B1s1 |
| FIX-45 | /clients navigation is slow + refresh latency | 1 | F164 | B3s5 |
| FIX-49 | Phantom / wrong task rows | 1 | F246* | B6s2 |
**F3-b · the 112 cosmetic findings**

| Fix group | What it is | Fixes | Findings (* = held leg) | First-round sessions to re-press |
|---|---|---|---|---|
| FIX-02 | Native date/month pickers: typed dates do not commit, day-click dismisses | 1 | F096 | B2s5 |
| FIX-03 | Role access and Commercial restrictions | 4 | F239, F240, F241, F242 | B6s1 |
| FIX-04 | Discount-code detail fails / missing controls | 1 | F165 | B3s5 |
| FIX-08 | /files filters, sort and paging do not work | 2 | F147, F152 | B3s4 |
| FIX-09 | Finance page controls: saved views, ledger, import | 5 | F172, F176, F180, F181, F183 | B4s1 |
| FIX-10 | Undo does not undo | 3 | F027, F058, F197 | B1s2, B2s3, B4s3 |
| FIX-11 | Recently Deleted: no filters, Member sees everything, reasons cut off | 1 | F227 | B5s5 |
| FIX-12 | Saved views do not behave as saved | 1 | F055 | B2s2 |
| FIX-13 | Search finds nothing | 2 | F012, F072 | B1s1, B2s3 |
| FIX-18 | /activity list is capped and rows do not open | 1 | F202 | B4s3 |
| FIX-20 | /profile: no start-page picker, profile facts disappear, no mismatch message | 1 | F209 | B5s2 |
| FIX-28 | "Try again" is untriggerable or absent — VERIFY-ONLY, STANDALONE | 2 | F067, F090 | B2s3, B2s5 |
| FIX-30 | Partners list filters: bare switches, no "All", mixed priority words | 2 | F108, F113 | B3s1 |
| FIX-32 | Wording: raw keys, jargon, wrong labels, defensive notes | 34 | F014, F015, F016, F017, F032, F033, F041, F047, F061, F062, F082, F084, F093, F094, F095, F105, F106, F120, F121, F122, F140, F141, F166, F169, F175, F189, F198, F199, F200, F201, F210, F211, F219, F231 | B1s1, B2s1, B2s2, B2s3, B2s4, B2s5, B3s1, B3s2, B3s3, B3s5, B4s1, B4s2, B4s3, B5s2, B5s3, B5s6 |
| FIX-33 | Arabic: names translated, "Co." full stop displaced, language switch does not re-render | 20 | F042, F069, F070, F083, F107, F124, F125, F142, F143, F155, F167, F178, F190, F191, F203, F212, F228, F229, F232, F235 | B2s1, B2s3, B2s4, B3s1, B3s2, B3s3, B3s4, B3s5, B4s1, B4s2, B4s3, B5s2, B5s5, B5s6 |
| FIX-34 | #399 stale-after-write: lists, counts, badges and headers show the pre-write state until reload | 3 | F034, F063, F145 | B2s1, B2s3, B3s3 |
| FIX-36 | Achievement display: double prefix, Evidence count, empty Participants | 3 | F060, F085, F092 | B2s3, B2s4, B2s5 |
| FIX-38 | Uploaded files are renamed, several sharing one identical name | 1 | F168 | B3s5 |
| FIX-41 | Layout polish and missing validation messages | 7 | F217, F218, F220, F221, F222, F223, F234 | B5s3, B5s4, B5s6 |
| FIX-42 | ⋯ menus: missing actions, owner cannot delegate, Viewer gets an empty box | 4 | F013, F019, F020*, F110 | B1s1, B3s1 |
| FIX-43 | Discussion display and picker rules | 3 | F018, F065, F066 | B1s1, B2s3 |
| FIX-45 | /clients navigation is slow + refresh latency | 1 | F109 | B3s1 |
| FIX-46 | Record file rows show no uploader | 1 | F026 | B1s2 |
| FIX-47 | Drawer covers the page heading, tabs and search | 1 | F028 | B1s2 |
| FIX-48 | Theme follows the previous user after a test-user switch | 1 | F035 | B2s1 |
| §3 (no product fix) | No product fix — confirm the recorded state only | 7 | F071, F081, F111, F112, F139, F153, F154 | B2s3, B2s4, B3s1, B3s3, B3s4 |
**F3-c · re-skin re-look (existing cells, no change to M).** Landing 31 rebuilt the look, so the first round's
design results no longer stand: L1–L35, B1–B35, C1–C35 and O1–O6 are looked at again with the cosmetic re-tests of
the same screen (111 cells; E1–E11 are in F2). The six rebuilt screens go first: sign-in, My day, Partners list,
Finance, the partner's Finance tab, Tasks.

**The 2 not-provable findings**

| Fix group | What it is | Fixes | Findings (* = held leg) | First-round sessions to re-press |
|---|---|---|---|---|
| FIX-28 | "Try again" is untriggerable or absent — VERIFY-ONLY, STANDALONE | 1 | F039 | B2s1 |
| §3 (no product fix) | No product fix — confirm the recorded state only | 1 | F040 | B2s1 |
## 5 · Carried from the 10 Nov plan, unchanged unless said

* **Gate:** the CI run on `f158ee8` must be fully green before Batch 0; the parent confirms and cites the run. A
  test-only landing does not stop the round; a product landing does (per-batch head check).
* **Tripwire, restated for this head:** stop if a theme other than Light, Dark, Direct, Turquoise or System appears,
  or a landing after Landing 46 changes a screen.
* **Batch 0:** baselines per list, the F2–F5 Finance totals before any press, notification-switch counts read live,
  the manager chain, and first-open confirmation of the 56 new cells' controls. Proof achievements ACH-2026-0029, 0038,
  0040 and 0043 are never removed.
* **Calendar cells:** N7 and T5 need a Wednesday press and the Thursday 11:00–11:59 Riyadh window; outside it they
  are recorded not provable, never passed.
* **Phase 7 cells F1, J7, F6** stay reserved for the Phase 7 follow-up round and are not in this M. F7–F11 are new
  numbers and do not reuse them.
* **Sequential browser tasks, 60-second timeout, back on Admin at the end of every batch, findings in the frozen
  plan's §7 shape, cut order as the frozen plan §6.1.**

## 6 · Open points for the parent — this plan does not decide them

1. **Seed names.** The frozen plan bans "TEST" in new seeded rows and seeds through the browser only. The Landing 42
   script (`v2/scripts/fixtures/enrich-test-data.mjs`) names every record "TEST · " and writes through the app's own
   doors by script. Which rule governs Batch 0 of this round?
2. **TEST Commercial and import.** Importing is now a per-person extra (Landing 40), held by a Head by default. The
   frozen R20 import cells are pressed by AD and CO; if TEST Commercial holds no extra, the CO import cell records
   "section not offered" as the right result. Confirm, or set the extra for the round and restore it after.
3. **The 12 Nov round's own findings** — see §7, the fourth-batch option. Rocky rules; this plan does not.
4. **Amendment 3 report, D6:** A3, N4, K3, K8, J3, R7, N1 are the manager-dependent cells behind "may end 1,150 of
   1,157". They were never struck; the struck seven are named in §1.
5. **Per-member settings — the approved design and the build differ in two places.** The design of 22 Nov says
   "Edit someone else's work" and "Change credit limits" are Admin + Head by default. Landing 40 built "Edit someone
   else's work" as an extra no role holds by default, where View only takes nothing away; and the company-wide
   credit limit is changed by a Manager, a Head or an Admin (Landing 31, decision 4). A13–A15 test what is built;
   say if the design's wording should be the expected result instead.
6. **"Across the six roles."** The 15 Nov brief asks for the task features to be tested as all six roles. This plan
   keeps the frozen plan's rule (Manager and Member act; Head and Commercial are checked by the mirror-breaker
   cells). Pressing the 10 task-feature controls as all six roles would add 20 cells.

## 7 · Fourth-batch option — the 12 Nov round's own findings (prepared, NOT decided)

Source: `followup-glitch-list.md` (round at head `c41bc5d`, 928 of 1,150 pressed). If Rocky rules them in, they run
as **F4** after F1 and F2; M does not change, because each is re-tested on a cell M already holds.

| 12 Nov batch | Blocks work | Wrong data | Cosmetic | Findings |
|---|---|---|---|---|
| Batch 1 — task record, new task, shell | 1 | 6 | 3 | 10 |
| Batch 2 — My day, notes, achievements | 0 | 1 | 2 | 3 |
| Batch 3 — partners, files, codes | 4 | 3 | 1 | 8 |
| Batch 4 — Finance, reports, activity | 4 | 1 | 0 | 5 |
| Batch 5 — settings, people, sign-in | 7 | 4 | 2 | 13 |
| Batch 6 — N7 Thursday bell | 1 | 0 | 0 | 1 |
| Batch 6 — sweep, journeys, mirror | 1 | 2 | 0 | 3 |
| **F4 if ruled in** | **18** | **17** | **8** | **43** |

Also in that file, outside the 43:
* 2 observations (Settings-log raw keys; a person's name read twice) — not counted there, not counted here.
* 4 findings from the live checks after Landings 14 and 15: F-L14V-01 (cosmetic, the Not-found page names the wrong
  address — left for a later landing) and F-L15V-01/02/03 (codes in search, Files sort by name, `/activity` not
  drawing), which `round-status.md` records as closed live on 12 Nov.

What the ruling changes:

| | Without F4 | With F4 (43) | With F4 + the 4 live-check findings |
|---|---|---|---|
| M | 1,206 | 1,206 | 1,206 |
| Findings re-tested | 248 | 291 | 295 |
| Blocks-work findings re-tested | 77 | 95 | 98 |

Several of the 43 were worked on in Landings 14, 15 and 20 (the bell's count and link, "Need help" wording, Activity
row links, the import preview, codes in search, Files sort, people search). This plan does not mark any of them
closed: a finding closes only when its cell passes at `f158ee8`.
