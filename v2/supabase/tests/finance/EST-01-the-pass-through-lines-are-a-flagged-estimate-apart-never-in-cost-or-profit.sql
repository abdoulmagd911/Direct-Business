-- EST-01 — the flagged cost estimate (D23, V419, V611). An admin classes the last part of a line name pass-through or
-- fee in Settings › Finance; a unit with no approved expense shows the sum of its pass-through lines as an estimate,
-- apart: cost stays 0 and Provisional, profit never uses it, and there is no "profit with estimates". A commission is
-- never estimated; an approved expense replaces the estimate; the setting switches it off. Health counts the estimates
-- in use. Every value is made up.
-- Sabotage: supabase/tests/sabotage/an-estimate-counts-as-cost.sql.
select set_config('t.admin', test.person('Test Admin', 'admin')::text, true);
select set_config('t.head', test.person('Test Finance Head', 'head')::text, true);
select set_config('t.d', (core.riyadh_today() - 10)::text, true);

select test.as_person(current_setting('t.admin')::uuid);
select api.list_save('item_class', null, '{"name_en": "Supplier Fee", "name_ar": "رسوم المورد", "class": "pass_through"}',
                     null, 'made up: a pass-through part');
select api.list_save('item_class', null, '{"name_en": "Service Fee", "name_ar": "رسوم الخدمة", "class": "fee"}',
                     null, 'made up: a fee part');
select test.raises($$select api.list_save('item_class', null, '{"name_en": "Odd Part", "name_ar": "جزء غريب", "class": "guess"}')$$,
  'P0001', 'a class is pass_through or fee, nothing else', 'list.invalid');
select test.raises($$select api.list_save('item_class', null, '{"name_en": "supplier  fee", "name_ar": "رسوم", "class": "fee"}')$$,
  '23505', 'a part is classed once, compared folded', 'list.key_taken');

select test.as_person(current_setting('t.head')::uuid);
select api.finance_import('invoices', jsonb_build_array(
  jsonb_build_object('ref', 'TX-9101', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'paid_on', current_setting('t.d'),
    'total_sar', 400, 'lines', jsonb_build_array(
      jsonb_build_object('line_no', 1, 'product', 'Direct Hotels', 'name', 'Hotel night - Supplier Fee', 'total_sar', 300),
      jsonb_build_object('line_no', 2, 'product', 'Direct Hotels', 'name', 'Booking - Service Fee', 'total_sar', 100))),
  jsonb_build_object('ref', 'TX-9102', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'paid_on', current_setting('t.d'),
    'total_sar', 200, 'lines', jsonb_build_array(
      jsonb_build_object('line_no', 1, 'product', 'Direct Flights', 'name', 'Commission - Supplier Fee', 'total_sar', 150),
      jsonb_build_object('line_no', 2, 'product', 'Direct Flights', 'name', 'Ticket - Service Fee', 'total_sar', 50))),
  jsonb_build_object('ref', 'TX-9103', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'paid_on', current_setting('t.d'),
    'total_sar', 100, 'lines', jsonb_build_array(
      jsonb_build_object('line_no', 1, 'product', 'Direct Visas', 'name', 'Visa - Unknown Part', 'total_sar', 100))),
  jsonb_build_object('ref', 'TX-9104', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'paid_on', current_setting('t.d'),
    'total_sar', 80, 'lines', jsonb_build_array(
      jsonb_build_object('line_no', 1, 'product', 'Direct Transport', 'name', 'Car - Supplier Fee', 'total_sar', 80)))),
  now() - interval '1 day');

select test.as_owner();
select test.eq((select jsonb_object_agg(i.ref, jsonb_build_object('estimate', c.estimate_sar, 'basis', c.cost_basis, 'cost', c.cost_sar,
                                                                   'status', c.cost_status))
                from finance.invoice_cost c join finance.invoice i on i.id = c.id where i.ref like 'TX-91%'),
  '{"TX-9101": {"estimate": 300, "basis": "line_estimate", "cost": 0, "status": "provisional"},
    "TX-9102": {"estimate": null, "basis": "commission", "cost": 0, "status": "provisional"},
    "TX-9103": {"estimate": null, "basis": "none", "cost": 0, "status": "provisional"},
    "TX-9104": {"estimate": 80, "basis": "line_estimate", "cost": 0, "status": "provisional"}}'::jsonb,
  'the pass-through lines are the estimate; a commission is never estimated; an unclassed part gives none');

select test.as_person(current_setting('t.head')::uuid);
select test.eq((api.finance_period(current_setting('t.d')::date, current_setting('t.d')::date)
                - 'from' - 'to' - 'months' - 'provisional' - 'losses' - 'units'),
  '{"revenue": 780, "cost": 0, "profit": 780, "estimate": 380, "estimated_units": 2}'::jsonb,
  'the estimate is apart: cost stays 0 and profit never uses it (V419)');
select test.eq((select jsonb_object_agg(ref, estimate) from api.finance_period_units(current_setting('t.d')::date, current_setting('t.d')::date)
                where ref like 'TX-91%'),
  '{"TX-9101": 300, "TX-9102": null, "TX-9103": null, "TX-9104": 80}'::jsonb, 'each unit shows its estimate flagged, or none');
select test.eq((select e from jsonb_array_elements(api.finance_health(current_setting('t.d')::date, current_setting('t.d')::date)) e
                where e ->> 'key' = 'estimates_in_use'),
  '{"key": "estimates_in_use", "count": 2, "amount_sar": 380}'::jsonb, 'health counts the estimates in use');

-- an approved expense replaces the estimate
select api.finance_import('expenses', jsonb_build_array(
  jsonb_build_object('ref', 'TX-9101', 'expense_type', 'Hotel', 'status', 'Approved', 'amount_sar', 120,
                     'created_at', '2026-01-01T10:00:00Z')), now() - interval '1 hour');
select test.as_owner();
select test.eq((select jsonb_build_object('estimate', c.estimate_sar, 'basis', c.cost_basis, 'cost', c.cost_sar)
                from finance.invoice_cost c join finance.invoice i on i.id = c.id where i.ref = 'TX-9101'),
  '{"estimate": null, "basis": "approved", "cost": 120}'::jsonb, 'an approved expense replaces the estimate');

-- the setting switches the estimate off
select test.as_person(current_setting('t.admin')::uuid);
select api.setting_set('finance.cost_estimate', null, 'false', null, 'made up: estimates off');
select test.as_owner();
select test.eq((select c.estimate_sar from finance.invoice_cost c join finance.invoice i on i.id = c.id where i.ref = 'TX-9104'),
  null::numeric, 'with the setting off there is no estimate');
