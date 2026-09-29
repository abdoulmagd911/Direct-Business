-- PPL-01 — people (Settings → Organization & access, §8, V132, V97): only an admin adds and changes people — a head
-- is refused both; an admin adds a person with a role, allowed to sign in when asked, in one request, and changes their
-- details naming the version read; a team outside the person's department, a manager loop and a field the door does
-- not know are refused.
-- Sabotage: supabase/tests/sabotage/anyone-changes-people.sql.
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.admin2', test.person('Test Second Admin', 'admin')::text, true);
select set_config('t.head', test.person('Test Head', 'head')::text, true);
select set_config('t.dep', test.department('commercial')::text, true);
select set_config('t.other_dep', test.department('people_other')::text, true);
insert into core.team (department_id, code, name_en, name_ar) values (current_setting('t.other_dep')::uuid, 'far', 'Far Team', 'فريق بعيد');
select set_config('t.far_team', (select id::text from core.team where code = 'far'), true);
select set_config('t.role_member', (select id::text from core.role where key = 'member'), true);
select set_config('t.role_admin', (select id::text from core.role where key = 'admin'), true);
select set_config('t.head_v', (select version::text from core.person where id = current_setting('t.head')::uuid), true);

select test.as_person(current_setting('t.head')::uuid);
select test.raises(format('select api.person_create(%L)', jsonb_build_object('full_name_en', 'Test By A Head',
  'department_id', current_setting('t.dep'))), '42501', 'a head adds nobody', 'access.needs_level');
select test.raises(format('select api.person_update(%L, %L, 1)', current_setting('t.admin2'),
  '{"job_title_en": "Changed by a head"}'), '42501', 'nor changes anyone''s record', 'access.needs_level');

select test.as_person(current_setting('t.admin')::uuid);
select set_config('t.new', api.person_create(jsonb_build_object('full_name_en', 'Test New Person',
  'department_id', current_setting('t.dep'), 'role_id', current_setting('t.role_member'), 'can_sign_in', true,
  'job_title_en', 'Made-up Title'), 'made up: joins')::text, true);
select test.as_owner();
select set_config('t.pid', current_setting('t.new')::jsonb ->> 'id', true);
select test.eq((select r.key from core.person p join core.role r on r.id = p.role_id
                where p.id = current_setting('t.pid')::uuid), 'member', 'an admin adds a person with a role');
select test.eq((select can_sign_in from core.person where id = current_setting('t.pid')::uuid), true,
  'allowed to sign in');
select test.eq((select count(distinct c.request_id)::int from audit.change c
                where c.table_name = 'core.person' and c.row_id = current_setting('t.pid')::uuid), 1,
  'all in one request');

select test.as_person(current_setting('t.admin')::uuid);
select test.raises(format('select api.person_create(%L)', jsonb_build_object('full_name_en', 'Test No Department')),
  'P0001', 'a person needs a department', 'person.department_required');
select test.raises(format('select api.person_create(%L)', jsonb_build_object('full_name_en', 'Test Odd',
  'department_id', current_setting('t.dep'), 'salary', 1)), 'P0001', 'a field the door does not know is refused',
  'person.unknown_field');

select api.person_update(current_setting('t.pid')::uuid, '{"job_title_en": "Senior Made-up Title"}', 1, 'made up');
select test.raises(format('select api.person_update(%L, %L, 1)', current_setting('t.pid'),
  '{"job_title_en": "From a stale screen"}'), '40001', 'a change from a stale screen is refused', 'common.conflict');
select test.raises(format('select api.person_update(%L, %L, 2)', current_setting('t.pid'),
  jsonb_build_object('team_id', current_setting('t.far_team'))), 'P0001',
  'a team outside the person''s department is refused', 'person.team_outside_department');
select api.person_update(current_setting('t.pid')::uuid, jsonb_build_object('manager_id', current_setting('t.head')), 2);
select test.raises(format('select api.person_update(%L, %L, %s)', current_setting('t.head'),
  jsonb_build_object('manager_id', current_setting('t.pid')), current_setting('t.head_v')), 'P0001',
  'a manager loop is refused', 'person.manager_cycle');
select test.eq((api.person_update(current_setting('t.admin2')::uuid, '{"job_title_en": "Changed by an admin"}', 1)
                ->> 'version')::int, 2, 'an admin changes another admin''s record');
