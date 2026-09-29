-- FILE-03 — who sees a file (§3.4, D10): a file linked to an organisation is seen by those who see it; a restricted
-- file (an IBAN letter, an agreement) only with files.restricted — managers and admins — or by its uploader; a pending
-- file only by its uploader; pictures by everyone signed in. Storage's own rule answers the same, so no signed URL can
-- be made for what is refused. Every value is made up.
-- Sabotage: supabase/tests/sabotage/a-restricted-file-shows-to-everyone.sql.
select set_config('t.am1', test.person('Test Account Manager', 'member')::text, true);
select set_config('t.other', test.person('Test Other Member', 'member')::text, true);
select set_config('t.manager', test.person('Test Manager', 'manager')::text, true);
select set_config('t.outsider', test.person('Test Outsider', 'member')::text, true);
insert into core.person_page_level (person_id, page_key, level, reason)
values (current_setting('t.outsider')::uuid, 'clients', 'none', 'made up: no clients'),
       (current_setting('t.outsider')::uuid, 'suppliers_partners', 'none', 'made up: no suppliers');

select test.as_person(current_setting('t.am1')::uuid);
select set_config('t.p', api.partner_create('{"trade_name_en": "Made Up Seen Co",
  "sides": [{"side": "client", "type": "corporate"}]}') ->> 'id', true);
select set_config('t.plain', api.file_begin('partner', current_setting('t.p')::uuid, 'certificate', 'attachment',
  'certificate.pdf', 1000, 'application/pdf')::text, true);
select set_config('t.iban', api.file_begin('partner', current_setting('t.p')::uuid, 'other', 'iban_letter',
  'bank letter.pdf', 1000, 'application/pdf')::text, true);
select set_config('t.logo', api.file_begin('partner', current_setting('t.p')::uuid, 'logo', 'logo', 'logo.png', 5000,
  'image/png')::text, true);
select set_config('t.late', api.file_begin('partner', current_setting('t.p')::uuid, 'other', 'attachment', 'draft.pdf',
  1000, 'application/pdf')::text, true);
select test.runs(format('insert into storage.objects (bucket_id, name) values (%L, %L), (%L, %L), (%L, %L), (%L, %L)',
  current_setting('t.plain')::jsonb ->> 'bucket', current_setting('t.plain')::jsonb ->> 'path',
  current_setting('t.iban')::jsonb ->> 'bucket', current_setting('t.iban')::jsonb ->> 'path',
  current_setting('t.logo')::jsonb ->> 'bucket', current_setting('t.logo')::jsonb ->> 'path',
  current_setting('t.late')::jsonb ->> 'bucket', current_setting('t.late')::jsonb ->> 'path'), 'all four uploaded');
select api.file_finish((current_setting('t.plain')::jsonb ->> 'id')::uuid, repeat('1', 64));
select api.file_finish((current_setting('t.iban')::jsonb ->> 'id')::uuid, repeat('2', 64));
select api.file_finish((current_setting('t.logo')::jsonb ->> 'id')::uuid, repeat('3', 64));
select test.eq(jsonb_array_length(api.files('partner', current_setting('t.p')::uuid)), 4,
  'its uploader sees all four, the restricted and the pending one included');

select test.as_person(current_setting('t.other')::uuid);
select test.eq((select jsonb_agg(f ->> 'purpose' order by f ->> 'purpose') from jsonb_array_elements(
  api.files('partner', current_setting('t.p')::uuid)) f), '["attachment", "logo"]'::jsonb,
  'a team member sees the plain file and the logo — not the restricted one, nor another''s pending file');
select test.eq((select count(*)::int from storage.objects where name = current_setting('t.iban')::jsonb ->> 'path'), 0,
  'Storage shows them no restricted file either');
select test.eq((select count(*)::int from storage.objects where name = current_setting('t.late')::jsonb ->> 'path'), 0,
  'nor a pending one');
select test.raises(format('select api.file_download(%L)', current_setting('t.iban')::jsonb ->> 'id'), '42501',
  'and gives no download of it', 'file.cannot_see');
select test.eq((select count(*)::int from storage.objects where name = current_setting('t.plain')::jsonb ->> 'path'), 1,
  'the plain file they may read');

select test.as_person(current_setting('t.manager')::uuid);
select test.eq((api.file_download((current_setting('t.iban')::jsonb ->> 'id')::uuid) ->> 'bucket'), 'files',
  'a manager (files.restricted) downloads the restricted file');
select test.eq((select count(*)::int from storage.objects where name = current_setting('t.iban')::jsonb ->> 'path'), 1,
  'and Storage lets them');

select test.as_person(current_setting('t.outsider')::uuid);
select test.raises(format('select api.files(%L, %L)', 'partner', current_setting('t.p')), '42501',
  'a person who sees neither side sees no organisation''s files', 'access.needs_level');
select test.eq((select count(*)::int from storage.objects where name = current_setting('t.plain')::jsonb ->> 'path'), 0,
  'Storage agrees');
select test.eq((select count(*)::int from storage.objects where name = current_setting('t.logo')::jsonb ->> 'path'), 1,
  'but pictures are for everyone signed in');
select test.as_anon();
do $$
declare
  n int;
begin
  begin
    select count(*) into n from storage.objects;
  exception when insufficient_privilege then
    n := 0;   -- the plain-Postgres stand-in grants anon nothing; Supabase grants a read that the rules leave empty
  end;
  perform test.eq(n, 0, 'and nobody signed out sees any file');
end $$;
