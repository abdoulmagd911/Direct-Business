-- DPN-01 — Landing 47, A14. A row that carries a DPIN has its tax invoice issued, and says so; a TTIN or no number
-- does not. Hand edits and removals happen at the transaction's level only: a monthly (billing) invoice is refused
-- by both hand doors, in words, while a transaction is edited and removed as before. A re-import never touches a
-- row typed by hand: the same number arriving through the import door writes nothing to the typed row, and the
-- Ledger keeps the typed row. Every value is made up.
-- Sabotage: supabase/tests/sabotage/a-dpin-does-not-say-issued.sql, a-monthly-invoice-is-edited-by-hand.sql,
--   a-monthly-invoice-is-removed-by-hand.sql, a-re-import-rewrites-the-typed-row.sql.
select set_config('t.head', test.person('Test Finance Head', 'head')::text, true);
select set_config('t.d', (core.riyadh_today() - 5)::text, true);
create function pg_temp.row_of(p_number text) returns jsonb language sql as
$$ select r from pg_catalog.jsonb_array_elements(api.finance_unified_ledger('2026-01-01'::date, '2026-12-31'::date) -> 'rows') r where r ->> 'number' = p_number $$;
grant execute on function pg_temp.row_of(text) to public;

select test.as_person(current_setting('t.head')::uuid);
select set_config('t.p', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Dpin Org',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate')))) ->> 'id', true);
select api.identifier_add(current_setting('t.p')::uuid, 'payments_client_id', '990301', 'made up', 'prepaid');
-- recorded here: a standalone invoice with its DPIN, a transaction with none, and a monthly invoice over it
select api.finance_import('invoices', jsonb_build_array(
  jsonb_build_object('ref', 'DPN-S1', 'client_id', '990301', 'status', 'Fully Paid',
                     'created_on', current_setting('t.d'), 'total_sar', 600, 'dpin', 'DPIN-T-990311', 'dpin_total', 600),
  jsonb_build_object('ref', 'DPN-T1', 'consolidated_ref', 'DPN-B1', 'client_id', '990301', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 400),
  jsonb_build_object('ref', 'DPN-B1', 'is_consolidated', true, 'client_id', '990301', 'status', 'Fully Paid',
                     'created_on', current_setting('t.d'), 'total_sar', 400)),
  now() - interval '1 day');
-- typed by hand
select set_config('t.typed', api.finance_row_add('invoice', jsonb_build_object('ref', 'DPN-H1', 'kind', 'transaction',
  'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 900, 'client_id', '990301'), 'made up: typed') ->> 'id', true);
-- imported: one row with a DPIN, one with a TTIN, one with no tax number
select test.act(current_setting('t.head')::uuid);
insert into work.import_batch (id, partner_id, signature, file_name, created_by)
values ('00000000-0000-4000-8000-00000000d914', current_setting('t.p')::uuid, 'invoice_export', 'made-up-dpn.csv', current_setting('t.head')::uuid);
insert into work.import_record (partner_id, batch_id, kind, transaction_ref, invoice_ref, tax_no, record_date, amount_sar, revenue_sar, fully_paid, created_by)
values (current_setting('t.p')::uuid, '00000000-0000-4000-8000-00000000d914', 'transaction', 'DPN-I1', 'DPN-INV-1', 'DPIN-T-990312', current_setting('t.d')::date, 100, 100, true, current_setting('t.head')::uuid),
       (current_setting('t.p')::uuid, '00000000-0000-4000-8000-00000000d914', 'transaction', 'DPN-I2', 'DPN-INV-2', 'TTIN-T-990313', current_setting('t.d')::date, 100, 100, true, current_setting('t.head')::uuid),
       (current_setting('t.p')::uuid, '00000000-0000-4000-8000-00000000d914', 'transaction', 'DPN-I3', 'DPN-INV-3', null, current_setting('t.d')::date, 100, 100, true, current_setting('t.head')::uuid);
select test.done();
select test.as_owner();
select set_config('t.bill', (select id from finance.invoice where ref = 'DPN-B1')::text, true);
select set_config('t.txn', (select id from finance.invoice where ref = 'DPN-T1')::text, true);
select set_config('t.txn_v', (select version from finance.invoice where ref = 'DPN-T1')::text, true);
select set_config('t.bill_v', (select version from finance.invoice where ref = 'DPN-B1')::text, true);

-- the DPIN is the indicator
select test.as_person(current_setting('t.head')::uuid);
select test.eq(pg_temp.row_of('DPN-S1') ->> 'tax_invoice_issued', 'true', 'a row recorded here with a DPIN says its tax invoice is issued');
select test.eq(pg_temp.row_of('DPN-T1') ->> 'tax_invoice_issued', 'false', 'a row with no DPIN does not');
select test.eq(pg_temp.row_of('DPN-I1') ->> 'tax_invoice_issued', 'true', 'an imported row carrying a DPIN says so too');
select test.eq(pg_temp.row_of('DPN-I2') ->> 'tax_invoice_issued', 'false', 'a TTIN is not a DPIN');
select test.eq(pg_temp.row_of('DPN-I3') ->> 'tax_invoice_issued', 'false', 'no tax number, not issued');

-- hand edits and removals at the transaction's level only
select test.raises(format('select api.finance_row_edit(%L, %L, %L, %s, %L)', 'invoice', current_setting('t.bill'),
  '{"total_sar": 450}', current_setting('t.bill_v'), 'made up'), 'P0001',
  'a monthly invoice is not edited by hand', 'finance.edit_at_transaction_level');
select test.raises(format('select api.finance_rows_remove(%L, %L::uuid[], %L)', 'invoice', '{' || current_setting('t.bill') || '}', 'made up'),
  'P0001', 'nor removed by hand', 'finance.edit_at_transaction_level');
select test.raises(format('select api.finance_rows_remove(%L, %L::uuid[], %L)', 'invoice',
  '{' || current_setting('t.txn') || ',' || current_setting('t.bill') || '}', 'made up'),
  'P0001', 'nor removed along with a transaction', 'finance.edit_at_transaction_level');
select test.as_owner();
select test.eq((select total_sar from finance.invoice where id = current_setting('t.bill')::uuid), 400.00, 'the monthly invoice is as it was');
select test.eq((select deleted_at is null from finance.invoice where id = current_setting('t.txn')::uuid), true, 'and nothing was removed with it');
select test.as_person(current_setting('t.head')::uuid);
select test.runs(format('select api.finance_row_edit(%L, %L, %L, %s, %L)', 'invoice', current_setting('t.txn'),
  '{"total_sar": 420}', current_setting('t.txn_v'), 'made up: the transaction was 420'), 'a transaction is edited by hand as before');
select test.eq((pg_temp.row_of('DPN-T1') ->> 'revenue')::numeric, 420.00, 'and the Ledger follows the edit');

-- a re-import never touches a row typed by hand
select test.as_owner();
select set_config('t.typed_before', (select to_jsonb(i) from finance.invoice i where i.id = current_setting('t.typed')::uuid)::text, true);
select test.as_person(current_setting('t.head')::uuid);
select api.import_apply((api.import_batch_start(current_setting('t.p')::uuid, 'invoice_export', 'made-up-again.csv') ->> 'id')::uuid,
  jsonb_build_array(jsonb_build_object('row_no', 2, 'kind', 'transaction', 'transaction_ref', 'DPN-H1', 'invoice_ref', 'DPN-INV-9',
    'tax_no', null, 'record_date', current_setting('t.d'), 'amount', 111, 'wallet_topup', 0, 'cost', null, 'status_text', 'Fully Paid',
    'fully_paid', true, 'audit_required', false, 'provisional', false, 'product', null, 'expense_gate', null, 'source_promo', null,
    'promo_before', null, 'promo_discount', null, 'promo_after', null, 'direct_url', null, 'direct_ref', null, 'duplicate', false),
  jsonb_build_object('row_no', 3, 'kind', 'invoice', 'transaction_ref', null, 'invoice_ref', 'DPN-INV-9',
    'tax_no', null, 'record_date', current_setting('t.d'), 'amount', 111, 'wallet_topup', 0, 'cost', null, 'status_text', 'Fully Paid',
    'fully_paid', true, 'audit_required', false, 'provisional', false, 'product', null, 'expense_gate', null, 'source_promo', null,
    'promo_before', null, 'promo_discount', null, 'promo_after', null, 'direct_url', null, 'direct_ref', null, 'duplicate', false)));
select test.as_owner();
select test.eq((select to_jsonb(i) from finance.invoice i where i.id = current_setting('t.typed')::uuid),
  current_setting('t.typed_before')::jsonb, 'the typed row is untouched by the import, field for field');
select test.as_person(current_setting('t.head')::uuid);
select test.eq((pg_temp.row_of('DPN-H1') ->> 'revenue')::numeric, 900.00, 'the Ledger keeps the typed row''s amount, not the file''s 111');
select test.eq(pg_temp.row_of('DPN-H1') ->> 'source', 'manual', 'and says the row is the one recorded here');
select test.eq((select count(*)::int from jsonb_array_elements(api.finance_unified_ledger('2026-01-01'::date, '2026-12-31'::date) -> 'rows') r
                where r ->> 'number' = 'DPN-H1'), 1, 'the document is listed once');
