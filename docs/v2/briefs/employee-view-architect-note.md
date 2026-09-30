# Note for the Architect · two decisions to record, one to take
From the Design lead, 30 Sep 2026, 08:20 Riyadh, relayed by the oversight. Rulings of 30 Sep 07:48 under the owner's
delegation. Please record them in `docs/v2/DECISIONS.md` in the V500–V599 range (next free numbers).

## 1 · The employee view (ruling)
The menu shows **work** pages (My day, Tasks, Clients, Pipeline) at any level above none, and **manage** pages (Overview,
Projects, Finance, KPIs, Reports, Appraisal, Activity, Settings) only to Manager, Head and Admin; a Viewer gets KPIs and
Reports. Out of the menu is not locked: URLs, search and links keep working at the person's level. Pipeline: the
Business Development and Business Solutions teams, managers, heads and admins; nobody else. Suppliers is the second
tab of Clients. Reports leaves the member menu. Members reach KPIs and Finance by search and links until My day
carries their invoices and pace card. Build: Builder B, `docs/v2/briefs/employee-view.md`. Its cut 8 renames labels fixed earlier, so it supersedes in part the
page names of V98, V146, V207, V209 and V210 (Suppliers & partners → Suppliers; Organization & access → People & access;
Clients and Suppliers & partners → Organisations; Plan & performance → Targets; Head of department · Team member →
Head · Member). The Create item "Partner" becomes Client / Supplier; V52's "never Company" is unchanged.

## 2 · The simplicity gate (record as a standing rule)
No feature is built without a one-card entry, signed by the oversight under the owner's delegation, answering:
1. Which screen and which spot — one place; a new menu item names the item it removes or folds.
2. Which role, used weekly — the role and the person who asked.
3. What it replaces.
4. Default state — on for that role only if used weekly; otherwise off, under More or in Settings. Nothing new is on
   for Members by default.
5. Phone — passes the 3-job test (below), or is marked desktop-only.
6. Words — label of at most two plain words, a one-sentence empty state, no new term.
The oversight keeps the cards; a PR names its card in its description or is not merged.

## 3 · The 3-job phone test (record as a go-live gate per module)
Three real employees, their own phones (390 wide), no help, timed, each job starting from My day:
| Job | Pass |
|---|---|
| Log what happened with a client today, with the next step | ≤ 4 taps to the client, ≤ 60 s to save |
| See what is due today and tick one off | ≤ 20 s, no sideways scroll |
| Find a client and call their contact | search → client → phone link, ≤ 30 s |
All three people, all three jobs, no question asked, nothing cut off. A miss keeps the module "Being built" for that
role. Manager modules: issue a report, read a KPI's pace, see the team's week — same marks. Builder B also scripts the
three as an e2e smoke (brief, test 16); the smoke never replaces the people.

## 4 · A decision for you (V600 range): Pipeline by team
Access today is role levels with per-person changes (`core.role_page_level`, `core.person_page_level`); there is no
team layer. Until there is, the admin sets Pipeline Own on each person in the two teams, with a reason, and must
remember it for every new joiner. Choose one:
- **a.** A team layer: `core.team_page_level`, applied between role and person (person still wins). One row per team;
  new joiners inherit it. Builder A: a migration, the resolver, the Access tab gains a Teams column. Recommended.
- **b.** Keep person changes, and flag in Settings › People any BD/BS member without Pipeline.
Also for you: whether the work/manage tier belongs on the role (a role column, so a custom role picks its menu)
rather than the fixed role keys the brief uses.
