-- IMP-13 — api.import_apply answers, without ambiguous columns (live failure 6 Nov 2026:
-- Postgres 42702 'column reference "kind" is ambiguous' and '"problems" is ambiguous' on
-- /rest/v1/rpc/import_apply, so no workstream-D import could confirm at all).
-- Unlike IMP-01..IMP-12, which call the OLDER api.finance_import engine, this test calls the
-- REAL workstream-D engine, api.import_apply (work.import_apply), with rows in the exact
-- shape the UI sends (src/modules/imports/apply.ts toApplyPayload).
-- The rows exercise every ambiguous site the fix renames: an invoice row hits the
-- invoice-only lookup (kind <> 'promo'); a transaction row completing that invoice hits
-- the progressive-fill lookup (kind <> 'promo'); a transaction row filling an invoice
-- number an invoice-only row already holds hits the clash check (kind <> 'promo'); a
-- promo row in its own promo batch hits the promo-branch lookup (kind <> 'promo'); and
-- the final UPDATE of the batch carries the problems assignment. Every value is made up.
select set_config('t.head', test.person('Test Finance Head', 'head')::text, true);
select set_config('t.d', (core.riyadh_today() - 5)::text, true);
select test.as_person(current_setting('t.head')::uuid);
-- the company, via the api (partner_create needs a non-empty sides array)
select set_config('t.p', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Imp13 Co',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate')))) ->> 'id', true);
-- the draft batch, via the api
select set_config('t.b', api.import_batch_start(current_setting('t.p')::uuid, 'invoice_export', 'made-up.csv') ->> 'id', true);

-- Six rows in the UI's toApplyPayload shape: row 2 an invoice-only row, row 3 the
-- transaction that completes it, row 4 a transaction with no invoice yet, row 5 a second
-- invoice-only row, row 6 a transaction carrying a new invoice number, row 7 the same
-- transaction as row 4 now naming row 5's invoice number (a clash: both rows stay).
select set_config('t.rows', jsonb_build_array(
  jsonb_build_object('row_no', 2, 'kind', 'invoice', 'transaction_ref', null, 'invoice_ref', '1163000001',
    'tax_no', '300000000001233', 'record_date', current_setting('t.d'), 'amount', 1000, 'wallet_topup', 0,
    'cost', null, 'status_text', 'Fully Paid', 'fully_paid', true, 'audit_required', false, 'provisional', false,
    'product', null, 'expense_gate', null, 'source_promo', null, 'promo_before', null, 'promo_discount', null,
    'promo_after', null, 'direct_url', null, 'direct_ref', null, 'duplicate', false),
  jsonb_build_object('row_no', 3, 'kind', 'transaction', 'transaction_ref', 'TX-IMP13-1', 'invoice_ref', '1163000001',
    'tax_no', null, 'record_date', current_setting('t.d'), 'amount', 1000, 'wallet_topup', 0,
    'cost', null, 'status_text', 'Fully Paid', 'fully_paid', true, 'audit_required', false, 'provisional', false,
    'product', 'Direct Hotels', 'expense_gate', null, 'source_promo', null, 'promo_before', null, 'promo_discount', null,
    'promo_after', null, 'direct_url', null, 'direct_ref', null, 'duplicate', false),
  jsonb_build_object('row_no', 4, 'kind', 'transaction', 'transaction_ref', 'TX-IMP13-2', 'invoice_ref', null,
    'tax_no', null, 'record_date', current_setting('t.d'), 'amount', 250, 'wallet_topup', 0,
    'cost', null, 'status_text', null, 'fully_paid', false, 'audit_required', false, 'provisional', false,
    'product', 'Direct Flights', 'expense_gate', null, 'source_promo', null, 'promo_before', null, 'promo_discount', null,
    'promo_after', null, 'direct_url', null, 'direct_ref', null, 'duplicate', false),
  jsonb_build_object('row_no', 5, 'kind', 'invoice', 'transaction_ref', null, 'invoice_ref', '1163000002',
    'tax_no', null, 'record_date', current_setting('t.d'), 'amount', 400, 'wallet_topup', 0,
    'cost', null, 'status_text', 'Fully Paid', 'fully_paid', true, 'audit_required', false, 'provisional', false,
    'product', null, 'expense_gate', null, 'source_promo', null, 'promo_before', null, 'promo_discount', null,
    'promo_after', null, 'direct_url', null, 'direct_ref', null, 'duplicate', false),
  jsonb_build_object('row_no', 6, 'kind', 'transaction', 'transaction_ref', 'TX-IMP13-3', 'invoice_ref', '1163000003',
    'tax_no', null, 'record_date', current_setting('t.d'), 'amount', 700, 'wallet_topup', 0,
    'cost', null, 'status_text', 'Fully Paid', 'fully_paid', true, 'audit_required', false, 'provisional', false,
    'product', 'Direct Hotels', 'expense_gate', null, 'source_promo', null, 'promo_before', null, 'promo_discount', null,
    'promo_after', null, 'direct_url', null, 'direct_ref', null, 'duplicate', false),
  jsonb_build_object('row_no', 7, 'kind', 'transaction', 'transaction_ref', 'TX-IMP13-2', 'invoice_ref', '1163000002',
    'tax_no', null, 'record_date', current_setting('t.d'), 'amount', 250, 'wallet_topup', 0,
    'cost', null, 'status_text', 'Fully Paid', 'fully_paid', true, 'audit_required', false, 'provisional', false,
    'product', 'Direct Flights', 'expense_gate', null, 'source_promo', null, 'promo_before', null, 'promo_discount', null,
    'promo_after', null, 'direct_url', null, 'direct_ref', null, 'duplicate', false))::text, true);
-- one held row, travelling apart as the UI sends it: it counts as excluded, never written
select set_config('t.held', jsonb_build_array(
  jsonb_build_object('row_no', 8, 'reason', 'made-up held reason'))::text, true);

-- the apply itself must answer, not raise 42702
select set_config('t.r', api.import_apply(current_setting('t.b')::uuid, current_setting('t.rows')::jsonb,
  current_setting('t.held')::jsonb)::text, true);
-- traced through the engine: row 2 needs linking, row 3 updates it, row 4 needs linking,
-- row 5 needs linking, row 6 is new, row 7 updates (and raises the clash problem)
select test.eq(current_setting('t.r')::jsonb -> 'counts',
  '{"new": 1, "updated": 2, "unchanged": 0, "excluded": 1, "needs_linking": 3}'::jsonb,
  'one new, two updated, one excluded, three needing linking');
select test.eq(jsonb_array_length(current_setting('t.r')::jsonb -> 'problems'), 2,
  'two problems: the clash and the held row');
select test.eq((select jsonb_agg(p ->> 'reason' order by (p ->> 'row_no')::int)
                from jsonb_array_elements(current_setting('t.r')::jsonb -> 'problems') p),
  '["Invoice number is already on another row: held for a person, nothing merged by guess", "made-up held reason"]'::jsonb,
  'each problem says why, the clash first');

-- what was stored
select test.as_owner();
select test.eq((select count(*)::int from work.import_record
                where partner_id = current_setting('t.p')::uuid and batch_id = current_setting('t.b')::uuid
                  and deleted_at is null), 4,
  'four stored rows: three transactions and the one invoice still waiting for its transaction');
select test.eq((select jsonb_object_agg(coalesce(transaction_ref, invoice_ref), kind) from work.import_record
                where partner_id = current_setting('t.p')::uuid and deleted_at is null),
  '{"TX-IMP13-1": "transaction", "TX-IMP13-2": "transaction", "TX-IMP13-3": "transaction", "1163000002": "invoice"}'::jsonb,
  'the invoice row completed into its transaction; the second invoice row is still invoice-only');
select test.eq((select jsonb_build_object('amount', amount_sar, 'revenue', revenue_sar, 'invoice', invoice_ref,
                'tax', tax_no, 'status', status_text, 'paid', fully_paid, 'product', product,
                'missing_txn', missing_transaction, 'needs', needs_linking)
                from work.import_record where transaction_ref = 'TX-IMP13-1'),
  '{"amount": 1000.00, "revenue": 1000.00, "invoice": "1163000001", "tax": "300000000001233", "status": "Fully Paid", "paid": true, "product": "Direct Hotels", "missing_txn": false, "needs": false}'::jsonb,
  'the transaction completed the invoice row: amount and tax and status kept, no longer needing linking');
select test.eq((select jsonb_build_object('amount', amount_sar, 'revenue', revenue_sar, 'invoice', invoice_ref,
                'missing_inv', missing_invoice, 'needs', needs_linking)
                from work.import_record where transaction_ref = 'TX-IMP13-2'),
  '{"amount": 250.00, "revenue": 250.00, "invoice": "1163000002", "missing_inv": false, "needs": false}'::jsonb,
  'the clash row kept its own amount and took the invoice number, and is no longer needing linking');
select test.eq((select jsonb_build_object('amount', amount_sar, 'revenue', revenue_sar, 'invoice', invoice_ref,
                'missing_inv', missing_invoice, 'needs', needs_linking)
                from work.import_record where transaction_ref = 'TX-IMP13-3'),
  '{"amount": 700.00, "revenue": 700.00, "invoice": "1163000003", "missing_inv": false, "needs": false}'::jsonb,
  'the transaction with a new invoice number is new, with its own amount as revenue');
select test.eq((select jsonb_build_object('amount', amount_sar, 'revenue', revenue_sar, 'missing_txn', missing_transaction,
                'needs', needs_linking)
                from work.import_record where transaction_ref is null and invoice_ref = '1163000002'),
  '{"amount": 400.00, "revenue": 400.00, "missing_txn": true, "needs": true}'::jsonb,
  'the second invoice row stays on its own, flagged until its transaction arrives');
select test.eq((select status from work.import_batch where id = current_setting('t.b')::uuid), 'confirmed',
  'the batch is confirmed');
select test.eq((select counts from work.import_batch where id = current_setting('t.b')::uuid),
  current_setting('t.r')::jsonb -> 'counts', 'the stored counts are the answered counts');
select test.eq((select problems from work.import_batch where id = current_setting('t.b')::uuid),
  current_setting('t.r')::jsonb -> 'problems', 'the stored problems are the answered problems');

-- the promo branch, in its own promo batch (a promo row only fits a batch carrying a code):
-- the single transaction row for invoice 1163000003 takes the code link
select test.as_person(current_setting('t.head')::uuid);
select set_config('t.b2', api.import_batch_start(current_setting('t.p')::uuid, 'promo_code_invoice_export',
  'made-up-promo.csv', 'MADE-UP-CODE') ->> 'id', true);
select set_config('t.r2', api.import_apply(current_setting('t.b2')::uuid, jsonb_build_array(
  jsonb_build_object('row_no', 2, 'kind', 'promo', 'transaction_ref', null, 'invoice_ref', '1163000003',
    'tax_no', null, 'record_date', current_setting('t.d'), 'amount', null, 'wallet_topup', null,
    'cost', null, 'status_text', null, 'fully_paid', false, 'audit_required', false, 'provisional', false,
    'product', null, 'expense_gate', null, 'source_promo', null, 'promo_before', 700, 'promo_discount', 70,
    'promo_after', 630, 'direct_url', null, 'direct_ref', null, 'duplicate', false)))::text, true);
select test.eq(current_setting('t.r2')::jsonb -> 'counts',
  '{"new": 0, "updated": 1, "unchanged": 0, "excluded": 0, "needs_linking": 0}'::jsonb,
  'the promo row links its code to the one transaction row');
select test.eq(current_setting('t.r2')::jsonb -> 'problems', '[]'::jsonb, 'no problem on the promo link');
select test.as_owner();
select test.eq((select jsonb_build_object('amount', amount_sar, 'invoice', invoice_ref, 'code', source_promo,
                'attributed', attribution_promo, 'before', promo_before_sar, 'discount', promo_discount_sar,
                'after', promo_after_sar)
                from work.import_record where transaction_ref = 'TX-IMP13-3'),
  '{"amount": 700.00, "invoice": "1163000003", "code": "MADE-UP-CODE", "attributed": true, "before": 700.00, "discount": 70.00, "after": 630.00}'::jsonb,
  'the code and its promo amounts sit on the transaction row, its amount untouched');
select test.eq((select status from work.import_batch where id = current_setting('t.b2')::uuid), 'confirmed',
  'the promo batch is confirmed');
