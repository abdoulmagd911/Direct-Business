-- CRD-01 — an organisation's credit and wallet (§3.6 partner_credit, partner_wallet; V70, V416, V617). The credit limit
-- in force is the newest whose day has come, with its approver; what is owed against it is the receivables, so a receipt
-- frees it again; over the limit is said. The wallet check is paid top-ups less the wallet part of paid invoices, kept
-- as a check only. An organisation without a limit has none. Every value is made up.
-- Sabotage: supabase/tests/sabotage/credit-takes-a-limit-not-yet-in-force.sql.
select set_config('t.head', test.person('Test Finance Head', 'head')::text, true);
select set_config('t.t', core.riyadh_today()::text, true);

select test.as_person(current_setting('t.head')::uuid);
select set_config('t.p', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Credit Line Co',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate')))) ->> 'id', true);
select set_config('t.q', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up No Limit Co',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate')))) ->> 'id', true);
select api.identifier_add(current_setting('t.p')::uuid, 'payments_client_id', '84001', 'made up', 'postpaid');
select api.credit_limit_set(current_setting('t.p')::uuid, 1000, current_setting('t.t')::date - 30,
                            current_setting('t.head')::uuid, 'made up: agreed limit');
select api.credit_limit_set(current_setting('t.p')::uuid, 5000, current_setting('t.t')::date + 10,
                            current_setting('t.head')::uuid, 'made up: a raise from next week');
select api.finance_import('invoices', jsonb_build_array(
  jsonb_build_object('ref', 'SA-8401', 'status', 'Published', 'created_on', (current_setting('t.t')::date - 20)::text,
                     'total_sar', 700, 'client_id', '84001'),
  jsonb_build_object('ref', 'SA-8402', 'status', 'Published', 'created_on', (current_setting('t.t')::date - 10)::text,
                     'total_sar', 500, 'client_id', '84001'),
  jsonb_build_object('ref', 'WT-8403', 'status', 'Fully Paid', 'created_on', (current_setting('t.t')::date - 10)::text,
                     'total_sar', 400, 'client_id', '84001', 'lines', jsonb_build_array(
                       jsonb_build_object('line_no', 1, 'product', 'Wallet Top-up', 'name', 'Wallet', 'total_sar', 400))),
  jsonb_build_object('ref', 'SA-8404', 'status', 'Fully Paid', 'created_on', (current_setting('t.t')::date - 5)::text,
                     'total_sar', 250, 'client_id', '84001', 'lines', jsonb_build_array(
                       jsonb_build_object('line_no', 1, 'product', 'Wallet Top-up', 'name', 'Wallet', 'total_sar', 150),
                       jsonb_build_object('line_no', 2, 'product', 'Direct Visas', 'name', 'Visa', 'total_sar', 100)))),
  now() - interval '1 day');

select test.eq(api.finance_partner_credit(current_setting('t.p')::uuid) - 'approved_by',
  jsonb_build_object('credit_limit', 1000, 'effective_from', current_setting('t.t')::date - 30, 'outstanding', 1200,
                     'available', -200, 'over_limit', true),
  'the limit in force today, not next week''s; what is owed against it; over the limit is said');
select test.eq((api.finance_partner_credit(current_setting('t.p')::uuid) ->> 'approved_by')::uuid,
  current_setting('t.head')::uuid, 'with who approved it');
select api.finance_import('receipts', jsonb_build_array(
  jsonb_build_object('ref', 'SA-8402', 'method', 'Bank transfer', 'amount_sar', 300,
                     'paid_on', (current_setting('t.t')::date - 1)::text)), now() - interval '1 hour');
select test.eq(api.finance_partner_credit(current_setting('t.p')::uuid) - 'approved_by' - 'effective_from' - 'credit_limit',
  '{"outstanding": 900, "available": 100, "over_limit": false}'::jsonb, 'a receipt frees the credit again');
select test.eq(api.finance_partner_credit(current_setting('t.q')::uuid), null::jsonb, 'no limit, no credit line');

select test.as_owner();
select test.eq((select jsonb_build_object('topped_up', topped_up, 'consumed', consumed, 'balance_check', balance_check)
                from finance.partner_wallet where partner_id = current_setting('t.p')::uuid),
  '{"topped_up": 400, "consumed": 150, "balance_check": 250}'::jsonb,
  'the wallet check: paid top-ups less the wallet part of paid invoices');
