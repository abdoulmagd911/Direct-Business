-- STP-01 — Landing 33 (B4): a step done is a dated record — the day and who — and it feeds the evidence of the
-- achievement that came from the task. The task's row says how many steps it has and how many are open (its
-- progress). A reader who may not see the task is shown none of its steps on the achievement. Every value is made up.
-- Sabotages: a-task-row-counts-no-steps, an-open-step-shows-as-evidence, a-done-step-loses-its-day.
select set_config('v2.test_now', '2026-11-22 09:00:00+03', true);
insert into core.team (department_id, code, name_en, name_ar)
values (test.department('commercial'), 'test_stp', 'Test Steps Desk', 'فريق الخطوات');
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.am1', test.person('Test Account Manager', 'member')::text, true);
update core.person set team_id = (select id from core.team where code = 'test_stp') where id = current_setting('t.am1')::uuid;
select test.as_person(current_setting('t.admin')::uuid);
select set_config('t.p26', api.plan_open(test.department('commercial'), 2026) ->> 'id', true);

select test.as_person(current_setting('t.am1')::uuid);
select set_config('t.t', api.task_create(jsonb_build_object('title', 'Made-up steps task', 'work_type', 'internal'))
  ->> 'id', true);
select test.eq((api.task(current_setting('t.t')::uuid) ->> 'action_items_total')::int, 0, 'a task starts with no steps');
select set_config('t.s1', api.action_item_add(current_setting('t.t')::uuid,
  jsonb_build_object('text', 'Made-up: call', 'due_on', '2026-11-23')) ->> 'id', true);
select set_config('t.s2', api.action_item_add(current_setting('t.t')::uuid, jsonb_build_object('text', 'Made-up: send'))
  ->> 'id', true);
select set_config('t.s3', api.action_item_add(current_setting('t.t')::uuid, jsonb_build_object('text', 'Made-up: file'))
  ->> 'id', true);
select set_config('v2.test_now', '2026-11-24 09:00:00+03', true);
select api.action_item_done(current_setting('t.s1')::uuid, true, '2026-11-23');
select api.action_item_done(current_setting('t.s2')::uuid, true);
select test.eq((api.task(current_setting('t.t')::uuid) ->> 'action_items_total')::int, 3, 'the row counts every step');
select test.eq((api.task(current_setting('t.t')::uuid) ->> 'open_action_items')::int, 1, 'and how many are open');
select test.eq((api.tasks(jsonb_build_object('scope', 'my_work')) #>> '{rows,0,action_items_total}')::int, 3,
  'the list carries the same count');
select test.eq((select a ->> 'done_on' from jsonb_array_elements(api.task(current_setting('t.t')::uuid) -> 'action_items') a
                where a ->> 'id' = current_setting('t.s1')), '2026-11-23', 'a done step keeps the day it was done');
select test.eq((select a ->> 'done_by' from jsonb_array_elements(api.task(current_setting('t.t')::uuid) -> 'action_items') a
                where a ->> 'id' = current_setting('t.s2')), current_setting('t.am1'), 'and who did it');

-- the achievement that came from the task shows the done steps, oldest first; never an open one
select set_config('t.a', api.achievement_log(jsonb_build_object('category', 'AWARD', 'title', 'Made-up steps result',
  'happened_on', '2026-11-23', 'source_task_id', current_setting('t.t'))) ->> 'id', true);
select test.eq((select string_agg(s ->> 'text', ' | ' order by o) from jsonb_array_elements(
  api.achievement(current_setting('t.a')::uuid) -> 'source_task_steps') with ordinality x(s, o)),
  'Made-up: call | Made-up: send', 'the achievement shows the steps done on its task, oldest first');
select test.eq(api.achievement(current_setting('t.a')::uuid) -> 'source_task_steps' -> 0 ->> 'done_on', '2026-11-23',
  'each with its day');
select test.eq(api.achievement(current_setting('t.a')::uuid) -> 'source_task_steps' -> 0 ->> 'done_by_name',
  'Test Account Manager', 'and who did it');
-- reopened: it leaves the evidence
select api.action_item_done(current_setting('t.s1')::uuid, false);
select test.eq(jsonb_array_length(api.achievement(current_setting('t.a')::uuid) -> 'source_task_steps'), 1,
  'a step reopened is no longer evidence');
