-- PAST-03 — D (the Architect's order of 26 Oct): open work stays in sight. With day one set to 18 Oct, an open task of
-- 2 Oct that has an owner is live work: on My day and My work, flagged overdue past its due day, and its owner is told
-- once "is overdue". A closed task of the same day is past work; a task of that day with owner Unknown stays past work
-- until someone takes it (V491). Every value is made up.
-- Sabotages: supabase/tests/sabotage/open-work-dated-before-day-one-is-hidden.sql,
-- supabase/tests/sabotage/an-overdue-task-tells-nobody.sql.
select set_config('v2.test_now', '2026-10-26 09:00:00+03', true);
insert into core.team (department_id, code, name_en, name_ar)
values (test.department('commercial'), 'test_open', 'Test Open Work', 'فريق العمل المفتوح');
select set_config('t.am', test.person('Test Open Owner', 'member')::text, true);
select set_config('t.mgr', test.person('Test Open Manager', 'manager')::text, true);
update core.person set team_id = (select id from core.team where code = 'test_open')
where id in (current_setting('t.am')::uuid, current_setting('t.mgr')::uuid);
insert into core.setting (key, value, valid_from, reason, created_by)
values ('app.go_live_on', to_jsonb('2026-10-18'::text), '2026-10-01', 'made up: day one', current_setting('t.mgr')::uuid);

select test.as_person(current_setting('t.am')::uuid);
select set_config('t.open', api.task_create(jsonb_build_object('title', 'Made-up open task of 2 Oct',
  'happened_on', '2026-10-02', 'due_on', '2026-10-09')) ->> 'id', true);
select set_config('t.shut', api.task_create(jsonb_build_object('title', 'Made-up closed task of 2 Oct',
  'happened_on', '2026-10-02')) ->> 'id', true);
select api.task_status_set(current_setting('t.shut')::uuid, 'done');
select test.as_person(current_setting('t.mgr')::uuid);
select set_config('t.nobody', api.task_create(jsonb_build_object('title', 'Made-up task of 2 Oct nobody holds',
  'happened_on', '2026-10-02', 'owner_unknown', true)) ->> 'id', true);

select test.as_person(current_setting('t.am')::uuid);
select test.eq((api.task(current_setting('t.open')::uuid) ->> 'past_work')::boolean, false,
  'an open task with an owner is live work, whatever its date');
select test.eq((api.task(current_setting('t.open')::uuid) ->> 'overdue')::boolean, true, 'flagged overdue');
select test.eq((select count(*)::int from jsonb_array_elements(api.tasks('{"scope": "my_work"}'::jsonb) -> 'rows') x
                where x ->> 'id' = current_setting('t.open')), 1, 'in My work');
select test.ok(api.my_day('me')::text like '%' || current_setting('t.open') || '%', 'and on My day');
select test.eq((api.task(current_setting('t.shut')::uuid) ->> 'past_work')::boolean, true,
  'a closed task of the same day is past work');
select test.as_person(current_setting('t.mgr')::uuid);
select test.eq((api.task(current_setting('t.nobody')::uuid) ->> 'past_work')::boolean, true,
  'and one with owner Unknown stays past work until someone takes it');

select test.as_owner();
select notify.generate_alerts();
select notify.generate_alerts();
select test.eq((select jsonb_agg(jsonb_build_object('who', person_id, 'label', label_key))
                from notify.notification where entity_id = current_setting('t.open')::uuid),
  jsonb_build_array(jsonb_build_object('who', current_setting('t.am'), 'label', 'alert.overdue')),
  'its owner is told once that it is overdue');
select test.eq((select count(*)::int from notify.notification
                where entity_id in (current_setting('t.shut')::uuid, current_setting('t.nobody')::uuid)), 0,
  'past work tells nobody');
