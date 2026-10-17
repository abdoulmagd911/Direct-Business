-- NSRCH-01 — search finds the owner's own notes of every kind (V641): the note, the idea, the checklist (by its title and
-- by its items alone), the reminder and the meeting; each hit says what it is; a private one is found by its author
-- alone, admins included; a word in no note finds none. Every value is made up.
-- Sabotage: supabase/tests/sabotage/search-skips-a-checklists-items.sql.
select set_config('t.admin', test.person('Test Search Admin', 'admin')::text, true);
select set_config('t.am', test.person('Test Search Member', 'member')::text, true);
select test.as_person(current_setting('t.am')::uuid);

select set_config('t.note', api.note_capture('sticky', jsonb_build_object('title', 'Made-up pelican note'))->> 'id', true);
select set_config('t.idea', api.note_capture('idea', jsonb_build_object('title', 'Made-up marmot idea'))->> 'id', true);
select set_config('t.list', api.note_capture('checklist', jsonb_build_object('title', 'Made-up weasel list',
  'items', jsonb_build_array(jsonb_build_object('text', 'Made-up: pack the ibex'))))->> 'id', true);
select set_config('t.bare', api.note_capture('checklist', jsonb_build_object(
  'items', jsonb_build_array(jsonb_build_object('text', 'Made-up: feed the quokka'))))->> 'id', true);
select set_config('t.rem', api.note_capture('reminder', jsonb_build_object('title', 'Made-up lemur reminder',
  'remind_at', (now() + interval '2 hours')::text))->> 'id', true);
select set_config('t.meet', api.note_capture('meeting', jsonb_build_object('title', 'Made-up narwhal meeting'))->> 'id', true);
select set_config('t.body', api.note_capture('sticky', jsonb_build_object('body', E'Made-up first line\nthen a tapir in the body'))
  ->> 'id', true);

create function pg_temp.hit(p_q text, p_key text) returns jsonb language sql stable as $$
  select x from jsonb_array_elements(api.search(p_q) -> 'notes') x where x ->> 'id' = current_setting(p_key) $$;

select test.eq(pg_temp.hit('pelican', 't.note') ->> 'kind', 'sticky', 'a note is found by its title');
select test.ok(not (pg_temp.hit('pelican', 't.note') ->> 'idea')::boolean
               and not (pg_temp.hit('pelican', 't.note') ->> 'reminder')::boolean, 'and says it is neither an idea nor a reminder');
select test.ok((pg_temp.hit('marmot', 't.idea') ->> 'idea')::boolean, 'an idea is found and says it is an idea');
select test.eq(pg_temp.hit('weasel', 't.list') ->> 'kind', 'checklist', 'a checklist is found by its title');
select test.eq(pg_temp.hit('ibex', 't.list') ->> 'title', 'Made-up weasel list', 'and by one of its items');
select test.eq(pg_temp.hit('quokka', 't.bare') ->> 'line', 'Made-up: feed the quokka',
  'a checklist with items only is found by an item, and its first item names it');
select test.ok((pg_temp.hit('lemur', 't.rem') ->> 'reminder')::boolean, 'a reminder is found and says it is one');
select test.eq(pg_temp.hit('narwhal', 't.meet') ->> 'kind', 'meeting', 'a meeting is found');
select test.eq(pg_temp.hit('tapir', 't.body') ->> 'line', 'Made-up first line', 'a note is found by its body, named by its first line');
select test.eq(jsonb_array_length(api.search('zzqxjv-nothing') -> 'notes'), 0, 'a word in no note finds none');

-- private by default: not another member, not an admin
select test.as_person(current_setting('t.admin')::uuid);
select test.eq(jsonb_array_length(api.search('pelican') -> 'notes') + jsonb_array_length(api.search('ibex') -> 'notes')
               + jsonb_array_length(api.search('lemur') -> 'notes') + jsonb_array_length(api.search('narwhal') -> 'notes'),
  0, 'an admin finds none of another person''s private notes');
