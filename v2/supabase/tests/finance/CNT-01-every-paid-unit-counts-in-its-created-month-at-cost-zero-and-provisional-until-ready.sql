-- CNT-01 — what counts (V610, V611, V615, D16): a unit counts in the month of its created date once fully paid; every
-- paid unit counts, its cost the approved (or issued) expenses — 0 and Provisional while none, pending ones never
-- counted, Ready when its expenses are done or every product carries no supplier cost; the Provisional units' revenue and
-- profit are shown beside the month's, never left out; revenue is the total less its wallet part; an exclusion rule
-- wins and applies to past rows at once. The fake file's month totals match the hand count written here. Every value is
-- made up. Sabotages: supabase/tests/sabotage/a-unit-with-no-approved-expense-is-left-out.sql,
-- a-pending-expense-counts-as-cost.sql, a-unit-counts-in-its-paid-month.sql.
select set_config('t.head', test.person('Test Finance Head', 'head')::text, true);
select set_config('t.m', (date_trunc('month', core.riyadh_today()::timestamp) - interval '2 months')::date::text, true);
select set_config('t.d1', (current_setting('t.m')::date + 4)::text, true);
select set_config('t.d2', (current_setting('t.m')::date + 14)::text, true);
select set_config('t.d3', (current_setting('t.m')::date + interval '1 month' + interval '2 days')::date::text, true);
select test.as_owner();
update finance.product set no_supplier_cost = true where key = 'insurance';   -- made up: Q48 is the owner's

select test.as_person(current_setting('t.head')::uuid);
select api.finance_import('invoices', jsonb_build_array(
  jsonb_build_object('ref', 'TX-1', 'status', 'Fully Paid', 'created_on', current_setting('t.d1'), 'paid_on', current_setting('t.d3'),
                     'total_sar', 1000),
  jsonb_build_object('ref', 'TX-2', 'status', 'Fully Paid', 'created_on', current_setting('t.d1'), 'total_sar', 500),
  jsonb_build_object('ref', 'TX-3', 'status', 'Fully Paid', 'created_on', current_setting('t.d2'), 'total_sar', 800),
  jsonb_build_object('ref', 'SA-4', 'status', 'Published', 'created_on', current_setting('t.d2'), 'total_sar', 999),
  jsonb_build_object('ref', 'SA-5', 'status', 'Fully Paid', 'created_on', current_setting('t.d3'), 'total_sar', 200,
                     'lines', jsonb_build_array(jsonb_build_object('line_no', 1, 'product', 'Direct Insurance', 'name', 'Cover',
                                                                   'total_sar', 200))),
  jsonb_build_object('ref', 'TX-6', 'status', 'Fully Paid', 'created_on', current_setting('t.d1'), 'total_sar', 300,
                     'lines', jsonb_build_array(
                       jsonb_build_object('line_no', 1, 'product', 'Direct Hotels', 'name', 'Hotel night', 'total_sar', 200),
                       jsonb_build_object('line_no', 2, 'product', 'Wallet Top-up', 'name', 'Wallet top-up', 'total_sar', 100))),
  jsonb_build_object('ref', 'TX-7', 'status', 'Fully Paid', 'created_on', current_setting('t.d1'), 'total_sar', 4000,
                     'client_id', '77777')), now() - interval '1 day');
select api.finance_import('expenses', jsonb_build_array(
  jsonb_build_object('ref', 'TX-1', 'expense_type', 'Hotel', 'status', 'Approved', 'amount_sar', 600, 'created_at', '2026-01-01T10:00:00Z'),
  jsonb_build_object('ref', 'TX-3', 'expense_type', 'Hotel', 'status', 'Approved', 'amount_sar', 300, 'created_at', '2026-01-01T10:00:00Z'),
  jsonb_build_object('ref', 'TX-3', 'expense_type', 'Visa', 'status', 'Pending', 'amount_sar', 100,
                     'created_at', '2026-01-01T11:00:00Z'),
  jsonb_build_object('ref', 'TX-6', 'expense_type', 'Hotel', 'status', '', 'amount_sar', 50, 'created_at', '2026-01-01T10:00:00Z')),
  now() - interval '1 day');

-- an exclusion rule typed after the fact applies to the past row at once
select test.act(current_setting('t.head')::uuid);
insert into finance.exclusion_rule (kind, value_raw, mode, reason, created_by)
values ('client_id', '77777', 'exclude', 'made up: a test client', current_setting('t.head')::uuid);
select test.done();

select test.as_owner();
select test.eq((select jsonb_object_agg(ref, jsonb_build_object('counted', counted, 'revenue', revenue, 'cost', cost,
                                                                'status', cost_status, 'profit', profit) order by ref)
                from finance.money_row),
  ('{"TX-1": {"counted": true, "revenue": 1000.00, "cost": 600.00, "status": "ready", "profit": 400.00},
     "TX-2": {"counted": true, "revenue": 500.00, "cost": 0, "status": "provisional", "profit": 500.00},
     "TX-3": {"counted": true, "revenue": 800.00, "cost": 300.00, "status": "provisional", "profit": 500.00},
     "SA-4": {"counted": false, "revenue": 999.00, "cost": 0, "status": "provisional", "profit": 999.00},
     "SA-5": {"counted": true, "revenue": 200.00, "cost": 0, "status": "ready", "profit": 200.00},
     "TX-6": {"counted": true, "revenue": 200.00, "cost": 50.00, "status": "ready", "profit": 150.00},
     "TX-7": {"counted": false, "revenue": 4000.00, "cost": 0, "status": "provisional", "profit": 4000.00}}')::jsonb,
  'every paid unit counts: cost 0 and Provisional with no approved expense, the pending one left out, Ready when done or no supplier cost; the wallet part is not revenue; a published unit and an excluded one do not count');
select test.eq((select excluded_reason from finance.money_row where ref = 'TX-7'), 'made up: a test client', 'the excluded unit says why');
select test.eq((select month_on from finance.money_row where ref = 'TX-1'), current_setting('t.m')::date,
  'paid the next month, it counts in its created month (V610)');

-- the hand count of the fake file, by month
select test.eq((select to_jsonb(x) - 'month_on' from finance.money_month x where x.month_on = current_setting('t.m')::date),
  '{"units": 4, "revenue": 2500.00, "cost": 950.00, "profit": 1550.00, "provisional_units": 2, "provisional_revenue": 1300.00,
    "provisional_profit": 1000.00, "losses": 0}'::jsonb,
  'TX-1, TX-2, TX-3 and TX-6: 2,500 revenue, 950 cost, 1,550 profit — the Provisional 1,300 and 1,000 beside it');
select test.eq((select revenue from finance.money_month where month_on = (current_setting('t.m')::date + interval '1 month')::date),
  200.00, 'SA-5 in the next month');
