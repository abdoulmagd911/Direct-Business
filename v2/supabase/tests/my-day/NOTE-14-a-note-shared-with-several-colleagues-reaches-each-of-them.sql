-- NOTE-14 — V524: a note is shared with several named colleagues. Each of them reads it and meets it on My day, each
-- is told once when added; no one else does. Changing the list stops it for whoever left the list and tells only the
-- newcomer. The list is never empty, never names its author or someone who left, and a name given twice counts once.
-- Every value is made up.
-- Sabotage: supabase/tests/sabotage/a-shared-note-reaches-its-first-colleague-alone.sql.
select set_config('t.dep', test.department('commercial')::text, true);
insert into core.team (department_id, code, name_en, name_ar)
values (current_setting('t.dep')::uuid, 'test_many_a', 'Test Many A', 'فريق المشاركة ج'),
       (current_setting('t.dep')::uuid, 'test_many_b', 'Test Many B', 'فريق المشاركة د');
select set_config('t.author', test.person('Test Many Author', 'member')::text, true);
select set_config('t.mate', test.person('Test Many Teammate', 'member')::text, true);
select set_config('t.one', test.person('Test Many One', 'member')::text, true);
select set_config('t.two', test.person('Test Many Two', 'member')::text, true);
select set_config('t.gone', test.person('Test Many Gone', 'member')::text, true);
update core.person set team_id = (select id from core.team where code = 'test_many_a')
where id in (current_setting('t.author')::uuid, current_setting('t.mate')::uuid);
update core.person set team_id = (select id from core.team where code = 'test_many_b')
where id in (current_setting('t.one')::uuid, current_setting('t.two')::uuid);
update core.person set active = false where id = current_setting('t.gone')::uuid;

-- shared at capture with two colleagues, one of them named twice
select test.as_person(current_setting('t.author')::uuid);
select set_config('t.n', api.note_capture('sticky', jsonb_build_object('title', 'Made-up words for two colleagues',
  'visibility', 'person', 'shared_with', jsonb_build_array(current_setting('t.one'), current_setting('t.two'),
                                                           current_setting('t.one')))) ->> 'id', true);
select test.eq((api.my_note(current_setting('t.n')::uuid) -> 'shared_with')::text,
  jsonb_build_array(current_setting('t.one'), current_setting('t.two'))::text,
  'the note names both colleagues, each once, in the order given');

select test.as_person(current_setting('t.one')::uuid);
select test.eq(api.my_note(current_setting('t.n')::uuid) ->> 'title', 'Made-up words for two colleagues',
  'the first colleague reads it');
select test.as_person(current_setting('t.two')::uuid);
select test.runs(format('select api.my_note(%L)', current_setting('t.n')), 'the second colleague reads it too');
select test.eq(api.my_note(current_setting('t.n')::uuid) ->> 'title', 'Made-up words for two colleagues',
  'the same note');
select test.eq((select count(*)::int from jsonb_array_elements(api.my_day('team') -> 'notes') x
                where x ->> 'id' = current_setting('t.n')), 1, 'and meets it with their team''s notes on My day');
select test.as_person(current_setting('t.mate')::uuid);
select test.raises(format('select api.my_note(%L)', current_setting('t.n')), 'P0002',
  'the author''s teammate, not on the list, cannot read it', 'common.not_found');
select test.as_owner();
select test.eq((select jsonb_object_agg(person_id, n) from (
                  select person_id, count(*)::int as n from notify.notification
                  where entity_table = 'my.note' and entity_id = current_setting('t.n')::uuid group by person_id) x),
  jsonb_build_object(current_setting('t.one'), 1, current_setting('t.two'), 1), 'each colleague is told once');

-- the list changes: the first colleague leaves it, the teammate joins
select test.as_person(current_setting('t.author')::uuid);
select api.note_update(current_setting('t.n')::uuid, jsonb_build_object('shared_with',
  jsonb_build_array(current_setting('t.two'), current_setting('t.mate'))), 1);
select test.as_person(current_setting('t.one')::uuid);
select test.raises(format('select api.my_note(%L)', current_setting('t.n')), 'P0002',
  'off the list, the first colleague no longer reads it', 'common.not_found');
select test.as_person(current_setting('t.mate')::uuid);
select test.eq(api.my_note(current_setting('t.n')::uuid) ->> 'title', 'Made-up words for two colleagues',
  'added, the teammate reads it');
select test.as_owner();
select test.eq((select jsonb_object_agg(person_id, n) from (
                  select person_id, count(*)::int as n from notify.notification
                  where entity_table = 'my.note' and entity_id = current_setting('t.n')::uuid group by person_id) x),
  jsonb_build_object(current_setting('t.one'), 1, current_setting('t.two'), 1, current_setting('t.mate'), 1),
  'only the newcomer is told; the one who stayed is not told again');

-- never an empty list, its author, someone who left or a word that is not a person
select test.as_person(current_setting('t.author')::uuid);
select test.raises(format('select api.note_capture(%L, %L::jsonb)', 'sticky',
  jsonb_build_object('title', 'Made up', 'visibility', 'person', 'shared_with', '[]'::jsonb)), 'P0001',
  'shared with named people means naming at least one', 'note.share_needs_a_colleague');
select test.raises(format('select api.note_capture(%L, %L::jsonb)', 'sticky',
  jsonb_build_object('title', 'Made up', 'visibility', 'person', 'shared_with',
                     jsonb_build_array(current_setting('t.one'), current_setting('t.author')))), 'P0001',
  'not with its own author among others', 'note.share_needs_a_colleague');
select test.raises(format('select api.note_capture(%L, %L::jsonb)', 'sticky',
  jsonb_build_object('title', 'Made up', 'visibility', 'person', 'shared_with',
                     jsonb_build_array(current_setting('t.one'), current_setting('t.gone')))), 'P0001',
  'nor with someone who has left among others', 'note.share_needs_a_colleague');
select test.raises(format('select api.note_capture(%L, %L::jsonb)', 'sticky',
  jsonb_build_object('title', 'Made up', 'visibility', 'person', 'shared_with', jsonb_build_array('made up'))), 'P0001',
  'nor with a word that is not a person', 'note.share_needs_a_colleague');
