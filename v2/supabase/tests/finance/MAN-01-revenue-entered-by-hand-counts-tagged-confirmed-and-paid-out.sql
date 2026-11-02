-- MAN-01 — revenue that never reaches Payments, entered by hand (V629). A Commercial member enters a supplier-wallet
-- commission with its reference and the day the supplier confirmed it: it counts that day, tagged manual, and with no
-- cost typed its cost stays empty — not 0 — and its profit is Provisional; one typed with a cost has that cost. A
-- reference is one row, a day in the future and a row with no reference are refused, and a viewer enters nothing.
-- "Confirmed, not paid out" lists the rows still in the supplier's wallet; only Full on Finance records Paid out, which
-- never moves the month. A row confirmed in a closed month leaves the month as it was and is listed as a late change.
-- Every value is made up.
-- Sabotages: supabase/tests/sabotage/a-manual-row-with-no-cost-costs-zero.sql,
-- supabase/tests/sabotage/a-viewer-enters-revenue-by-hand.sql.
select set_config('t.head', test.person('Test Finance Head', 'head')::text, true);
select set_config('t.mem', test.person('Test Commercial Member', 'member')::text, true);
select set_config('t.view', test.person('Test Viewer', 'viewer')::text, true);
select set_config('t.d', (core.riyadh_today() - 3)::text, true);
select set_config('t.m', (pg_catalog.date_trunc('month', core.riyadh_today()) - interval '1 month')::date::text, true);

-- a closed last month
select test.as_person(current_setting('t.head')::uuid);
select api.finance_import('invoices', jsonb_build_array(
  jsonb_build_object('ref', 'TX-M0', 'status', 'Fully Paid', 'created_on', (current_setting('t.m')::date + 3)::text,
                     'total_sar', 100)), now() - interval '1 day');
select api.finance_month_close(current_setting('t.m')::date, 'made up: closed');

select test.as_person(current_setting('t.mem')::uuid);
select set_config('t.r1', api.finance_manual_revenue_add(jsonb_build_object(
  'external_ref', 'MADE-UP-COMM-0001', 'confirmed_on', current_setting('t.d'), 'total_sar', 500,
  'product', 'Direct Hotels', 'customer_name', 'Made Up Hotel Supplier'), 'made up: confirmed by email') ->> 'id', true);
select set_config('t.r2', api.finance_manual_revenue_add(jsonb_build_object(
  'external_ref', 'MADE-UP-COMM-0002', 'confirmed_on', current_setting('t.d'), 'total_sar', 300, 'cost_sar', 120,
  'name', 'Made-up individual sale')) ->> 'id', true);
select test.raises($$select api.finance_manual_revenue_add('{"external_ref": "made-up-comm-0001", "confirmed_on": "2026-01-05", "total_sar": 10}')$$,
  '23505', 'a reference is one row', 'finance.manual_reference_taken');
select test.raises(format('select api.finance_manual_revenue_add(%L)', jsonb_build_object('external_ref', 'MADE-UP-COMM-0003',
  'confirmed_on', (core.riyadh_today() + 1)::text, 'total_sar', 10)), 'P0001', 'a day in the future is refused',
  'finance.date_in_future');
select test.raises($$select api.finance_manual_revenue_add('{"confirmed_on": "2026-01-05", "total_sar": 10}')$$,
  'P0001', 'a row with no reference is refused', 'finance.manual_reference_required');
select test.as_person(current_setting('t.view')::uuid);
select test.raises($$select api.finance_manual_revenue_add('{"external_ref": "MADE-UP-COMM-0004", "confirmed_on": "2026-01-05", "total_sar": 10}')$$,
  '42501', 'a viewer enters nothing');

select test.as_owner();
select test.eq((select jsonb_object_agg(r.ref, jsonb_build_object('source', r.revenue_source, 'counted', r.counted,
                                                                  'cost', r.cost, 'profit', r.profit,
                                                                  'provisional', r.provisional))
                from finance.money_row r where r.revenue_source = 'manual'),
  '{"MAN-MADEUPCOMM0001": {"source": "manual", "counted": true, "cost": null, "profit": 500, "provisional": true},
    "MAN-MADEUPCOMM0002": {"source": "manual", "counted": true, "cost": 120, "profit": 180, "provisional": false}}'::jsonb,
  'counted on its day, tagged manual; no cost typed stays empty and Provisional, a typed cost counts');
select test.as_person(current_setting('t.head')::uuid);
select test.eq((select jsonb_build_object('revenue', p -> 'revenue', 'cost', p -> 'cost')
                from (select api.finance_period(current_setting('t.d')::date, current_setting('t.d')::date) p) x),
  '{"revenue": 800, "cost": 120}'::jsonb, 'its revenue counts; the empty cost adds nothing to Cost');

-- confirmed, not paid out
select test.eq((select jsonb_build_object('count', x -> 'count', 'total', x -> 'total_sar', 'days', x -> 'oldest_days')
                from (select api.finance_manual_not_paid_out() x) y),
  '{"count": 2, "total": 800, "days": 3}'::jsonb, 'the rows still in the supplier''s wallet, their total and the oldest''s age');
select test.as_person(current_setting('t.mem')::uuid);
select test.raises(format('select api.finance_manual_paid_out(%L, %L, 1)', current_setting('t.r1'), current_setting('t.d')),
  '42501', 'a member does not record Paid out');
select test.as_person(current_setting('t.head')::uuid);
select api.finance_manual_paid_out(current_setting('t.r1')::uuid, core.riyadh_today(), 1, 'made up: reached our account');
select test.eq((api.finance_manual_not_paid_out() ->> 'count')::int, 1, 'paid out, it leaves the list');
select test.as_owner();
select test.eq((select created_on from finance.money_row where ref = 'MAN-MADEUPCOMM0001'), current_setting('t.d')::date,
  'Paid out never moves its day');

-- a row confirmed in the closed month
select test.as_person(current_setting('t.mem')::uuid);
select api.finance_manual_revenue_add(jsonb_build_object('external_ref', 'MADE-UP-COMM-0005',
  'confirmed_on', (current_setting('t.m')::date + 10)::text, 'total_sar', 70));
select test.as_person(current_setting('t.head')::uuid);
select test.eq((api.finance_period(current_setting('t.m')::date,
                                   ((current_setting('t.m')::date + interval '1 month')::date - 1)) ->> 'revenue')::numeric,
  100::numeric, 'the closed month stays as it was');
select test.eq((select jsonb_agg(l ->> 'change') from jsonb_array_elements(api.finance_closed_months()) m,
                jsonb_array_elements(m -> 'late_changes') l where (m ->> 'month')::date = current_setting('t.m')::date),
  '["late_paid"]'::jsonb, 'and the row is listed as a late change');
