-- FILE-07 — a note's file downloads for the colleague it is shared with while the note is shared, and refuses
-- them once the note is private again — while its author keeps downloading it (FIX-16, I3). The re-checking
-- download route relies on exactly this rule: it re-runs file_download on every press, so an unshared reader's
-- re-press refuses instead of serving the file until the old URL's expiry. Every value is made up.
select set_config('t.author', test.person('Test Route Author', 'member')::text, true);
select set_config('t.named', test.person('Test Route Named', 'member')::text, true);

select test.as_person(current_setting('t.author')::uuid);
select set_config('t.n', api.note_capture('sticky', jsonb_build_object('title', 'Made-up words for the route',
  'visibility', 'person', 'shared_with', current_setting('t.named'))) ->> 'id', true);
select set_config('t.f', api.file_begin('my_note', current_setting('t.n')::uuid, 'evidence', 'evidence',
  'note.pdf', 1000, 'application/pdf')::text, true);
select test.runs(format('insert into storage.objects (bucket_id, name) values (%L, %L)',
  current_setting('t.f')::jsonb ->> 'bucket', current_setting('t.f')::jsonb ->> 'path'), 'the file is uploaded');
select api.file_finish((current_setting('t.f')::jsonb ->> 'id')::uuid, repeat('4', 64));

select test.as_person(current_setting('t.named')::uuid);
select test.eq((api.file_download((current_setting('t.f')::jsonb ->> 'id')::uuid) ->> 'bucket'), 'files',
  'the named colleague downloads the shared note''s file while it is shared');

select test.as_person(current_setting('t.author')::uuid);
select api.note_update(current_setting('t.n')::uuid, '{"visibility": "private"}'::jsonb, 1);

select test.as_person(current_setting('t.named')::uuid);
select test.raises(format('select api.file_download(%L)', (current_setting('t.f')::jsonb ->> 'id')),
  '42501', 'once the note is private again, the colleague is refused the download', 'file.cannot_see');

select test.as_person(current_setting('t.author')::uuid);
select test.eq((api.file_download((current_setting('t.f')::jsonb ->> 'id')::uuid) ->> 'bucket'), 'files',
  'but its author keeps downloading it — unsharing takes the file from its readers, not from its author');
