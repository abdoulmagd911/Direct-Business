-- TPL-05 — a recurring template is open work (QA-523; V452, V463). A person who owns a live template is counted as
-- holding it, and is not switched off unless the same request hands it to a named person; the hand-over passes the
-- template with the rest, and Undo gives it back. An ended or switched-off template holds nobody. Every value is made up.
-- Sabotage: supabase/tests/sabotage/a-template-owner-leaves-holding-it.sql.
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.p', test.person('Test Owner', 'member')::text, true);
select set_config('t.q', test.person('Test Successor', 'member')::text, true);

select test.as_person(current_setting('t.admin')::uuid);
select set_config('t.k', api.task_template_save(null, jsonb_build_object('title', 'Made-up daily', 'work_type', 'internal',
  'owner_id', current_setting('t.p'), 'starts_on', core.riyadh_today(), 'rule', jsonb_build_object('freq', 'daily'))) ->> 'id', true);
select api.task_template_save(null, jsonb_build_object('title', 'Made-up ended', 'work_type', 'internal',
  'owner_id', current_setting('t.q'), 'starts_on', core.riyadh_today() - 30, 'ends_on', core.riyadh_today() - 1,
  'rule', jsonb_build_object('freq', 'daily')));

select test.eq((api.person_open_work(current_setting('t.p')::uuid) ->> 'templates')::int, 1,
  'a live template its owner holds is open work');
select test.eq((api.person_open_work(current_setting('t.q')::uuid) ->> 'templates')::int, 0,
  'an ended template holds nobody');
select test.raises(format('select api.person_switch(%L, false, %L)', current_setting('t.p'), 'made up: leaving'),
  'P0001', 'its owner is not switched off holding it', 'person.open_work');

select set_config('t.r', api.person_switch(current_setting('t.p')::uuid, false, 'made up: leaving', current_setting('t.q')::uuid)::text, true);
select test.eq((current_setting('t.r')::jsonb -> 'handed_over' ->> 'templates')::int, 1, 'the hand-over passes the template');
select test.as_owner();
select test.eq((select owner_id from work.task_template where id = current_setting('t.k')::uuid), current_setting('t.q')::uuid,
  'to the named person');
select set_config('t.req', current_setting('t.r')::jsonb ->> 'request_id', true);
select set_config('t.tk', core.auth_ticket_issue('undo', current_setting('t.req'), current_setting('t.admin')::uuid)::text, true);
select test.as_person(current_setting('t.admin')::uuid);
select api.undo_ticketed(current_setting('t.req')::uuid, current_setting('t.tk')::uuid);
select test.as_owner();
select test.eq((select owner_id from work.task_template where id = current_setting('t.k')::uuid), current_setting('t.p')::uuid,
  'and Undo gives it back');
