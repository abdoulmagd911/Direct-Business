-- SRCH-02 — search no longer returns captured items (Landing 15, F-B3-03): the 'notes' key is gone from
-- core.search, so a note, idea, checklist, reminder or meeting is found nowhere in the top search, whether
-- private or shared — the captures still exist on My day, only the search door is closed. One of each kind is
-- captured with one made-up word; search answers no notes key for it, and the search text carries none of the
-- words. Every value is made up; the day is the one after the database is built (see NOTE-06).
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

select test.ok(api.search('quillwort') -> 'notes' is null, 'search answers no notes key for any captured kind');
select test.ok(position('quillwort' in api.search('quillwort')::text) = 0,
  'and none of the captured words is in the search answer');
select test.ok(position('brochure' in api.search('brochure')::text) = 0,
  'not even a word only the idea carries');

-- a colleague finds nothing either, and sharing changes nothing about search
select test.as_person(current_setting('t.other')::uuid);
select test.ok(api.search('quillwort') -> 'notes' is null, 'a colleague finds no notes key either');
select test.as_person(current_setting('t.am')::uuid);
select api.note_update(current_setting('t.idea')::uuid, jsonb_build_object('visibility', 'workspace'), 1);
select test.as_person(current_setting('t.other')::uuid);
select test.ok(api.search('quillwort') -> 'notes' is null,
  'and not once the idea is shared with everyone');
select test.ok(position('quillwort' in api.search('quillwort')::text) = 0,
  'nor any of its words');
