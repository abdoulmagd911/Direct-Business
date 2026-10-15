-- FUP-03 — a note turned into a reminder stays among My notes (QA-568, the Architect's ruling of 14 Oct): only a note
-- captured as a Reminder is listed once, as its reminder, and only while that reminder is still to come; once told it
-- is among My notes again (the Architect's ruling of 15 Oct). A meeting, sticky or checklist note turned into a reminder
-- later (Turn into → Reminder) keeps its place among My notes and also shows its reminder. Every value is made up; the
-- day is the one after the database is built (see NOTE-06).
-- Sabotages: supabase/tests/sabotage/a-turned-into-reminder-hides-its-note.sql, a-told-reminder-keeps-its-note-hidden.sql.
select set_config('t.d1', (current_date + 1)::text, true);
select set_config('v2.test_now', current_setting('t.d1') || ' 09:00:00+03', true);
select set_config('t.am', test.person('Test Turned Member', 'member')::text, true);

select test.as_person(current_setting('t.am')::uuid);
select set_config('t.m', api.note_capture('meeting', jsonb_build_object('title', 'Made-up meeting note',
  'meeting_on', current_setting('t.d1'))) ->> 'id', true);
select set_config('t.c', api.note_capture('checklist', jsonb_build_object('title', 'Made-up checklist',
  'items', jsonb_build_array(jsonb_build_object('text', 'Made-up item', 'done', false)))) ->> 'id', true);
select api.note_turn_into(current_setting('t.m')::uuid, 'reminder',
  jsonb_build_object('remind_at', current_setting('t.d1') || 'T11:00:00+03:00'));
select api.note_turn_into(current_setting('t.c')::uuid, 'reminder',
  jsonb_build_object('remind_at', current_setting('t.d1') || 'T12:00:00+03:00'));
select set_config('t.r', api.note_capture('reminder', jsonb_build_object('title', 'Made-up reminder',
  'remind_at', current_setting('t.d1') || 'T13:00:00+03:00')) ->> 'id', true);

select test.eq((select count(*)::int from jsonb_array_elements(api.my_day('me') -> 'notes') x
                where x ->> 'id' in (current_setting('t.m'), current_setting('t.c'))), 2,
  'a meeting and a checklist turned into reminders stay among My notes');
select test.eq((select count(*)::int from jsonb_array_elements(api.my_day('me') -> 'reminders') x
                where x ->> 'note_id' in (current_setting('t.m'), current_setting('t.c'))), 2,
  'and show their reminders');
select test.eq((select count(*)::int from jsonb_array_elements(api.my_day('me') -> 'notes') x
                where x ->> 'id' = current_setting('t.r')), 0, 'a note captured as a Reminder is listed only as its reminder');
select test.eq((api.my_day('me') ->> 'notes_total')::int, 2, 'and is not counted among My notes');

-- told: the captured Reminder leaves Reminders and comes back among My notes; the turned-into notes stay where they were
select test.as_owner();
select set_config('v2.test_now', current_setting('t.d1') || ' 13:00:30+03', true);
select test.eq(notify.send_reminders(), 3, 'the job tells all three by 13:00');
select test.as_person(current_setting('t.am')::uuid);
select test.eq((select count(*)::int from jsonb_array_elements(api.my_day('me') -> 'reminders') x
                where x ->> 'note_id' = current_setting('t.r')), 0, 'a told reminder is no longer under Reminders');
select test.eq((select count(*)::int from jsonb_array_elements(api.my_day('me') -> 'notes') x
                where x ->> 'id' = current_setting('t.r')), 1, 'its note is among My notes again once told');
select test.eq((api.my_day('me') ->> 'notes_total')::int, 3, 'and counted there, with the two turned-into notes');
