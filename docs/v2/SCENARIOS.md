# v2 — the scenario catalogue

Two files, both from the oversight's private artifact of 29 Sep 2026 (made-up people and organisations only — the
rule-7 scan found one made-up address of the V101 shape and nothing real):

- **`SCENARIOS.csv`** — 440 rows, every role by every page or flow: `ACC-*` access and sign-in, `WRK-*` work (organisations,
  tasks, pipeline, finance), `PRF-*` performance (KPIs, achievements, reports, appraisal).
- **`SCENARIOS-OLD.csv`** — the Scout's comparison with the old app: `OLD-001` to `OLD-060` (what the old app did that the
  catalogue misses or gets wrong) and `OLD-ACC/WRK/PRF-*` (the old app's or the calls' answer to an open-question row).

## The columns

| Column | Meaning |
|---|---|
| `ID` | the row's name; a builder cites it in a test name and a PR |
| `Area`, `Page or flow`, `Role` | where the scenario happens and as whom (`Admin account`, `Test account`, `Admin using View as` and `Switched-off / left person` are roles of their own — V444, V445, V442, V452) |
| `Scenario (given / when)` | the situation, with made-up names |
| `Expected result (then)` | what must happen, in the words a test asserts |
| `Rule (V# or spec §)` | the decision or spec section that says so; an old-app row cites the old file that did it |
| `Admin setting or manual edit` | whether the behaviour is a hard rule or an admin setting (and which) |
| `Test today` | the test that proves it now — its id, or `none` |
| `Status` | see below |
| `Fix needed` | what closes the gap: a test to add, a rule to build, or a question for the owner |

## Status, and how a row moves

| Status | Meaning | It moves when |
|---|---|---|
| `Covered` | enforced **and** tested — `Test today` names the test | — |
| `Partly` | enforced, or tested, not both | the builder adds the missing half and writes the test id into `Test today` |
| `Gap` | built, but the rule is not enforced or not tested | the fix in `Fix needed` lands with its test |
| `Unbuilt` | its step has not landed yet | the step's PR lands; the builder marks each of the step's rows `Covered` with the test id, or `Gap` with the reason |
| `Open question` | the rule is not decided | the oversight or the owner rules; the V-number goes into `Rule` and the row becomes one of the above |
| `Wrong` (OLD file) | the catalogue expected less than the old app did | a ruling (V462 onward) and the catalogue row updated |
| `Missed` (OLD file) | the old app did something the catalogue has no row for | the item sits in `BUILD-PLAN.md` against its step; a row is added when it lands |
| `Decide` (OLD file) | the owner's call | a question in `OPEN-QUESTIONS.md` |

**The rule:** every scenario ends **Covered** — enforced in the database or the screen, and proved by a test whose id
is in `Test today` — or it is **ruled** out with a V-number. A builder's PR that touches a row's area updates the row in
the same PR; the oversight re-checks the catalogue every round (V402). The files are the oversight's: the architect
only records the rulings and the placements; builders and the QA session change `Test today` and `Status`.

## What the OLD file settled on 29 Sep

- **Rulings** (recommended; each applies unless the owner says no): V462 (OLD-001), V463 (OLD-004/005, OLD-ACC-008/101/102,
  OLD-WRK-053/093), V464 (OLD-013, OLD-WRK-049), V465 (OLD-015, OLD-WRK-092, OLD-PRF-049), V466 (OLD-016/017,
  OLD-WRK-024), V467 (OLD-019/020), V468 (OLD-023, OLD-WRK-010), V469 (OLD-024, OLD-WRK-112), V470 (OLD-003/009/010/011).
- **Questions for the owner** (`OPEN-QUESTIONS.md`): Q37 manager-only notes (OLD-022), Q38 a record owner's Undo on money
  (OLD-038), Q39 a contact's sides (OLD-WRK-106), Q40 which side an MoU sets (OLD-PRF-030), Q41 the KPI sheet's status
  column (OLD-PRF-135).
- **Missed rows** placed in `BUILD-PLAN.md` by step, each cited as `OLD-0nn` in its row.
- **Answered open-question rows** folded into the decisions and the spec where they add a rule (the V-number or the
  spec section is cited on the row's subject: check-in day 1–28, only Active and Prospect go stale, overdue = not Done and
  not Cancelled, Blocked not exempt from stale, one example per quarter, a loss never above its exposure, the KPI head
  as fallback lead, an issued report only superseded, restricted kinds never downgraded, credit approved by someone other
  than the caller, bulk assign tells the new owner once, failed alert kinds shown to admins).
- **Five answers that contradict a ruling of 16:01 — the ruling is kept, the conflict is with the oversight:** OLD-WRK-003
  (viewers write no notes; V454 lets them keep their own), OLD-WRK-015 (day-level reminders; V455 fires at the minute),
  OLD-WRK-072 (no "Handed to Product" stage; V457 adds one), OLD-PRF-071 (money not masked in issued reports; V458 masks
  it), OLD-PRF-105 (Exclude by a manager with Full on Finance too; V458 says admins only).
