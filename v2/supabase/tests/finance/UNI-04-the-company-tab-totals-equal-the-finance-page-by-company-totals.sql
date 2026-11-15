-- UNI-04 — the company Finance tab's totals equal the Finance page's by-company totals for the same company and
-- period (Landing 25, F-A/A1). The tab reads finance.unified_ledger filtered to the one company; the Finance page
-- reads the same function unfiltered and takes the by-company row. Both must answer the same figures, figure for
-- figure, so the difference is 0 — and hiding the imported rows must hide them from the list AND the total
-- together, so the manual-only sums (the rows with source 'manual') are the manual figures alone. Every value is
-- made up.
select set_config('t.head', test.person('Test Finance Head', 'head')::text, true);
select set_config('t.am', test.person('Test Account Manager', 'member')::text, true);
select set_config('t.d', (core.riyadh_today() - 5)::text, true);
select test.as_person(current_setting('t.head')::uuid);
select set_config('t.p', api.partner_create(jsonb_build_object('trade_name_en', 'Made Up Uni4 Co',
  'sides', jsonb_build_array(jsonb_build_object('side', 'client', 'type', 'corporate',
                                                'owner_id', current_setting('t.am'))))) ->> 'id', true);
select api.identifier_add(current_setting('t.p')::uuid, 'payments_client_id', '88004', 'made up', 'postpaid');
-- two manual rows: one costed (1000 with an approved cost of 200), one provisional (500, no expense)
select api.finance_import('invoices', jsonb_build_array(
  jsonb_build_object('ref', 'TX-U4-M1', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 1000,
                     'client_id', '88004', 'dpin', 'DPIN-U4-M1', 'dpin_total', 800),
  jsonb_build_object('ref', 'TX-U4-M2', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'total_sar', 500,
                     'client_id', '88004')),
  now() - interval '1 day');
select api.finance_import('expenses', jsonb_build_array(
  jsonb_build_object('ref', 'TX-U4-M1', 'expense_type', 'Hotel', 'status', 'Approved', 'amount_sar', 200,
                     'created_at', '2026-01-01T10:00:00Z')),
  now() - interval '1 day');
-- two imported rows: one costed (500, cost 100, profit 400), one cost-pending (700, no cost, no profit)
select set_config('t.b', gen_random_uuid()::text, true);
select test.act(current_setting('t.head')::uuid);
insert into work.import_batch (id, partner_id, signature, file_name, created_by)
values (current_setting('t.b')::uuid, current_setting('t.p')::uuid, 'invoice_export', 'made-up-4.csv', current_setting('t.head')::uuid);
insert into work.import_record (partner_id, batch_id, kind, transaction_ref, invoice_ref, record_date, amount_sar, revenue_sar, cost_sar, profit_sar, fully_paid, created_by)
values (current_setting('t.p')::uuid, current_setting('t.b')::uuid, 'transaction', '1163000041', '1163000041', current_setting('t.d')::date, 500, 500, 100, 400, true, current_setting('t.head')::uuid),
       (current_setting('t.p')::uuid, current_setting('t.b')::uuid, 'transaction', '1163000042', '1163000042', current_setting('t.d')::date, 700, 700, null, null, true, current_setting('t.head')::uuid);
select test.done();
-- the tab's read (filtered to the company) and the Finance page's read (unfiltered, by-company row for it)
select test.as_person(current_setting('t.head')::uuid);
select set_config('t.tab', api.finance_unified_ledger('2026-01-01'::date, '2026-12-31'::date, current_setting('t.p')::uuid)::text, true);
select set_config('t.page', api.finance_unified_ledger('2026-01-01'::date, '2026-12-31'::date)::text, true);
select set_config('t.by', (select x::text from pg_catalog.jsonb_array_elements(current_setting('t.page')::jsonb -> 'by_company') x
                           where (x ->> 'partner_id')::uuid = current_setting('t.p')::uuid), true);
-- the tab's totals: 4 units, revenue 2700 (1000 + 500 + 500 + 700), cost 300 (200 + 100), profit 1200 (800 + 400);
-- the provisional manual row and the cost-pending import sit apart (without_cost 2)
select test.eq((current_setting('t.tab')::jsonb -> 'totals' ->> 'units')::int, 4,
  'the tab counts four units, manual and imported');
select test.eq((current_setting('t.tab')::jsonb -> 'totals' ->> 'revenue')::numeric, 2700.00,
  'the tab revenue is 2700');
select test.eq((current_setting('t.tab')::jsonb -> 'totals' ->> 'cost')::numeric, 300.00,
  'the tab cost is 300 — only the costed units');
select test.eq((current_setting('t.tab')::jsonb -> 'totals' ->> 'profit')::numeric, 1200.00,
  'the tab profit is 1200 — only the costed units');
select test.eq((current_setting('t.tab')::jsonb -> 'totals' ->> 'without_cost')::int, 2,
  'two rows without cost on the tab');
select test.eq((current_setting('t.tab')::jsonb -> 'totals' ->> 'manual_units')::int, 2,
  'two manual units on the tab');
select test.eq((current_setting('t.tab')::jsonb -> 'totals' ->> 'import_units')::int, 2,
  'two imported units on the tab');
-- the Finance page's by-company row for the same company answers the same figures — difference 0
select test.eq((current_setting('t.by')::jsonb ->> 'units')::int, 4,
  'the Finance page counts four units for this company');
select test.eq((current_setting('t.by')::jsonb ->> 'revenue')::numeric, 2700.00,
  'the Finance page revenue for this company is 2700');
select test.eq((current_setting('t.by')::jsonb ->> 'cost')::numeric, 300.00,
  'the Finance page cost for this company is 300');
select test.eq((current_setting('t.by')::jsonb ->> 'profit')::numeric, 1200.00,
  'the Finance page profit for this company is 1200');
select test.eq((current_setting('t.by')::jsonb ->> 'without_cost')::int, 2,
  'the Finance page counts two rows without cost for this company');
select test.eq((current_setting('t.tab')::jsonb -> 'totals' ->> 'revenue')::numeric
                = (current_setting('t.by')::jsonb ->> 'revenue')::numeric
                and (current_setting('t.tab')::jsonb -> 'totals' ->> 'cost')::numeric
                = (current_setting('t.by')::jsonb ->> 'cost')::numeric
                and (current_setting('t.tab')::jsonb -> 'totals' ->> 'profit')::numeric
                = (current_setting('t.by')::jsonb ->> 'profit')::numeric
                and (current_setting('t.tab')::jsonb -> 'totals' ->> 'units')::int
                = (current_setting('t.by')::jsonb ->> 'units')::int
                and (current_setting('t.tab')::jsonb -> 'totals' ->> 'without_cost')::int
                = (current_setting('t.by')::jsonb ->> 'without_cost')::int,
  true, 'the tab totals equal the Finance page by-company totals — difference 0');
-- hiding the imported rows hides them from the list AND the total together: the manual-only rows sum to the
-- manual figures alone (2 units, 1500 revenue, 200 cost, 800 profit)
select test.eq((select pg_catalog.count(*)::int from pg_catalog.jsonb_array_elements(current_setting('t.tab')::jsonb -> 'rows') r
                where r ->> 'source' = 'manual'), 2, 'two manual rows in the tab list');
select test.eq((select pg_catalog.count(*)::int from pg_catalog.jsonb_array_elements(current_setting('t.tab')::jsonb -> 'rows') r
                where r ->> 'source' = 'import'), 2, 'two imported rows in the tab list');
select test.eq((select coalesce(pg_catalog.sum((r ->> 'revenue')::numeric), 0::numeric)
                from pg_catalog.jsonb_array_elements(current_setting('t.tab')::jsonb -> 'rows') r
                where r ->> 'source' = 'manual'), 1500.00, 'the manual rows alone sum to 1500 revenue');
select test.eq((select coalesce(pg_catalog.sum((r ->> 'cost')::numeric) filter (where r ->> 'cost' is not null), 0::numeric)
                from pg_catalog.jsonb_array_elements(current_setting('t.tab')::jsonb -> 'rows') r
                where r ->> 'source' = 'manual'), 200.00, 'the manual rows alone sum to 200 cost');
select test.eq((select coalesce(pg_catalog.sum((r ->> 'profit')::numeric) filter (where r ->> 'profit' is not null), 0::numeric)
                from pg_catalog.jsonb_array_elements(current_setting('t.tab')::jsonb -> 'rows') r
                where r ->> 'source' = 'manual'), 800.00, 'the manual rows alone sum to 800 profit');
