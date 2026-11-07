-- OVP-01 — Finance Overview cost-provisional (rulebook §16, Phase 7, CUJ 8). A period with one Fully Paid unit
-- whose cost is provisional and one Fully Paid unit with an approved cost: the Revenue total counts both units, the
-- Cost total counts only the costed unit and shows the provisional unit's cost empty, never as 0, and the Profit
-- total counts only the costed unit with the provisional profit apart as Provisional; the months rows agree with the
-- tiles. A provisional unit with some expense already approved is still excluded from cost and profit entirely — the
-- rule is by cost_status, not by whether anything is approved. A period of only cost-provisional units still counts
-- its units, so it is never misread as "nothing imported yet". Every value is made up.
select set_config('t.head', test.person('Test Finance Head', 'head')::text, true);
select set_config('t.m', (pg_catalog.date_trunc('month', core.riyadh_today()) - interval '1 month')::date::text, true);
select set_config('t.d', (current_setting('t.m')::date + 9)::text, true);
select set_config('t.d2', (current_setting('t.m')::date + interval '1 month' + interval '4 days')::date::text, true);
select set_config('t.d3', (current_setting('t.m')::date - interval '1 month' + interval '4 days')::date::text, true);

select test.as_person(current_setting('t.head')::uuid);
select api.finance_import('invoices', jsonb_build_array(
  jsonb_build_object('ref', 'TX-A', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'paid_on', current_setting('t.d'),
                     'total_sar', 1000),
  jsonb_build_object('ref', 'TX-B', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'paid_on', current_setting('t.d'),
                     'total_sar', 500),
  jsonb_build_object('ref', 'TX-C', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'paid_on', current_setting('t.d'),
                     'total_sar', 800),
  jsonb_build_object('ref', 'TX-D', 'status', 'Fully Paid', 'created_on', current_setting('t.d2'), 'paid_on', current_setting('t.d2'),
                     'total_sar', 400),
  jsonb_build_object('ref', 'TX-E', 'status', 'Fully Paid', 'created_on', current_setting('t.d3'), 'paid_on', current_setting('t.d3'),
                     'total_sar', 600)),
  now() - interval '2 days');
select api.finance_import('expenses', jsonb_build_array(
  jsonb_build_object('ref', 'TX-E', 'expense_type', 'Hotel', 'status', 'Approved', 'amount_sar', 250,
                     'created_at', '2026-01-01T10:00:00Z'),
  jsonb_build_object('ref', 'TX-B', 'expense_type', 'Hotel', 'status', 'Approved', 'amount_sar', 300,
                     'created_at', '2026-01-01T10:00:00Z'),
  jsonb_build_object('ref', 'TX-C', 'expense_type', 'Hotel', 'status', 'Approved', 'amount_sar', 300,
                     'created_at', '2026-01-01T10:00:00Z'),
  jsonb_build_object('ref', 'TX-C', 'expense_type', 'Visa', 'status', 'Pending', 'amount_sar', 100,
                     'created_at', '2026-01-01T11:00:00Z')),
  now() - interval '2 days');

-- the units as the read sees them: TX-A provisional with no cost, TX-B costed, TX-C provisional despite its approved 300
select test.as_owner();
select test.eq((select jsonb_object_agg(ref, jsonb_build_object('counted', counted, 'cost', cost, 'status', cost_status,
                                                                'profit', profit) order by ref)
                from finance.money_row),
  ('{"TX-A": {"counted": true, "cost": 0, "status": "provisional", "profit": 1000.00},
     "TX-B": {"counted": true, "cost": 300.00, "status": "ready", "profit": 200.00},
     "TX-C": {"counted": true, "cost": 300.00, "status": "provisional", "profit": 500.00},
     "TX-D": {"counted": true, "cost": 0, "status": "provisional", "profit": 400.00},
     "TX-E": {"counted": true, "cost": 250.00, "status": "ready", "profit": 350.00}}')::jsonb,
  'TX-A provisional with no cost, TX-B costed, TX-C provisional even with 300 approved, TX-D provisional next month, TX-E costed the month before');

-- the tiles: revenue counts all three, cost and profit count only the costed one, the provisional part sits beside them
select test.as_person(current_setting('t.head')::uuid);
select test.eq((select api.finance_period(current_setting('t.m')::date, current_setting('t.d')::date)
                       - 'from' - 'to' - 'months'),
  '{"units": 3, "revenue": 2300.00, "cost": 300.00, "profit": 200.00, "losses": 0, "estimate": null, "estimated_units": 0,
    "provisional": {"units": 2, "revenue": 1800.00, "cost": null, "profit": 1500.00}}'::jsonb,
  'revenue counts both kinds, cost and profit count only the costed unit, the provisional cost is empty, never 0');
select test.eq((select api.finance_period(current_setting('t.m')::date, current_setting('t.d')::date)
                       -> 'provisional' -> 'cost'),
  'null'::jsonb, 'the provisional cost answers null — empty, never 0');

-- the months rows agree with the tiles, figure for figure (the view itself is read as the owner, as in CNT-01;
-- the screen reads it only through api.finance_period)
select test.as_owner();
select test.eq((select to_jsonb(x) - 'month_on' from finance.money_month x where x.month_on = current_setting('t.m')::date),
  '{"units": 3, "revenue": 2300.00, "cost": 300.00, "profit": 200.00, "provisional_units": 2,
    "provisional_revenue": 1800.00, "provisional_profit": 1500.00, "losses": 0}'::jsonb,
  'the month row agrees with the tiles: same revenue, same cost, same profit, the provisional part beside it');
select test.as_person(current_setting('t.head')::uuid);
select test.eq((select (m ->> 'revenue')::numeric = (api.finance_period(current_setting('t.m')::date, current_setting('t.d')::date) ->> 'revenue')::numeric
                and (m ->> 'cost')::numeric = (api.finance_period(current_setting('t.m')::date, current_setting('t.d')::date) ->> 'cost')::numeric
                and (m ->> 'profit')::numeric = (api.finance_period(current_setting('t.m')::date, current_setting('t.d')::date) ->> 'profit')::numeric
                from pg_catalog.jsonb_array_elements(api.finance_period(current_setting('t.m')::date, current_setting('t.d')::date) -> 'months') m
                where (m ->> 'month_on')::date = current_setting('t.m')::date),
  true, 'the period''s own months agree with its tiles');

-- a period of only cost-provisional units: still one unit, its revenue counted, cost and profit 0 with the provisional part apart
select test.eq((select api.finance_period(current_setting('t.d2')::date, current_setting('t.d2')::date)
                       - 'from' - 'to' - 'months'),
  '{"units": 1, "revenue": 400.00, "cost": 0, "profit": 0, "losses": 0, "estimate": null, "estimated_units": 0,
    "provisional": {"units": 1, "revenue": 400.00, "cost": null, "profit": 400.00}}'::jsonb,
  'only provisional units: units still 1, so the period is never misread as empty, and profit is 0 with 400 apart');

-- and with no provisional unit at all the provisional cost is genuinely 0, not empty
select test.eq((select api.finance_period(current_setting('t.d3')::date, current_setting('t.d3')::date)
                       - 'from' - 'to' - 'months'),
  '{"units": 1, "revenue": 600.00, "cost": 250.00, "profit": 350.00, "losses": 0, "estimate": null, "estimated_units": 0,
    "provisional": {"units": 0, "revenue": 0, "cost": 0, "profit": 0}}'::jsonb,
  'a month with only a costed unit: the provisional part is genuinely 0, and the tiles count the unit in full');
