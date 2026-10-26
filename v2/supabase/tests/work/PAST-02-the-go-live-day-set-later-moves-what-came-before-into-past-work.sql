-- PAST-02 — the go-live day is read live, never stored on an entry (V609). With app.go_live_on blank, a task and an
-- achievement dated 2 and 16 Oct are live work, and nothing is ever logged late. Once an admin sets the day to 18 Oct,
-- the same entries move into Past work with no change to them, and "logged late" counts from 18 Oct only. Every value
-- is made up.
-- Sabotage: supabase/tests/sabotage/past-work-fixed-when-logged.sql.
select set_config('v2.test_now', '2026-10-23 09:00:00+03', true);
insert into core.team (department_id, code, name_en, name_ar)
values (test.department('commercial'), 'test_golive', 'Test Go Live', 'فريق الإطلاق');
select set_config('t.admin', test.person('Test Go Live Admin', 'admin')::text, true);
select set_config('t.am', test.person('Test Go Live Member', 'member')::text, true);
update core.person set team_id = (select id from core.team where code = 'test_golive')
where id in (current_setting('t.admin')::uuid, current_setting('t.am')::uuid);
select test.eq(coalesce(core.setting_at('app.go_live_on', null, core.riyadh_today()) #>> '{}', ''), '',
  'the go-live day starts blank');
select test.as_person(current_setting('t.admin')::uuid);
select api.plan_open(test.department('commercial'), 2026);

-- logged while the day is blank: live work
select test.as_person(current_setting('t.am')::uuid);
select set_config('t.t2', api.task_create(jsonb_build_object('title', 'Made-up task of 2 Oct',
  'happened_on', '2026-10-02')) ->> 'id', true);
select set_config('t.t16', api.task_create(jsonb_build_object('title', 'Made-up task of 16 Oct',
  'happened_on', '2026-10-16')) ->> 'id', true);
select set_config('t.t20', api.task_create(jsonb_build_object('title', 'Made-up task of 20 Oct',
  'happened_on', '2026-10-20')) ->> 'id', true);
select set_config('t.a16', api.achievement_log(jsonb_build_object('category', 'AWARD',
  'title', 'Made-up award of 16 Oct', 'happened_on', '2026-10-16')) ->> 'id', true);
select test.eq((api.tasks('{"past_work": true}'::jsonb) ->> 'total')::int, 0, 'while the day is blank, Past work is empty');
select test.eq((api.task(current_setting('t.t2')::uuid) ->> 'past_work')::boolean, false, 'and 2 Oct is live work');
select test.eq((api.achievement(current_setting('t.a16')::uuid) ->> 'past_work')::boolean, false,
  'as is the achievement of 16 Oct');
select test.as_owner();
select test.eq(core.logged_late('2026-10-18', '2026-11-05 09:00:00+03'), false,
  'with no go-live day, nothing is logged late');

-- an admin sets the day to 18 Oct
select test.as_person(current_setting('t.admin')::uuid);
select api.setting_set('app.go_live_on', null, to_jsonb('2026-10-18'::text), null, 'made up: day one');

-- the same entries, unchanged, now read as past work
select test.as_person(current_setting('t.am')::uuid);
select test.eq((select jsonb_agg(x ->> 'title' order by x ->> 'title') from jsonb_array_elements(
                  api.tasks('{"past_work": true}'::jsonb) -> 'rows') x),
  '["Made-up task of 16 Oct", "Made-up task of 2 Oct"]'::jsonb, 'the tasks of 2 and 16 Oct are now under Past work');
select test.eq((select jsonb_agg(x ->> 'title') from jsonb_array_elements(api.tasks() -> 'rows') x),
  '["Made-up task of 20 Oct"]'::jsonb, 'and only 20 Oct stays live');
select test.eq((api.achievement(current_setting('t.a16')::uuid) ->> 'past_work')::boolean, true,
  'the achievement of 16 Oct is past work too');
select test.eq((api.achievements('{"past_work": true}'::jsonb) ->> 'total')::int, 1, 'and is listed under it');

-- logged late counts from 18 Oct
select test.as_owner();
select test.eq(core.logged_late('2026-10-16', '2026-11-05 09:00:00+03'), false,
  'work before 18 Oct is never logged late');
select test.eq(core.logged_late('2026-10-18', '2026-11-05 09:00:00+03'), true,
  'work of 18 Oct logged 18 days later is late');
select test.eq(core.logged_late('2026-10-18', '2026-10-30 09:00:00+03'), false, 'logged 12 days later it is not');
