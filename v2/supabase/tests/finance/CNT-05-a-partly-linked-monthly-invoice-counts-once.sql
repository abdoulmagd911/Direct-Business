-- CNT-05 — a partly linked monthly invoice counts once (QA-528; V616). BL-31 bills 1,500; TX-31 (1,000) names it,
-- TX-32 (500, the same customer) does not. The import proposes TX-32 for the 500 the links lack, and while the proposal
-- waits the excess is not a fee: the month counts 1,500 for 1,500 billed. Ticked, TX-32 is linked and the month still
-- counts 1,500. Every value is made up.
-- Sabotage: supabase/tests/sabotage/a-partly-linked-monthly-invoice-counts-twice.sql.
select set_config('t.head', test.person('Test Finance Head', 'head')::text, true);
select set_config('t.d', (core.riyadh_today() - 10)::text, true);
select set_config('t.m', date_trunc('month', current_setting('t.d')::date)::date::text, true);

select test.as_person(current_setting('t.head')::uuid);
select api.finance_import('invoices', jsonb_build_array(
  jsonb_build_object('ref', 'BL-31', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 1500,
                     'is_consolidated', 'true', 'client_id', '86031'),
  jsonb_build_object('ref', 'TX-31', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 1000,
                     'consolidated_ref', 'BL-31', 'client_id', '86031'),
  jsonb_build_object('ref', 'TX-32', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 500,
                     'client_id', '86031')), now() - interval '1 day');
select test.eq((api.finance_period(current_setting('t.m')::date, current_setting('t.d')::date) ->> 'revenue')::numeric,
  1500::numeric, 'the month counts 1,500 for 1,500 billed while the proposal waits');
select test.as_owner();
select test.eq((select jsonb_build_object('amount', p.amount_sar,
                                          'refs', (select jsonb_agg(i.ref) from finance.invoice i where i.id = any (p.transaction_ids)))
                from finance.billing_proposal p join finance.invoice b on b.id = p.billing_invoice_id
                where b.ref = 'BL-31' and p.state = 'open'),
  '{"amount": 500, "refs": ["TX-32"]}'::jsonb, 'the import proposes TX-32 for the 500 the links lack');
select set_config('t.p', (select p.id::text from finance.billing_proposal p join finance.invoice b on b.id = p.billing_invoice_id
                          where b.ref = 'BL-31' and p.state = 'open'), true);
select test.as_person(current_setting('t.head')::uuid);
select api.finance_proposal_decide(current_setting('t.p')::uuid, true, 'made up: the statement lists it');
select test.eq((api.finance_period(current_setting('t.m')::date, current_setting('t.d')::date) ->> 'revenue')::numeric,
  1500::numeric, 'ticked, TX-32 is linked and the month still counts 1,500');
