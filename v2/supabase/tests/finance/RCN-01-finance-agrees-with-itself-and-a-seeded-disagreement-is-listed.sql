-- RCN-01 — Landing 47, A10: Finance agrees with itself. The reconciliation puts the Finance page's figures beside
-- the Ledger's totals for a period and lists every gap; an empty list means agreement. On a period with rows
-- recorded here, imported rows, costs and a credit, the list is empty. A seeded disagreement is listed: a row
-- whose profit is not its revenue less its cost; a row whose cost is not the sum of its own expense lines; and the
-- two sides' own figures when they part. A gap under 1 SAR is listed but is not a failure; 1 SAR or more is.
-- A credit lowers the cost and the two sides keep agreeing. Every value is made up.
-- Sabotage: supabase/tests/sabotage/a-small-gap-is-called-a-failure.sql, the-finance-page-and-the-ledger-part.sql,
--   the-reconciliation-ignores-the-expense-lines.sql, the-reconciliation-ignores-the-rows.sql,
--   the-reconciliation-sees-no-gap.sql.
select set_config('t.head', test.person('Test Finance Head', 'head')::text, true);
select set_config('t.d', (core.riyadh_today() - 5)::text, true);
create function pg_temp.rec() returns jsonb language sql as
$$ select api.finance_reconciliation('2026-01-01'::date, '2026-12-31'::date) $$;
create function pg_temp.gaps(p_kind text) returns jsonb language sql as
$$ select coalesce(jsonb_agg(g), '[]'::jsonb) from pg_catalog.jsonb_array_elements(pg_temp.rec() -> 'gaps') g where g ->> 'kind' = p_kind $$;
grant execute on function pg_temp.rec(), pg_temp.gaps(text) to public;

select test.as_person(current_setting('t.head')::uuid);
select set_config('t.p', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Reconcile Org',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate')))) ->> 'id', true);
select api.identifier_add(current_setting('t.p')::uuid, 'payments_client_id', '990501', 'made up', 'prepaid');
-- recorded here: two rows, one with an approved expense
select api.finance_import('invoices', jsonb_build_array(
  jsonb_build_object('ref', 'RCN-M1', 'client_id', '990501', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 1000),
  jsonb_build_object('ref', 'RCN-M2', 'client_id', '990501', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 500)),
  now() - interval '1 day');
select api.finance_import('expenses', jsonb_build_array(
  jsonb_build_object('ref', 'RCN-M2', 'expense_type', 'Hotel', 'status', 'Approved', 'amount_sar', 200, 'created_at', '2026-01-01T10:00:00Z')),
  now() - interval '1 day');
-- imported through the real door: two Fully Paid transactions, then their expenses, then a credit on one
create function pg_temp.money_row(p_no int, p_kind text, p_txn text, p_inv text, p_amount numeric) returns jsonb
language sql as $$
  select jsonb_build_object('row_no', p_no, 'kind', p_kind, 'transaction_ref', p_txn, 'invoice_ref', p_inv,
    'tax_no', null, 'record_date', current_setting('t.d'), 'amount', p_amount, 'wallet_topup', 0, 'cost', null,
    'status_text', 'Fully Paid', 'fully_paid', true, 'audit_required', false, 'provisional', false, 'product', null,
    'expense_gate', null, 'source_promo', null, 'promo_before', null, 'promo_discount', null, 'promo_after', null,
    'direct_url', null, 'direct_ref', null, 'duplicate', false)
$$;
create function pg_temp.apply(p_signature text, p_rows jsonb) returns jsonb
language sql as $$
  select api.import_apply((api.import_batch_start(current_setting('t.p')::uuid, p_signature, 'made-up.csv') ->> 'id')::uuid, p_rows)
$$;
select pg_temp.apply('invoice_export', jsonb_build_array(
  pg_temp.money_row(2, 'transaction', 'RCN-I1', '9915000001', 800),
  pg_temp.money_row(3, 'transaction', 'RCN-I2', '9915000002', 600),
  pg_temp.money_row(4, 'invoice', null, '9915000001', 800),
  pg_temp.money_row(5, 'invoice', null, '9915000002', 600)));
select pg_temp.apply('transaction_expense_export', jsonb_build_array(
  pg_temp.money_row(2, 'expense', 'RCN-I1', null, null) || jsonb_build_object('cost', 300, 'lines', jsonb_build_array(
    jsonb_build_object('amount', 250, 'approved_at', '2026-03-01 10:00', 'expense_type', 'Hotel'),
    jsonb_build_object('amount', 50, 'approved_at', '2026-03-01 11:00', 'expense_type', 'Visa')))));

-- agreement: both sides say 2,900 / 500 / 1,000 over four units, and no gap is listed
select test.eq((pg_temp.rec() -> 'overview' ->> 'revenue')::numeric, 2900.00, 'the Finance page''s side: revenue 2,900');
select test.eq(pg_temp.rec() -> 'overview', pg_temp.rec() -> 'ledger', 'the two sides say the same four figures');
select test.eq((pg_temp.rec() -> 'ledger' ->> 'cost')::numeric, 500.00, 'cost 500 (200 recorded here + 300 imported)');
select test.eq((pg_temp.rec() -> 'ledger' ->> 'profit')::numeric, 800.00, 'profit 800 (300 + 500): only the rows with a cost');
select test.eq(pg_temp.rec() -> 'gaps', '[]'::jsonb, 'no gap is listed');
select test.eq((pg_temp.rec() ->> 'agrees')::boolean, true, 'Finance agrees with itself');
select test.eq((pg_temp.rec() ->> 'failing')::int, 0, 'nothing is failing');

-- a credit lowers the cost on the row; the two sides keep agreeing
select pg_temp.apply('transaction_expense_export', jsonb_build_array(
  pg_temp.money_row(2, 'expense', 'RCN-I1', null, null) || jsonb_build_object('cost', -40, 'lines', jsonb_build_array(
    jsonb_build_object('amount', -40, 'approved_at', '2026-03-09 10:00', 'expense_type', 'Hotel')))));
select test.eq((pg_temp.rec() -> 'ledger' ->> 'cost')::numeric, 460.00, 'the credit lowers the cost: 500 - 40');
select test.eq((pg_temp.rec() -> 'ledger' ->> 'revenue')::numeric, 2900.00, 'revenue is not rewritten by a credit');
select test.eq(pg_temp.rec() -> 'gaps', '[]'::jsonb, 'and Finance still agrees with itself');

-- seeded disagreement 1: a row's profit is not its revenue less its cost (by 50)
select test.as_owner();
select test.act(current_setting('t.head')::uuid);
update work.import_record set profit_sar = profit_sar + 50 where transaction_ref = 'RCN-I1' and partner_id = current_setting('t.p')::uuid;
select test.done();
select test.as_person(current_setting('t.head')::uuid);
select test.eq((pg_temp.rec() ->> 'agrees')::boolean, false, 'a seeded disagreement: Finance no longer agrees with itself');
select test.eq(jsonb_array_length(pg_temp.gaps('row_profit')), 1, 'the row is listed');
select test.eq(pg_temp.gaps('row_profit') -> 0 ->> 'number', 'RCN-I1', 'by its number');
select test.eq((pg_temp.gaps('row_profit') -> 0 ->> 'difference')::numeric, 50.00, 'with the difference: 50');
select test.eq((pg_temp.gaps('row_profit') -> 0 ->> 'failing')::boolean, true, '1 SAR or more is a failure');
select test.ok((pg_temp.rec() ->> 'failing')::int >= 1, 'and the answer counts it as failing');
-- under 1 SAR: listed, not a failure
select test.as_owner();
select test.act(current_setting('t.head')::uuid);
update work.import_record set profit_sar = profit_sar - 50 + 0.40 where transaction_ref = 'RCN-I1' and partner_id = current_setting('t.p')::uuid;
select test.done();
select test.as_person(current_setting('t.head')::uuid);
select test.eq((pg_temp.gaps('row_profit') -> 0 ->> 'difference')::numeric, 0.40, 'a gap of 0.40 is still listed');
select test.eq((pg_temp.gaps('row_profit') -> 0 ->> 'failing')::boolean, false, 'but under 1 SAR it is not a failure');
select test.as_owner();
select test.act(current_setting('t.head')::uuid);
update work.import_record set profit_sar = profit_sar - 0.40 where transaction_ref = 'RCN-I1' and partner_id = current_setting('t.p')::uuid;
select test.done();
select test.as_person(current_setting('t.head')::uuid);
select test.eq(pg_temp.rec() -> 'gaps', '[]'::jsonb, 'put right: the list is empty again');

-- seeded disagreement 2: a row's cost is not the sum of its own expense lines (260 kept, 300 written)
select test.as_owner();
select test.act(current_setting('t.head')::uuid);
update work.import_record set cost_sar = 300, profit_sar = 500 where transaction_ref = 'RCN-I1' and partner_id = current_setting('t.p')::uuid;
select test.done();
select test.as_person(current_setting('t.head')::uuid);
select test.eq(jsonb_array_length(pg_temp.gaps('cost_lines')), 1, 'a cost that is not the sum of its expense lines is listed');
select test.eq((pg_temp.gaps('cost_lines') -> 0 ->> 'left')::numeric, 300.00, 'the cost written');
select test.eq((pg_temp.gaps('cost_lines') -> 0 ->> 'right')::numeric, 260.00, 'beside the sum of its lines');
select test.eq((pg_temp.gaps('cost_lines') -> 0 ->> 'difference')::numeric, 40.00, 'and the difference');
select test.eq(jsonb_array_length(pg_temp.gaps('row_profit')), 0, 'while its profit still is its revenue less its cost');

-- a bad period is refused
select test.raises($$select api.finance_reconciliation('2026-02-01'::date, '2026-01-01'::date)$$, 'P0001', 'a period the wrong way round is refused');
