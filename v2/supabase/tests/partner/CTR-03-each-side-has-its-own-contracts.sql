-- CTR-03 — each side has its own contracts (V98, V153): a contract on the Supplier & partner side is added by those who
-- may change that side — the supplier desk, shut out of Clients, adds none on the Client side — and seen by those who
-- see it — the client desk, shut out of Suppliers & partners, sees only the Client side's; no contract starts on a side
-- that is off; its expiring alert tells that side's owner, not the other's. Every value is made up.
-- Sabotage: supabase/tests/sabotage/a-suppliers-contract-shows-to-clients.sql.
select set_config('t.head', test.person('Test Head', 'head')::text, true);
select set_config('t.am1', test.person('Test Account Manager', 'member')::text, true);
select set_config('t.desk', test.person('Test Client Desk', 'member')::text, true);
select set_config('t.sup', test.person('Test Supplier Desk', 'manager')::text, true);
insert into core.person_page_level (person_id, page_key, level, reason)
values (current_setting('t.sup')::uuid, 'clients', 'none', 'made up: suppliers only'),
       (current_setting('t.desk')::uuid, 'suppliers_partners', 'none', 'made up: clients only');
select set_config('t.d0', core.riyadh_today()::text, true);

select test.as_person(current_setting('t.head')::uuid);
select set_config('t.p', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Two Contracts Co',
  'sides', jsonb_build_array(
    jsonb_build_object('side', 'client', 'type', 'corporate', 'owner_id', current_setting('t.am1')),
    jsonb_build_object('side', 'supplier_partner', 'type', 'supplier', 'owner_id', current_setting('t.sup'))))) ->> 'id', true);
select api.contract_save(current_setting('t.p')::uuid, null, jsonb_build_object('side', 'client',
  'title', 'Made-up corporate agreement', 'start_on', current_setting('t.d0')::date - 100,
  'end_on', current_setting('t.d0')::date + 200));

select test.as_person(current_setting('t.sup')::uuid);
select set_config('t.s', api.contract_save(current_setting('t.p')::uuid, null, jsonb_build_object('side', 'supplier_partner',
  'title', 'Made-up rate contract', 'start_on', current_setting('t.d0')::date - 300,
  'end_on', current_setting('t.d0')::date + 30)) ->> 'id', true);
select test.ok(current_setting('t.s') <> '', 'the supplier desk adds a contract on the Supplier & partner side');
select test.raises(format('select api.contract_save(%L, null, %L)', current_setting('t.p'),
  '{"side": "client", "title": "Made up", "start_on": "2027-01-01"}'), '42501', 'but none on the Client side',
  'access.needs_level');
select test.eq((select jsonb_agg(c ->> 'side') from jsonb_array_elements(api.contracts(current_setting('t.p')::uuid)) c),
  '["supplier_partner"]'::jsonb, 'and sees only its own side''s contracts');

select test.as_person(current_setting('t.desk')::uuid);
select test.eq((select jsonb_agg(c ->> 'side') from jsonb_array_elements(api.contracts(current_setting('t.p')::uuid)) c),
  '["client"]'::jsonb, 'the client desk sees only the Client side''s');
select test.eq(jsonb_array_length(api.contracts(current_setting('t.p')::uuid, 'supplier_partner')), 0,
  'asking for the other side shows nothing');
select test.eq((api.partner(current_setting('t.p')::uuid) -> 'counts' ->> 'contracts')::int, 1, 'the card counts one');
select test.eq(api.partner(current_setting('t.p')::uuid) -> 'flags', '[]'::jsonb,
  'nor does the other side''s expiring contract flag the card for them');
select test.raises(format('select api.contracts_remove(array[%L]::uuid[])', current_setting('t.s')), '42501',
  'nor may they remove it', 'access.needs_level');

select test.as_owner();
select notify.generate_alerts();
select test.eq((select array_agg(person_id) from notify.notification where kind = 'alert_contract_expiring'),
  array[current_setting('t.sup')::uuid], 'its expiring alert tells the Supplier & partner side''s owner alone');

select test.as_person(current_setting('t.head')::uuid);
select api.partner_side_off(current_setting('t.p')::uuid, 'supplier_partner', null, 'made up: no longer supplies');
select test.raises(format('select api.contract_save(%L, null, %L)', current_setting('t.p'),
  '{"side": "supplier_partner", "title": "Made up", "start_on": "2027-01-01"}'), 'P0001',
  'no contract starts on a side that is off', 'partner.side_not_on');
