-- LINK-03 — a task on a client shows on the client's page (sweep 12 Oct, D5). Adding it writes an event on the
-- client's timeline — a type and its values, worded by the screen — Related lists it, Last activity is its day and Next
-- step is its due day; the timeline's count is the timeline's own rows (one read); marking it done writes a second
-- event; one Undo of the adding takes the task and its event back. Days come from the database's own clock, so it holds
-- on any day (QA-554). Every value is made up.
-- Sabotage: supabase/tests/sabotage/a-task-leaves-no-mark-on-its-client.sql.
select set_config('t.today', core.riyadh_today()::text, true);
insert into core.team (department_id, code, name_en, name_ar)
values (test.department('commercial'), 'test_link', 'Test Link Desk', 'فريق الربط');
select set_config('t.am', test.person('Test Link Member', 'member')::text, true);
update core.person set team_id = (select id from core.team where code = 'test_link') where id = current_setting('t.am')::uuid;

select test.as_person(current_setting('t.am')::uuid);
select set_config('t.p', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Linked Co',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate', 'owner_id', current_setting('t.am')))))
  ->> 'id', true);
select test.eq(api.partner(current_setting('t.p')::uuid) -> 'last_activity_on', 'null'::jsonb, 'nothing yet: not measured');
select set_config('t.made', api.task_create(jsonb_build_object('title', 'Made-up site visit', 'work_type', 'client',
  'partner_id', current_setting('t.p'), 'due_on', (current_setting('t.today')::date + 2)::text))::text, true);
select set_config('t.t', current_setting('t.made')::jsonb ->> 'id', true);
select set_config('t.card', api.partner(current_setting('t.p')::uuid)::text, true);

select test.eq((select jsonb_agg(n -> 'event') from jsonb_array_elements(api.notes('partner', current_setting('t.p')::uuid)) n),
  jsonb_build_array(jsonb_build_object('type', 'task_added', 'values', jsonb_build_object('task_id', current_setting('t.t'),
    'number', current_setting('t.made')::jsonb ->> 'number', 'title', 'Made-up site visit'))),
  'adding it writes an event on the client''s timeline: its type and values');
select test.eq((current_setting('t.card')::jsonb -> 'counts' ->> 'notes')::int,
               jsonb_array_length(api.notes('partner', current_setting('t.p')::uuid)),
  'the timeline''s count is its own rows: one read');
select test.eq((select x ->> 'title' from jsonb_array_elements(current_setting('t.card')::jsonb -> 'tasks') x),
  'Made-up site visit', 'Related lists it');
select test.eq(current_setting('t.card')::jsonb ->> 'last_activity_on', current_setting('t.today'), 'Last activity is its day');
select test.eq(current_setting('t.card')::jsonb -> 'next_step',
  jsonb_build_object('note_id', null, 'task_id', current_setting('t.t'), 'text', 'Made-up site visit',
                     'on', (current_setting('t.today')::date + 2)::text),
  'Next step is its due day');

-- done writes a second event
select api.task_status_set(current_setting('t.t')::uuid, 'done');
select test.eq((select jsonb_agg(n -> 'event' ->> 'type' order by n -> 'event' ->> 'type')
                from jsonb_array_elements(api.notes('partner', current_setting('t.p')::uuid)) n),
  '["task_added", "task_done"]'::jsonb, 'marking it done writes a second event');
select test.eq(api.partner(current_setting('t.p')::uuid) -> 'next_step', 'null'::jsonb, 'a done task is no next step');

-- one Undo of the adding takes the task and its event back
select set_config('t.made2', api.task_create(jsonb_build_object('title', 'Made-up phone round', 'work_type', 'client',
  'partner_id', current_setting('t.p'), 'due_on', (current_setting('t.today')::date + 1)::text))::text, true);
select api.undo((current_setting('t.made2')::jsonb ->> 'request_id')::uuid);
select test.eq((select count(*)::int from jsonb_array_elements(api.notes('partner', current_setting('t.p')::uuid)) n
                where n -> 'event' -> 'values' ->> 'title' = 'Made-up phone round'), 0,
  'one Undo takes the task''s event back with it');
