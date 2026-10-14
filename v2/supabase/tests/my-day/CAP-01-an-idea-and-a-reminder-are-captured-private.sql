-- CAP-01 — capture kinds (Productivity Stage 1): an idea is a sticky marked as an idea; a reminder is a sticky with its
-- reminder set at capture, which My day lists; both are private by default; a reminder needs a time to come, and only a
-- reminder takes one. Every value is made up.
-- Sabotage: supabase/tests/sabotage/an-idea-is-captured-as-a-plain-sticky.sql.
select set_config('t.am', test.person('Test Capture Member', 'member')::text, true);
select test.as_person(current_setting('t.am')::uuid);

select set_config('t.i', api.note_capture('idea', jsonb_build_object('title', 'Made-up idea for a newsletter')) ->> 'id', true);
select set_config('t.r', api.note_capture('reminder', jsonb_build_object('title', 'Made-up call the hotel',
  'remind_at', (now() + interval '2 hours')::text)) ->> 'id', true);
select set_config('t.day', api.my_day('me')::text, true);

select test.eq((select jsonb_build_object('kind', x ->> 'kind', 'idea', (x ->> 'idea')::boolean, 'visibility', x ->> 'visibility')
                from jsonb_array_elements(current_setting('t.day')::jsonb -> 'notes') x where x ->> 'id' = current_setting('t.i')),
  '{"kind": "sticky", "idea": true, "visibility": "private"}'::jsonb, 'an idea is a private sticky marked as an idea');
select test.eq((select x ->> 'note_id' from jsonb_array_elements(current_setting('t.day')::jsonb -> 'reminders') x),
  current_setting('t.r'), 'a reminder''s time is set at capture and My day lists it');
select test.eq((select x ->> 'visibility' from jsonb_array_elements(current_setting('t.day')::jsonb -> 'notes') x
                where x ->> 'id' = current_setting('t.r')), 'private', 'private too');

select test.raises($$select api.note_capture('reminder', jsonb_build_object('title', 'Made-up no time'))$$, 'P0001',
  'a reminder needs a time', 'reminder.time_required');
select test.raises($$select api.note_capture('reminder', jsonb_build_object('title', 'Made-up past',
  'remind_at', (now() - interval '1 hour')::text))$$, 'P0001', 'a time to come', 'reminder.time_required');
select test.raises($$select api.note_capture('sticky', jsonb_build_object('title', 'Made-up sticky',
  'remind_at', (now() + interval '1 hour')::text))$$, 'P0001', 'only a reminder takes one', 'common.unknown_field');
