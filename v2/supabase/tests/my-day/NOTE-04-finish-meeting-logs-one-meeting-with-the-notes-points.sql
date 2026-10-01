-- NOTE-04 — Finish meeting (V433; TECH-SPEC §3.3a): a meeting note's points and words are logged as one meeting on
-- its organisation (type meeting, held unless said otherwise), linked both ways, and the note is marked finished — once;
-- a sticky is no meeting, a meeting needs its organisation, and a meeting that has not happened yet is not logged. The
-- points become action items once tasks exist (P5-1). Every value is made up.
-- Sabotage: supabase/tests/sabotage/finish-meeting-drops-the-points.sql.
select set_config('t.head', test.person('Test Head', 'head')::text, true);
select set_config('t.am1', test.person('Test Account Manager', 'member')::text, true);
select test.as_person(current_setting('t.head')::uuid);
select set_config('t.p', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Meeting Co',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate',
                                                'owner_id', current_setting('t.am1'))))) ->> 'id', true);

select test.as_person(current_setting('t.am1')::uuid);
select set_config('t.m', api.note_capture('meeting', jsonb_build_object('title', 'Made-up quarterly review',
  'meeting_partner_id', current_setting('t.p'), 'meeting_on', core.riyadh_today(),
  'items', jsonb_build_array(jsonb_build_object('text', 'Made-up: send the rates', 'owner_id', current_setting('t.am1'),
                                                'due_on', core.riyadh_today() + 3),
                             jsonb_build_object('text', 'Made-up: book the visit')))) ->> 'id', true);
select test.eq(api.note(current_setting('t.m')::uuid) -> 'items' -> 1 ->> 'done', 'false', 'a point is open unless said');
select set_config('t.s', api.note_capture('sticky', jsonb_build_object('title', 'Made-up sticky')) ->> 'id', true);
select test.raises(format('select api.note_finish_meeting(%L)', current_setting('t.s')), 'P0001', 'a sticky is no meeting',
  'note.not_a_meeting');
select test.raises(format('select api.note_capture(%L, %L::jsonb)', 'sticky',
  jsonb_build_object('title', 'Made up', 'meeting_partner_id', current_setting('t.p'))), 'P0001',
  'only a meeting names an organisation', 'note.meeting_fields_on_a_meeting');
select set_config('t.later', api.note_capture('meeting', jsonb_build_object('title', 'Made-up next week',
  'meeting_partner_id', current_setting('t.p'), 'meeting_on', core.riyadh_today() + 7)) ->> 'id', true);
select test.raises(format('select api.note_finish_meeting(%L)', current_setting('t.later')), 'P0001',
  'a meeting that has not happened is not logged', 'common.date_in_future');
select set_config('t.bare', api.note_capture('meeting', jsonb_build_object('title', 'Made-up no organisation')) ->> 'id',
  true);
select test.raises(format('select api.note_finish_meeting(%L)', current_setting('t.bare')), 'P0001',
  'a meeting needs its organisation', 'note.meeting_needs_partner');

select set_config('t.f', api.note_finish_meeting(current_setting('t.m')::uuid)::text, true);
select test.as_owner();
select test.eq((select count(*)::int from core.note n join partner.activity_type t on t.id = n.activity_type_id
                where n.entity_id = current_setting('t.p')::uuid and n.kind = 'activity' and t.key = 'meeting'
                  and n.deleted_at is null), 1, 'one meeting is logged on the organisation');
select test.eq((select o.key from core.note n join partner.activity_outcome o on o.id = n.outcome_id
                where n.id = (current_setting('t.f')::jsonb ->> 'activity_id')::uuid), 'meeting_held', 'as held');
select test.eq((select body from core.note where id = (current_setting('t.f')::jsonb ->> 'activity_id')::uuid),
  E'Made-up quarterly review\n- Made-up: send the rates\n- Made-up: book the visit', 'with the note''s points');
select test.eq((current_setting('t.f')::jsonb ->> 'points')::int, 2, 'two points');
select test.as_person(current_setting('t.am1')::uuid);
select test.ok(api.note(current_setting('t.m')::uuid) ->> 'finished_at' is not null, 'the note is finished');
select test.eq(api.note(current_setting('t.m')::uuid) -> 'turned_into' -> 0 ->> 'id',
  current_setting('t.f')::jsonb ->> 'activity_id', 'and shows the meeting');
select test.raises(format('select api.note_finish_meeting(%L)', current_setting('t.m')), 'P0001', 'finished once',
  'note.meeting_finished');
select test.runs(format('select api.undo(%L)', current_setting('t.f')::jsonb ->> 'request_id'), 'one Undo');
select test.eq(api.note(current_setting('t.m')::uuid) ->> 'finished_at', null, 'takes the finish back');
select test.as_owner();
select test.eq((select count(*)::int from core.note where entity_id = current_setting('t.p')::uuid and deleted_at is null),
  0, 'and the meeting with it');
