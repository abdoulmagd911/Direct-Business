-- PIPE-07 — the Tender document (§3.4, §3.7a; V55, V80): a tender's owner files one on the tender, kind Tender
-- document, purpose tender; it is named with the tender — its number and title — and the upload day, in both
-- languages; an opportunity's file is named with the opportunity; a member who neither owns the tender nor has Full
-- on the Pipeline adds none. Every value is made up.
-- Sabotage: supabase/tests/sabotage/a-tender-document-is-named-without-its-tender.sql.
select set_config('t.head', test.person('Test Head', 'head')::text, true);
select set_config('t.am1', test.person('Test Bid Owner', 'member')::text, true);
select set_config('t.am2', test.person('Test Colleague', 'member')::text, true);
select test.as_person(current_setting('t.head')::uuid);
select set_config('t.gov', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Authority',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'government')))) ->> 'id', true);
select test.as_person(current_setting('t.am1')::uuid);
select set_config('t.t', api.tender_save(null, jsonb_build_object('title', 'Made-up venue tender', 'partner_id',
  current_setting('t.gov'), 'source', 'tender_portal')) ->> 'id', true);
select set_config('t.n', api.pipeline_card('tender', current_setting('t.t')::uuid) ->> 'number', true);
select set_config('t.f', api.file_begin('tender', current_setting('t.t')::uuid, 'tender_document', 'tender',
  'made-up-rfp.pdf', 2048, 'application/pdf') ->> 'id', true);
select test.eq((select jsonb_build_object('kind', f ->> 'kind', 'purpose', f ->> 'purpose', 'en', f ->> 'display_name_en',
                                          'ar', f ->> 'display_name_ar')
                from jsonb_array_elements(api.files('tender', current_setting('t.t')::uuid)) f),
  jsonb_build_object('kind', 'tender_document', 'purpose', 'tender',
    'en', format('Tender document · %s · Made-up venue tender · %s.pdf', current_setting('t.n'), core.riyadh_today()),
    'ar', format('وثيقة مناقصة · %s · Made-up venue tender · %s.pdf', current_setting('t.n'), core.riyadh_today())),
  'filed on the tender and named with it');

select set_config('t.o', api.opportunity_save(null, jsonb_build_object('title', 'Made-up corporate account',
  'partner_id', current_setting('t.gov'), 'side', 'client', 'type', 'government', 'source', 'referral')) ->> 'id', true);
select api.file_begin('opportunity', current_setting('t.o')::uuid, 'meeting_note', 'attachment', 'notes.pdf', 1024,
  'application/pdf');
select test.eq((select f ->> 'display_name_en' from jsonb_array_elements(api.files('opportunity',
  current_setting('t.o')::uuid)) f), format('Meeting note · %s · Made-up corporate account · %s.pdf',
  api.pipeline_card('opportunity', current_setting('t.o')::uuid) ->> 'number', core.riyadh_today()),
  'an opportunity''s file is named with the opportunity');

select test.as_person(current_setting('t.am2')::uuid);
select test.raises(format('select api.file_begin(%L, %L, %L, %L, %L, 1000, %L)', 'tender', current_setting('t.t'),
  'tender_document', 'tender', 'other.pdf', 'application/pdf'), '42501', 'a colleague files none on another''s tender',
  'access.needs_level');
