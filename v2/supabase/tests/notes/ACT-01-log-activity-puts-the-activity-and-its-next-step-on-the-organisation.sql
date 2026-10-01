-- ACT-01 — Log activity (V401, V406, V150): whoever may add to an organisation logs a call, a meeting, a demo, a visit
-- or a note — its outcome from that type's own list (required where the type has one), the day it happened (never a
-- later one — V400), an optional line and an optional next step with its day (never before the activity); "demo set"
-- needs the demo's day, "meeting set" and "demo held" tell the screen what to offer; an activity dated in the past
-- tells nobody; its author changes its outcome, to one of its own type only; a viewer, a person who sees neither side
-- and an archived organisation log nothing. Every value is made up.
-- Sabotages: supabase/tests/sabotage/an-outcome-of-another-type.sql, supabase/tests/sabotage/anyone-logs-an-activity.sql,
--            supabase/tests/sabotage/nothing-is-ever-late.sql.
select set_config('t.head', test.person('Test Head', 'head')::text, true);
select set_config('t.am1', test.person('Test Account Manager', 'member')::text, true);
select set_config('t.am2', test.person('Test Second Member', 'member')::text, true);
select set_config('t.viewer', test.person('Test Viewer', 'viewer')::text, true);
select set_config('t.outsider', test.person('Test Outsider', 'member')::text, true);
insert into core.person_page_level (person_id, page_key, level, reason)
values (current_setting('t.outsider')::uuid, 'clients', 'none', 'made up: no clients');

select test.as_person(current_setting('t.head')::uuid);
select set_config('t.p', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Prospect Co',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate',
                                                'owner_id', current_setting('t.am1'))))) ->> 'id', true);
select set_config('t.q', api.partner_create('{"trade_name_en": "Made Up Archived Co",
  "sides": [{"side": "client", "type": "corporate"}]}') ->> 'id', true);

select test.as_person(current_setting('t.am1')::uuid);
select set_config('t.a', api.activity_log(current_setting('t.p')::uuid, 'call', 'no_answer')::text, true);
select test.eq(current_setting('t.a')::jsonb ->> 'outcome', 'no_answer', 'a call is logged with its outcome');
select test.eq((api.notes('partner', current_setting('t.p')::uuid) -> 0) - array['id', 'logged_at', 'author_id', 'version',
  'mentions', 'mine', 'edited_at', 'next_step_task_id', 'type_ar', 'outcome_ar', 'type_en', 'outcome_en'],
  jsonb_build_object('kind', 'activity', 'body', null, 'happened_on', core.riyadh_today(), 'logged_late', false,
                     'type', 'call', 'outcome', 'no_answer', 'meaning', null, 'next_step', null, 'next_step_on', null,
                     'from_notes', '[]'::jsonb),
  'it lands on the organisation''s timeline, today, not late');
select test.raises(format('select api.activity_log(%L, %L, %L)', current_setting('t.p'), 'call', 'demo_held'), 'P0002',
  'an outcome of another type is refused — "demo held" is a demo''s', 'partner.unknown_outcome');
select test.raises(format('select api.activity_log(%L, %L)', current_setting('t.p'), 'call'), 'P0001',
  'a call needs its outcome', 'partner.outcome_required');
select test.ok((api.activity_log(current_setting('t.p')::uuid, 'note', null, null, 'Made-up line: asked for rates')
                ->> 'id') is not null, 'a note has no outcomes, so needs none');
select test.raises(format('select api.activity_log(%L, %L, %L)', current_setting('t.p'), 'carrier_pigeon', 'answered'),
  'P0002', 'an unknown type is refused', 'partner.unknown_activity_type');

select test.raises(format('select api.activity_log(%L, %L, %L)', current_setting('t.p'), 'call', 'demo_set'), 'P0001',
  '"demo set" needs the demo''s day', 'partner.demo_day_required');
select set_config('t.d', api.activity_log(current_setting('t.p')::uuid, 'call', 'demo_set', null, null, null,
  core.riyadh_today() + 5)::text, true);
select test.eq(current_setting('t.d')::jsonb ->> 'demo_on', (core.riyadh_today() + 5)::text, 'with it, the demo''s day');
select test.eq((current_setting('t.d')::jsonb ->> 'counts_as_demo')::boolean, true, 'and it counts as a demo');
select test.eq((api.activity_log(current_setting('t.p')::uuid, 'call', 'meeting_set') ->> 'offer_task')::boolean, true,
  '"meeting set" offers a task');
select test.eq((api.activity_log(current_setting('t.p')::uuid, 'demo', 'demo_held') ->> 'offer_close_demo_task')::boolean,
  true, '"demo held" offers to close the demo task');

select test.raises(format('select api.activity_log(%L, %L, %L, %L)', current_setting('t.p'), 'call', 'answered',
  core.riyadh_today() + 1), 'P0001', 'an activity never happens after the day it is logged', 'common.date_in_future');
select test.raises(format('select api.activity_log(%L, %L, %L, %L, null, %L, %L)', current_setting('t.p'), 'visit',
  'visit_done', core.riyadh_today() - 3, 'Made-up follow-up', core.riyadh_today() - 4), 'P0001',
  'its next step never comes before it', 'note.next_step_before_it');
select test.raises(format('select api.activity_log(%L, %L, %L, null, null, %L)', current_setting('t.p'), 'visit',
  'visit_done', 'Made-up follow-up'), 'P0001', 'a next step has its day', 'note.next_step_day_required');
select set_config('t.v', api.activity_log(current_setting('t.p')::uuid, 'visit', 'visit_done', core.riyadh_today() - 3,
  'Made-up visit', 'Made-up: send the rate sheet', core.riyadh_today() + 2, array[current_setting('t.am2')::uuid])::text, true);
select test.as_owner();
select test.eq((select count(*)::int from notify.notification
                where request_id = (current_setting('t.v')::jsonb ->> 'request_id')::uuid), 0,
  'an activity dated in the past tells nobody, not even the person it mentions (V400)');
select test.eq((select jsonb_build_object('happened_on', happened_on, 'next_step', next_step, 'next_step_on', next_step_on)
                from core.note where id = (current_setting('t.v')::jsonb ->> 'id')::uuid),
  jsonb_build_object('happened_on', core.riyadh_today() - 3, 'next_step', 'Made-up: send the rate sheet',
                     'next_step_on', core.riyadh_today() + 2), 'it keeps its day and its next step');

select test.as_person(current_setting('t.am2')::uuid);
select test.raises(format('select api.note_edit(%L, %L, 1)', current_setting('t.a')::jsonb ->> 'id', '{"outcome": "answered"}'),
  '42501', 'only its author changes an activity', 'note.not_yours');
select test.as_person(current_setting('t.am1')::uuid);
select api.note_edit((current_setting('t.a')::jsonb ->> 'id')::uuid, '{"outcome": "answered"}', 1);
select test.eq((select n ->> 'outcome' from jsonb_array_elements(api.notes('partner', current_setting('t.p')::uuid)) n
                where n ->> 'id' = current_setting('t.a')::jsonb ->> 'id'), 'answered', 'its author changes its outcome');
select test.raises(format('select api.note_edit(%L, %L, 2)', current_setting('t.a')::jsonb ->> 'id', '{"outcome": "demo_held"}'),
  'P0002', 'to one of its own type only', 'partner.unknown_outcome');

select test.as_person(current_setting('t.viewer')::uuid);
select test.raises(format('select api.activity_log(%L, %L, %L)', current_setting('t.p'), 'call', 'answered'), '42501',
  'a viewer logs nothing', 'access.needs_level');
select test.as_person(current_setting('t.outsider')::uuid);
select test.raises(format('select api.activity_log(%L, %L, %L)', current_setting('t.p'), 'call', 'answered'), '42501',
  'nor does a person who cannot see the Client side', 'access.needs_level');
select test.as_owner();
update partner.partner set archived_at = now() where id = current_setting('t.q')::uuid;
select test.as_person(current_setting('t.head')::uuid);
select test.raises(format('select api.activity_log(%L, %L, %L)', current_setting('t.q'), 'call', 'answered'), 'P0001',
  'an archived organisation takes no activity', 'partner.archived');

-- logged late (V400): after go-live, an entry logged more than work.late_days (14) after the day it happened is marked;
-- one dated before go-live never is
select test.as_owner();
insert into core.setting (key, department_id, value, valid_from, reason)
values ('app.go_live_on', null, to_jsonb((core.riyadh_today() - 60)::text), core.riyadh_today(), 'made up: live 60 days ago');
select test.as_person(current_setting('t.am1')::uuid);
select api.activity_log(current_setting('t.p')::uuid, 'note', null, core.riyadh_today() - 20, 'Made-up line: twenty days on');
select api.activity_log(current_setting('t.p')::uuid, 'note', null, core.riyadh_today() - 10, 'Made-up line: ten days on');
select api.activity_log(current_setting('t.p')::uuid, 'note', null, core.riyadh_today() - 70, 'Made-up line: before go-live');
select test.eq((select jsonb_object_agg(n ->> 'body', n -> 'logged_late')
                from jsonb_array_elements(api.notes('partner', current_setting('t.p')::uuid)) n
                where n ->> 'body' like 'Made-up line: %days on' or n ->> 'body' = 'Made-up line: before go-live'),
  '{"Made-up line: twenty days on": true, "Made-up line: ten days on": false, "Made-up line: before go-live": false}'::jsonb,
  'logged 20 days after the day is late; 10 days is not; before go-live never is');
