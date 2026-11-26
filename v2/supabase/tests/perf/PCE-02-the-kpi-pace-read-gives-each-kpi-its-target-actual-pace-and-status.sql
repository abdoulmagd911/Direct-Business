-- PCE-02 — the KPI pace read (Landing 54): the month's KPIs are the plan's targets of that month, each with its
-- target, its actual to date (the live dated achievements of the month — drafts and other months never count), its
-- pace by the working days passed and its status; a target that names a deal value is a second KPI; the three
-- counts add up the statuses; the day-by-day figures and the month's days draw the curve; the initiatives are the
-- projects the month's achievements belong to. A person reads the plans of the departments they see, and nobody
-- without a level on KPIs reads any. Every value is made up.
-- Sabotage: supabase/tests/sabotage/kpi-pace-shows-every-department.sql.
select set_config('v2.test_now', '2026-11-25 09:00:00+03', true);
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.mgr', test.person('Test Manager', 'manager')::text, true);
select set_config('t.member', test.person('Test Member', 'member')::text, true);
select set_config('t.viewer', test.person('Test Viewer', 'viewer')::text, true);
select set_config('t.other', test.person('Test Other Manager', 'manager', 'test_elsewhere')::text, true);
select set_config('t.nobody', test.person('Test No Level', null)::text, true);
insert into core.team (department_id, code, name_en, name_ar)
values (test.department('commercial'), 'test_pace', 'Test Pace Desk', 'فريق الوتيرة');
update core.person set team_id = (select id from core.team where code = 'test_pace')
where id = current_setting('t.mgr')::uuid;
select test.as_person(current_setting('t.admin')::uuid);
select set_config('t.p26', api.plan_open(test.department('commercial'), 2026) ->> 'id', true);
select set_config('t.problem', (select x ->> 'id' from jsonb_array_elements(
  api.achievement_categories(current_setting('t.p26')::uuid)) x where x ->> 'code' = 'PROBLEM'), true);
select set_config('t.contract', (select x ->> 'id' from jsonb_array_elements(
  api.achievement_categories(current_setting('t.p26')::uuid)) x where x ->> 'code' = 'CONTRACT'), true);

select test.eq(api.kpi_pace() -> 'rows', '[]'::jsonb, 'a month with no target has no KPI');
select test.eq(api.kpi_pace() ->> 'month', '2026-11-01', 'the month is the current Riyadh month when none is named');
select test.eq((api.kpi_pace() ->> 'working_days')::int, 22, 'with its working days');
select test.eq((api.kpi_pace() ->> 'days_passed')::int, 19, 'and the ones passed, today counted');
select test.eq(api.kpi_pace() -> 'years', '[2024, 2025, 2026]'::jsonb, 'the years offered are this one and the two before');

select api.target_save(null, current_setting('t.p26')::uuid,
  jsonb_build_object('category', current_setting('t.problem'), 'month', '2026-11-01', 'target_count', 2));
select api.target_save(null, current_setting('t.p26')::uuid,
  jsonb_build_object('category', current_setting('t.contract'), 'month', '2026-11-01', 'target_count', 3,
                     'target_value', 10000));
select api.target_save(null, current_setting('t.p26')::uuid,
  jsonb_build_object('category', current_setting('t.problem'), 'month', '2026-10-01', 'target_count', 4));
select api.target_save(null, current_setting('t.p26')::uuid,
  jsonb_build_object('category', current_setting('t.problem'), 'month', '2026-12-01', 'target_count', 5));

select test.as_person(current_setting('t.mgr')::uuid);
select set_config('t.prj', api.project_save(null, jsonb_build_object('name', 'Made-up campaign',
  'work_type', 'internal')) ->> 'id', true);
select set_config('t.task', api.task_create(jsonb_build_object('title', 'Made-up campaign task', 'work_type', 'internal',
  'project_id', current_setting('t.prj'))) ->> 'id', true);
select api.achievement_log(jsonb_build_object('category', 'PROBLEM', 'title', 'Made-up fix one',
  'happened_on', '2026-11-10', 'source_task_id', current_setting('t.task')));
select api.achievement_log('{"category": "PROBLEM", "title": "Made-up fix two", "happened_on": "2026-11-15"}');
select api.achievement_log('{"category": "PROBLEM", "title": "Made-up fix in October", "happened_on": "2026-10-02"}');
select api.achievement_log('{"category": "PROBLEM", "title": "Made-up fix with no day yet"}');
select api.achievement_log('{"category": "CONTRACT", "title": "Made-up contract one", "happened_on": "2026-11-05",
  "deal_value": 3000}');
select api.achievement_log('{"category": "CONTRACT", "title": "Made-up contract two", "happened_on": "2026-11-18",
  "deal_value": 2000}');

create temp table r on commit drop as
select x.* from jsonb_array_elements(api.kpi_pace() -> 'rows') with ordinality x(row, n);
select test.eq((select count(*)::int from r), 3, 'three KPIs: one by count, and the contract target by count and by deal value');
select test.eq((select row ->> 'actual' from r where row ->> 'code' = 'PROBLEM'), '2',
  'the actual is the month''s dated achievements — October''s and the dateless draft do not count');
select test.eq((select (row ->> 'pace')::int from r where row ->> 'code' = 'PROBLEM'), 116, '2 of the 1.73 due is 116%');
select test.eq((select row ->> 'status' from r where row ->> 'code' = 'PROBLEM'), 'on_track', 'which is On track');
select test.eq((select (row ->> 'pace')::int from r where row ->> 'code' = 'CONTRACT' and row ->> 'measure' = 'count'), 77,
  '2 of the 2.59 due is 77%');
select test.eq((select row ->> 'status' from r where row ->> 'code' = 'CONTRACT' and row ->> 'measure' = 'count'),
  'at_risk', 'which is At risk');
select test.eq((select row ->> 'actual' from r where row ->> 'measure' = 'value'), '5000.00', 'the deal values are summed');
select test.eq((select row ->> 'target' from r where row ->> 'measure' = 'value'), '10000.00', 'against the value target');
select test.eq((select (row ->> 'pace')::int from r where row ->> 'measure' = 'value'), 58, '5,000 of the 8,636 due is 58%');
select test.eq((select row ->> 'status' from r where row ->> 'measure' = 'value'), 'behind', 'which is Behind');
select test.eq(api.kpi_pace() -> 'counts', '{"on_track": 1, "at_risk": 1, "behind": 1}'::jsonb, 'the counts add up the statuses');
select test.eq((select row -> 'daily' from r where row ->> 'code' = 'PROBLEM'),
  '[{"day": "2026-11-10", "value": 1}, {"day": "2026-11-15", "value": 1}]'::jsonb, 'the day-by-day figures for the curve');
select test.eq((select row -> 'initiatives' from r where row ->> 'code' = 'PROBLEM'),
  jsonb_build_array(jsonb_build_object('id', current_setting('t.prj'), 'name', 'Made-up campaign', 'count', 1)),
  'the initiative is the project the achievement belongs to, with how many');
select test.eq((select row -> 'initiatives' from r where row ->> 'measure' = 'value'), '[]'::jsonb,
  'a KPI with no project behind it has no initiative');
select test.eq((select row -> 'responsible' from r where row ->> 'code' = 'PROBLEM'), 'null'::jsonb,
  'nobody is Responsible until someone is set');
select test.eq(jsonb_array_length(api.kpi_pace() -> 'days'), 30, 'the month''s days');
select test.eq((select (d ->> 'share')::numeric from jsonb_array_elements(api.kpi_pace() -> 'days') d
                where d ->> 'day' = '2026-11-25'), 0.8636, 'each with the share of a target due by it');
select test.eq((select (d ->> 'working')::boolean from jsonb_array_elements(api.kpi_pace() -> 'days') d
                where d ->> 'day' = '2026-11-06'), false, 'and whether it is a working day');
select test.eq((api.kpi_pace() ->> 'can_edit')::boolean, false, 'a manager is not shown the way to edit targets');

-- a finished month is judged on its whole target; a month not begun is Not started
select test.eq((api.kpi_pace(date '2026-10-01') -> 'rows' -> 0 ->> 'pace')::int, 25, 'October: 1 of 4 is 25%');
select test.eq(api.kpi_pace(date '2026-10-15') ->> 'month', '2026-10-01', 'any day of a month names the month');
select test.eq(api.kpi_pace(date '2026-12-01') -> 'rows' -> 0 ->> 'status', 'not_started', 'December has not started');
select test.eq(api.kpi_pace(date '2026-12-01') -> 'rows' -> 0 -> 'pace', 'null'::jsonb, 'and has no pace yet');

-- who reads
select test.as_person(current_setting('t.member')::uuid);
select test.eq(jsonb_array_length(api.kpi_pace() -> 'rows'), 3, 'a member reads their department''s KPIs');
select test.as_person(current_setting('t.viewer')::uuid);
select test.eq(jsonb_array_length(api.kpi_pace() -> 'rows'), 3, 'a viewer reads them');
select test.as_person(current_setting('t.other')::uuid);
select test.eq(jsonb_array_length(api.kpi_pace() -> 'rows'), 0, 'a manager of another department reads none of them');
select test.as_person(current_setting('t.admin')::uuid);
select test.eq(jsonb_array_length(api.kpi_pace() -> 'rows'), 3, 'an admin reads them');
select test.eq((api.kpi_pace() ->> 'can_edit')::boolean, true, 'and is shown the way to edit targets');
select test.as_person(current_setting('t.nobody')::uuid);
select test.raises('select api.kpi_pace()', '42501', 'a person with no level on KPIs reads nothing', 'access.needs_level');
