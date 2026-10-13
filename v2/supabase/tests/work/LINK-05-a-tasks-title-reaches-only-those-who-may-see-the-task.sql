-- LINK-05 — a task's title reaches only those who may see the task (QA-553; D5). A head of another department may view
-- the client but not the task: the client's timeline gives them no event for it, their timeline count matches their
-- timeline, their Next step comes only from tasks they may see, and Related lists nothing of it — while the task's own
-- team sees all of it. Days come from the database's own clock (QA-554). Every value is made up.
-- Sabotage: supabase/tests/sabotage/a-tasks-event-reaches-everyone.sql.
select set_config('t.today', core.riyadh_today()::text, true);
insert into core.team (department_id, code, name_en, name_ar)
values (test.department('commercial'), 'test_seen', 'Test Seen Desk', 'فريق الرؤية');
select set_config('t.am', test.person('Test Seen Member', 'member')::text, true);
select set_config('t.far', test.person('Test Far Head', 'head', 'test_other_dept')::text, true);
update core.person set team_id = (select id from core.team where code = 'test_seen') where id = current_setting('t.am')::uuid;

select test.as_person(current_setting('t.am')::uuid);
select set_config('t.p', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Seen Co',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate', 'owner_id', current_setting('t.am')))))
  ->> 'id', true);
select set_config('t.t', api.task_create(jsonb_build_object('title', 'Made-up private renewal terms', 'work_type', 'client',
  'partner_id', current_setting('t.p'), 'due_on', (current_setting('t.today')::date + 3)::text)) ->> 'id', true);
select test.eq((select count(*)::int from jsonb_array_elements(api.notes('partner', current_setting('t.p')::uuid)) n
                where n -> 'event' -> 'values' ->> 'task_id' = current_setting('t.t')), 1, 'the task''s team sees its event');

select test.as_owner();
select test.eq(work.row_level('work.task', current_setting('t.t')::uuid, current_setting('t.far')::uuid), 'none'::core.level,
  'the far head may not see the task');
select test.ok(partner.level_of(current_setting('t.far')::uuid, current_setting('t.p')::uuid) >= 'view',
  'and may view the client');

select test.as_person(current_setting('t.far')::uuid);
select set_config('t.card', api.partner(current_setting('t.p')::uuid)::text, true);
select test.eq((select count(*)::int from jsonb_array_elements(api.notes('partner', current_setting('t.p')::uuid)) n
                where n ->> 'event' is not null), 0, 'the client''s timeline gives them no event for it');
select test.eq((current_setting('t.card')::jsonb -> 'counts' ->> 'notes')::int,
               jsonb_array_length(api.notes('partner', current_setting('t.p')::uuid)),
  'their timeline count matches their timeline');
select test.eq(current_setting('t.card')::jsonb -> 'next_step', 'null'::jsonb, 'their Next step holds nothing of it');
select test.eq(current_setting('t.card')::jsonb -> 'tasks', '[]'::jsonb, 'and Related lists nothing of it');
