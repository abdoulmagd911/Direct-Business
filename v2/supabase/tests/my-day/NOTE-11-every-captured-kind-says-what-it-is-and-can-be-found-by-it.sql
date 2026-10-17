-- NOTE-11 — Every captured item says what it is, and My notes can be narrowed to a kind (the Architect's ruling V641,
-- the owner's live test of 17 Oct). One of each kind — note, idea, checklist, reminder, meeting — is captured; every
-- note row names its kind (`capture_kind`); the kind's own read lists exactly the notes of that kind, the Reminder kind
-- including a captured reminder that is still to come (the plain list leaves it to Reminders, V283); the read is the
-- reader's own — a colleague gets none of them (V454) — and refuses an unknown kind. Every value is made up.
-- Sabotage: supabase/tests/sabotage/an-idea-is-listed-as-a-plain-note.sql.
select set_config('t.d1', (current_date + 3)::text, true);
select set_config('t.am', test.person('Test Kind Member', 'member')::text, true);
select set_config('t.other', test.person('Test Kind Colleague', 'member')::text, true);

select test.as_person(current_setting('t.am')::uuid);
select set_config('t.note', api.note_capture('sticky', jsonb_build_object('title', 'Made-up plain note')) ->> 'id', true);
select set_config('t.idea', api.note_capture('idea', jsonb_build_object('title', 'Made-up idea for a newsletter')) ->> 'id', true);
select set_config('t.list', api.note_capture('checklist', jsonb_build_object('title', 'Made-up list',
  'items', jsonb_build_array(jsonb_build_object('text', 'Made-up: one')))) ->> 'id', true);
select set_config('t.rem', api.note_capture('reminder', jsonb_build_object('title', 'Made-up reminder',
  'remind_at', current_setting('t.d1') || 'T10:00:00+03:00')) ->> 'id', true);
select set_config('t.meet', api.note_capture('meeting', jsonb_build_object('title', 'Made-up meeting note')) ->> 'id', true);

-- each note row says what it was captured as
select test.eq(api.my_note(current_setting('t.note')::uuid) ->> 'capture_kind', 'note', 'a plain note says note');
select test.eq(api.my_note(current_setting('t.idea')::uuid) ->> 'capture_kind', 'idea', 'an idea says idea');
select test.eq(api.my_note(current_setting('t.list')::uuid) ->> 'capture_kind', 'checklist', 'a checklist says checklist');
select test.eq(api.my_note(current_setting('t.rem')::uuid) ->> 'capture_kind', 'reminder', 'a reminder says reminder');
select test.eq(api.my_note(current_setting('t.meet')::uuid) ->> 'capture_kind', 'meeting', 'a meeting says meeting');

-- My notes lists the four that are not a coming reminder, each naming its kind
select test.eq((select jsonb_object_agg(x ->> 'id', x ->> 'capture_kind')
                from jsonb_array_elements(api.my_day('me', 20) -> 'notes') x),
  jsonb_build_object(current_setting('t.note'), 'note', current_setting('t.idea'), 'idea',
                     current_setting('t.list'), 'checklist', current_setting('t.meet'), 'meeting'),
  'My notes lists a note, an idea, a checklist and a meeting, each naming its kind');

-- narrowed to a kind: exactly that kind's notes
select test.eq((select jsonb_agg(x ->> 'id') from jsonb_array_elements(api.my_notes_by_kind('me', 'idea') -> 'notes') x),
  jsonb_build_array(current_setting('t.idea')), 'the Idea kind lists the idea');
select test.eq((api.my_notes_by_kind('me', 'idea') ->> 'notes_total')::int, 1, 'and counts it');
select test.eq((select jsonb_agg(x ->> 'id') from jsonb_array_elements(api.my_notes_by_kind('me', 'note') -> 'notes') x),
  jsonb_build_array(current_setting('t.note')), 'the Note kind lists only the plain note, not the idea');
select test.eq((select jsonb_agg(x ->> 'id') from jsonb_array_elements(api.my_notes_by_kind('me', 'checklist') -> 'notes') x),
  jsonb_build_array(current_setting('t.list')), 'the Checklist kind lists the checklist');
select test.eq((select jsonb_agg(x ->> 'id') from jsonb_array_elements(api.my_notes_by_kind('me', 'meeting') -> 'notes') x),
  jsonb_build_array(current_setting('t.meet')), 'the Meeting kind lists the meeting');
select test.eq((select jsonb_agg(x ->> 'id') from jsonb_array_elements(api.my_notes_by_kind('me', 'reminder') -> 'notes') x),
  jsonb_build_array(current_setting('t.rem')), 'the Reminder kind lists a captured reminder still to come');
select test.eq((select count(*)::int from jsonb_array_elements(api.my_day('me') -> 'notes') x
                where x ->> 'id' = current_setting('t.rem')), 0, 'while the plain list leaves it to Reminders');

-- a colleague finds none of them; an unknown kind is refused
select test.as_person(current_setting('t.other')::uuid);
select test.eq((api.my_notes_by_kind('me', 'idea') ->> 'notes_total')::int, 0, 'a colleague finds nobody else''s idea');
select test.eq((api.my_notes_by_kind('workspace', 'idea') ->> 'notes_total')::int, 0, 'not even in the workspace view, while it is private');
select test.raises($$select api.my_notes_by_kind('me', 'photo')$$, 'P0001', 'an unknown kind is refused', 'my_day.kind_invalid');
select test.as_owner();
