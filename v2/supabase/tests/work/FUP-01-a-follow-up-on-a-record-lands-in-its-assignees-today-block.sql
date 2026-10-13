-- FUP-01 — a follow-up on a record (V632 Stage 2): api.follow_up makes a task of the type Follow-up, due on its day,
-- for its assignee (me unless named), about a client, a task or an invoice; it shows in the assignee's Today block with
-- what it is about, and on the record's own list (api.follow_ups); a task's follow-up carries the task's client; its
-- title is the record's label unless one is given; a day gone by, no day, or an unknown kind of record is refused; one
-- Undo takes it back (V128). Every value is made up; days come from the database's own clock.
-- Sabotage: supabase/tests/sabotage/a-follow-up-forgets-its-record.sql.
select set_config('t.today', core.riyadh_today()::text, true);
select set_config('t.am', test.person('Test Follow Member', 'member')::text, true);
select set_config('t.am2', test.person('Test Follow Colleague', 'member')::text, true);
select set_config('t.head', test.person('Test Follow Head', 'admin')::text, true);
insert into core.team (department_id, code, name_en, name_ar)
values (test.department('commercial'), 'test_fup', 'Test Follow Desk', 'فريق المتابعة');
update core.person set team_id = (select id from core.team where code = 'test_fup')
where id in (current_setting('t.am')::uuid, current_setting('t.am2')::uuid, current_setting('t.head')::uuid);

select test.as_person(current_setting('t.am')::uuid);
select set_config('t.p', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Follow Co',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate', 'owner_id', current_setting('t.am')))))
  ->> 'id', true);

-- on a client, for me, due tomorrow
select set_config('t.f1', api.follow_up('partner', current_setting('t.p')::uuid, current_setting('t.today')::date + 1)::text, true);
select test.as_owner();
select test.eq((select jsonb_build_object('type', ty.key, 'owner', t.owner_id = current_setting('t.am')::uuid,
                                          'due', t.due_on, 'partner', t.partner_id = current_setting('t.p')::uuid,
                                          'about', t.about_table, 'title', t.title)
                from work.task t join work.task_type ty on ty.id = t.type_id
                where t.id = (current_setting('t.f1')::jsonb ->> 'id')::uuid),
  jsonb_build_object('type', 'follow_up', 'owner', true, 'due', current_setting('t.today')::date + 1, 'partner', true,
                     'about', 'partner.partner', 'title', 'Made Up Follow Co'),
  'a Follow-up task, mine, due tomorrow, that client''s work, about the client, titled by its name');
select test.as_person(current_setting('t.am')::uuid);
select test.eq((select jsonb_build_object('group', x ->> 'group', 'follow_up', x -> 'follow_up', 'about', x -> 'about')
                from jsonb_array_elements(api.my_day('me') -> 'tasks') x
                where x ->> 'id' = current_setting('t.f1')::jsonb ->> 'id'),
  jsonb_build_object('group', 'next', 'follow_up', true, 'about',
                     jsonb_build_object('entity', 'partner', 'id', current_setting('t.p'), 'label', 'Made Up Follow Co')),
  'it shows in my Today block with what it is about');

-- on a task, for a colleague, with its own title: it carries the task's client
select set_config('t.t', api.task_create(jsonb_build_object('title', 'Made-up proposal', 'work_type', 'client',
  'partner_id', current_setting('t.p'), 'due_on', current_setting('t.today'))) ->> 'id', true);
select test.as_person(current_setting('t.head')::uuid);
select set_config('t.f2', api.follow_up('task', current_setting('t.t')::uuid, current_setting('t.today')::date,
  current_setting('t.am2')::uuid, 'Made-up chase the answer')::text, true);
select test.as_person(current_setting('t.am2')::uuid);
select test.eq((select jsonb_build_object('title', x ->> 'title', 'group', x ->> 'group', 'client', x ->> 'client',
                                          'entity', x -> 'about' ->> 'entity')
                from jsonb_array_elements(api.my_day('me') -> 'tasks') x
                where x ->> 'id' = current_setting('t.f2')::jsonb ->> 'id'),
  '{"title": "Made-up chase the answer", "group": "today", "client": "Made Up Follow Co", "entity": "task"}'::jsonb,
  'a follow-up on a task, assigned to a colleague, lands in their Today block with the task''s client');

-- the record's own list
select test.as_person(current_setting('t.am')::uuid);
select test.eq((select jsonb_agg(x ->> 'title' order by x ->> 'title') from jsonb_array_elements(api.follow_ups('task', current_setting('t.t')::uuid)) x),
  '["Made-up chase the answer"]'::jsonb, 'the task lists its open follow-up');
select test.eq(jsonb_array_length(api.follow_ups('partner', current_setting('t.p')::uuid)), 1, 'and so does the client');

-- refused: a day gone by, no day, an unknown kind of record
select test.raises(format('select api.follow_up(%L, %L, %L)', 'partner', current_setting('t.p'), current_setting('t.today')::date - 1),
  'P0001', 'a day gone by is refused', 'follow_up.due_passed');
select test.raises(format('select api.follow_up(%L, %L, null)', 'partner', current_setting('t.p')),
  'P0001', 'a follow-up needs its day', 'follow_up.due_required');
select test.raises(format('select api.follow_up(%L, %L, %L)', 'contract', current_setting('t.p'), current_setting('t.today')),
  'P0001', 'only a client, a task or an invoice', 'follow_up.entity_invalid');

-- one Undo takes it back
select api.undo((current_setting('t.f1')::jsonb ->> 'request_id')::uuid);
select test.eq(jsonb_array_length(api.follow_ups('partner', current_setting('t.p')::uuid)), 0,
  'one Undo takes the follow-up back');
