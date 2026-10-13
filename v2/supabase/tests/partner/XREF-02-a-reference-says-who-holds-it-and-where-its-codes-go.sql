-- XREF-02 — after a supplier contract every department's access is known (V484): a portal reference names the
-- department that holds it and the mailbox its codes go to; a department that does not exist or is retired, and a
-- mailbox that is not an address, are refused; both clear; a password stays refused (V409). Every value is made up.
-- Sabotage: supabase/tests/sabotage/a-reference-forgets-who-holds-it.sql.
select set_config('t.head', test.person('Test Head', 'head')::text, true);
select set_config('t.sup', test.person('Test Supplier Desk', 'manager')::text, true);
select set_config('t.dep', test.department('operations')::text, true);

select test.as_person(current_setting('t.head')::uuid);
select set_config('t.p', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Portal Air',
  'sides', jsonb_build_array(jsonb_build_object('side', 'supplier_partner', 'type', 'airline',
                                                'owner_id', current_setting('t.sup'))))) ->> 'id', true);
select test.as_person(current_setting('t.sup')::uuid);
select set_config('t.r', api.reference_save(current_setting('t.p')::uuid, null, jsonb_build_object('side',
  'supplier_partner', 'system', 'portal', 'value', 'made.up.agent', 'url', 'https://portal.example.test/agents',
  'held_by', 'operations', 'code_goes_to', ' portal.codes@example.test ')) ->> 'id', true);
select test.eq((select jsonb_build_object('held_by', r -> 'held_by' ->> 'code', 'code_goes_to', r ->> 'code_goes_to')
                from jsonb_array_elements(api.partner_references(current_setting('t.p')::uuid)) r),
  '{"held_by": "operations", "code_goes_to": "portal.codes@example.test"}'::jsonb,
  'the reference names the department that holds it and where its codes go');

select test.raises(format('select api.reference_save(%L, %L, %L, 1)', current_setting('t.p'), current_setting('t.r'),
  '{"held_by": "no_such_department"}'), 'P0002', 'a department that does not exist is refused',
  'reference.unknown_department');
select test.raises(format('select api.reference_save(%L, %L, %L, 1)', current_setting('t.p'), current_setting('t.r'),
  '{"code_goes_to": "the operations desk"}'), 'P0001', 'so is a mailbox that is not an address',
  'reference.mailbox_invalid');
select test.raises(format('select api.reference_save(%L, %L, %L, 1)', current_setting('t.p'), current_setting('t.r'),
  '{"value": "password: Made-Up-123"}'), 'P0001', 'and a password, as ever', 'partner.no_secrets');
select test.as_owner();
update core.department set active = false where id = current_setting('t.dep')::uuid;
select test.as_person(current_setting('t.sup')::uuid);
select test.raises(format('select api.reference_save(%L, null, %L)', current_setting('t.p'), jsonb_build_object('side',
  'supplier_partner', 'system', 'portal', 'value', 'made.up.second', 'held_by', 'operations')), 'P0002',
  'nor a retired department', 'reference.unknown_department');
select api.reference_save(current_setting('t.p')::uuid, current_setting('t.r')::uuid,
  '{"held_by": null, "code_goes_to": ""}', 1);
select test.eq((select jsonb_build_object('held_by', r -> 'held_by', 'code_goes_to', r -> 'code_goes_to')
                from jsonb_array_elements(api.partner_references(current_setting('t.p')::uuid)) r),
  '{"held_by": null, "code_goes_to": null}'::jsonb, 'both clear');
