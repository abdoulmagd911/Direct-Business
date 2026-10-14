-- ALR-04 — a task coming due tells its owner at most once a day, held by the database (the Architect's order of 14 Oct,
-- after the owner's bell showed three unnamed "coming due" rows). Moving the due day on the day of the alert makes a new
-- alert key, but the unique key notification_due_once_a_day keeps it to one row; the next day may tell again. Every
-- value is made up.
-- Sabotage: supabase/tests/sabotage/a-task-coming-due-told-twice-a-day.sql.
select set_config('v2.test_now', now()::text, true);
select set_config('t.pm', test.person('Test Task Owner', 'member')::text, true);
insert into core.team (department_id, code, name_en, name_ar)
values (test.department('commercial'), 'test_desk', 'Test Desk', 'فريق الاختبار');
update core.person set team_id = (select id from core.team where code = 'test_desk') where id = current_setting('t.pm')::uuid;
select test.as_person(current_setting('t.pm')::uuid);
select set_config('t.t', api.task_create(jsonb_build_object('title', 'Made-up due soon', 'work_type', 'internal',
  'due_on', core.riyadh_today() + 3)) ->> 'id', true);
select test.as_owner();

-- the day before: told once
select set_config('v2.test_now', (now() + interval '2 days')::text, true);
select notify.generate_alerts();
select test.eq((select count(*)::int from notify.notification where kind = 'alert_due_tomorrow'
                and person_id = current_setting('t.pm')::uuid), 1, 'the day before its due day, its owner is told');

-- the due day moves to today, and the job runs again the same day: nothing new
update work.task set due_on = core.riyadh_today() where id = current_setting('t.t')::uuid;
select notify.generate_alerts();
select test.eq((select count(*)::int from notify.notification where kind = 'alert_due_tomorrow'
                and person_id = current_setting('t.pm')::uuid), 1,
  'its due day moved and the job ran again the same day, and nothing new was made');

-- the next day, with a new due day: it may tell again
select set_config('v2.test_now', (now() + interval '3 days')::text, true);
update work.task set due_on = core.riyadh_today() + 1 where id = current_setting('t.t')::uuid;
select notify.generate_alerts();
select test.eq((select count(*)::int from notify.notification where kind = 'alert_due_tomorrow'
                and person_id = current_setting('t.pm')::uuid), 2, 'the next day, a new due day is told again');
