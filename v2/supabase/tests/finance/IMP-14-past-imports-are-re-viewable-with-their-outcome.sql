-- IMP-14 — past imports are re-viewable (F177): a confirmed import's outcome — its counts, its held rows with their
-- reasons, who confirmed it and its stored source file — reads back through api.import_batches, and the rows it
-- first wrote read back through api.import_batch_rows. A draft batch shows with five zero counts; a missing
-- partner or batch is not found; another partner's batches never appear. Every value is made up.
select set_config('t.head', test.person('Test Finance Head', 'head')::text, true);
select set_config('t.d', (core.riyadh_today() - 5)::text, true);
select test.as_person(current_setting('t.head')::uuid);
-- the company, via the api (partner_create needs a non-empty sides array)
select set_config('t.p', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Imp14 Co',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate')))) ->> 'id', true);
select set_config('t.p2', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Imp14 Other Co',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate')))) ->> 'id', true);
-- the draft batch, via the api, with its source file attached the way the confirm step does
select set_config('t.b', api.import_batch_start(current_setting('t.p')::uuid, 'invoice_export', 'made-up.csv') ->> 'id', true);
select set_config('t.f', api.file_begin('import_batch', current_setting('t.b')::uuid, 'import_file', 'attachment',
  'made-up.csv', 100, 'text/csv', 'restricted') ->> 'id', true);

-- before confirm: the batch reads back as a draft with five zero counts
select test.eq((select b -> 'counts' from jsonb_array_elements(api.import_batches(current_setting('t.p')::uuid)) b),
  '{"new": 0, "updated": 0, "unchanged": 0, "excluded": 0, "needs_linking": 0}'::jsonb,
  'a draft batch shows five zero counts, never an empty object');
select test.eq((select b ->> 'status' from jsonb_array_elements(api.import_batches(current_setting('t.p')::uuid)) b),
  'draft', 'and its status is draft');

-- three rows and one held row, in the UI's toApplyPayload shape: an invoice row, the transaction that completes
-- it, and a transaction with no invoice yet (the status lives on the invoice row — a fresh transaction row stores
-- none of its own)
select set_config('t.r', api.import_apply(current_setting('t.b')::uuid, jsonb_build_array(
  jsonb_build_object('row_no', 2, 'kind', 'invoice', 'transaction_ref', null, 'invoice_ref', '1163000014',
    'tax_no', '300000000001234', 'record_date', current_setting('t.d'), 'amount', 1000, 'wallet_topup', 0,
    'cost', null, 'status_text', 'Fully Paid', 'fully_paid', true, 'audit_required', false, 'provisional', false,
    'product', null, 'expense_gate', null, 'source_promo', null, 'promo_before', null, 'promo_discount', null,
    'promo_after', null, 'direct_url', null, 'direct_ref', null, 'duplicate', false),
  jsonb_build_object('row_no', 3, 'kind', 'transaction', 'transaction_ref', 'TX-IMP14-1', 'invoice_ref', '1163000014',
    'tax_no', null, 'record_date', current_setting('t.d'), 'amount', 1000, 'wallet_topup', 0,
    'cost', null, 'status_text', 'Fully Paid', 'fully_paid', true, 'audit_required', false, 'provisional', false,
    'product', 'Direct Hotels', 'expense_gate', null, 'source_promo', null, 'promo_before', null, 'promo_discount', null,
    'promo_after', null, 'direct_url', null, 'direct_ref', null, 'duplicate', false),
  jsonb_build_object('row_no', 4, 'kind', 'transaction', 'transaction_ref', 'TX-IMP14-2', 'invoice_ref', null,
    'tax_no', null, 'record_date', current_setting('t.d'), 'amount', 250, 'wallet_topup', 0,
    'cost', null, 'status_text', null, 'fully_paid', false, 'audit_required', false, 'provisional', false,
    'product', 'Direct Flights', 'expense_gate', null, 'source_promo', null, 'promo_before', null, 'promo_discount', null,
    'promo_after', null, 'direct_url', null, 'direct_ref', null, 'duplicate', false)),
  jsonb_build_array(jsonb_build_object('row_no', 5, 'reason', 'made-up held reason')))::text, true);
select test.eq(current_setting('t.r')::jsonb -> 'counts',
  '{"new": 0, "updated": 1, "unchanged": 0, "excluded": 1, "needs_linking": 2}'::jsonb,
  'one updated, one excluded, two needing linking');

-- the confirmed batch, re-read
select test.eq((select jsonb_build_object('file', b ->> 'file_name', 'signature', b ->> 'signature',
                'status', b ->> 'status', 'counts', b -> 'counts', 'problems', b -> 'problems',
                'by', b ->> 'created_by_name', 'source', b ->> 'source_file_name')
                from jsonb_array_elements(api.import_batches(current_setting('t.p')::uuid)) b),
  '{"file": "made-up.csv", "signature": "invoice_export", "status": "confirmed", "counts": {"new": 0, "updated": 1, "unchanged": 0, "excluded": 1, "needs_linking": 2}, "problems": [{"row_no": 5, "reason": "made-up held reason"}], "by": "Test Finance Head", "source": "made-up.csv"}'::jsonb,
  'the batch reads back with its file, counts, held row with its reason, who confirmed it and its source file');
select test.eq((select b ->> 'source_file_id' from jsonb_array_elements(api.import_batches(current_setting('t.p')::uuid)) b),
  current_setting('t.f'), 'the source file id is the attached file');

-- the rows it first wrote
select test.eq((select jsonb_object_agg(coalesce(transaction_ref, invoice_ref), jsonb_build_object('amount', amount_sar,
                'status', status_text, 'paid', fully_paid)) from jsonb_to_recordset(api.import_batch_rows(current_setting('t.b')::uuid))
                as x(transaction_ref text, invoice_ref text, amount_sar numeric, status_text text, fully_paid boolean)),
  '{"TX-IMP14-1": {"amount": 1000.00, "status": "Fully Paid", "paid": true}, "TX-IMP14-2": {"amount": 250.00, "status": null, "paid": false}}'::jsonb,
  'the batch rows read back with their refs, amounts and paid state');

-- newest first, and only this partner's batches
select set_config('t.b2', api.import_batch_start(current_setting('t.p')::uuid, 'invoice_export', 'made-up-two.csv') ->> 'id', true);
select test.eq((select jsonb_agg(b ->> 'file_name') from jsonb_array_elements(api.import_batches(current_setting('t.p')::uuid)) b),
  '["made-up-two.csv", "made-up.csv"]'::jsonb, 'newest batch first');
select test.eq(api.import_batches(current_setting('t.p2')::uuid), '[]'::jsonb, 'another partner sees none of them');

-- not found, not empty
select test.raises($$select api.import_batches('00000000-0000-0000-0000-000000000000'::uuid)$$,
  'P0002', 'a missing partner is not found');
select test.raises($$select api.import_batch_rows('00000000-0000-0000-0000-000000000000'::uuid)$$,
  'P0002', 'a missing batch is not found');

-- a member who views Finance reads them too (the gate is finance view, the same as the ledger). The member holds
-- View by an explicit override, now that the member default on Finance is none (FIX-03 F179)
select set_config('t.mem', test.person('Test Member', 'member')::text, true);
select test.as_owner();
insert into core.person_page_level (person_id, page_key, level, reason)
values (current_setting('t.mem')::uuid, 'finance', 'view', 'made up: View on Finance');
select test.as_person(current_setting('t.mem')::uuid);
select test.eq(jsonb_array_length(api.import_batches(current_setting('t.p')::uuid)), 2,
  'a member who views Finance reads the past batches');
