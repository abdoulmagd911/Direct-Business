-- PRJ-01 — projects (§3.7; V401, V466). Client work names its organisation, internal work none; the latest health
-- update is the project's chip, with its one line; a project closes with its status; only its owner or Full changes it,
-- and a project with live tasks is not removed. Every value is made up.
-- Sabotage: supabase/tests/sabotage/the-oldest-health-shows.sql.
insert into core.team (department_id, code, name_en, name_ar)
values (test.department('commercial'), 'test_desk', 'Test Desk', 'فريق الاختبار');
select set_config('t.head', test.person('Test Head', 'head')::text, true);
select set_config('t.pm', test.person('Test Project Owner', 'member')::text, true);
select set_config('t.am2', test.person('Test Second Member', 'member')::text, true);
update core.person set team_id = (select id from core.team where code = 'test_desk')
where id in (current_setting('t.head')::uuid, current_setting('t.pm')::uuid, current_setting('t.am2')::uuid);

select test.as_person(current_setting('t.pm')::uuid);
select test.raises(format('select api.project_save(null, %L::jsonb)', jsonb_build_object('name', 'Made up')), 'P0001',
  'client work names its organisation', 'project.client_needs_partner');
select set_config('t.prj', api.project_save(null, jsonb_build_object('name', 'Made-up internal tooling',
  'work_type', 'internal')) ->> 'id', true);
select test.ok(api.project(current_setting('t.prj')::uuid) ->> 'number' ~ '^PRJ-[0-9]{4}-[0-9]{3}$',
  'numbered PRJ-year-number');
select test.eq(api.project(current_setting('t.prj')::uuid) ->> 'category', 'active', 'active from the start');

select api.project_health_set(current_setting('t.prj')::uuid, 'at_risk', 'Made-up: the vendor is late',
                              core.riyadh_today() - 3);
select api.project_health_set(current_setting('t.prj')::uuid, 'on_track', 'Made-up: back on plan');
select test.eq(api.project(current_setting('t.prj')::uuid) -> 'health' ->> 'health', 'on_track',
  'the latest update is the chip');
select test.eq(api.project(current_setting('t.prj')::uuid) -> 'health' ->> 'line', 'Made-up: back on plan',
  'with its one line');
select test.eq(jsonb_array_length(api.project(current_setting('t.prj')::uuid) -> 'health_history'), 2, 'history kept');
select test.raises(format('select api.project_health_set(%L, %L, %L)', current_setting('t.prj'), 'fine', 'Made up'),
  'P0001', 'three healths only', 'project.health_invalid');

select test.as_person(current_setting('t.am2')::uuid);
select test.raises(format('select api.project_health_set(%L, %L, %L)', current_setting('t.prj'), 'off_track', 'Made up'),
  '42501', 'only its owner or Full updates it', 'access.needs_level');
select test.as_person(current_setting('t.head')::uuid);
select test.runs(format('select api.project_save(%L, %L::jsonb, %s)', current_setting('t.prj'),
  jsonb_build_object('status', 'done'), api.project(current_setting('t.prj')::uuid) ->> 'version'),
  'the head closes it');
select test.ok(api.project(current_setting('t.prj')::uuid) ->> 'closed_at' is not null, 'closed with its status');
select test.eq((api.projects('{"categories": ["done"]}'::jsonb) ->> 'total')::int, 1, 'and listed as done');
select test.runs(format('select api.projects_remove(array[%L]::uuid[])', current_setting('t.prj')),
  'a project without tasks is removed');
