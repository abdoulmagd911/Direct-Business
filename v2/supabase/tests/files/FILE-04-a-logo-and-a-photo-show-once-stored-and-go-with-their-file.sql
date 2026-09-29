-- FILE-04 — logos and photos (V53, V9): a logo uploaded on an organisation (shared by its sides) becomes its logo once
-- stored, in the images bucket, and shows on its card and hover card; a person uploads only their own photo, which
-- becomes their avatar; removing a file takes the logo or photo with it — its uploader, an admin or Full on the
-- organisation may, a viewer may not — and one Undo brings both back. Every value is made up.
-- Sabotage: supabase/tests/sabotage/a-stored-logo-shows-nowhere.sql.
select set_config('t.head', test.person('Test Head', 'head')::text, true);
select set_config('t.am1', test.person('Test Account Manager', 'member')::text, true);
select set_config('t.viewer', test.person('Test Viewer', 'viewer')::text, true);

select test.as_person(current_setting('t.head')::uuid);
select set_config('t.p', api.partner_create('{"trade_name_en": "Made Up Logo Co",
  "sides": [{"side": "client", "type": "corporate"}, {"side": "supplier_partner", "type": "supplier"}]}') ->> 'id', true);
select test.raises(format('select api.file_begin(%L, %L, %L, %L, %L, %s, %L, null, %L)', 'partner', current_setting('t.p'),
  'logo', 'logo', 'mark.svg', 4000, 'image/svg+xml', 'client'), 'P0001', 'a logo is the whole organisation''s, not a side''s',
  'file.logo_is_an_organisations');
select set_config('t.l', api.file_begin('partner', current_setting('t.p')::uuid, 'logo', 'logo', 'mark.svg', 4000,
  'image/svg+xml')::text, true);
select test.eq(current_setting('t.l')::jsonb ->> 'bucket', 'images', 'a logo goes to the images bucket');
select test.eq(api.partner(current_setting('t.p')::uuid) ->> 'logo_file_id', null::text, 'it is no logo while pending');
select test.runs(format('insert into storage.objects (bucket_id, name) values (%L, %L)', 'images',
  current_setting('t.l')::jsonb ->> 'path'), 'uploaded');
select test.eq(api.file_finish((current_setting('t.l')::jsonb ->> 'id')::uuid, repeat('f', 64)) ->> 'display_name_en',
  'Logo · Made Up Logo Co.svg', 'stored, named by its kind');
select test.eq(api.partner(current_setting('t.p')::uuid) ->> 'logo_file_id', current_setting('t.l')::jsonb ->> 'id',
  'then it is the organisation''s logo');
select test.eq(api.hover_partner(current_setting('t.p')::uuid) ->> 'logo_file_id', current_setting('t.l')::jsonb ->> 'id',
  'on its hover card too');
select test.eq((api.file_download((current_setting('t.l')::jsonb ->> 'id')::uuid) ->> 'expires_in')::int, 86400,
  'a picture is read through a 24-hour link');
select test.raises(format('select api.file_begin(%L, %L, %L, %L, %L, %s, %L)', 'person', current_setting('t.am1'), 'avatar',
  'avatar', 'someone.png', 4000, 'image/png'), '42501', 'nobody uploads another person''s photo', 'file.avatar_is_your_own');

select test.as_person(current_setting('t.am1')::uuid);
select set_config('t.a', api.file_begin('person', current_setting('t.am1')::uuid, 'avatar', 'avatar', 'me.jpg', 4000,
  'image/jpeg')::text, true);
select test.runs(format('insert into storage.objects (bucket_id, name) values (%L, %L)', 'images',
  current_setting('t.a')::jsonb ->> 'path'), 'uploaded');
select api.file_finish((current_setting('t.a')::jsonb ->> 'id')::uuid, repeat('e', 64));
select test.eq(api.hover_person(current_setting('t.am1')::uuid) ->> 'avatar_file_id', current_setting('t.a')::jsonb ->> 'id',
  'a person''s own photo becomes their avatar, their profile made on the way');

select test.as_person(current_setting('t.viewer')::uuid);
select test.raises(format('select api.files_remove(array[%L]::uuid[])', current_setting('t.l')::jsonb ->> 'id'), '42501',
  'a viewer removes no file', 'file.not_yours');
select test.as_person(current_setting('t.am1')::uuid);
select set_config('t.r', api.files_remove(array[(current_setting('t.l')::jsonb ->> 'id')::uuid], 'made up: the old mark')
  ->> 'request_id', true);
select test.eq(api.partner(current_setting('t.p')::uuid) ->> 'logo_file_id', null::text,
  'Full on the organisation removes the logo file, and it has no logo');
select test.eq(jsonb_array_length(api.files('partner', current_setting('t.p')::uuid)), 0, 'nor the file');
select api.undo(current_setting('t.r')::uuid);
select test.eq(api.partner(current_setting('t.p')::uuid) ->> 'logo_file_id', current_setting('t.l')::jsonb ->> 'id',
  'one Undo brings the logo back');
select test.eq(jsonb_array_length(api.files('partner', current_setting('t.p')::uuid)), 1, 'with its file');
