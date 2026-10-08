-- FRD-01 — the reads the Finance screens draw from (the screens brief I.3, I.4, I.9). The period's figures count every
-- paid unit with the Provisional part beside them, never hidden; each unit says Final or Provisional, and a pending one
-- is listed but not counted. A closed month keeps its frozen figures; a unit paid after the close is listed as a late
-- change with its riyals, and the frozen figures do not move. The Finance lists (a product with no supplier cost) are
-- edited through the list door, logged, and Undo takes it back. Every value is made up.
-- Sabotage: supabase/tests/sabotage/profit-leaves-provisional-out.sql.
select set_config('t.head', test.person('Test Finance Head', 'head')::text, true);
select set_config('t.m', (pg_catalog.date_trunc('month', core.riyadh_today()) - interval '1 month')::date::text, true);
select set_config('t.d', (current_setting('t.m')::date + 9)::text, true);

select test.as_person(current_setting('t.head')::uuid);
select api.finance_import('invoices', jsonb_build_array(
  jsonb_build_object('ref', 'TX-91', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'paid_on', current_setting('t.d'),
                     'total_sar', 400),
  jsonb_build_object('ref', 'TX-92', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'paid_on', current_setting('t.d'),
                     'total_sar', 300),
  jsonb_build_object('ref', 'TX-93', 'status', 'Published', 'created_on', current_setting('t.d'), 'total_sar', 50)),
  now() - interval '2 days');
select api.finance_import('expenses', jsonb_build_array(
  jsonb_build_object('ref', 'TX-91', 'expense_type', 'Hotel', 'status', 'Approved', 'amount_sar', 100,
                     'created_at', '2026-01-01T10:00:00Z')),
  now() - interval '2 days');

-- the period
select test.eq((select api.finance_period(current_setting('t.m')::date, current_setting('t.d')::date)
                       - 'from' - 'to' - 'months'),
  '{"units": 2, "revenue": 700.00, "cost": 100.00, "profit": 600.00, "losses": 0, "estimate": null, "estimated_units": 0,
    "provisional": {"units": 1, "revenue": 300.00, "cost": 0, "profit": 300.00}}'::jsonb,
  'the period counts every paid unit, the Provisional part beside it');
select test.eq((select jsonb_agg(jsonb_build_object('ref', ref, 'counted', counted, 'cost_is', cost_is) order by ref)
                from api.finance_period_units(current_setting('t.m')::date, current_setting('t.d')::date)),
  '[{"ref": "TX-91", "counted": true, "cost_is": "final"}, {"ref": "TX-92", "counted": true, "cost_is": "provisional"},
    {"ref": "TX-93", "counted": false, "cost_is": "provisional"}]'::jsonb,
  'each unit says Final or Provisional; the pending one is listed, not counted');
select test.raises($$select api.finance_period('2026-02-01', '2026-01-01')$$, 'P0001',
  'a period that ends before it starts is refused, never read as 0', 'common.invalid');

-- close the month, then a unit of it is paid late
select api.finance_month_close(current_setting('t.m')::date, 'made up: closed');
select api.finance_import('invoices', jsonb_build_array(
  jsonb_build_object('ref', 'TX-94', 'status', 'Fully Paid', 'created_on', current_setting('t.d'), 'paid_on', current_setting('t.d'),
                     'total_sar', 80)), now() - interval '1 day');
select test.eq((select m -> 'frozen' from jsonb_array_elements(api.finance_closed_months()) m
                where (m ->> 'month')::date = current_setting('t.m')::date),
  '{"units": 2, "revenue": 700.00, "cost": 100.00, "profit": 600.00}'::jsonb,
  'the closed month keeps its frozen figures');
select test.eq((select jsonb_agg(jsonb_build_object('ref', l ->> 'ref', 'change', l ->> 'change',
                                                    'revenue', (l ->> 'revenue_change')::numeric))
                from jsonb_array_elements(api.finance_closed_months()) m, jsonb_array_elements(m -> 'late_changes') l
                where (m ->> 'month')::date = current_setting('t.m')::date),
  '[{"ref": "TX-94", "change": "late_paid", "revenue": 80.00}]'::jsonb,
  'and lists the unit paid after the close, with its riyals');

-- a Finance list through the list door: logged, and Undo takes it back
select test.as_owner();
select set_config('t.p', (select id from finance.product where word = 'Direct Visas')::text, true);
select set_config('t.pv', (select version from finance.product where id = current_setting('t.p')::uuid)::text, true);
select set_config('t.adm', test.person('Test Finance Admin', 'admin')::text, true);
select test.as_person(current_setting('t.adm')::uuid);
select set_config('t.r', api.list_save('product', current_setting('t.p')::uuid, '{"no_supplier_cost": true}',
  current_setting('t.pv')::int, 'made up: visas carry no supplier cost')::text, true);
select test.as_owner();
select test.eq((select no_supplier_cost from finance.product where id = current_setting('t.p')::uuid), true,
  'a product is marked as having no supplier cost through the list door');
select test.ok(exists (select 1 from audit.change c where c.table_name = 'finance.product'
                       and c.row_id = current_setting('t.p')::uuid and 'no_supplier_cost' = any (c.fields)),
  'and the change is logged');
select test.as_person(current_setting('t.adm')::uuid);
select api.undo((current_setting('t.r')::jsonb ->> 'request_id')::uuid);
select test.as_owner();
select test.eq((select no_supplier_cost from finance.product where id = current_setting('t.p')::uuid), false,
  'Undo takes it back');
