-- NOTE-13 — G (26 Oct): a note shared with one named colleague is read by its author and that colleague alone. Not by
-- a teammate, nor another team, nor an admin, as for a private note (V454). The colleague meets it with their team's
-- notes on My day, cannot change it, and is told once. Choosing another visibility stops the sharing. A note is never
-- shared with nobody, its author or someone who left. Every value is made up.
-- Sabotage: supabase/tests/sabotage/a-shared-note-reaches-its-authors-team.sql.
select set_config('t.dep', test.department('commercial')::text, true);
insert into core.team (department_id, code, name_en, name_ar)
values (current_setting('t.dep')::uuid, 'test_share_a', 'Test Share A', 'فريق المشاركة أ'),
       (current_setting('t.dep')::uuid, 'test_share_b', 'Test Share B', 'فريق المشاركة ب');
select set_config('t.author', test.person('Test Share Author', 'member')::text, true);
select set_config('t.mate', test.person('Test Share Teammate', 'member')::text, true);
select set_config('t.named', test.person('Test Share Named', 'member')::text, true);
select set_config('t.admin', test.person('Test Share Admin', 'admin')::text, true);
select set_config('t.gone', test.person('Test Share Gone', 'member')::text, true);
update core.person set team_id = (select id from core.team where code = 'test_share_a')
where id in (current_setting('t.author')::uuid, current_setting('t.mate')::uuid);
update core.person set team_id = (select id from core.team where code = 'test_share_b')
where id = current_setting('t.named')::uuid;
update core.person set active = false where id = current_setting('t.gone')::uuid;

-- shared at capture with one colleague of another team
select test.as_person(current_setting('t.author')::uuid);
select set_config('t.n', api.note_capture('sticky', jsonb_build_object('title', 'Made-up words for one colleague',
  'visibility', 'person', 'shared_with', current_setting('t.named'))) ->> 'id', true);
select test.eq(api.my_note(current_setting('t.n')::uuid) ->> 'shared_with', current_setting('t.named'),
  'the note says whom it is shared with');

select test.as_person(current_setting('t.named')::uuid);
select test.eq(api.my_note(current_setting('t.n')::uuid) ->> 'title', 'Made-up words for one colleague',
  'the named colleague reads it');
select test.eq((select count(*)::int from jsonb_array_elements(api.my_day('team') -> 'notes') x
                where x ->> 'id' = current_setting('t.n')), 1, 'and meets it with their team''s notes on My day');
select test.raises(format('select api.note_update(%L, %L::jsonb, 1)', current_setting('t.n'), '{"title": "Made up"}'),
  '42501', 'but cannot change it', 'note.not_yours');
select test.as_owner();
select test.eq((select count(*)::int from notify.notification where person_id = current_setting('t.named')::uuid
                and entity_table = 'my.note' and entity_id = current_setting('t.n')::uuid), 1, 'and is told once');

select test.as_person(current_setting('t.mate')::uuid);
select test.raises(format('select api.my_note(%L)', current_setting('t.n')), 'P0002',
  'the author''s teammate cannot read it', 'common.not_found');
select test.eq((select count(*)::int from jsonb_array_elements(api.my_day('team') -> 'notes') x
                where x ->> 'id' = current_setting('t.n')), 0, 'nor meet it on My team');
select test.as_person(current_setting('t.admin')::uuid);
select test.raises(format('select api.my_note(%L)', current_setting('t.n')), 'P0002',
  'nor can an admin', 'common.not_found');

-- never shared with nobody, its author or someone who left
select test.as_person(current_setting('t.author')::uuid);
select test.raises(format('select api.note_capture(%L, %L::jsonb)', 'sticky',
  jsonb_build_object('title', 'Made up', 'visibility', 'person')), 'P0001',
  'shared with one person means naming them', 'note.share_needs_a_colleague');
select test.raises(format('select api.note_capture(%L, %L::jsonb)', 'sticky',
  jsonb_build_object('title', 'Made up', 'visibility', 'person', 'shared_with', current_setting('t.author'))), 'P0001',
  'not with its own author', 'note.share_needs_a_colleague');
select test.raises(format('select api.note_capture(%L, %L::jsonb)', 'sticky',
  jsonb_build_object('title', 'Made up', 'visibility', 'person', 'shared_with', current_setting('t.gone'))), 'P0001',
  'nor with someone who has left', 'note.share_needs_a_colleague');

-- made private again, the colleague no longer reads it
select api.note_update(current_setting('t.n')::uuid, '{"visibility": "private"}'::jsonb, 1);
select test.eq(api.my_note(current_setting('t.n')::uuid) ->> 'shared_with', null, 'private again, it is shared with no one');
select test.as_person(current_setting('t.named')::uuid);
select test.raises(format('select api.my_note(%L)', current_setting('t.n')), 'P0002',
  'and the colleague no longer reads it', 'common.not_found');
