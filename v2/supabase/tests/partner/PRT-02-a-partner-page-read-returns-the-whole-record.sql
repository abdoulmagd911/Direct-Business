-- PRT-02 — one read serves the whole record page (FIX-45, Landing 5): api.partner_page returns the card, the
-- org, the six partner sections and the nine lists in one round trip, each part the same answer its own read
-- gives; a missing partner raises not_found and a reader shut out of Clients is refused. Every value is made up.
select set_config('t.head', test.person('Test Head', 'head')::text, true);
select set_config('t.outsider', test.person('Test Outsider', 'member')::text, true);
insert into core.person_page_level (person_id, page_key, level, reason)
values (current_setting('t.outsider')::uuid, 'clients', 'none', 'made up: no clients');
select test.as_person(current_setting('t.head')::uuid);
select set_config('t.a', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Page',
  'trade_name_ar', 'صفحة متخيلة',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate', 'owner_id', current_setting('t.head')))))
  ->> 'id', true);
select set_config('t.page', api.partner_page(current_setting('t.a')::uuid)::text, true);

select test.eq((current_setting('t.page')::jsonb -> 'card' ->> 'id'), current_setting('t.a'),
  'the page carries the card');
select test.eq(current_setting('t.page')::jsonb -> 'card', api.partner(current_setting('t.a')::uuid),
  'the card is the same answer its own read gives');
select test.eq(current_setting('t.page')::jsonb -> 'notes', api.notes('partner', current_setting('t.a')::uuid, null, 100),
  'the notes are the same answer their own read gives');
select test.eq(current_setting('t.page')::jsonb -> 'contracts', api.contracts(current_setting('t.a')::uuid),
  'the contracts are the same answer their own read gives');
select test.eq(current_setting('t.page')::jsonb -> 'history', api.record_history('partner', current_setting('t.a')::uuid),
  'the history is the same answer its own read gives');
select test.eq(current_setting('t.page')::jsonb -> 'comments', api.comments('partner', current_setting('t.a')::uuid),
  'the comments are the same answer their own read gives');
select test.eq(current_setting('t.page')::jsonb -> 'files', api.files('partner', current_setting('t.a')::uuid),
  'the files are the same answer their own read gives');
select test.eq(current_setting('t.page')::jsonb -> 'summary', api.company_summary(current_setting('t.a')::uuid),
  'the summary is the same answer its own read gives');
select test.eq(current_setting('t.page')::jsonb -> 'org', api.org(), 'the org rides along');
select test.eq(current_setting('t.page')::jsonb -> 'lists' -> 'types', api.list('side_type'),
  'the lists ride along');
select test.eq(current_setting('t.page')::jsonb -> 'lists' -> 'priorities', api.list('priority'),
  'all nine lists ride along');
select test.eq(current_setting('t.page')::jsonb -> 'lists' -> 'fileKinds', api.list('file_kind'),
  'the file kinds ride along (FIX-15)');

select test.raises(format('select api.partner_page(%L)', '00000000-0000-0000-0000-000000000000'),
  'P0002', 'a missing partner is not found', 'common.not_found');

select test.as_person(current_setting('t.outsider')::uuid);
select test.raises(format('select api.partner_page(%L)', current_setting('t.a')),
  '42501', 'a reader shut out of Clients is refused', 'access.needs_level');
