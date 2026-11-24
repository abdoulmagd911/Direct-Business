-- CKY-01 — the cost side is keyed right (Landing 47, A3 + A4 and the credit rule of A10), through the real import
-- doors (api.import_batch_start / api.import_apply) with rows in the screen's own shape.
-- A4: one expense is told from another by the transaction number, the amount, the approval time and the expense
--     type. Two lines equal on all four are counted once — in one file and across files; lines that differ on any
--     one are both counted. A later file adds what is new to the stored cost; it never replaces it with its own sum.
--     A credit is a negative line: it lowers the cost and rewrites nothing else on the Fully Paid row.
-- A3: an expense whose reference is a tax invoice number (DPIN…/TTIN…, or the tax number a stored row carries) is
--     held for a person and is no row's cost. An expense carrying an INVOICE number is never that invoice's cost.
-- Every value is made up.
-- Sabotage: supabase/tests/sabotage/a-later-expense-file-replaces-the-cost.sql,
--   a-repeated-expense-line-is-counted-twice.sql, an-expense-keyed-to-a-tax-invoice-is-written.sql,
--   the-expense-keys-are-not-kept.sql.
select set_config('t.head', test.person('Test Finance Head', 'head')::text, true);
select set_config('t.member', test.person('Test Member', 'member')::text, true);
select set_config('t.d', (core.riyadh_today() - 5)::text, true);
create function pg_temp.money_row(p_no int, p_kind text, p_txn text, p_inv text, p_amount numeric, p_tax text default null) returns jsonb
language sql as $$
  select jsonb_build_object('row_no', p_no, 'kind', p_kind, 'transaction_ref', p_txn, 'invoice_ref', p_inv,
    'tax_no', p_tax, 'record_date', current_setting('t.d'), 'amount', p_amount, 'wallet_topup', 0, 'cost', null,
    'status_text', 'Fully Paid', 'fully_paid', true, 'audit_required', false, 'provisional', false, 'product', null,
    'expense_gate', null, 'source_promo', null, 'promo_before', null, 'promo_discount', null, 'promo_after', null,
    'direct_url', null, 'direct_ref', null, 'duplicate', false)
$$;
create function pg_temp.expense_row(p_no int, p_txn text, p_file_sum numeric, p_lines jsonb) returns jsonb
language sql as $$
  select pg_temp.money_row(p_no, 'expense', p_txn, null, null) || jsonb_build_object('cost', p_file_sum, 'lines', p_lines)
$$;
create function pg_temp.line(p_amount numeric, p_at text, p_type text) returns jsonb
language sql as $$ select jsonb_build_object('amount', p_amount, 'approved_at', p_at, 'expense_type', p_type) $$;
create function pg_temp.apply(p_signature text, p_rows jsonb) returns jsonb
language sql as $$
  select api.import_apply((api.import_batch_start(current_setting('t.p')::uuid, p_signature, 'made-up.csv') ->> 'id')::uuid, p_rows)
$$;
create function pg_temp.stored(p_txn text) returns work.import_record
language sql security definer as $$
  select r from work.import_record r where r.partner_id = current_setting('t.p')::uuid and r.transaction_ref = p_txn and r.deleted_at is null
$$;
grant execute on function pg_temp.money_row(int, text, text, text, numeric, text), pg_temp.expense_row(int, text, numeric, jsonb),
  pg_temp.line(numeric, text, text), pg_temp.apply(text, jsonb), pg_temp.stored(text) to public;

select test.as_person(current_setting('t.head')::uuid);
select set_config('t.p', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Cost Key Co',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate')))) ->> 'id', true);


-- two transactions of 1,000 each, one of them with its invoice and a tax number; and an invoice with no transaction yet
select pg_temp.apply('invoice_export', jsonb_build_array(
  pg_temp.money_row(2, 'transaction', 'CKY-T1', '9911000001', 1000, 'DPIN-T-990001'),
  pg_temp.money_row(3, 'transaction', 'CKY-T2', '9911000002', 1000),
  pg_temp.money_row(4, 'invoice', null, '9911000003', 500, 'MADEUP-TAX-7')));
-- the invoice of CKY-T1 arrives: the transaction is now Fully Paid
select pg_temp.apply('invoice_export', jsonb_build_array(pg_temp.money_row(2, 'invoice', null, '9911000001', 1000, 'DPIN-T-990001')));
select test.eq((pg_temp.stored('CKY-T1')).fully_paid, true, 'CKY-T1 is Fully Paid before any expense arrives');

-- A4, one file: four lines on CKY-T1. Two are the same expense (same amount, time and type); one differs by its
-- time and one by its type — three expenses, 300, never 400.
select set_config('t.r1', pg_temp.apply('transaction_expense_export', jsonb_build_array(
  pg_temp.expense_row(2, 'CKY-T1', 400, jsonb_build_array(
    pg_temp.line(100, '2026-03-01 10:00', 'Hotel'),
    pg_temp.line(100, '2026-03-01 10:00', 'Hotel'),
    pg_temp.line(100, '2026-03-02 10:00', 'Hotel'),
    pg_temp.line(100, '2026-03-01 10:00', 'Flight')))))::text, true);
select test.eq((pg_temp.stored('CKY-T1')).cost_sar, 300.00, 'the repeated line is counted once: cost 300, not 400');
select test.eq(cardinality((pg_temp.stored('CKY-T1')).expense_keys), 3, 'three expense lines are kept by their keys');
select test.eq((pg_temp.stored('CKY-T1')).profit_sar, 700.00, 'profit is the transaction''s revenue less its approved expenses');
select test.eq(current_setting('t.r1')::jsonb -> 'expense_lines', '{"added": 3, "repeated": 1}'::jsonb,
  'the answer says three lines were added and one was a repeat');

-- the same file again changes nothing
select set_config('t.r2', pg_temp.apply('transaction_expense_export', jsonb_build_array(
  pg_temp.expense_row(2, 'CKY-T1', 400, jsonb_build_array(
    pg_temp.line(100, '2026-03-01 10:00', 'Hotel'),
    pg_temp.line(100, '2026-03-01 10:00', 'Hotel'),
    pg_temp.line(100, '2026-03-02 10:00', 'Hotel'),
    pg_temp.line(100, '2026-03-01 10:00', 'Flight')))))::text, true);
select test.eq((pg_temp.stored('CKY-T1')).cost_sar, 300.00, 'the same file twice: the cost does not move');
select test.eq((current_setting('t.r2')::jsonb -> 'counts' ->> 'unchanged')::int, 1, 'and the row is counted unchanged');
select test.eq(current_setting('t.r2')::jsonb -> 'expense_lines', '{"added": 0, "repeated": 4}'::jsonb, 'every line was a repeat');

-- a later file carrying one new expense ADDS to the stored cost; the type's spelling does not make a new expense
select pg_temp.apply('transaction_expense_export', jsonb_build_array(
  pg_temp.expense_row(2, 'CKY-T1', 150, jsonb_build_array(
    pg_temp.line(50, '2026-03-05 09:00', 'Visa'),
    pg_temp.line(100, '2026-03-01 10:00', '  HOTEL ')))));
select test.eq((pg_temp.stored('CKY-T1')).cost_sar, 350.00, 'a later file adds its new expense: 300 + 50, never replaced by 150');

-- A10: a credit is a line of its own; it lowers the cost and rewrites nothing else on the Fully Paid row
select pg_temp.apply('transaction_expense_export', jsonb_build_array(
  pg_temp.expense_row(2, 'CKY-T1', -50, jsonb_build_array(pg_temp.line(-50, '2026-03-09 09:00', 'Hotel')))));
select test.eq((pg_temp.stored('CKY-T1')).cost_sar, 300.00, 'a credit lowers the cost on the row: 350 - 50');
select test.eq((pg_temp.stored('CKY-T1')).profit_sar, 700.00, 'and profit follows');
select test.eq((pg_temp.stored('CKY-T1')).revenue_sar, 1000.00, 'the revenue of the Fully Paid row is not rewritten');
select test.eq((pg_temp.stored('CKY-T1')).fully_paid, true, 'nor its paid state');
select test.eq((pg_temp.stored('CKY-T1')).status_text, 'Fully Paid', 'nor its status');

-- A3: an expense keyed to a tax invoice number is held, by its shape or because a stored row carries it as its tax number
select set_config('t.r3', pg_temp.apply('transaction_expense_export', jsonb_build_array(
  pg_temp.expense_row(2, 'DPIN-T-990001', 80, jsonb_build_array(pg_temp.line(80, '2026-03-01 10:00', 'Hotel'))),
  pg_temp.expense_row(3, 'TTIN-T-0042', 80, jsonb_build_array(pg_temp.line(80, '2026-03-01 10:00', 'Hotel'))),
  pg_temp.expense_row(4, 'MADEUP-TAX-7', 80, jsonb_build_array(pg_temp.line(80, '2026-03-01 10:00', 'Hotel'))),
  pg_temp.expense_row(5, 'CKY-T2', 200, jsonb_build_array(pg_temp.line(200, '2026-03-01 10:00', 'Hotel')))))::text, true);
select test.eq((current_setting('t.r3')::jsonb -> 'counts' ->> 'excluded')::int, 3, 'three expense rows keyed to a tax invoice number are held');
select test.eq((select count(*)::int from jsonb_array_elements(current_setting('t.r3')::jsonb -> 'problems') p
                where p ->> 'reason' like 'An expense is keyed to a transaction number%'), 3, 'each with the reason in words');
select test.eq((pg_temp.stored('CKY-T2')).cost_sar, 200.00, 'the expense keyed to a transaction number is that transaction''s cost');
select test.eq((pg_temp.stored('CKY-T1')).cost_sar, 300.00, 'the row that carries DPIN-T-990001 gained no cost from it');
select test.as_owner();
select test.eq((select count(*)::int from work.import_record where partner_id = current_setting('t.p')::uuid
                and transaction_ref in ('DPIN-T-990001', 'TTIN-T-0042', 'MADEUP-TAX-7')), 0, 'and no row was written for a held expense');

-- an expense carrying an INVOICE number is never that invoice's cost: the invoice keeps an empty cost
select test.as_person(current_setting('t.head')::uuid);
select pg_temp.apply('transaction_expense_export', jsonb_build_array(
  pg_temp.expense_row(2, '9911000003', 60, jsonb_build_array(pg_temp.line(60, '2026-03-01 10:00', 'Hotel')))));
select test.as_owner();
select test.eq((select cost_sar from work.import_record where partner_id = current_setting('t.p')::uuid
                and invoice_ref = '9911000003' and transaction_ref is null and kind = 'invoice'), null::numeric,
  'the invoice-only row keeps an empty cost: an expense never joins by an invoice number');

-- the preview's read answers what Confirm will store, before anything is written
select test.as_person(current_setting('t.head')::uuid);
select set_config('t.pv', api.import_expense_preview(current_setting('t.p')::uuid, jsonb_build_array(
  jsonb_build_object('row_no', 2, 'transaction_ref', 'CKY-T2', 'lines', jsonb_build_array(
    pg_temp.line(200, '2026-03-01 10:00', 'Hotel'), pg_temp.line(30, '2026-03-03 10:00', 'Visa'))),
  jsonb_build_object('row_no', 3, 'transaction_ref', 'DPIN-T-1', 'lines', jsonb_build_array(pg_temp.line(5, 'x', 'y')))))::text, true);
select test.eq((current_setting('t.pv')::jsonb -> 0 ->> 'cost')::numeric, 230.00, 'the preview: 200 stored + 30 new');
select test.eq((current_setting('t.pv')::jsonb -> 0 ->> 'repeated')::int, 1, 'the preview counts the repeat');
select test.eq((current_setting('t.pv')::jsonb -> 1 ->> 'held')::boolean, true, 'the preview holds a tax invoice number');
select test.eq((pg_temp.stored('CKY-T2')).cost_sar, 200.00, 'the preview wrote nothing');

-- a caller that sends no lines gets the old behaviour: the file's own figure
select pg_temp.apply('transaction_expense_export', jsonb_build_array(pg_temp.money_row(2, 'expense', 'CKY-T2', null, null) || '{"cost": 75}'::jsonb));
select test.eq((pg_temp.stored('CKY-T2')).cost_sar, 75.00, 'a row with no lines is written as it came');

-- who may: the preview is for Full on Finance
select test.as_person(current_setting('t.member')::uuid);
select test.raises(format('select api.import_expense_preview(%L, %L)', current_setting('t.p'), '[]'), '42501',
  'a member cannot read the expense preview');
