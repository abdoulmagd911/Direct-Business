-- MRG-02 — a merge moves the timeline, the files and the contracts too (V136, V141): after it, the merged partner's
-- notes, files and contracts belong to the kept one — its logo as well when the kept one has none — and one Undo takes
-- them all back. Every value is made up.
-- Sabotage: supabase/tests/sabotage/a-merge-leaves-the-notes.sql.
select set_config('t.head', test.person('Test Head', 'head')::text, true);
select test.as_person(current_setting('t.head')::uuid);
select set_config('t.kept', api.partner_create('{"trade_name_en": "Made Up Kept Co"}') ->> 'id', true);
select set_config('t.gone', api.partner_create('{"trade_name_en": "Made Up Kept Co Twin"}') ->> 'id', true);
select api.note_add('partner', current_setting('t.gone')::uuid, 'comment', 'Made-up note on the twin');
select api.partner_log_call(current_setting('t.gone')::uuid, 'answered');
select api.contract_save(current_setting('t.gone')::uuid, null, '{"title": "Made-up twin contract", "start_on": "2027-01-01"}');
select set_config('t.doc', api.file_begin('partner', current_setting('t.gone')::uuid, 'certificate', 'attachment', 'cert.pdf',
  1000, 'application/pdf')::text, true);
select set_config('t.logo', api.file_begin('partner', current_setting('t.gone')::uuid, 'logo', 'logo', 'twin.png', 1000,
  'image/png')::text, true);
select test.runs(format('insert into storage.objects (bucket_id, name) values (%L, %L), (%L, %L)',
  'files', current_setting('t.doc')::jsonb ->> 'path', 'images', current_setting('t.logo')::jsonb ->> 'path'), 'uploaded');
select api.file_finish((current_setting('t.doc')::jsonb ->> 'id')::uuid, repeat('a', 64));
select api.file_finish((current_setting('t.logo')::jsonb ->> 'id')::uuid, repeat('b', 64));

select set_config('t.r', api.partner_merge(current_setting('t.kept')::uuid, current_setting('t.gone')::uuid,
  'made up: the same company twice') ->> 'request_id', true);
select test.eq(jsonb_array_length(api.notes('partner', current_setting('t.kept')::uuid)), 2,
  'the merged partner''s notes and calls are on the kept one''s timeline');
select test.eq(jsonb_array_length(api.contracts(current_setting('t.kept')::uuid)), 1, 'its contracts are the kept one''s');
select test.eq(jsonb_array_length(api.files('partner', current_setting('t.kept')::uuid)), 2, 'and its files');
select test.eq(api.partner(current_setting('t.kept')::uuid) ->> 'logo_file_id', current_setting('t.logo')::jsonb ->> 'id',
  'its logo too, the kept one having none');
select test.eq(jsonb_array_length(api.notes('partner', current_setting('t.gone')::uuid)), 0, 'the merged one keeps none');

select api.undo(current_setting('t.r')::uuid);
select test.eq(jsonb_array_length(api.notes('partner', current_setting('t.gone')::uuid)), 2, 'one Undo takes the notes back');
select test.eq(jsonb_array_length(api.contracts(current_setting('t.gone')::uuid)), 1, 'the contracts');
select test.eq(jsonb_array_length(api.files('partner', current_setting('t.gone')::uuid)), 2, 'the files');
select test.eq(api.partner(current_setting('t.kept')::uuid) ->> 'logo_file_id', null::text, 'and the logo');
