-- LOAD-01 — the team load (V91, V491): per person in the reader's departments — open tasks, overdue, open action items,
-- organisations owned (the Client side) and prospects assigned (a side of theirs at Prospect). Done, cancelled and past work are not load; a person
-- of another department is not listed; one who cannot be named (switched off) is not either. Every value is made up.
-- Sabotages: supabase/tests/sabotage/past-work-is-load.sql, a-done-task-is-load.sql.
insert into core.team (department_id, code, name_en, name_ar)
values (test.department('commercial'), 'test_desk', 'Test Desk', 'فريق الاختبار');
insert into core.department (code, name_en, name_ar) values ('test_ops', 'Test Operations', 'عمليات الاختبار');
select set_config('t.mgr', test.person('Test Manager', 'manager')::text, true);
select set_config('t.am1', test.person('Test Account Manager', 'member')::text, true);
select set_config('t.off', test.person('Test Switched Off', 'member')::text, true);
select set_config('t.ops', test.person('Test Ops Person', 'member', 'test_ops')::text, true);
update core.person set team_id = (select id from core.team where code = 'test_desk')
where id in (current_setting('t.mgr')::uuid, current_setting('t.am1')::uuid, current_setting('t.off')::uuid);

select test.as_person(current_setting('t.mgr')::uuid);
select set_config('t.p', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Owned Co',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate',
                                                'owner_id', current_setting('t.am1'))))) ->> 'id', true);
select set_config('t.q', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Prospect Co',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate')))) ->> 'id', true);
select api.partner_bulk_assign(array[current_setting('t.q')::uuid], 'client', current_setting('t.am1')::uuid, null);
select set_config('t.t1', api.task_create(jsonb_build_object('title', 'Made-up open', 'owner_id', current_setting('t.am1'),
  'work_type', 'internal', 'due_on', core.riyadh_today() + 3)) ->> 'id', true);
select set_config('t.t2', api.task_create(jsonb_build_object('title', 'Made-up overdue', 'owner_id', current_setting('t.am1'),
  'work_type', 'internal', 'happened_on', core.riyadh_today() - 9, 'due_on', core.riyadh_today() - 2)) ->> 'id', true);
select set_config('t.t3', api.task_create(jsonb_build_object('title', 'Made-up done', 'owner_id', current_setting('t.am1'),
  'work_type', 'internal')) ->> 'id', true);
select api.task_status_set(current_setting('t.t3')::uuid, 'done');
select api.action_item_add(current_setting('t.t1')::uuid, jsonb_build_object('text', 'Made-up item',
  'owner_id', current_setting('t.am1')));
select api.action_item_add(current_setting('t.t2')::uuid, jsonb_build_object('text', 'Made-up item two',
  'owner_id', current_setting('t.am1')));
-- past work: a task dated before go-live is not load
select test.as_owner();
insert into core.setting (key, value, valid_from, reason, created_by)
values ('app.go_live_on', to_jsonb((core.riyadh_today() - 15)::text), core.riyadh_today() - 15, 'made up: go-live',
        current_setting('t.mgr')::uuid);
select test.as_person(current_setting('t.mgr')::uuid);
select api.task_create(jsonb_build_object('title', 'Made-up past', 'owner_id', current_setting('t.am1'),
  'work_type', 'internal', 'happened_on', core.riyadh_today() - 30, 'due_on', core.riyadh_today() - 20));
select test.as_owner();
update core.person set active = false where id = current_setting('t.off')::uuid;

select test.as_person(current_setting('t.mgr')::uuid);
select test.eq((select l - array['person_id', 'full_name_en', 'full_name_ar'] from jsonb_array_elements(api.team_load()) l
                where l ->> 'person_id' = current_setting('t.am1')),
  '{"open_tasks": 2, "overdue": 1, "open_action_items": 2, "partners_owned": 2, "prospects_assigned": 1}'::jsonb,
  'two open, one overdue, two items, two organisations, one a prospect; done and past work are not load');
select test.eq((select array_agg(l ->> 'person_id' order by l ->> 'person_id') from jsonb_array_elements(api.team_load()) l),
  (select array_agg(x order by x) from unnest(array[current_setting('t.mgr'), current_setting('t.am1')]) x),
  'the people of my department who can be named — not another department''s, not one switched off');
select test.eq(jsonb_array_length(api.team_load(array[current_setting('t.am1')::uuid])), 1, 'or just the people asked for');
