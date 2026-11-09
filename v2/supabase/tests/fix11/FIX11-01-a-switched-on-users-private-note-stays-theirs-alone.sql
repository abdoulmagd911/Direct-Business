-- FIX11-01 — a switched-on user's private note stays theirs alone (FIX-11 D10). A private note is its author's
-- alone, live and in Recently Deleted: an admin neither sees it there nor restores it. Once its author is switched
-- off, an admin may see it and restore it. Every value is made up.
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.am', test.person('Test Member', 'member')::text, true);
select test.as_person(current_setting('t.am')::uuid);
select set_config('t.n', api.note_capture('idea', jsonb_build_object('title', 'Made-up private idea')) ->> 'id', true);
select test.eq(api.my_note(current_setting('t.n')::uuid) ->> 'visibility', 'private', 'the idea is private');
select test.runs(format('select api.my_notes_remove(array[%L]::uuid[])', current_setting('t.n')),
  'its author removes it');

-- switched on: the admin neither sees it nor restores it
select test.as_person(current_setting('t.admin')::uuid);
select test.eq((select pg_catalog.count(*)::int from pg_catalog.jsonb_array_elements(api.recently_deleted())
                where value ->> 'id' = current_setting('t.n')), 0,
  'an admin does not see a switched-on user''s deleted private note');
select test.raises(format('select api.restore(%L, %L, %L)', 'my_note', current_setting('t.n'), 'made up'),
  '42501', 'nor restores it', 'access.needs_level');

-- its author does see it and restores it
select test.as_person(current_setting('t.am')::uuid);
select test.eq((select pg_catalog.count(*)::int from pg_catalog.jsonb_array_elements(api.recently_deleted())
                where value ->> 'id' = current_setting('t.n')), 1, 'its author sees it');
select test.runs(format('select api.restore(%L, %L, %L)', 'my_note', current_setting('t.n'), 'made up'),
  'and restores it');
select test.eq(api.my_note(current_setting('t.n')::uuid) ->> 'title', 'Made-up private idea', 'the note is back');

-- switched off: the admin may see it and restore it
select test.runs(format('select api.my_notes_remove(array[%L]::uuid[])', current_setting('t.n')),
  'its author removes it again');
select test.as_person(current_setting('t.admin')::uuid);
select test.runs(format('select api.person_switch(%L, false, %L)', current_setting('t.am'), 'made up: off'),
  'the author is switched off');
select test.eq((select pg_catalog.count(*)::int from pg_catalog.jsonb_array_elements(api.recently_deleted())
                where value ->> 'id' = current_setting('t.n')), 1,
  'an admin sees a switched-off user''s deleted private note');
select test.runs(format('select api.restore(%L, %L, %L)', 'my_note', current_setting('t.n'), 'made up'),
  'and restores it');
select test.as_owner();
select test.eq((select deleted_at is null from my.note where id = current_setting('t.n')::uuid), true,
  'the note is back');
