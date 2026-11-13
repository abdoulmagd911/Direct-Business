-- UNI-02 — Finance Overview totals equal the unified Ledger totals for the same period (L18, the two-totals fix).
-- A period with manual rows and imported rows present: the Overview (period_figures) and the unified Ledger
-- must answer the same revenue, cost and profit, because both now read the unified population (manual units
-- plus fully-paid imported rows). A provisional manual unit and a cost-pending imported row count their revenue
-- and sit apart as Provisional; only costed units enter cost and profit. Every value is made up.
select set_config('t.head', test.person('Test Finance Head', 'head')::text, true);
select set_config('t.d', (core.riyadh_today() - 5)::text, true);
select test.as_person(current_setting('t.head')::uuid);
-- two manual rows, via the invoice import that writes finance.invoice (the manual store)
select api.finance_import('invoices', jsonb_build_array(
  jsonb_build_object('ref', 'TX-UNI-2A', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 1000),
  jsonb_build_object('ref', 'TX-UNI-2B', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 500)),
  now() - interval '1 day');
-- an approved expense on the second manual row, so it is costed (the first stays provisional, cost 0)
select api.finance_import('expenses', jsonb_build_array(
  jsonb_build_object('ref', 'TX-UNI-2B', 'expense_type', 'Hotel', 'status', 'Approved', 'amount_sar', 200,
                     'created_at', '2026-01-01T10:00:00Z')),
  now() - interval '1 day');
-- two imported rows, via the new import engine's tables
select set_config('t.p', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Uni2 Co',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate')))) ->> 'id', true);
select set_config('t.b', gen_random_uuid()::text, true);
select test.act(current_setting('t.head')::uuid);
insert into work.import_batch (id, partner_id, signature, file_name, created_by)
values (current_setting('t.b')::uuid, current_setting('t.p')::uuid, 'invoice_export', 'made-up-2.csv', current_setting('t.head')::uuid);
insert into work.import_record (partner_id, batch_id, kind, transaction_ref, invoice_ref, record_date, amount_sar, revenue_sar, cost_sar, profit_sar, fully_paid, created_by)
values (current_setting('t.p')::uuid, current_setting('t.b')::uuid, 'transaction', '1163000011', '1163000011', current_setting('t.d')::date, 500, 500, 100, 400, true, current_setting('t.head')::uuid),
       (current_setting('t.p')::uuid, current_setting('t.b')::uuid, 'transaction', '1163000012', '1163000012', current_setting('t.d')::date, 700, 700, null, null, true, current_setting('t.head')::uuid);
select test.done();
-- the two reads, same period: revenue 2700 (1000 + 500 + 500 + 700), cost 300 (200 + 100), profit 700 (300 + 400);
-- the provisional manual row and the cost-pending imported row sit apart as Provisional (2 units, revenue 1700)
select test.as_person(current_setting('t.head')::uuid);
select set_config('t.ov', api.finance_period('2026-01-01'::date, '2026-12-31'::date)::text, true);
select set_config('t.ul', api.finance_unified_ledger('2026-01-01'::date, '2026-12-31'::date)::text, true);
select test.eq((current_setting('t.ov')::jsonb ->> 'units')::int, 4, 'the Overview counts four units, manual and imported');
select test.eq((current_setting('t.ov')::jsonb ->> 'revenue')::numeric, 2700.00, 'the Overview revenue counts the imported rows');
select test.eq((current_setting('t.ov')::jsonb ->> 'cost')::numeric, 300.00, 'the Overview cost counts only the costed units');
select test.eq((current_setting('t.ov')::jsonb ->> 'profit')::numeric, 700.00, 'the Overview profit counts only the costed units');
select test.eq((current_setting('t.ov')::jsonb -> 'provisional' ->> 'units')::int, 2, 'two Provisional units, manual and imported');
select test.eq((current_setting('t.ov')::jsonb -> 'provisional' ->> 'revenue')::numeric, 1700.00, 'the Provisional revenue sits apart');
select test.eq((current_setting('t.ul')::jsonb -> 'totals' ->> 'units')::int, 4, 'the Ledger counts four units');
select test.eq((current_setting('t.ul')::jsonb -> 'totals' ->> 'revenue')::numeric, 2700.00, 'the Ledger revenue is 2700');
select test.eq((current_setting('t.ul')::jsonb -> 'totals' ->> 'cost')::numeric, 300.00, 'the Ledger cost is 300');
select test.eq((current_setting('t.ul')::jsonb -> 'totals' ->> 'profit')::numeric, 700.00, 'the Ledger profit is 700');
select test.eq((current_setting('t.ul')::jsonb -> 'totals' ->> 'without_cost')::int, 2, 'two rows without cost in the Ledger');
-- the two totals agree, figure for figure
select test.eq((current_setting('t.ov')::jsonb ->> 'revenue')::numeric = (current_setting('t.ul')::jsonb -> 'totals' ->> 'revenue')::numeric
                and (current_setting('t.ov')::jsonb ->> 'cost')::numeric = (current_setting('t.ul')::jsonb -> 'totals' ->> 'cost')::numeric
                and (current_setting('t.ov')::jsonb ->> 'profit')::numeric = (current_setting('t.ul')::jsonb -> 'totals' ->> 'profit')::numeric
                and (current_setting('t.ov')::jsonb ->> 'units')::int = (current_setting('t.ul')::jsonb -> 'totals' ->> 'units')::int,
  true, 'the Overview totals equal the unified Ledger totals for the same period');
-- the months agree with the tiles, and By service agrees with the Overview revenue
select test.eq((select (m ->> 'revenue')::numeric = (current_setting('t.ov')::jsonb ->> 'revenue')::numeric
                and (m ->> 'cost')::numeric = (current_setting('t.ov')::jsonb ->> 'cost')::numeric
                and (m ->> 'profit')::numeric = (current_setting('t.ov')::jsonb ->> 'profit')::numeric
                from pg_catalog.jsonb_array_elements(current_setting('t.ov')::jsonb -> 'months') m
                where (m ->> 'month_on')::date = pg_catalog.date_trunc('month', current_setting('t.d')::date)::date),
  true, 'the period''s own month agrees with its tiles');
select test.eq((select (api.finance_income_by_service('2026-01-01'::date, '2026-12-31'::date) ->> 'revenue')::numeric),
  2700.00, 'By service revenue is 2700, the same as the Overview');
select test.eq((select (api.finance_income_by_service('2026-01-01'::date, '2026-12-31'::date) ->> 'gap')::numeric),
  0.00, 'By service has no gap against its tile');
