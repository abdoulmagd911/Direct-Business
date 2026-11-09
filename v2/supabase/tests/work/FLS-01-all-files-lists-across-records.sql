-- FLS-01 — the all-files listing (Phase 3): one file on each record type is uploaded, appears in
-- api.all_files with its stored label and link, downloads, and is removed with a reason; a restricted file
-- (an agreement) is hidden from a member and a viewer and visible to a manager and to its uploader; a pending
-- file is visible only to its uploader; a download stops working once the parent record stops being visible to
-- that person; the archive filters, the total count before paging, the sorts and the live filter options all
-- read from the listing; a rename updates the stored label; and the company's five kinds still behave exactly
-- as today (api.files and api.company_files). Every value is made up.
select set_config('t.head', test.person('Test FLS Head', 'head')::text, true);
select set_config('t.own', test.person('Test FLS Owner', 'member')::text, true);
select set_config('t.help', test.person('Test FLS Helper', 'member')::text, true);
select set_config('t.peer', test.person('Test FLS Peer', 'member')::text, true);
select set_config('t.far', test.person('Test FLS Far Head', 'head', 'test_other_dept')::text, true);
select set_config('t.viewer', test.person('Test FLS Viewer', 'viewer')::text, true);
select set_config('t.manager', test.person('Test FLS Manager', 'manager')::text, true);
select set_config('t.admin', test.person('Test FLS Admin', 'admin')::text, true);
insert into core.team (department_id, code, name_en, name_ar)
values (test.department('commercial'), 'test_fls', 'Test All Files Desk', 'فريق كل الملفات');
update core.person set team_id = (select id from core.team where code = 'test_fls')
where id in (current_setting('t.head')::uuid, current_setting('t.own')::uuid, current_setting('t.help')::uuid,
             current_setting('t.peer')::uuid, current_setting('t.viewer')::uuid,
             current_setting('t.manager')::uuid);
insert into core.setting (key, value, valid_from, reason, created_by)
values ('app.go_live_on', to_jsonb((core.riyadh_today() - 30)::text), core.riyadh_today() - 30, 'made up: go-live',
        current_setting('t.admin')::uuid);

-- the records: a task, an achievement, a private note, a partner, an import batch, a campaign code
select test.as_person(current_setting('t.own')::uuid);
select set_config('t.t', api.task_create(jsonb_build_object('title', 'Made-up FLS task',
  'work_type', 'internal')) ->> 'id', true);
select api.task_helpers_set(current_setting('t.t')::uuid, array[current_setting('t.help')::uuid]);
select set_config('t.p', api.partner_create('{"trade_name_en": "Made Up FLS Co",
  "sides": [{"side": "client", "type": "corporate"}]}') ->> 'id', true);
select set_config('t.n', api.note_capture('sticky', jsonb_build_object('title', 'Made-up FLS note')) ->> 'id', true);
select test.as_person(current_setting('t.admin')::uuid);
select api.plan_open(test.department('commercial'), 2026);
select test.as_person(current_setting('t.own')::uuid);
select set_config('t.a', api.achievement_log(jsonb_build_object('category', 'AWARD', 'title', 'Made-up FLS work',
  'happened_on', '2026-09-21')) ->> 'id', true);
select test.as_person(current_setting('t.head')::uuid);
select set_config('t.b', api.import_batch_start(current_setting('t.p')::uuid, 'invoice_export', 'made-up.csv')
  ->> 'id', true);
select set_config('t.cc', api.campaign_code_add('FLS10', 'Made-up FLS code', '2027-03-01', '2027-03-31', null,
  'made up') ->> 'id', true);

-- one file on each record type, uploaded and finished — plus a pending file on the task
select test.as_person(current_setting('t.own')::uuid);
select set_config('t.ft', api.file_begin('task', current_setting('t.t')::uuid, 'evidence', 'evidence',
  'task proof.pdf', 3000, 'application/pdf')::text, true);
select test.runs(format('insert into storage.objects (bucket_id, name) values (%L, %L)',
  current_setting('t.ft')::jsonb ->> 'bucket', current_setting('t.ft')::jsonb ->> 'path'), 'task file uploaded');
select api.file_finish((current_setting('t.ft')::jsonb ->> 'id')::uuid, repeat('1', 64));
select set_config('t.fa', api.file_begin('achievement', current_setting('t.a')::uuid, 'evidence', 'evidence',
  'achievement proof.pdf', 2000, 'application/pdf')::text, true);
select test.runs(format('insert into storage.objects (bucket_id, name) values (%L, %L)',
  current_setting('t.fa')::jsonb ->> 'bucket', current_setting('t.fa')::jsonb ->> 'path'),
  'achievement file uploaded');
select api.file_finish((current_setting('t.fa')::jsonb ->> 'id')::uuid, repeat('2', 64));
select set_config('t.fn', api.file_begin('my_note', current_setting('t.n')::uuid, 'evidence', 'evidence',
  'note proof.pdf', 1000, 'application/pdf')::text, true);
select test.runs(format('insert into storage.objects (bucket_id, name) values (%L, %L)',
  current_setting('t.fn')::jsonb ->> 'bucket', current_setting('t.fn')::jsonb ->> 'path'), 'note file uploaded');
select api.file_finish((current_setting('t.fn')::jsonb ->> 'id')::uuid, repeat('3', 64));
select set_config('t.fp', api.file_begin('partner', current_setting('t.p')::uuid, 'certificate', 'attachment',
  'certificate.pdf', 4000, 'application/pdf')::text, true);
select test.runs(format('insert into storage.objects (bucket_id, name) values (%L, %L)',
  current_setting('t.fp')::jsonb ->> 'bucket', current_setting('t.fp')::jsonb ->> 'path'),
  'partner file uploaded');
select api.file_finish((current_setting('t.fp')::jsonb ->> 'id')::uuid, repeat('4', 64));
select set_config('t.fag', api.file_begin('partner', current_setting('t.p')::uuid, 'agreement', 'agreement',
  'agreement.pdf', 5000, 'application/pdf', null, null, core.riyadh_today() + 30)::text, true);
select test.runs(format('insert into storage.objects (bucket_id, name) values (%L, %L)',
  current_setting('t.fag')::jsonb ->> 'bucket', current_setting('t.fag')::jsonb ->> 'path'),
  'agreement uploaded');
select api.file_finish((current_setting('t.fag')::jsonb ->> 'id')::uuid, repeat('5', 64));
select set_config('t.fpend', api.file_begin('task', current_setting('t.t')::uuid, 'other', 'attachment',
  'draft.pdf', 1500, 'application/pdf')::text, true);
select test.as_person(current_setting('t.head')::uuid);
select set_config('t.fb', api.file_begin('import_batch', current_setting('t.b')::uuid, 'import_file', 'evidence',
  'import source.pdf', 2500, 'application/pdf')::text, true);
select test.runs(format('insert into storage.objects (bucket_id, name) values (%L, %L)',
  current_setting('t.fb')::jsonb ->> 'bucket', current_setting('t.fb')::jsonb ->> 'path'),
  'import source file uploaded');
select api.file_finish((current_setting('t.fb')::jsonb ->> 'id')::uuid, repeat('6', 64));
select set_config('t.fc', api.file_begin('campaign_code', current_setting('t.cc')::uuid, 'evidence', 'evidence',
  'code proof.pdf', 1200, 'application/pdf')::text, true);
select test.runs(format('insert into storage.objects (bucket_id, name) values (%L, %L)',
  current_setting('t.fc')::jsonb ->> 'bucket', current_setting('t.fc')::jsonb ->> 'path'),
  'campaign code file uploaded');
select api.file_finish((current_setting('t.fc')::jsonb ->> 'id')::uuid, repeat('7', 64));

-- the company's other four kinds, as today (agreement is already above)
select test.as_person(current_setting('t.own')::uuid);
select set_config('t.fcr', api.file_begin('partner', current_setting('t.p')::uuid, 'cr_certificate', 'attachment',
  'cr.pdf', 1100, 'application/pdf', null, 'client')::text, true);
select test.runs(format('insert into storage.objects (bucket_id, name) values (%L, %L)',
  current_setting('t.fcr')::jsonb ->> 'bucket', current_setting('t.fcr')::jsonb ->> 'path'), 'CR uploaded');
select api.file_finish((current_setting('t.fcr')::jsonb ->> 'id')::uuid, repeat('8', 64));
select set_config('t.fvat', api.file_begin('partner', current_setting('t.p')::uuid, 'vat_certificate', 'attachment',
  'vat.pdf', 1200, 'application/pdf')::text, true);
select test.runs(format('insert into storage.objects (bucket_id, name) values (%L, %L)',
  current_setting('t.fvat')::jsonb ->> 'bucket', current_setting('t.fvat')::jsonb ->> 'path'), 'VAT uploaded');
select api.file_finish((current_setting('t.fvat')::jsonb ->> 'id')::uuid, repeat('9', 64));
select set_config('t.fna', api.file_begin('partner', current_setting('t.p')::uuid, 'national_address', 'attachment',
  'national.pdf', 1300, 'application/pdf')::text, true);
select test.runs(format('insert into storage.objects (bucket_id, name) values (%L, %L)',
  current_setting('t.fna')::jsonb ->> 'bucket', current_setting('t.fna')::jsonb ->> 'path'),
  'national address uploaded');
select api.file_finish((current_setting('t.fna')::jsonb ->> 'id')::uuid, repeat('a', 64));
select set_config('t.ftd', api.file_begin('partner', current_setting('t.p')::uuid, 'tender_document', 'tender',
  'tender.pdf', 1400, 'application/pdf')::text, true);
select test.runs(format('insert into storage.objects (bucket_id, name) values (%L, %L)',
  current_setting('t.ftd')::jsonb ->> 'bucket', current_setting('t.ftd')::jsonb ->> 'path'),
  'letter of award uploaded');
select api.file_finish((current_setting('t.ftd')::jsonb ->> 'id')::uuid, repeat('b', 64));

-- the label, link and uploader name are stored on the link row at write time
select test.as_owner();
select test.ok((select record_label from core.file_link
                where file_id = (current_setting('t.ft')::jsonb ->> 'id')::uuid) like '%Made-up FLS task%',
  'the task file carries the task''s label');
select test.ok((select record_link from core.file_link
                where file_id = (current_setting('t.ft')::jsonb ->> 'id')::uuid) like '/tasks/%',
  'and its link lands on the task');
select test.eq((select record_label from core.file_link
                where file_id = (current_setting('t.fa')::jsonb ->> 'id')::uuid),
  (select number || ' · ' || title from perf.achievement where id = current_setting('t.a')::uuid),
  'the achievement file carries its number and title');
select test.eq((select record_label from core.file_link
                where file_id = (current_setting('t.fn')::jsonb ->> 'id')::uuid), 'Made-up FLS note',
  'the note file carries the note''s title');
select test.ok((select record_label from core.file_link
                where file_id = (current_setting('t.fp')::jsonb ->> 'id')::uuid) like '%Made Up FLS Co%',
  'the partner file carries the partner''s name');
select test.eq((select record_label from core.file_link
                where file_id = (current_setting('t.fb')::jsonb ->> 'id')::uuid), 'made-up.csv',
  'the import file carries the batch''s file name');
select test.eq((select record_label from core.file_link
                where file_id = (current_setting('t.fc')::jsonb ->> 'id')::uuid), 'FLS10',
  'the campaign code file carries the code');
select test.ok((select added_by_name from core.file_link
                where file_id = (current_setting('t.ft')::jsonb ->> 'id')::uuid) is not null,
  'and the uploader''s name is stored with it');
select test.eq((select sensitivity from core.file_kind where key = 'import_file'), 'restricted',
  'the import_file kind starts restricted');

-- upload → appears in the list, per record type, with the row's label, link and uploader
select test.as_person(current_setting('t.own')::uuid);
select test.eq((api.all_files(p_entity => 'work.task', p_status => 'stored') ->> 'total')::int, 1,
  'the task''s stored file lists under work.task');
select test.eq(api.all_files(p_entity => 'work.task', p_status => 'stored') -> 'rows' -> 0 ->> 'original_name',
  'task proof.pdf', 'with its original name');
select test.eq(api.all_files(p_entity => 'perf.achievement') ->> 'total', '1',
  'the achievement''s file lists under perf.achievement');
select test.eq(api.all_files(p_entity => 'my.note') ->> 'total', '1',
  'the note''s file lists under my.note');
select test.eq((api.all_files(p_entity => 'partner.partner') ->> 'total')::int, 6,
  'the partner''s six files list under partner.partner');
select test.as_person(current_setting('t.head')::uuid);
select test.eq(api.all_files(p_entity => 'work.import_batch') ->> 'total', '1',
  'the import file lists under work.import_batch, for its uploader');
select test.eq(api.all_files(p_entity => 'finance.import_batch') ->> 'total', '1',
  'and under the spec''s finance.import_batch spelling');
select test.as_person(current_setting('t.own')::uuid);
select test.eq((api.all_files(p_entity => 'work.import_batch') ->> 'total')::int, 0,
  'but not to a member without files.restricted: the import file starts restricted');
select test.eq(api.all_files(p_entity => 'partner.campaign_code') ->> 'total', '1',
  'the code''s file lists under partner.campaign_code');
select test.eq(api.all_files(p_entity => 'work.task', p_status => 'stored') -> 'rows' -> 0 ->> 'added_by',
  current_setting('t.own'), 'the row names its uploader');
select test.ok((api.all_files(p_entity => 'work.task', p_status => 'stored') -> 'rows' -> 0 ->> 'added_by_name')
  is not null, 'and shows the uploader''s name');
select test.eq(api.all_files(p_entity => 'partner.campaign_code') -> 'rows' -> 0 ->> 'record_link', '/codes',
  'a code file''s row links to Codes');
select test.eq(api.all_files(p_entity => 'my.note') -> 'rows' -> 0 ->> 'record_link',
  '/my-day/notes/' || current_setting('t.n'), 'a note file''s row links to the note');

-- download works, per record type
select test.eq((api.file_download((current_setting('t.ft')::jsonb ->> 'id')::uuid) ->> 'bucket'), 'files',
  'the task file downloads');
select test.eq((api.file_download((current_setting('t.fa')::jsonb ->> 'id')::uuid) ->> 'bucket'), 'files',
  'the achievement file downloads');
select test.eq((api.file_download((current_setting('t.fn')::jsonb ->> 'id')::uuid) ->> 'bucket'), 'files',
  'the note file downloads');
select test.eq((api.file_download((current_setting('t.fp')::jsonb ->> 'id')::uuid) ->> 'bucket'), 'files',
  'the partner file downloads');
select test.as_person(current_setting('t.head')::uuid);
select test.eq((api.file_download((current_setting('t.fb')::jsonb ->> 'id')::uuid) ->> 'bucket'), 'files',
  'the import file downloads, for its uploader');
select test.as_person(current_setting('t.own')::uuid);
select test.eq((api.file_download((current_setting('t.fc')::jsonb ->> 'id')::uuid) ->> 'bucket'), 'files',
  'the code file downloads');

-- visibility: a restricted file (the agreement) is hidden from a member and a viewer, visible to a manager
select test.as_person(current_setting('t.peer')::uuid);
select test.eq((select count(*)::int from jsonb_array_elements(
  api.all_files(p_entity => 'partner.partner') -> 'rows') r where r ->> 'kind' = 'agreement'), 0,
  'a member sees none of the partner''s agreement');
select test.as_person(current_setting('t.viewer')::uuid);
select test.eq((select count(*)::int from jsonb_array_elements(
  api.all_files(p_entity => 'partner.partner') -> 'rows') r where r ->> 'kind' = 'agreement'), 0,
  'nor does a viewer');
select test.as_person(current_setting('t.manager')::uuid);
select test.eq((select count(*)::int from jsonb_array_elements(
  api.all_files(p_entity => 'partner.partner') -> 'rows') r where r ->> 'kind' = 'agreement'), 1,
  'a manager sees the agreement');
select test.as_person(current_setting('t.own')::uuid);
select test.eq((select count(*)::int from jsonb_array_elements(
  api.all_files(p_entity => 'partner.partner') -> 'rows') r where r ->> 'kind' = 'agreement'), 1,
  'and its uploader sees it');

-- a pending file is visible only to its uploader
select test.as_person(current_setting('t.peer')::uuid);
select test.eq((api.all_files(p_entity => 'work.task', p_status => 'pending') ->> 'total')::int, 0,
  'a colleague sees none of another''s pending file');
select test.as_person(current_setting('t.own')::uuid);
select test.eq((api.all_files(p_entity => 'work.task', p_status => 'pending') ->> 'total')::int, 1,
  'its uploader sees it');
select test.eq(api.all_files(p_entity => 'work.task', p_status => 'pending') -> 'rows' -> 0 ->> 'status', 'pending',
  'as pending');

-- a head of another department reads none of the task's files
select test.as_person(current_setting('t.far')::uuid);
select test.eq((api.all_files(p_entity => 'work.task') ->> 'total')::int, 0,
  'a head of another department reads none of the task''s files');

-- a download stops working once the parent record stops being visible to that person
select test.as_person(current_setting('t.peer')::uuid);
select test.eq((api.file_download((current_setting('t.fp')::jsonb ->> 'id')::uuid) ->> 'bucket'), 'files',
  'a colleague downloads the partner file while they may see the partner');
select test.as_owner();
insert into core.person_page_level (person_id, page_key, level, reason)
values (current_setting('t.peer')::uuid, 'clients', 'none', 'made up: no clients any more'),
       (current_setting('t.peer')::uuid, 'suppliers_partners', 'none', 'made up: no suppliers any more');
select test.as_person(current_setting('t.peer')::uuid);
select test.raises(format('select api.file_download(%L)',
  (current_setting('t.fp')::jsonb ->> 'id')::uuid), '42501',
  'once they may no longer see the partner, the download is refused', 'file.cannot_see');
select test.eq((api.all_files(p_entity => 'partner.partner') ->> 'total')::int, 0,
  'and the listing hides the partner''s files from them too');

-- the archive filters, as the uploader (who sees everything here)
select test.as_person(current_setting('t.own')::uuid);
select test.eq((api.all_files(p_search => 'proof') ->> 'total')::int, 4,
  'search by file name finds the four proof files');
select test.eq((api.all_files(p_search => 'Made-up FLS task') ->> 'total')::int, 2,
  'search by record label finds the task''s files');
select test.eq((api.all_files(p_search => 'made up fls co') ->> 'total')::int, 6,
  'search by record label finds the partner''s files');
select test.eq((api.all_files(p_kind => 'evidence') ->> 'total')::int, 4,
  'the kind filter finds the evidence files a member may see');
select test.eq((api.all_files(p_uploader => current_setting('t.head')::uuid) ->> 'total')::int, 1,
  'the added-by filter finds the head''s file a member may see');
select test.eq((api.all_files(p_from => core.riyadh_today()) ->> 'total')::int, 11,
  'the date filter finds today''s eleven files a member may see');
select test.eq((api.all_files(p_to => core.riyadh_today() - 1) ->> 'total')::int, 0,
  'and none before today');
select test.eq((api.all_files(p_purpose => 'tender') ->> 'total')::int, 1,
  'the purpose filter finds the letter of award');
select test.eq((api.all_files(p_side => 'client') ->> 'total')::int, 1,
  'the side filter finds the client-side file');
select test.eq((api.all_files(p_status => 'pending') ->> 'total')::int, 1,
  'the status filter finds the pending file');
select test.eq((api.all_files(p_limit => 2) ->> 'total')::int, 11,
  'paging keeps the total of the whole filtered set');
select test.eq(jsonb_array_length(api.all_files(p_limit => 2) -> 'rows'), 2,
  'and returns only the page asked for');
select test.eq(api.all_files(p_sort => 'name', p_limit => 1) -> 'rows' -> 0 ->> 'original_name',
  'agreement.pdf', 'sorted by name, the first is the agreement''s (its displayed name starts with Agreement)');
select test.eq((api.all_files(p_sort => 'size', p_limit => 1) -> 'rows' -> 0 ->> 'size')::int, 5000,
  'sorted by size, the first is the biggest');
select test.eq(api.all_files() -> 'rows' -> 0 ->> 'status', 'stored',
  'newest first by default');
select test.ok(((api.all_files() -> 'facets' -> 'purposes') @> '"evidence"'::jsonb),
  'the live purpose options include evidence');
select test.ok(((api.all_files() -> 'facets' -> 'statuses') @> '"pending"'::jsonb),
  'the live status options include pending');
select test.ok(((api.all_files() -> 'facets' -> 'sides') @> '"client"'::jsonb),
  'the live side options include client');
select test.eq(jsonb_array_length(api.all_files() -> 'uploaders'), 2,
  'the live uploader options are the two uploaders');
select test.raises($$select api.all_files(p_entity => 'no.such_thing')$$, 'P0001',
  'an unknown record type is refused', 'file.unknown_entity');
select test.raises($$select api.all_files(p_kind => 'no_such_kind')$$, 'P0001',
  'an unknown kind is refused', 'file.unknown_kind');

-- a rename updates the stored label
select test.as_owner();
update partner.partner set trade_name_en = 'Made Up FLS Renamed Co' where id = current_setting('t.p')::uuid;
select test.ok((select record_label from core.file_link
                where file_id = (current_setting('t.fp')::jsonb ->> 'id')::uuid) like '%Renamed%',
  'renaming the partner updates the stored label');
select test.as_person(current_setting('t.own')::uuid);
select test.ok((api.all_files(p_entity => 'partner.partner', p_kind => 'certificate')
                -> 'rows' -> 0 ->> 'record_label') like '%Renamed%',
  'and the listing shows the new name');

-- remove with a reason works, per record type (the note's file goes)
select api.files_remove(array[(current_setting('t.fn')::jsonb ->> 'id')::uuid], 'made up: no longer needed');
select test.eq((api.all_files(p_entity => 'my.note') ->> 'total')::int, 0,
  'the removed file leaves the listing');
select test.eq(jsonb_array_length(api.files('my_note', current_setting('t.n')::uuid)), 0,
  'and the record''s own files');

-- company regression: the five kinds still behave exactly as today
select test.eq((select count(*)::int from jsonb_array_elements(api.files('partner', current_setting('t.p')::uuid)) f
                where f ->> 'kind' in ('agreement', 'cr_certificate', 'vat_certificate', 'national_address',
                                       'tender_document')), 5,
  'the record still lists the five company kinds');
select test.eq((select f ->> 'purpose' from jsonb_array_elements(
  api.files('partner', current_setting('t.p')::uuid)) f where f ->> 'kind' = 'tender_document'),
  'tender', 'the letter of award keeps its tender purpose');
select test.eq((select f ->> 'purpose' from jsonb_array_elements(
  api.files('partner', current_setting('t.p')::uuid)) f where f ->> 'kind' = 'agreement'),
  'agreement', 'the agreement keeps its purpose');
select test.eq(jsonb_array_length(api.company_files(current_setting('t.p')::uuid)), 6,
  'the archive''s company listing is unchanged: six files on the partner');
