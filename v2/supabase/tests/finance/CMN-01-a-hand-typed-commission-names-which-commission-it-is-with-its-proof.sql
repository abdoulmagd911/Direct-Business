-- CMN-01 — Landing 47, A7. A commission typed by hand names which provider commission it is — airlines, provider,
-- cashback, study abroad or other — and carries its proof. Both are required; only a row recorded by hand takes
-- them (commissions never come from the payment system's files); the Ledger row says which commission it is; the
-- change is logged; no figure moves. Every value is made up.
-- Sabotage: supabase/tests/sabotage/a-commission-needs-no-proof.sql, an-imported-row-is-named-a-commission.sql,
--   the-ledger-forgets-the-commission-type.sql.
select set_config('t.head', test.person('Test Finance Head', 'head')::text, true);
select set_config('t.viewer', test.person('Test Viewer', 'viewer')::text, true);
select set_config('t.d', (core.riyadh_today() - 5)::text, true);
create function pg_temp.ul() returns jsonb language sql as
$$ select api.finance_unified_ledger('2026-01-01'::date, '2026-12-31'::date) $$;
create function pg_temp.row_of(p_number text) returns jsonb language sql as
$$ select r from pg_catalog.jsonb_array_elements(pg_temp.ul() -> 'rows') r where r ->> 'number' = p_number $$;
grant execute on function pg_temp.ul(), pg_temp.row_of(text) to public;

select test.as_person(current_setting('t.head')::uuid);
select set_config('t.c', api.finance_row_add('invoice', jsonb_build_object('ref', 'CMT-H1', 'kind', 'standalone',
  'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 5000,
  'customer_name', 'Made Up Airline Co'), 'made up: typed') ->> 'id', true);
select api.finance_import('invoices', jsonb_build_array(
  jsonb_build_object('ref', 'CMT-F1', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 700)),
  now() - interval '1 day');
select test.as_owner();
select set_config('t.f', (select id from finance.invoice where ref = 'CMT-F1')::text, true);

select test.as_person(current_setting('t.head')::uuid);
select set_config('t.before', (pg_temp.ul() -> 'totals')::text, true);
select test.eq(pg_temp.row_of('CMT-H1') ->> 'commission_type', null, 'a row names no commission until a person does');
-- the type and the proof are both required, and so is a reason
select test.raises(format('select api.finance_commission_set(%L, %L, %L, %L)', current_setting('t.c'), null, 'made up: statement', 'made up'),
  'P0001', 'a commission must say which it is', 'finance.commission_needs_type');
select test.raises(format('select api.finance_commission_set(%L, %L, %L, %L)', current_setting('t.c'), 'bonus', 'made up: statement', 'made up'),
  'P0001', 'only the five commissions are taken', 'finance.commission_needs_type');
select test.raises(format('select api.finance_commission_set(%L, %L, %L, %L)', current_setting('t.c'), 'airlines', '   ', 'made up'),
  'P0001', 'a commission needs its proof', 'finance.commission_needs_proof');
select test.raises(format('select api.finance_commission_set(%L, %L, %L, %L)', current_setting('t.c'), 'airlines', 'made up: statement', ''),
  'P0001', 'and a reason', 'common.reason_required');
-- a row that came from a file is never named a commission here
select test.raises(format('select api.finance_commission_set(%L, %L, %L, %L)', current_setting('t.f'), 'airlines', 'made up: statement', 'made up'),
  'P0001', 'a row from a file takes no commission type', 'finance.commission_is_typed_by_hand');
-- named: each of the five is taken
select api.finance_commission_set(current_setting('t.c')::uuid, 'airlines', 'made up: airline statement, March', 'made up: named');
select test.eq(pg_temp.row_of('CMT-H1') ->> 'commission_type', 'airlines', 'the Ledger row says which commission it is');
select api.finance_commission_set(current_setting('t.c')::uuid, 'provider', 'made up: p', 'made up');
select api.finance_commission_set(current_setting('t.c')::uuid, 'cashback', 'made up: p', 'made up');
select api.finance_commission_set(current_setting('t.c')::uuid, 'study_abroad', 'made up: p', 'made up');
select api.finance_commission_set(current_setting('t.c')::uuid, 'other', 'made up: other proof', 'made up');
select test.eq(pg_temp.row_of('CMT-H1') ->> 'commission_type', 'other', 'the newest naming stands');
select test.eq(pg_temp.ul() -> 'totals', current_setting('t.before')::jsonb, 'naming a commission moves no figure');
select test.as_owner();
select test.eq((select commission_proof from finance.invoice where id = current_setting('t.c')::uuid), 'made up: other proof', 'the proof is kept with it');
select test.eq((select (c).action from test.last_change('finance.invoice', current_setting('t.c')::uuid) c), 'update', 'and the change is logged');
select test.raises(format('update finance.invoice set commission_proof = null where id = %L', current_setting('t.c')), '23514',
  'the table itself refuses a commission type without its proof');
-- who may
select test.as_person(current_setting('t.viewer')::uuid);
select test.raises(format('select api.finance_commission_set(%L, %L, %L, %L)', current_setting('t.c'), 'airlines', 'made up: p', 'made up'),
  '42501', 'a viewer cannot name a commission');
