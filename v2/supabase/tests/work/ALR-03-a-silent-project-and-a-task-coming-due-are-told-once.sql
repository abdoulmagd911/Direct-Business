-- ALR-03 — the daily reminders of P5-1 (V401; OLD-WRK-044). A live project with no health update for
-- `work.project_update_days` (14) tells its owner once — on the first run on or after that day, never again for the same
-- silence, and again only after a new update falls silent; a project on hold is not reminded. A live task tells its
-- owner once, `work.reminder_days_before_due` (1) before its due day; a done task and past work are not reminded.
-- Every value is made up.
-- Sabotages: supabase/tests/sabotage/a-silent-project-reminded-every-day.sql, a-done-task-reminded.sql.
select set_config('v2.test_now', now()::text, true);
insert into core.team (department_id, code, name_en, name_ar)
values (test.department('commercial'), 'test_desk', 'Test Desk', 'فريق الاختبار');
select set_config('t.pm', test.person('Test Project Owner', 'member')::text, true);
update core.person set team_id = (select id from core.team where code = 'test_desk') where id = current_setting('t.pm')::uuid;

select test.as_person(current_setting('t.pm')::uuid);
select set_config('t.prj', api.project_save(null, jsonb_build_object('name', 'Made-up silent project',
  'work_type', 'internal')) ->> 'id', true);
select set_config('t.held', api.project_save(null, jsonb_build_object('name', 'Made-up held project',
  'work_type', 'internal', 'status', 'on_hold')) ->> 'id', true);
select set_config('t.t', api.task_create(jsonb_build_object('title', 'Made-up due soon', 'work_type', 'internal',
  'due_on', core.riyadh_today() + 3)) ->> 'id', true);
select set_config('t.done', api.task_create(jsonb_build_object('title', 'Made-up done early', 'work_type', 'internal',
  'due_on', core.riyadh_today() + 3)) ->> 'id', true);
select api.task_status_set(current_setting('t.done')::uuid, 'done');
select test.as_owner();

-- the task: not yet two days before; told the day before, once
select set_config('v2.test_now', (now() + interval '1 day')::text, true);
select notify.generate_alerts();
select test.eq((select count(*)::int from notify.notification where kind = 'alert_due_tomorrow'), 0,
  'two days before its due day, nothing');
select set_config('v2.test_now', (now() + interval '2 days')::text, true);
select notify.generate_alerts();
select set_config('v2.test_now', (now() + interval '3 days')::text, true);
select notify.generate_alerts();
select test.eq((select array_agg(entity_id) from notify.notification where kind = 'alert_due_tomorrow'
                and person_id = current_setting('t.pm')::uuid), array[current_setting('t.t')::uuid],
  'the day before, its owner is told once — the done task never');

-- the project: silent 14 days → one reminder, on the first run after a missed day
select set_config('v2.test_now', (now() + interval '13 days')::text, true);
select notify.generate_alerts();
select test.eq((select count(*)::int from notify.notification where kind = 'alert_project_no_update'), 0,
  'thirteen days silent, nothing');
select set_config('v2.test_now', (now() + interval '15 days')::text, true);
select notify.generate_alerts();
select set_config('v2.test_now', (now() + interval '16 days')::text, true);
select notify.generate_alerts();
select test.eq((select array_agg(entity_id) from notify.notification where kind = 'alert_project_no_update'
                and person_id = current_setting('t.pm')::uuid), array[current_setting('t.prj')::uuid],
  'fourteen days silent, its owner is told once — the project on hold never');

-- a new update starts the count again
select test.as_person(current_setting('t.pm')::uuid);
select api.project_health_set(current_setting('t.prj')::uuid, 'on_track', 'Made-up: moving again');
select test.as_owner();
select set_config('v2.test_now', (now() + interval '29 days')::text, true);
select notify.generate_alerts();
select test.eq((select count(*)::int from notify.notification where kind = 'alert_project_no_update'), 1,
  'after an update, thirteen days silent again is nothing');
select set_config('v2.test_now', (now() + interval '30 days')::text, true);
select notify.generate_alerts();
select test.eq((select count(*)::int from notify.notification where kind = 'alert_project_no_update'), 2,
  'fourteen is the next reminder');
