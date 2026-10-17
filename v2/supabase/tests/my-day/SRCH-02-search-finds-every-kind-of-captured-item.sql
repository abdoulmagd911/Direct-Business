-- SRCH-02 — search finds every captured item (V641 (3), the owner's live test of 17 Oct: a saved idea could not be
-- found anywhere). One of each kind — note, idea, checklist, reminder, meeting — is captured with one made-up word;
-- search finds all five, each saying what it was captured as and named by its title, first line or first item; a
-- checklist is found by an item's words alone. A colleague finds none of them while they are private (V454), and a
-- shared one once it is shared. Every value is made up; the day is the one after the database is built (see NOTE-06).
-- Sabotage: supabase/tests/sabotage/search-names-no-kind-of-note.sql.
select set_config('t.d1', (current_date + 1)::text, true);
select set_config('v2.test_now', current_setting('t.d1') || ' 09:00:00+03', true);
select set_config('t.am', test.person('Test Capture Finder', 'member')::text, true);
select set_config('t.other', test.person('Test Capture Colleague', 'member')::text, true);

select test.as_person(current_setting('t.am')::uuid);
select set_config('t.note', api.note_capture('sticky',
  jsonb_build_object('body', E'Made-up quillwort note\nsecond line')) ->> 'id', true);
select set_config('t.idea', api.note_capture('idea',
  jsonb_build_object('body', 'Made-up quillwort idea for the brochure')) ->> 'id', true);
select set_config('t.list', api.note_capture('checklist',
  jsonb_build_object('items', jsonb_build_array(jsonb_build_object('text', 'Made-up quillwort item')))) ->> 'id', true);
select set_config('t.rem', api.note_capture('reminder', jsonb_build_object('title', 'Made-up quillwort reminder',
  'remind_at', current_setting('t.d1') || ' 15:00:00+03')) ->> 'id', true);
select set_config('t.meet', api.note_capture('meeting',
  jsonb_build_object('title', 'Made-up quillwort meeting')) ->> 'id', true);

select set_config('t.found', (api.search('quillwort') -> 'notes')::text, true);
select test.eq(jsonb_array_length(current_setting('t.found')::jsonb), 5, 'all five kinds are found');
select test.eq((select jsonb_object_agg(x ->> 'id', x ->> 'capture_kind')
                from jsonb_array_elements(current_setting('t.found')::jsonb) x),
  jsonb_build_object(current_setting('t.note'), 'note', current_setting('t.idea'), 'idea',
                     current_setting('t.list'), 'checklist', current_setting('t.rem'), 'reminder',
                     current_setting('t.meet'), 'meeting'),
  'each says what it was captured as');
select test.eq((select jsonb_object_agg(x ->> 'id', x ->> 'label')
                from jsonb_array_elements(current_setting('t.found')::jsonb) x),
  jsonb_build_object(current_setting('t.note'), 'Made-up quillwort note',
                     current_setting('t.idea'), 'Made-up quillwort idea for the brochure',
                     current_setting('t.list'), 'Made-up quillwort item',
                     current_setting('t.rem'), 'Made-up quillwort reminder',
                     current_setting('t.meet'), 'Made-up quillwort meeting'),
  'each is named by its title, else its first line, else its first item');
select test.eq((select bool_and((x ->> 'mine')::boolean) from jsonb_array_elements(current_setting('t.found')::jsonb) x),
  true, 'and is marked as the reader''s own');
select test.eq((select array_agg(x ->> 'id') from jsonb_array_elements(api.search('brochure') -> 'notes') x),
  array[current_setting('t.idea')], 'the idea is found by any of its words');

-- a colleague finds nothing private, and a shared note once it is shared
select test.as_person(current_setting('t.other')::uuid);
select test.eq(api.search('quillwort') -> 'notes', '[]'::jsonb, 'a colleague finds none of them while private');
select test.as_person(current_setting('t.am')::uuid);
select api.note_update(current_setting('t.idea')::uuid, jsonb_build_object('visibility', 'workspace'), 1);
select test.as_person(current_setting('t.other')::uuid);
select test.eq((select array_agg((x ->> 'id') || ':' || (x ->> 'capture_kind') || ':' || (x ->> 'mine'))
                from jsonb_array_elements(api.search('quillwort') -> 'notes') x),
  array[current_setting('t.idea') || ':idea:false'], 'and finds the idea once it is shared with everyone');
