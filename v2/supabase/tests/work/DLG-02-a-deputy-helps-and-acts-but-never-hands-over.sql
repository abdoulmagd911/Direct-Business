-- DLG-02 — Landing 33 (B3): a task has one Responsible and may have one deputy. The deputy has the task under
-- Helping and may ACT — move its status, mark it done, tick its steps — but never hands it over and never edits it.
-- The helpers list never drops the deputy. A hand-over respects access: the new Responsible must see the partner the
-- task belongs to. A manager neither hands over nor takes a team member's task (O-3). Every value is made up.
-- Sabotages: a-deputy-hands-the-task-over, a-deputy-may-not-act, a-helper-acts-like-a-deputy,
-- a-task-goes-to-someone-who-cannot-see-its-partner, a-task-has-two-deputies, the-helpers-list-drops-the-deputy.
select set_config('v2.test_now', '2026-11-22 09:00:00+03', true);
insert into core.team (department_id, code, name_en, name_ar)
values (test.department('commercial'), 'test_dlg2', 'Test Deputy Desk', 'فريق النائب');
select set_config('t.mgr', test.person('Test Manager', 'manager')::text, true);
select set_config('t.am1', test.person('Test Account Manager', 'member')::text, true);
select set_config('t.am2', test.person('Test Second Member', 'member')::text, true);
select set_config('t.am3', test.person('Test Third Member', 'member')::text, true);
select set_config('t.nop', test.person('Test No Partners', 'member')::text, true);
update core.person set team_id = (select id from core.team where code = 'test_dlg2')
where id in (current_setting('t.mgr')::uuid, current_setting('t.am1')::uuid, current_setting('t.am2')::uuid,
             current_setting('t.am3')::uuid, current_setting('t.nop')::uuid);
insert into core.person_page_level (person_id, page_key, level, reason)
values (current_setting('t.nop')::uuid, 'clients', 'none', 'made up: no partners');

select test.as_person(current_setting('t.am1')::uuid);
select set_config('t.t', api.task_create(jsonb_build_object('title', 'Made-up deputy task', 'work_type', 'internal',
  'due_on', '2026-11-24')) ->> 'id', true);
select set_config('t.s', api.action_item_add(current_setting('t.t')::uuid, jsonb_build_object('text', 'Made-up: step one'))
  ->> 'id', true);

-- a plain helper does not act
select api.task_helpers_set(current_setting('t.t')::uuid, array[current_setting('t.am3')::uuid]);
select test.as_person(current_setting('t.am3')::uuid);
select test.eq((api.task(current_setting('t.t')::uuid) ->> 'can_act')::boolean, false, 'a helper is not offered the status');
select test.raises(format('select api.task_status_set(%L, %L)', current_setting('t.t'), 'in_progress'), '42501',
  'a helper who is not the deputy moves no status', 'access.needs_level');

-- the Responsible names a deputy
select test.as_person(current_setting('t.am1')::uuid);
select test.raises(format('select api.task_deputy_set(%L, %L)', current_setting('t.t'), current_setting('t.am1')), 'P0001',
  'the Responsible is not their own deputy', 'task.deputy_is_responsible');
select set_config('t.d', api.task_deputy_set(current_setting('t.t')::uuid, current_setting('t.am2')::uuid)::text, true);
select test.eq(api.task(current_setting('t.t')::uuid) ->> 'deputy_id', current_setting('t.am2'), 'the task names its deputy');
select test.as_owner();
select test.eq((select count(*)::int from notify.notification where person_id = current_setting('t.am2')::uuid
                and entity_id = current_setting('t.t')::uuid
                and request_id = (current_setting('t.d')::jsonb ->> 'request_id')::uuid), 1, 'the deputy is told');

-- the deputy has it under Helping, and may act
select test.as_person(current_setting('t.am2')::uuid);
select test.eq(api.tasks(jsonb_build_object('scope', 'helping')) #>> '{rows,0,title}', 'Made-up deputy task',
  'the task is under the deputy''s Helping');
select test.eq((api.task(current_setting('t.t')::uuid) ->> 'can_act')::boolean, true, 'the deputy may act');
select test.eq((api.task(current_setting('t.t')::uuid) ->> 'can_edit')::boolean, false, 'but not edit');
select test.eq((api.task(current_setting('t.t')::uuid) ->> 'can_hand_over')::boolean, false, 'nor hand over');
select test.runs(format('select api.task_status_set(%L, %L)', current_setting('t.t'), 'in_progress'),
  'the deputy moves the status');
select test.runs(format('select api.action_item_done(%L, true)', current_setting('t.s')), 'the deputy ticks a step');
select test.raises(format('select api.task_delegate(%L, %L, %L)', current_setting('t.t'), current_setting('t.am3'), 'Made up'),
  '42501', 'the deputy hands nothing over', 'access.needs_level');
select test.raises(format('select api.tasks_assign(array[%L]::uuid[], %L, %L)', current_setting('t.t'),
  current_setting('t.am3'), 'Made up'), '42501', 'nor by the other door', 'task.hand_over_not_yours');
select test.raises(format('select api.task_update(%L, %L::jsonb, 1)', current_setting('t.t'), '{"title": "Made up"}'),
  '42501', 'the deputy does not edit the task', 'access.needs_level');
select test.runs(format('select api.task_status_set(%L, %L)', current_setting('t.t'), 'done'), 'the deputy marks it done');
select test.as_owner();
select test.eq((select owner_id from work.task where id = current_setting('t.t')::uuid)::text, current_setting('t.am1'),
  'the Responsible still owns the outcome');

-- the helpers list never drops the deputy; a second deputy replaces the first
select test.as_person(current_setting('t.am1')::uuid);
select api.task_status_set(current_setting('t.t')::uuid, 'in_progress');
select api.task_helpers_set(current_setting('t.t')::uuid, array[]::uuid[]);
select test.eq(api.task(current_setting('t.t')::uuid) ->> 'deputy_id', current_setting('t.am2'),
  'emptying the helpers list keeps the deputy');
select api.task_deputy_set(current_setting('t.t')::uuid, current_setting('t.am3')::uuid);
select test.as_owner();
select test.eq((select count(*)::int from work.task_helper where task_id = current_setting('t.t')::uuid
                and is_deputy and deleted_at is null), 1, 'a task has one deputy');
select test.as_person(current_setting('t.am2')::uuid);
select test.raises(format('select api.task_status_set(%L, %L)', current_setting('t.t'), 'done'), '42501',
  'the former deputy no longer acts', 'access.needs_level');

-- handing the task to the deputy makes them the Responsible, and the deputy seat is empty
select test.as_person(current_setting('t.am1')::uuid);
select api.task_delegate(current_setting('t.t')::uuid, current_setting('t.am3')::uuid, 'Made-up: yours now');
select test.as_person(current_setting('t.am3')::uuid);
select test.eq(api.task(current_setting('t.t')::uuid) ->> 'deputy_id', null, 'the new Responsible is not also the deputy');
select test.eq((api.task(current_setting('t.t')::uuid) ->> 'can_hand_over')::boolean, true, 'and may hand it over');
select api.task_deputy_set(current_setting('t.t')::uuid, current_setting('t.am2')::uuid);
select api.task_deputy_set(current_setting('t.t')::uuid, null);
select test.eq(api.task(current_setting('t.t')::uuid) ->> 'deputy_id', null, 'the deputy can be cleared');

-- access: a task of a partner goes only to someone who can see that partner
select test.as_person(current_setting('t.am1')::uuid);
select set_config('t.p', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Deputy Traders',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate', 'owner_id', current_setting('t.am1')))))
  ->> 'id', true);
select set_config('t.t2', api.task_create(jsonb_build_object('title', 'Made-up partner task', 'work_type', 'client',
  'partner_id', current_setting('t.p'))) ->> 'id', true);
select test.raises(format('select api.task_delegate(%L, %L, %L)', current_setting('t.t2'), current_setting('t.nop'), 'Made up'),
  'P0001', 'someone who cannot see the partner is not given its task', 'task.owner_cannot_see_partner');
select test.as_owner();
select test.eq((select owner_id from work.task where id = current_setting('t.t2')::uuid)::text, current_setting('t.am1'),
  'and the task has not moved');

-- O-3: the manager hands over nothing of a member's
select test.as_person(current_setting('t.mgr')::uuid);
select test.raises(format('select api.tasks_assign(array[%L]::uuid[], %L, %L)', current_setting('t.t2'),
  current_setting('t.am2'), 'Made up'), '42501', 'a manager does not hand over a team member''s task',
  'task.hand_over_not_yours');
select test.raises(format('select api.tasks_assign(array[%L]::uuid[], %L, %L)', current_setting('t.t2'),
  current_setting('t.mgr'), 'Made up'), '42501', 'nor takes it for themselves', 'task.hand_over_not_yours');
