-- FILE-01 — a file is registered, uploaded and finished (§3.4, V139): api.file_begin registers a pending file linked to
-- a record and answers its bucket and path; Storage takes an object only at a path its writer registered and has not
-- finished — another person's pending path, or a path nobody registered, is refused; api.file_finish marks it stored
-- once Storage holds it, with its checksum, and only for its uploader; size, type, kind and purpose are checked, and a
-- viewer adds no file. Every value is made up.
-- Sabotage: supabase/tests/sabotage/storage-takes-any-path.sql.
select set_config('t.am1', test.person('Test Account Manager', 'member')::text, true);
select set_config('t.other', test.person('Test Other Member', 'member')::text, true);
select set_config('t.viewer', test.person('Test Viewer', 'viewer')::text, true);
select test.as_person(current_setting('t.am1')::uuid);
select set_config('t.p', api.partner_create('{"trade_name_en": "Made Up Files Co"}') ->> 'id', true);
select set_config('t.f', api.file_begin('partner', current_setting('t.p')::uuid, 'rate_sheet', 'attachment',
  'rates 2027.PDF', 1000, 'application/pdf')::text, true);
select test.eq(current_setting('t.f')::jsonb ->> 'bucket', 'files', 'a document goes to the files bucket');
select test.ok((current_setting('t.f')::jsonb ->> 'path') ~ '^[0-9]{4}/[0-9]{2}/[0-9a-f-]{36}[.]pdf$',
  'at a path of its own, keeping its extension');
select test.raises(format('select api.file_finish(%L, %L)', current_setting('t.f')::jsonb ->> 'id', repeat('a', 64)),
  'P0001', 'it cannot be finished before Storage holds it', 'file.not_uploaded');

select test.as_person(current_setting('t.other')::uuid);
select test.raises(format('insert into storage.objects (bucket_id, name) values (%L, %L)', 'files',
  current_setting('t.f')::jsonb ->> 'path'), '42501', 'another person cannot write to a pending path', '%row-level security%');
select test.raises($$insert into storage.objects (bucket_id, name) values ('files', '2027/01/made-up.pdf')$$, '42501',
  'nor anyone to a path nobody registered', '%row-level security%');

select test.as_person(current_setting('t.am1')::uuid);
select test.runs(format('insert into storage.objects (bucket_id, name) values (%L, %L)', 'files',
  current_setting('t.f')::jsonb ->> 'path'), 'its uploader writes it');
select test.raises(format('select api.file_finish(%L, %L)', current_setting('t.f')::jsonb ->> 'id', 'not-a-checksum'),
  'P0001', 'the checksum is checked', 'file.checksum_invalid');
select test.as_person(current_setting('t.other')::uuid);
select test.raises(format('select api.file_finish(%L, %L)', current_setting('t.f')::jsonb ->> 'id', repeat('b', 64)),
  '42501', 'only its uploader finishes it', 'file.not_yours');
select test.as_person(current_setting('t.am1')::uuid);
select test.eq(api.file_finish((current_setting('t.f')::jsonb ->> 'id')::uuid, repeat('C', 64)) ->> 'id',
  current_setting('t.f')::jsonb ->> 'id', 'then it is stored');
select test.eq(api.files('partner', current_setting('t.p')::uuid) -> 0 ->> 'status', 'stored', 'and listed on its record');
select test.raises(format('select api.file_finish(%L, %L)', current_setting('t.f')::jsonb ->> 'id', repeat('c', 64)),
  'P0001', 'a stored file is not finished twice', 'file.already_stored');

select test.raises(format('select api.file_begin(%L, %L, %L, %L, %L, %s, %L)', 'partner', current_setting('t.p'), 'rate_sheet',
  'attachment', 'huge.pdf', 21 * 1048576, 'application/pdf'), 'P0001', 'a file over files.max_mb is refused', 'file.too_large');
select test.raises(format('select api.file_begin(%L, %L, %L, %L, %L, %s, %L)', 'partner', current_setting('t.p'), 'other',
  'attachment', 'run.exe', 1000, 'application/x-msdownload'), 'P0001', 'a type not in files.allowed_types is refused',
  'file.type_not_allowed');
select test.raises(format('select api.file_begin(%L, %L, %L, %L, %L, %s, %L)', 'partner', current_setting('t.p'), 'logo',
  'logo', 'logo.jpg', 1000, 'image/jpeg'), 'P0001', 'a logo is PNG or SVG', 'file.type_not_allowed');
select test.raises(format('select api.file_begin(%L, %L, %L, %L, %L, %s, %L)', 'partner', current_setting('t.p'), 'logo',
  'logo', 'logo.png', 3 * 1048576, 'image/png'), 'P0001', 'a picture is at most 2 MB', 'file.too_large');
select test.raises(format('select api.file_begin(%L, %L, %L, %L, %L, %s, %L)', 'partner', current_setting('t.p'), 'no_such_kind',
  'attachment', 'a.pdf', 1000, 'application/pdf'), 'P0002', 'an unknown kind is refused', 'file.unknown_kind');
select test.raises(format('select api.file_begin(%L, %L, %L, %L, %L, %s, %L)', 'partner', current_setting('t.p'), 'other',
  'keepsake', 'a.pdf', 1000, 'application/pdf'), 'P0001', 'so is an unknown purpose', 'file.unknown_purpose');

select test.as_person(current_setting('t.viewer')::uuid);
select test.raises(format('select api.file_begin(%L, %L, %L, %L, %L, %s, %L)', 'partner', current_setting('t.p'), 'other',
  'attachment', 'a.pdf', 1000, 'application/pdf'), '42501', 'a viewer adds no file', 'access.needs_level');
