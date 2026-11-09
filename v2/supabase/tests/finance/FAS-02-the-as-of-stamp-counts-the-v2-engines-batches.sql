-- FAS-02 — the "Payments · as of" stamp counts the v2 engine's batches (F173): a confirmed v2 import moves the
-- stamp to its confirm day, and a draft batch — which has read nothing into the figures — does not. The old
-- store's per-file days are unchanged (FAS-01). Every value is made up.
select set_config('t.head', test.person('Test Finance Head', 'head')::text, true);
select set_config('t.d', (core.riyadh_today() - 5)::text, true);
select test.as_person(current_setting('t.head')::uuid);

select test.eq(api.finance_payments_as_of(), '{"as_of": null, "files": {}}'::jsonb,
  'no file read yet: no day, never today');

-- the company and a confirmed v2 import, via the api
select set_config('t.p', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Fas02 Co',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate')))) ->> 'id', true);
select set_config('t.b', api.import_batch_start(current_setting('t.p')::uuid, 'invoice_export', 'made-up.csv') ->> 'id', true);
select api.import_apply(current_setting('t.b')::uuid, jsonb_build_array(
  jsonb_build_object('row_no', 2, 'kind', 'transaction', 'transaction_ref', 'TX-FAS02-1', 'invoice_ref', '1163000015',
    'tax_no', null, 'record_date', current_setting('t.d'), 'amount', 1000, 'wallet_topup', 0,
    'cost', null, 'status_text', 'Fully Paid', 'fully_paid', true, 'audit_required', false, 'provisional', false,
    'product', 'Direct Hotels', 'expense_gate', null, 'source_promo', null, 'promo_before', null, 'promo_discount', null,
    'promo_after', null, 'direct_url', null, 'direct_ref', null, 'duplicate', false)));
select test.eq(api.finance_payments_as_of() ->> 'as_of', core.riyadh_today()::text,
  'a confirmed v2 import moves the stamp to its confirm day');
select test.eq(api.finance_payments_as_of() -> 'files' ->> 'invoice_export', core.riyadh_today()::text,
  'under its signature');

-- a second batch, started but never confirmed, must not move the stamp
select api.import_batch_start(current_setting('t.p')::uuid, 'transaction_expense_export', 'made-up-expenses.csv');
select test.eq(api.finance_payments_as_of() ->> 'as_of', core.riyadh_today()::text,
  'a draft batch reads nothing in, so the stamp does not move');
select test.eq(api.finance_payments_as_of() -> 'files' ->> 'transaction_expense_export', null,
  'and it has no file day of its own');
