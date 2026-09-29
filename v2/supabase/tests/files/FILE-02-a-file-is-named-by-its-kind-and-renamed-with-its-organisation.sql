-- FILE-02 — a file's name is computed, live (V55): from its kind's pattern and the records it is linked to, in English
-- and Arabic ({partner official} is the official name — V77); renaming the organisation renames the file everywhere; an
-- open-ended contract says so; a token with no value leaves no gap; characters a file system refuses are replaced; a
-- pattern names only known tokens; the download carries the name, or the original one when the setting says so, and
-- the original name shows in the details while core.file_keep_original_name is on. Every value is made up.
-- Sabotage: supabase/tests/sabotage/a-file-name-ignores-its-records.sql.
select set_config('t.head', test.person('Test Head', 'head')::text, true);
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.day', to_char((now() at time zone 'Asia/Riyadh')::date, 'YYYY-MM-DD'), true);
select test.as_person(current_setting('t.head')::uuid);
select set_config('t.p', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Names',
  'official_name_en', 'Made Up Names Company LLC', 'trade_name_ar', 'الأسماء المتخيلة',
  'official_name_ar', 'شركة الأسماء المتخيلة المحدودة',
  'sides', '[{"side": "supplier_partner", "type": "supplier"}]'::jsonb)) ->> 'id', true);
select set_config('t.c', api.contract_save(current_setting('t.p')::uuid, null,
  '{"side": "supplier_partner", "title": "Hotel rates: 2027/28", "start_on": "2027-01-01", "end_on": "2027-12-31"}')
  ->> 'id', true);
select set_config('t.fb', api.file_begin('contract', current_setting('t.c')::uuid, 'contract', 'contract', 'signed scan.PDF',
  2000, 'application/pdf')::text, true);
select set_config('t.f', current_setting('t.fb')::jsonb ->> 'id', true);
select test.runs(format('insert into storage.objects (bucket_id, name) values (%L, %L)',
  current_setting('t.fb')::jsonb ->> 'bucket', current_setting('t.fb')::jsonb ->> 'path'), 'uploaded');
select api.file_finish(current_setting('t.f')::uuid, repeat('d', 64));

select set_config('t.row', (api.files('contract', current_setting('t.c')::uuid) -> 0)::text, true);
select test.eq(current_setting('t.row')::jsonb ->> 'display_name_en',
  'Contract · Made Up Names Company LLC · Hotel rates- 2027-28 · 2027-01-01 to 2027-12-31.pdf',
  'the name follows its kind''s pattern, a refused character replaced, the extension kept');
select test.eq(current_setting('t.row')::jsonb ->> 'display_name_ar',
  'عقد · شركة الأسماء المتخيلة المحدودة · Hotel rates- 2027-28 · 2027-01-01 إلى 2027-12-31.pdf', 'and in Arabic');
select test.eq(current_setting('t.row')::jsonb ->> 'original_name', 'signed scan.PDF', 'its original name is kept');
select test.eq(api.file_download(current_setting('t.f')::uuid, 'en') ->> 'download_name',
  'Contract · Made Up Names Company LLC · Hotel rates- 2027-28 · 2027-01-01 to 2027-12-31.pdf',
  'the download carries the name');
select test.eq((api.file_download(current_setting('t.f')::uuid) ->> 'expires_in')::int, 600, 'for 600 seconds');

select api.partner_update(current_setting('t.p')::uuid, '{"official_name_en": "Made Up Renamed Company LLC"}',
  (api.partner(current_setting('t.p')::uuid) ->> 'version')::int);
select api.contract_save(current_setting('t.p')::uuid, current_setting('t.c')::uuid, '{"end_on": null}', 1);
select test.eq(api.files('contract', current_setting('t.c')::uuid) -> 0 ->> 'display_name_en',
  'Contract · Made Up Renamed Company LLC · Hotel rates- 2027-28 · 2027-01-01 to open-ended.pdf',
  'renaming the organisation renames the file; an open-ended contract says so');

select test.as_person(current_setting('t.admin')::uuid);
select test.raises($$select api.list_save('file_kind', null, '{"key": "made_up_kind", "name_en": "Made up", "name_ar": "متخيل",
  "name_pattern_en": "{colour} · {date}", "name_pattern_ar": "{date}"}')$$, 'P0001', 'a pattern names only known tokens',
  'list.invalid');
select api.list_save('file_kind', null, '{"key": "made_up_kind", "name_en": "Made up", "name_ar": "متخيل",
  "name_pattern_en": "{title} · {partner} · {date}", "name_pattern_ar": "{partner} · {date}"}');
select test.as_person(current_setting('t.head')::uuid);
select set_config('t.gb', api.file_begin('partner', current_setting('t.p')::uuid, 'made_up_kind', 'attachment', 'notes.txt',
  10, 'text/plain')::text, true);
select set_config('t.g', current_setting('t.gb')::jsonb ->> 'id', true);
select test.runs(format('insert into storage.objects (bucket_id, name) values (%L, %L)',
  current_setting('t.gb')::jsonb ->> 'bucket', current_setting('t.gb')::jsonb ->> 'path'), 'uploaded');
select api.file_finish(current_setting('t.g')::uuid, repeat('e', 64));
select test.eq((select f ->> 'display_name_en' from jsonb_array_elements(api.files('partner', current_setting('t.p')::uuid)) f
                where f ->> 'id' = current_setting('t.g')), 'Made Up Names · ' || current_setting('t.day') || '.txt',
  'a token with no value leaves no gap');

select test.as_person(current_setting('t.admin')::uuid);
select api.setting_set('core.file_download_display_name', null, 'false', null, 'made up: keep the names people chose');
select api.setting_set('core.file_keep_original_name', null, 'false', null, 'made up: hide them');
select test.as_person(current_setting('t.head')::uuid);
select test.eq(api.file_download(current_setting('t.f')::uuid) ->> 'download_name', 'signed scan.PDF',
  'with core.file_download_display_name off, the download keeps the original name');
select test.eq(api.files('contract', current_setting('t.c')::uuid) -> 0 ->> 'original_name', null::text,
  'with core.file_keep_original_name off, the details do not show it');
