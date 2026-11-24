-- DTY-01 — every Ledger row carries a deal type (Landing 47, A5), and a postpaid row is paid but receivable (A12).
-- A row recorded here takes the kind of the client ID its invoice carries, else promo when it carries a code, else
-- its organisation's own kind. An imported row takes promo when it carries a code, else its organisation's kind when
-- every client ID the organisation holds is of one kind; with two kinds it is not set, until a person sets it — with
-- a reason, logged — and what a person set wins. The marks move no total: the Ledger's figures are the statement
-- kept as finance.unified_ledger_core, figure for figure, and "by deal type" adds up to them. Every value is made up.
-- Sabotage: supabase/tests/sabotage/a-person-set-deal-type-is-ignored.sql, a-postpaid-row-is-not-receivable.sql,
--   an-imported-row-carries-no-deal-type.sql, the-deal-type-marks-move-a-total.sql.
select set_config('t.head', test.person('Test Finance Head', 'head')::text, true);
select set_config('t.viewer', test.person('Test Viewer', 'viewer')::text, true);
select set_config('t.d', (core.riyadh_today() - 5)::text, true);

create function pg_temp.ul() returns jsonb language sql as
$$ select api.finance_unified_ledger('2026-01-01'::date, '2026-12-31'::date) $$;
create function pg_temp.row_of(p_number text) returns jsonb language sql as
$$ select r from pg_catalog.jsonb_array_elements(pg_temp.ul() -> 'rows') r where r ->> 'number' = p_number $$;
create function pg_temp.core_totals() returns jsonb language sql security definer as
$$ select finance.unified_ledger_core('2026-01-01'::date, '2026-12-31'::date, null, null, null, null, null) -> 'totals' $$;
grant execute on function pg_temp.ul(), pg_temp.row_of(text), pg_temp.core_totals() to public;

select test.as_person(current_setting('t.head')::uuid);
-- three organisations: one postpaid, one prepaid, one holding both kinds
select set_config('t.post', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Postpaid Org',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate')))) ->> 'id', true);
select set_config('t.pre', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Prepaid Org',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate')))) ->> 'id', true);
select set_config('t.both', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Two Kinds Org',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate')))) ->> 'id', true);
select api.identifier_add(current_setting('t.post')::uuid, 'payments_client_id', '990201', 'made up', 'postpaid');
select api.identifier_add(current_setting('t.pre')::uuid, 'payments_client_id', '990202', 'made up', 'prepaid');
select api.identifier_add(current_setting('t.both')::uuid, 'payments_client_id', '990203', 'made up', 'prepaid');
select api.identifier_add(current_setting('t.both')::uuid, 'payments_client_id', '990204', 'made up', 'tender');
-- recorded here: one on the postpaid client ID, one on the tender client ID, one with a code and no client ID
select api.finance_import('invoices', jsonb_build_array(
  jsonb_build_object('ref', 'DTY-M1', 'client_id', '990201', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 300),
  jsonb_build_object('ref', 'DTY-M2', 'client_id', '990204', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 200),
  jsonb_build_object('ref', 'DTY-M3', 'discount_code', 'MADEUPDTY', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 100)),
  now() - interval '1 day');
-- imported: under each organisation; one carrying a code; one not paid yet
select test.act(current_setting('t.head')::uuid);
insert into work.import_batch (id, partner_id, signature, file_name, created_by)
select gen_random_uuid(), p::uuid, 'invoice_export', 'made-up-dty.csv', current_setting('t.head')::uuid
from unnest(array[current_setting('t.post'), current_setting('t.pre'), current_setting('t.both')]) p;
insert into work.import_record (partner_id, batch_id, kind, transaction_ref, invoice_ref, tax_no, record_date, amount_sar, revenue_sar, cost_sar, profit_sar, fully_paid, source_promo, status_text, created_by)
select v.p::uuid, (select b.id from work.import_batch b where b.partner_id = v.p::uuid), 'transaction', v.txn, v.inv, null,
       current_setting('t.d')::date, v.amount, v.amount, v.cost, v.amount - v.cost, v.paid, v.promo, v.status, current_setting('t.head')::uuid
from (values (current_setting('t.post'), 'DTY-I1', 'DTY-INV-1', 1000::numeric, 400::numeric, true, null, 'Fully Paid + Receivables'),
             (current_setting('t.pre'), 'DTY-I2', 'DTY-INV-2', 500, 100, true, null, 'Fully Paid'),
             (current_setting('t.both'), 'DTY-I3', 'DTY-INV-3', 250, 50, true, null, 'Fully Paid'),
             (current_setting('t.pre'), 'DTY-I4', 'DTY-INV-4', 80, 30, true, 'MADEUPDTY', 'Fully Paid'),
             (current_setting('t.post'), 'DTY-I5', 'DTY-INV-5', 700, 0, false, null, 'Pending Payment')) v(p, txn, inv, amount, cost, paid, promo, status);
select test.done();

select test.as_person(current_setting('t.head')::uuid);
-- recorded here
select test.eq(pg_temp.row_of('DTY-M1') ->> 'deal_type', 'postpaid', 'a row recorded here takes the kind of the client ID on its invoice');
select test.eq(pg_temp.row_of('DTY-M1') ->> 'deal_type_by', 'client_id', 'and says the client ID decided it');
select test.eq(pg_temp.row_of('DTY-M2') ->> 'deal_type', 'tender', 'a tender is an ordinary row, flagged tender');
select test.eq(pg_temp.row_of('DTY-M3') ->> 'deal_type', 'promo', 'a row with a code and no client ID is flagged promo');
select test.eq(pg_temp.row_of('DTY-M3') ->> 'deal_type_by', 'code', 'by its code');
-- imported
select test.eq(pg_temp.row_of('DTY-I1') ->> 'deal_type', 'postpaid', 'an imported row takes its organisation''s kind');
select test.eq(pg_temp.row_of('DTY-I1') ->> 'deal_type_by', 'organisation', 'and says the organisation decided it');
select test.eq(pg_temp.row_of('DTY-I2') ->> 'deal_type', 'prepaid', 'prepaid from a prepaid organisation');
select test.eq(pg_temp.row_of('DTY-I3') ->> 'deal_type', null, 'an organisation holding two kinds settles nothing: not set');
select test.eq(pg_temp.row_of('DTY-I3') ->> 'deal_type_by', null, 'and nothing claims to have decided it');
-- a promo-code sale is an ordinary row with its own revenue, cost and profit, flagged promo
select test.eq((select r ->> 'deal_type' from jsonb_array_elements(api.finance_unified_ledger('2026-01-01'::date, '2026-12-31'::date, null, null, null, 'MADEUPDTY') -> 'rows') r
                where r ->> 'number' = 'DTY-I4'), 'promo', 'an imported row carrying a code is flagged promo');
-- A12: a counted postpaid row is paid but receivable; a prepaid one is not
select test.eq(pg_temp.row_of('DTY-I1') ->> 'receivable', 'true', 'a counted postpaid row is paid but receivable');
select test.eq(pg_temp.row_of('DTY-M1') ->> 'receivable', 'true', 'the same for a row recorded here');
select test.eq(pg_temp.row_of('DTY-I2') ->> 'receivable', 'false', 'a prepaid row is not');
-- a row not yet counted carries its deal type too, and is not "receivable" (it is not paid)
select test.eq((select n ->> 'deal_type' from jsonb_array_elements(pg_temp.ul() -> 'not_yet_counted') n where n ->> 'number' = 'DTY-I5'),
  'postpaid', 'a not-yet-counted row carries its deal type');
select test.eq((select n ->> 'receivable' from jsonb_array_elements(pg_temp.ul() -> 'not_yet_counted') n where n ->> 'number' = 'DTY-I5'),
  'false', 'and is not paid-but-receivable');

-- no total moved: the Ledger's totals are the kept statement's, and "by deal type" adds up to them
select test.eq(pg_temp.ul() -> 'totals', pg_temp.core_totals(), 'every total is the kept statement''s, figure for figure');
select test.eq((select sum((g ->> 'revenue')::numeric) from jsonb_array_elements(pg_temp.ul() -> 'by_deal_type') g),
  (pg_temp.ul() -> 'totals' ->> 'revenue')::numeric, 'revenue by deal type adds up to the Ledger''s revenue');
select test.eq((select sum((g ->> 'units')::int)::int from jsonb_array_elements(pg_temp.ul() -> 'by_deal_type') g),
  (pg_temp.ul() -> 'totals' ->> 'units')::int, 'and the units too');
select test.eq((select (g ->> 'revenue')::numeric from jsonb_array_elements(pg_temp.ul() -> 'by_deal_type') g where g ->> 'deal_type' = 'postpaid'),
  1300.00, 'postpaid is the two postpaid rows: 300 + 1000');
select test.eq((select (g ->> 'units')::int from jsonb_array_elements(pg_temp.ul() -> 'by_deal_type') g where g ->> 'deal_type' is null),
  1, 'the row that is not set is its own line, never dropped');

-- a person sets it: a reason is required, the type must be one of the four, the row must be there
select test.eq((pg_temp.ul() ->> 'can_set_deal_type')::boolean, true, 'Full on Finance is offered the control');
select test.raises(format('select api.finance_deal_type_set(%L, %L, %L, %L)', current_setting('t.both'), 'DTY-I3', 'tender', ' '),
  'P0001', 'setting a deal type needs a reason', 'common.reason_required');
select test.raises(format('select api.finance_deal_type_set(%L, %L, %L, %L)', current_setting('t.both'), 'DTY-I3', 'credit', 'made up'),
  'P0001', 'only the four deal types are taken', 'common.invalid');
select test.raises(format('select api.finance_deal_type_set(%L, %L, %L, %L)', current_setting('t.both'), 'DTY-NOPE', 'tender', 'made up'),
  'P0002', 'a number that is not a row of that organisation is refused');
select set_config('t.before', (pg_temp.ul() -> 'totals')::text, true);
select api.finance_deal_type_set(current_setting('t.both')::uuid, 'DTY-I3', 'tender', 'made up: this booking is under the tender');
select test.eq(pg_temp.row_of('DTY-I3') ->> 'deal_type', 'tender', 'the row carries what the person set');
select test.eq(pg_temp.row_of('DTY-I3') ->> 'deal_type_by', 'person', 'and says a person set it');
select test.eq(pg_temp.ul() -> 'totals', current_setting('t.before')::jsonb, 'setting a deal type moves no total');
-- what a person set wins over the client ID, on a row recorded here too
select api.finance_deal_type_set(current_setting('t.post')::uuid, 'DTY-M1', 'prepaid', 'made up: paid from the wallet after all');
select test.eq(pg_temp.row_of('DTY-M1') ->> 'deal_type', 'prepaid', 'a person''s choice wins over the client ID''s kind');
select test.eq(pg_temp.row_of('DTY-M1') ->> 'receivable', 'false', 'and the row is no longer receivable');
select test.as_owner();
select test.eq((select (c).action from test.last_change('work.import_record',
  (select id from work.import_record where transaction_ref = 'DTY-I3')) c), 'update', 'the change is logged');
-- with no type, the person's choice is taken away and the rule decides again
select test.as_person(current_setting('t.head')::uuid);
select api.finance_deal_type_set(current_setting('t.post')::uuid, 'DTY-M1', null, 'made up: back to the rule');
select test.eq(pg_temp.row_of('DTY-M1') ->> 'deal_type', 'postpaid', 'cleared: the client ID decides again');

-- a viewer reads the flag and is not offered the control
select test.as_person(current_setting('t.viewer')::uuid);
select test.eq(pg_temp.row_of('DTY-I2') ->> 'deal_type', 'prepaid', 'a viewer reads the deal type');
select test.eq((pg_temp.ul() ->> 'can_set_deal_type')::boolean, false, 'and is not offered the control');
select test.raises(format('select api.finance_deal_type_set(%L, %L, %L, %L)', current_setting('t.both'), 'DTY-I3', 'promo', 'made up'),
  '42501', 'a viewer cannot set a deal type');
