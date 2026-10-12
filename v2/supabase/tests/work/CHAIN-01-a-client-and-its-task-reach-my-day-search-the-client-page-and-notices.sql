-- CHAIN-01 — the links between modules in one chain (sweep 12 Oct, D3–D5). A Commercial member creates a client, then a
-- task on it due today for themselves: (a) My day returns it under Today; (b) search finds the task and the client;
-- (c) the client's timeline has the task's event, Related lists it, Last activity is today and Next step is its due day;
-- (d) when their manager gives them a second task on the client, they have exactly one notification for it — the one
-- who acts is never told of their own change (P3-6), so their own task told nobody; (e) the organisation's Finance
-- months still read without error. Every value is made up.
select set_config('v2.test_now', '2026-10-12 09:00:00+03', true);
insert into core.team (department_id, code, name_en, name_ar)
values (test.department('commercial'), 'test_chain', 'Test Chain Desk', 'فريق السلسلة');
select set_config('t.am', test.person('Test Chain Member', 'member')::text, true);
select set_config('t.mgr', test.person('Test Chain Manager', 'manager')::text, true);
select set_config('t.head', test.person('Test Chain Finance Head', 'head')::text, true);
update core.person set team_id = (select id from core.team where code = 'test_chain')
where id in (current_setting('t.am')::uuid, current_setting('t.mgr')::uuid);

select test.as_person(current_setting('t.am')::uuid);
select set_config('t.p', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Chain Traders',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate', 'owner_id', current_setting('t.am')))))
  ->> 'id', true);
select set_config('t.t', api.task_create(jsonb_build_object('title', 'Made-up chain follow-up', 'work_type', 'client',
  'partner_id', current_setting('t.p'), 'due_on', '2026-10-12')) ->> 'id', true);

-- (a) My day
select test.eq((select jsonb_build_object('group', x ->> 'group', 'partner', x ->> 'partner_name')
                from jsonb_array_elements(api.my_day('me') -> 'tasks') x where x ->> 'id' = current_setting('t.t')),
  '{"group": "today", "partner": "Made Up Chain Traders"}'::jsonb, '(a) My day returns the task under Today');

-- (b) search
select test.eq((select count(*)::int from jsonb_array_elements(api.search('chain follow') -> 'tasks') x
                where x ->> 'id' = current_setting('t.t')), 1, '(b) search finds the task');
select test.eq((select count(*)::int from jsonb_array_elements(api.search('chain traders') -> 'partners') x
                where x ->> 'id' = current_setting('t.p')), 1, '(b) and the client');

-- (c) the client's page
select set_config('t.card', api.partner(current_setting('t.p')::uuid)::text, true);
select test.eq((select count(*)::int from jsonb_array_elements(api.notes('partner', current_setting('t.p')::uuid)) n
                where n ->> 'body' like 'Task % added: Made-up chain follow-up'), 1,
  '(c) the client''s timeline has the task''s event');
select test.eq((select count(*)::int from jsonb_array_elements(current_setting('t.card')::jsonb -> 'tasks') x
                where x ->> 'id' = current_setting('t.t')), 1, '(c) Related lists the task');
select test.eq(current_setting('t.card')::jsonb ->> 'last_activity_on', '2026-10-12', '(c) Last activity is today');
select test.eq(jsonb_build_object('task', current_setting('t.card')::jsonb -> 'next_step' ->> 'task_id',
                                  'on', current_setting('t.card')::jsonb -> 'next_step' ->> 'on'),
  jsonb_build_object('task', current_setting('t.t'), 'on', '2026-10-12'), '(c) Next step is the task''s due day');

-- (d) notifications
select test.as_owner();
select test.eq((select count(*)::int from notify.notification where person_id = current_setting('t.am')::uuid), 0,
  '(d) a task a person makes for themselves tells nobody');
select test.as_person(current_setting('t.mgr')::uuid);
select set_config('t.t2', api.task_create(jsonb_build_object('title', 'Made-up chain call back', 'work_type', 'client',
  'partner_id', current_setting('t.p'), 'due_on', '2026-10-14', 'owner_id', current_setting('t.am'))) ->> 'id', true);
select test.as_owner();
select test.eq((select count(*)::int from notify.notification
                where person_id = current_setting('t.am')::uuid and entity_id = current_setting('t.t2')::uuid),
  1, '(d) the assignee has one notification for the task given to them on the client');

-- (e) the organisation's Finance months
select test.as_person(current_setting('t.head')::uuid);
select test.eq(api.finance_partner_months(current_setting('t.p')::uuid), '[]'::jsonb,
  '(e) the organisation''s Finance months read, empty, without error');
