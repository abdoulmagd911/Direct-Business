-- XTR-06 — per-member settings (Landing 51): "Edit someone else's work — Allowed" reaches a teammate's project
-- (its fields, its health, its removal) and a file on an organisation's side, as it reaches a task (XTR-03). By role
-- a team member changes only their own; the setting changes that one person only; it opens nothing the person cannot
-- see; a Viewer gains nothing from a setting left over; "As their role" takes it away again. Every value is made up.
-- Sabotages: supabase/tests/sabotage/allowed-does-not-reach-a-project.sql,
--            supabase/tests/sabotage/allowed-does-not-reach-a-projects-health.sql,
--            supabase/tests/sabotage/allowed-does-not-remove-a-project.sql,
--            supabase/tests/sabotage/allowed-does-not-reach-a-sides-file.sql.
insert into core.team (department_id, code, name_en, name_ar)
values (test.department('commercial'), 'test_desk', 'Test Desk', 'فريق الاختبار'),
       (test.department('test_other_dept'), 'test_far', 'Test Far', 'فريق بعيد');
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.a', test.person('Test Member A', 'member')::text, true);
select set_config('t.b', test.person('Test Member B', 'member')::text, true);
select set_config('t.c', test.person('Test Member C', 'member')::text, true);
select set_config('t.m', test.person('Test Member M', 'member')::text, true);
select set_config('t.far', test.person('Test Member Far', 'member', 'test_other_dept')::text, true);
update core.person set team_id = (select id from core.team where code = 'test_desk')
where id in (current_setting('t.a')::uuid, current_setting('t.b')::uuid, current_setting('t.c')::uuid,
             current_setting('t.m')::uuid);
update core.person set team_id = (select id from core.team where code = 'test_far') where id = current_setting('t.far')::uuid;
-- B and C read the Client side at Own: they change an organisation only where they own its side
insert into core.person_page_level (person_id, page_key, level, reason)
values (current_setting('t.b')::uuid, 'clients', 'own', 'made up: own clients only'),
       (current_setting('t.c')::uuid, 'clients', 'own', 'made up: own clients only');

-- A's project, and A's client with a travel policy on its Client side
select test.as_person(current_setting('t.a')::uuid);
select set_config('t.prj', api.project_save(null, jsonb_build_object('name', 'Made-up internal tooling',
  'work_type', 'internal')) ->> 'id', true);
select set_config('t.p', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Xtr06 Co',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate',
                                                'owner_id', current_setting('t.a'))))) ->> 'id', true);
select set_config('t.pol', api.file_begin('partner', current_setting('t.p')::uuid, 'travel_policy', 'travel_policy',
  'policy.pdf', 1000, 'application/pdf', null, null, core.riyadh_today() + 30)::text, true);
select test.runs(format('insert into storage.objects (bucket_id, name) values (%L, %L)', 'files',
  current_setting('t.pol')::jsonb ->> 'path'), 'uploaded');
select api.file_finish((current_setting('t.pol')::jsonb ->> 'id')::uuid, repeat('2', 64));

-- by role: a teammate changes neither
select test.as_person(current_setting('t.b')::uuid);
select test.raises(format('select api.project_save(%L, %L::jsonb, 1)', current_setting('t.prj'), '{"name": "Made-up, renamed by B"}'),
  '42501', 'by role a teammate cannot change the project', 'access.needs_level');
select test.raises(format('select api.project_health_set(%L, %L, %L)', current_setting('t.prj'), 'at_risk', 'Made up'),
  '42501', 'nor say how it is going', 'access.needs_level');
select test.raises(format('select api.projects_remove(array[%L]::uuid[], %L)', current_setting('t.prj'), 'made up'),
  '42501', 'nor remove it', 'access.needs_level');
select test.raises(format('select api.file_review_set(%L, %L)', current_setting('t.pol')::jsonb ->> 'id', core.riyadh_today() + 60),
  '42501', 'nor move the review date of a file on a colleague''s client', 'file.not_yours');

-- "Allowed" on B, on a person of another department, and left over on a person whose role became Viewer
select test.as_person(current_setting('t.admin')::uuid);
select api.access_set_person_capability(current_setting('t.b')::uuid, 'records.edit_others', true, 'made up: covers for A');
select api.access_set_person_capability(current_setting('t.far')::uuid, 'records.edit_others', true, 'made up: covers elsewhere');
select api.access_set_person_capability(current_setting('t.m')::uuid, 'records.edit_others', true, 'made up: set while a member');
select test.as_owner();
update core.person set role_id = (select id from core.role where key = 'viewer') where id = current_setting('t.m')::uuid;

select test.as_person(current_setting('t.b')::uuid);
select test.runs(format('select api.project_save(%L, %L::jsonb, 1)', current_setting('t.prj'), '{"name": "Made-up tooling, tidied by B"}'),
  'Allowed: they change a teammate''s project');
select test.eq(api.project(current_setting('t.prj')::uuid) ->> 'name', 'Made-up tooling, tidied by B', 'and it is changed');
select test.runs(format('select api.project_health_set(%L, %L, %L)', current_setting('t.prj'), 'at_risk', 'Made-up: the vendor is late'),
  'they say how it is going');
select test.runs(format('select api.file_review_set(%L, %L, 1)', current_setting('t.pol')::jsonb ->> 'id', core.riyadh_today() + 60),
  'and they move the review date of the file on a colleague''s client');

-- the setting changed that one person only, opens nothing unseen, and gives a Viewer nothing
select test.as_person(current_setting('t.c')::uuid);
select test.raises(format('select api.project_health_set(%L, %L, %L)', current_setting('t.prj'), 'off_track', 'Made up'),
  '42501', 'the setting changed that one person only: a second teammate still cannot', 'access.needs_level');
select test.raises(format('select api.file_review_set(%L, %L)', current_setting('t.pol')::jsonb ->> 'id', core.riyadh_today() + 90),
  '42501', 'on the project or on the file', 'file.not_yours');
select test.as_person(current_setting('t.far')::uuid);
select test.raises(format('select api.project_health_set(%L, %L, %L)', current_setting('t.prj'), 'off_track', 'Made up'),
  'P0002', 'Allowed opens nothing the person cannot see: another department''s project stays hidden', 'common.not_found');
select test.as_person(current_setting('t.m')::uuid);
select test.raises(format('select api.project_health_set(%L, %L, %L)', current_setting('t.prj'), 'off_track', 'Made up'),
  '42501', 'a person whose role became Viewer changes no project, whatever their record still says', 'access.needs_level');
select test.raises(format('select api.file_review_set(%L, %L)', current_setting('t.pol')::jsonb ->> 'id', core.riyadh_today() + 90),
  '42501', 'and no file', 'file.not_yours');

-- "Allowed" removes it too; "As their role" takes the extra away again
select test.as_person(current_setting('t.a')::uuid);
select set_config('t.prj2', api.project_save(null, jsonb_build_object('name', 'Made-up second project',
  'work_type', 'internal')) ->> 'id', true);
select test.as_person(current_setting('t.b')::uuid);
select test.runs(format('select api.projects_remove(array[%L]::uuid[], %L)', current_setting('t.prj2'), 'made up: a duplicate'),
  'Allowed: they remove a teammate''s project');
select test.as_person(current_setting('t.admin')::uuid);
select api.access_clear_person_capability(current_setting('t.b')::uuid, 'records.edit_others', 'made up: A is back');
select test.as_person(current_setting('t.b')::uuid);
select test.raises(format('select api.project_health_set(%L, %L, %L)', current_setting('t.prj'), 'on_track', 'Made up'),
  '42501', 'As their role: the teammate cannot change the project again', 'access.needs_level');
select test.raises(format('select api.file_review_set(%L, %L)', current_setting('t.pol')::jsonb ->> 'id', core.riyadh_today() + 90),
  '42501', 'nor the file', 'file.not_yours');
