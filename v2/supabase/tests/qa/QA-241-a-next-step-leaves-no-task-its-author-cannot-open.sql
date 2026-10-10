-- QA-241 — A next step never leaves its author a task they cannot open (V197 "no task when nobody can take it", V151,
-- V517). In the pilot's stage 0 (V517) Tasks is none on the member and manager roles until 18 Oct, while Clients and
-- Log activity are live. An activity logged there with a next step must not make a task its author can neither open
-- nor close: that task is told to them the day before it is due, and while it stays open the organisation never goes
-- stale (V151 after P5-1), so the stale alert never comes.
-- Written by the QA auditor to fail until it is fixed: on #141 at f2733e5 work.next_step_task() asks only for a team
-- and V465, so a member at Tasks none gets the task (api.task: common.not_found), is told alert_due_tomorrow about it,
-- and the organisation still reads fresh 25 days on. Passes on v2/main (no next-step task yet). Fix-agnostic: either
-- no task (the next step stays on the activity, as for an import) or one its author can open.
-- Finding: docs/v2/QA-LOG.md, 2026-10-02, QA-241. Made-up values only.
select set_config('v2.test_now', now()::text, true);
insert into core.team (department_id, code, name_en, name_ar)
values (test.department('commercial'), 'test_desk', 'Test Desk', 'فريق الاختبار');
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.mgr', test.person('Test Manager', 'manager')::text, true);
select set_config('t.am', test.person('Test Pilot Member', 'member')::text, true);
update core.person set team_id = (select id from core.team where code = 'test_desk')
where id in (current_setting('t.mgr')::uuid, current_setting('t.am')::uuid);
update core.person set manager_id = current_setting('t.mgr')::uuid where id = current_setting('t.am')::uuid;
select set_config('t.role', (select id::text from core.role where key = 'member'), true);

-- the pilot's row: Tasks at none on the member role
select test.as_person(current_setting('t.admin')::uuid);
select api.access_set_role_level(current_setting('t.role')::uuid, 'tasks', 'none', 'made up: pilot stage 0');
select test.as_person(current_setting('t.mgr')::uuid);
select set_config('t.p', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Pilot Co QA241',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate',
                                                'owner_id', current_setting('t.am'))))) ->> 'id', true);
select test.as_person(current_setting('t.am')::uuid);
select set_config('t.a', api.activity_log(current_setting('t.p')::uuid, 'visit', 'visit_done', core.riyadh_today(),
  'Made-up visit', 'Made-up: send the rate sheet', core.riyadh_today() + 3)::text, true);

select test.as_owner();
select set_config('t.tasks', coalesce((select string_agg(t.id::text, ',') from work.task t
  where t.origin = 'next_step' and t.owner_id = current_setting('t.am')::uuid), ''), true);
select test.as_person(current_setting('t.am')::uuid);
do $$
declare i text; blind text[] := '{}';
begin
  foreach i in array coalesce(string_to_array(nullif(current_setting('t.tasks'), ''), ','), '{}') loop
    begin perform api.task(i::uuid); exception when others then blind := blind || i; end;
  end loop;
  perform set_config('t.blind', array_to_string(blind, ','), true);
end $$;
select test.eq(current_setting('t.blind'), '', 'a member at Tasks none is left no next-step task they cannot open');

-- told the day before it is due: never about a task they cannot open
select set_config('v2.test_now', (now() + interval '2 days')::text, true);
select test.as_owner();
select notify.generate_alerts();
select test.eq((select count(*)::int from notify.notification n
                where n.person_id = current_setting('t.am')::uuid and n.kind = 'alert_due_tomorrow'
                  and n.entity_id::text = any (string_to_array(nullif(current_setting('t.blind'), ''), ','))), 0,
  'and is never told about one');

-- the organisation still goes stale once its next step's day is long past (V151)
select set_config('v2.test_now', (now() + interval '25 days')::text, true);
select test.as_person(current_setting('t.am')::uuid);
select test.ok((api.partner(current_setting('t.p')::uuid) ->> 'stale_on')::date <= core.riyadh_today(),
  '25 days on, with nobody able to work the next step, the organisation goes stale');
