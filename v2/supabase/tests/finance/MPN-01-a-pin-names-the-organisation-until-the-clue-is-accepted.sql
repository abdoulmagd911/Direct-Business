-- MPN-01 — pins (P4-3, §3.5 level 0; V147). A person who may type an invoice pins one whose clues matched nothing to an
-- organisation (entry); a matched row takes no pin, and one pin per row. A decision pin needs the Client side's
-- identify capability. The pinned row still waits in Needs a decision with its pin beside it; accepting the clue there
-- makes the row match by itself and lets the pin go in the same request, so Undo brings both back. Finance health
-- lists a pin whose invoice would now match a different organisation without it. Every value is made up.
-- Sabotage: supabase/tests/sabotage/a-pin-does-not-win.sql.
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.head', test.person('Test Finance Head', 'head')::text, true);
select set_config('t.am', test.person('Test Member', 'member')::text, true);
select set_config('t.d', (core.riyadh_today() - 10)::text, true);

select test.as_person(current_setting('t.admin')::uuid);
select set_config('t.x', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Pinned Co',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate')))) ->> 'id', true);
select set_config('t.y', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Other Co',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate')))) ->> 'id', true);
select api.identifier_add(current_setting('t.x')::uuid, 'payments_client_id', '88009', 'made up', 'postpaid');
select test.as_person(current_setting('t.head')::uuid);
select api.finance_import('invoices', jsonb_build_array(
  jsonb_build_object('ref', 'SA-8801', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 100,
                     'customer_name', 'Made Up Pin Customer'),
  jsonb_build_object('ref', 'SA-8802', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 60,
                     'client_id', '88001'),
  jsonb_build_object('ref', 'SA-8803', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 40,
                     'customer_name', 'Made Up Stale Customer'),
  jsonb_build_object('ref', 'SA-8804', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 20,
                     'client_id', '88009')), now() - interval '1 day');
select test.as_owner();
select set_config('t.i1', (select id::text from finance.invoice where ref = 'SA-8801'), true);
select set_config('t.i2', (select id::text from finance.invoice where ref = 'SA-8802'), true);
select set_config('t.i3', (select id::text from finance.invoice where ref = 'SA-8803'), true);
select set_config('t.i4', (select id::text from finance.invoice where ref = 'SA-8804'), true);

-- an entry pin by a member; a matched row takes none; one pin per row
select test.as_person(current_setting('t.am')::uuid);
select set_config('t.p1', api.match_pin_set(current_setting('t.i1')::uuid, current_setting('t.x')::uuid, 'entry',
                                            'made up: picked while typing')::text, true);
select test.raises(format('select api.match_pin_set(%L, %L, %L, %L)', current_setting('t.i4'), current_setting('t.y'), 'entry', 'made up'),
  'P0001', 'a row its clues match takes no pin', 'match.already_matched');
select test.raises(format('select api.match_pin_set(%L, %L, %L, %L)', current_setting('t.i1'), current_setting('t.y'), 'entry', 'made up'),
  '23505', 'one pin per row', 'match.already_pinned');
select test.raises(format('select api.match_pin_set(%L, %L, %L, %L)', current_setting('t.i2'), current_setting('t.x'), 'decision', 'made up'),
  '42501', 'a decision pin needs the identify capability', 'access.needs_capability');
select test.as_person(current_setting('t.head')::uuid);
select set_config('t.p2', api.match_pin_set(current_setting('t.i2')::uuid, current_setting('t.x')::uuid, 'decision',
                                            'made up: a manager''s decision')::text, true);
select test.as_owner();
select test.eq((select jsonb_object_agg(f.ref, f.match_level) from finance.invoice_fact f where f.ref in ('SA-8801', 'SA-8802')),
  '{"SA-8801": "pin", "SA-8802": "pin"}'::jsonb, 'a pin wins: both rows match by it');
select test.eq((select f.partner_id from finance.invoice_fact f where f.ref = 'SA-8801'), current_setting('t.x')::uuid,
  'to the pinned organisation');

-- the clue still waits, the pin beside it; accepting it clears the pin in the same request
select test.as_person(current_setting('t.admin')::uuid);
select test.eq((select e -> 'pinned_to' from jsonb_array_elements(api.match_queue()) e where e ->> 'value' = 'Made Up Pin Customer'),
  jsonb_build_array(current_setting('t.x')), 'the pinned row still waits in Needs a decision, its pin beside it');
select set_config('t.dec', api.match_decide((select e ->> 'key' from jsonb_array_elements(api.match_queue()) e
                                             where e ->> 'value' = 'Made Up Pin Customer'),
                                            'partner', current_setting('t.x')::uuid, 'made up: accepted')::text, true);
select test.as_owner();
select test.eq((select f.match_level from finance.invoice_fact f where f.ref = 'SA-8801'), 'alias',
  'once the clue is accepted the row matches by itself');
select test.eq((select deleted_at is not null from partner.match_pin where id = (current_setting('t.p1')::jsonb ->> 'id')::uuid),
  true, 'and the pin is let go');
select test.eq((select c.request_id from audit.change c where c.table_name = 'partner.match_pin'
                and c.row_id = (current_setting('t.p1')::jsonb ->> 'id')::uuid order by c.id desc limit 1),
  (current_setting('t.dec')::jsonb ->> 'request_id')::uuid, 'in the same request');
select test.as_person(current_setting('t.admin')::uuid);
select api.undo((current_setting('t.dec')::jsonb ->> 'request_id')::uuid);
select test.as_owner();
select test.eq((select f.match_level from finance.invoice_fact f where f.ref = 'SA-8801'), 'pin',
  'Undo brings the alias and the pin back together');

-- a stale pin is listed in health; letting a pin go
select test.as_person(current_setting('t.am')::uuid);
select set_config('t.p3', api.match_pin_set(current_setting('t.i3')::uuid, current_setting('t.x')::uuid, 'entry',
                                            'made up: picked while typing')::text, true);
select test.as_person(current_setting('t.admin')::uuid);
select api.identifier_add(current_setting('t.y')::uuid, 'name', 'Made Up Stale Customer', 'made up: an alias', 'alias');
select test.eq((select e from jsonb_array_elements(api.finance_health()) e where e ->> 'key' = 'pins_stale'),
  '{"key": "pins_stale", "count": 1, "amount_sar": 40}'::jsonb,
  'a pin whose invoice would now match a different organisation without it is listed in health');
select test.as_person(current_setting('t.am')::uuid);
select api.match_pin_clear((current_setting('t.p3')::jsonb ->> 'id')::uuid, 'made up: let it go');
select test.as_owner();
select test.eq((select f.partner_id from finance.invoice_fact f where f.ref = 'SA-8803'), current_setting('t.y')::uuid,
  'with the pin gone the row matches the alias');
