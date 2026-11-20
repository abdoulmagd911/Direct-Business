-- TGL-01 — the Admin's Exclude / Include on one ledger row (Landing 32, A2). Excluding takes the row out of
-- every total by exactly its own amounts and lists it as not counted with the reason; including puts every
-- total back exactly; the row itself is never removed. Both stores: an imported row and a row recorded here.
-- Admin only, reason required, logged. The Overview and the Ledger agree at every step. Every value is made up.
-- Sabotage: supabase/tests/sabotage/an-excluded-row-still-counts.sql, a-head-excludes-a-ledger-row.sql.
select set_config('t.head', test.person('Test Finance Head', 'head')::text, true);
select set_config('t.admin', test.person('Test Admin', 'admin', 'commercial')::text, true);
select set_config('t.d', (core.riyadh_today() - 5)::text, true);
select test.as_person(current_setting('t.head')::uuid);
select set_config('t.p', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Toggle Org',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate')))) ->> 'id', true);
select api.identifier_add(current_setting('t.p')::uuid, 'payments_client_id', '990101', 'made up', 'postpaid');
-- a row recorded here (300, no cost yet) and three imported rows (100/40/60, 250/50/200, 1000/—/—)
select api.finance_import('invoices', jsonb_build_array(
  jsonb_build_object('ref', 'TGL-M1', 'client_id', '990101', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 300)),
  now() - interval '1 day');
select set_config('t.b', gen_random_uuid()::text, true);
select test.act(current_setting('t.head')::uuid);
insert into work.import_batch (id, partner_id, signature, file_name, created_by)
values (current_setting('t.b')::uuid, current_setting('t.p')::uuid, 'invoice_export', 'made-up-tgl.csv', current_setting('t.head')::uuid);
insert into work.import_record (partner_id, batch_id, kind, transaction_ref, invoice_ref, record_date, amount_sar, revenue_sar, cost_sar, profit_sar, fully_paid, created_by)
values (current_setting('t.p')::uuid, current_setting('t.b')::uuid, 'transaction', 'TGL-I1', 'TGL-INV-1', current_setting('t.d')::date, 100, 100, 40, 60, true, current_setting('t.head')::uuid),
       (current_setting('t.p')::uuid, current_setting('t.b')::uuid, 'transaction', 'TGL-I2', 'TGL-INV-2', current_setting('t.d')::date, 250, 250, 50, 200, true, current_setting('t.head')::uuid),
       (current_setting('t.p')::uuid, current_setting('t.b')::uuid, 'invoice', null, 'TGL-I3', current_setting('t.d')::date, 1000, 1000, null, null, true, current_setting('t.head')::uuid);
select test.done();

create function pg_temp.ul() returns jsonb language sql as
$$ select api.finance_unified_ledger('2026-01-01'::date, '2026-12-31'::date) $$;
create function pg_temp.row_of(p_number text) returns jsonb language sql as
$$ select r from pg_catalog.jsonb_array_elements(pg_temp.ul() -> 'rows') r where r ->> 'number' = p_number $$;
grant execute on function pg_temp.ul(), pg_temp.row_of(text) to public;

-- before: 4 units, revenue 1650, cost 90, profit 260; every row says it counts
select test.as_person(current_setting('t.admin')::uuid);
select set_config('t.before', (pg_temp.ul() -> 'totals')::text, true);
select test.eq((current_setting('t.before')::jsonb ->> 'units')::int, 4, 'four units count before');
select test.eq((current_setting('t.before')::jsonb ->> 'revenue')::numeric, 1650.00, 'revenue before is 1650');
select test.eq((current_setting('t.before')::jsonb ->> 'cost')::numeric, 90.00, 'cost before is 90');
select test.eq((current_setting('t.before')::jsonb ->> 'profit')::numeric, 260.00, 'profit before is 260');
select test.eq((select count(*)::int from pg_catalog.jsonb_array_elements(pg_temp.ul() -> 'rows') r where (r ->> 'counted')::boolean), 4,
  'every row says it is counted');
select test.eq((pg_temp.ul() ->> 'can_toggle')::boolean, true, 'the admin may toggle');

-- who may: a head (Full on Finance) may not; a reason is required
select test.as_person(current_setting('t.head')::uuid);
select test.eq((pg_temp.ul() ->> 'can_toggle')::boolean, false, 'a head is not offered the toggle');
select test.raises(format('select api.finance_row_exclude(%L, %L, %L)', current_setting('t.p'), 'TGL-I2', 'made up'),
  '42501', 'a head cannot exclude a row');
select test.as_person(current_setting('t.admin')::uuid);
select test.raises(format('select api.finance_row_exclude(%L, %L, %L)', current_setting('t.p'), 'TGL-I2', '  '),
  'P0001', 'excluding needs a reason', 'common.reason_required');
select test.raises(format('select api.finance_row_exclude(%L, %L, %L)', current_setting('t.p'), 'TGL-NOPE', 'made up'),
  'P0002', 'a number that is not a row of that organisation is refused');

-- exclude the imported row TGL-I2 (250 / 50 / 200): every total drops by exactly that row
select set_config('t.x', api.finance_row_exclude(current_setting('t.p')::uuid, 'TGL-I2', 'made up: a test booking') ->> 'id', true);
select test.eq((pg_temp.ul() -> 'totals' ->> 'units')::int, 3, 'one unit fewer');
select test.eq((pg_temp.ul() -> 'totals' ->> 'revenue')::numeric, 1650.00 - 250.00, 'revenue drops by exactly the row');
select test.eq((pg_temp.ul() -> 'totals' ->> 'cost')::numeric, 90.00 - 50.00, 'cost drops by exactly the row');
select test.eq((pg_temp.ul() -> 'totals' ->> 'profit')::numeric, 260.00 - 200.00, 'profit drops by exactly the row');
select test.eq((pg_temp.ul() -> 'totals' ->> 'excluded_units')::int, 1, 'one unit is listed as excluded');
select test.eq((pg_temp.ul() -> 'totals' ->> 'excluded_revenue')::numeric, 250.00, 'with its revenue beside the totals');
-- the row stays, not counted, with the reason; it can be included again from the row
select test.eq(pg_temp.row_of('TGL-I2') ->> 'counted', 'false', 'the row stays in the Ledger, not counted');
select test.eq(pg_temp.row_of('TGL-I2') ->> 'not_counted_reason', 'made up: a test booking', 'with the reason typed');
select test.eq(pg_temp.row_of('TGL-I2') ->> 'excluded_row_level', 'true', 'excluded by hand');
select test.eq(pg_temp.row_of('TGL-I2') ->> 'revenue', '250.00', 'its revenue still shown');
select test.eq((api.finance_company_not_counted(current_setting('t.p')::uuid, '2026-01-01'::date, '2026-12-31'::date) ->> 'excluded_units')::int, 1,
  'the organisation''s not-yet-counted card counts the excluded imported row');
select test.eq((api.finance_company_not_counted(current_setting('t.p')::uuid, '2026-01-01'::date, '2026-12-31'::date) ->> 'excluded_revenue')::numeric, 250.00,
  'with its revenue');
select test.as_owner();
select test.eq((select count(*)::int from work.import_record where transaction_ref = 'TGL-I2' and deleted_at is null), 1,
  'no record was removed');
select test.eq((select (c).action from test.last_change('finance.exclusion_rule', current_setting('t.x')::uuid) c), 'insert',
  'the exclusion is logged');
-- the Overview agrees with the Ledger
select test.as_person(current_setting('t.admin')::uuid);
select test.eq((api.finance_period('2026-01-01'::date, '2026-12-31'::date) ->> 'revenue')::numeric, 1400.00,
  'the Overview drops the same row');
select test.eq((api.finance_period('2026-01-01'::date, '2026-12-31'::date) ->> 'units')::int, 3, 'and the same unit');
select test.raises(format('select api.finance_row_exclude(%L, %L, %L)', current_setting('t.p'), 'TGL-I2', 'again'),
  '23505', 'excluding it twice is refused', 'finance.row_already_excluded');

-- include it again: every total is exactly what it was
select test.raises(format('select api.finance_row_include(%L, %L, %L)', current_setting('t.p'), 'TGL-I2', ''),
  'P0001', 'including needs a reason', 'common.reason_required');
select api.finance_row_include(current_setting('t.p')::uuid, 'TGL-I2', 'made up: a real booking after all');
select test.eq((pg_temp.ul() -> 'totals')::jsonb, current_setting('t.before')::jsonb, 'including reverses every total exactly');
select test.eq(pg_temp.row_of('TGL-I2') ->> 'counted', 'true', 'the row counts again');
select test.eq((api.finance_period('2026-01-01'::date, '2026-12-31'::date) ->> 'revenue')::numeric, 1650.00,
  'the Overview is back too');
select test.as_owner();
select test.eq((select delete_reason from finance.exclusion_rule where id = current_setting('t.x')::uuid),
  'made up: a real booking after all', 'the include is logged with its reason on the rule');

-- the same on a row recorded here (300, no cost): revenue drops by 300, cost and profit do not move
select test.as_person(current_setting('t.admin')::uuid);
select api.finance_row_exclude(current_setting('t.p')::uuid, 'TGL-M1', 'made up: recorded by mistake');
select test.eq((pg_temp.ul() -> 'totals' ->> 'revenue')::numeric, 1650.00 - 300.00, 'a row recorded here drops by exactly its revenue');
select test.eq((pg_temp.ul() -> 'totals' ->> 'cost')::numeric, 90.00, 'cost does not move: that row had none');
select test.eq(pg_temp.row_of('TGL-M1') ->> 'counted', 'false', 'it is listed, not counted');
select test.eq(pg_temp.row_of('TGL-M1') ->> 'not_counted_reason', 'made up: recorded by mistake', 'with its reason');
select test.eq((api.finance_period('2026-01-01'::date, '2026-12-31'::date) ->> 'revenue')::numeric, 1350.00,
  'the Overview agrees');
select api.finance_row_include(current_setting('t.p')::uuid, 'TGL-M1', 'made up: it was right');
select test.eq((pg_temp.ul() -> 'totals')::jsonb, current_setting('t.before')::jsonb, 'and including it reverses exactly');

-- a row a LIST rule catches is not included from the row: the list is changed in Settings
select api.finance_exclusion_rule_save(null, '{"kind": "invoice", "value": "TGL-I3", "reason": "made up: a list rule"}', null, 'made up');
select test.eq(pg_temp.row_of('TGL-I3') ->> 'excluded_row_level', 'false', 'a list rule is not a row exclusion');
select test.raises(format('select api.finance_row_include(%L, %L, %L)', current_setting('t.p'), 'TGL-I3', 'made up'),
  'P0001', 'a list rule is not undone from the row', 'finance.row_excluded_by_list');
