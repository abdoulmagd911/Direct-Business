-- TSK-02 — a new task's owner and organisation (V464, V466; OLD-018). Unnamed, the owner is the project's owner, else
-- the organisation's account manager, else the maker. Client work needs an organisation or a project; internal work
-- has no organisation; a task's organisation and work type are its project's; a contact belongs to the task's
-- organisation; a project's organisation never moves once it has tasks. Every value is made up.
-- Sabotages: supabase/tests/sabotage/the-owner-chain-skips-the-project.sql, a-task-on-another-organisations-project.sql.
insert into core.team (department_id, code, name_en, name_ar)
values (test.department('commercial'), 'test_desk', 'Test Desk', 'فريق الاختبار');
select set_config('t.head', test.person('Test Head', 'head')::text, true);
select set_config('t.am1', test.person('Test Account Manager', 'member')::text, true);
select set_config('t.am2', test.person('Test Second Member', 'member')::text, true);
select set_config('t.pm', test.person('Test Project Owner', 'member')::text, true);
update core.person set team_id = (select id from core.team where code = 'test_desk')
where id in (current_setting('t.head')::uuid, current_setting('t.am1')::uuid, current_setting('t.am2')::uuid,
             current_setting('t.pm')::uuid);

select test.as_person(current_setting('t.head')::uuid);
select set_config('t.p', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Chain Co',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate',
                                                'owner_id', current_setting('t.am1'))))) ->> 'id', true);
select set_config('t.q', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Other Co',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate',
                                                'owner_id', current_setting('t.am1'))))) ->> 'id', true);
select set_config('t.prj', api.project_save(null, jsonb_build_object('name', 'Made-up rollout', 'partner_id',
  current_setting('t.p'), 'owner_id', current_setting('t.pm'))) ->> 'id', true);

-- the chain: the project's owner, else the account manager, else the maker
select test.as_person(current_setting('t.am2')::uuid);
select test.eq(api.task_create(jsonb_build_object('title', 'Made-up on the project', 'project_id', current_setting('t.prj')))
  ->> 'owner_id', current_setting('t.pm'), 'unnamed, the owner is the project''s owner');
select test.eq(api.task_create(jsonb_build_object('title', 'Made-up for the client', 'partner_id', current_setting('t.p')))
  ->> 'owner_id', current_setting('t.am1'), 'else the organisation''s account manager');
select test.eq(api.task_create(jsonb_build_object('title', 'Made-up of my own')) ->> 'owner_id', current_setting('t.am2'),
  'else the maker');
select test.as_owner();
update core.person set active = false where id = current_setting('t.am1')::uuid;
select test.as_person(current_setting('t.am2')::uuid);
select test.eq(api.task_create(jsonb_build_object('title', 'Made-up after they left', 'partner_id', current_setting('t.p')))
  ->> 'owner_id', current_setting('t.am2'), 'an account manager switched off is skipped');

-- client work and its organisation
select test.raises(format('select api.task_create(%L::jsonb)', jsonb_build_object('title', 'Made up', 'work_type', 'client')),
  'P0001', 'client work without an organisation or a project is refused', 'task.client_work_needs_partner');
select test.raises(format('select api.task_create(%L::jsonb)', jsonb_build_object('title', 'Made up', 'work_type',
  'internal', 'partner_id', current_setting('t.p'))), 'P0001', 'internal work has no organisation',
  'task.internal_has_no_partner');
select test.raises(format('select api.task_create(%L::jsonb)', jsonb_build_object('title', 'Made up', 'partner_id',
  current_setting('t.q'), 'project_id', current_setting('t.prj'))), 'P0001',
  'a task on another organisation''s project is refused', 'task.partner_not_projects');
select set_config('t.pt', api.task_create(jsonb_build_object('title', 'Made-up with the project',
  'project_id', current_setting('t.prj'))) ->> 'id', true);
select test.eq(api.task(current_setting('t.pt')::uuid) ->> 'partner_id', current_setting('t.p'),
  'a task on a project takes its organisation');

-- a contact of the task's organisation only
select test.as_owner();
insert into partner.contact (partner_id, name_en) values (current_setting('t.p')::uuid, 'Made-up Contact One'),
  (current_setting('t.q')::uuid, 'Made-up Contact Two');
select set_config('t.c1', (select id from partner.contact where name_en = 'Made-up Contact One')::text, true);
select set_config('t.c2', (select id from partner.contact where name_en = 'Made-up Contact Two')::text, true);
select test.as_person(current_setting('t.pm')::uuid);
select test.runs(format('select api.task_contacts_set(%L, array[%L]::uuid[])', current_setting('t.pt'),
  current_setting('t.c1')), 'a contact of its organisation is added');
select test.raises(format('select api.task_contacts_set(%L, array[%L]::uuid[])', current_setting('t.pt'),
  current_setting('t.c2')), 'P0001',
  'a contact of another organisation is refused', 'task.contact_not_partners');

-- the project's organisation never moves once it has tasks
select test.as_person(current_setting('t.head')::uuid);
select test.raises(format('select api.project_save(%L, %L::jsonb, %s)', current_setting('t.prj'),
  jsonb_build_object('partner_id', current_setting('t.q')), api.project(current_setting('t.prj')::uuid) ->> 'version'),
  'P0001', 'a project with tasks keeps its organisation',
  'project.partner_fixed');
select test.raises(format('select api.projects_remove(array[%L]::uuid[])', current_setting('t.prj')), 'P0001',
  'and is not removed under them', 'project.has_tasks');
