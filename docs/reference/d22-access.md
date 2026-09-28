# D22 — access follows the page level, not the role (detail)

Owner, 28 Sep 2026, via the oversight. The short rule is in `docs/DECISIONS.md` → D22.

**The rule.** What a person may see and change is decided only by their level on each page in Team & Access
(None / View / Own / Full), on screen and in the database alike: None hides the page and the tables it owns, View reads,
Full changes. Admins are always Full and cannot be limited (`page_level()` answers 'full' for an admin). Levels are set
by hand in the browser (D17), never in code.

**What the role still decides — managing people** (the owner's one exception):
- Team & Access itself, the access editor, role pickers, reset links, People & teams;
- reassigning a colleague's task, crediting or moving an achievement to someone else, seeing everyone's tasks
  (`can_assign_to`, `can_manage_task`, `can_edit_entry`, `can_see_task`, `can_see_project`, `tasks_insert`,
  `projects_*`);
- setting a person's or department's KPI target (`kpi_targets_write`).
Every team member is on Full for Tasks today; without this exception each could move the others' work.

**Choices made while building it (for the oversight):**
- IBAN and agreement files need Full on **Finance** (they are money documents); before, a manager role was needed.
- Company merges need Full on Leads or Clients; Finance Rules and item names need Full on Finance.
- Lists several pages show (company names, task statuses, periods…) stay readable by everyone signed in.
- Until a person's levels have loaded, the screen opens only Today (fail closed); after 20 s it says so with a Reload
  button.

**Where it lives.** Database: `scripts/sql/d22-access-follows-page-level.sql` (+ `.rollback.sql`). Screens: js/02,
js/09, js/10, js/14, js/15, js/16, js/45, js/49, js/52, js/57, js/63, js/66–71, js/88, js/107, js/113, js/115, js/117,
js/119, core-06. Guards: `scripts/qa/phase3` D22-01…06 and `scripts/qa/probe-d22-access-follows-page-level.mjs`
(five roles × None/View/Full).
