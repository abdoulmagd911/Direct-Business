# Build brief · Builder B (screens lane) · The employee view
From the Design lead, 30 Sep 2026, 08:20 Riyadh. The Architect's note: `employee-view-architect-note.md` beside this file. Approved by the oversight 07:48 under the owner's delegation
("what the employee sees and how to use it is on you"). Base: v2/main 8972ea8. One PR, branch `v2/b-employee-view`.
Screens only: no schema, no RPC, no new pages. The access changes it relies on are listed under "Before merge"
and are made by an admin in Settings, not in code.

## A · The menu rule (replaces "every page the person can see")
Every main page gets one registry field, `nav.tier`: **`work`** or **`manage`**.
- **work** — My day, Tasks, Clients, Pipeline. In the menu when the person's level on the page is not `none`.
- **manage** — Overview, Projects, Finance, KPIs, Reports, Appraisal, Activity, Settings. In the menu when the person's
  role is Manager, Head or Admin (role keys `manager`, `head`, `admin`) and the level is not `none`. A Viewer gets
  KPIs and Reports only (`nav.viewer: true` on those two).
- A page that is out of the menu is **not** locked. Its URL, search (Ctrl K) and every link to it keep working at the
  person's level (ruling 6: members reach KPIs and Finance by search and links; their own report from My day).
- Order: My day, Tasks, Clients, Pipeline, then Overview, Projects, Finance, KPIs, Reports, Appraisal, Activity;
  Settings at the foot (admins).
- `navFor(me)` in `ui/shell/nav.ts` is the only place the rule lives; the drawer, the phone bar and More all read it.

## B · The menus per role (what the tests below expect with the default access)
| Role | Desktop drawer | Phone bar (4 + More) | More sheet |
|---|---|---|---|
| Member | My day · Tasks · Clients | My day · Tasks · Clients · More | My profile · Sign out |
| Member in Business Development or Business Solutions | My day · Tasks · Clients · Pipeline | My day · Tasks · Clients · Pipeline · More | My profile · Sign out |
| Manager | My day · Tasks · Clients · Pipeline · Projects · Finance · KPIs · Reports · Appraisal | My day · Tasks · Clients · Pipeline · More | Projects · Finance · KPIs · Reports · Appraisal · My profile · Sign out |
| Head | Manager's + Overview · Activity | as Manager | Overview · Projects · Finance · KPIs · Reports · Appraisal · Activity · My profile · Sign out |
| Admin | Head's + Settings (foot) | as Manager | Head's + Settings |
| Viewer | My day · Clients · KPIs · Reports | My day · Clients · KPIs · Reports (no More) | — (profile from the avatar) |
Phone bar: the first four menu items, then More when anything is left. The floating + sits above the bar for every
role with at least one Create item (none for a Viewer). `PRIMARY` in `BottomBar.tsx` goes; the bar follows the menu.
Appraisal shows in the manager menus as today; hiding it outside an open cycle comes with the appraisal cycle step.

## C · Suppliers is the second tab of Clients (ruling 2)
- The drawer and the phone bar lose "Suppliers & partners". Clients (`/partners?view=clients`) gets one tab row at the
  top: **Clients · Suppliers**, each with its count; Suppliers = `?view=suppliers`. The tab shows only when the person's
  level on `suppliers_partners` is not `none`; with one tab left, no tab row.
- The two pages keep their own access keys (V147 unchanged). The old URL `/partners?view=suppliers` lands on the tab.
- Page title "Clients" on both tabs; the active tab is the only difference. Phone: the tab row is 44 px, full width,
  two equal tabs.

## D · The ten cuts
1. **Menu** — A and B above.
2. **Suppliers tab** — C above.
3. **Create menu** — an item shows only if its page is built (registry `built: true`, set by whoever lands the page)
   and the person may create there: Task at Own or Full; Client, Supplier, Invoice, Achievement at Full.
   "Partner" becomes **Client** (and **Supplier** when the person has Full on suppliers). With one item left the +
   and Create open it directly, no menu. With none, Create and the + are hidden.
4. **Header** — search placeholder "Search" at 390 and "Search clients, tasks, invoices" from 640; the Ctrl K hint
   from 1024 only. (The phone already shows only the + — no change there.)
5. **Profile chip menu** — My profile · Sign out, nothing else. Theme leaves with the one-theme PR (29 Sep spec,
   section 0); Density, Language and Direction move into My profile; Recently deleted stays reachable from Activity.
6. **My profile** — cards: Profile (Display name, photo or colour), Preferences (Language, Density), Notifications,
   Password, Devices. Gone from the screen: Full name and Nickname fields (admins edit names on the person's record),
   Badge, Start page, Drawer, Theme. Notifications: a work-tier person sees five switches — Assigned to me, Added as a
   helper, Mentioned, A decision is needed, My record changed by someone else; manage-tier roles see all sixteen.
   New profiles start with only those five on for work-tier roles.
7. **A person's record** — the ACCESS list in the rail becomes one line, "Access · Member (standard)" or
   "Access · Member + 1 change", with Show all; open by default only for admins.
8. **Labels** (en.json; builder C mirrors ar.json):
   | Today | Becomes |
   |---|---|
   | Organization & access | People & access |
   | Clients and Suppliers & partners | Organisations |
   | Plan & performance | Targets |
   | Suppliers & partners (tab, crumbs, entity chips) | Suppliers |
   | Head of department · Team member | Head · Member |
   | "sunday" and other raw values | their labels ("Sunday") |
   | Search partners, tasks, INV-, DRS- | as in cut 4 |
9. **Empty states and the greeting** — as the Design lead's gallery specs of 29 Sep, sections 12 and 14 (relayed by the oversight): one sentence in the page's words plus
   its one action (none for a Viewer); **Being built.** on an unbuilt page; My day's heading is the date, no greeting.
10. **Settings** — groups renamed as in cut 8; People & access shows three tabs: People · Teams · Access (Roles and
    the org Settings rows move into Access, under a "Roles" and a "Sign-in" section).

## E · Admin steps (Settings › People & access › Access — no code; the oversight does them after this brief's build merges)
| Role · page | Today | Set to | Why |
|---|---|---|---|
| Member · Pipeline | Own | none | ruling 1 |
| each person in Business Development or Business Solutions · Pipeline | — | Own (person change, reason "BD/BS team, ruling 30 Sep") | ruling 1, until team-level access exists |
| Viewer · Tasks | View | none | viewer menu |
| Viewer · Pipeline | View | none | viewer menu |
The module `defaults` in `pipeline/module.ts` and `tasks/module.ts` change to match in this PR, so a fresh stack and
the gallery start the same way. Nothing else in access changes: members keep Own on Finance, KPIs, Projects,
Appraisal and View on Reports — reachable, not in the menu.

## F · Acceptance tests (Playwright, 390 × 844 and 1440 × 900, the gallery personas plus one BD member)
Menu and bar
1. Member at 1440: the drawer has exactly My day, Tasks, Clients. At 390: the bar has My day, Tasks, Clients, More; More
   has My profile and Sign out only.
2. BD member (Pipeline Own by person change): drawer and bar gain Pipeline; More unchanged.
3. Manager at 1440: the nine items of table B in that order; at 390 the bar is My day, Tasks, Clients, Pipeline, More.
4. Head adds Overview and Activity; Admin adds Settings at the foot (1440) and in More (390).
5. Viewer: My day, Clients, KPIs, Reports; no + anywhere; no More.
6. Reach without the menu: as Member, `/kpis`, `/finance` and `/reports` open at the member's level; Ctrl K "INV" finds
   an invoice the member owns and opens it; a client's Finance tab links to its invoice.
7. Sabotage `menu-shows-own-manage-page`: give `projects` tier `work` → test 1 goes red.
Suppliers tab
8. Clients shows the tab row Clients · Suppliers with counts; Suppliers lists supplier-side organisations;
   `/partners?view=suppliers` opens with the Suppliers tab active. A person with Suppliers none sees no tab row.
Create
9. Member: the + (390) and Create (1440) open New task directly, no menu. Manager: the menu lists only built items at
   Full. An item whose page is not built is absent (not greyed). "Partner" appears nowhere.
Header, profile, record
10. 390: search placeholder "Search", no Ctrl K; 1440: "Search clients, tasks, invoices" and Ctrl K.
11. The avatar menu has exactly My profile and Sign out.
12. Member's My profile: 5 cards; 5 notification switches; no Nickname, Badge, Start page, Drawer, Theme. Manager: 16
    switches.
13. A person's record as Manager: one Access line with Show all; as Admin: open.
Words and layout
14. No page title, tab, crumb or menu item contains "Organization", "Suppliers & partners", "Plan & performance",
    "Head of department" or "Team member" (en).
15. At 390, on every page reachable from the member's menu: no horizontal scroll (`scrollWidth ≤ 390`), nothing
    clipped, every tap target ≥ 44 px, the + never covers the last row (88 px bottom padding).
16. The 3-job phone test (Architect note) is scripted as a smoke: My day → a client → Log activity with a next step;
    My day → tick today's task; search → client → the contact's phone link (`tel:`). Each completes within the tap
    counts of the test.
Gallery
17. `gallery.spec.ts` adds the BD member persona and re-shoots every role; the gallery page shows the new menus.

## G · Out of scope here
The one-theme change (its own PR; gallery specs of 29 Sep, section 0) · the Settings sections' contents · team-level access
(Architect) · the appraisal-cycle condition · My day's invoice and pace cards (when those land, the member keeps
reaching KPIs and Finance through them).
