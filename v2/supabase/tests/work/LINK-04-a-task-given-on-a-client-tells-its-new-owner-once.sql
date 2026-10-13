-- LINK-04 — a task given to someone on a client tells them exactly once (sweep 12 Oct; P3-6). A manager gives a member a
-- task on a client: the member has one notification for it, and the client link adds none; the manager, who acted, is
-- told nothing. Every value is made up.
-- Sabotage: supabase/tests/sabotage/a-client-task-tells-twice.sql.
select set_config('v2.test_now', '2026-10-12 09:00:00+03', true);
insert into core.team (department_id, code, name_en, name_ar)
values (test.department('commercial'), 'test_tell', 'Test Tell Desk', 'فريق الإبلاغ');
select set_config('t.am', test.person('Test Told Member', 'member')::text, true);
select set_config('t.mgr', test.person('Test Telling Manager', 'manager')::text, true);
update core.person set team_id = (select id from core.team where code = 'test_tell')
where id in (current_setting('t.am')::uuid, current_setting('t.mgr')::uuid);

select test.as_person(current_setting('t.mgr')::uuid);
select set_config('t.p', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Told Co',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate', 'owner_id', current_setting('t.am')))))
  ->> 'id', true);
select set_config('t.t', api.task_create(jsonb_build_object('title', 'Made-up contract call', 'work_type', 'client',
  'partner_id', current_setting('t.p'), 'due_on', '2026-10-12', 'owner_id', current_setting('t.am'))) ->> 'id', true);

select test.as_owner();
select test.eq((select count(*)::int from notify.notification
                where person_id = current_setting('t.am')::uuid and entity_id = current_setting('t.t')::uuid),
  1, 'the new owner is told once');
select test.eq((select count(*)::int from notify.notification
                where person_id = current_setting('t.mgr')::uuid and entity_id = current_setting('t.t')::uuid),
  0, 'the manager who acted is told nothing');
