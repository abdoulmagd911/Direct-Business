-- XREF-01 — references to Direct's systems (V98, V409, V154): a supplier's portal is a reference on the Supplier &
-- partner side — the portal link and the username — and anything that looks like a password is refused, in English or
-- Arabic, in the value or in the link (a password before the host, a token in the query); a shared reference (a ticket
-- number) is seen by whoever sees the organisation and links through its system's URL pattern; one side's reference
-- only by those who see that side; its side never changes, and a removal is undone. Every value is made up.
-- Sabotage: supabase/tests/sabotage/a-portal-password-kept.sql.
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.head', test.person('Test Head', 'head')::text, true);
select set_config('t.desk', test.person('Test Client Desk', 'member')::text, true);
select set_config('t.sup', test.person('Test Supplier Desk', 'manager')::text, true);
insert into core.person_page_level (person_id, page_key, level, reason)
values (current_setting('t.sup')::uuid, 'clients', 'none', 'made up: suppliers only'),
       (current_setting('t.desk')::uuid, 'suppliers_partners', 'none', 'made up: clients only');
select set_config('t.ticket', (select id::text from work.ref_system where key = 'ticket'), true);

select test.as_person(current_setting('t.admin')::uuid);
select api.list_save('ref_system', current_setting('t.ticket')::uuid,
  '{"url_template": "https://tickets.example.test/view/{value}"}', 1);

select test.as_person(current_setting('t.head')::uuid);
select set_config('t.p', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Portal Hotels',
  'sides', jsonb_build_array(
    jsonb_build_object('side', 'client', 'type', 'corporate'),
    jsonb_build_object('side', 'supplier_partner', 'type', 'supplier', 'owner_id', current_setting('t.sup'))))) ->> 'id', true);
select set_config('t.t', api.reference_save(current_setting('t.p')::uuid, null,
  '{"system": "ticket", "value": "TCK-000123"}') ->> 'id', true);

select test.as_person(current_setting('t.sup')::uuid);
select set_config('t.r', api.reference_save(current_setting('t.p')::uuid, null, '{"side": "supplier_partner",
  "system": "portal", "value": "made.up.user", "url": "https://portal.example.test/login"}') ->> 'id', true);
select test.ok(current_setting('t.r') <> '', 'the supplier desk keeps the portal link and the username');
select test.raises(format('select api.reference_save(%L, null, %L)', current_setting('t.p'), '{"side": "supplier_partner",
  "system": "portal", "value": "password: Made-Up-123"}'), 'P0001', 'never a password', 'partner.no_secrets');
select test.raises(format('select api.reference_save(%L, null, %L)', current_setting('t.p'), '{"side": "supplier_partner",
  "system": "portal", "value": "made.up.user", "url": "https://made.up.user:Made-Up-123@portal.example.test/"}'), 'P0001',
  'nor one before the host of the link', 'partner.no_secrets');
select test.raises(format('select api.reference_save(%L, null, %L)', current_setting('t.p'), '{"side": "supplier_partner",
  "system": "portal", "value": "made.up.user", "url": "https://portal.example.test/in?token=abc123"}'), 'P0001',
  'nor a token in its query', 'partner.no_secrets');
select test.raises(format('select api.reference_save(%L, null, %L)', current_setting('t.p'), '{"side": "supplier_partner",
  "system": "portal", "value": "كلمة المرور 123"}'), 'P0001', 'nor a password in Arabic', 'partner.no_secrets');
select test.raises(format('select api.reference_save(%L, %L, %L, 1)', current_setting('t.p'), current_setting('t.r'),
  '{"value": "made.up.user pwd=Made-Up-123"}'), 'P0001', 'nor added later', 'partner.no_secrets');
select test.raises(format('select api.reference_save(%L, null, %L)', current_setting('t.p'),
  '{"side": "client", "system": "ticket", "value": "TCK-000999"}'), '42501', 'the supplier desk adds nothing to the Client side',
  'access.needs_level');
select test.raises(format('select api.reference_save(%L, null, %L)', current_setting('t.p'),
  '{"system": "fax", "value": "000"}'), 'P0002', 'a system must be on the list', 'reference.unknown_system');
select test.eq((select jsonb_agg(r ->> 'system' order by r ->> 'system')
                from jsonb_array_elements(api.partner_references(current_setting('t.p')::uuid)) r),
  '["portal", "ticket"]'::jsonb, 'the supplier desk sees the shared reference and its own side''s');

select test.as_person(current_setting('t.desk')::uuid);
select test.eq(api.partner_references(current_setting('t.p')::uuid),
  jsonb_build_array(jsonb_build_object('id', current_setting('t.t'), 'side', null, 'system', 'ticket', 'system_en', 'Ticket',
    'system_ar', 'تذكرة', 'value', 'TCK-000123', 'url', null, 'link', 'https://tickets.example.test/view/TCK-000123',
    'version', 1)),
  'the client desk sees only the shared ticket, linked through the system''s URL pattern');
select test.eq(jsonb_array_length(api.partner(current_setting('t.p')::uuid) -> 'references'), 1, 'on the card too');

select test.as_person(current_setting('t.sup')::uuid);
select test.raises(format('select api.reference_save(%L, %L, %L, 1)', current_setting('t.p'), current_setting('t.r'),
  '{"side": "client"}'), 'P0001', 'a reference''s side never changes', 'partner.side_fixed');
select set_config('t.x', api.references_remove(array[current_setting('t.r')::uuid], 'made up: portal closed')
  ->> 'request_id', true);
select test.eq(jsonb_array_length(api.partner_references(current_setting('t.p')::uuid)), 1, 'removed');
select api.undo(current_setting('t.x')::uuid);
select test.eq(jsonb_array_length(api.partner_references(current_setting('t.p')::uuid)), 2, 'and one Undo brings it back');
