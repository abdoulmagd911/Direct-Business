-- XTR-03 — per-member settings (Landing 40): Edit someone else's work. By role a team member changes only their own
-- task; set to "Allowed" they change a teammate's too — what they can see, never another department's; "View only"
-- takes nothing a role gives: a manager set to it still manages the team's work (the reading confirmed 23 Nov).
-- Every value is made up.
-- Sabotage: supabase/tests/sabotage/allowed-changes-nothing-of-a-teammates.sql.
insert into core.team (department_id, code, name_en, name_ar)
values (test.department('commercial'), 'test_desk', 'Test Desk', 'فريق الاختبار'),
       (test.department('test_other_dept'), 'test_far', 'Test Far', 'فريق بعيد');
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.mgr', test.person('Test Manager', 'manager')::text, true);
select set_config('t.a', test.person('Test Member A', 'member')::text, true);
select set_config('t.b', test.person('Test Member B', 'member')::text, true);
select set_config('t.far', test.person('Test Member Far', 'member', 'test_other_dept')::text, true);
update core.person set team_id = (select id from core.team where code = 'test_desk')
where id in (current_setting('t.a')::uuid, current_setting('t.b')::uuid, current_setting('t.mgr')::uuid);
update core.person set team_id = (select id from core.team where code = 'test_far') where id = current_setting('t.far')::uuid;

select test.as_person(current_setting('t.a')::uuid);
select set_config('t.t', api.task_create(jsonb_build_object('title', 'Made-up checklist of A')) ->> 'id', true);

-- by role
select test.as_person(current_setting('t.b')::uuid);
select test.eq((api.task(current_setting('t.t')::uuid) ->> 'can_edit')::boolean, false, 'by role a teammate cannot change it');
select test.as_person(current_setting('t.mgr')::uuid);
select test.eq((api.task(current_setting('t.t')::uuid) ->> 'can_edit')::boolean, true, 'by role a manager changes the team''s work');

-- the three settings
select test.as_person(current_setting('t.admin')::uuid);
select api.access_set_person_capability(current_setting('t.b')::uuid, 'records.edit_others', true, 'made up: covers for A');
select api.access_set_person_capability(current_setting('t.far')::uuid, 'records.edit_others', true, 'made up: covers elsewhere');
select api.access_set_person_capability(current_setting('t.mgr')::uuid, 'records.edit_others', false, 'made up: view only on the extra');

select test.as_person(current_setting('t.b')::uuid);
select test.eq((api.task(current_setting('t.t')::uuid) ->> 'can_edit')::boolean, true, 'Allowed: they can change a teammate''s task');
select api.task_update(current_setting('t.t')::uuid, '{"title": "Made-up checklist, tidied by B"}'::jsonb, 1);
select test.eq(api.task(current_setting('t.t')::uuid) ->> 'title', 'Made-up checklist, tidied by B', 'and the door lets them');
select test.as_person(current_setting('t.far')::uuid);
select test.raises(format('select api.task(%L)', current_setting('t.t')), 'P0002',
  'Allowed opens nothing the person cannot see: another department''s task stays hidden', 'common.not_found');
select test.as_person(current_setting('t.mgr')::uuid);
select test.eq((api.task(current_setting('t.t')::uuid) ->> 'can_edit')::boolean, true,
  'View only takes nothing the role gives: the manager still changes the team''s work');

-- back to "As their role"
select test.as_person(current_setting('t.admin')::uuid);
select api.access_clear_person_capability(current_setting('t.b')::uuid, 'records.edit_others', 'made up: A is back');
select test.as_person(current_setting('t.b')::uuid);
select test.eq((api.task(current_setting('t.t')::uuid) ->> 'can_edit')::boolean, false, 'As their role: the teammate cannot change it again');
