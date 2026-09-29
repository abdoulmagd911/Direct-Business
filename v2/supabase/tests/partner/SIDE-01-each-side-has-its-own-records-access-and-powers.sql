-- SIDE-01 — the two sides of one organisation (V98): client IDs, discount codes and credit limits belong to the Client
-- side — refused while it is off, kept when it is switched off; each side's page has its own access — a person shut out
-- of Clients changes the Supplier & partner side but not the Client side, and reads neither its row, its history nor
-- its client IDs; each side has its own capabilities — the Supplier & partner side's assign sets no Client owner;
-- a side's fields never hold a password; contacts carry a role and the sides they belong to. Every value is made up.
-- Sabotages: supabase/tests/sabotage/client-ids-on-any-side.sql, supabase/tests/sabotage/one-page-for-both-sides.sql,
--            supabase/tests/sabotage/a-password-field.sql, supabase/tests/sabotage/record-level-ignores-the-sides.sql.
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.head', test.person('Test Head', 'head')::text, true);
select set_config('t.sup', test.person('Test Supplier Desk', 'manager')::text, true);
insert into core.person_page_level (person_id, page_key, level, reason)
values (current_setting('t.sup')::uuid, 'clients', 'none', 'made up: suppliers only');
insert into core.person_capability (person_id, capability_key, granted, reason)
values (current_setting('t.sup')::uuid, 'clients.assign', false, 'made up: suppliers only');

-- client IDs, codes and credit: the Client side's
select test.as_person(current_setting('t.head')::uuid);
select set_config('t.p', api.partner_create('{"trade_name_en": "Made Up Hotels", "sides": [{"side": "supplier_partner", "type": "supplier"}]}')
  ->> 'id', true);
select test.raises(format('select api.identifier_add(%L, %L, %L, %L, %L)', current_setting('t.p'), 'payments_client_id',
  'C-000123', 'made up', 'postpaid'), 'P0001', 'a client ID needs the Client side', 'partner.client_side_only');
select test.raises(format('select api.identifier_add(%L, %L, %L, %L)', current_setting('t.p'), 'discount_code', 'MADEUP10',
  'made up'), 'P0001', 'so does a discount code', 'partner.client_side_only');
select test.raises(format('select api.credit_limit_set(%L, 50000, null, %L, %L)', current_setting('t.p'),
  current_setting('t.head'), 'made up'), 'P0001', 'and a credit limit', 'partner.client_side_only');
select test.ok((api.identifier_add(current_setting('t.p')::uuid, 'vat', '300000000000013', 'made up') ->> 'id') is not null,
  'a VAT number is shared by both sides');
select api.partner_side_set(current_setting('t.p')::uuid, 'client', '{"type": "corporate"}');
select set_config('t.cid', api.identifier_add(current_setting('t.p')::uuid, 'payments_client_id', 'C-000123', 'made up',
  'postpaid') ->> 'id', true);
select test.ok(current_setting('t.cid') <> '', 'with the Client side on, a client ID is added');
select api.partner_side_off(current_setting('t.p')::uuid, 'client', null, 'made up: stopped buying');
select test.ok(exists (select 1 from jsonb_array_elements(api.partner(current_setting('t.p')::uuid) -> 'identifiers') i
                       where i ->> 'id' = current_setting('t.cid')), 'switching the side off keeps it');
select api.partner_side_set(current_setting('t.p')::uuid, 'client', '{}');
select api.partner_status_set(current_setting('t.p')::uuid, 'client', 'active');

-- each side's page and powers
select test.as_owner();
select set_config('t.cs', (select id::text from partner.side_status_change
                           where partner_id = current_setting('t.p')::uuid and side = 'client'), true);
select test.as_person(current_setting('t.sup')::uuid);
select test.eq((select jsonb_agg(s ->> 'side') from jsonb_array_elements(api.partner(current_setting('t.p')::uuid) -> 'sides') s),
  '["supplier_partner"]'::jsonb, 'a person shut out of Clients does not see the Client side');
select test.ok(not exists (select 1 from jsonb_array_elements(api.partner(current_setting('t.p')::uuid) -> 'identifiers') i
                           where i ->> 'kind' = 'payments_client_id'), 'nor its client IDs');
select test.raises(format('select api.record_history(%L, %L)', 'side_status', current_setting('t.cs')), '42501',
  'nor its history', 'access.needs_level');
select set_config('t.ss', api.partner_status_set(current_setting('t.p')::uuid, 'supplier_partner', 'active') ->> 'id', true);
select test.ok(current_setting('t.ss') <> '', 'but sets the Supplier & partner side''s status (its assign capability)');
select test.runs(format('select api.record_history(%L, %L)', 'side_status', current_setting('t.ss')),
  'and reads that side''s history');
select test.raises(format('select api.partner_status_set(%L, %L, %L)', current_setting('t.p'), 'client', 'lost'), '42501',
  'not the Client side''s', 'access.needs_capability');
select test.raises(format('select api.partner_side_set(%L, %L, %L)', current_setting('t.p'), 'client', '{"tier": null}'),
  '42501', 'nor changes the Client side', 'access.needs_level');
select test.raises(format('select api.partner_owner_set(%L, %L, %L)', current_setting('t.p'), 'client',
  current_setting('t.sup')), '42501', 'nor names its owner', 'access.needs_capability');
select test.ok((api.partner_owner_set(current_setting('t.p')::uuid, 'supplier_partner', current_setting('t.sup')::uuid)
                ->> 'request_id') is not null, 'but names the Supplier & partner side''s');

-- a side's fields hold references, never passwords (V98, V409)
select test.as_person(current_setting('t.admin')::uuid);
select test.raises($$select api.side_field_save(null, '{"side": "supplier_partner", "key": "portal_password",
  "label_en": "Portal password", "label_ar": "كلمة المرور", "type": "text"}')$$, 'P0001',
  'a field named like a password is refused', 'partner.no_secrets');
select test.raises($$select api.side_field_save(null, '{"side": "supplier_partner", "key": "portal_login",
  "label_en": "Portal login", "label_ar": "كلمة السر", "type": "text"}')$$, 'P0001', 'in Arabic too', 'partner.no_secrets');
select test.ok((api.side_field_save(null, '{"side": "client", "key": "passenger_count", "label_en": "Passengers a year",
  "label_ar": "المسافرون سنوياً", "type": "number"}') ->> 'id') is not null, 'a passenger count is no password');
select test.as_person(current_setting('t.head')::uuid);
select test.raises($$select api.side_field_save(null, '{"side": "client", "key": "made_up", "label_en": "Made up",
  "label_ar": "متخيل", "type": "text"}')$$, '42501', 'side fields are Settings: a head cannot add one', 'access.needs_level');

-- contacts: a role, and the sides they belong to (V401, V98)
select test.as_owner();
select set_config('t.booker', (select id::text from partner.contact_role where key = 'booker'), true);
select test.as_person(current_setting('t.head')::uuid);
select set_config('t.c', api.contact_save(current_setting('t.p')::uuid, null, jsonb_build_object('name_en', 'Made Up Booker',
  'role_id', current_setting('t.booker'), 'sides', '["client"]'::jsonb)) ->> 'id', true);
select test.eq((select jsonb_build_object('role', c ->> 'role_id', 'sides', c -> 'sides')
                from jsonb_array_elements(api.partner(current_setting('t.p')::uuid) -> 'contacts') c),
  jsonb_build_object('role', current_setting('t.booker'), 'sides', '["client"]'::jsonb), 'a contact carries a role and sides');
select test.raises(format('select api.contact_save(%L, null, %L)', current_setting('t.p'),
  '{"name_en": "Made Up Nobody", "sides": ["elsewhere"]}'), 'P0001', 'a side that does not exist is refused',
  'contact.name_required');
select test.raises(format('select api.contact_save(%L, null, %L)', current_setting('t.p'),
  jsonb_build_object('name_en', 'Made Up Nobody', 'role_id', gen_random_uuid())), 'P0002', 'and a role that does not',
  'contact.unknown_role');
