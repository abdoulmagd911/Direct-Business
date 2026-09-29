-- SRCH-01 — finding organisations (V78, V136, V98): Ctrl K finds one by any identifier in any spelling — an Arabic name
-- typed another way, a phone with a different prefix — by trade name or number, and people by name; the Clients and the
-- Suppliers & partners lists each show the organisations with that side on, filtered by type, owner and status (the
-- side's); hover cards give their few facts and the sides as chips; each side's page has its own access — a person
-- shut out of Clients finds no client and opens no Clients list, but still finds and lists suppliers. Every value is
-- made up.
-- Sabotage: supabase/tests/sabotage/search-ignores-access.sql.
select set_config('t.head', test.person('Test Head', 'head')::text, true);
select set_config('t.am1', test.person('Test Account Manager', 'member')::text, true);
select set_config('t.outsider', test.person('Test Outsider', 'member')::text, true);
insert into core.person_page_level (person_id, page_key, level, reason)
values (current_setting('t.outsider')::uuid, 'clients', 'none', 'made up: no clients');
update core.person set nickname_en = 'Findable Nick' where id = current_setting('t.am1')::uuid;
select test.as_person(current_setting('t.head')::uuid);
select set_config('t.a', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Searchable',
  'trade_name_ar', 'مؤسسة الرحلة المتخيلة',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate', 'owner_id', current_setting('t.am1')))))
  ->> 'id', true);
select set_config('t.b', api.partner_create('{"trade_name_en": "Made Up Other", "sides": [{"side": "supplier_partner", "type": "supplier"}]}')
  ->> 'id', true);
select api.identifier_add(current_setting('t.a')::uuid, 'phone', '+966 55 000 0002', 'made up');
select api.partner_status_set(current_setting('t.a')::uuid, 'client', 'active');

select test.eq(api.search('الرحله المتخيله') -> 'partners' -> 0 ->> 'id', current_setting('t.a'),
  'an Arabic name typed with ه for ة finds it');
select test.eq(api.search('00966550000002') -> 'partners' -> 0 ->> 'id', current_setting('t.a'), 'a phone with 00966 finds it');
select test.eq(api.search('dk-p-0002') -> 'partners' -> 0 ->> 'id', current_setting('t.b'), 'so does its number');
select test.eq(api.search('findable') -> 'people' -> 0 ->> 'id', current_setting('t.am1'), 'people by nickname');

select test.eq((api.partners('{"side": "client"}') ->> 'total')::int, 1, 'the Clients list shows the Client side');
select test.eq((api.partners('{"side": "supplier_partner"}') -> 'rows' -> 0 ->> 'id'), current_setting('t.b'),
  'the Suppliers & partners list the other');
select test.eq((api.partners('{"side": "client", "types": ["corporate"]}') -> 'rows' -> 0 ->> 'id'), current_setting('t.a'),
  'by type (on the Client side, the segment)');
select test.eq((api.partners(jsonb_build_object('side', 'client', 'owners', jsonb_build_array(current_setting('t.am1'))))
  ->> 'total')::int, 1, 'by owner');
select test.eq((api.partners('{"side": "supplier_partner", "statuses": ["none"]}') -> 'rows' -> 0 ->> 'id'),
  current_setting('t.b'), 'by the side''s status');
select test.eq((api.partners() ->> 'total')::int, 2, 'without a side: every organisation the reader may see');
select test.eq(api.hover_partner(current_setting('t.a')::uuid) ->> 'owner_id', current_setting('t.am1'),
  'a hover card names the owner');
select test.eq(api.hover_partner(current_setting('t.a')::uuid) -> 'sides',
  '[{"side": "client", "type": "corporate", "status": "active"}]'::jsonb, 'and shows the sides as chips');
select test.eq(api.hover_person(current_setting('t.am1')::uuid) ->> 'display_name_en', 'Findable Nick',
  'and a person''s shows their current name');

select test.as_person(current_setting('t.outsider')::uuid);
select test.eq((select jsonb_agg(p ->> 'id') from jsonb_array_elements(api.search('made up') -> 'partners') p),
  jsonb_build_array(current_setting('t.b')), 'a person shut out of Clients finds no client, but finds a supplier');
select test.raises($$select api.partners('{"side": "client"}')$$, '42501', 'nor opens the Clients list', 'access.needs_level');
select test.eq((api.partners('{"side": "supplier_partner"}') ->> 'total')::int, 1, 'but opens the other');
select test.raises(format('select api.partner(%L)', current_setting('t.a')), '42501', 'nor a client''s card',
  'access.needs_level');
