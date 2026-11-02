-- BACK-02 — a task row keeps every field its migrations gave it (the Architect's order of 2 Nov). A backfilled task
-- reads, in the task record and in the task list alike, its source report, its period, whether its day came from the
-- report and its import key (20261002010005); a cancelled task reads the reason it was cancelled (20261101120000).
-- A later work.task_row that drops any of the five turns this red. Every value is made up.
-- Sabotage: supabase/tests/sabotage/a-task-row-forgets-its-report.sql.
insert into core.team (department_id, code, name_en, name_ar)
values (test.department('commercial'), 'test_desk', 'Test Desk', 'فريق الاختبار');
select set_config('t.mgr', test.person('Test Manager', 'manager')::text, true);
update core.person set team_id = (select id from core.team where code = 'test_desk') where id = current_setting('t.mgr')::uuid;

select test.as_person(current_setting('t.mgr')::uuid);
select set_config('t.done', api.backfill_tasks(jsonb_build_object('mode', 'tasks', 'origin', 'backfill',
  'source', jsonb_build_object('kind', 'bd_monthly', 'period', '2025-03', 'last_day', '2025-03-31'),
  'rows', jsonb_build_array(jsonb_build_object('title', 'Made-up undated item', 'person_id', current_setting('t.mgr'),
                                               'import_key', 'made-up-row-key')))) ::text, true);
select test.as_owner();
select set_config('t.b', (select id::text from work.task where import_key = 'made-up-row-key'), true);
select test.as_person(current_setting('t.mgr')::uuid);
select set_config('t.rec', api.task(current_setting('t.b')::uuid)::text, true);
select set_config('t.row', (select r::text from jsonb_array_elements(api.tasks('{"past_work": true}', 200) -> 'rows') r
                            where r ->> 'id' = current_setting('t.b')), true);

select test.eq(current_setting('t.rec')::jsonb ->> 'source_kind', 'bd_monthly', 'the record names its source report');
select test.eq(current_setting('t.rec')::jsonb ->> 'source_period', '2025-03', 'and its period');
select test.eq(current_setting('t.rec')::jsonb -> 'date_from_report', 'true'::jsonb, 'and that its day is the report''s');
select test.eq(current_setting('t.rec')::jsonb ->> 'import_key', 'made-up-row-key', 'and its import key');
select test.eq(current_setting('t.row')::jsonb ->> 'source_kind', 'bd_monthly', 'the Past work list row names its source report');
select test.eq(current_setting('t.row')::jsonb ->> 'source_period', '2025-03', 'and its period');
select test.eq(current_setting('t.row')::jsonb -> 'date_from_report', 'true'::jsonb, 'and that its day is the report''s');
select test.eq(current_setting('t.row')::jsonb ->> 'import_key', 'made-up-row-key', 'and its import key');

select set_config('t.t', api.task_create(jsonb_build_object('title', 'Made-up launch', 'happened_on',
  core.riyadh_today() - 2)) ->> 'id', true);
select test.eq(api.task(current_setting('t.t')::uuid) -> 'source_kind', 'null'::jsonb,
  'a task made in the app names no report');
select test.runs(format('select api.task_status_set(%L, %L, null, %L)', current_setting('t.t'), 'cancelled',
  'Made-up: the client withdrew'), 'cancelled with its reason');
select test.eq(api.task(current_setting('t.t')::uuid) ->> 'cancelled_reason', 'Made-up: the client withdrew',
  'the record reads why it was cancelled');
select test.eq((select r ->> 'cancelled_reason' from jsonb_array_elements(api.tasks(null, 200) -> 'rows') r
                where r ->> 'id' = current_setting('t.t')), 'Made-up: the client withdrew', 'and so does the list row');
