-- NOTE-05 — Wrap up today (V433; TECH-SPEC §3.3a; OLD-WRK-022): each open capture is converted, carried over or done,
-- in one request, and nothing is deleted. Carried over, a capture moves to the next working day — the Sunday after a
-- Thursday — keeping the day it happened, and leaves today's list until then; done, it leaves My day. Every value is
-- made up.
-- Sabotage: supabase/tests/sabotage/wrap-up-rewrites-the-day-it-happened.sql.
select test.eq(core.next_working_day('2026-10-01'), '2026-10-04'::date, 'the working day after a Thursday is the Sunday');
select test.eq(core.next_working_day('2026-10-02'), '2026-10-04'::date, 'after a Friday too');
select test.eq(core.next_working_day('2026-10-04'), '2026-10-05'::date, 'after a Sunday, the Monday');

-- a Thursday in Riyadh, on the test clock
select set_config('v2.test_now', '2026-10-01 18:00:00+03', true);
select set_config('t.am1', test.person('Test Account Manager', 'member')::text, true);
select set_config('t.head', test.person('Test Head', 'head')::text, true);
select test.as_person(current_setting('t.head')::uuid);
select set_config('t.p', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Wrap Co',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate',
                                                'owner_id', current_setting('t.am1'))))) ->> 'id', true);
select test.as_person(current_setting('t.am1')::uuid);
select set_config('t.carry', api.note_capture('sticky', jsonb_build_object('title', 'Made-up carry me',
  'happened_on', '2026-09-30')) ->> 'id', true);
select set_config('t.done', api.note_capture('checklist', jsonb_build_object('title', 'Made-up finished list')) ->> 'id', true);
select set_config('t.call', api.note_capture('sticky', jsonb_build_object('title', 'Made-up rang them')) ->> 'id', true);
select test.eq(jsonb_array_length(api.my_day('me') -> 'notes'), 3, 'three open captures on Thursday');

select set_config('t.w', api.note_wrap_up('2026-10-01', jsonb_build_array(
  jsonb_build_object('id', current_setting('t.carry'), 'action', 'carry'),
  jsonb_build_object('id', current_setting('t.done'), 'action', 'done'),
  jsonb_build_object('id', current_setting('t.call'), 'action', 'turn_into', 'into', 'call',
                     'values', jsonb_build_object('partner_id', current_setting('t.p'), 'outcome', 'answered'))))::text,
  true);
select test.eq(api.note(current_setting('t.carry')::uuid) ->> 'carried_to', '2026-10-04', 'carried over to Sunday');
select test.eq(api.note(current_setting('t.carry')::uuid) ->> 'happened_on', '2026-09-30', 'keeping the day it happened');
select test.ok(api.note(current_setting('t.done')::uuid) ->> 'done_at' is not null, 'the done one is done');
select test.eq(api.note(current_setting('t.call')::uuid) -> 'turned_into' -> 0 ->> 'type', 'call',
  'the converted one is a call');
select test.eq(jsonb_array_length(api.my_day('me') -> 'notes'), 0, 'Thursday''s list is clear');
select test.as_owner();
select test.eq((select count(*)::int from my.note where person_id = current_setting('t.am1')::uuid and deleted_at is null),
  3, 'nothing was deleted');
select test.eq((select count(distinct c.request_id)::int from audit.change c
                where c.row_id in (current_setting('t.carry')::uuid, current_setting('t.done')::uuid,
                                   current_setting('t.call')::uuid)
                  and c.action = 'update'), 1, 'one request for the whole wrap-up');
select test.as_person(current_setting('t.am1')::uuid);
select test.raises(format('select api.note_wrap_up(%L, %L::jsonb)', '2026-10-01',
  jsonb_build_array(jsonb_build_object('id', current_setting('t.done'), 'action', 'done'))), 'P0001',
  'a done capture is not wrapped up again', 'note.not_open');

-- Sunday: the carried capture is back
select set_config('v2.test_now', '2026-10-04 08:00:00+03', true);
select test.eq(api.my_day('me') -> 'notes' -> 0 ->> 'id', current_setting('t.carry'), 'on Sunday it is back on My day');
select test.eq(jsonb_array_length(api.my_day('me') -> 'notes'), 1, 'alone');
