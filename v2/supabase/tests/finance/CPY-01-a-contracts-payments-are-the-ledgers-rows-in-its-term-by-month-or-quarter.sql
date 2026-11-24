-- CPY-01 — Landing 47, A13: a contract paid in several payments. For one contract the read answers the Ledger's own
-- rows of its organisation, dated inside the contract's term, grouped by month or by quarter: each period's total
-- and, under it, each invoice. It regroups the Ledger — the periods add up to the Ledger's revenue for the same
-- organisation and term, difference 0 — and a document not yet counted is shown under its period, in no total.
-- Rows before the term, after it, or of another organisation are not in it. Every value is made up.
-- Sabotage: supabase/tests/sabotage/a-contract-counts-a-pending-invoice.sql,
--   a-contract-counts-rows-outside-its-term.sql, a-contracts-quarters-are-months.sql.
select set_config('t.head', test.person('Test Finance Head', 'head')::text, true);
select set_config('t.today', core.riyadh_today()::text, true);
-- a fixed term inside this year, so the months are known: 1 Mar – 30 Jun 2026
select test.as_person(current_setting('t.head')::uuid);
select set_config('t.p', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Contract Org',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate')))) ->> 'id', true);
select set_config('t.q', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Other Org',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate')))) ->> 'id', true);
select api.identifier_add(current_setting('t.p')::uuid, 'payments_client_id', '990701', 'made up', 'postpaid');
select api.identifier_add(current_setting('t.q')::uuid, 'payments_client_id', '990702', 'made up', 'postpaid');
select set_config('t.k', api.contract_save(current_setting('t.p')::uuid, null, jsonb_build_object('side', 'client',
  'title', 'Made-up yearly travel contract', 'start_on', '2026-03-01', 'end_on', '2026-06-30')) ->> 'id', true);
select api.finance_import('invoices', jsonb_build_array(
  jsonb_build_object('ref', 'CPY-BEFORE', 'client_id', '990701', 'status', 'Fully Paid', 'created_on', '2026-02-27', 'total_sar', 999),
  jsonb_build_object('ref', 'CPY-MAR-1', 'client_id', '990701', 'status', 'Fully Paid', 'created_on', '2026-03-05', 'total_sar', 300),
  jsonb_build_object('ref', 'CPY-MAY-1', 'client_id', '990701', 'status', 'Fully Paid', 'created_on', '2026-05-10', 'total_sar', 100),
  jsonb_build_object('ref', 'CPY-MAY-P', 'client_id', '990701', 'status', 'Pending', 'created_on', '2026-05-20', 'total_sar', 60),
  jsonb_build_object('ref', 'CPY-AFTER', 'client_id', '990701', 'status', 'Fully Paid', 'created_on', '2026-07-01', 'total_sar', 888),
  jsonb_build_object('ref', 'CPY-OTHER', 'client_id', '990702', 'status', 'Fully Paid', 'created_on', '2026-03-06', 'total_sar', 777)),
  now() - interval '1 day');
select test.act(current_setting('t.head')::uuid);
insert into work.import_batch (id, partner_id, signature, file_name, created_by)
values ('00000000-0000-4000-8000-0000000c9701', current_setting('t.p')::uuid, 'invoice_export', 'made-up-cpy.csv', current_setting('t.head')::uuid);
insert into work.import_record (partner_id, batch_id, kind, transaction_ref, invoice_ref, record_date, amount_sar, revenue_sar, fully_paid, status_text, created_by)
values (current_setting('t.p')::uuid, '00000000-0000-4000-8000-0000000c9701', 'transaction', 'CPY-MAR-2', 'CPY-INV-2', '2026-03-20', 200, 200, true, 'Fully Paid', current_setting('t.head')::uuid),
       (current_setting('t.p')::uuid, '00000000-0000-4000-8000-0000000c9701', 'transaction', 'CPY-JUN-1', 'CPY-INV-3', '2026-06-30', 400, 400, true, 'Fully Paid', current_setting('t.head')::uuid);
select test.done();

create function pg_temp.pay(p_grain text default 'month') returns jsonb language sql as
$$ select api.finance_contract_payments(current_setting('t.k')::uuid, p_grain) $$;
create function pg_temp.period(p_start date, p_grain text default 'month') returns jsonb language sql as
$$ select x from pg_catalog.jsonb_array_elements(pg_temp.pay(p_grain) -> 'periods') x where (x ->> 'period_start')::date = p_start $$;
grant execute on function pg_temp.pay(text), pg_temp.period(date, text) to public;

select test.as_person(current_setting('t.head')::uuid);
-- by month: March 500 (two invoices), May 100 with 60 not yet counted, June 400; April has no payment and no line
select test.eq(jsonb_array_length(pg_temp.pay() -> 'periods'), 3, 'three months carry a payment');
select test.eq((pg_temp.period('2026-03-01') ->> 'total')::numeric, 500.00, 'March: 300 recorded here + 200 imported');
select test.eq((select array_agg(v ->> 'number' order by v ->> 'number') from jsonb_array_elements(pg_temp.period('2026-03-01') -> 'invoices') v),
  array['CPY-MAR-1', 'CPY-MAR-2'], 'with each invoice under it');
select test.eq((pg_temp.period('2026-05-01') ->> 'total')::numeric, 100.00, 'May counts only what is paid');
select test.eq((pg_temp.period('2026-05-01') ->> 'not_yet_counted')::numeric, 60.00, 'and shows what is not yet counted beside it');
select test.eq((select (v ->> 'counted')::boolean from jsonb_array_elements(pg_temp.period('2026-05-01') -> 'invoices') v where v ->> 'number' = 'CPY-MAY-P'),
  false, 'the pending invoice is listed under its month, marked not counted');
select test.eq((pg_temp.period('2026-06-01') ->> 'total')::numeric, 400.00, 'June: the invoice of the term''s last day is in');
select test.eq(pg_temp.period('2026-04-01'), null::jsonb, 'a month with no payment has no line');
-- nothing outside the term or of another organisation
select test.eq((select count(*)::int from jsonb_array_elements(pg_temp.pay() -> 'periods') x, jsonb_array_elements(x -> 'invoices') v
                where v ->> 'number' in ('CPY-BEFORE', 'CPY-AFTER', 'CPY-OTHER')), 0,
  'nothing dated outside the term, nothing of another organisation');
-- it is the Ledger, regrouped: difference 0
select test.eq((pg_temp.pay() ->> 'total')::numeric, 1000.00, 'the contract''s total: 500 + 100 + 400');
select test.eq((pg_temp.pay() ->> 'total')::numeric,
  (api.finance_unified_ledger('2026-03-01'::date, '2026-06-30'::date, current_setting('t.p')::uuid) -> 'totals' ->> 'revenue')::numeric,
  'the periods add up to the Ledger''s revenue for the same organisation and term: difference 0');
select test.eq((pg_temp.pay() ->> 'not_yet_counted')::numeric, 60.00, 'with 60 not yet counted, apart');
-- by quarter: Q1 (March) 500, Q2 (May + June) 500
select test.eq(jsonb_array_length(pg_temp.pay('quarter') -> 'periods'), 2, 'by quarter: two quarters');
select test.eq((pg_temp.period('2026-01-01', 'quarter') ->> 'total')::numeric, 500.00, 'the first quarter: 500');
select test.eq((pg_temp.period('2026-04-01', 'quarter') ->> 'total')::numeric, 500.00, 'the second quarter: 100 + 400');
select test.eq(jsonb_array_length(pg_temp.period('2026-04-01', 'quarter') -> 'invoices'), 3, 'with its three invoices under it');
select test.eq((pg_temp.pay('quarter') ->> 'total')::numeric, (pg_temp.pay('month') ->> 'total')::numeric, 'the two groupings add up the same');
-- refused: another grain; a contract that is not there
select test.raises(format('select api.finance_contract_payments(%L, %L)', current_setting('t.k'), 'week'), 'P0001', 'only month or quarter');
select test.raises(format('select api.finance_contract_payments(%L, %L)', gen_random_uuid(), 'month'), 'P0002', 'an unknown contract is not found');
