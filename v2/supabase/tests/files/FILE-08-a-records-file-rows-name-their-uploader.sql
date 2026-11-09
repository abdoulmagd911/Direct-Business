-- FILE-08 — a record's file rows name their uploader (FIX-46, F026): api.files and api.company_files answer
-- added_by_name — the stored link name, else the uploader's English display name — as api.all_files already
-- does, so a file row reads the same name on its record as on /files. Every value is made up.
select set_config('t.uploader', test.person('Test Uploader', 'member')::text, true);
select test.as_person(current_setting('t.uploader')::uuid);
select set_config('t.p', api.partner_create('{"trade_name_en": "Made Up Uploader Co",
  "sides": [{"side": "client", "type": "corporate"}]}') ->> 'id', true);
select set_config('t.f', api.file_begin('partner', current_setting('t.p')::uuid, 'rate_sheet', 'attachment',
  'rates 2027.PDF', 1000, 'application/pdf')::text, true);
select test.runs(format('insert into storage.objects (bucket_id, name) values (%L, %L)', 'files',
  current_setting('t.f')::jsonb ->> 'path'), 'its uploader writes it');
select test.eq(api.file_finish((current_setting('t.f')::jsonb ->> 'id')::uuid, repeat('C', 64)) ->> 'id',
  current_setting('t.f')::jsonb ->> 'id', 'then it is stored');
select test.eq(api.files('partner', current_setting('t.p')::uuid) -> 0 ->> 'added_by',
  current_setting('t.uploader'), 'the record files still name the uploader by id');
select test.eq(api.files('partner', current_setting('t.p')::uuid) -> 0 ->> 'added_by_name',
  'Test Uploader', 'and by name, as /files does');
select test.eq(api.company_files(current_setting('t.p')::uuid) -> 0 ->> 'added_by_name',
  'Test Uploader', 'the partner files list names the uploader too');
