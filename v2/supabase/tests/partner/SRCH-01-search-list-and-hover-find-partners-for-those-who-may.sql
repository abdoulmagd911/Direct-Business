-- SRCH-01 — finding partners (V78, V136): Ctrl K finds a partner by any identifier in any spelling — an Arabic name
-- typed another way, a phone with a different prefix — by trade name or number, and people by name; the Partners list
-- filters by role, segment, owner and status; hover cards give their few facts; a person who cannot open Partners finds
-- none. Every value is made up.
-- Sabotage: supabase/tests/sabotage/search-ignores-access.sql.
select set_config('t.head', test.person('Test Head', 'head')::text, true);
select set_config('t.am1', test.person('Test Account Manager', 'member')::text, true);
select set_config('t.outsider', test.person('Test Outsider', 'member')::text, true);
insert into core.person_page_level (person_id, page_key, level, reason)
values (current_setting('t.outsider')::uuid, 'partners', 'none', 'made up: no partners');
update core.person set nickname_en = 'Findable Nick' where id = current_setting('t.am1')::uuid;
select set_config('t.corporate', (select id::text from partner.segment where key = 'corporate'), true);
select test.as_person(current_setting('t.head')::uuid);
select set_config('t.a', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Searchable', 'trade_name_ar', 'مؤسسة الرحلة المتخيلة',
  'roles', '["client"]'::jsonb, 'account_manager_id', current_setting('t.am1'),
  'segment_id', current_setting('t.corporate'))) ->> 'id', true);
select set_config('t.b', api.partner_create('{"trade_name_en": "Made Up Other", "roles": ["supplier"]}') ->> 'id', true);
select api.identifier_add(current_setting('t.a')::uuid, 'phone', '+966 55 000 0002', 'made up');
select api.partner_status_set(current_setting('t.a')::uuid, 'active');

select test.eq(api.search('الرحله المتخيله') -> 'partners' -> 0 ->> 'id', current_setting('t.a'),
  'an Arabic name typed with ه for ة finds it');
select test.eq(api.search('00966550000002') -> 'partners' -> 0 ->> 'id', current_setting('t.a'), 'a phone with 00966 finds it');
select test.eq(api.search('dk-p-0002') -> 'partners' -> 0 ->> 'id', current_setting('t.b'), 'so does its number');
select test.eq(api.search('findable') -> 'people' -> 0 ->> 'id', current_setting('t.am1'), 'people by nickname');

select test.eq((api.partners('{"roles": ["client"]}') ->> 'total')::int, 1, 'the list filters by role');
select test.eq((api.partners('{"segments": ["corporate"]}') -> 'rows' -> 0 ->> 'id'), current_setting('t.a'), 'by segment');
select test.eq((api.partners(jsonb_build_object('owners', jsonb_build_array(current_setting('t.am1')))) ->> 'total')::int, 1,
  'by owner');
select test.eq((api.partners('{"statuses": ["none"]}') -> 'rows' -> 0 ->> 'id'), current_setting('t.b'), 'by status');
select test.eq(api.hover_partner(current_setting('t.a')::uuid) ->> 'owner_id', current_setting('t.am1'),
  'a hover card names the owner');
select test.eq(api.hover_person(current_setting('t.am1')::uuid) ->> 'display_name_en', 'Findable Nick',
  'and a person''s shows their current name');

select test.as_person(current_setting('t.outsider')::uuid);
select test.eq(jsonb_array_length(api.search('made up') -> 'partners'), 0, 'a person who cannot open Partners finds none');
select test.raises('select api.partners()', '42501', 'nor opens the list', 'access.needs_level');
