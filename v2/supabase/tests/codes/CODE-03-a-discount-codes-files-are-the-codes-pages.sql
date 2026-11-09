-- CODE-03 — a discount code's files are the codes page's (FIX-04, F157): the code's files are read and
-- written by the codes level, not the clients level. A reader with codes 'view' and no clients level sees the
-- code's files (empty, not an error); a reader with neither level sees a refusal; only a Full codes reader may
-- begin an upload. The old 'campaign_code' entity never holds a discount-code identifier, so it still says
-- not_found — that is why the page passes the 'identifier' entity. Every value is made up.
select set_config('t.creator', test.person('Test Codes Creator', 'head')::text, true);
select set_config('t.reader', test.person('Test Codes Reader', 'member')::text, true);
select set_config('t.full', test.person('Test Codes Full', 'member')::text, true);
select set_config('t.nobody', test.person('Test Codes Nobody', 'member')::text, true);
insert into core.person_page_level (person_id, page_key, level, reason)
values (current_setting('t.reader')::uuid, 'codes', 'view', 'made up: codes reader'),
       (current_setting('t.reader')::uuid, 'clients', 'none', 'made up: no clients'),
       (current_setting('t.reader')::uuid, 'suppliers_partners', 'none', 'made up: no suppliers'),
       (current_setting('t.full')::uuid, 'codes', 'full', 'made up: codes full'),
       (current_setting('t.full')::uuid, 'clients', 'none', 'made up: no clients'),
       (current_setting('t.full')::uuid, 'suppliers_partners', 'none', 'made up: no suppliers'),
       (current_setting('t.nobody')::uuid, 'codes', 'none', 'made up: no codes'),
       (current_setting('t.nobody')::uuid, 'clients', 'none', 'made up: no clients'),
       (current_setting('t.nobody')::uuid, 'suppliers_partners', 'none', 'made up: no suppliers');

select test.as_person(current_setting('t.creator')::uuid);
select set_config('t.p', api.partner_create('{"trade_name_en": "Made Up Code Co",
  "sides": [{"side": "client", "type": "corporate"}]}') ->> 'id', true);
select set_config('t.code', api.identifier_add(current_setting('t.p')::uuid, 'discount_code', 'MADEUP10',
  'made up') ->> 'id', true);

select test.as_person(current_setting('t.reader')::uuid);
select test.eq(jsonb_array_length(api.files('identifier', current_setting('t.code')::uuid)), 0,
  'a codes reader with no clients level sees the code''s files — empty, not an error');
select test.raises(format('select api.files(%L, %L)', 'campaign_code', current_setting('t.code')), 'P0002',
  'the old campaign_code entity still finds no discount-code identifier', 'common.not_found');
select test.raises(format('select api.file_begin(%L, %L, %L, %L, %L, %s, %L)',
  'identifier', current_setting('t.code'), 'evidence', 'evidence', 'proof.pdf', 1000, 'application/pdf'), '42501',
  'a codes reader who is not Full may not begin an upload', 'access.needs_level');

select test.as_person(current_setting('t.nobody')::uuid);
select test.raises(format('select api.files(%L, %L)', 'identifier', current_setting('t.code')), '42501',
  'a reader with neither codes nor clients sees a refusal', 'access.needs_level');

select test.as_person(current_setting('t.full')::uuid);
select test.eq((api.file_begin('identifier', current_setting('t.code')::uuid, 'evidence', 'evidence',
  'proof.pdf', 1000, 'application/pdf') ->> 'id') is not null, true,
  'a Full codes reader with no clients level may begin an upload');
select test.eq(jsonb_array_length(api.files('identifier', current_setting('t.code')::uuid)), 1,
  'and the begun file shows in the code''s files');
