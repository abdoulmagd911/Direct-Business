-- DATE-02 — the dates rule on tasks (V400, V456). A task carries the day it happened, never a later one; given to
-- someone with a past date it still tells them (assigned, helper added); a past-dated status change tells nobody;
-- "logged late" only after go-live and only past `work.late_days`. Every value is made up.
-- Sabotages: supabase/tests/sabotage/a-back-dated-assignment-tells-nobody.sql, late-before-go-live.sql.
insert into core.team (department_id, code, name_en, name_ar)
values (test.department('commercial'), 'test_desk', 'Test Desk', 'فريق الاختبار');
select set_config('t.mgr', test.person('Test Manager', 'manager')::text, true);
select set_config('t.am1', test.person('Test Account Manager', 'member')::text, true);
select set_config('t.am2', test.person('Test Helper', 'member')::text, true);
update core.person set team_id = (select id from core.team where code = 'test_desk')
where id in (current_setting('t.mgr')::uuid, current_setting('t.am1')::uuid, current_setting('t.am2')::uuid);

select test.as_person(current_setting('t.mgr')::uuid);
select test.raises(format('select api.task_create(%L::jsonb)', jsonb_build_object('title', 'Made up', 'happened_on',
  core.riyadh_today() + 1)), 'P0001', 'nothing happens after the day it is logged', 'common.date_in_future');
select set_config('t.made', api.task_create(jsonb_build_object('title', 'Made-up from three weeks ago', 'owner_id',
  current_setting('t.am1'), 'helper_ids', jsonb_build_array(current_setting('t.am2')),
  'happened_on', core.riyadh_today() - 20))::text, true);
select set_config('t.t', current_setting('t.made')::jsonb ->> 'id', true);
select test.as_owner();
select test.eq((select happened_on from work.task where id = current_setting('t.t')::uuid), core.riyadh_today() - 20,
  'it keeps the day it happened');
select test.eq((select count(*)::int from notify.notification
                where request_id = (current_setting('t.made')::jsonb ->> 'request_id')::uuid
                  and ((person_id = current_setting('t.am1')::uuid and kind = 'assigned')
                    or (person_id = current_setting('t.am2')::uuid and kind = 'helper_added'))), 2,
  'back-dated, the owner and the helper are still told');

select test.as_person(current_setting('t.mgr')::uuid);
select set_config('t.st', api.task_status_set(current_setting('t.t')::uuid, 'in_progress', core.riyadh_today() - 5)::text,
  true);
select test.as_owner();
select test.eq((select count(*)::int from notify.notification
                where request_id = (current_setting('t.st')::jsonb ->> 'request_id')::uuid), 0,
  'a past-dated status change tells nobody');

-- logged late: never before go-live; after it, past work.late_days
select test.eq((select (work.task_flags(t) ->> 'logged_late')::boolean from work.task t
                where t.id = current_setting('t.t')::uuid), false, 'before go-live nothing is late');
insert into core.setting (key, value, valid_from, reason, created_by)
values ('app.go_live_on', to_jsonb((core.riyadh_today() - 60)::text), core.riyadh_today() - 60, 'made up: go-live',
        current_setting('t.mgr')::uuid);
select test.as_person(current_setting('t.mgr')::uuid);
select set_config('t.old', api.task_create(jsonb_build_object('title', 'Made-up three weeks ago', 'owner_id',
  current_setting('t.am1'), 'happened_on', core.riyadh_today() - 21)) ->> 'id', true);
select set_config('t.recent', api.task_create(jsonb_build_object('title', 'Made-up ten days ago', 'owner_id',
  current_setting('t.am1'), 'happened_on', core.riyadh_today() - 10)) ->> 'id', true);
select test.eq((api.task(current_setting('t.old')::uuid) ->> 'logged_late')::boolean, true,
  'after go-live, logged three weeks late is late');
select test.eq((api.task(current_setting('t.recent')::uuid) ->> 'logged_late')::boolean, false,
  'ten days late is not');
