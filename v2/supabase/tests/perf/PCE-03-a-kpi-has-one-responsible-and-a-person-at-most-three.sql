-- PCE-03 — Responsible (Landing 54, V405): a KPI — a plan's category — has one Responsible, set by someone with
-- Full on KPIs in a department they see; the KPI pace read names them. A person is Responsible for at most three
-- KPIs in a plan year: the fourth is refused at the door and at the table itself; taking one away frees a place;
-- another year counts apart. Every value is made up.
-- Sabotage: supabase/tests/sabotage/a-person-is-responsible-for-a-fourth-kpi.sql,
-- a-member-sets-the-responsible.sql.
select set_config('v2.test_now', '2026-11-25 09:00:00+03', true);
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.mgr', test.person('Test Manager', 'manager')::text, true);
select set_config('t.member', test.person('Test Member', 'member')::text, true);
select set_config('t.second', test.person('Test Second Member', 'member')::text, true);
select set_config('t.other', test.person('Test Other Manager', 'manager', 'test_elsewhere')::text, true);
select test.as_person(current_setting('t.admin')::uuid);
select set_config('t.p26', api.plan_open(test.department('commercial'), 2026) ->> 'id', true);
select set_config('t.p25', api.plan_open(test.department('commercial'), 2025) ->> 'id', true);
create temp table c on commit drop as
select row_number() over (order by x ->> 'code') as n, (x ->> 'id')::uuid as id, x ->> 'code' as code
from jsonb_array_elements(api.achievement_categories(current_setting('t.p26')::uuid)) x;
select api.target_save(null, current_setting('t.p26')::uuid,
  jsonb_build_object('category', (select id from c where n = 1), 'month', '2026-11-01', 'target_count', 2));

-- who sets it
select test.as_person(current_setting('t.member')::uuid);
select test.raises(format('select api.kpi_responsible_set(%L, %L, %L)', current_setting('t.p26'),
  (select id from c where n = 1), current_setting('t.member')), '42501',
  'a member does not set the Responsible', 'access.needs_level');
select test.as_person(current_setting('t.other')::uuid);
select test.raises(format('select api.kpi_responsible_set(%L, %L, %L)', current_setting('t.p26'),
  (select id from c where n = 1), current_setting('t.member')), 'P0002',
  'nor does a manager of another department', 'common.not_found');
select test.as_person(current_setting('t.mgr')::uuid);
select test.raises(format('select api.kpi_responsible_set(%L, %L, %L)', current_setting('t.p26'),
  (select id from c where n = 1), gen_random_uuid()), 'P0001',
  'the Responsible is a person of the workspace', 'kpi.responsible_invalid');
select test.raises(format('select api.kpi_responsible_set(%L, %L, %L)', current_setting('t.p25'),
  (select id from c where n = 1), current_setting('t.member')), 'P0001',
  'a category of another plan is refused', 'target.category_invalid');
select test.runs(format('select api.kpi_responsible_set(%L, %L, %L)', current_setting('t.p26'),
  (select id from c where n = 1), current_setting('t.member')), 'a manager with Full on KPIs sets the Responsible');
select test.eq(api.kpi_pace() -> 'rows' -> 0 -> 'responsible' ->> 'id', current_setting('t.member'),
  'and the KPI pace read names them');
select test.eq(api.kpi_pace() -> 'rows' -> 0 -> 'responsible' ->> 'full_name_en', 'Test Member', 'by name');

-- one Responsible per KPI: a second person takes the first one's place
select test.runs(format('select api.kpi_responsible_set(%L, %L, %L)', current_setting('t.p26'),
  (select id from c where n = 1), current_setting('t.second')), 'another person is set on the same KPI');
select test.eq(api.kpi_pace() -> 'rows' -> 0 -> 'responsible' ->> 'id', current_setting('t.second'), 'the new one');
select test.as_owner();
select test.eq((select count(*)::int from perf.kpi_responsible r where r.category_id = (select id from c where n = 1)
                and r.deleted_at is null), 1, 'the KPI still has one Responsible');
select test.eq((select count(*)::int from perf.kpi_responsible r where r.category_id = (select id from c where n = 1)
                and r.deleted_at is not null), 1, 'and the one before is kept in the record, taken off');
select test.as_person(current_setting('t.mgr')::uuid);

-- at most three KPIs per person in a plan year
select api.kpi_responsible_set(current_setting('t.p26')::uuid, (select id from c where n = 1), current_setting('t.member')::uuid);
select api.kpi_responsible_set(current_setting('t.p26')::uuid, (select id from c where n = 2), current_setting('t.member')::uuid);
select test.runs(format('select api.kpi_responsible_set(%L, %L, %L)', current_setting('t.p26'),
  (select id from c where n = 3), current_setting('t.member')), 'a third KPI is allowed');
select test.eq(perf.kpi_responsible_max(), 3, 'three is the most');
select test.raises(format('select api.kpi_responsible_set(%L, %L, %L)', current_setting('t.p26'),
  (select id from c where n = 4), current_setting('t.member')), 'P0001',
  'a fourth KPI for the same person is refused', 'kpi.responsible_limit');
select test.as_owner();
select test.eq((select count(*)::int from perf.kpi_responsible r where r.person_id = current_setting('t.member')::uuid
                and r.deleted_at is null), 3, 'and the person still holds three');
select test.as_person(current_setting('t.mgr')::uuid);
select test.runs(format('select api.kpi_responsible_set(%L, %L, %L)', current_setting('t.p26'),
  (select id from c where n = 4), current_setting('t.second')), 'the fourth KPI goes to someone else');
select test.runs(format('select api.kpi_responsible_set(%L, %L, %L)', current_setting('t.p25'),
  (select x ->> 'id' from jsonb_array_elements(api.achievement_categories(current_setting('t.p25')::uuid)) x limit 1),
  current_setting('t.member')), 'another year counts apart');
select test.runs(format('select api.kpi_responsible_set(%L, %L, null)', current_setting('t.p26'),
  (select id from c where n = 3)), 'the Responsible is cleared from one KPI');
select test.runs(format('select api.kpi_responsible_set(%L, %L, %L)', current_setting('t.p26'),
  (select id from c where n = 5), current_setting('t.member')), 'which frees a place for another');

-- the rule is the table's own: no other way in passes it
select test.as_owner();
select test.raises(format('insert into perf.kpi_responsible (plan_id, category_id, person_id, created_by) values (%L, %L, %L, %L)',
  current_setting('t.p26'), (select id from c where n = 6), current_setting('t.member'), current_setting('t.admin')),
  'P0001', 'a fourth row written straight into the table is refused too', 'kpi.responsible_limit');
