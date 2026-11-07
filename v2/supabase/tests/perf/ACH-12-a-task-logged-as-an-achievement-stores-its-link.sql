-- ACH-12 — an achievement logged from a task stores the link (Phase 1, CUJ 4/7).
-- Logging with source_task_id stores it on perf.achievement; logging without it
-- stores null; a made-up task is refused; a wrong key still raises
-- common.unknown_field. Every value is made up.
select set_config('v2.test_now', '2026-10-01 09:00:00+03', true);
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.am1', test.person('Test Account Manager', 'member')::text, true);
insert into core.team (department_id, code, name_en, name_ar)
values (test.department('commercial'), 'test_link', 'Test Link Desk', 'فريق الربط');
update core.person set team_id = (select id from core.team where code = 'test_link')
where id = current_setting('t.am1')::uuid;
select test.as_person(current_setting('t.admin')::uuid);
select set_config('t.p26', api.plan_open(test.department('commercial'), 2026) ->> 'id', true);

select test.as_person(current_setting('t.am1')::uuid);
select set_config('t.t', api.task_create(jsonb_build_object('title', 'Made-up signed task', 'work_type', 'internal'))
  ->> 'id', true);

-- with the task: the link is stored
select set_config('t.a', api.achievement_log(jsonb_build_object('category', 'AWARD', 'title', 'Made-up signed work',
  'happened_on', '2026-09-21', 'source_task_id', current_setting('t.t'))) ->> 'id', true);
select test.as_owner();
select test.eq((select source_task_id from perf.achievement where id = current_setting('t.a')::uuid)::text,
  current_setting('t.t'), 'logging with source_task_id stores the link');
select test.eq((select count(*)::int from perf.achievement where source_task_id = current_setting('t.t')::uuid
                and deleted_at is null), 1, 'the task has exactly one linked achievement');

-- without the task: the link stays null (the manual form keeps working)
select test.as_person(current_setting('t.am1')::uuid);
select set_config('t.b', api.achievement_log(jsonb_build_object('category', 'AWARD', 'title', 'Made-up other work',
  'happened_on', '2026-09-22')) ->> 'id', true);
select test.as_owner();
select test.eq((select source_task_id from perf.achievement where id = current_setting('t.b')::uuid) is null,
  true, 'logging without source_task_id stores null');

-- a made-up task is refused, and a wrong key is still an unknown field
select test.as_person(current_setting('t.am1')::uuid);
select test.raises(format($$select api.achievement_log(jsonb_build_object('category', 'AWARD', 'title', 'Made up',
  'happened_on', '2026-09-23', 'source_task_id', %L))$$, gen_random_uuid()), 'P0002',
  'a task that does not exist is refused', 'common.not_found');
select test.raises($$select api.achievement_log(jsonb_build_object('category', 'AWARD', 'title', 'Made up',
  'happened_on', '2026-09-23', 'source_task', 'made-up'))$$, 'P0001',
  'a wrong key is still an unknown field', 'common.unknown_field');
