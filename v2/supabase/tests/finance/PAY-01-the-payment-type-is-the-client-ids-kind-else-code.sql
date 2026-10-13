-- PAY-01 — the payment type on every unit (V87; P4-2 PAY-*): the kind of the Payments client ID the row carries —
-- prepaid, postpaid or tender — else "code" when only a discount code is on it, else none. Every value is made up.
-- Sabotage: supabase/tests/sabotage/a-code-row-has-no-payment-type.sql.
select set_config('t.head', test.person('Test Finance Head', 'head')::text, true);
select set_config('t.d', (core.riyadh_today() - 15)::text, true);

select test.as_person(current_setting('t.head')::uuid);
select set_config('t.p', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Paying Co',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate')))) ->> 'id', true);
select api.identifier_add(current_setting('t.p')::uuid, 'payments_client_id', '84001', 'made up', 'prepaid');
select api.identifier_add(current_setting('t.p')::uuid, 'payments_client_id', '84002', 'made up', 'postpaid');
select api.identifier_add(current_setting('t.p')::uuid, 'payments_client_id', '84003', 'made up', 'tender');
select api.finance_import('invoices', jsonb_build_array(
  jsonb_build_object('ref', 'TX-P1', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 10, 'client_id', '84001'),
  jsonb_build_object('ref', 'TX-P2', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 20, 'client_id', '84002'),
  jsonb_build_object('ref', 'TX-P3', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 30, 'client_id', '84003'),
  jsonb_build_object('ref', 'TX-P4', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 40,
                     'discount_code', 'MADEUP10'),
  jsonb_build_object('ref', 'TX-P5', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 50,
                     'customer_name', 'Made Up Walk-in')),
  now() - interval '1 day');
select test.as_owner();
select test.eq((select jsonb_object_agg(r.ref, coalesce(r.payment_type, 'none')) from finance.money_row r where r.ref like 'TX-P%'),
  '{"TX-P1": "prepaid", "TX-P2": "postpaid", "TX-P3": "tender", "TX-P4": "code", "TX-P5": "none"}'::jsonb,
  'the payment type is the client ID''s kind, else code, else none');
