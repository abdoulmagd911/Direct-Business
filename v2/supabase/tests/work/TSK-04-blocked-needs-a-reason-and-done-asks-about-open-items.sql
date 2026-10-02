-- TSK-04 — status moves (V401, V400). Blocked is In progress with a required reason, and only In progress blocks; Done
-- with open action items asks first, then closes them on the same day; each move is in the history with the day it
-- happened; a closed task records who closed it, and reopening clears it; a move dated before the task was raised is
-- refused. Every value is made up.
-- Sabotages: supabase/tests/sabotage/blocked-forgets-its-reason.sql, done-leaves-items-open.sql.
insert into core.team (department_id, code, name_en, name_ar)
values (test.department('commercial'), 'test_desk', 'Test Desk', 'فريق الاختبار');
select set_config('t.own', test.person('Test Owner', 'member')::text, true);
update core.person set team_id = (select id from core.team where code = 'test_desk') where id = current_setting('t.own')::uuid;

select test.as_person(current_setting('t.own')::uuid);
select set_config('t.t', api.task_create(jsonb_build_object('title', 'Made-up launch', 'happened_on',
  core.riyadh_today() - 5)) ->> 'id', true);
select api.action_item_add(current_setting('t.t')::uuid, jsonb_build_object('text', 'Made-up: first',
  'happened_on', core.riyadh_today() - 5));
select api.action_item_add(current_setting('t.t')::uuid, jsonb_build_object('text', 'Made-up: second',
  'happened_on', core.riyadh_today() - 5));

select test.raises(format('select api.task_status_set(%L, %L, null, %L)', current_setting('t.t'), 'not_started',
  'Made-up: waiting'), 'P0001', 'only In progress blocks', 'task.only_in_progress_blocks');
select test.raises(format('select api.task_status_set(%L, %L, %L)', current_setting('t.t'), 'in_progress',
  core.riyadh_today() - 6), 'P0001', 'nothing moves before the task was raised', 'task.status_before_raised');
select test.runs(format('select api.task_status_set(%L, %L, %L)', current_setting('t.t'), 'in_progress',
  core.riyadh_today() - 3), 'it starts, three days ago');
select test.runs(format('select api.task_status_set(%L, %L, null, %L)', current_setting('t.t'), 'in_progress',
  'Made-up: waiting on the client'), 'blocked with its reason');
select test.eq(api.task(current_setting('t.t')::uuid) ->> 'blocked_reason', 'Made-up: waiting on the client',
  'the reason shows');
select test.eq((api.task(current_setting('t.t')::uuid) ->> 'blocked')::boolean, true, 'as Blocked');
select test.eq(api.task(current_setting('t.t')::uuid) ->> 'meaning', 'in_progress', 'inside In progress');
select test.runs(format('select api.task_status_set(%L, %L)', current_setting('t.t'), 'in_progress'), 'work resumes');
select test.eq(api.task(current_setting('t.t')::uuid) ->> 'blocked_reason', null, 'and the block clears');

select test.raises(format('select api.task_status_set(%L, %L)', current_setting('t.t'), 'done'), 'P0001',
  'Done with open items asks first', 'task.open_action_items');
select test.eq((api.task_status_set(current_setting('t.t')::uuid, 'done', core.riyadh_today() - 1, null, true)
  ->> 'items_closed')::int, 2, 'then closes them too');
select test.as_owner();
select test.eq((select count(*)::int from work.action_item where task_id = current_setting('t.t')::uuid
                and done_on = core.riyadh_today() - 1), 2, 'on the day the task was done');
select test.eq((select closed_by from work.task where id = current_setting('t.t')::uuid), current_setting('t.own')::uuid,
  'who closed it is kept');
select test.eq((select array_agg(happened_on order by happened_on) from work.task_status_change
                where task_id = current_setting('t.t')::uuid),
  array[core.riyadh_today() - 3, core.riyadh_today() - 1, core.riyadh_today(), core.riyadh_today()]::date[],
  'every move is in the history with its day');
select test.as_person(current_setting('t.own')::uuid);
select test.runs(format('select api.task_status_set(%L, %L)', current_setting('t.t'), 'in_progress'), 'reopened');
select test.as_owner();
select test.eq((select closed_at from work.task where id = current_setting('t.t')::uuid), null::timestamptz,
  'reopening clears the close');
